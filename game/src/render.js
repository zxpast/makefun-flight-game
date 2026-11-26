// Rendering: the three.js scene, the chase and cockpit cameras, and the
// mission rings. The camera never fights the pilot — the chase camera
// trails smoothly behind the plane, the cockpit camera sits where the
// pilot's head is, and both look where the plane is going.

import { CONFIG } from './config.js';
import { buildWorld } from './terrain.js';
import { buildAircraft, updateAircraft } from './aircraft.js';
import { lerp, DEG } from './random.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xc4d8e8, 700, 4200);

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.5, 12000);
    this.camera.position.set(0, 60, -60);

    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x5a7a4a, 0.72);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d0, 1.5);
    sun.position.set(1800, 2200, -1400);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x9fc4e8, 0.35);
    fill.position.set(-1500, 900, 1600);
    this.scene.add(fill);

    this.world = buildWorld(CONFIG.worldSeed);
    this.scene.add(this.world.group);
    this.aircraft = buildAircraft();
    this.scene.add(this.aircraft.group);

    this.ringMeshes = [];
    this.ringGroup = new THREE.Group();
    this.ringGroup.name = 'rings';
    this.scene.add(this.ringGroup);

    this.cameraMode = 'chase';
    this.chasePos = new THREE.Vector3(0, 60, -80);
    this.time = 0;
    this.onResize();
  }

  onResize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Rings are rebuilt whenever the mission (re)loads.
  setRings(rings) {    this.ringGroup.clear();
    this.ringMeshes = [];
    const geo = new THREE.TorusGeometry(14, 1.15, 12, 42);
    for (const ring of rings) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffa726, transparent: true, opacity: 0.95,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(ring.x, ring.y, ring.z);
      mesh.rotation.y = Math.PI / 2;
      mesh.userData.ring = ring;
      // A light column so the next ring is visible from far away.
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6, 1.6, 160, 8, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0xffc861, transparent: true, opacity: 0.16,
          side: THREE.DoubleSide, depthWrite: false,
        }),
      );
      beam.position.set(ring.x, ring.y + 70, ring.z);
      beam.userData.beam = true;
      this.ringGroup.add(mesh, beam);
      this.ringMeshes.push({ mesh, beam, ring });
    }
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
  }

  // Put the chase camera exactly where it belongs, with no swoop: used
  // for screenshots and whenever a mission (re)starts mid-flight.
  snapCamera(state) {
    const h = state.heading * DEG;
    const fwd = { x: Math.sin(h), z: -Math.cos(h) };
    this.chasePos.set(
      state.x - fwd.x * CONFIG.chaseDistance,
      state.y + CONFIG.chaseHeight,
      state.z - fwd.z * CONFIG.chaseDistance,
    );
  }

  // Title screen: a slow orbit around the parked plane on Coral Field.
  updateTitle(state, dt) {
    this.time += dt;
    updateAircraft(this.aircraft, state, this.time);
    const a = this.time * 0.07;
    const cx = -200, cy = 14, cz = -40;
    this.camera.position.set(cx + Math.sin(a) * 44, cy + 13 + Math.sin(this.time * 0.3) * 2, cz + Math.cos(a) * 44);
    this.camera.lookAt(cx, cy + 1, cz);
    for (const cloud of this.world.clouds.children) {
      cloud.position.x += cloud.userData.drift * dt;
      if (cloud.position.x > 4000) cloud.position.x = -4000;
    }
  }

  update(state, mission, dt) {
    this.time += dt;
    updateAircraft(this.aircraft, state, this.time);

    // Rings: the next one pulses amber, passed ones turn green and dim.
    for (const { mesh, beam, ring } of this.ringMeshes) {
      const isNext = mission.rings[mission.ringIndex] === ring;
      const passed = ring.passed;
      mesh.material.color.setHex(passed ? 0x2aff5e : isNext ? 0xffa726 : 0xfff3d6);
      mesh.material.opacity = passed ? 0.45 : isNext ? 0.95 : 0.7;
      const pulse = isNext ? 1 + Math.sin(this.time * 4) * 0.05 : 1;
      mesh.scale.set(pulse, pulse, pulse);
      beam.visible = isNext;
      beam.material.opacity = 0.12 + Math.sin(this.time * 3) * 0.05;
    }

    // Clouds drift slowly eastward and wrap around the world.
    for (const cloud of this.world.clouds.children) {
      cloud.position.x += cloud.userData.drift * dt;
      if (cloud.position.x > 4000) cloud.position.x = -4000;
    }
    // Windsock cones point downwind (the wind blows from the west).
    for (const sock of this.world.windsocks) {
      sock.userData.cone.rotation.z = Math.PI / 2 + Math.sin(this.time * 0.8) * 0.08;
      sock.rotation.y = -Math.PI / 2 + Math.sin(this.time * 0.5) * 0.05;
    }

    // --- camera ------------------------------------------------------------
    const h = state.heading * DEG;
    const fwd = { x: Math.sin(h), z: -Math.cos(h) };
    if (this.cameraMode === 'cockpit') {
      const off = CONFIG.cockpitOffset;
      this.camera.position.set(
        state.x + fwd.x * off.forward,
        state.y + off.up,
        state.z + fwd.z * off.forward,
      );
      this.camera.lookAt(
        state.x + fwd.x * 60,
        state.y + Math.sin(state.pitch * DEG) * 60,
        state.z + fwd.z * 60,
      );
      // Roll with the plane, gently: rotateZ spins the camera around its
      // own view axis. (Setting rotation.z after lookAt corrupts the
      // orientation — the euler lookAt leaves behind is not a level one.)
      this.camera.rotateZ(-state.bank * DEG * 0.55);
    } else {
      const want = new THREE.Vector3(
        state.x - fwd.x * CONFIG.chaseDistance,
        state.y + CONFIG.chaseHeight,
        state.z - fwd.z * CONFIG.chaseDistance,
      );
      const k = 1 - Math.exp(-CONFIG.chaseSmooth * dt);
      this.chasePos.lerp(want, k);
      // Keep the camera above the terrain it flies over.
      const ground = this.world.heightAt(this.chasePos.x, this.chasePos.z);
      if (this.chasePos.y < ground + 3) this.chasePos.y = ground + 3;
      this.camera.position.copy(this.chasePos);
      this.camera.lookAt(
        state.x + fwd.x * 22,
        state.y + 1.5 + Math.sin(state.pitch * DEG) * 22,
        state.z + fwd.z * 22,
      );
      this.camera.rotateZ(-state.bank * DEG * 0.22);
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
