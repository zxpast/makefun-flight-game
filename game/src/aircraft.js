// The aircraft: a high-wing bush plane called the "Coral Courier", built
// from primitives so it reads as constructed, not drawn — a tapered
// fuselage, a glass cabin, strut-braced wings, a spinning propeller,
// landing gear that retracts, and navigation lights that blink. The model
// faces -Z; the renderer yaws it by -heading so heading 0 is north.

import { DEG } from './random.js';

function canvasLabel(text, fg, bg) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = fg;
  ctx.font = 'bold 40px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

export function buildAircraft() {
  const group = new THREE.Group();
  group.name = 'aircraft';
  group.rotation.order = 'YXZ';

  const white = new THREE.MeshLambertMaterial({ color: 0xf2ede2 });
  const orange = new THREE.MeshLambertMaterial({ color: 0xe86a1f });
  const dark = new THREE.MeshLambertMaterial({ color: 0x22303c });
  const glass = new THREE.MeshPhongMaterial({ color: 0x9fd4e8, shininess: 120, specular: 0xffffff });
  const metal = new THREE.MeshLambertMaterial({ color: 0x8a8f96 });

  // Fuselage: a tapered tube, nose cone, and a tail cone.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.62, 6.4, 12), white);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.set(0, 0, 0.4);
  group.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.02, 1.5, 12), orange);
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, 0, -3.55);
  group.add(nose);
  const tailCone = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.8, 10), white);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.set(0, 0.15, 4.4);
  group.add(tailCone);

  // Belly stripe and tail band in the livery orange.
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(1.07, 0.68, 3.4, 12, 1, true), orange);
  stripe.rotation.x = Math.PI / 2;
  stripe.position.set(0, -0.28, 1.2);
  group.add(stripe);
  const tailBand = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.66, 0.7, 12, 1, true), orange);
  tailBand.rotation.x = Math.PI / 2;
  tailBand.position.set(0, 0.12, 3.9);
  group.add(tailBand);

  // Cabin with glass windows and a roof.
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.15, 2.2), white);
  cabin.position.set(0, 0.85, -0.7);
  group.add(cabin);
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.85, 0.12), glass);
  windshield.position.set(0, 0.95, -1.82);
  windshield.rotation.x = -0.28;
  group.add(windshield);
  for (const side of [-1, 1]) {
    const window = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 1.5), glass);
    window.position.set(side * 0.97, 0.95, -0.7);
    group.add(window);
  }

  // Main wing (high, strut-braced) and tailplane.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.26, 1.9), white);
  wing.position.set(0, 1.55, -0.6);
  group.add(wing);
  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 1.9), orange);
  wingTipL.position.set(-5.5, 1.55, -0.6);
  const wingTipR = wingTipL.clone();
  wingTipR.position.x = 5.5;
  group.add(wingTipL, wingTipR);
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 6), metal);
    strut.position.set(side * 1.9, 0.55, -0.6);
    strut.rotation.z = side * 0.62;
    group.add(strut);
  }
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 1.1), white);
  tailplane.position.set(0, 0.35, 4.6);
  group.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.0, 1.5), orange);
  fin.position.set(0, 1.15, 4.7);
  fin.rotation.x = 0.25;
  group.add(fin);

  // Registration decals on both fuselage sides.
  const regTex = canvasLabel('SKY-01', '#1c2b38', '#f2ede2');
  for (const side of [-1, 1]) {
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 0.65),
      new THREE.MeshBasicMaterial({ map: regTex, transparent: true }),
    );
    decal.position.set(side * 1.02, 0.1, 2.2);
    decal.rotation.y = side * Math.PI / 2;
    group.add(decal);
  }
  const nameTex = canvasLabel('CORAL AIR', '#ffffff', '#e86a1f');
  const nameDecal = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 0.85),
    new THREE.MeshBasicMaterial({ map: nameTex, transparent: true }),
  );
  nameDecal.rotation.x = -Math.PI / 2;
  nameDecal.rotation.z = Math.PI / 2;
  nameDecal.position.set(0, 1.7, -0.6);
  group.add(nameDecal);

  // Propeller: hub plus two blades, spinning around the nose axis.
  const propeller = new THREE.Group();
  propeller.position.set(0, 0, -4.35);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 8), dark);
  hub.rotation.x = Math.PI / 2;
  propeller.add(hub);
  const bladeGeo = new THREE.BoxGeometry(0.34, 2.6, 0.12);
  // Slightly see-through, like a spinning blur rather than two solid bars.
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x2b2b2b, transparent: true, opacity: 0.45 });
  const bladeA = new THREE.Mesh(bladeGeo, bladeMat);
  const bladeB = new THREE.Mesh(bladeGeo, bladeMat);
  bladeB.rotation.z = Math.PI / 2;
  propeller.add(bladeA, bladeB);
  group.add(propeller);

  // Landing gear: two mains and a tail wheel, on one group that swings
  // back when the gear retracts.
  const gear = new THREE.Group();
  gear.name = 'gear';
  const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.5, 6), metal);
    leg.position.set(side * 1.05, -1.15, -0.9);
    leg.rotation.z = side * 0.35;
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(side * 1.35, -1.85, -0.9);
    gear.add(leg, wheel);
  }
  const tailWheel = new THREE.Mesh(wheelGeo, dark);
  tailWheel.scale.set(0.6, 0.6, 0.6);
  tailWheel.position.set(0, -1.15, 4.4);
  gear.add(tailWheel);
  group.add(gear);

  // Navigation lights: red left, green right, white tail.
  const navLights = {};
  const lightGeo = new THREE.SphereGeometry(0.22, 8, 6);
  navLights.left = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
  navLights.left.position.set(-5.75, 1.55, -0.6);
  navLights.right = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0x2aff5e }));
  navLights.right.position.set(5.75, 1.55, -0.6);
  navLights.tail = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  navLights.tail.position.set(0, 0.4, 5.35);
  group.add(navLights.left, navLights.right, navLights.tail);

  // A small beacon light on the belly that strobes.
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff3020 }),
  );
  beacon.position.set(0, -1.05, 0.6);
  group.add(beacon);

  return { group, propeller, gear, navLights, beacon };
}

// Per-frame aircraft animation: propeller speed follows throttle, the gear
// swings away when retracted, the beacon strobes once a second.
export function updateAircraft(aircraft, state, time) {
  const spin = 4 + state.throttle * 42 + state.speed * 0.35;
  aircraft.propeller.rotation.z += spin * 0.016;
  const gearTarget = state.gearDown ? 0 : -1.35;
  aircraft.gear.rotation.x += (gearTarget - aircraft.gear.rotation.x) * 0.12;
  const strobe = (time % 1.0) < 0.12;
  aircraft.beacon.visible = strobe;
  aircraft.navLights.tail.visible = (time % 2.0) < 1.7;
  aircraft.group.rotation.set(
    state.pitch * DEG,
    -state.heading * DEG,
    -state.bank * DEG,
  );
  aircraft.group.position.set(state.x, state.y, state.z);
}
