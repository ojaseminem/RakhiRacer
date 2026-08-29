import * as THREE from 'three';
import { FAMILY, ELIMINATIONS } from '../config.js';
import { buildFamilyRide } from '../art/build.js';

// ---------------------------------------------------------------------------
// The family.
//
// Twelve relatives, each with a behaviour rather than a difficulty number. They
// live on the same rail as the player, so keeping track of who is where is a
// matter of comparing two floats. What makes them read as people is the mix of
// three traits: skill sets their pace, chaos decides how often they throw it
// away, and aggro decides how much they come looking for you.
// ---------------------------------------------------------------------------

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _proj = new THREE.Vector3();

export class Relative {
  constructor(track, def, index, baseSpeed) {
    this.track = track;
    this.def = def;
    this.index = index;
    this.baseSpeed = baseSpeed;

    this.t = 0;
    this.lat = 0;
    this.speed = 0;
    this.latVel = 0;
    this.airY = 0;
    this.airVY = 0;

    this.alive = true;
    this.dying = 0;          // counts up while the wreck animation plays
    this.deathKind = null;
    this.spin = new THREE.Vector3();
    this.drift = 0;
    this.lean = 0;
    this.wheelSpin = 0;
    this.stun = 0;
    this.bumpCool = 0;
    this.barkCool = 2 + Math.random() * 6;

    // where on the road this one likes to sit
    this.role = 'pack';     // pack | ahead | duel
    this.beaten = false;
    this.dropTimer = 0;     // when this one drops something behind it
    this.lane = (Math.random() * 2 - 1) * 0.62;
    this.laneTimer = 0;
    this.wobble = Math.random() * 100;

    this.group = buildFamilyRide(def.ride, def.color, def.accent);
    this.group.userData.relative = this;
  }

