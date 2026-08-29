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


// ---------------------------------------------------------------------------
// Item box icons.
//
// The boxes used to be plain cubes, so there was nothing to tell you what a
// pickup was or even that it was a pickup. Each one is now a flat drawn icon
// facing the camera with a glow behind it, cycling through the roster the way
// a mystery box should, because the item itself is still rolled on pickup.
// The icons are drawn with canvas paths rather than loaded, so there is no
// asset to ship and they stay crisp at any size.
// ---------------------------------------------------------------------------
const ICON_PX = 160;

function iconCanvas(draw, color) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = ICON_PX;
  const c = cv.getContext('2d');
  c.translate(ICON_PX / 2, ICON_PX / 2);
  c.scale(ICON_PX / 100, ICON_PX / 100);       // draw in a 100x100 box, centred
  c.lineJoin = c.lineCap = 'round';
  c.strokeStyle = 'rgba(14,5,20,0.92)';
  c.lineWidth = 9;
  c.fillStyle = color;
  draw(c);
  return cv;
}

// each one draws a path then calls fin() to ink and fill it
const ink = (c) => { c.stroke(); c.fill(); };

const ICON_ART = {
  sugar: (c) => {                                   // a boiled sweet
    c.beginPath(); c.arc(0, 0, 25, 0, Math.PI * 2); ink(c);
    c.beginPath();
    c.moveTo(-25, 0); c.lineTo(-44, -16); c.lineTo(-38, 0); c.lineTo(-44, 16); c.closePath(); ink(c);
    c.beginPath();
    c.moveTo(25, 0); c.lineTo(44, -16); c.lineTo(38, 0); c.lineTo(44, 16); c.closePath(); ink(c);
  },
  banana: (c) => {                                  // a peel, three strips
    c.save(); c.rotate(-0.2);
    for (let i = -1; i <= 1; i++) {
      c.save(); c.rotate(i * 0.62);
      c.beginPath();
      c.moveTo(0, 8); c.quadraticCurveTo(-9, -20, 0, -42);
      c.quadraticCurveTo(9, -20, 0, 8); c.closePath(); ink(c);
      c.restore();
    }
    c.beginPath(); c.arc(0, 14, 13, 0, Math.PI * 2); ink(c);
    c.restore();
  },
  bazooka: (c) => {                                 // a chappal, sole and strap
    c.beginPath();
    c.moveTo(-16, -40); c.quadraticCurveTo(20, -34, 18, 0);
    c.quadraticCurveTo(17, 36, -14, 40);
    c.quadraticCurveTo(-30, 20, -28, 0);
    c.quadraticCurveTo(-30, -22, -16, -40); c.closePath(); ink(c);
    c.beginPath(); c.lineWidth = 8;
    c.moveTo(-20, -14); c.quadraticCurveTo(0, -2, 12, -20); c.stroke();
  },
  slick: (c) => {                                   // a drop of ghee
    c.beginPath();
    c.moveTo(0, -44);
    c.quadraticCurveTo(30, -6, 30, 10);
    c.arc(0, 10, 30, 0, Math.PI);
    c.quadraticCurveTo(-30, -6, 0, -44); c.closePath(); ink(c);
  },
  blessing: (c) => {                                // an open palm
    c.beginPath();
    c.moveTo(-22, 42); c.lineTo(-22, -6);
    c.lineTo(-22, -30); c.lineTo(-8, -30); c.lineTo(-8, -6);
    c.lineTo(-8, -42); c.lineTo(6, -42); c.lineTo(6, -6);
    c.lineTo(6, -34); c.lineTo(20, -34); c.lineTo(20, 4);
    c.quadraticCurveTo(30, 20, 20, 42); c.closePath(); ink(c);
  },
  thread: (c) => {                                  // the rakhi itself
    c.beginPath(); c.arc(0, 0, 17, 0, Math.PI * 2); ink(c);
    c.beginPath(); c.lineWidth = 9;
    c.moveTo(-17, -4); c.quadraticCurveTo(-42, -18, -46, 6); c.stroke();
    c.moveTo(17, -4); c.quadraticCurveTo(42, -18, 46, 6); c.stroke();
    c.beginPath(); c.arc(0, 0, 7, 0, Math.PI * 2); c.fillStyle = 'rgba(14,5,20,0.9)'; c.fill();
  },
  bonk: (c) => {                                    // a boxing glove
    c.beginPath();
    c.moveTo(-30, -18);
    c.quadraticCurveTo(-30, -44, 2, -44);
    c.quadraticCurveTo(34, -44, 34, -12);
    c.quadraticCurveTo(34, 14, 8, 16);
    c.lineTo(8, 34); c.lineTo(-26, 34); c.lineTo(-26, 12);
    c.quadraticCurveTo(-30, 0, -30, -18); c.closePath(); ink(c);
    c.beginPath(); c.lineWidth = 8;
    c.moveTo(-24, 14); c.lineTo(8, 14); c.stroke();
  },
  thunder: (c) => {                                 // a bolt
    c.beginPath();
    c.moveTo(10, -46); c.lineTo(-26, 4); c.lineTo(-2, 4);
    c.lineTo(-10, 46); c.lineTo(26, -8); c.lineTo(2, -8); c.closePath(); ink(c);
  }
};

