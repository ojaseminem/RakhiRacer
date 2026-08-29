import * as THREE from 'three';
import { SECTORS, VEHICLES, RANKS, TRACK, sectorAt } from '../config.js';
import { Vehicle } from './vehicle.js';
import { Pack } from './ai.js';
import { ItemField } from './items.js';
import { Boss } from './boss.js';
import { makeGlow, makeToon } from '../art/materials.js';
import { audio } from '../audio/audio.js';

// ---------------------------------------------------------------------------
// The race.
//
// Owns the run from the lights going out to the rakhi. Everything cinematic is
// a beat: a normalised distance along the track and a function that fires once
// when she passes it. That keeps the whole eleven minute structure readable in
// one list instead of buried in a state machine.
// ---------------------------------------------------------------------------

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();


// The feed reads best when the colour is the person's own colour, so a glance
// tells you who without reading the name.
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

const GLYPH = { banana: 'B', slick: 'G', bazooka: 'Z', bonk: 'K', thread: 'T', thunder: '!' };
const VERB  = { banana: 'spun out', slick: 'slid off line', bazooka: 'chappal-ed',
                bonk: 'bonked', thread: 'tangled', thunder: 'shaken' };

export class Race {
  constructor(ctx) {
    Object.assign(this, ctx);   // scene, track, camera, director, hud, vfx, post, env
    this.state = 'idle';
    this.time = 0;
    this.raceTime = 0;
    this.player = null;
    this.pack = new Pack(this.scene, this.track, 92);
    this.pack.buildPlates(document.getElementById('namelayer'));
    this.items = new ItemField(this.scene, this.track, this.vfx, audio, this.camera);
    this.boss = new Boss(this.scene, this.track, this.vfx, audio);
    this.beats = [];
    this.reverse = false;
    this.desat = 0;
    this.finishBuilt = false;
    this.buildFinishLine();
    this.buildReveal();
  }