  // -------------------------------------------------------------------------
  update(dt, player, ctx) {
    const track = this.track;
    const d = this.def;

    if (!this.alive) { this.updateWreck(dt); return; }

    this.bumpCool = Math.max(0, this.bumpCool - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.barkCool -= dt;

    const half = track.halfAt(this.t);

    // ---- pace ----
    // The band is deliberately strong. A relative that falls two hundred metres
    // behind is a relative you will never see again, and a race you are alone in
    // is not a race. Everyone is pulled back toward the player, and the current
    // duel opponent is pulled hardest of all.
    const gap = (player.t - this.t) * track.length;      // positive: player is ahead
    let band = 1;
    if (this.role === 'duel') {
      // hold a fighting distance. ahead of her when she is behind, right on her
      // shoulder when she is ahead, and never so far either way that she loses
      // sight of who she is racing.
      const want = this.beaten ? -90 : (gap > 0 ? -22 : 30);
      const err = (want - gap);
      band = 1 + THREE.MathUtils.clamp(err / 180, -0.45, 0.55);
    } else if (this.role === 'ahead') {
      band = 1 + THREE.MathUtils.clamp((gap - 90) / 900, -0.18, 0.30);
    } else {
      // strong, and not capped so tightly that a big gap can never close
      if (gap > 25) band = 1 + Math.min(0.50, gap / 420);
      else if (gap < -25) band = 1 - Math.min(0.52, -gap / 380);
    }

    let target = this.baseSpeed * (0.84 + d.skill * 0.24) * band;
    if (this.stun > 0) target *= 0.4;

    // corners slow them, more so if they are not very good
    const curve = Math.abs(track.curveAt(this.t));
    target *= 1 - Math.min(0.32, curve * (1.4 - d.skill));

    this.speed += (target - this.speed) * Math.min(1, (this.role === 'duel' ? 3.0 : 2.2) * dt);

    // ---- line ----
    this.laneTimer -= dt;
    if (this.laneTimer <= 0) {
      this.laneTimer = 1.6 + Math.random() * 3.4;
      this.lane = (Math.random() * 2 - 1) * (0.30 + d.chaos * 0.55);
    }
    let wantLat = this.lane * half;

    // the aggressive ones drift toward the player when they are close
    const dt2 = Math.abs(gap);
    const aggro = this.role === 'duel' ? Math.max(d.aggro, 0.7) : d.aggro;
    if (aggro > 0.3 && dt2 < 34) {
      // block the line she wants rather than just sitting in a lane
      wantLat = wantLat * (1 - aggro) + player.lat * aggro;
    }

    // keep off each other
    if (ctx && ctx.pack) {
      for (const o of ctx.pack) {
        if (o === this || !o.alive) continue;
        const dg = (o.t - this.t) * track.length;
        if (Math.abs(dg) < 9) {
          const dl = o.lat - this.lat;
          if (Math.abs(dl) < 4.2) wantLat -= Math.sign(dl || 1) * 5.0;
        }
      }
    }

    // the chaotic ones just do things
    this.wobble += dt * (0.7 + d.chaos * 2.2);
    wantLat += Math.sin(this.wobble) * half * 0.22 * d.chaos;

    wantLat = THREE.MathUtils.clamp(wantLat, -half * 0.94, half * 0.94);
    const steer = (wantLat - this.lat) * 0.9;
    this.latVel += (steer - this.latVel) * Math.min(1, 4.5 * dt);
    this.lat += this.latVel * dt;

    // ---- progress ----
    this.t += (this.speed * dt) / track.length;

    // A soft leash. Beyond four hundred metres nobody is on screen anyway, and
    // a relative that has genuinely vanished up the road is a relative she will
    // never race again. Drift them back rather than let the gap run away.
    const LEASH = 420 / track.length;
    const rel = this.t - player.t;
    if (rel > LEASH) this.t -= (rel - LEASH) * Math.min(1, 0.5 * dt);
    else if (rel < -LEASH) this.t -= (rel + LEASH) * Math.min(1, 0.5 * dt);

    if (this.t > 1) this.t = 1;

    // ---- visuals ----
    this.drift += (THREE.MathUtils.clamp(-this.latVel / 16, -0.5, 0.5) - this.drift) * Math.min(1, 7 * dt);
    this.lean += (THREE.MathUtils.clamp(-this.latVel / 30, -0.2, 0.2) - this.lean) * Math.min(1, 5 * dt);
    this.wheelSpin += this.speed * dt * 1.6;

    if (this.airY > 0 || this.airVY !== 0) {
      this.airVY -= 62 * dt;
      this.airY = Math.max(0, this.airY + this.airVY * dt);
      if (this.airY === 0) this.airVY = 0;
    }

    this.applyTransform();
  }

  applyTransform() {
    const t = this.track, g = this.group;
    t.posAt(this.t, this.lat, 0.3 + this.airY, g.position);
    t.tanAt(this.t, _v);
    t.upAt(this.t, _v2);
    _v3.crossVectors(_v2, _v).normalize();
    _v2.crossVectors(_v, _v3).normalize();
    _m.makeBasis(_v3, _v2, _v);
    g.quaternion.setFromRotationMatrix(_m);
    _e.set(0, this.drift * 0.5, -this.lean, 'YXZ');
    _q.setFromEuler(_e);
    g.quaternion.multiply(_q);

    const ws = g.userData.wheels || [];
    for (let i = 0; i < ws.length; i++) {
      ws[i].rotation.x = -this.wheelSpin / (ws[i].userData.radius || 0.5);
      if (i < 2) ws[i].rotation.y = this.drift * 0.5;
    }
  }

  // -------------------------------------------------------------------------
  // Wrecks. Nobody explodes into pieces, they just go somewhere they should
  // not be, at a speed they should not be doing, with the wheels still turning.
  // -------------------------------------------------------------------------
  kill(kind = 'fall', impulse = null) {
    if (!this.alive) return;
    this.alive = false;
    this.dying = 0;
    this.deathKind = kind;
    this.spin.set(
      (Math.random() * 2 - 1) * 4.5,
      (Math.random() * 2 - 1) * 3.2,
      (Math.random() * 2 - 1) * 5.0
    );
    this.deathVel = impulse ? impulse.clone() : new THREE.Vector3(
      (Math.random() * 2 - 1) * 14, kind === 'fall' ? 6 : 22, this.speed * 0.4
    );
    // freeze the world position and animate from there
    this.deathPos = this.group.position.clone();
    this.deathQuat = this.group.quaternion.clone();
  }

  updateWreck(dt) {
    this.dying += dt;
    const g = this.group;
    if (this.dying > 9) { g.visible = false; return; }
    this.deathVel.y -= 34 * dt;
    this.deathPos.addScaledVector(this.deathVel, dt);
    g.position.copy(this.deathPos);
    _e.set(this.spin.x * this.dying, this.spin.y * this.dying, this.spin.z * this.dying);
    g.quaternion.setFromEuler(_e);
    this.wheelSpin += dt * 30;
    const ws = g.userData.wheels || [];
    for (const w of ws) w.rotation.x = -this.wheelSpin / (w.userData.radius || 0.5);
  }

  worldPos(out = new THREE.Vector3()) { return out.copy(this.group.position); }

  pickBark() {
    const b = this.def.barks;
    if (!b || !b.length) return null;
    return b[Math.floor(Math.random() * b.length)];
  }
}

// ---------------------------------------------------------------------------
// The pack. Owns the twelve of them, the running order, the nameplates and the
// scripted eliminations.
// ---------------------------------------------------------------------------
export class Pack {
  constructor(scene, track, baseSpeed) {
    this.track = track;
    this.scene = scene;
    this.racers = FAMILY.map((def, i) => {
      const r = new Relative(track, def, i, baseSpeed);
      scene.add(r.group);
      return r;
    });
    this.byId = {};
    for (const r of this.racers) this.byId[r.def.id] = r;
    this.pending = ELIMINATIONS.map(e => ({ ...e, done: false }));
    this.eliminated = [];
    this.rival = this.byId.chachu;

    // She beats them one at a time, weakest first, so the race escalates and
    // Chachu is genuinely the last and hardest thing between her and Mom.
    this.ladder = [...this.racers].sort((a, b) => a.def.skill - b.def.skill);
    this.duel = null;
    this.duelLead = 0;
  }

