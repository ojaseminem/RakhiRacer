import * as THREE from 'three';

// ---------------------------------------------------------------------------
// The camera.
//
// In normal driving it is a spring loaded chase rig that leads into corners,
// punches its field of view out under boost and shakes when things hit. For
// cinematics the director takes it over completely and runs authored shots, so
// the same camera does both jobs and the handover is a blend rather than a cut.
// ---------------------------------------------------------------------------

const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _r = new THREE.Vector3();
const _look = new THREE.Vector3(), _tmp = new THREE.Vector3();

export class Director {
  constructor(camera, track) {
    this.cam = camera;
    this.track = track;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.baseFov = 68;
    this.fov = 68;

    this.shake = 0;
    this.shakeDecay = 2.6;
    this.hitStop = 0;
    this.timeScale = 1;

    this.mode = 'chase';       // chase | reverse | shot | free
    this.reverseBlend = 0;
    this.reverseRate = 1.4;
    this.shot = null;
    this.shotTime = 0;
    this.blend = 0;            // 0 = gameplay, 1 = shot
    this.letterbox = 0;

    // tunables per ride, set when the vehicle is chosen
    this.dist = 13.5;
    this.height = 5.2;
    this.lookAhead = 0.0022;
  }

  configure(spec) {
    if (spec.ride === 'bike') { this.dist = 5.4; this.height = 2.7; this.baseFov = 66; }
    else if (spec.ride === 'truck') { this.dist = 9.0; this.height = 5.8; this.baseFov = 62; }
    else { this.dist = 6.2; this.height = 3.1; this.baseFov = 64; }
    this.fov = this.baseFov;
  }

  addShake(a) { this.shake = Math.min(2.4, this.shake + a); }
  freeze(t) { this.hitStop = Math.max(this.hitStop, t); }

  // Run an authored shot. Each shot is a function of normalised time that
  // returns a camera position, a look target and a field of view.
  play(shot) {
    this.shot = shot;
    this.shotTime = 0;
    this.mode = 'shot';
  }

  stopShot() { this.shot = null; this.mode = 'chase'; }

  // rate is how fast the swing happens. The cinematic wants a slow, dreadful
  // turn; a held look-back key wants to be round there almost at once, because
  // anything slower reads as the camera being broken rather than turning.
  setReverse(on, rate = 1.4) { this.targetReverse = on ? 1 : 0; this.reverseRate = rate; }

  update(dt, player, opts = {}) {
    // hit stop is what gives impacts weight. everything freezes for a few frames.
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      this.timeScale = 0.06;
    } else {
      this.timeScale += (1 - this.timeScale) * Math.min(1, 10 * dt);
    }

    this.reverseBlend += ((this.targetReverse || 0) - this.reverseBlend) * Math.min(1, (this.reverseRate || 1.4) * dt);

    if (this.shot) {
      this.shotTime += dt;
      const done = this.shot.dur > 0 && this.shotTime >= this.shot.dur;
      this.blend += (1 - this.blend) * Math.min(1, 6 * dt);
      const k = this.shot.dur > 0 ? Math.min(1, this.shotTime / this.shot.dur) : this.shotTime;
      const out = this.shot.at(k, this.shotTime);
      this.pos.lerp(out.pos, Math.min(1, (out.snap ? 1 : 6) * dt));
      if (out.snap) this.pos.copy(out.pos);
      this.look.lerp(out.look, Math.min(1, (out.snap ? 1 : 7) * dt));
      if (out.snap) this.look.copy(out.look);
      this.fov += ((out.fov || this.baseFov) - this.fov) * Math.min(1, 5 * dt);
      this.letterbox += (1 - this.letterbox) * Math.min(1, 4 * dt);
      if (done) { const cb = this.shot.onEnd; this.stopShot(); if (cb) cb(); }
    } else {
      this.blend += (0 - this.blend) * Math.min(1, 5 * dt);
      this.letterbox += ((opts.letterbox || 0) - this.letterbox) * Math.min(1, 4 * dt);
      this.chase(dt, player);
    }

