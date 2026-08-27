import * as THREE from 'three';
import { HERO_BUILDERS } from '../art/build.js';

// ---------------------------------------------------------------------------
// Arcade driving, on a rail.
//
// The vehicle does not live in world space. It lives at a distance along the
// track, an offset to one side of it, and a height above it. World position is
// derived from those three numbers every frame. That is what keeps the AI, the
// collisions, the respawns and the camera cheap, and it is why the track can be
// shaped like a rakhi without any of the rest of the code caring.
// ---------------------------------------------------------------------------

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

export class Vehicle {
  constructor(track, spec) {
    this.track = track;
    this.spec = spec;

    this.t = 0;              // normalised distance along the track
    this.lat = 0;            // metres left or right of the centre line
    this.hover = spec.ride === 'bike' ? 0.55 : 0;
    this.speed = 0;
    this.latVel = 0;
    this.airY = 0;
    this.airVY = 0;
    this.airborne = false;

    this.drift = 0;          // visual yaw, radians
    this.lean = 0;           // visual roll
    this.pitch = 0;
    this.bob = 0;

    this.boost = 100;        // 0..100
    this.boosting = false;
    this.boostBlend = 0;

    this.abilityCool = 0;
    this.abilityTime = 0;
    this.abilityActive = false;

    this.item = null;
    this.invuln = 0;
    this.stunned = 0;
    this.offroad = 0;
    this.speedMul = 1;       // external multipliers, items and pads
    this.extMul = 1;
    this.topSpeed = spec.topSpeed;

    this.punts = 0;
    this.hits = 0;
    this.cleanTime = 0;
    this.totalTime = 0;
    this.maxSpeed = 0;

    this.group = HERO_BUILDERS[spec.id](spec);
    this.group.userData.vehicle = this;
    this.wheelSpin = 0;

    this.trailPoints = [];
    this.assist = 1;         // 1 = full driving assist, dialled down in time attack
  }

  get worldSpeedKmh() { return Math.round(this.speed * 3.6); }

  // -------------------------------------------------------------------------
  useAbility() {
    if (this.abilityCool > 0 || this.stunned > 0) return false;
    this.abilityCool = this.spec.ability.cool;
    this.abilityTime = this.spec.ability.dur;
    this.abilityActive = true;
    return true;
  }

  hit(strength = 1, from = 0) {
    if (this.invuln > 0 || (this.abilityActive && this.spec.id === 'comet')) return false;
    this.hits++;
    this.speed *= Math.max(0.34, 1 - 0.42 * strength / this.spec.mass);
    this.latVel += from * 26 * strength / this.spec.mass;
    this.stunned = Math.max(this.stunned, 0.30 * strength / this.spec.mass);
    this.invuln = 0.7;
    return true;
  }

  launch(vy) {
    if (this.airborne) return;
    this.airborne = true;
    this.airVY = vy;
  }

