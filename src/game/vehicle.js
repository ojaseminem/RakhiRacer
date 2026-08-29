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
    this.heading = 0;        // where the nose points, relative to the road
    this.slide = 0;          // how far past grip the tyres are
    this.steerVis = 0;       // smoothed input, for the front wheels
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
    this.slipping = 0;      // ghee slick and banana peel
    this.spinOut = 0;       // full spin, from a banana
    this.scraping = 0;
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

  slip(dur = 1.6, spin = false) {
    if (this.invuln > 0 || (this.abilityActive && this.spec.id === 'comet')) return false;
    this.slipping = Math.max(this.slipping, dur);
    if (spin) {
      this.spinOut = Math.max(this.spinOut, 1.15);
      // spin the way she was already leaning rather than at random, which is
      // the difference between an accident and a coin flip
      this.spinDir = this.latVel > 0.5 ? 1 : this.latVel < -0.5 ? -1
        : (Math.random() > 0.5 ? 1 : -1);
      this.speed *= 0.62;
      // let go of the wheel for the duration; fighting a spin you cannot steer
      // out of is just frustrating
      this.heading = 0;
      this.latVel *= 0.4;
    } else {
      // a slick does not spin her, it takes the grip away and lets the car
      // wash wide, so she keeps some say in where it ends up
      this.latVel += Math.sign(this.latVel || 1) * 4;
    }
    this.hits++;
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
    this.slipping = Math.max(0, this.slipping - dt);
    this.spinOut = Math.max(0, this.spinOut - dt);
    if (this.abilityActive) {
      this.abilityTime -= dt;
      if (this.abilityTime <= 0) { this.abilityActive = false; this.abilityTime = 0; }
    }

    const half = track.halfAt(this.t);
    const overEdge = Math.max(0, Math.abs(this.lat) - half * 0.94);
    this.offroad = overEdge > 0.5 ? Math.min(1, overEdge / 12) : 0;

    // ---- longitudinal ----
    // A force model rather than a target speed, so the throttle has weight:
    // acceleration falls off as she approaches top speed, letting go coasts,
    // and the brake actually bites.
    const nitro = this.abilityActive && s.id === 'velocity' ? 1.30 : 1;
    const fury = this.abilityActive && s.id === 'beast' ? 1.18 : 1;
    const phase = this.abilityActive && s.id === 'comet' ? 1.12 : 1;

    this.boosting = false;
    let mul = this.speedMul * this.extMul * nitro * fury * phase;
    if (input.boost && this.boost > 1 && this.stunned <= 0 && input.throttle > 0.05) {
      this.boosting = true;
      this.boost = Math.max(0, this.boost - s.boostDrain * dt);
      mul *= s.boostMul;
    } else {
      this.boost = Math.min(100, this.boost + s.boostRegen * dt);
    }
    this.boostBlend += ((this.boosting ? 1 : 0) - this.boostBlend) * Math.min(1, 7 * dt);

    let ceiling = Math.min(s.topSpeed * mul, s.topSpeed * 1.72);
    if (this.offroad) ceiling *= 1 - 0.42 * this.offroad;
    if (this.stunned > 0) ceiling *= 0.35;
    if (this.slipping > 0) ceiling *= 0.72;
    if (ctx.speedCap !== undefined) ceiling = Math.min(ceiling, ctx.speedCap);

    // Idle cruise. Let go of everything and she settles at a comfortable pace
    // instead of rolling to a stop, so nobody who has never played a racing
    // game gets stranded. Pressing W is still clearly faster.
    const cruise = ctx.speedCap !== undefined ? ctx.speedCap : ceiling * 0.46;
    const wantThrottle = Math.max(input.throttle || 0,
      (input.brake > 0.05 ? 0 : (this.speed < cruise ? 0.55 : 0)));

    let force = 0;
    if (wantThrottle > 0) {
      // power tapers off near the ceiling, which is what gives a top speed feel
      const headroom = Math.max(0, 1 - this.speed / Math.max(1, ceiling));
      force += s.accel * wantThrottle * (0.35 + 0.65 * headroom) * (this.stunned > 0 ? 0.35 : 1);
    }
    if (input.brake > 0) force -= s.brake * input.brake;
    force -= this.speed * (0.26 + (this.offroad ? 0.9 : 0) + (this.slipping > 0 ? 0.25 : 0));

    this.speed += force * dt;
    if (this.speed > ceiling) this.speed += (ceiling - this.speed) * Math.min(1, 3.2 * dt);
    this.speed = Math.max(0, this.speed);
    this.throttleBlend = (this.throttleBlend || 0) +
      ((wantThrottle) - (this.throttleBlend || 0)) * Math.min(1, 6 * dt);

    this.maxSpeed = Math.max(this.maxSpeed, this.speed);
    if (this.offroad < 0.1 && this.stunned <= 0) this.cleanTime += dt;

    // ---- lateral ----
    //
    // The car has a heading now: an angle away from the road's direction that
    // the steering turns, and it travels along that heading. Before this, the
    // steering set a sideways velocity directly, up to fifty metres a second,
    // so the car slid across the road like a puck without ever pointing where
    // it was going. That is what read as drifting around the centre of the
    // road rather than driving.
    const speedK = Math.min(1, this.speed / (s.topSpeed * 0.55));
    let steer = input.steer;

    // A light stabiliser, not a driver. It used to pull the car onto a racing
    // line by itself, which is a third of why nothing felt like steering.
    if (this.assist > 0) {
      const curve = track.curveAt(this.t);
      const ideal = THREE.MathUtils.clamp(-curve * 18, -half * 0.40, half * 0.40);
      const pull = (ideal - this.lat) / Math.max(1, half);
      steer -= pull * 0.11 * this.assist * (1 - Math.abs(input.steerRaw) * 0.9);
    }

    // How far off the road's line the nose can point. It tightens with speed,
    // which is what stops a flat out car turning like a shopping trolley.
    const lockLimit = s.turn * 0.185 * (1 - 0.42 * Math.min(1, this.speed / s.topSpeed));
    // lat is measured to the left of the centre line, so a positive steer
    // input (D, right) has to point the nose the other way in this frame.
    const headingWant = -steer * lockLimit * (0.35 + 0.65 * speedK);

    const grip = s.grip * (this.offroad ? 0.45 : 1) * (this.airborne ? 0.22 : 1) * (this.slipping > 0 ? 0.20 : 1);
    // the nose swings toward where you are pointing it, quickly but not
    // instantly, which is the weight of a car
    this.heading += (headingWant - this.heading) * Math.min(1, (2.2 + s.grip * 0.42) * dt);

    // and the car goes where it is pointing. The tyres take a moment to catch
    // up with the nose, and that lag is the slide.
    const want = this.speed * Math.sin(this.heading);
    this.latVel += (want - this.latVel) * Math.min(1, grip * 0.9 * dt);

    // understeer: past a certain cornering load the tyres stop keeping up and
    // she washes wide, which is a reason to lift off rather than a punishment
    const load = Math.abs(this.latVel) / Math.max(8, this.speed * 0.34);
    this.slide = Math.max(0, load - 1);
    if (this.slide > 0) this.latVel -= Math.sign(this.latVel) * this.slide * 6 * dt;

    // banking pushes you downhill on a cambered corner, which is free feel
    this.latVel += track.bankAt(this.t) * 26 * speedK * dt;

    this.lat += this.latVel * dt;

    // Hard barrier. The road is fenced on both sides now, so this is a wall she
    // scrapes along rather than a suggestion she can drive through.
    const wall = half * 1.02;
    if (Math.abs(this.lat) > wall) {
      this.lat = Math.sign(this.lat) * wall;
      this.latVel *= -0.18;
      // scrubbing sixty per cent of your speed for a second against the wall
      // was a race ending mistake for a moment of clumsiness. It costs about a
      // fifth now, which stings without ruining the run.
      this.speed *= 0.997;
      // and stop pointing into the wall, so she is not fighting a heading she
      // cannot use
      this.heading *= 0.86;
      this.scraping = 0.2;
      if (ctx.onScrape) ctx.onScrape(this);
    } else if (this.scraping > 0) {
      this.scraping -= dt;
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
    if (this.spinOut > 0) {
      // a whole number of turns, then unwind to straight, so the car never
      // finishes a spin sitting sideways on the road
      this.drift += dt * 11 * (this.spinDir || 1);
      if (this.spinOut < 0.35) {
        const near = Math.round(this.drift / (Math.PI * 2)) * Math.PI * 2;
        this.drift += (near - this.drift) * Math.min(1, 7 * dt);
      }
    } else {
      // Point the car along its own velocity, plus a little extra into the
      // corner when it is sliding. The old version took the sideways velocity
      // and yawed the opposite way, so the car permanently counter-steered
      // away from wherever it was actually travelling.
      const slip = Math.atan2(this.latVel, Math.max(10, this.speed));
      const driftTarget = THREE.MathUtils.clamp(slip * (1 + this.slide * 0.9), -0.85, 0.85);
      this.drift += (driftTarget - this.drift) * Math.min(1, 11 * dt);
      if (Math.abs(this.drift) > Math.PI) this.drift -= Math.sign(this.drift) * Math.PI * 2;
    }
    const leanTarget = s.ride === 'bike'
      ? THREE.MathUtils.clamp(this.latVel / 20, -0.62, 0.62)
      : THREE.MathUtils.clamp(-this.latVel / 44, -0.26, 0.26);
    this.lean += (leanTarget - this.lean) * Math.min(1, 6 * dt);
    const pitchTarget = THREE.MathUtils.clamp((this.throttleBlend - 0.5) * -0.16, -0.14, 0.14)
      + (this.airborne ? -0.10 : 0);
    this.pitch += (pitchTarget - this.pitch) * Math.min(1, 5 * dt);
    this.steerVis += ((input.steer || 0) - this.steerVis) * Math.min(1, 12 * dt);
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
    _v3.crossVectors(_v2, _v).normalize();      // local +X
    _v2.crossVectors(_v, _v3).normalize();      // orthonormal up

    _m.makeBasis(_v3, _v2, _v);                 // local z points down the road
    g.quaternion.setFromRotationMatrix(_m);

    // drift, lean and pitch are all local to the vehicle, applied in that order
    _e.set(this.pitch, this.drift, -this.lean, 'YXZ');
    _q.setFromEuler(_e);
    g.quaternion.multiply(_q);

    // wheels
    const ws = this.group.userData.wheels || [];
    for (let i = 0; i < ws.length; i++) {
      const w = ws[i];
      w.rotation.x = -this.wheelSpin / (w.userData.radius || 0.5);
      // the front wheels follow the steering input rather than the slide, so
      // they turn the instant she presses a key
      if (i < 2 && this.spec.ride !== 'bike') w.rotation.y = this.steerVis * 0.5;
      if (this.spec.ride === 'bike' && i === 0) w.rotation.y = this.steerVis * 0.42;
    }
  }

  // world position without touching the group, for the camera and the AI
  worldPos(out = new THREE.Vector3()) {
    return this.track.posAt(this.t, this.lat, this.airY + this.hover, out);
  }
}
