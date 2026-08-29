// ---------------------------------------------------------------------------
// Everything you hear is generated in the browser. Not one audio file, which is
// why the whole game is half a megabyte.
//
// The first version of this was harsh and repetitive. Three things fixed that:
//
//   1. Nothing is a raw sawtooth any more. Every voice goes through a lowpass
//      with a little movement on it, so the top end stops sounding like a
//      buzzer sitting on your ear.
//   2. Every one shot is detuned and re-shaped at random within a range. Two
//      identical impacts never play, which is most of what "repetitive" means.
//   3. The music is eight bars rather than four, has a swing, and each sector
//      picks different voices as well as different chords.
// ---------------------------------------------------------------------------

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const rnd = (a, b) => a + Math.random() * (b - a);

// Eight bar progressions. Longer than you think you need, because four bars
// starts announcing itself after about thirty seconds.
const PROG = {
  arcade: {
    root: 45, bpm: 128, drums: 0.85, bright: 1.0, swing: 0.14,
    lead: 'triangle', pad: 'triangle', bass: 'square',
    chords: [[0,3,7],[5,8,12],[-2,3,7],[3,7,10],[0,3,7],[7,10,14],[5,8,12],[2,5,9]]
  },
  tension: {
    root: 45, bpm: 134, drums: 0.6, bright: 0.65, swing: 0.08,
    lead: 'triangle', pad: 'sine', bass: 'square',
    chords: [[0,3,7],[0,3,8],[-2,2,7],[-2,3,7],[0,3,7],[-4,3,7],[1,5,8],[-2,2,7]]
  },
  dread: {
    root: 38, bpm: 112, drums: 0.28, bright: 0.22, swing: 0.0,
    lead: 'sine', pad: 'sine', bass: 'sine',
    chords: [[0,3,7],[-1,3,6],[0,3,7],[-4,1,5],[0,3,7],[-2,3,6],[-5,0,4],[-1,3,6]]
  },
  boss: {
    root: 41, bpm: 146, drums: 1.05, bright: 0.8, swing: 0.06,
    lead: 'square', pad: 'triangle', bass: 'square',
    chords: [[0,3,7],[0,3,10],[-2,3,7],[1,5,8],[0,3,7],[-3,1,8],[5,8,12],[-2,3,7]]
  },
  win: {
    root: 48, bpm: 118, drums: 0.8, bright: 1.15, swing: 0.18,
    lead: 'triangle', pad: 'triangle', bass: 'sine',
    chords: [[0,4,7],[5,9,12],[-3,4,7],[2,5,9],[0,4,7],[7,11,14],[5,9,12],[-3,2,7]]
  }
};

export class Audio {
  constructor() {
    this.ready = false;
    this.enabled = true;
    this.style = 'arcade';
    this.duck = 1;
    this._lastOneShot = 0;
  }

  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    const ctx = new AC();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.0;

    // a gentle shelf taking the harshness off everything at once
    const tame = ctx.createBiquadFilter();
    tame.type = 'highshelf';
    tame.frequency.value = 3200;
    tame.gain.value = -7;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 26;
    comp.ratio.value = 5;
    comp.attack.value = 0.006;
    comp.release.value = 0.22;

    this.master.connect(tame).connect(comp).connect(ctx.destination);

    this.busEngine = ctx.createGain(); this.busEngine.gain.value = 0.26;
    this.busMusic = ctx.createGain(); this.busMusic.gain.value = 0.26;
    this.busSfx = ctx.createGain(); this.busSfx.gain.value = 0.5;

    // a little reverb on the effects so they sit in a place rather than being
    // dry clicks pasted over the music
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.makeImpulse(1.5, 2.4);
    this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0.22;
    this.busSfx.connect(this.verb).connect(this.verbGain).connect(this.master);

    this.busEngine.connect(this.master);
    this.busMusic.connect(this.master);
    this.busSfx.connect(this.master);

    this.noiseBuf = this.makeNoise(2.2);
    this.buildEngine();

