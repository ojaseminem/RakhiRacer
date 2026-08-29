import * as THREE from 'three';
import { rbox, bean } from '../art/build.js';
import { makeToon, makeGlow } from '../art/materials.js';

// ---------------------------------------------------------------------------
// MOM
//
// Not a car. A mobile fortress on eight wheels with a rolling pin for an arm,
// a saree of armour plates, and headlights that come on like eyes. She does not
// race you. She attacks the road you are racing on.
// ---------------------------------------------------------------------------

const SAREE = 0xd6155a;
const SAREE_2 = 0xffc93d;
const HULL = 0x3a2b4f;
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

function part(geo, mat, x, y, z, parent) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

export function buildMom() {
  const g = new THREE.Group();
  const hull = makeToon({ color: HULL, rim: 0xffb0d0, rimStrength: 0.8, rimPower: 2.0, bounceStrength: 0.45 });
  const saree = makeToon({ color: SAREE, rim: 0xffe0a0, rimStrength: 1.0, rimPower: 1.8, bounceStrength: 0.5 });
  const gold = makeToon({ color: SAREE_2, rim: 0xffffff, rimStrength: 1.1 });
  const dark = makeToon({ color: 0x1c1420, rim: 0x8a6fb0, rimStrength: 0.5 });
  const steel = makeToon({ color: 0xb8b0c8, rim: 0xffffff, rimStrength: 0.9 });

  // Scale. At the old 5.2 she was nearly eighty metres across and sat close
  // enough that all you ever saw was one purple panel filling the screen. At
  // 2.5 she is about thirty seven metres wide, still seven cars across, and
  // her whole silhouette fits in frame, which is the only way a boss reads as
  // a boss rather than as scenery falling on you.
  const S = 2.5;
  const body = new THREE.Group();
  g.add(body);
  g.userData.body = body;

  // --- chassis and the eight wheels ---
  part(rbox(15 * S, 1.4 * S, 11 * S, 0.5 * S), dark, 0, 3.4 * S, 0, body);
  const wheels = [];
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z = (i - 1.5) * 3.0 * S;
      const w = new THREE.Group();
      const tyre = part(new THREE.CylinderGeometry(3.0 * S, 3.0 * S, 1.9 * S, 18), dark, 0, 0, 0, w);
      tyre.rotation.z = Math.PI / 2;
      const hub = part(new THREE.CylinderGeometry(1.5 * S, 1.5 * S, 2.0 * S, 12), gold, 0, 0, 0, w);
      hub.rotation.z = Math.PI / 2;
      for (let k = 0; k < 6; k++) {
        const sp = part(rbox(0.5 * S, 5.4 * S, 0.5 * S, 0.2 * S), steel, 0, 0, 0, w);
        sp.rotation.x = (k / 6) * Math.PI;
      }
      w.position.set(sx * 7.6 * S, 3.0 * S, z);
      body.add(w);
      wheels.push(w);
    }
  }
  g.userData.wheels = wheels;

  // --- the fortress ---
  part(rbox(13 * S, 6 * S, 9 * S, 0.9 * S), hull, 0, 7.4 * S, -0.4 * S, body);
  // saree drape: overlapping plates down the sides, gold bordered
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const p = part(rbox(1.6 * S, 6.4 * S, 2.2 * S, 0.35 * S), saree,
        sx * (6.6 * S + i * 0.16 * S), 6.2 * S, (i - 2) * 2.1 * S, body);
      p.rotation.z = sx * (0.12 + i * 0.015);
      part(rbox(1.7 * S, 0.5 * S, 2.3 * S, 0.2 * S), gold,
        sx * (6.6 * S + i * 0.16 * S), 3.1 * S, (i - 2) * 2.1 * S, body);
    }
  }
  // pallu thrown over one shoulder
  const pallu = part(rbox(5.5 * S, 9 * S, 1.4 * S, 0.5 * S), saree, -5.0 * S, 11 * S, -2.2 * S, body);
  pallu.rotation.z = 0.22;
  part(rbox(5.7 * S, 0.6 * S, 1.5 * S, 0.25 * S), gold, -5.0 * S, 6.6 * S, -2.2 * S, body);

  // --- head and shoulders ---
  const head = new THREE.Group();
  head.position.set(0, 12.4 * S, 0.6 * S);
  body.add(head);
  g.userData.head = head;
  part(rbox(7.4 * S, 5.4 * S, 6.2 * S, 1.6 * S), hull, 0, 0, 0, head);
  // bindi
  const bindi = new THREE.Mesh(new THREE.SphereGeometry(0.6 * S, 12, 8), makeGlow(0xff2f6b, 1));
  bindi.position.set(0, 1.9 * S, 3.1 * S);
  head.add(bindi);
  // the eyes. headlights until the moment they are not.
  const eyes = [];
  for (const sx of [-1, 1]) {
    const socket = part(rbox(2.4 * S, 1.5 * S, 0.7 * S, 0.4 * S), dark, sx * 1.9 * S, 0.3 * S, 3.05 * S, head);
    const e = new THREE.Mesh(rbox(1.9 * S, 1.0 * S, 0.4 * S, 0.25 * S), makeGlow(0xfff0c0, 1));
    e.position.set(sx * 1.9 * S, 0.3 * S, 3.35 * S);
    head.add(e);
    eyes.push(e);
  }
  g.userData.eyes = eyes;
  // hair, a heavy rounded mass
  part(rbox(7.8 * S, 2.6 * S, 6.6 * S, 1.6 * S), dark, 0, 2.4 * S, -0.3 * S, head);
  const bun = part(new THREE.SphereGeometry(2.4 * S, 14, 10), dark, 0, 2.0 * S, -3.6 * S, head);

  // --- arms ---
  const arms = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 7.0 * S, 10.6 * S, 0);
    body.add(arm);
    const upper = part(rbox(2.6 * S, 8.0 * S, 2.6 * S, 1.0 * S), saree, 0, -3.4 * S, 0, arm);
    const fore = new THREE.Group();
    fore.position.set(0, -7.4 * S, 0);
    arm.add(fore);
    part(rbox(2.4 * S, 7.4 * S, 2.4 * S, 0.9 * S), hull, 0, -3.2 * S, 0, fore);
    // bangles
    for (let k = 0; k < 4; k++) {
      const b = part(new THREE.TorusGeometry(1.35 * S, 0.22 * S, 8, 16), gold, 0, -1.2 * S - k * 0.9 * S, 0, fore);
      b.rotation.x = Math.PI / 2;
    }
    arm.userData.fore = fore;
    arms.push(arm);
  }
  g.userData.arms = arms;

  // the right hand carries the belan. the left one is just a hand, which is
  // somehow worse.
  const belan = new THREE.Group();
  belan.position.set(0, -7.6 * S, 0);
  arms[1].userData.fore.add(belan);
  const roll = part(new THREE.CylinderGeometry(1.5 * S, 1.5 * S, 11 * S, 16), steel, 0, 0, 0, belan);
  roll.rotation.z = Math.PI / 2;
  for (const sx of [-1, 1]) {
    const h = part(new THREE.CylinderGeometry(0.55 * S, 0.55 * S, 3.0 * S, 10), gold, sx * 6.8 * S, 0, 0, belan);
    h.rotation.z = Math.PI / 2;
  }
  g.userData.belan = belan;

  const hand = new THREE.Group();
  hand.position.set(0, -7.4 * S, 0);
  arms[0].userData.fore.add(hand);
  part(rbox(3.6 * S, 2.4 * S, 3.0 * S, 1.0 * S), saree, 0, 0, 0, hand);
  for (let k = 0; k < 4; k++) {
    part(rbox(0.7 * S, 2.6 * S, 0.8 * S, 0.32 * S), saree, (k - 1.5) * 0.85 * S, -1.9 * S, 0.6 * S, hand);
  }
  g.userData.hand = hand;

  g.userData.S = S;
  return g;
}

