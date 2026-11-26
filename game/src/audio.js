// Procedural sound: no audio files, everything is synthesised with the
// Web Audio API. An engine hum that follows the throttle, wind that rises
// with speed, a chime for a ring and a thud for a touchdown. Silent until
// the player first interacts, and a no-op where audio is unavailable.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.windGain = null;
    this.enabled = false;
  }

  ensure() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();

      // Wind: looped white noise through a low-pass filter.
      const len = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const windFilter = this.ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0;
      noise.connect(windFilter);
      windFilter.connect(this.windGain);
      this.windGain.connect(this.ctx.destination);
      noise.start();
      this.enabled = true;
    } catch {
      this.ctx = null;
    }
  }

  update(throttle, speed, airborne) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(airborne ? 0.035 + throttle * 0.05 : 0.02 + throttle * 0.03, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(48 + throttle * 95 + speed * 0.25, t, 0.1);
    this.windGain.gain.setTargetAtTime(Math.min(0.09, speed * 0.0011), t, 0.15);
  }

  blip(freq, dur, type = 'sine', gain = 0.12) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  chime() { this.blip(880, 0.35); setTimeout(() => this.blip(1318, 0.4), 90); }
  thud() { this.blip(70, 0.3, 'triangle', 0.2); }
  fanfare() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.45), i * 130));
  }
  alarm() { this.blip(220, 0.5, 'square', 0.08); }
}