  reset(gridSpread = 1) {
    // a staggered grid, best qualifiers at the front, sister at the back
    this.racers.forEach((r, i) => {
      const row = Math.floor(i / 3), col = (i % 3) - 1;
      r.t = (0.0018 + row * 0.00052) * gridSpread;
      r.lat = col * 7.8 + (Math.random() * 2 - 1) * 1.1;
      r.speed = 0;
      r.latVel = 0;
      r.alive = true;
      r.dying = 0;
      r.group.visible = true;
      r.airY = 0; r.airVY = 0;
      r.applyTransform();
    });
    this.pending.forEach(p => { p.done = false; });
    this.eliminated = [];
    this.racers.forEach(r => { r.role = 'pack'; r.beaten = false; });
    this.duel = null;
    this.duelLead = 0;
  }

  // -------------------------------------------------------------------------
  // Duels. One relative at a time is the one she is actually racing. They hold
  // a fighting distance, block her line and taunt. Hold a clear lead over them
  // for a few seconds and they concede, and the next one up steps in.
  // -------------------------------------------------------------------------
  updateDuel(dt, player, hooks) {
    const L = this.track.length;

    if (!this.duel || !this.duel.alive || this.duel.beaten) {
      const next = this.ladder.find(r => r.alive && !r.beaten);
      if (next && next !== this.duel) {
        if (this.duel) this.duel.role = 'pack';
        this.duel = next;
        this.duel.role = 'duel';
        this.duelLead = 0;
        this.duelTime = 0;
        if (hooks.onDuelStart) hooks.onDuelStart(next);
      } else if (!next) {
        this.duel = null;
      }
    }

    // everyone else: the three nearest ahead run interference, the rest pack up
    const ahead = this.racers
      .filter(r => r.alive && r !== this.duel && r.t > player.t)
      .sort((a, b) => a.t - b.t);
    for (const r of this.racers) if (r !== this.duel) r.role = 'pack';
    for (let i = 0; i < Math.min(3, ahead.length); i++) ahead[i].role = 'ahead';

    if (!this.duel) return;
    this.duelTime = (this.duelTime || 0) + dt;

    // Chachu is the scripted rival and goes down in the underground, so he
    // holds the duel to the end rather than being ticked off like the others.
    if (this.duel.def.rival) return;

    // A minimum time on each one. Without it a good driver flushes the whole
    // family inside ninety seconds and the rest of the race is empty road.
    const gap = (player.t - this.duel.t) * L;      // positive: she is ahead
    if (gap > 50 && this.duelTime > 34) {
      this.duelLead += dt;
      if (this.duelLead > 5.0) {
        this.duel.beaten = true;
        this.duel.role = 'pack';
        if (hooks.onDuelWon) hooks.onDuelWon(this.duel);
        this.duel = null;
      }
    } else {
      this.duelLead = Math.max(0, this.duelLead - dt * 2);
    }
  }

