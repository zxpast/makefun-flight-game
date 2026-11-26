// Coral Isles terrain: a seeded archipelago of six islands, a turquoise
// ocean that shallows near shore, a gradient sky, drifting clouds, palm
// groves and three flattened airstrips with their buildings. The same
// heightAt() drives the mesh, the colours, the trees and the flight model,
// so what the pilot sees is exactly what the plane can hit.

import { CONFIG } from './config.js';
import { makeValueNoise, clamp, lerp, smoothstep } from './random.js';

const WORLD = CONFIG.worldHalf * 2;

function islandMask(x, z, island) {
  const dx = x - island.x, dz = z - island.z;
  return Math.hypot(dx, dz) / island.radius;
}

// Height of the land at a point, in metres above sea level. Negative under
// water. Strips are flattened to their pad height.
export function makeHeightAt(seed) {
  const { fbm } = makeValueNoise(seed + 11);
  const strips = Object.values(CONFIG.strips);
  return function heightAt(x, z) {
    let h = -10 + 3 * fbm(x * 0.004 + 31, z * 0.004 + 17);
    for (const island of CONFIG.islands) {
      const d = islandMask(x, z, island);
      if (d >= 1) continue;
      const cone = Math.pow(1 - d, 1.6);
      const ridge = 0.55 + 0.6 * fbm(x * 0.005 + 7, z * 0.005 + 3);
      h += island.peak * cone * ridge;
    }
    // Flatten a pad around every airstrip so runways sit level.
    for (const s of strips) {
      const a = (s.heading - 90) * (Math.PI / 180);
      const dx = x - s.x, dz = z - s.z;
      const along = dx * Math.cos(a) + dz * Math.sin(a);
      const across = -dx * Math.sin(a) + dz * Math.cos(a);
      const edge = Math.max(
        Math.abs(along) - s.length / 2,
        Math.abs(across) - s.width / 2,
      );
      if (edge < 70) {
        const t = smoothstep(70, 0, edge);
        h = lerp(h, s.padHeight, t);
      }
    }
    // A broad airfield plain around Coral Field: low, level ground for
    // the runway, the hangar and a safe approach from the sea.
    const main = CONFIG.strips.main;
    const dm = Math.hypot(x - main.x, z - main.z) / 620;
    if (dm < 1) {
      const rim = smoothstep(0.35, 1, dm);
      h = lerp(main.padHeight, h, rim);
    }
    return h;
  };
}

// True when (x, z) lies on the paved part of a strip (plus a small margin).
export function stripAt(x, z, margin = 6) {
  for (const [id, s] of Object.entries(CONFIG.strips)) {
    const a = (s.heading - 90) * (Math.PI / 180);
    const dx = x - s.x, dz = z - s.z;
    const along = dx * Math.cos(a) + dz * Math.sin(a);
    const across = -dx * Math.sin(a) + dz * Math.cos(a);
    if (Math.abs(along) <= s.length / 2 + margin && Math.abs(across) <= s.width / 2 + margin) {
      return { id, strip: s, along, across };
    }
  }
  return null;
}

function paintLand(height, fbmVal) {
  // Sand, grass, forest, rock, snow — one palette for terrain and sky.
  if (height < 1.5) return [0.86, 0.76, 0.55]; // wet sand / shore
  if (height < 5) return [0.87, 0.78, 0.58]; // dry sand
  if (height < 90) {
    const g = 0.42 + 0.34 * fbmVal;
    return [0.30 * g + 0.10, 0.60 * g + 0.10, 0.26 * g + 0.05]; // grass, patchy
  }
  if (height < 175) return [0.16, 0.38, 0.18]; // forest
  if (height < 265) return [0.52, 0.47, 0.40]; // rock
  return [0.93, 0.94, 0.96]; // snow caps
}

