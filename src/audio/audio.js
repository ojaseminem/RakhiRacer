// ---------------------------------------------------------------------------
// Everything you hear is generated in the browser. There is not a single audio
// file in this project, which is what keeps the whole game a few hundred
// kilobytes and means it loads instantly from a static host.
//
// Three parts: an engine that tracks the throttle, a small library of one shot
// effects, and a music bed that reconfigures itself per sector.
// ---------------------------------------------------------------------------

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

// minor key material. dark enough for the underground, bright enough for the
// city once the drums come in.
const PROG = {
  arcade:  { root: 45, chords: [[0, 3, 7], [5, 8, 12], [-2, 3, 7], [3, 7, 10]], bpm: 132, drums: 1.0, bright: 1 },
  tension: { root: 45, chords: [[0, 3, 7], [0, 3, 8], [-2, 2, 7], [-2, 3, 7]], bpm: 138, drums: 0.7, bright: 0.6 },
  dread:   { root: 38, chords: [[0, 3, 7], [-1, 3, 6], [0, 3, 7], [-4, 1, 5]], bpm: 118, drums: 0.35, bright: 0.2 },
  boss:    { root: 41, chords: [[0, 3, 7], [0, 3, 10], [-2, 3, 7], [1, 5, 8]], bpm: 152, drums: 1.25, bright: 0.85 },
  win:     { root: 48, chords: [[0, 4, 7], [5, 9, 12], [-3, 4, 7], [2, 5, 9]], bpm: 124, drums: 1.0, bright: 1.3 }
};

export class Audio {
  constructor() {
    this.ready = false;
    this.enabled = true;
    this.style = 'arcade';
    this.styleGain = 1;
    this.duck = 1;
  }

  init() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    const ctx = new AC();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 7;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    this.master.connect(comp).connect(ctx.destination);

    this.busEngine = ctx.createGain(); this.busEngine.gain.value = 0.34;
    this.busMusic = ctx.createGain(); this.busMusic.gain.value = 0.30;
    this.busSfx = ctx.createGain(); this.busSfx.gain.value = 0.62;
    this.busEngine.connect(this.master);
    this.busMusic.connect(this.master);
    this.busSfx.connect(this.master);

    this.noiseBuf = this.makeNoise(2.2);
    this.buildEngine();

    this.nextNote = ctx.currentTime + 0.15;
    this.step = 0;
    this.ready = true;
    this.master.gain.setTargetAtTime(0.85, ctx.currentTime, 0.6);
    this.tick = this.tick.bind(this);
    this.timer = setInterval(this.tick, 40);
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  makeNoise(sec) {
    const n = Math.floor(this.ctx.sampleRate * sec);
    const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  // -------------------------------------------------------------------------
  // ENGINE
  // Two detuned saws an octave apart plus a filtered noise layer for the air.
  // Pitch follows a fake gearbox so it climbs and drops rather than sliding up
  // in one long boring ramp.
  // -------------------------------------------------------------------------
  buildEngine() {
    const ctx = this.ctx;
    const g = ctx.createGain(); g.gain.value = 0;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 900; filt.Q.value = 3.5;
    g.connect(filt).connect(this.busEngine);

    const oscs = [];
    for (const [type, det, lvl] of [['sawtooth', 0, 0.5], ['sawtooth', 11, 0.34], ['square', -1200, 0.22]]) {
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
    nf.type = 'bandpass'; nf.frequency.value = 1400; nf.Q.value = 0.9;
    const ng = ctx.createGain(); ng.gain.value = 0.16;
    ns.connect(nf).connect(ng).connect(g);
    ns.start();

    this.engine = { g, filt, oscs, nf, ng, gear: 0 };
  }

  setEngine(speed, topSpeed, throttle, rideId) {
    if (!this.ready) return;
    const e = this.engine, ctx = this.ctx, now = ctx.currentTime;
    const k = Math.min(1.35, speed / topSpeed);

    // six gears, so the pitch sawtooths as she accelerates
    const gears = 6;
    const g = Math.min(gears - 1, Math.floor(k * gears * 0.92));
    const within = Math.min(1, (k * gears * 0.92) - g);
    const base = rideId === 'truck' ? 44 : rideId === 'bike' ? 96 : 68;
    const f = base * (0.72 + within * 0.85) * (1 + g * 0.11);

    for (const o of e.oscs) o.frequency.setTargetAtTime(f, now, 0.05);
    e.filt.frequency.setTargetAtTime(420 + k * 2600 + throttle * 700, now, 0.07);
    e.g.gain.setTargetAtTime((0.10 + k * 0.34) * this.duck, now, 0.08);
    e.nf.frequency.setTargetAtTime(600 + k * 3200, now, 0.09);
    e.ng.gain.setTargetAtTime(0.05 + k * 0.24, now, 0.09);
  }

  // -------------------------------------------------------------------------
  // ONE SHOTS
  // -------------------------------------------------------------------------
  env(node, peak, attack, decay, when) {
    const t = when || this.ctx.currentTime;
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  noise(dur, freq, q, peak, type = 'bandpass', sweep = 0, dest = null) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    const g = ctx.createGain();
    s.connect(f).connect(g).connect(dest || this.busSfx);
    this.env(g, peak, 0.006, dur);
    s.start(t); s.stop(t + dur + 0.05);
  }

  tone(freq, dur, peak, type = 'sine', slideTo = 0, dest = null) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = ctx.createGain();
    o.connect(g).connect(dest || this.busSfx);
    this.env(g, peak, 0.008, dur);
    o.start(t); o.stop(t + dur + 0.05);
  }

  impact(strength = 1) {
    this.noise(0.28 * strength, 420, 0.7, 0.85 * strength, 'lowpass', 0.18);
    this.tone(120, 0.30, 0.55 * strength, 'triangle', 40);
  }
  scrape() { this.noise(0.16, 2600, 4, 0.22, 'bandpass', 0.8); }
  boostStart() {
    this.noise(0.5, 320, 1.1, 0.6, 'bandpass', 6.0);
    this.tone(180, 0.45, 0.4, 'sawtooth', 900);
  }
  ability(kind) {
    if (kind === 'velocity') { this.tone(200, 0.7, 0.6, 'sawtooth', 1400); this.noise(0.7, 500, 1, 0.5, 'bandpass', 5); }
    else if (kind === 'beast') { this.tone(70, 0.8, 0.8, 'square', 44); this.noise(0.6, 260, 0.6, 0.7, 'lowpass', 0.3); }
    else { this.tone(1200, 0.6, 0.45, 'sine', 320); this.noise(0.55, 3400, 6, 0.3, 'bandpass', 0.25); }
  }
  pickup() { this.tone(880, 0.09, 0.4, 'square'); setTimeout(() => this.tone(1320, 0.12, 0.36, 'square'), 70); }
  itemUse() { this.tone(660, 0.16, 0.45, 'sawtooth', 1600); }
  beep(high) { this.tone(high ? 1320 : 660, high ? 0.42 : 0.16, 0.6, 'square'); }
  whoosh(len = 0.7) { this.noise(len, 900, 1.4, 0.5, 'bandpass', 0.14); }
  rumble(len = 2.2, peak = 0.8) {
    this.noise(len, 120, 0.5, peak, 'lowpass', 0.4);
    this.tone(38, len, peak * 0.7, 'sine', 26);
  }
  crack() { this.noise(0.5, 900, 0.8, 0.9, 'lowpass', 0.06); this.tone(90, 0.5, 0.6, 'square', 32); }
  land(force = 1) { this.noise(0.22, 240, 0.8, 0.5 * force, 'lowpass', 0.3); }
  confetti() {
    for (let i = 0; i < 14; i++) {
      setTimeout(() => this.tone(600 + Math.random() * 1600, 0.16, 0.22, 'triangle'), i * 42);
    }
  }
  chime(n = 0) {
    const base = [0, 4, 7, 12, 16, 19][n % 6];
    this.tone(NOTE(72 + base), 1.1, 0.30, 'sine');
    this.tone(NOTE(84 + base), 1.4, 0.14, 'sine');
  }

  // -------------------------------------------------------------------------
  // MUSIC
  // A sixteen step sequencer running off the audio clock. Each sector swaps the
  // progression, the tempo and how much of the drum kit is switched on.
  // -------------------------------------------------------------------------
  setStyle(name) {
    if (!PROG[name] || this.style === name) return;
    this.style = name;
  }

  setDuck(v) { this.duck = v; }

  tick() {
    if (!this.ready || !this.enabled) return;
    const ctx = this.ctx;
    const P = PROG[this.style] || PROG.arcade;
    const spb = 60 / P.bpm / 4;                 // sixteenth notes
    while (this.nextNote < ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextNote, P);
      this.nextNote += spb;
      this.step++;
    }
  }