  update(dt, player, hooks = {}) {
    this.updateDuel(dt, player, hooks);
    const ctx = { pack: this.racers };
    for (const r of this.racers) r.update(dt, player, ctx);

    // ---- contact with the player ----
    for (const r of this.racers) {
      if (!r.alive) continue;
      const gap = (r.t - player.t) * this.track.length;
      if (Math.abs(gap) > 5.2) continue;
      const dl = r.lat - player.lat;
      if (Math.abs(dl) > 4.0) continue;
      if (r.bumpCool > 0) continue;
      r.bumpCool = 0.6;

      const heavy = player.spec.id === 'beast' || player.abilityActive;
      const phasing = player.spec.id === 'comet' && player.abilityActive;
      if (phasing) continue;

      if (heavy) {
        // she goes through them
        r.latVel += Math.sign(dl || 1) * 34;
        r.stun = 0.8;
        r.speed *= 0.6;
        player.punts++;
        if (player.spec.id === 'beast' && player.abilityActive) {
          r.airVY = 16;
          r.airY = 0.1;
          if (!r.def.unpushable && hooks.onPunt) hooks.onPunt(r, true);
        } else if (hooks.onPunt) hooks.onPunt(r, false);
      } else {
        player.hit(0.8, -Math.sign(dl || 1));
        r.latVel -= Math.sign(dl || 1) * 12;
        if (hooks.onBump) hooks.onBump(r);
      }
      if (r.barkCool <= 0 && hooks.onBark) { hooks.onBark(r, r.pickBark()); r.barkCool = 5; }
    }

    // ---- they fight back ----
    // A relative just ahead of her will occasionally leave something on the
    // road. It is the difference between overtaking and merely passing.
    for (const r of this.racers) {
      if (!r.alive) continue;
      r.dropTimer -= dt;
      const gap = (r.t - player.t) * this.track.length;
      if (gap < 8 || gap > 220) continue;
      if (r.dropTimer > 0) continue;
      const chance = (r.role === 'duel' ? 0.55 : 0.16) * r.def.aggro;
      if (Math.random() > chance * dt * 6) continue;
      r.dropTimer = 6 + Math.random() * 8;
      if (hooks.onRelativeDrop) hooks.onRelativeDrop(r);
    }

    // ---- idle chatter ----
    for (const r of this.racers) {
      if (!r.alive || r.barkCool > 0) continue;
      const gap = Math.abs((r.t - player.t) * this.track.length);
      if (gap < 60 && Math.random() < dt * 0.5) {
        if (hooks.onBark) hooks.onBark(r, r.pickBark());
        r.barkCool = 7 + Math.random() * 9;
      }
    }

    // ---- scripted eliminations ----
    for (const e of this.pending) {
      if (e.done || player.t < e.at) continue;
      e.done = true;
      const r = this.byId[e.id];
      if (!r || !r.alive) continue;
      if (e.survives) {
        if (hooks.onSurvive) hooks.onSurvive(r, e);
        continue;
      }
      r.kill(e.where === 'highway' || e.where === 'underground' ? 'fall' : 'smash');
      this.eliminated.push(r);
      if (hooks.onEliminate) hooks.onEliminate(r, e);
    }
  }

  // running order, one indexed, with the player folded in
  positionOf(player) {
    let ahead = 0;
    for (const r of this.racers) if (r.alive && r.t > player.t) ahead++;
    return ahead + 1;
  }

  aliveCount() { return this.racers.filter(r => r.alive).length + 1; }

  // ---- nameplates -------------------------------------------------------
  // A DOM label pinned above each nearby relative. Cheaper and far crisper than
  // rendering text in the scene, and it lets the type match the rest of the UI.
  buildPlates(layer) {
    this.plates = this.racers.map(r => {
      const el = document.createElement('div');
      el.className = 'plate';
      el.textContent = r.def.title;
      el.style.setProperty('--pc', '#' + r.def.color.toString(16).padStart(6, '0'));
      if (r.def.rival) el.classList.add('rival');
      layer.appendChild(el);
      return el;
    });
  }

  updatePlates(camera, w, h, player) {
    if (!this.plates) return;
    for (let i = 0; i < this.racers.length; i++) {
      const r = this.racers[i], el = this.plates[i];
      if (!r.alive && r.dying > 3) { el.style.display = 'none'; continue; }
      _proj.copy(r.group.position);
      _proj.y += r.group.userData.height ? r.group.userData.height + 1.4 : 3.0;
      const d = _proj.distanceTo(camera.position);
      _proj.project(camera);
      if (_proj.z > 1 || d > 190 || d < 3) { el.style.display = 'none'; continue; }
      el.style.display = 'block';
      el.style.left = ((_proj.x * 0.5 + 0.5) * w) + 'px';
      el.style.top = ((-_proj.y * 0.5 + 0.5) * h) + 'px';
      const s = THREE.MathUtils.clamp(1.25 - d / 190, 0.42, 1);
      el.style.transform = `translate(-50%, -100%) scale(${s.toFixed(3)})`;
      el.style.opacity = THREE.MathUtils.clamp(1.15 - d / 170, 0, 1).toFixed(2);
    }
  }
}