    // shake, applied after everything else so cinematics get it too
    this.shake = Math.max(0, this.shake - this.shakeDecay * dt);
    const s = this.shake * this.shake;
    this.cam.position.copy(this.pos);
    if (s > 0.0001) {
      const t = performance.now() * 0.001;
      this.cam.position.x += Math.sin(t * 47.3) * s * 0.85;
      this.cam.position.y += Math.sin(t * 61.7) * s * 0.85;
      this.cam.position.z += Math.sin(t * 53.1) * s * 0.85;
    }
    this.cam.lookAt(this.look);
    if (s > 0.0001) this.cam.rotateZ(Math.sin(performance.now() * 0.043) * s * 0.045);
    if (Math.abs(this.cam.fov - this.fov) > 0.01) {
      this.cam.fov = this.fov;
      this.cam.updateProjectionMatrix();
    }
  }

  chase(dt, p) {
    const track = this.track;
    const speedK = Math.min(1, p.speed / p.spec.topSpeed);

    // look a little further down the road the faster she is going
    const ahead = p.t + this.lookAhead * (0.6 + speedK * 1.5);
    const lead = THREE.MathUtils.clamp((p.heading || 0) * 22, -9, 9);
    track.posAt(Math.min(1, ahead), p.lat * 0.55 + lead, 2.4 + p.airY, _look);

    // The rig sits behind her along the track rather than behind her nose,
    // which keeps it stable through the drifts. It does swing a little wide of
    // the corner she is turning into, though, because a camera that never
    // reacts to steering is half of why turning felt like sliding.
    const back = p.t - (this.dist / track.length) * (1 + speedK * 0.22 + p.boostBlend * 0.18);
    const swing = THREE.MathUtils.clamp((p.heading || 0) * 9, -5, 5);
    this.swing = (this.swing || 0) + (swing - (this.swing || 0)) * Math.min(1, 3 * dt);
    track.posAt(Math.max(0, back), p.lat * 0.72 - this.swing, 0, _p);
    track.upAt(Math.max(0, back), _q);
    _p.addScaledVector(_q, this.height + p.airY * 0.85 + p.boostBlend * 0.7);

    // when the camera flips, it sits in front of her looking back down the road
    if (this.reverseBlend > 0.001) {
      const fwd = p.t + (this.dist * 1.9 / track.length);
      track.posAt(Math.min(1, fwd), p.lat * 0.7, 0, _r);
      track.upAt(Math.min(1, fwd), _q);
      _r.addScaledVector(_q, this.height * 1.15 + p.airY * 0.85);
      _p.lerp(_r, this.reverseBlend);

      // aim just past her rather than at the far horizon, so she stays in the
      // middle of the shot with the collapse happening behind her
      const behind = Math.max(0, p.t - 34 / track.length);
      track.posAt(behind, p.lat * 0.7, 2.6, _tmp);
      _look.lerp(_tmp, this.reverseBlend);
    }

    const lag = 1 - Math.pow(1e-7, dt);
    this.pos.lerp(_p, lag);
    this.look.lerp(_look, Math.min(1, 9 * dt));

    const targetFov = this.baseFov + speedK * 10 + p.boostBlend * 14 + (p.abilityActive ? 6 : 0);
    this.fov += (targetFov - this.fov) * Math.min(1, 4 * dt);
  }

  snapTo(pos, look) {
    this.pos.copy(pos); this.look.copy(look);
    this.cam.position.copy(pos); this.cam.lookAt(look);
  }
}

// ---------------------------------------------------------------------------
// Shot helpers. Each returns an object the director can run.
// ---------------------------------------------------------------------------

export function orbitShot(target, radius, height, dur, speed = 0.5, fov = 42) {
  const c = target.clone();
  return {
    dur,
    at(k) {
      const a = k * Math.PI * 2 * speed;
      return {
        pos: new THREE.Vector3(c.x + Math.cos(a) * radius, c.y + height, c.z + Math.sin(a) * radius),
        look: c, fov
      };
    }
  };
}

export function craneShot(from, to, lookFrom, lookTo, dur, fov = 40) {
  return {
    dur,
    at(k) {
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;   // ease in out
      return {
        pos: from.clone().lerp(to, e),
        look: lookFrom.clone().lerp(lookTo, e),
        fov
      };
    }
  };
}

export function trackSideShot(track, t, side, height, dur, fov = 34, follow = null) {
  const base = track.posAt(t, side, height, new THREE.Vector3());
  return {
    dur,
    at() {
      return {
        pos: base,
        look: follow ? follow.worldPos(new THREE.Vector3()) : track.posAt(t + 0.001, 0, 2, new THREE.Vector3()),
        fov
      };
    }
  };
}
