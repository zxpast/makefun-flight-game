// Screenshot poses: `?shot=cover` (and rings / landing / cockpit) starts a
// mission, puts the plane at a scripted pose, and lets the autopilot fly a
// fixed number of frames. The picture is therefore a real moment of the
// game — the same physics, the same renderer, the same HUD — frozen at a
// good angle. When the frames are done the game sets window.__shotReady so
// a screenshot tool knows the frame is final.

import { CONFIG } from './config.js';
import { autopilotInput } from './physics.js';

export function parseShot() {
  const params = new URLSearchParams(window.location.search);
  return params.get('shot');
}

export function applyShot(game, name) {
  const pose = CONFIG.shots[name];
  if (!pose) return false;
  game.startMission(pose.mission, {
    x: pose.pos[0], y: pose.pos[1], z: pose.pos[2],
    heading: pose.heading, pitch: pose.pitch,
    speed: pose.speed, throttle: pose.throttle,
    gear: pose.gear, onGround: false, fuel: 78,
  });
  game.setCameraMode(pose.camera);
  game.shotMode = true;
  game.state.score = 0;
  // The rings shot shows progress: one ring already banked, the next
  // ahead. The cover keeps the first ring ahead and unpassed so it reads
  // big in frame.
  if (name === 'rings') {
    game.mission.rings[0].passed = true;
    game.mission.ringIndex = 1;
    game.mission.score = 150;
  }
  const dt = 1 / 60;
  for (let i = 0; i < pose.frames; i++) {
    const target = game.mission.currentTarget();
    const input = autopilotInput(game.state, target, dt);
    game.step(dt, input);
  }
  // Refresh every instrument from the frozen state, then hide the toast:
  // a screenshot wants the numbers, not a banner across the sky.
  game.renderer.snapCamera(game.state);
  game.hud.update(game.state, game.mission, game.cameraMode, 0.016);
  game.hud.el('toast').style.opacity = '0';
  game.renderFrame();
  window.__shotReady = true;
  return true;
}