export function buildWorld(seed) {
  const heightAt = makeHeightAt(seed);
  const { fbm } = makeValueNoise(seed + 23);
  const group = new THREE.Group();
  group.name = 'world';

  // --- terrain mesh -------------------------------------------------------
  const SEG = 168;
  const terrainGeo = new THREE.PlaneGeometry(WORLD, WORLD, SEG, SEG);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;
  const colours = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    const n = fbm(x * 0.02 + 5, z * 0.02 + 9);
    const [r, g, b] = paintLand(h, n);
    colours[i * 3] = r; colours[i * 3 + 1] = g; colours[i * 3 + 2] = b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  terrainGeo.computeVertexNormals();
  const terrain = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  terrain.name = 'terrain';
  group.add(terrain);

  // --- ocean: turquoise shallows over the reef shelf, deep blue beyond ---
  const OSEG = 96;
  const oceanGeo = new THREE.PlaneGeometry(9000, 9000, OSEG, OSEG);
  oceanGeo.rotateX(-Math.PI / 2);
  const opos = oceanGeo.attributes.position;
  const ocol = new Float32Array(opos.count * 3);
  for (let i = 0; i < opos.count; i++) {
    const x = opos.getX(i), z = opos.getZ(i);
    const h = heightAt(x, z);
    const shallow = smoothstep(-14, -2, h);
    const r = lerp(0.04, 0.12, shallow);
    const g = lerp(0.30, 0.58, shallow);
    const b = lerp(0.48, 0.66, shallow);
    ocol[i * 3] = r; ocol[i * 3 + 1] = g; ocol[i * 3 + 2] = b;
  }
  oceanGeo.setAttribute('color', new THREE.BufferAttribute(ocol, 3));
  const ocean = new THREE.Mesh(
    oceanGeo,
    // The material colour multiplies the vertex colours: the sunlit
    // shallows are bright turquoise on their own, and full light on top
    // of that clips to white. 0.6 keeps the turquoise without the blow-out.
    new THREE.MeshPhongMaterial({ vertexColors: true, color: 0x999999, shininess: 160, specular: 0x445566 }),
  );
  ocean.position.y = 0.4;
  ocean.name = 'ocean';
  group.add(ocean);

  // --- sky dome: zenith blue fading to a pale horizon ----------------------
  const skyGeo = new THREE.SphereGeometry(6500, 24, 14);
  const spos = skyGeo.attributes.position;
  const scol = new Float32Array(spos.count * 3);
  for (let i = 0; i < spos.count; i++) {
    const t = clamp(spos.getY(i) / 6500, -0.1, 1);
    const top = [0.16, 0.42, 0.78], low = [0.82, 0.91, 0.97];
    const k = smoothstep(-0.05, 0.55, t);
    scol[i * 3] = lerp(low[0], top[0], k);
    scol[i * 3 + 1] = lerp(low[1], top[1], k);
    scol[i * 3 + 2] = lerp(low[2], top[2], k);
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(scol, 3));
  const sky = new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
  );
  sky.name = 'sky';
  group.add(sky);

  // --- sun disc ------------------------------------------------------------
  const sunCanvas = document.createElement('canvas');
  sunCanvas.width = sunCanvas.height = 128;
  const sctx = sunCanvas.getContext('2d');
  const grad = sctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,250,220,1)');
  grad.addColorStop(0.35, 'rgba(255,236,170,0.9)');
  grad.addColorStop(1, 'rgba(255,236,170,0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 128, 128);
  const sunTex = new THREE.CanvasTexture(sunCanvas);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({
    map: sunTex, transparent: true, fog: false, depthWrite: false,
  }));
  sun.position.set(2600, 2100, -4200);
  sun.scale.set(700, 700, 1);
  sun.name = 'sun';
  group.add(sun);

  // --- clouds ---------------------------------------------------------------
  const clouds = new THREE.Group();
  clouds.name = 'clouds';
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
  const puffGeo = new THREE.SphereGeometry(1, 10, 8);
  const cloudRand = makeValueNoise(seed + 41);
  const crand = (() => { let s = seed + 77; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  for (let c = 0; c < 18; c++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(crand() * 3);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(puffGeo, cloudMat);
      puff.position.set((crand() - 0.5) * 90, (crand() - 0.5) * 12, (crand() - 0.5) * 36);
      const sc = 16 + crand() * 26;
      puff.scale.set(sc, sc * 0.42, sc * 0.7);
      cloud.add(puff);
    }
    cloud.position.set(
      (crand() - 0.5) * 7600,
      300 + crand() * 170,
      (crand() - 0.5) * 7600,
    );
    cloud.userData.drift = 2 + crand() * 3;
    clouds.add(cloud);
  }
  group.add(clouds);

  // --- palm groves ----------------------------------------------------------
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 8, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const crownGeo = new THREE.ConeGeometry(3.6, 6.5, 7);
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });
  const crownMat2 = new THREE.MeshLambertMaterial({ color: 0x388e3c });
  const trees = new THREE.Group();
  trees.name = 'palms';
  const bushGeo = new THREE.SphereGeometry(1.6, 7, 5);
  const bushMat = new THREE.MeshLambertMaterial({ color: 0x2a6b2e });
  const bushes = new THREE.Group();
  bushes.name = 'bushes';
  let placed = 0, tries = 0;
  const trand = (() => { let s = seed + 101; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  while (placed < 230 && tries < 4000) {
    tries++;
    const x = (trand() - 0.5) * 3800;
    const z = (trand() - 0.5) * 3800;
    const h = heightAt(x, z);
    if (h < 6 || h > 120) continue;
    if (stripAt(x, z, 40)) continue;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 4;
    trunk.rotation.z = (trand() - 0.5) * 0.16;
    const crown = new THREE.Mesh(crownGeo, trand() > 0.5 ? crownMat : crownMat2);
    crown.position.y = 10.5;
    tree.add(trunk, crown);
    tree.position.set(x, h - 0.4, z);
    const sc = 0.8 + trand() * 0.7;
    tree.scale.set(sc, sc, sc);
    tree.rotation.y = trand() * Math.PI * 2;
    trees.add(tree);
    placed++;
    // A bush or two near every third palm, for ground texture.
    if (placed % 3 === 0) {
      const bush = new THREE.Mesh(bushGeo, bushMat);
      bush.position.set(x + 6 + trand() * 8, h + 0.6, z + 5 + trand() * 8);
      const bs = 0.8 + trand() * 1.4;
      bush.scale.set(bs, bs * 0.7, bs);
      bushes.add(bush);
    }
  }
  group.add(trees, bushes);

  // --- airstrips, buildings, windsock ---------------------------------------
  const windsocks = [];
  for (const [id, s] of Object.entries(CONFIG.strips)) {
    const stripGroup = new THREE.Group();
    stripGroup.name = 'strip-' + id;
    const a = (s.heading - 90) * (Math.PI / 180);
    stripGroup.position.set(s.x, s.padHeight + 0.25, s.z);
    stripGroup.rotation.y = -a;

    const asphalt = new THREE.Mesh(
      new THREE.PlaneGeometry(s.length, s.width),
      new THREE.MeshLambertMaterial({ color: 0x2f3337 }),
    );
    asphalt.rotation.x = -Math.PI / 2;
    stripGroup.add(asphalt);

    // Centreline dashes and threshold bars.
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f5f0 });
    for (let d = -s.length / 2 + 30; d < s.length / 2 - 20; d += 42) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(16, 1.6), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(d, 0.06, 0);
      stripGroup.add(dash);
    }
    for (const end of [-1, 1]) {
      for (let b = -2; b <= 2; b++) {
        const bar = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.2), dashMat);
        bar.rotation.x = -Math.PI / 2;
        bar.position.set(end * (s.length / 2 - 14), 0.06, b * 5.4);
        stripGroup.add(bar);
      }
    }
    // Runway number painted at each end.
    for (const end of [-1, 1]) {
      const num = end < 0 ? '09' : '27';
      const c = document.createElement('canvas');
      c.width = 128; c.height = 128;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f5f5f0';
      ctx.font = 'bold 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(num, 64, 68);
      const tex = new THREE.CanvasTexture(c);
      const decal = new THREE.Mesh(
        new THREE.PlaneGeometry(17, 17),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
      );
      decal.rotation.x = -Math.PI / 2;
      decal.rotation.z = end < 0 ? 0 : Math.PI;
      decal.position.set(end * (s.length / 2 - 46), 0.07, 0);
      stripGroup.add(decal);
    }
    // Edge lights: warm dots along both edges.
    const lightGeo = new THREE.SphereGeometry(0.9, 6, 5);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffc861 });
    for (let d = -s.length / 2 + 10; d <= s.length / 2 - 10; d += 40) {
      for (const side of [-1, 1]) {
        const lamp = new THREE.Mesh(lightGeo, lightMat);
        lamp.position.set(d, 0.8, side * (s.width / 2 + 2));
        stripGroup.add(lamp);
      }
    }
    group.add(stripGroup);

    // Windsock beside the strip.
    const sock = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.3, 9, 6),
      new THREE.MeshLambertMaterial({ color: 0xdddddd }),
    );
    pole.position.y = 4.5;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.5, 5.5, 8, 1, true),
      new THREE.MeshLambertMaterial({ color: 0xff6d00, side: THREE.DoubleSide }),
    );
    cone.rotation.z = Math.PI / 2;
    cone.position.set(2.8, 8.6, 0);
    sock.add(pole, cone);
    const sa = (s.heading - 90) * (Math.PI / 180);
    sock.position.set(
      s.x - Math.sin(sa) * (s.width / 2 + 26),
      s.padHeight,
      s.z + Math.cos(sa) * (s.width / 2 + 26),
    );
    sock.userData.cone = cone;
    group.add(sock);
    windsocks.push(sock);
  }

  // Hangar, tower and cottages beside Coral Field.
  const buildings = new THREE.Group();
  buildings.name = 'buildings';
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xe8e0cc });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xc75b39 });
  const hangar = new THREE.Group();
  const hBase = new THREE.Mesh(new THREE.BoxGeometry(34, 12, 24), wallMat);
  hBase.position.y = 6;
  const hRoof = new THREE.Mesh(
    new THREE.CylinderGeometry(12, 12, 34, 12, 1, false, 0, Math.PI),
    roofMat,
  );
  hRoof.rotation.z = Math.PI / 2;
  hRoof.rotation.y = Math.PI / 2;
  hRoof.position.y = 12;
  const hDoor = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 9),
    new THREE.MeshLambertMaterial({ color: 0x3a4a5a }),
  );
  hDoor.position.set(0, 4.6, 12.1);
  hangar.add(hBase, hRoof, hDoor);
  hangar.position.set(-40, CONFIG.strips.main.padHeight, -150);
  hangar.rotation.y = Math.PI / 2;
  buildings.add(hangar);

  const tower = new THREE.Group();
  const tShaft = new THREE.Mesh(
    new THREE.CylinderGeometry(3, 4.2, 26, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8d2c0 }),
  );
  tShaft.position.y = 13;
  const tCab = new THREE.Mesh(
    new THREE.CylinderGeometry(5.4, 4.6, 5, 8),
    new THREE.MeshLambertMaterial({ color: 0x2b4a63 }),
  );
  tCab.position.y = 28;
  const tRoof = new THREE.Mesh(
    new THREE.ConeGeometry(6, 3, 8),
    roofMat,
  );
  tRoof.position.y = 32;
  tower.add(tShaft, tCab, tRoof);
  tower.position.set(60, CONFIG.strips.main.padHeight, -150);
  buildings.add(tower);

  const cottageRand = (() => { let s = seed + 313; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  for (let i = 0; i < 4; i++) {
    const cot = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 8), wallMat);
    body.position.y = 3;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(7.5, 4, 4), roofMat);
    roof.position.y = 8;
    roof.rotation.y = Math.PI / 4;
    cot.add(body, roof);
    cot.position.set(
      120 + i * 26 + cottageRand() * 8,
      CONFIG.strips.main.padHeight,
      -165 + cottageRand() * 20,
    );
    buildings.add(cot);
  }
  group.add(buildings);

  return { group, heightAt, clouds, windsocks };
}
