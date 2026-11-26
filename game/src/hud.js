// The HUD: lit instruments the pilot actually flies by — altitude, speed
// and heading in big glowing numbers, a compass tape, an artificial
// horizon with speed and altitude tapes, throttle / fuel / hull bars, a
// minimap of the islands, and an arrow that always points at the next
// target. All drawn from the live flight state, every frame.

import { CONFIG } from './config.js';
import { clamp, wrapAngleDeg, DEG } from './random.js';

function fmtTime(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

export class Hud {
  constructor(heightAt) {
    this.heightAt = heightAt;
    this.el = (id) => document.getElementById(id);
    this.compass = this.el('compass').getContext('2d');
    this.gauges = this.el('gauges').getContext('2d');
    this.map = this.el('minimap').getContext('2d');
    this.mapBase = this.buildMapBase(heightAt);
    this.toastTimer = 0;
    this.hintTimer = 14;
  }

  buildMapBase(heightAt) {
    const c = document.createElement('canvas');
    c.width = c.height = 150;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(150, 150);
    for (let py = 0; py < 150; py++) {
      for (let px = 0; px < 150; px++) {
        const x = (px / 150) * 4000 - 2000;
        const z = (py / 150) * 4000 - 2000;
        const h = heightAt(x, z);
        const i = (py * 150 + px) * 4;
        if (h > 1.5) { img.data[i] = 74; img.data[i + 1] = 148; img.data[i + 2] = 74; }
        else if (h > -2) { img.data[i] = 222; img.data[i + 1] = 198; img.data[i + 2] = 140; }
        else { img.data[i] = 24; img.data[i + 1] = 110; img.data[i + 2] = 150; }
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  toast(text, seconds = 3) {
    const t = this.el('toast');
    t.textContent = text;
    t.style.opacity = '1';
    this.toastTimer = seconds;
  }

  update(state, mission, cameraMode, dt) {
    // --- big numbers -------------------------------------------------------
    const altFt = Math.max(0, Math.round(state.y * 3.28084));
    const spdKts = Math.round(state.speed * 1.94384);
    const hdg = Math.round(((state.heading % 360) + 360) % 360);
    this.el('alt').textContent = altFt.toLocaleString('en-US');
    this.el('spd').textContent = String(spdKts);
    this.el('hdg').textContent = String(hdg).padStart(3, '0');
    this.el('thr-num').textContent = Math.round(state.throttle * 100) + '%';
    this.el('fuel-num').textContent = Math.round(state.fuel);
    this.el('hull-num').textContent = Math.round(state.hull);
    this.el('thr-fill').style.width = (state.throttle * 100) + '%';
    this.el('fuel-fill').style.width = state.fuel + '%';
    this.el('fuel-fill').style.background = state.fuel < 25 ? '#ff5a4a' : state.fuel < 50 ? '#ffc861' : '#7dff9a';
    this.el('hull-fill').style.width = state.hull + '%';
    this.el('hull-fill').style.background = state.hull < 40 ? '#ff5a4a' : '#7dff9a';
    this.el('stall-warn').style.opacity = state.stalled ? '1' : '0';
    this.el('cam-mode').textContent = cameraMode === 'cockpit' ? 'COCKPIT' : 'CHASE';
    this.el('gear-state').textContent = state.gearDown ? 'GEAR DOWN' : 'GEAR UP';
    this.el('gear-state').style.color = state.gearDown ? '#7dff9a' : '#ffc861';

    // --- mission card -------------------------------------------------------
    if (mission.mission) {
      this.el('mission-name').textContent = mission.mission.name;
      this.el('mission-objective').textContent = mission.mission.blurb;
      this.el('mission-progress').textContent = mission.progressText();
    }
    this.el('score').textContent = mission.score.toLocaleString('en-US');
    this.el('timer').textContent = fmtTime(mission.elapsed);

    // --- target arrow ---------------------------------------------------------
    const target = mission.currentTarget();
    const arrow = this.el('target-arrow');
    if (target) {
      const dx = target.x - state.x, dz = target.z - state.z;
      const bearing = Math.atan2(dx, -dz) / DEG;
      const rel = wrapAngleDeg(bearing - state.heading);
      arrow.style.transform = `rotate(${rel}deg)`;
      arrow.style.opacity = '1';
      const dist = Math.round(Math.hypot(dx, target.y - state.y, dz));
      this.el('target-dist').textContent = target.label + ' · ' + dist + ' m';
      this.el('target-dist').style.opacity = '1';
    } else {
      arrow.style.opacity = '0';
      this.el('target-dist').style.opacity = '0';
    }

    this.drawCompass(hdg);
    this.drawGauges(state);
    this.drawMinimap(state, mission);

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el('toast').style.opacity = '0';
    }
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.el('hint').style.opacity = '0.25';
    }
  }

  drawCompass(hdg) {
    const ctx = this.compass;
    const W = 360, H = 34;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(8,18,28,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let d = -60; d <= 60; d += 5) {
      const a = ((Math.round(hdg / 5) * 5 + d) % 360 + 360) % 360;
      const x = W / 2 + d * 3;
      const major = a % 30 === 0;
      ctx.strokeStyle = major ? '#ffd27d' : 'rgba(255,255,255,0.55)';
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, major ? 4 : 10);
      ctx.lineTo(x, major ? 16 : 14);
      ctx.stroke();
      if (major) {
        const label = a === 0 ? 'N' : a === 90 ? 'E' : a === 180 ? 'S' : a === 270 ? 'W' : String(a).padStart(3, '0');
        ctx.fillStyle = '#ffe9b0';
        ctx.fillText(label, x, 26);
      }
    }
    ctx.fillStyle = '#ffc861';
    ctx.beginPath();
    ctx.moveTo(W / 2 - 6, 0); ctx.lineTo(W / 2 + 6, 0); ctx.lineTo(W / 2, 7); ctx.closePath();
    ctx.fill();
  }

  drawGauges(state) {
    const ctx = this.gauges;
    const W = 460, H = 132;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(8,18,28,0.55)';
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 12);
    ctx.fill();
    ctx.save();
    ctx.shadowColor = '#7dff9a';
    ctx.shadowBlur = 8;

    // Artificial horizon, centre.
    const cx = W / 2, cy = H / 2 + 4, R = 52;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-state.bank * DEG);
    ctx.translate(0, state.pitch * 1.6);
    ctx.fillStyle = '#3f8fd2';
    ctx.fillRect(-R - 4, -R - 60, R * 2 + 8, R + 60);
    ctx.fillStyle = '#8a6a42';
    ctx.fillRect(-R - 4, 0, R * 2 + 8, R + 60);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-R, 0); ctx.lineTo(R, 0); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#ffe9b0';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    // Fixed wings of the horizon gauge.
    ctx.strokeStyle = '#ffc861';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 34, cy); ctx.lineTo(cx - 12, cy);
    ctx.moveTo(cx + 12, cy); ctx.lineTo(cx + 34, cy);
    ctx.moveTo(cx, cy - 4); ctx.lineTo(cx, cy + 4);
    ctx.stroke();
    ctx.restore();

    // Airspeed tape (left) and altitude tape (right).
    const spdKts = state.speed * 1.94384;
    const altFt = state.y * 3.28084;
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffe9b0';
    ctx.fillText('SPD ' + Math.round(spdKts) + ' kt', 14, 26);
    ctx.fillText('ALT ' + Math.round(altFt) + ' ft', W - 128, 26);
    ctx.fillText('V/S ' + (state.vy >= 0 ? '+' : '') + Math.round(state.vy * 196.85) + ' fpm', 14, H - 14);
    ctx.textAlign = 'right';
    ctx.fillText(state.stalled ? 'STALL' : (state.onGround ? 'ON GROUND' : 'AIRBORNE'), W - 14, H - 14);
    // Throttle mini-bar at the bottom centre.
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(cx - 60, H - 16, 120, 7);
    ctx.fillStyle = '#7dff9a';
    ctx.fillRect(cx - 60, H - 16, 120 * state.throttle, 7);
    ctx.restore();
  }

  drawMinimap(state, mission) {
    const ctx = this.map;
    const S = 150;
    ctx.clearRect(0, 0, S, S);
    ctx.drawImage(this.mapBase, 0, 0);
    const toMap = (x, z) => [((x + 2000) / 4000) * S, ((z + 2000) / 4000) * S];
    // Strips.
    ctx.strokeStyle = '#1c1c1c';
    ctx.lineWidth = 3;
    for (const s of Object.values(CONFIG.strips)) {
      const a = (s.heading - 90) * DEG;
      const [x1, y1] = toMap(s.x - Math.cos(a) * s.length / 2, s.z - Math.sin(a) * s.length / 2);
      const [x2, y2] = toMap(s.x + Math.cos(a) * s.length / 2, s.z + Math.sin(a) * s.length / 2);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // Rings: next one amber and pulsing, passed ones green.
    const t = performance.now() / 500;
    mission.rings.forEach((r, i) => {
      const [x, y] = toMap(r.x, r.z);
      ctx.beginPath();
      ctx.arc(x, y, i === mission.ringIndex ? 5 + Math.sin(t) * 1.5 : 3.5, 0, Math.PI * 2);
      ctx.strokeStyle = r.passed ? '#2aff5e' : i === mission.ringIndex ? '#ffc861' : 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    // The plane: a triangle pointing along its heading.
    const [px, py] = toMap(state.x, state.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(state.heading * DEG);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
