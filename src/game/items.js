import * as THREE from 'three';
import { ITEMS } from '../config.js';
import { rbox } from '../art/build.js';
import { makeToon, makeGlow } from '../art/materials.js';

// ---------------------------------------------------------------------------
// Family power-ups.
//
// Three kinds of thing live in here:
//
//   boxes        the pickups sitting in the road, one instanced mesh
//   hazards      things left ON the road that stay there: banana peels, ghee
//                slicks. These hit relatives as well as the player, which is
//                what makes dropping one behind you actually satisfying.
//   projectiles  things that travel: the bazooka, the bonk glove
//
// Every effect is expressed through levers the vehicle already has (a speed
// multiplier, a slip timer, an impulse, invulnerability), so nothing in here
// needs to know how driving works.
// ---------------------------------------------------------------------------

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _m = new THREE.Matrix4();

const WEIGHT_TOTAL = ITEMS.reduce((a, i) => a + i.weight, 0);

// Weighted roll, biased by position: at the back she gets the aggressive stuff,
// at the front she gets defence. Standard kart rubber banding, and it is what
// keeps a race close without the AI having to cheat.
export function rollItem(position = 6, total = 13) {
  const back = THREE.MathUtils.clamp((position - 1) / Math.max(1, total - 1), 0, 1);
  let best = null, bestScore = -1;
  for (const it of ITEMS) {
    let w = it.weight;
    if (it.id === 'thunder' || it.id === 'bazooka' || it.id === 'thread') w *= 0.35 + back * 2.2;
    if (it.id === 'banana' || it.id === 'slick') w *= 1.6 - back * 0.7;
    if (it.id === 'blessing') w *= 0.4 + back * 1.6;
    const score = Math.random() * w;
    if (score > bestScore) { bestScore = score; best = it; }
  }
  return best || ITEMS[0];
}

export class ItemField {
  constructor(scene, track, vfx, audio) {
    this.track = track;
    this.scene = scene;
    this.vfx = vfx;
    this.audio = audio;
    this.boxes = [];
    this.projectiles = [];
    this.hazards = [];

    const geo = rbox(3.0, 3.0, 3.0, 0.5);
    const mat = makeToon({
      color: 0xfff6e2, rim: 0xffe08a, rimStrength: 0.5, rimPower: 3.0,
      emissive: 0x1a1000, bounceStrength: 0.4
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, 700);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(700 * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    this.core = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.95, 0),
      new THREE.MeshBasicMaterial({
        transparent: true, opacity: 0.62, toneMapped: false,
        blending: THREE.AdditiveBlending, depthWrite: false
      }), 700);
    this.core.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(700 * 3), 3);
    this.core.frustumCulled = false;
    scene.add(this.core);