  // -------------------------------------------------------------------------
  update(dt, input, ctx = {}) {
    const s = this.spec;
    const track = this.track;
    this.totalTime += dt;

    // ---- timers ----
    this.abilityCool = Math.max(0, this.abilityCool - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.stunned = Math.max(0, this.stunned - dt);
    if (this.abilityActive) {
      this.abilityTime -= dt;
      if (this.abilityTime <= 0) { this.abilityActive = false; this.abilityTime = 0; }
    }

    const half = track.halfAt(this.t);
    const overEdge = Math.max(0, Math.abs(this.lat) - half * 0.94);
    this.offroad = overEdge > 0.5 ? Math.min(1, overEdge / 12) : 0;

    // ---- longitudinal ----
    const nitro = this.abilityActive && s.id === 'velocity' ? 1.30 : 1;
    const fury = this.abilityActive && s.id === 'beast' ? 1.18 : 1;
    const phase = this.abilityActive && s.id === 'comet' ? 1.12 : 1;

    this.boosting = false;
    let mul = this.speedMul * this.extMul * nitro * fury * phase;
    if (input.boost && this.boost > 1 && this.stunned <= 0) {
      this.boosting = true;
      this.boost = Math.max(0, this.boost - s.boostDrain * dt);
      mul *= s.boostMul;
    } else {
      this.boost = Math.min(100, this.boost + s.boostRegen * dt * (this.boosting ? 0 : 1));
    }
    this.boostBlend += ((this.boosting ? 1 : 0) - this.boostBlend) * Math.min(1, 7 * dt);

    // multipliers stack (boost plus an item plus an ability), so cap the total
    // or a lucky pickup turns her into a bullet
    let target = Math.min(s.topSpeed * mul, s.topSpeed * 1.72);
    if (this.offroad) target *= 1 - 0.42 * this.offroad;
    if (this.stunned > 0) target *= 0.35;
    if (input.brake) target *= 0.30;
    if (ctx.speedCap !== undefined) target = Math.min(target, ctx.speedCap);

    const rate = this.speed < target ? s.accel * (this.stunned > 0 ? 0.4 : 1) : s.brake;
    this.speed += (target - this.speed) * Math.min(1, (rate / Math.max(20, s.topSpeed)) * dt * 3.4);
    this.speed = Math.max(0, this.speed);
    this.maxSpeed = Math.max(this.maxSpeed, this.speed);
    if (this.offroad < 0.1 && this.stunned <= 0) this.cleanTime += dt;

    // ---- lateral ----
    const speedK = Math.min(1, this.speed / (s.topSpeed * 0.55));
    let steer = input.steer;

    // the assist: a gentle pull back toward the racing line, stronger the
    // further out she is and the less she is steering. she never has to fight
    // the road, only decide where on it to be.
    if (this.assist > 0) {
      const curve = track.curveAt(this.t);
      const ideal = THREE.MathUtils.clamp(-curve * 26, -half * 0.55, half * 0.55);
      const pull = (ideal - this.lat) / Math.max(1, half);
      steer += pull * 0.34 * this.assist * (1 - Math.abs(input.steerRaw) * 0.75);
    }

    const turn = s.turn * (1 - 0.28 * Math.min(1, this.speed / s.topSpeed));
    const desired = steer * turn * 34 * speedK;
    const grip = s.grip * (this.offroad ? 0.45 : 1) * (this.airborne ? 0.25 : 1);
    this.latVel += (desired - this.latVel) * Math.min(1, grip * dt);

    // banking pushes you downhill on a cambered corner, which is free feel
    this.latVel += track.bankAt(this.t) * 26 * speedK * dt;

    this.lat += this.latVel * dt;

    // walls. soft in the assist zone, hard past it.
    const wall = half * 1.55;
    if (Math.abs(this.lat) > wall) {
      this.lat = Math.sign(this.lat) * wall;
      this.latVel *= -0.28;
      this.speed *= 0.965;
      if (ctx.onScrape) ctx.onScrape(this);
    }

    // ---- vertical ----
    if (this.airborne) {
      this.airVY -= 62 * dt;
      this.airY += this.airVY * dt;
      if (this.airY <= 0) {
        this.airY = 0; this.airVY = 0; this.airborne = false;
        if (ctx.onLand) ctx.onLand(this);
      }
    }

    // ---- progress ----
    const prevT = this.t;
    this.t += (this.speed * dt) / track.length;
    if (this.t > 1) this.t = 1;
    this.deltaT = this.t - prevT;

    // ---- visual state ----
    const driftTarget = THREE.MathUtils.clamp(-this.latVel / 26, -0.75, 0.75);
    this.drift += (driftTarget - this.drift) * Math.min(1, 8 * dt);
    const leanTarget = s.ride === 'bike'
      ? THREE.MathUtils.clamp(this.latVel / 20, -0.62, 0.62)
      : THREE.MathUtils.clamp(-this.latVel / 44, -0.26, 0.26);
    this.lean += (leanTarget - this.lean) * Math.min(1, 6 * dt);
    const pitchTarget = THREE.MathUtils.clamp((target - this.speed) / s.topSpeed * -0.30, -0.14, 0.14)
      + (this.airborne ? -0.10 : 0);
    this.pitch += (pitchTarget - this.pitch) * Math.min(1, 5 * dt);
    this.bob += dt * (4 + this.speed * 0.06);

    this.wheelSpin += this.speed * dt * 1.6;
    this.applyTransform();
  }

  applyTransform() {
    const t = this.track;
    const g = this.group;
    const hoverBob = this.spec.ride === 'bike' ? Math.sin(this.bob * 1.6) * 0.09 : 0;
    t.posAt(this.t, this.lat, 0.3 + this.airY + this.hover + hoverBob, g.position);

    t.tanAt(this.t, _v);
    t.upAt(this.t, _v2);
    _v3.crossVectors(_v2, _v).normalize();      // right
    _v2.crossVectors(_v, _v3).normalize();      // orthonormal up

    _m.makeBasis(_v3, _v2, _v);                 // local z points down the road
    g.quaternion.setFromRotationMatrix(_m);

    // drift, lean and pitch are all local to the vehicle, applied in that order
    _e.set(this.pitch, this.drift * 0.55, -this.lean, 'YXZ');
    _q.setFromEuler(_e);
    g.quaternion.multiply(_q);

    // wheels
    const ws = this.group.userData.wheels || [];
    for (let i = 0; i < ws.length; i++) {
      const w = ws[i];
      w.rotation.x = -this.wheelSpin / (w.userData.radius || 0.5);
      if (i < 2 && this.spec.ride !== 'bike') w.rotation.y = this.drift * 0.55;
      if (this.spec.ride === 'bike' && i === 0) w.rotation.y = this.drift * 0.4;
    }
  }

  // world position without touching the group, for the camera and the AI
  worldPos(out = new THREE.Vector3()) {
    return this.track.posAt(this.t, this.lat, this.airY + this.hover, out);
  }
}
