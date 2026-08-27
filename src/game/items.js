import * as THREE from 'three';
import { ITEMS } from '../config.js';
import { rbox } from '../art/build.js';
import { makeToon, makeGlow } from '../art/materials.js';

// ---------------------------------------------------------------------------
// Family power-ups.
//
// Boxes sit in lanes along the road. One slot, fire with E. Everything a
// power-up does is expressed through the same three levers the vehicle already
// has (a speed multiplier, an impulse, an invulnerability timer), so nothing
// here needs to know how driving works.
// ---------------------------------------------------------------------------

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _m = new THREE.Matrix4();

const WEIGHT_TOTAL = ITEMS.reduce((a, i) => a + i.weight, 0);
export function rollItem() {
  let r = Math.random() * WEIGHT_TOTAL;
  for (const i of ITEMS) { r -= i.weight; if (r <= 0) return i; }
  return ITEMS[0];
}

export class ItemField {
  constructor(scene, track, vfx, audio) {
    this.track = track;
    this.scene = scene;
    this.vfx = vfx;
    this.audio = audio;
    this.boxes = [];
    this.projectiles = [];

    // one instanced mesh for every box on the track
    const geo = rbox(3.4, 3.4, 3.4, 1.1);
    const mat = makeToon({
      color: 0xffffff, rim: 0xffe08a, rimStrength: 1.6, rimPower: 1.5,
      emissive: 0x332200, bounceStrength: 0.5
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, 700);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(700 * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    // the glowing core inside each box
    this.core = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(1.15, 0),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }),
      700
    );
    this.core.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(700 * 3), 3);
    this.core.frustumCulled = false;
    scene.add(this.core);

    this.projMat = makeToon({ color: 0xff7a1f, rim: 0xffe0a0, rimStrength: 1.4 });
    this.bonkMat = makeToon({ color: 0x2be0c0, rim: 0xffffff, rimStrength: 1.2 });
    this.tether = null;
  }

  // Lay the boxes out. Rows of three or five, spaced so she meets a set every
  // fifteen seconds or so, and never during a cinematic.
  layout(ranges) {
    this.boxes.length = 0;
    for (const [from, to, every] of ranges) {
      for (let t = from; t < to; t += every) {
        const n = Math.random() > 0.55 ? 5 : 3;
        for (let i = 0; i < n; i++) {
          this.boxes.push({
            t, lat: (i - (n - 1) / 2) * 5.4, taken: 0, spin: Math.random() * 6
          });
        }
      }
    }
    this.mesh.count = Math.min(700, this.boxes.length);
    this.core.count = this.mesh.count;
  }

  update(dt, player, hud, hooks = {}) {
    const tr = this.track;
    const c = new THREE.Color();
    let n = 0;
    for (const b of this.boxes) {
      if (n >= 700) break;
      if (b.taken > 0) {
        b.taken -= dt;
        if (b.taken <= 0) b.taken = 0;
      }
      // only bother with the ones near her
      const gap = (b.t - player.t) * tr.length;
      if (gap < -60 || gap > 900) { continue; }

      b.spin += dt * 1.9;
      const alive = b.taken <= 0;
      tr.posAt(b.t, b.lat, alive ? 3.0 + Math.sin(b.spin * 1.4) * 0.5 : -20, _v);
      tr.tanAt(b.t, _v2); tr.upAt(b.t, _v3);
      const right = new THREE.Vector3().crossVectors(_v3, _v2).normalize();
      _m.makeBasis(right, _v3, _v2);
      _m.setPosition(_v);
      const rot = new THREE.Matrix4().makeRotationY(b.spin);
      _m.multiply(rot);
      this.mesh.setMatrixAt(n, _m);
      const s = new THREE.Matrix4().copy(_m).scale(new THREE.Vector3(0.6, 0.6, 0.6));
      this.core.setMatrixAt(n, s);
      c.setHSL((b.spin * 0.06) % 1, 0.85, 0.62);
      this.core.setColorAt(n, c);
      this.mesh.setColorAt(n, c.setHSL((b.spin * 0.06) % 1, 0.4, 0.92));
      n++;

      // pickup
      if (alive && Math.abs(gap) < 4 && Math.abs(b.lat - player.lat) < 4.2 && !player.item) {
        b.taken = 7;
        player.item = rollItem();
        hud.setItem(player.item);
        this.audio && this.audio.pickup();
        this.vfx.sparks(_v, 16, player.item.color, 8, 8);
        if (hooks.onPickup) hooks.onPickup(player.item);
      }
    }
    this.mesh.count = n;
    this.core.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.core.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    if (this.core.instanceColor) this.core.instanceColor.needsUpdate = true;

    this.updateProjectiles(dt, player, hooks);
  }

  // ---- using an item ----------------------------------------------------
  use(player, pack, hud, hooks = {}) {
    const it = player.item;
    if (!it) return false;
    player.item = null;
    hud.setItem(null);
    this.audio && this.audio.itemUse();
    const tr = this.track;

    switch (it.id) {
      case 'sugar':
        player.speedMul = 1.42;
        player.sugarTime = 3.4;
        player.boost = 100;
        break;

      case 'blessing':
        player.invuln = 6.0;
        player.blessed = 6.0;
        break;

      case 'cracker': {
        const m = new THREE.Mesh(rbox(2.4, 2.4, 2.4, 0.9), this.projMat);
        this.scene.add(m);
        this.projectiles.push({
          kind: 'cracker', t: player.t - 0.0006, lat: player.lat, mesh: m,
          vel: -26, lat_v: (Math.random() * 2 - 1) * 8, life: 9, age: 0, bounce: 0
        });
        break;
      }

      case 'bonk': {
        const m = new THREE.Group();
        const fist = new THREE.Mesh(rbox(4.6, 4.0, 3.4, 1.5), this.bonkMat);
        m.add(fist);
        for (let i = 0; i < 4; i++) {
          const f = new THREE.Mesh(rbox(1.0, 1.0, 2.2, 0.45), this.bonkMat);
          f.position.set(-1.6 + i * 1.05, 0.8, 2.4);
          m.add(f);
        }
        // the spring behind it, because it has to be a spring
        for (let i = 0; i < 7; i++) {
          const r = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.16, 6, 12), this.bonkMat);
          r.rotation.x = Math.PI / 2;
          r.position.z = -1.8 - i * 0.7;
          m.add(r);
        }
        this.scene.add(m);
        this.projectiles.push({
          kind: 'bonk', t: player.t + 0.0004, lat: player.lat, mesh: m,
          vel: 78, lat_v: 0, life: 4.5, age: 0, homing: true
        });
        break;
      }

      case 'magnet':
        this.magnet = { t: 2.6, from: player };
        break;

      case 'thread': {
        // find the nearest relative ahead and reel her in
        let best = null, bestGap = 1e9;
        for (const r of pack.racers) {
          if (!r.alive) continue;
          const gap = (r.t - player.t) * tr.length;
          if (gap > 6 && gap < 260 && gap < bestGap) { best = r; bestGap = gap; }
        }
        if (best) {
          this.tether = { target: best, time: 2.6, player };
          player.speedMul = 1.5;
          player.sugarTime = 2.6;
        } else {
          player.speedMul = 1.3;
          player.sugarTime = 2.0;
        }
        break;
      }
    }
    if (hooks.onUse) hooks.onUse(it);
    return true;
  }

  updateProjectiles(dt, player, hooks) {
    const tr = this.track;

    if (player.sugarTime > 0) {
      player.sugarTime -= dt;
      if (player.sugarTime <= 0) player.speedMul = 1;
    }
    if (player.blessed > 0) player.blessed -= dt;

    if (this.magnet) {
      this.magnet.t -= dt;
      if (this.magnet.t <= 0) this.magnet = null;
    }
    if (this.tether) {
      this.tether.time -= dt;
      if (this.tether.time <= 0) this.tether = null;
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age += dt;
      if (p.age > p.life) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }
      p.t += (p.vel * dt) / tr.length;
      p.lat += p.lat_v * dt;
      const half = tr.halfAt(p.t);
      if (Math.abs(p.lat) > half) { p.lat = Math.sign(p.lat) * half; p.lat_v *= -1; }

      const bounceY = p.kind === 'cracker' ? Math.abs(Math.sin(p.age * 5.5)) * 4.2 : 2.6;
      tr.posAt(p.t, p.lat, 1.8 + bounceY, p.mesh.position);
      tr.tanAt(p.t, _v); tr.upAt(p.t, _v2);
      _v3.crossVectors(_v2, _v).normalize();
      _m.makeBasis(_v3, _v2, _v);
      p.mesh.quaternion.setFromRotationMatrix(_m);
      if (p.kind === 'cracker') p.mesh.rotateX(p.age * 6);

      if (p.kind === 'bonk' && p.target) {
        p.lat += (p.target.lat - p.lat) * Math.min(1, 3 * dt);
      }
      if (hooks.checkHit) hooks.checkHit(p, i);
    }
  }

  // called by the race so projectiles can knock relatives about
  resolve(pack, player, vfx, hooks = {}) {
    const tr = this.track;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      for (const r of pack.racers) {
        if (!r.alive) continue;
        const gap = Math.abs((r.t - p.t) * tr.length);
        if (gap > 5 || Math.abs(r.lat - p.lat) > 4.5) continue;
        r.stun = 1.2;
        r.speed *= 0.45;
        r.latVel += (Math.random() * 2 - 1) * 30;
        if (p.kind === 'bonk') { r.airVY = 20; r.airY = 0.1; }
        vfx.burst(p.mesh.position, 26, p.kind === 'bonk' ? 0x2be0c0 : 0xff9a2b);
        this.audio && this.audio.impact(1.1);
        player.punts++;
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        if (hooks.onHit) hooks.onHit(r, p);
        break;
      }
    }

    // the magnet drags everyone nearby into her lane, which on The Beast is
    // less a power-up and more a war crime
    if (this.magnet) {
      for (const r of pack.racers) {
        if (!r.alive) continue;
        const gap = (r.t - player.t) * tr.length;
        if (Math.abs(gap) > 70) continue;
        r.lat += (player.lat - r.lat) * Math.min(1, 1.6 * 0.016);
        r.t += ((player.t - r.t) * 0.4) * 0.016;
      }
    }
  }
}
