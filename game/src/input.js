// Keyboard and mouse input. Arrow keys / WASD fly the plane, Shift and
// Ctrl work the throttle, G toggles the gear, C swaps the camera, H holds
// the autopilot, P pauses. Dragging the mouse steers too, and the wheel
// trims the throttle. Edge-triggered keys (gear, camera, pause...) fire
// once per press through the `pressed` set the game loop drains.

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDown = false;
    this.mousePitch = 0;
    this.mouseRoll = 0;
    this.wheelDelta = 0;
    this.anyKey = false;
    this._onKeyDown = (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.key.toLowerCase());
      this.keys.add(e.key.toLowerCase());
      this.anyKey = true;
    };
    this._onKeyUp = (e) => this.keys.delete(e.key.toLowerCase());
    this._onMouseDown = (e) => {
      if (e.button === 0) { this.mouseDown = true; this._lastX = e.clientX; this._lastY = e.clientY; }
    };
    this._onMouseUp = () => { this.mouseDown = false; this.mousePitch = 0; this.mouseRoll = 0; };
    this._onMouseMove = (e) => {
      if (!this.mouseDown) return;
      const dx = e.clientX - (this._lastX ?? e.clientX);
      const dy = e.clientY - (this._lastY ?? e.clientY);
      this._lastX = e.clientX; this._lastY = e.clientY;
      this.mouseRoll = clamp(this.mouseRoll + dx * 0.012, -1, 1);
      this.mousePitch = clamp(this.mousePitch + dy * 0.012, -1, 1);
    };
    this._onWheel = (e) => { e.preventDefault(); this.wheelDelta += e.deltaY; };
    this._onBlur = () => { this.keys.clear(); this.mouseDown = false; };
  }

  attach(target) {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    target.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    target.addEventListener('wheel', this._onWheel, { passive: false });
    this._target = target;
  }

  // Continuous flight controls for this frame, each in -1..1 (throttle is
  // a rate: +1 raises it, -1 lowers it).
  poll() {
    const k = this.keys;
    const pitchUp = k.has('w') || k.has('arrowup');
    const pitchDown = k.has('s') || k.has('arrowdown');
    const rollLeft = k.has('a') || k.has('arrowleft');
    const rollRight = k.has('d') || k.has('arrowright');
    const throttleUp = k.has('shift') || k.has('r');
    const throttleDown = k.has('control') || k.has('f');
    const throttle = (throttleUp ? 1 : 0) - (throttleDown ? 1 : 0)
      - Math.sign(this.wheelDelta) * 0.6;
    this.wheelDelta = 0;
    return {
      pitch: (pitchUp ? 1 : 0) - (pitchDown ? 1 : 0) + this.mousePitch,
      roll: (rollRight ? 1 : 0) - (rollLeft ? 1 : 0) + this.mouseRoll,
      throttle: clamp(throttle, -1, 1),
      brake: k.has('b') || k.has(' '),
    };
  }

  // True once, the frame after the key was pressed.
  wasPressed(key) {
    return this.pressed.has(key.toLowerCase());
  }

  endFrame() {
    this.pressed.clear();
    // Mouse steering decays back to neutral when the pilot lets go.
    if (!this.mouseDown) {
      this.mousePitch *= 0.8;
      this.mouseRoll *= 0.8;
    }
  }
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
