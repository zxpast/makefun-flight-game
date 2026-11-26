// Arcade flight model: throttle sets a target speed, the elevator sets a
// pitch, the ailerons set a bank and the bank turns the plane. Below the
// stall speed the wing gives up and the nose drops. Ground contact is a
// landing when it is slow, level and on a strip — anything else is damage
// or a crash. Pure numbers: no rendering, no DOM, easy to test.

import { CONFIG } from './config.js';
import { clamp, lerp, wrapAngleDeg, DEG } from './random.js';
import { stripAt } from './terrain.js';

export function createFlightState(pose) {
  return {
    x: pose.x, y: pose.y, z: pose.z,
    heading: pose.heading, pitch: pose.pitch || 0, bank: 0,
    speed: pose.speed || 0, throttle: pose.throttle || 0,
    vy: 0, fuel: pose.fuel ?? CONFIG.fuelMax, hull: CONFIG.hullMax,
    gearDown: pose.gear !== undefined ? pose.gear : true,
    onGround: pose.onGround !== undefined ? pose.onGround : true,
    airborne: false, stalled: false, time: 0,
  };
}

export function forwardVector(heading, pitch) {
  const h = heading * DEG, p = pitch * DEG;
  return {
    x: Math.sin(h) * Math.cos(p),
    y: Math.sin(p),
    z: -Math.cos(h) * Math.cos(p),
  };
}

// Autopilot: wings level, hold altitude, steer toward a target point.
// Used by the screenshot poses and by the in-game autopilot key (H).
export function autopilotInput(state, target, dt) {
  const input = { pitch: 0, roll: 0, throttle: 0, brake: false };
  if (!target) {
    input.roll = clamp(-state.bank / 30, -1, 1);
    input.pitch = clamp(-state.pitch / 20, -1, 1);
    return input;
  }
  const dx = target.x - state.x, dz = target.z - state.z;
  const wantHeading = Math.atan2(dx, -dz) / DEG;
  const headingErr = wrapAngleDeg(wantHeading - state.heading);
  const wantBank = clamp(headingErr * 0.9, -35, 35);
  input.roll = clamp((wantBank - state.bank) / 25, -1, 1);
  const wantAlt = target.y ?? state.y;
  const altErr = wantAlt - state.y;
  const wantPitch = clamp(altErr * 0.12, -10, 10);
  input.pitch = clamp((wantPitch - state.pitch) / 12, -1, 1);
  const wantSpeed = 55;
  input.throttle = clamp((wantSpeed - state.speed) / 30, -1, 1);
  return input;
}

