// Missions: the goals that turn flying into decisions. Three kinds —
// thread the rings, land on every strip in the chain, or chase rings
// endlessly while the fuel gauge falls. The manager owns the score, the
// timer and the current target the HUD arrow and the beacons point at.

import { CONFIG } from './config.js';

export class MissionManager {
  constructor() {
    this.mission = null;
    this.score = 0;
    this.elapsed = 0;
    this.rings = [];
    this.ringIndex = 0;
    this.stops = [];
    this.stopIndex = 0;
    this.lap = 1;
    this.done = false;
    this.message = '';
  }

  load(id) {
    const def = CONFIG.missions.find((m) => m.id === id) || CONFIG.missions[0];
    this.mission = def;
    this.score = 0;
    this.elapsed = 0;
    this.ringIndex = 0;
    this.stopIndex = 0;
    this.lap = 1;
    this.done = false;
    this.rings = (def.rings || []).map((r, i) => ({
      ...r, index: i, passed: false,
    }));
    this.stops = (def.stops || []).slice();
    this.message = def.blurb;
    return def;
  }

  // The thing the pilot is flying toward right now.
  currentTarget() {
    if (!this.mission || this.done) return null;
    if (this.mission.kind === 'landings') {
      const stopId = this.stops[this.stopIndex];
      if (!stopId) return null;
      const s = CONFIG.strips[stopId];
      return { kind: 'strip', id: stopId, x: s.x, y: s.padHeight + 6, z: s.z, label: s.name };
    }
    const ring = this.rings[this.ringIndex];
    if (ring) {
      return { kind: 'ring', id: ring.index, x: ring.x, y: ring.y, z: ring.z, label: 'Ring ' + (ring.index + 1) };
    }
    if (this.mission.kind === 'rings') {
      const s = CONFIG.strips[this.mission.finishStrip];
      return { kind: 'strip', id: this.mission.finishStrip, x: s.x, y: s.padHeight + 6, z: s.z, label: 'Land at ' + s.name };
    }
    return null;
  }

  progressText() {
    if (!this.mission) return '';
    if (this.mission.kind === 'rings') {
      if (this.ringIndex < this.rings.length) return `Rings ${this.ringIndex}/${this.rings.length}`;
      return 'Rings done — land at Coral Field';
    }
    if (this.mission.kind === 'landings') {
      return `Stops ${this.stopIndex}/${this.stops.length}`;
    }
    return `Lap ${this.lap} — rings ${this.ringIndex}/${this.rings.length}`;
  }

  update(dt, state, events) {
    if (!this.mission || this.done) return [];
    this.elapsed += dt;
    const out = [];

    for (const ev of events) {
      if (ev.type === 'landed' || ev.type === 'hardLanding' || ev.type === 'bellyLanding') {
        out.push(...this.onTouchdown(ev, state));
      }
    }

    // Ring passes: within 14 m of the ring centre.
    const ring = this.rings[this.ringIndex];
    if (ring && this.mission.kind !== 'landings') {
      const d = Math.hypot(state.x - ring.x, state.y - ring.y, state.z - ring.z);
      if (d < 14) {
        ring.passed = true;
        this.ringIndex++;
        this.score += CONFIG.ringPoints;
        out.push({ type: 'ring', index: ring.index, score: this.score });
        if (this.ringIndex >= this.rings.length && this.mission.kind === 'endless') {
          // Endless mode: the course resets and the lap counter climbs.
          this.rings.forEach((r) => { r.passed = false; });
          this.ringIndex = 0;
          this.lap++;
          out.push({ type: 'lap', lap: this.lap });
        }
      }
    }
    return out;
  }

  onTouchdown(ev, state) {
    const out = [];
    const stripId = ev.strip ? ev.strip.id : null;
    if (!stripId) {
      // Off-strip touchdown: no points, but the plane survived.
      if (ev.type === 'landed') out.push({ type: 'offField', score: this.score });
      return out;
    }
    if (this.mission.kind === 'landings') {
      const want = this.stops[this.stopIndex];
      if (stripId === want && (ev.type === 'landed' || ev.type === 'hardLanding')) {
        this.stopIndex++;
        this.score += CONFIG.hopPoints;
        out.push({ type: 'stop', strip: stripId, score: this.score });
        if (this.stopIndex >= this.stops.length) {
          this.done = true;
          this.score += Math.max(0, Math.round(600 - this.elapsed * CONFIG.timeBonusPerSecond));
          out.push({ type: 'complete', score: this.score });
        }
      } else if (stripId !== want) {
        out.push({ type: 'wrongStrip', strip: stripId, want, score: this.score });
      }
      return out;
    }
    if (this.mission.kind === 'rings' && this.ringIndex >= this.rings.length) {
      if (stripId === this.mission.finishStrip && ev.type === 'landed') {
        this.done = true;
        const bonus = (ev.soft ? CONFIG.softLandingBonus : 0)
          + Math.max(0, Math.round(900 - this.elapsed * CONFIG.timeBonusPerSecond));
        this.score += CONFIG.landingPoints + bonus;
        out.push({ type: 'complete', score: this.score, bonus });
      } else if (stripId === this.mission.finishStrip && ev.type !== 'landed') {
        out.push({ type: 'roughFinish', score: this.score });
      }
      return out;
    }
    // Any other landing (free flight, mid-mission) refuels and banks points.
    if (ev.type === 'landed') {
      this.score += 50;
      out.push({ type: 'refuelStop', strip: stripId, score: this.score });
    }
    return out;
  }
}