    this.nextNote = ctx.currentTime + 0.15;
    this.step = 0;
    this.ready = true;
    this.master.gain.setTargetAtTime(0.8, ctx.currentTime, 0.6);
    this.timer = setInterval(() => this.tick(), 40);
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  makeNoise(sec) {
    const n = Math.floor(this.ctx.sampleRate * sec);
    const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  makeImpulse(sec, decay) {
    const rate = this.ctx.sampleRate;
    const n = Math.floor(rate * sec);
    const b = this.ctx.createBuffer(2, n, rate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < n; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
      }
    }
    return b;
  }

  // -------------------------------------------------------------------------
  // ENGINE
  // Two soft voices plus air noise, through a moving lowpass. A fake gearbox so
  // the pitch climbs and drops rather than sliding up in one long whine.
  // -------------------------------------------------------------------------
  buildEngine() {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = 0;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 700; filt.Q.value = 1.2;
    g.connect(filt).connect(this.busEngine);

    const oscs = [];
    for (const [type, det, lvl] of [['triangle', 0, 0.55], ['sawtooth', 9, 0.16], ['square', -1200, 0.18]]) {
      const o = ctx.createOscillator();
      o.type = type; o.detune.value = det;
      const og = ctx.createGain(); og.gain.value = lvl;
      o.connect(og).connect(g);
      o.start();
      oscs.push(o);
    }
    const ns = ctx.createBufferSource();
    ns.buffer = this.noiseBuf; ns.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass'; nf.frequency.value = 900; nf.Q.value = 0.7;
    const ng = ctx.createGain(); ng.gain.value = 0.1;
    ns.connect(nf).connect(ng).connect(g);
    ns.start();

    this.engine = { g, filt, oscs, nf, ng };
  }

  setEngine(speed, topSpeed, throttle, rideId) {
    if (!this.ready) return;
    const e = this.engine, now = this.ctx.currentTime;
    const k = Math.min(1.35, speed / topSpeed);

    const gears = 6;
    const gi = Math.min(gears - 1, Math.floor(k * gears * 0.92));
    const within = Math.min(1, (k * gears * 0.92) - gi);
    const base = rideId === 'truck' ? 38 : rideId === 'bike' ? 74 : 54;
    const f = base * (0.78 + within * 0.7) * (1 + gi * 0.10);

    for (const o of e.oscs) o.frequency.setTargetAtTime(f, now, 0.06);
    e.filt.frequency.setTargetAtTime(340 + k * 1500 + throttle * 500, now, 0.09);
    e.g.gain.setTargetAtTime((0.08 + k * 0.24) * this.duck, now, 0.09);
    e.nf.frequency.setTargetAtTime(450 + k * 1800, now, 0.10);
    e.ng.gain.setTargetAtTime(0.03 + k * 0.13, now, 0.10);
  }

  // -------------------------------------------------------------------------
  // ONE SHOTS
  // Everything here randomises pitch and shape a little, which is the whole
  // reason it stops grating after the tenth time you hear it.
  // -------------------------------------------------------------------------
  env(node, peak, attack, decay, when) {
    const t = when || this.ctx.currentTime;
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  // a soft ceiling on how many effects can fire at once, so a pile up does not
  // turn into a wall of noise
  budget() {
    const now = this.ctx ? this.ctx.currentTime : 0;
    if (now - this._lastOneShot < 0.028) return false;
    this._lastOneShot = now;
    return true;
  }

  noise(dur, freq, q, peak, type = 'bandpass', sweep = 0, attack = 0.008) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.playbackRate.value = rnd(0.85, 1.18);
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq * rnd(0.88, 1.14); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    const g = ctx.createGain();
    s.connect(f).connect(g).connect(this.busSfx);
    this.env(g, peak, attack, dur);
    s.start(t); s.stop(t + dur + 0.05);
  }