// a soft radial disc, used behind every icon
function glowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0.00, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.22, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.16)');
  g.addColorStop(1.00, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}

export class ItemField {
  constructor(scene, track, vfx, audio, camera) {
    this.track = track;
    this.scene = scene;
    this.camera = camera;
    this.vfx = vfx;
    this.audio = audio;
    this.boxes = [];
    this.projectiles = [];
    this.hazards = [];

    // ---- pickups ---------------------------------------------------------
    // One material per item icon, and a pool of sprites shared between whichever
    // boxes are close enough to see. Never more than a couple of dozen are on
    // screen, so a pool is far cheaper than seven hundred of anything.
    // Flat planes turned to face the camera, not THREE.Sprite. The occlusion
    // pass renders the scene through an override material, and a sprite's
    // billboarding lives in its own vertex shader, so under the override every
    // sprite collapsed and came back as a solid black rectangle.
    this.iconMats = ITEMS.map(it => new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(iconCanvas(ICON_ART[it.id] || ICON_ART.thunder,
        '#' + it.color.toString(16).padStart(6, '0'))),
      transparent: true, depthWrite: false, toneMapped: false, fog: false,
      side: THREE.DoubleSide
    }));
    this.iconMats.forEach(m => { m.map.colorSpace = THREE.SRGBColorSpace; m.map.anisotropy = 4; });

    const glowTex = glowTexture();
    const quad = new THREE.PlaneGeometry(1, 1);
    this.pickups = [];
    for (let i = 0; i < 34; i++) {
      const g = new THREE.Group();
      const glow = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({
        map: glowTex, transparent: true, depthWrite: false, toneMapped: false,
        blending: THREE.AdditiveBlending, opacity: 0.7, fog: false, side: THREE.DoubleSide
      }));
      glow.scale.setScalar(11);
      const icon = new THREE.Mesh(quad, this.iconMats[0]);
      icon.scale.setScalar(4.6);
      icon.position.z = 0.02;
      g.add(glow); g.add(icon);
      g.visible = false;
      g.renderOrder = 12;
      scene.add(g);
      this.pickups.push({ group: g, glow, icon });
    }

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
  }

  setVisible(on) {
    for (const s of this.pickups) if (!on) s.group.visible = false;
    this.pickupsHidden = !on;
  }

  reset() {
    for (const h of this.hazards) { this.scene.remove(h.mesh); if (h.ring) this.scene.remove(h.ring); }
    for (const p of this.projectiles) { this.scene.remove(p.mesh); if (p.reticle) this.scene.remove(p.reticle); }
    this.hazards.length = 0;
    this.projectiles.length = 0;
    this.tether = null;
  }

  // ---- the boxes --------------------------------------------------------
  // Only the handful in front of her get a sprite from the pool. The icon
  // cycles through the roster, which is the honest thing to show: what she
  // actually gets is still rolled at the moment she drives through it.
  update(dt, player, hud, hooks = {}) {
    const tr = this.track;
    if (this.pickupsHidden) return;
    this.cycle = (this.cycle || 0) + dt;
    let n = 0;

    for (const b of this.boxes) {
      if (n >= this.pickups.length) break;
      if (b.taken > 0) { b.taken -= dt; if (b.taken <= 0) b.taken = 0; }
      const gap = (b.t - player.t) * tr.length;
      if (gap < -40 || gap > 640) continue;
      const alive = b.taken <= 0;
      if (!alive) continue;

      b.spin += dt * 1.9;
      const slot = this.pickups[n++];
      tr.posAt(b.t, b.lat, 3.2 + Math.sin(b.spin * 1.4) * 0.45, slot.group.position);
      slot.group.visible = true;

      // each box is offset in the cycle so a row of them is never in lockstep
      const idx = Math.floor(this.cycle * 1.6 + b.spin) % this.iconMats.length;
      if (slot.icon.material !== this.iconMats[idx]) slot.icon.material = this.iconMats[idx];

      const it = ITEMS[idx];
      slot.glow.material.color.setHex(it.color);
      const near = 1 - Math.min(1, Math.max(0, gap) / 640);
      const breathe = 1 + Math.sin(b.spin * 2.4) * 0.07;
      slot.glow.scale.setScalar(12.5 * breathe);
      slot.glow.material.opacity = 0.55 + near * 0.45;
      slot.icon.scale.setScalar(5.6 * breathe);
      if (this.camera) slot.group.quaternion.copy(this.camera.quaternion);

      if (Math.abs(gap) < 4.5 && Math.abs(b.lat - player.lat) < 4.4 && !player.item) {
        b.taken = 7;
        player.item = rollItem(hooks.position || 6, hooks.total || 13);
        hud.setItem(player.item);
        this.audio && this.audio.pickup();
        this.vfx.sparks(slot.group.position, 18, player.item.color, 8, 8);
        if (hooks.onPickup) hooks.onPickup(player.item);
      }
    }

    for (let i = n; i < this.pickups.length; i++) this.pickups[i].group.visible = false;
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
        const m = this.buildPeel();
        this.scene.add(m);
        this.dropHazard('banana', player.t - 0.0009, player.lat, m, 3.4, 26, 'you');
        A && A.itemDrop();
        break;
      }

      case 'slick': {
        const m = this.buildSlick();
        this.scene.add(m);
        this.dropHazard('slick', player.t - 0.0010, player.lat, m, 8, 22, 'you');
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
          kind: 'bazooka', t: player.t + 0.0004, lat: player.lat, mesh: m, owner: 'you',
          reticle: this.addReticle(0xff8a2b),
          vel: 128, latVel: 0, life: 6, age: 0, target: this.nearestAhead(player, pack, 700)
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
          kind: 'bonk', t: player.t + 0.0004, lat: player.lat, mesh: m, owner: 'you',
          reticle: this.addReticle(0x2be0c0),
          vel: 99, latVel: 0, life: 4.5, age: 0, target: this.nearestAhead(player, pack, 400)
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
      const m = this.buildPeel();
      this.scene.add(m);
      this.dropHazard('banana', racer.t - 0.0007, racer.lat, m, 3.4, 22, racer.def.title);
    } else {
      const m = this.buildSlick();
      this.scene.add(m);
      this.dropHazard('slick', racer.t - 0.0008, racer.lat, m, 7, 18, racer.def.title);
    }
  }

  // A flat pulsing ring painted on the road under a hazard. The peel itself is
  // a few centimetres of banana at two hundred and sixty; the ring is what you
  // actually see in time to steer around it.
  // A spinning bracket that locks onto whoever a homing item has chosen. Fired
  // a slipper into the pack and had no idea where it went, was the note.

  // ---- the things that end up on the road --------------------------------
  // Both of these are built in one place now. The player's version and the
  // relatives' version had drifted apart, and the peel in particular was small
  // enough at two hundred and sixty that the first you knew of it was the spin.
  buildPeel() {
    const m = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const strip = new THREE.Mesh(rbox(0.85, 0.22, 3.4, 0.11), this.matBanana);
      strip.rotation.y = (i - 1.5) * 0.44;
      strip.position.z = 0.7;
      strip.rotation.x = -0.30;
      m.add(strip);
    }
    const core = new THREE.Mesh(rbox(1.25, 0.42, 1.25, 0.20), this.matBanana);
    m.add(core);
    return m;
  }

  buildSlick() {
    const g = new THREE.Group();
    // a body with a bright rim, rather than one flat additive disc that read
    // as a light on the road instead of something on it
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 26), this.matSlick);
    const rim = new THREE.Mesh(new THREE.RingGeometry(0.88, 1.0, 26), new THREE.MeshBasicMaterial({
      color: 0xfff0c0, transparent: true, opacity: 0.8, depthWrite: false,
      toneMapped: false, side: THREE.DoubleSide
    }));
    rim.position.y = 0.01;
    g.add(pool); g.add(rim);
    g.userData.rim = rim;
    return g;
  }

  addReticle(color) {
    const r = this.makeReticle(color);
    this.scene.add(r);
    return r;
  }

  makeReticle(color) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false
    });
    // four corner brackets rather than a full ring, which reads as a lock on
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + i * Math.PI / 2;
      const arc = new THREE.Mesh(new THREE.RingGeometry(2.5, 3.1, 8, 1, a - 0.28, 0.56), mat);
      g.add(arc);
    }
    g.renderOrder = 30;
    return g;
  }

  makeHazardRing(kind) {
    const color = kind === 'banana' ? 0xffd23d : 0xffe08a;
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.85, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false
    });
    const g = new THREE.Group();
    // A wide band, not a hairline. At three metres across and forty metres out
    // a thin ring is about six pixels of nothing; this is the width of the
    // thing you are being warned about.
    const band = new THREE.Mesh(new THREE.RingGeometry(0.52, 1.0, 32), mat);
    g.add(band);
    // and a faint wash inside it so the ground itself reads as dangerous
    const wash = new THREE.Mesh(new THREE.CircleGeometry(0.52, 28), new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.22, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false
    }));
    g.add(wash);
    g.userData.mats = [mat, wash.material];
    g.rotation.x = -Math.PI / 2;
    g.renderOrder = 6;
    return g;
  }

  dropHazard(kind, t, lat, mesh, radius, life, owner = 'the road') {
    // owner is only ever used to say whose fault it was in the feed
    const ring = this.makeHazardRing(kind);
    this.scene.add(ring);
    this.hazards.push({ kind, t, lat, mesh, ring, radius, life, age: 0, owner, cool: new Map() });
    if (this.hazards.length > 40) {
      const old = this.hazards.shift();
      this.scene.remove(old.mesh);
      if (old.ring) this.scene.remove(old.ring);
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
        if (h.ring) this.scene.remove(h.ring);
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
      // the basis puts local XY upright, so a flat disc has to be laid down
      // again afterwards. Without this the ghee slick was a vertical plate
      // standing in the road, which is exactly as confusing as it sounds.
      if (h.kind === 'slick') {
        // the basis puts local XY upright, so a flat pool has to be laid down
        // again afterwards. Without this the ghee slick was a vertical plate
        // standing in the road, which is exactly as confusing as it sounds.
        h.mesh.rotateX(-Math.PI / 2);
        const grow = Math.min(1, h.age * 2.2);
        const fade = 1 - Math.pow(h.age / h.life, 4);
        h.mesh.scale.set(h.radius * grow, h.radius * grow * 0.62, 1);
        const pool = h.mesh.children[0], rim = h.mesh.userData.rim;
        if (pool) pool.material.opacity = 0.52 * fade;
        if (rim) rim.material.opacity = 0.85 * fade;
      } else {
        h.mesh.rotation.y += dt * 0.6;
        // the peel settles then sits still, rather than spinning forever like
        // a pickup, which is what made it read as something to collect
        if (h.age < 0.6) h.mesh.position.y += (1 - h.age / 0.6) * 0.4;
      }

      // the warning ring: sits flat, breathes, and fades out with the hazard
      // The warning ring. It is drawn at the size of the actual hit box, so
      // what you steer around is exactly what catches you, and it flashes
      // harder the closer she is to it.
      if (h.ring) {
        const rad = h.kind === 'slick' ? h.radius * Math.min(1, h.age * 2.2) : 3.2;
        const close = 1 - Math.min(1, Math.abs(gap) / 220);
        const pulse = 1 + Math.sin(h.age * (5 + close * 9)) * (0.07 + close * 0.09);
        // The road is crowned: its surface sits between 0.20 and 0.28 above the
        // spline. The ring used to be drawn at 0.16, which is underneath the
        // tarmac, so the warning marker was invisible the whole time.
        tr.posAt(h.t, h.lat, 0.36, h.ring.position);
        tr.tanAt(h.t, _v); tr.upAt(h.t, _v2);
        _v3.crossVectors(_v2, _v).normalize();
        _m.makeBasis(_v3, _v2, _v);
        h.ring.quaternion.setFromRotationMatrix(_m);
        h.ring.rotateX(-Math.PI / 2);
        h.ring.scale.setScalar(rad * pulse);
        const op = (0.30 + close * 0.38) * (1 - Math.pow(h.age / h.life, 3));
        const mats = h.ring.userData.mats || [];
        if (mats[0]) mats[0].opacity = op;
        if (mats[1]) mats[1].opacity = op * 0.26;
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
              if (hooks.onPlayerSlip) hooks.onPlayerSlip('banana', h.owner);
            }
          } else if (player.slip(1.0, false)) {
            this.audio && this.audio.slipSlick();
            if (hooks.onPlayerSlip) hooks.onPlayerSlip('slick', h.owner);
          }
        } else {
          vv.stun = h.kind === 'banana' ? 1.4 : 0.9;
          vv.speed *= h.kind === 'banana' ? 0.45 : 0.75;
          vv.latVel += (Math.random() * 2 - 1) * (h.kind === 'banana' ? 30 : 14);
          this.vfx.sparks(vv.group.position, 10, h.kind === 'banana' ? 0xffd23d : 0xffe08a);
          player.punts++;
          this.audio && this.audio.slipBanana(0.6);
          if (hooks.onHitRelative) hooks.onHitRelative(vv, h.kind, h.owner);
        }
      }
      for (const [k, t0] of h.cool) if (t0 > 0) h.cool.set(k, t0 - dt);
    }

    // ---- projectiles ----
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age += dt;
      if (p.age > p.life) {
        this.scene.remove(p.mesh);
        if (p.reticle) this.scene.remove(p.reticle);
        this.projectiles.splice(i, 1);
        continue;
      }

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

      // keep the lock on marker over whoever it is chasing
      if (p.reticle) {
        const tgt = p.target && p.target.alive ? p.target : null;
        p.reticle.visible = !!tgt;
        if (tgt) {
          p.reticle.position.copy(tgt.group.position);
          p.reticle.position.y += (tgt.group.userData.height || 2.2) + 2.4;
          p.reticle.lookAt(this.camera ? this.camera.position : p.mesh.position);
          p.reticle.rotateZ(p.age * 2.6);
          const closing = Math.max(0, Math.min(1, 1 - Math.abs(tgt.t - p.t) * tr.length / 240));
          p.reticle.scale.setScalar(1 + (1 - closing) * 0.9);
          p.reticle.children.forEach(c => { c.material.opacity = 0.45 + closing * 0.5; });
        }
      }

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
        if (hooks.onHitRelative) hooks.onHitRelative(r, p.kind, p.owner);
        done = true;
        break;
      }
      if (done) {
        this.scene.remove(p.mesh);
        if (p.reticle) this.scene.remove(p.reticle);
        this.projectiles.splice(i, 1);
      }
    }
  }
}
