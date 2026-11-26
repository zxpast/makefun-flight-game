// Sky Courier: Coral Isles — boot, game loop and state machine. Title,
// playing, paused, crashed, landed and complete are the only states; the
// loop always renders, and only steps the simulation while playing, so a
// paused or finished game still shows the world it ended in.

import { CONFIG } from './config.js';
import { Renderer } from './render.js';
import { createFlightState, stepFlight, autopilotInput } from './physics.js';
import { MissionManager } from './missions.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { parseShot, applyShot } from './shots.js';
import { stripAt } from './terrain.js';

const DEFAULT_POSE = {
  x: -200, y: 11.3, z: -40, heading: 90, pitch: 0,
  speed: 0, throttle: 0, gear: true, onGround: true,
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.hud = new Hud(this.renderer.world.heightAt);
    this.input = new Input();
    this.input.attach(canvas);
    this.audio = new AudioEngine();
    this.mission = new MissionManager();
    this.state = createFlightState(DEFAULT_POSE);
    this.mode = 'title';
    this.cameraMode = 'chase';
    this.autopilot = false;
    this.shotMode = false;
    this.last = 0;
    this.lastEdgeToast = -10;
    this.lastStopToast = -10;
    this.overlay = null;

    window.addEventListener('resize', () => this.renderer.onResize());
    this.bindOverlayButtons();
    this.showOverlay('title');
    this.startTitleScene();
  }

  bindOverlayButtons() {
    document.querySelectorAll('[data-mission]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.audio.ensure();
        this.startMission(btn.dataset.mission);
      });
    });
    const again = document.getElementById('fly-again');
    if (again) again.addEventListener('click', () => this.startMission(this.mission.mission.id));
    const resume = document.getElementById('resume-btn');
    if (resume) resume.addEventListener('click', () => {
      if (this.mode === 'paused') { this.mode = 'playing'; this.hideOverlays(); }
    });
  }

  showOverlay(name) {
    this.overlay = name;
    for (const id of ['title', 'pause', 'end']) {
      const el = document.getElementById('overlay-' + id);
      if (el) el.style.display = id === name ? 'flex' : 'none';
    }
  }

  hideOverlays() {
    this.showOverlay(null);
  }

  startTitleScene() {
    this.state = createFlightState(DEFAULT_POSE);
    this.mission.load('ring-run');
    this.renderer.setRings(this.mission.rings);
    this.mode = 'title';
    this.showOverlay('title');
  }

  startMission(id, pose) {
    const p = pose || DEFAULT_POSE;
    this.state = createFlightState(p);
    this.mission.load(id);
    this.renderer.setRings(this.mission.rings);
    this.autopilot = false;
    this.mode = 'playing';
    this.hideOverlays();
    this.hud.toast(this.mission.mission.blurb, 4);
    this.hud.hintTimer = 14;
    document.getElementById('hint').style.opacity = '1';
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
    this.renderer.setCameraMode(mode);
  }

  toggleCamera() {
    this.setCameraMode(this.cameraMode === 'chase' ? 'cockpit' : 'chase');
    this.hud.toast(this.cameraMode === 'cockpit' ? 'Cockpit view' : 'Chase view', 1.5);
  }

  // One fixed simulation step. Shared by the live loop and the screenshot
  // poses, so a screenshot is a real slice of play.
  step(dt, input) {
    const events = stepFlight(this.state, input, dt, this.renderer.world.heightAt);
    const missionEvents = this.mission.update(dt, this.state, events);
    this.handleEvents(events, missionEvents);
    // Refuel while parked on a strip.
    if (this.state.onGround && this.state.speed < 8 && stripAt(this.state.x, this.state.z)) {
      if (this.state.fuel < CONFIG.fuelMax) {
        this.state.fuel = Math.min(CONFIG.fuelMax, this.state.fuel + 25 * dt);
      }
    }
    this.audio.update(this.state.throttle, this.state.speed, !this.state.onGround);
  }

  handleEvents(events, missionEvents) {
    for (const ev of events) {
      if (ev.type === 'edge' && this.state.time - this.lastEdgeToast > 6) {
        this.lastEdgeToast = this.state.time;
        this.hud.toast('Open sea beyond the chart — turn back', 3);
      }
      if (ev.type === 'takeoff') {
        this.hud.toast('Airborne! Gear up with G when you are climbing', 3);
      }
      if (ev.type === 'stopped' && this.state.time - this.lastStopToast > 5) {
        this.lastStopToast = this.state.time;
        this.hud.toast('Parked. Fuel is topping up on the strip.', 3);
      }
      if (ev.type === 'hardLanding') {
        this.audio.thud();
        this.hud.toast(`Hard landing! Hull -${CONFIG.damageHardLanding}`, 3);
      }
      if (ev.type === 'bellyLanding') {
        this.audio.thud();
        this.hud.toast('Belly landing! Gear was up — hull damaged', 3);
      }
      if (ev.type === 'crash') {
        this.audio.thud();
        this.audio.alarm();
        this.endGame(false, 'Crashed — ' + ev.reason);
      }
    }
    for (const ev of missionEvents) {
      if (ev.type === 'ring') {
        this.audio.chime();
        this.hud.toast(`Ring ${ev.index + 1} — +${CONFIG.ringPoints}`, 2);
      } else if (ev.type === 'stop') {
        this.audio.chime();
        this.hud.toast(`Stop ${ev.strip} complete — +${CONFIG.hopPoints}`, 3);
      } else if (ev.type === 'lap') {
        this.hud.toast(`Lap ${ev.lap} — the rings are back`, 3);
      } else if (ev.type === 'wrongStrip') {
        this.hud.toast(`Wrong strip — next stop is ${CONFIG.strips[ev.want].name}`, 3);
      } else if (ev.type === 'offField') {
        this.hud.toast('Off-field landing — no points, but you walked away', 3);
      } else if (ev.type === 'refuelStop') {
        this.hud.toast(`Down at ${CONFIG.strips[ev.strip].name} — fuel topped up`, 3);
      } else if (ev.type === 'roughFinish') {
        this.hud.toast('You made it down, but rough — land clean to finish', 3);
      } else if (ev.type === 'complete') {
        this.audio.fanfare();
        this.endGame(true, 'Mission complete!');
      }
    }
    if (this.state.hull <= 0 && this.mode === 'playing') {
      this.endGame(false, 'Crashed — the hull gave out');
    }
    if (this.state.fuel <= 0 && this.mode === 'playing' && !this.state.onGround) {
      this.hud.toast('Fuel empty! Glide to a strip — throttle is dead', 4);
    }
  }

  endGame(won, headline) {
    this.mode = won ? 'complete' : 'crashed';
    const title = document.getElementById('end-title');
    const body = document.getElementById('end-body');
    if (title) title.textContent = headline;
    if (body) {
      body.innerHTML =
        `Score <b>${this.mission.score.toLocaleString('en-US')}</b> · ` +
        `Time ${this.mission.elapsed.toFixed(0)}s · ` +
        `Mission: ${this.mission.mission.name}<br>` +
        `<span class="dim">Press R or click Fly again to go around.</span>`;
    }
    document.getElementById('end-title').style.color = won ? '#7dff9a' : '#ff6b5e';
    this.showOverlay('end');
  }

  renderFrame() {
    this.renderer.update(this.state, this.mission, 1 / 60);
    this.renderer.render();
  }

  loop = (t) => {
    requestAnimationFrame(this.loop);
    const dt = Math.min((t - this.last) / 1000 || 0.016, 0.05);
    this.last = t;

    // Edge-triggered keys, handled once per press.
    if (this.input.wasPressed('g') && this.mode === 'playing') {
      this.state.gearDown = !this.state.gearDown;
      this.hud.toast(this.state.gearDown ? 'Gear down' : 'Gear up', 1.5);
    }
    if (this.input.wasPressed('c') && this.mode === 'playing') this.toggleCamera();
    if (this.input.wasPressed('h') && this.mode === 'playing') {
      this.autopilot = !this.autopilot;
      this.hud.toast(this.autopilot ? 'Autopilot on — wings level' : 'Autopilot off', 2);
    }
    if (this.input.wasPressed('p')) {
      if (this.mode === 'playing') { this.mode = 'paused'; this.showOverlay('pause'); }
      else if (this.mode === 'paused') { this.mode = 'playing'; this.hideOverlays(); }
    }
    if (this.input.wasPressed('r') && this.mode !== 'title') {
      this.startMission(this.mission.mission.id);
    }
    if (this.input.wasPressed('m') && this.mode === 'playing') {
      const ids = CONFIG.missions.map((m) => m.id);
      const next = ids[(ids.indexOf(this.mission.mission.id) + 1) % ids.length];
      this.startMission(next);
    }
    if (this.input.wasPressed('enter') && this.mode === 'title') {
      this.audio.ensure();
      this.startMission('ring-run');
    }
    if (this.input.anyKey) this.audio.ensure();
    this.input.anyKey = false;

    if (this.mode === 'title') {
      // Slow cinematic orbit around the parked plane on Coral Field.
      this.renderer.updateTitle(this.state, dt);
      this.renderer.render();
      this.hud.update(this.state, this.mission, this.cameraMode, dt);
    } else if (this.mode === 'playing') {
      let input = this.input.poll();
      if (this.autopilot) {
        input = autopilotInput(this.state, this.mission.currentTarget(), dt);
      }
      this.step(dt, input);
      this.hud.update(this.state, this.mission, this.cameraMode, dt);
      this.renderer.update(this.state, this.mission, dt);
      this.renderer.render();
    } else {
      // Paused, crashed or complete: hold the last frame's world still.
      this.renderer.update(this.state, this.mission, 0);
      this.renderer.render();
      this.hud.update(this.state, this.mission, this.cameraMode, dt);
    }
    this.input.endFrame();
  };

  run() {
    requestAnimationFrame(this.loop);
  }
}

function boot() {
  try {
    const canvas = document.getElementById('scene');
    const game = new Game(canvas);
    window.__game = game;
    const shot = parseShot();
    if (shot) {
      const ok = applyShot(game, shot);
      if (!ok) window.__shotError = 'unknown shot: ' + shot;
      return;
    }
    game.run();
  } catch (err) {
    window.__shotError = String(err && err.message ? err.message : err);
    const el = document.getElementById('toast');
    if (el) { el.textContent = 'Failed to start: ' + window.__shotError; el.style.opacity = '1'; }
    console.error(err);
  }
}

boot();