    // shared materials for the things she throws and drops
    this.matBanana = makeToon({ color: 0xffd23d, rim: 0xfff4c0, rimStrength: 1.2, noise: 0.05 });
    this.matChappal = makeToon({ color: 0x9a4a2a, rim: 0xffc9a0, rimStrength: 1.1 });
    this.matBonk = makeToon({ color: 0x2be0c0, rim: 0xffffff, rimStrength: 1.2 });
    this.matSlick = new THREE.MeshBasicMaterial({
      color: 0xffe08a, transparent: true, opacity: 0.55, depthWrite: false,
      toneMapped: false, blending: THREE.AdditiveBlending
    });
    this.tether = null;
  }

  layout(ranges) {
    this.boxes.length = 0;
    for (const [from, to, every] of ranges) {
      for (let t = from; t < to; t += every) {
        const n = Math.random() > 0.55 ? 5 : 3;
        for (let i = 0; i < n; i++) {
          this.boxes.push({ t, lat: (i - (n - 1) / 2) * 5.4, taken: 0, spin: Math.random() * 6 });
        }
      }
    }
    this.mesh.count = Math.min(700, this.boxes.length);
    this.core.count = this.mesh.count;
  }

  reset() {
    for (const h of this.hazards) this.scene.remove(h.mesh);
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.hazards.length = 0;
    this.projectiles.length = 0;
    this.tether = null;
  }

  // ---- the boxes --------------------------------------------------------
  update(dt, player, hud, hooks = {}) {
    const tr = this.track;
    const c = new THREE.Color();
    let n = 0;
    for (const b of this.boxes) {
      if (n >= 700) break;
      if (b.taken > 0) { b.taken -= dt; if (b.taken <= 0) b.taken = 0; }
      const gap = (b.t - player.t) * tr.length;
      if (gap < -60 || gap > 900) continue;

      b.spin += dt * 1.9;
      const alive = b.taken <= 0;
      tr.posAt(b.t, b.lat, alive ? 3.0 + Math.sin(b.spin * 1.4) * 0.5 : -20, _v);
      tr.tanAt(b.t, _v2); tr.upAt(b.t, _v3);
      const right = new THREE.Vector3().crossVectors(_v3, _v2).normalize();
      _m.makeBasis(right, _v3, _v2);
      _m.setPosition(_v);
      _m.multiply(new THREE.Matrix4().makeRotationY(b.spin));
      this.mesh.setMatrixAt(n, _m);
      this.core.setMatrixAt(n, new THREE.Matrix4().copy(_m).scale(new THREE.Vector3(0.6, 0.6, 0.6)));
      c.setHSL((b.spin * 0.06) % 1, 0.85, 0.60);
      this.core.setColorAt(n, c);
      this.mesh.setColorAt(n, c.setHSL((b.spin * 0.06) % 1, 0.62, 0.70));
      n++;

      if (alive && Math.abs(gap) < 4.5 && Math.abs(b.lat - player.lat) < 4.4 && !player.item) {
        b.taken = 7;
        player.item = rollItem(hooks.position || 6, hooks.total || 13);
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
  }

  // ---- using one -------------------------------------------------------
  use(player, pack, hud, hooks = {}) {
    const it = player.item;
    if (!it) return false;
    player.item = null;
    hud.setItem(null);
    const tr = this.track;
    const A = this.audio;

    switch (it.id) {
      case 'sugar':
        player.speedMul = 1.46;
        player.sugarTime = 4.0;
        player.boost = 100;
        A && A.itemBoost();
        break;

      case 'blessing':
        player.invuln = 6.0;
        player.blessed = 6.0;
        A && A.itemBless();
        break;

      case 'banana': {
        const m = new THREE.Group();
        // a peel, not a banana: three splayed strips
        for (let i = 0; i < 3; i++) {
          const s = new THREE.Mesh(rbox(0.5, 0.16, 2.2, 0.08), this.matBanana);
          s.rotation.y = (i - 1) * 0.5;
          s.position.z = 0.4;
          s.rotation.x = -0.25;
          m.add(s);
        }
        m.add(new THREE.Mesh(rbox(0.7, 0.3, 0.7, 0.14), this.matBanana));
        this.scene.add(m);
        this.dropHazard('banana', player.t - 0.0009, player.lat, m, 3.4, 26);
        A && A.itemDrop();
        break;
      }

      case 'slick': {
        const m = new THREE.Mesh(new THREE.CircleGeometry(1, 20), this.matSlick);
        m.rotation.x = -Math.PI / 2;
        this.scene.add(m);
        this.dropHazard('slick', player.t - 0.0010, player.lat, m, 11, 22);
        A && A.itemSplat();
        break;
      }

      case 'bazooka': {
        const m = new THREE.Group();
        const sole = new THREE.Mesh(rbox(1.5, 0.35, 3.0, 0.16), this.matChappal);
        m.add(sole);
        const strap = new THREE.Mesh(rbox(1.2, 0.5, 0.35, 0.14), this.matChappal);
        strap.position.set(0, 0.35, 0.5);
        m.add(strap);
        const flame = new THREE.Mesh(rbox(0.7, 0.7, 1.2, 0.3), makeGlow(0xff8a2b, 0.9));
        flame.position.z = -1.9;
        m.add(flame);
        this.scene.add(m);
        this.projectiles.push({
          kind: 'bazooka', t: player.t + 0.0004, lat: player.lat, mesh: m,
          vel: 96, latVel: 0, life: 6, age: 0, target: this.nearestAhead(player, pack, 700)
        });
        A && A.itemLaunch();
        break;
      }

      case 'bonk': {
        const m = new THREE.Group();
        m.add(new THREE.Mesh(rbox(4.4, 3.8, 3.2, 1.4), this.matBonk));
        for (let i = 0; i < 4; i++) {
          const f = new THREE.Mesh(rbox(1.0, 1.0, 2.2, 0.45), this.matBonk);
          f.position.set(-1.5 + i * 1.0, 0.8, 2.3);
          m.add(f);
        }
        for (let i = 0; i < 7; i++) {
          const r = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.16, 6, 12), this.matBonk);
          r.rotation.x = Math.PI / 2;
          r.position.z = -1.8 - i * 0.7;
          m.add(r);
        }
        this.scene.add(m);
        this.projectiles.push({
          kind: 'bonk', t: player.t + 0.0004, lat: player.lat, mesh: m,
          vel: 74, latVel: 0, life: 4.5, age: 0, target: this.nearestAhead(player, pack, 400)
        });
        A && A.itemLaunch();
        break;
      }

      case 'thread': {
        const best = this.nearestAhead(player, pack, 320);
        if (best) {
          this.tether = { target: best, time: 3.0 };
          player.speedMul = 1.5;
          player.sugarTime = 3.0;
        } else {
          player.speedMul = 1.3;
          player.sugarTime = 2.2;
        }
        A && A.itemThread();
        break;
      }

      case 'thunder': {
        let hit = 0;
        for (const r of pack.racers) {
          if (!r.alive) continue;
          if (r.t <= player.t) continue;
          r.stun = 1.6;
          r.speed *= 0.35;
          r.latVel += (Math.random() * 2 - 1) * 26;
          this.vfx.burst(r.group.position, 22, 0x8f6aff);
          hit++;
        }
        player.punts += hit;
        A && A.itemThunder();
        if (hooks.onThunder) hooks.onThunder(hit);
        break;
      }
    }
    if (hooks.onUse) hooks.onUse(it);
    return true;
  }

  nearestAhead(player, pack, maxGap) {
    let best = null, bestGap = 1e9;
    for (const r of pack.racers) {
      if (!r.alive) continue;
      const gap = (r.t - player.t) * this.track.length;
      if (gap > 5 && gap < maxGap && gap < bestGap) { best = r; bestGap = gap; }
    }
    return best;
  }

  // a relative leaving something on the road behind them
  dropFrom(racer, kind) {
    if (kind === 'banana') {
      const m = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const sp = new THREE.Mesh(rbox(0.5, 0.16, 2.2, 0.08), this.matBanana);
        sp.rotation.y = (i - 1) * 0.5;
        sp.position.z = 0.4;
        sp.rotation.x = -0.25;
        m.add(sp);
      }
      m.add(new THREE.Mesh(rbox(0.7, 0.3, 0.7, 0.14), this.matBanana));
      this.scene.add(m);
      this.dropHazard('banana', racer.t - 0.0007, racer.lat, m, 3.4, 22);
    } else {
      const m = new THREE.Mesh(new THREE.CircleGeometry(1, 20), this.matSlick);
      m.rotation.x = -Math.PI / 2;
      this.scene.add(m);
      this.dropHazard('slick', racer.t - 0.0008, racer.lat, m, 9, 18);
    }
  }

  dropHazard(kind, t, lat, mesh, radius, life) {
    this.hazards.push({ kind, t, lat, mesh, radius, life, age: 0, cool: new Map() });
    if (this.hazards.length > 40) {
      const old = this.hazards.shift();
      this.scene.remove(old.mesh);
    }
  }

  // ---- everything in flight and everything on the ground ----------------
  step(dt, player, pack, hooks = {}) {
    const tr = this.track;

    if (player.sugarTime > 0) {
      player.sugarTime -= dt;
      if (player.sugarTime <= 0) player.speedMul = 1;
    }
    if (player.blessed > 0) player.blessed -= dt;

    if (this.tether) {
      this.tether.time -= dt;
      const tg = this.tether.target;
      if (tg && tg.alive) player.lat += (tg.lat - player.lat) * Math.min(1, 1.6 * dt);
      if (this.tether.time <= 0) this.tether = null;
    }

    // ---- hazards on the road ----
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.age += dt;
      if (h.age > h.life) {
        this.scene.remove(h.mesh);
        this.hazards.splice(i, 1);
        continue;
      }
      const gap = (h.t - player.t) * tr.length;
      if (gap < -900 || gap > 900) continue;

      tr.posAt(h.t, h.lat, h.kind === 'slick' ? 0.45 : 0.9, h.mesh.position);
      tr.tanAt(h.t, _v); tr.upAt(h.t, _v2);
      _v3.crossVectors(_v2, _v).normalize();
      _m.makeBasis(_v3, _v2, _v);
      h.mesh.quaternion.setFromRotationMatrix(_m);
      if (h.kind === 'slick') {
        const grow = Math.min(1, h.age * 2.2);
        h.mesh.scale.set(h.radius * grow, h.radius * grow * 0.55, 1);
        h.mesh.material.opacity = 0.5 * (1 - Math.pow(h.age / h.life, 4));
      } else {
        h.mesh.rotation.y += dt * 0.6;
      }

      // who is standing in it
      const victims = [player, ...pack.racers];
      for (const vv of victims) {
        if (vv !== player && !vv.alive) continue;
        const g = Math.abs((h.t - vv.t) * tr.length);
        const lateral = Math.abs(h.lat - vv.lat);
        const rad = h.kind === 'slick' ? h.radius : 3.2;
        if (g > rad || lateral > rad) continue;
        if (h.cool.get(vv) > 0) continue;
        h.cool.set(vv, 1.2);

        if (vv === player) {
          if (h.kind === 'banana') {
            if (player.slip(1.2, true)) {
              this.audio && this.audio.slipBanana();
              if (hooks.onPlayerSlip) hooks.onPlayerSlip('banana');
            }
          } else if (player.slip(1.0, false)) {
            this.audio && this.audio.slipSlick();
            if (hooks.onPlayerSlip) hooks.onPlayerSlip('slick');
          }
        } else {
          vv.stun = h.kind === 'banana' ? 1.4 : 0.9;
          vv.speed *= h.kind === 'banana' ? 0.45 : 0.75;
          vv.latVel += (Math.random() * 2 - 1) * (h.kind === 'banana' ? 30 : 14);
          this.vfx.sparks(vv.group.position, 10, h.kind === 'banana' ? 0xffd23d : 0xffe08a);
          player.punts++;
          this.audio && this.audio.slipBanana(0.6);
          if (hooks.onHitRelative) hooks.onHitRelative(vv, h.kind);
        }
      }
      for (const [k, t0] of h.cool) if (t0 > 0) h.cool.set(k, t0 - dt);
    }

    // ---- projectiles ----
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age += dt;
      if (p.age > p.life) { this.scene.remove(p.mesh); this.projectiles.splice(i, 1); continue; }

      // home in on the target's lane
      if (p.target && p.target.alive) {
        p.latVel += (p.target.lat - p.lat) * 2.4 * dt * 8;
        p.latVel *= 0.90;
      }
      p.t += (p.vel * dt) / tr.length;
      p.lat += p.latVel * dt;
      const half = tr.halfAt(p.t);
      if (Math.abs(p.lat) > half) { p.lat = Math.sign(p.lat) * half; p.latVel *= -0.5; }

      const bob = p.kind === 'bonk' ? 2.6 : 2.2 + Math.sin(p.age * 9) * 0.5;
      tr.posAt(p.t, p.lat, bob, p.mesh.position);
      tr.tanAt(p.t, _v); tr.upAt(p.t, _v2);
      _v3.crossVectors(_v2, _v).normalize();
      _m.makeBasis(_v3, _v2, _v);
      p.mesh.quaternion.setFromRotationMatrix(_m);
      if (p.kind === 'bazooka') p.mesh.rotateZ(p.age * 7);

      this.vfx.trail(p.mesh.position, _v.clone().multiplyScalar(-8),
        p.kind === 'bonk' ? 0x2be0c0 : 0xff8a2b, 0.4);

      // contact
      let done = false;
      for (const r of pack.racers) {
        if (!r.alive) continue;
        const g = Math.abs((r.t - p.t) * tr.length);
        if (g > 6 || Math.abs(r.lat - p.lat) > 5) continue;
        r.stun = 1.5;
        r.speed *= 0.35;
        r.latVel += (Math.random() * 2 - 1) * 34;
        if (p.kind === 'bonk') { r.airVY = 21; r.airY = 0.1; }
        this.vfx.burst(p.mesh.position, 30, p.kind === 'bonk' ? 0x2be0c0 : 0xff8a2b);
        this.audio && this.audio.impact(1.2);
        player.punts++;
        if (hooks.onHitRelative) hooks.onHitRelative(r, p.kind);
        done = true;
        break;
      }
      if (done) { this.scene.remove(p.mesh); this.projectiles.splice(i, 1); }
    }
  }
}
