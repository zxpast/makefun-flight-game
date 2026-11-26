// Deterministic randomness for the world: a small seeded PRNG plus value
// noise with fractal octaves. The same seed always grows the same islands,
// so screenshots and replays match the game the player flies.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 2D value noise on a jittered integer lattice.
export function makeValueNoise(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = base[i]; base[i] = base[j]; base[j] = tmp;
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];
  const lattice = new Float32Array(256);
  for (let i = 0; i < 256; i++) lattice[i] = rand();

  function fade(t) { return t * t * (3 - 2 * t); }
  function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const v00 = lattice[perm[(perm[X] + Y) & 255]];
    const v10 = lattice[perm[(perm[(X + 1) & 255] + Y) & 255]];
    const v01 = lattice[perm[(perm[X] + Y + 1) & 255]];
    const v11 = lattice[perm[(perm[(X + 1) & 255] + Y + 1) & 255]];
    const u = fade(xf), v = fade(yf);
    const a = v00 + (v10 - v00) * u;
    const b = v01 + (v11 - v01) * u;
    return a + (b - a) * v; // 0..1
  }

  // Fractal Brownian motion, 4 octaves, returns roughly 0..1.
  function fbm(x, y) {
    let sum = 0, amp = 0.5, freq = 1, norm = 0;
    for (let o = 0; o < 4; o++) {
      sum += amp * noise2(x * freq, y * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum / norm;
  }

  return { noise2, fbm };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
export const DEG = Math.PI / 180;
export function wrapAngleDeg(a) {
  a %= 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}