  playStep(step, when, P) {
    const ctx = this.ctx;
    const s = step % 16;
    const bar = Math.floor(step / 16) % 4;
    const chord = P.chords[bar];
    const vol = this.duck;

    const osc = (freq, dur, peak, type, dest) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
      const g = ctx.createGain();
      o.connect(g).connect(dest || this.busMusic);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * vol), when + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      o.start(when); o.stop(when + dur + 0.03);
      return o;
    };
    const nz = (dur, freq, q, peak, type) => {
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain();
      src.connect(f).connect(g).connect(this.busMusic);
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * vol), when + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      src.start(when); src.stop(when + dur + 0.03);
    };

    // --- bass, on the beat ---
    if (s % 4 === 0 || s === 6 || s === 14) {
      osc(NOTE(P.root - 12 + chord[0]), 0.26, 0.30, 'sawtooth');
    }
    // --- pad, once a bar ---
    if (s === 0) {
      for (const n of chord) osc(NOTE(P.root + n), 0.9, 0.075 * P.bright, 'triangle');
    }
    // --- arpeggio, the thing that makes it feel like a race ---
    if (P.bright > 0.4 && s % 2 === 0) {
      const n = chord[(step / 2) % chord.length];
      osc(NOTE(P.root + 12 + n), 0.14, 0.085 * P.bright, 'square');
    }
    if (P.bright > 0.9 && s % 4 === 2) {
      const n = chord[(step) % chord.length];
      osc(NOTE(P.root + 24 + n), 0.10, 0.05, 'square');
    }
    // --- drums ---
    const d = P.drums;
    if (d > 0.2) {
      if (s === 0 || s === 6 || s === 10) { osc(96, 0.16, 0.5 * d, 'sine'); nz(0.05, 90, 0.6, 0.28 * d, 'lowpass'); }
      if (s === 4 || s === 12) nz(0.16, 1900, 0.9, 0.32 * d, 'bandpass');
      if (d > 0.6 && s % 2 === 1) nz(0.035, 8200, 1.4, 0.10 * d, 'highpass');
    }
  }

  stopMusic() { this.busMusic.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.4); }
  startMusic() { this.busMusic.gain.setTargetAtTime(0.30, this.ctx.currentTime, 0.5); }
  silence(on) {
    if (!this.ready) return;
    this.master.gain.setTargetAtTime(on ? 0.02 : 0.85, this.ctx.currentTime, on ? 0.25 : 0.5);
  }
}

export const audio = new Audio();