  tone(freq, dur, peak, type = 'sine', slideTo = 0, attack = 0.01) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq * rnd(0.985, 1.015);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = Math.max(700, freq * 6); f.Q.value = 0.7;
    const g = ctx.createGain();
    o.connect(f).connect(g).connect(this.busSfx);
    this.env(g, peak, attack, dur);
    o.start(t); o.stop(t + dur + 0.05);
  }

  // a short melodic figure, used for anything that should feel like good news
  arp(root, steps, dur = 0.09, peak = 0.22, type = 'triangle') {
    steps.forEach((n, i) => {
      setTimeout(() => this.tone(NOTE(root + n), dur * 2.4, peak, type), i * dur * 1000);
    });
  }

  // ---- driving ----
  impact(strength = 1) {
    if (!this.budget()) return;
    this.noise(0.24 * strength, rnd(300, 520), 0.8, 0.55 * strength, 'lowpass', 0.22, 0.004);
    this.tone(rnd(100, 145), 0.26, 0.38 * strength, 'triangle', 42);
  }
  scrape() {
    if (!this.budget()) return;
    this.noise(0.13, rnd(1800, 2900), 5, 0.10, 'bandpass', 0.85);
  }
  land(force = 1) {
    if (!this.budget()) return;
    this.noise(0.2, rnd(200, 300), 0.9, 0.32 * force, 'lowpass', 0.35, 0.004);
  }
  boostStart() {
    this.noise(0.5, 300, 1.0, 0.32, 'bandpass', 5.5, 0.05);
    this.tone(150, 0.42, 0.22, 'triangle', 720, 0.04);
  }
  ability(kind) {
    if (kind === 'velocity') { this.tone(180, 0.7, 0.30, 'triangle', 1150, 0.03); this.noise(0.7, 420, 1.1, 0.26, 'bandpass', 4.5, 0.05); }
    else if (kind === 'beast') { this.tone(62, 0.85, 0.42, 'triangle', 40, 0.02); this.noise(0.6, 230, 0.7, 0.36, 'lowpass', 0.3, 0.01); }
    else { this.arp(72, [0, 7, 12, 19], 0.06, 0.20, 'sine'); this.noise(0.5, 2800, 5, 0.14, 'bandpass', 0.3, 0.04); }
  }

  // ---- items ----
  pickup() { this.arp(76, [0, 4, 7], 0.055, 0.18, 'triangle'); }
  itemBoost() { this.arp(70, [0, 5, 9, 12], 0.05, 0.20, 'triangle'); this.boostStart(); }
  itemBless() { this.arp(72, [0, 4, 7, 11, 12], 0.075, 0.16, 'sine'); }
  itemDrop() { this.tone(rnd(300, 380), 0.16, 0.20, 'triangle', 150); }
  itemSplat() { this.noise(0.42, 700, 1.1, 0.28, 'lowpass', 0.22, 0.006); }
  itemLaunch() { this.noise(0.5, 500, 1.3, 0.28, 'bandpass', 3.2, 0.02); this.tone(220, 0.4, 0.18, 'triangle', 900, 0.02); }
  itemThread() { this.arp(69, [0, 3, 7, 10], 0.05, 0.16, 'sine'); }
  itemThunder() {
    this.noise(0.9, 900, 0.6, 0.5, 'lowpass', 0.08, 0.003);
    this.tone(70, 0.9, 0.34, 'triangle', 34, 0.004);
    setTimeout(() => this.noise(0.6, 1600, 1.2, 0.22, 'bandpass', 0.2), 90);
  }
  slipBanana(scale = 1) {
    // a comedy slide, not a buzzer
    this.tone(rnd(500, 640), 0.42, 0.22 * scale, 'triangle', rnd(150, 210), 0.02);
    this.noise(0.34, 1500, 3, 0.12 * scale, 'bandpass', 0.35);
  }
  slipSlick() { this.noise(0.55, 900, 1.4, 0.16, 'bandpass', 0.4, 0.04); }

  // ---- race furniture ----
  beep(high) {
    if (high) this.arp(69, [0, 12], 0.08, 0.28, 'triangle');
    else this.tone(NOTE(64), 0.16, 0.24, 'triangle');
  }
  duelIn() { this.arp(57, [0, 7, 12], 0.07, 0.20, 'square'); }
  duelWon() { this.arp(64, [0, 4, 7, 12], 0.06, 0.20, 'triangle'); }
  whoosh(len = 0.7) { this.noise(len, 800, 1.2, 0.24, 'bandpass', 0.16, 0.06); }
  rumble(len = 2.2, peak = 0.7) {
    this.noise(len, 110, 0.5, peak * 0.7, 'lowpass', 0.4, 0.08);
    this.tone(34, len, peak * 0.45, 'sine', 24, 0.1);
  }
  crack() { this.noise(0.45, 800, 0.9, 0.55, 'lowpass', 0.08, 0.003); this.tone(85, 0.45, 0.3, 'triangle', 30); }
  confetti() {
    for (let i = 0; i < 16; i++) {
      setTimeout(() => this.tone(rnd(700, 1900), 0.14, 0.13, 'triangle'), i * 45);
    }
  }
  chime(n = 0) {
    const base = [0, 4, 7, 12, 16, 19][n % 6];
    this.tone(NOTE(72 + base), 1.3, 0.20, 'sine', 0, 0.03);
    this.tone(NOTE(84 + base), 1.6, 0.09, 'sine', 0, 0.04);
  }

  // -------------------------------------------------------------------------
  // MUSIC
  // -------------------------------------------------------------------------
  setStyle(name) { if (PROG[name]) this.style = name; }
  setDuck(v) { this.duck = v; }

  tick() {
    if (!this.ready || !this.enabled) return;
    const ctx = this.ctx;
    const P = PROG[this.style] || PROG.arcade;
    const spb = 60 / P.bpm / 4;
    while (this.nextNote < ctx.currentTime + 0.25) {
      // a touch of swing on the offbeats stops it marching
      const swing = (this.step % 2 === 1) ? spb * P.swing : 0;
      this.playStep(this.step, this.nextNote + swing, P);
      this.nextNote += spb;
      this.step++;
    }
  }

  playStep(step, when, P) {
    const ctx = this.ctx;
    const s = step % 16;
    const bar = Math.floor(step / 16) % 8;          // eight bars, not four
    const chord = P.chords[bar];
    const vol = this.duck;

    const voice = (freq, dur, peak, type, cutoff) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = cutoff || 2400; f.Q.value = 0.6;
      const g = ctx.createGain();
      o.connect(f).connect(g).connect(this.busMusic);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * vol), when + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.start(when); o.stop(when + dur + 0.03);
    };
    const nz = (dur, freq, q, peak, type) => {
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
      src.playbackRate.value = rnd(0.9, 1.1);
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain();
      src.connect(f).connect(g).connect(this.busMusic);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * vol), when + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      src.start(when); src.stop(when + dur + 0.03);
    };

    // bass, with a walk on the last bar of each phrase
    if (s % 4 === 0 || s === 6 || s === 14) {
      const walk = (bar === 7 && s === 14) ? 2 : 0;
      voice(NOTE(P.root - 12 + chord[0] + walk), 0.3, 0.26, P.bass, 700);
    }
    // pad
    if (s === 0) {
      for (const n of chord) voice(NOTE(P.root + n), 1.5, 0.055 * P.bright, P.pad, 1600);
    }
    // arpeggio, sitting out every fourth bar so it has somewhere to go
    if (P.bright > 0.4 && s % 2 === 0 && bar % 4 !== 3) {
      const n = chord[(step / 2) % chord.length];
      voice(NOTE(P.root + 12 + n), 0.20, 0.06 * P.bright, P.lead, 2600);
    }
    if (P.bright > 0.9 && s % 8 === 6) {
      voice(NOTE(P.root + 24 + chord[step % chord.length]), 0.14, 0.035, P.lead, 3200);
    }

    const d = P.drums;
    if (d > 0.2) {
      if (s === 0 || s === 6 || s === 10) { voice(88, 0.18, 0.36 * d, 'sine', 300); nz(0.04, 80, 0.6, 0.16 * d, 'lowpass'); }
      if (s === 4 || s === 12) nz(0.15, 1500, 0.8, 0.20 * d, 'bandpass');
      // hats drop out on the eighth bar, so the loop breathes
      if (d > 0.6 && s % 2 === 1 && bar !== 7) nz(0.03, 7000, 1.2, 0.05 * d, 'highpass');
    }
  }

  stopMusic() { if (this.ready) this.busMusic.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.4); }
  startMusic() { if (this.ready) this.busMusic.gain.setTargetAtTime(0.26, this.ctx.currentTime, 0.5); }
  silence(on) {
    if (!this.ready) return;
    this.master.gain.setTargetAtTime(on ? 0.02 : 0.8, this.ctx.currentTime, on ? 0.25 : 0.5);
  }
}

export const audio = new Audio();