// ---------------------------------------------------------------------------
// The fight.
// ---------------------------------------------------------------------------
export class Boss {
  constructor(scene, track, vfx, audio) {
    this.track = track;
    this.vfx = vfx;
    this.audio = audio;
    this.group = buildMom();
    this.group.visible = false;
    scene.add(this.group);
    this.scene = scene;

    this.t = 0;
    this.lat = 0;
    this.lead = 175;          // metres ahead of the player she sits
    this.phase = 0;
    this.hp = 100;
    this.active = false;
    this.timer = 0;
    this.attackTimer = 2.2;
    this.hazards = [];
    this.roar = 0;
    this.armAnim = 0;
    this.wheelSpin = 0;
    this.hurt = 0;
    this.defeated = false;

    // pooled hazard materials
    this.hazardMat = makeToon({ color: 0x6a3a2a, rim: 0xffb060, rimStrength: 1.3, rimPower: 1.6 });
    this.shockMat = makeGlow(0xffb03d, 0.85);
  }

  start(t) {
    this.active = true;
    this.group.visible = true;
    this.phase = 1;
    this.hp = 100;
    this.timer = 0;
    this.t = Math.min(1, t + this.lead / this.track.length);
    this.attackTimer = 3.0;
  }

  // ---- attacks ----------------------------------------------------------
  spawnShockwave(fromT) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(6, 1.6, 8, 28), this.shockMat.clone());
    m.rotation.x = Math.PI / 2;
    this.scene.add(m);
    this.hazards.push({ kind: 'shock', t: fromT, lat: 0, mesh: m, r: 6, age: 0, life: 4.2, speed: -46, damage: 1 });
    this.audio && this.audio.rumble(1.4, 0.9);
  }

  spawnDebris(fromT, lat) {
    const s = 5 + Math.random() * 7;
    const m = new THREE.Mesh(rbox(s, s * 0.8, s, s * 0.28), this.hazardMat);
    m.castShadow = true;
    this.scene.add(m);
    this.hazards.push({
      kind: 'rock', t: fromT, lat, mesh: m, r: s * 0.6, age: 0, life: 7,
      y: 60, vy: 4, spin: new THREE.Vector3(Math.random() * 3, Math.random() * 3, Math.random() * 3), damage: 1
    });
  }

  spawnSweep(fromT, dir) {
    const m = new THREE.Mesh(rbox(9, 3.2, 3.2, 1.4), this.hazardMat);
    this.scene.add(m);
    this.hazards.push({
      kind: 'sweep', t: fromT, lat: dir * 26, mesh: m, r: 6, age: 0, life: 3.4,
      latVel: -dir * 17, damage: 1
    });
    this.audio && this.audio.whoosh(0.9);
  }

  attack(player) {
    const p = this.phase;
    const roll = Math.random();
    const base = this.t - 12 / this.track.length;
    if (p === 1) {
      if (roll < 0.55) { this.slam(); this.spawnShockwave(base); }
      else { this.spawnDebris(base + 0.0012, (Math.random() * 2 - 1) * 18); }
      this.attackTimer = 2.6 - Math.random() * 0.6;
    } else if (p === 2) {
      if (roll < 0.34) { this.slam(); this.spawnShockwave(base); }
      else if (roll < 0.7) { this.spawnSweep(base, Math.random() > 0.5 ? 1 : -1); }
      else { for (let i = 0; i < 3; i++) this.spawnDebris(base + 0.0009 * i, (Math.random() * 2 - 1) * 20); }
      this.attackTimer = 2.0 - Math.random() * 0.5;
    } else {
      if (roll < 0.4) { this.slam(); this.spawnShockwave(base); this.spawnShockwave(base - 0.0016); }
      else if (roll < 0.75) { this.spawnSweep(base, 1); this.spawnSweep(base - 0.0022, -1); }
      else { for (let i = 0; i < 5; i++) this.spawnDebris(base + 0.0007 * i, (Math.random() * 2 - 1) * 22); }
      this.attackTimer = 1.35 - Math.random() * 0.35;
    }
  }

  slam() {
    this.armAnim = 1;
    this.audio && this.audio.impact(1.4);
    if (this.onSlam) this.onSlam();
  }

  damage(amount) {
    if (this.phase < 2 || this.defeated) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.hurt = 0.4;
    this.audio && this.audio.crack();
    const p = this.group.position;
    this.vfx.burst(_v.set(p.x, p.y + 30, p.z), 30, 0xffd23d);
    if (this.hp <= 0 && !this.defeated) {
      this.defeated = true;
      if (this.onDefeat) this.onDefeat();
    }
    return true;
  }

  // ---- per frame --------------------------------------------------------
  update(dt, player, hooks = {}) {
    if (!this.active) return;
    this.timer += dt;
    this.wheelSpin += dt * 5;
    this.hurt = Math.max(0, this.hurt - dt);

    // she stays ahead of the player, sliding side to side to block the line
    const want = Math.min(1, player.t + this.lead / this.track.length);
    this.t += (want - this.t) * Math.min(1, 1.6 * dt);
    this.lat = Math.sin(this.timer * 0.6) * 12 + player.lat * 0.35;

    const tr = this.track;
    tr.posAt(this.t, this.lat, 0, this.group.position);
    tr.tanAt(this.t, _v);
    tr.upAt(this.t, _v2);
    _v3.crossVectors(_v2, _v).normalize();
    _v2.crossVectors(_v, _v3).normalize();
    _m.makeBasis(_v3, _v2, _v);
    this.group.quaternion.setFromRotationMatrix(_m);
    // she faces back down the road at the player
    _e.set(0, Math.PI, 0);
    _q.setFromEuler(_e);
    this.group.quaternion.multiply(_q);

    for (const w of this.group.userData.wheels) w.rotation.x = -this.wheelSpin;

    // arms
    this.armAnim = Math.max(0, this.armAnim - dt * 1.5);
    const a = Math.sin(this.armAnim * Math.PI);
    this.group.userData.arms[1].rotation.x = -1.5 + a * 2.6;
    this.group.userData.arms[0].rotation.x = Math.sin(this.timer * 1.1) * 0.2 - 0.3;
    this.group.userData.head.rotation.y = Math.sin(this.timer * 0.7) * 0.16;

    // the eyes get angrier every phase
    const eyeCol = this.phase === 1 ? 0xfff0c0 : this.phase === 2 ? 0xffaa3d : 0xff2f3d;
    for (const e of this.group.userData.eyes) {
      e.material.color.setHex(this.hurt > 0 ? 0xffffff : eyeCol);
      e.material.opacity = 0.8 + Math.sin(this.timer * 6) * 0.15 + (this.phase - 1) * 0.06;
    }

    // attacks
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) this.attack(player);

    this.updateHazards(dt, player, hooks);

    // phase progression: survive, then fight back, then chaos
    if (this.phase === 1 && this.timer > 26) {
      this.phase = 2;
      if (hooks.onPhase) hooks.onPhase(2);
    } else if (this.phase === 2 && this.hp <= 34) {
      this.phase = 3;
      this.lead = 132;
      if (hooks.onPhase) hooks.onPhase(3);
    }

    // in phase two she is vulnerable when the player is close and using the
    // right tool for their ride
    if (this.phase >= 2 && !this.defeated) {
      const gap = (this.t - player.t) * tr.length;
      if (gap < 34 && Math.abs(this.lat - player.lat) < 20) {
        const s = player.spec.id;
        const hitting =
          (s === 'beast' && (player.abilityActive || player.boosting)) ||
          (s === 'velocity' && player.boosting && player.speed > player.spec.topSpeed * 1.2) ||
          (s === 'comet' && player.abilityActive);
        if (hitting && this.damageCool === undefined) this.damageCool = 0;
        if (hitting && this.damageCool <= 0) {
          this.damage(9 + Math.random() * 5);
          this.damageCool = 0.55;
          if (hooks.onHitBoss) hooks.onHitBoss();
        }
      }
    }
    if (this.damageCool > 0) this.damageCool -= dt;
  }

  updateHazards(dt, player, hooks) {
    const tr = this.track;
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.age += dt;
      if (h.age > h.life) {
        this.scene.remove(h.mesh);
        if (h.kind === 'shock') h.mesh.material.dispose();
        this.hazards.splice(i, 1);
        continue;
      }

      if (h.kind === 'shock') {
        h.t += (h.speed * dt) / tr.length;
        h.r += dt * 22;
        h.mesh.scale.setScalar(h.r / 6);
        h.mesh.material.opacity = 0.9 * (1 - h.age / h.life);
        tr.posAt(h.t, 0, 1.4, h.mesh.position);
        tr.upAt(h.t, _v);
        h.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _v);
      } else if (h.kind === 'rock') {
        h.vy -= 62 * dt;
        h.y = Math.max(0.8, h.y + h.vy * dt);
        tr.posAt(h.t, h.lat, h.y + 2.4, h.mesh.position);
        h.mesh.rotation.x += h.spin.x * dt;
        h.mesh.rotation.y += h.spin.y * dt;
        if (h.y <= 0.9 && !h.landed) {
          h.landed = true;
          this.audio && this.audio.impact(0.8);
          this.vfx.dust(h.mesh.position, 16, 0xb08a70, 6);
          if (hooks.onShake) hooks.onShake(0.4);
        }
      } else if (h.kind === 'sweep') {
        h.lat += h.latVel * dt;
        tr.posAt(h.t, h.lat, 2.4, h.mesh.position);
        tr.tanAt(h.t, _v); tr.upAt(h.t, _v2);
        _v3.crossVectors(_v2, _v).normalize();
        _m.makeBasis(_v3, _v2, _v);
        h.mesh.quaternion.setFromRotationMatrix(_m);
      }

      // contact
      const gap = Math.abs((h.t - player.t) * tr.length);
      const near = h.kind === 'shock' ? gap < 6 : gap < 7;
      const across = h.kind === 'shock'
        ? true
        : Math.abs(h.lat - player.lat) < h.r + 2.2;
      if (near && across && (h.kind !== 'rock' || h.y < 6)) {
        if (!h.hitOnce) {
          h.hitOnce = true;
          if (player.hit(h.damage * 1.2, Math.sign(player.lat - h.lat) || 1)) {
            if (hooks.onPlayerHurt) hooks.onPlayerHurt();
          }
        }
      }
    }
  }

  clear() {
    for (const h of this.hazards) this.scene.remove(h.mesh);
    this.hazards.length = 0;
    this.active = false;
    this.group.visible = false;
  }
}