export function stepFlight(state, input, dt, heightAt) {
  const events = [];
  const C = CONFIG;
  state.time += dt;

  // --- fuel ---------------------------------------------------------------
  if (state.fuel > 0) {
    state.fuel -= (C.fuelBurnIdle + state.throttle * (C.fuelBurnFull - C.fuelBurnIdle)) * dt;
    if (state.fuel < 0) state.fuel = 0;
  }
  const effectiveThrottle = state.fuel <= 0 ? 0 : state.throttle;

  // --- throttle -----------------------------------------------------------
  if (input.throttle !== 0) {
    state.throttle = clamp(state.throttle + input.throttle * C.throttleStep * dt, 0, 1);
  }

  // --- speed: pulled toward the throttle target, bled by climbing ---------
  let targetSpeed = C.minFlyingSpeed + effectiveThrottle * (C.maxSpeed - C.minFlyingSpeed);
  targetSpeed -= Math.sin(state.pitch * DEG) * 20;
  if (state.gearDown) targetSpeed -= C.gearDrag * 100 * 0.4;
  state.speed += (targetSpeed - state.speed) * C.drag * dt;
  state.speed = clamp(state.speed, 0, C.maxSpeed + 6);

  // --- attitude -----------------------------------------------------------
  if (state.onGround) {
    state.pitch = clamp(state.pitch + input.pitch * C.pitchRate * dt, 0, 10);
    state.bank = 0;
  } else {
    state.pitch = clamp(state.pitch + input.pitch * C.pitchRate * dt, -C.maxPitch, C.maxPitch);
    state.bank = clamp(state.bank + input.roll * C.rollRate * dt, -C.maxBank, C.maxBank);
    // No aileron input: the wings ease back toward level.
    if (input.roll === 0) {
      const ease = 26 * dt;
      state.bank = Math.abs(state.bank) <= ease ? 0 : state.bank - Math.sign(state.bank) * ease;
    }
  }

  // --- stall ---------------------------------------------------------------
  state.stalled = !state.onGround && state.speed < C.stallSpeed;
  if (state.stalled) {
    state.pitch = lerp(state.pitch, -7, dt * 0.9);
  }

  // --- turn: a banked wing turns the nose ----------------------------------
  if (!state.onGround && state.speed > 8) {
    const turnRate = (C.turnFactor * Math.tan(state.bank * DEG) / Math.max(state.speed, 12)) / DEG;
    state.heading = (state.heading + turnRate * dt + 360) % 360;
  }

  // --- vertical speed and position -----------------------------------------
  let vy = state.speed * Math.sin(state.pitch * DEG);
  if (state.stalled) vy -= (C.stallSpeed - state.speed) * C.climbSink;
  state.vy = vy;
  const fwd = forwardVector(state.heading, state.pitch);
  state.x += fwd.x * state.speed * dt;
  state.z += fwd.z * state.speed * dt;
  state.y += vy * dt;

  // --- world edge: a soft wall that nudges the plane back ------------------
  const B = CONFIG.worldHalf - 60;
  if (Math.abs(state.x) > B || Math.abs(state.z) > B) {
    state.x = clamp(state.x, -B, B);
    state.z = clamp(state.z, -B, B);
    events.push({ type: 'edge' });
  }

  // --- ground contact ------------------------------------------------------
  const groundY = heightAt(state.x, state.z);
  const clearance = state.y - groundY;
  if (state.onGround) {
    state.y = groundY + 1.3;
    const rolling = state.speed;
    state.speed = Math.max(0, state.speed - (input.brake ? 14 : 2.5) * dt);
    if (state.speed > C.takeoffSpeed && state.pitch > 4 && state.throttle > 0.5) {
      state.onGround = false;
      state.airborne = true;
      events.push({ type: 'takeoff' });
    }
    if (rolling > 0.5 && state.speed <= 0.5) {
      events.push({ type: 'stopped', strip: stripAt(state.x, state.z) });
    }
  } else if (clearance <= 1.3) {
    const sink = -vy;
    const strip = stripAt(state.x, state.z);
    const onPavement = strip !== null;
    state.y = groundY + 1.3;
    if (groundY < 0.5) {
      // Ditching in the sea is a crash, whatever the speed.
      events.push({ type: 'crash', reason: 'ditched in the sea', sink });
      state.hull = 0;
    } else if (!onPavement && sink > 2.0) {
      events.push({ type: 'crash', reason: 'flew into the hillside', sink });
      state.hull = 0;
    } else if (sink > C.crashSink || state.speed > 78) {
      events.push({ type: 'crash', reason: 'hit the ground too hard', sink });
      state.hull = 0;
    } else if (!state.gearDown) {
      state.hull -= C.damageScrape;
      state.onGround = true;
      state.speed *= 0.45;
      events.push({ type: 'bellyLanding', strip, sink, hull: state.hull });
      if (state.hull <= 0) events.push({ type: 'crash', reason: 'belly landing tore the plane apart', sink });
    } else if (state.speed > C.landingMaxSpeed || sink > C.landingMaxSink) {
      state.hull -= C.damageHardLanding;
      state.onGround = true;
      state.speed *= 0.7;
      events.push({ type: 'hardLanding', strip, sink, hull: state.hull });
      if (state.hull <= 0) events.push({ type: 'crash', reason: 'hard landing broke the plane apart', sink });
    } else {
      state.onGround = true;
      state.pitch = 0;
      state.bank = 0;
      events.push({ type: 'landed', strip, sink, soft: sink < 2.5 });
    }
  }
  return events;
}