  // -------------------------------------------------------------------------
  buildFinishLine() {
    const g = new THREE.Group();
    const tr = this.track;
    const white = makeToon({ color: 0xfff6ea, rim: 0xffffff, rimStrength: 0.9 });
    const dark = makeToon({ color: 0x1a1024, rim: 0xffc93d, rimStrength: 1.0 });
    // two pylons and a banner
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.0, 46, 12), dark);
      post.position.set(s * 30, 23, 0);
      g.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(66, 9, 5), dark);
    beam.position.y = 44;
    g.add(beam);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(58, 6.5), makeGlow(0xffc93d, 0.95, false));
    banner.position.set(0, 44, 2.8);
    g.add(banner);
    // chequer on the road
    const chk = new THREE.Group();
    for (let i = 0; i < 24; i++) {
      for (let j = 0; j < 3; j++) {
        if ((i + j) % 2) continue;
        const q = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), white);
        q.rotation.x = -Math.PI / 2;
        q.position.set(-26 + i * 2.2, 0.4, -2.2 + j * 2.2);
        chk.add(q);
      }
    }
    g.add(chk);
    g.visible = false;
    this.scene.add(g);
    this.finishGate = g;
  }

  placeFinish(t) {
    const tr = this.track;
    tr.posAt(t, 0, 0, this.finishGate.position);
    tr.tanAt(t, _v); tr.upAt(t, _v2);
    _v3.crossVectors(_v2, _v).normalize();
    _v2.crossVectors(_v, _v3).normalize();
    this.finishGate.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(_v3, _v2, _v));
    this.finishGate.visible = true;
  }

  // A wide glowing copy of the racing line, hidden until the very end. From
  // thirty thousand feet the road itself is a hair, so the reveal needs its own
  // geometry or the whole joke does not land.
  buildReveal() {
    const tr = this.track;
    const N = tr.samples, STRIDE = 4;
    const rows = Math.floor(N / STRIDE) + 1;
    const pos = new Float32Array(rows * 2 * 3);
    const col = new Float32Array(rows * 2 * 3);
    const c = new THREE.Color(), p = new THREE.Vector3();
    // Gold along the threads, deep violet through the heart. The colour change
    // is what makes the middle read as a separate thing rather than more rope.
    const GOLD = new THREE.Color(0xffc24a);
    const VIOLET = new THREE.Color(0xa855ff);
    const PINK = new THREE.Color(0xff3d8a);
    for (let r = 0; r < rows; r++) {
      const i = Math.min(N, r * STRIDE);
      const t = i / N;
      const inHeart = THREE.MathUtils.smoothstep(t, 0.26, 0.33)
                    * (1 - THREE.MathUtils.smoothstep(t, 0.80, 0.87));
      c.copy(GOLD).lerp(VIOLET, inHeart);
      c.lerp(PINK, inHeart * 0.35 * (0.5 + 0.5 * Math.sin(i * 0.02)));
      for (let k = 0; k < 2; k++) {
        p.copy(tr.pts[i]).addScaledVector(tr.nrm[i], (k ? 1 : -1) * 165);
        const o = (r * 2 + k) * 3;
        pos[o] = p.x; pos[o + 1] = p.y + 6; pos[o + 2] = p.z;
        col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
      }
    }
    const idx = [];
    for (let r = 0; r < rows - 1; r++) {
      const a = r * 2, b = a + 1, d = a + 2, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0,
      toneMapped: false, fog: false, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    m.visible = false;
    m.frustumCulled = false;
    this.scene.add(m);
    this.revealMesh = m;

    // A soft violet glow filling the heart, so the middle of the rakhi has a
    // colour of its own rather than being empty ground with a line round it.
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(2400, 48),
      new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: false, toneMapped: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uOpacity: { value: 0 } },
        vertexShader: 'varying vec2 vP; void main(){ vP = position.xy / 2400.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `
          varying vec2 vP; uniform float uOpacity;
          void main() {
            float d = length(vP);
            float a = pow(max(0.0, 1.0 - d), 2.2);
            vec3 c = mix(vec3(1.0, 0.36, 0.62), vec3(0.55, 0.28, 1.0), smoothstep(0.0, 0.9, d));
            gl_FragColor = vec4(c * a, a * uOpacity);
          }`
      }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(0, -140, -180);
    glow.visible = false;
    glow.frustumCulled = false;
    this.scene.add(glow);
    this.heartGlow = glow;
  }

  // -------------------------------------------------------------------------
  begin(vehicleId, mode = 'story') {
    if (this.player) this.scene.remove(this.player.group);
    const spec = VEHICLES.find(v => v.id === vehicleId) || VEHICLES[0];
    this.spec = spec;
    this.mode = mode;
    this.player = new Vehicle(this.track, spec);
    this.scene.add(this.player.group);
    this.director.configure(spec);
    this.hud.setVehicle(spec);
    this.hud.clearFeed();
    this.hud.setItem(null);

    this.player.t = 0.0002;
    this.player.assist = mode === 'time' ? 0.55 : 1;
    this.pack.reset();
    // drag means she never reaches the quoted top speed, so pace the family
    // against what she actually does or they simply drive away from her
    this.pack.racers.forEach(r => { r.baseSpeed = spec.topSpeed * 0.80; });
    this.boss.clear();
    this.boss.defeated = false;
    this.items.reset();
    this.items.layout([
      [0.020, 0.185, 0.016],
      [0.200, 0.262, 0.018],
      [0.330, 0.515, 0.017],
      [0.530, 0.690, 0.018],
      [0.880, 0.985, 0.020]
    ]);
    this.revealMesh.visible = false;
    this.revealMesh.material.opacity = 0;
    this.finishGate.visible = false;
    this.placeFinish(0.9955);

    this.raceTime = 0;
    this.time = 0;
    this.reverse = false;
    this.desat = 0;
    this.director.setReverse(false);
    this.buildBeats();
    this.state = mode === 'boss' ? 'bossintro' : 'countdown';
    this.countdown = 3.9;
    this.lastSector = null;

    if (mode === 'boss') {
      this.player.t = 0.878;
      this.player.speed = spec.topSpeed * 0.7;
      this.state = 'racing';
      this.startBoss();
    }
    if (mode === 'time') {
      this.beats = this.beats.filter(b => b.keep);
    }

    const wp = this.player.worldPos(new THREE.Vector3());
    this.director.snapTo(
      wp.clone().addScaledVector(this.track.tanAt(this.player.t), -16).add(new THREE.Vector3(0, 6, 0)), wp);
    audio.setStyle('arcade');
  }

  // -------------------------------------------------------------------------
  // The beats. Read top to bottom, this is the film.
  // -------------------------------------------------------------------------
  buildBeats() {
    const H = this.hud, D = this.director, P = this.post;
    const say = (t, s, d) => H.say(t, d);
    this.beats = [
      { at: 0.0500, keep: 0, go: () => H.shout('GO!') },

      // ---- SECTOR 2, the gap ----
      { at: 0.2050, keep: 0, go: () => { H.say('The road runs out ahead.', 3.0); audio.setStyle('tension'); } },
      { at: 0.2600, keep: 0, go: () => { H.shout('JUMP!'); audio.whoosh(1.2); } },
      {
        at: TRACK.gap.from - 0.0016, keep: 1, go: () => {
          this.player.launch(46 + this.player.speed * 0.06);
          D.addShake(0.5);
          audio.boostStart();
          this.vfx.dust(this.player.group.position, 26, 0xffffff, 8);
        }
      },
      {
        // the cutaway. we leave her mid air and go and watch the family fail.
        at: TRACK.gap.to + 0.0035, keep: 0, go: () => {
          this.cutawayToBack(0.2520, 5.2, 'NOT EVERYONE MAKES IT');
        }
      },

      // ---- SECTOR 3, the forest ----
      { at: 0.4260, keep: 0, go: () => { H.shout('BOULDER!'); audio.rumble(2.0, 1.0); D.addShake(0.7); } },

      // ---- SECTOR 4, the fork ----
      {
        at: TRACK.fork.from - 0.006, keep: 0, go: () => {
          H.say('Left is safe. Right is shorter.', 3.4);
        }
      },

      // ---- SECTOR 5, the underground ----
      { at: 0.7020, keep: 0, go: () => { audio.setStyle('dread'); H.say('Something is wrong with the floor.', 3.2); } },
      { at: 0.7180, keep: 0, go: () => { audio.crack(); D.addShake(0.9); H.flash('#000', 0.5, 500); } },

      // THE MOMENT
      {
        at: 0.7280, keep: 0, go: () => {
          audio.silence(true);
          audio.stopMusic();
          this.reverse = true;
          D.setReverse(true);
          D.freeze(0.22);
          H.flash('#fff', 0.9, 900);
          setTimeout(() => { H.chapter('LOOK BEHIND YOU', 'THE WORLD IS ENDING', 3.4); }, 700);
          setTimeout(() => { audio.silence(false); audio.startMusic(); }, 2600);
        }
      },
      { at: 0.8560, keep: 0, go: () => { this.reverse = false; D.setReverse(false); H.flash('#fff', 0.7, 700); } },

      // ---- SECTOR 6, Mom ----
      {
        at: 0.8720, keep: 0, go: () => {
          audio.setStyle('boss');
          this.startBoss();
        }
      },

      { at: 0.9900, keep: 1, go: () => { this.finishRun(); } }
    ];

    // every elimination gets a card. the underground ones get the camera too.
    this.beatIndex = 0;
    this.beats.sort((a, b) => a.at - b.at);
  }

  // -------------------------------------------------------------------------
  cutawayToBack(t, dur, caption) {
    const tr = this.track;
    const D = this.director, H = this.hud;
    const from = tr.posAt(t, 120, 90, new THREE.Vector3());
    const to = tr.posAt(t, 30, 25, new THREE.Vector3());
    const look = tr.posAt(t + 0.004, 0, 6, new THREE.Vector3());
    D.play({
      dur,
      at(k) {
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        return { pos: from.clone().lerp(to, e), look, fov: 40 - e * 6, snap: k < 0.02 };
      },
      onEnd: () => { H.skippable(false); }
    });
    H.skippable(true);
    if (caption) H.say(caption, dur * 0.7);
  }

  startBoss() {
    const H = this.hud, D = this.director;
    this.boss.start(this.player.t);
    this.boss.onSlam = () => { D.addShake(1.0); };
    H.chapter('FINAL SECTOR', 'THE ARENA', 2.6);
    setTimeout(() => {
      H.shout('MOM');
      audio.rumble(3.0, 1.2);
      D.addShake(1.5);
      H.flash('#ff2f6b', 0.5, 700);
    }, 2400);
    setTimeout(() => H.say('MOM HAS ENTERED THE RACE.', 3.4), 3800);
  }

  finishRun() {
    if (this.state === 'finish') return;
    this.state = 'finish';
    const H = this.hud, D = this.director;
    audio.setStyle('win');
    audio.confetti();
    D.freeze(0.4);
    D.addShake(0.8);
    H.shout('FINISH');
    const p = this.player.worldPos(new THREE.Vector3());
    this.vfx.confetti(p, 260, 40);
    this.player.assist = 1;
    this.finishTimer = 0;
  }

  // -------------------------------------------------------------------------
  update(dt, input) {
    this.time += dt;
    const P = this.player;
    if (!P) return;
    const tr = this.track;
    const H = this.hud, D = this.director;

    // ---- countdown ----
    if (this.state === 'countdown') {
      // the opening cinematic holds the lights on red until it is done
      if (!this.holdCountdown) {
        const prev = Math.ceil(this.countdown);
        this.countdown -= dt;
        const now = Math.ceil(this.countdown);
        if (now !== prev && now >= 0) {
          if (now > 0) { H.shout(String(now), 0.9); audio.beep(false); }
          else { H.shout('GO!', 1.2); audio.beep(true); D.addShake(0.5); }
        }
        if (this.countdown <= 0) this.state = 'racing';
      }
      // everyone revs on the spot
      this.pack.update(dt * 0.15, P, {});
      P.update(dt, { steer: 0, steerRaw: 0, throttle: 0, brake: 1, boost: false }, { speedCap: 0 });
      D.update(dt, P);
      return;
    }

    const racing = this.state === 'racing' || this.state === 'finish';
    if (!racing) { D.update(dt, P); return; }

    // ---- driving ----
    P.update(dt, input, {
      onScrape: () => { D.addShake(0.10); audio.scrape(); },
      onLand: (v) => {
        D.addShake(0.35 + Math.min(0.6, v.speed * 0.006));
        audio.land(1);
        this.vfx.dust(v.group.position, 14, 0xffffff, 5);
      }
    });

    if (input.abilityEdge && P.useAbility()) {
      D.addShake(0.4); D.freeze(0.06);
      audio.ability(P.spec.id);
      H.shout(P.spec.ability.name.split(' ')[0], 1.0);
    }
    if (input.itemEdge) {
      this.items.use(P, this.pack, H, {
        onUse: (it) => H.shout(it.name.split(' ')[0], 0.9)
      });
    }

    // ---- the family ----
    this.pack.update(dt, P, {
      onPunt: (r, big) => {
        audio.impact(big ? 1.4 : 0.9);
        D.addShake(big ? 0.7 : 0.35);
        D.freeze(big ? 0.07 : 0.03);
        this.vfx.burst(r.group.position, big ? 30 : 14, r.def.color);
        if (big) H.shout('PUNTED', 0.9);
        H.event(big ? '!' : '>', r.def.title, big ? 'punted off the line by you' : 'shoved aside by you', hex(r.def.color));
      },
      onBump: (r) => {
        audio.impact(0.7); D.addShake(0.3);
        this.vfx.sparks(r.group.position, 10, 0xffd23d);
        H.event('>', r.def.title, 'traded paint with you', hex(r.def.color));
      },
      onBark: (r, text) => this.showBark(r, text),
      onDuelStart: (r) => {
        H.duel(r.def.title, '#' + r.def.color.toString(16).padStart(6, '0'), r.def.note);
        audio.duelIn();
      },
      onDuelWon: (r) => {
        H.duelWon(r.def.title, hex(r.def.color));
        audio.duelWon();
        this.showBark(r, 'ARRE!');
        H.event('V', r.def.title, 'beaten, you are past', hex(r.def.color));
      },
      onRelativeDrop: (r) => {
        // whatever they leave behind is a real hazard she has to steer around
        const kind = Math.random() > 0.45 ? 'banana' : 'slick';
        this.items.dropFrom(r, kind);
        H.event('B', r.def.title, kind === 'banana' ? 'dropped a banana peel' : 'spilled ghee on the road', hex(r.def.color));
      },
      onEliminate: (r, e) => this.onEliminate(r, e),
      onSurvive: (r, e) => {
        H.card(r.def.title, e.how, 3.0);
        audio.chime(2);
        H.event('O', r.def.title, e.how, hex(r.def.color));
      }
    });

    // ---- items ----
    const pos = this.pack.positionOf(P);
    this.items.update(dt, P, H, {
      position: pos, total: this.pack.aliveCount(),
      onPickup: (it) => { H.itemHint(it); }
    });
    this.items.step(dt, P, this.pack, {
      onHitRelative: (r, kind, blame) => {
        D.addShake(0.4);
        H.shout(kind === 'banana' ? 'SLIP' : kind === 'bonk' ? 'BONK' : 'HIT', 0.8);
        this.showBark(r, 'AREY!');
        const by = blame === 'player' ? 'you' : (blame || 'somebody');
        H.event(GLYPH[kind] || '!', r.def.title, `${VERB[kind] || 'hit'} by ${by}`, hex(r.def.color));
      },
      onPlayerSlip: (kind, blame) => {
        D.addShake(0.8);
        H.flash(kind === 'banana' ? '#ffd23d' : '#ffe08a', 0.35, 380);
        H.shout(kind === 'banana' ? 'SLIP!' : 'SLIDING!', 1.0);
        H.event(GLYPH[kind] || '!', 'YOU', `${VERB[kind] || 'hit'} by ${blame || 'the road'}`, '#ff2f6b');
      },
      onThunder: (n) => {
        H.shout('THUNDER', 1.2); D.addShake(1.1); H.flash('#8f6aff', 0.5, 500);
        H.event('!', 'THUNDER CLAP', `${n} of them spun out`, '#8f6aff');
      }
    });

    // ---- the boss ----
    if (this.boss.active) {
      this.boss.update(dt, P, {
        onPhase: (n) => {
          if (n === 2) { H.chapter('PHASE TWO', 'FIGHT BACK', 2.4); H.say(P.spec.bossPlay, 4.0); }
          if (n === 3) { H.chapter('PHASE THREE', 'NO TRACK LEFT', 2.4); D.addShake(1.4); audio.rumble(3, 1.2); }
        },
        onShake: (a) => D.addShake(a),
        onPlayerHurt: () => { D.addShake(0.7); D.freeze(0.05); audio.impact(1.2); H.flash('#ff2f6b', 0.4, 300); },
        onHitBoss: () => { D.addShake(0.5); H.shout('HIT', 0.6); }
      });
      this.boss.onDefeat = () => {
        H.shout('GO GO GO');
        H.say('She is right behind you. Do not look back.', 3.4);
        D.addShake(1.8);
        audio.rumble(3.5, 1.3);
        this.boss.lead = 220;
      };
    }

    // ---- the reverse sequence ----
    const wantDesat = this.reverse ? 0.62 : 0;
    this.desat += (wantDesat - this.desat) * Math.min(1, 1.2 * dt);

    // ---- beats ----
    while (this.beatIndex < this.beats.length && P.t >= this.beats[this.beatIndex].at) {
      const b = this.beats[this.beatIndex++];
      try { b.go(); } catch (err) { console.warn('beat failed', err); }
    }

    // ---- chapter cards on sector entry ----
    const sec = sectorAt(P.t);
    if (sec !== this.lastSector) {
      if (this.lastSector) H.chapter(sec.kicker, sec.name, 3.0);
      this.lastSector = sec;
      audio.setStyle(sec.music);
    }

    // ---- boost and drift particles ----
    this.emitDriveVfx(dt);

    // ---- audio ----
    audio.setEngine(P.speed, P.spec.topSpeed, P.boosting ? 1 : 0.5, P.spec.ride);

    // ---- timers and hud ----
    this.raceTime += dt;
    H.update(P, this.raceTime, sec);
    H.setPosition(this.pack.positionOf(P), this.pack.aliveCount());

    D.update(dt, P);

    if (this.state === 'finish') {
      this.finishTimer += dt;
      P.extMul = Math.max(0.05, P.extMul - dt * 0.55);
      if (this.finishTimer > 3.4 && !this.resultsShown) {
        this.resultsShown = true;
        if (this.onFinished) this.onFinished(this.results());
      }
    }
  }

  emitDriveVfx(dt) {
    const P = this.player;
    if (!P) return;
    const p = P.group.position;
    const spec = P.spec;

    // boost ribbon out of the back
    if (P.boostBlend > 0.12) {
      const back = new THREE.Vector3();
      this.track.tanAt(P.t, back).multiplyScalar(-14 - P.speed * 0.1);
      for (let i = 0; i < 2; i++) {
        this.vfx.trail(p, back, spec.trail, 0.6 + P.boostBlend * 0.9);
      }
    }
    // drift sparks when the back end steps out
    if (Math.abs(P.latVel) > 13 && !P.airborne) {
      this.vfx.sparks(p, 2, spec.glow, 5, 3.5);
    }
    if (P.offroad > 0.2 && !P.airborne) {
      this.vfx.dust(p, 1, 0xc0b0a0, 3);
    }
    if (P.abilityActive) {
      this.vfx.sparks(p, 2, spec.glow, 4, 5);
    }
  }

  showBark(r, text) {
    if (!text) return;
    const v = r.group.position.clone();
    v.y += 4;
    v.project(this.camera);
    if (v.z > 1) return;
    const x = (v.x * 0.5 + 0.5) * innerWidth;
    const y = (-v.y * 0.5 + 0.5) * innerHeight;
    if (x < 40 || x > innerWidth - 40 || y < 60 || y > innerHeight - 100) return;
    this.hud.bark(text, x, y, '#' + r.def.color.toString(16).padStart(6, '0'));
  }

  onEliminate(r, e) {
    const H = this.hud, D = this.director;
    H.card(r.def.title, e.how, 3.2);
    audio.impact(1.2);
    audio.rumble(1.6, 0.7);
    D.addShake(0.55);
    this.vfx.debris(r.group.position, 26, r.def.color, 20);
    this.vfx.dust(r.group.position, 18, 0xffffff, 8);
    H.event('X', r.def.title, e.how, hex(r.def.color));

    if (e.rival) {
      setTimeout(() => {
        H.say('CHACHU: "YOU BETTER WIN THIS."', 4.2);
        audio.chime(4);
      }, 1400);
    }

    // the underground eliminations get a short cut to the falling vehicle
    if (e.where === 'underground' && this.reverse) {
      const target = r;
      const D2 = this.director;
      const startPos = r.group.position.clone();
      D2.play({
        dur: 2.2,
        at: (k) => ({
          pos: startPos.clone().add(new THREE.Vector3(26, 16 - k * 14, 26)),
          look: target.group.position.clone(),
          fov: 44
        })
      });
    }
  }

  // -------------------------------------------------------------------------
  results() {
    const P = this.player;
    const t = this.raceTime;
    let rank = 'C';
    for (const r of RANKS) { if (t <= r.t) { rank = r.r; break; } }
    if (P.hits > 22 && rank === 'S') rank = 'A';
    return {
      rank,
      time: t,
      punts: P.punts,
      topSpeed: Math.round(P.maxSpeed * 3.6),
      clean: Math.round(100 * P.cleanTime / Math.max(1, P.totalTime)),
      vehicle: P.spec.id
    };
  }

  // -------------------------------------------------------------------------
  // The flyback. The camera leaves her at the finish line and does not stop
  // until the whole race is one shape.
  // -------------------------------------------------------------------------
  playReveal(onDone) {
    const D = this.director, tr = this.track;
    this.state = 'reveal';
    this.revealMesh.visible = true;
    this.heartGlow.visible = true;
    audio.setStyle('win');

    // straight up first, then out over the knot. going diagonally would fly the
    // camera through half the forest on the way.
    const p0 = this.player.worldPos(new THREE.Vector3()).add(new THREE.Vector3(0, 10, -34));
    const p1 = p0.clone().setY(1950);
    const p2 = new THREE.Vector3(-1462, 8400, 3450);
    const look0 = this.player.worldPos(new THREE.Vector3());
    const look1 = p0.clone().setY(0);
    const centre = new THREE.Vector3(-1462, -225, -45);

    const mesh = this.revealMesh;
    const glow = this.heartGlow;
    const post = this.post;

    D.play({
      dur: 15.0,
      at(k) {
        const pos = new THREE.Vector3();
        const look = new THREE.Vector3();
        let fov;
        if (k < 0.22) {
          const e = THREE.MathUtils.smoothstep(k, 0, 0.22);
          pos.lerpVectors(p0, p1, e * e);
          look.lerpVectors(look0, look1, e);
          fov = 58;
        } else if (k < 0.72) {
          const e = THREE.MathUtils.smoothstep(k, 0.22, 0.72);
          pos.lerpVectors(p1, p2, e * e * (3 - 2 * e));
          look.lerpVectors(look1, centre, e);
          fov = 58 - e * 6;
        } else {
          // hold on the shape and turn very slowly
          const e = (k - 0.72) / 0.28;
          const a = e * 0.22;
          // orbit the shape slowly around its own centre
          const dx = p2.x - centre.x, dz = p2.z - centre.z;
          pos.set(
            centre.x + dx * Math.cos(a) - dz * Math.sin(a),
            p2.y,
            centre.z + dx * Math.sin(a) + dz * Math.cos(a)
          );
          look.copy(centre);
          fov = 52;
        }
        mesh.material.opacity = THREE.MathUtils.smoothstep(k, 0.20, 0.55) * 1.0;
        glow.material.uniforms.uOpacity.value = THREE.MathUtils.smoothstep(k, 0.38, 0.78) * 0.85;
        post.u.uVignette.value = 0.55 + THREE.MathUtils.smoothstep(k, 0.3, 1) * 0.22;
        return { pos, look, fov, snap: k < 0.015 };
      },
      onEnd: () => { if (onDone) onDone(); }
    });

    this.revealFade = 0;
  }

  updateReveal(dt) {
    if (this.state !== 'reveal') return;
    this.revealFade = Math.min(1, (this.revealFade || 0) + dt / 3.2);
    // the fog has to get out of the way entirely or the far end of the rakhi
    // never resolves
    this.env.fog.near = 900 + this.revealFade * 120000;
    this.env.fog.far = 6000 + this.revealFade * 240000;
    const sk = this.env.sky.material.uniforms;
    sk.uTop.value.setHex(0x0d0718);
    sk.uMid.value.setHex(0x241540);
    sk.uBot.value.setHex(0x3a2050);
  }
}
