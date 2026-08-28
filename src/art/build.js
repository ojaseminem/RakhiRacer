import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeToon, makeGlow, addOutline } from './materials.js';
import { getModel } from './assets.js';

// ---------------------------------------------------------------------------
// Every object in this game is built out of code. No model files, nothing to
// download. The rule that holds the look together: no sharp edges anywhere and
// nothing is ever the size it would be in real life. Wheels are too fat, cabins
// are too small, and everything is slightly inflated.
// ---------------------------------------------------------------------------

const GEO = new Map();
function cache(key, make) {
  let g = GEO.get(key);
  if (!g) { g = make(); GEO.set(key, g); }
  return g;
}

export function rbox(w, h, d, r = Math.min(w, h, d) * 0.34, seg = 3) {
  return cache(`rb${w}|${h}|${d}|${r}|${seg}`,
    () => new RoundedBoxGeometry(w, h, d, seg, r));
}
const sph = (r, s = 12) => cache(`sp${r}|${s}`, () => new THREE.SphereGeometry(r, s, Math.max(6, s >> 1)));
const cyl = (rt, rb, h, s = 14) => cache(`cy${rt}|${rb}|${h}|${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const cap = (r, l, s = 10) => cache(`cp${r}|${l}|${s}`, () => new THREE.CapsuleGeometry(r, l, 4, s));
const tor = (r, t, s = 14) => cache(`to${r}|${t}|${s}`, () => new THREE.TorusGeometry(r, t, 8, s));

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------------------
// Wheels. Deliberately overinflated: a fat black tyre with a coloured hub and,
// for the hero rides, a glowing inner ring.
// ---------------------------------------------------------------------------
function wheel(radius, width, hubColor, glowColor) {
  const g = new THREE.Group();
  const tyre = mesh(cyl(radius, radius, width, 16), matTyre());
  tyre.rotation.z = Math.PI / 2;
  g.add(tyre);

  // shoulder bulge so the tyre is not a flat cylinder
  for (const s of [-1, 1]) {
    const sh = mesh(tor(radius * 0.92, radius * 0.20, 14), matTyre(), s * width * 0.42, 0, 0);
    sh.rotation.y = Math.PI / 2;
    g.add(sh);
  }
  const hub = mesh(cyl(radius * 0.56, radius * 0.56, width * 1.06, 12), matHub(hubColor));
  hub.rotation.z = Math.PI / 2;
  g.add(hub);

  if (glowColor !== undefined) {
    const ring = new THREE.Mesh(tor(radius * 0.72, radius * 0.09, 18), makeGlow(glowColor, 0.60));
    ring.rotation.y = Math.PI / 2;
    g.add(ring);
    g.userData.glowRing = ring;
  }
  g.userData.radius = radius;
  return g;
}

const MATS = new Map();
function sharedToon(key, opts) {
  let m = MATS.get(key);
  if (!m) { m = makeToon(opts); MATS.set(key, m); }
  return m;
}
const matTyre = () => sharedToon('tyre', { color: 0x24202c, rim: 0x8a7fb0, rimStrength: 0.45, rimPower: 3.0 });
const matHub = (c) => sharedToon('hub' + c, { color: c, rim: 0xffffff, rimStrength: 0.7 });
const matGlass = () => sharedToon('glass', {
  color: 0x1a2a3a, rim: 0xcaf0ff, rimStrength: 1.5, rimPower: 1.7,
  transparent: true, opacity: 0.86
});
const matDark = () => sharedToon('dark', { color: 0x2a2434, rim: 0x9a8fc0, rimStrength: 0.5 });
const matChrome = () => sharedToon('chr', { color: 0xd8d2e8, rim: 0xffffff, rimStrength: 0.9 });

// ---------------------------------------------------------------------------
// The bean. Fall Guys proportions: mostly torso, tiny limbs, big head, no neck.
// Used for the driver in every vehicle and for the two avatars at the end.
// ---------------------------------------------------------------------------
export function bean(bodyColor, accentColor = 0xffffff, scale = 1) {
  const g = new THREE.Group();
  const skin = sharedToon('bean' + bodyColor, {
    color: bodyColor, rim: 0xffffff, rimStrength: 0.8, rimPower: 2.0, bounceStrength: 0.4
  });
  const trim = sharedToon('bean2' + accentColor, { color: accentColor, rim: 0xffffff, rimStrength: 0.9 });

  const body = mesh(cap(0.46, 0.52, 12), skin, 0, 0.62, 0);
  g.add(body);
  // face plate
  const face = mesh(sph(0.30, 14), matDark(), 0, 0.92, 0.30);
  face.scale.set(1.1, 0.78, 0.4);
  g.add(face);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(sph(0.075, 10), makeGlow(0xffffff, 1, false));
    eye.position.set(s * 0.13, 0.95, 0.44);
    g.add(eye);
    // stubby arms
    const arm = mesh(cap(0.13, 0.16, 8), skin, s * 0.46, 0.60, 0.02);
    arm.rotation.z = s * 0.5;
    g.add(arm);
    // stubby legs
    const leg = mesh(cap(0.15, 0.10, 8), trim, s * 0.20, 0.14, 0);
    g.add(leg);
  }
  const collar = mesh(cyl(0.40, 0.44, 0.14, 14), trim, 0, 0.34, 0);
  g.add(collar);
  g.scale.setScalar(scale);
  g.userData.body = body;
  return g;
}

// ---------------------------------------------------------------------------
// THE THREE HERO RIDES
// ---------------------------------------------------------------------------

// If a drop-in model exists for this slot, use it and skip the built in one.
// Anything in the file whose name looks like a wheel still gets spun.
function fromDropIn(slot, spec) {
  const m = getModel(slot);
  if (!m) return null;
  const wheels = [];
  m.traverse((o) => {
    if (!o.isMesh && !o.isGroup) return;
    const n = (o.name || '').toLowerCase();
    if (/wheel|tyre|tire|rim/.test(n) && !o.userData.noOutline) {
      o.userData.radius = 0.5;
      wheels.push(o);
    }
  });
  m.userData.wheels = wheels;
  m.userData.glows = [];
  m.userData.spec = spec;
  m.userData.dropIn = true;
  return m;
}

function heroWrap(build) {
  return (spec) => {
    const dropIn = fromDropIn(spec.id, spec);
    if (dropIn) return dropIn;
    const g = new THREE.Group();
    const wheels = [];
    const glows = [];
    build(g, spec, wheels, glows);
    g.userData.wheels = wheels;
    g.userData.glows = glows;
    g.userData.spec = spec;
    // an inverted hull outline. this is the single thing that stops a stylised
    // vehicle dissolving into whatever colour is behind it.
    addOutline(g, 0.045);
    return g;
  };
}

// VELOCITY. Low, long, wedge nosed, enormous rear wing. Reads fast standing still.
export const buildVelocity = heroWrap((g, spec, wheels, glows) => {
  const body = sharedToon('v-body' + spec.body, {
    color: spec.body, rim: 0xffd0c0, rimStrength: 0.95, rimPower: 2.0, bounceStrength: 0.35
  });
  const acc = sharedToon('v-acc' + spec.accent, { color: spec.accent, rim: 0xffffff, rimStrength: 0.8 });

  // main tub, tapered by scaling a rounded box
  const tub = mesh(rbox(2.0, 0.72, 4.6, 0.34), body, 0, 0.72, 0);
  g.add(tub);
  const nose = mesh(rbox(1.7, 0.44, 1.9, 0.20), body, 0, 0.60, 2.55);
  nose.scale.set(1, 1, 1);
  g.add(nose);
  // splitter
  const split = mesh(rbox(2.2, 0.12, 0.9, 0.05), acc, 0, 0.34, 3.15);
  g.add(split);
  // cockpit bubble
  const cab = mesh(rbox(1.36, 0.62, 1.7, 0.30), matGlass(), 0, 1.24, -0.15);
  g.add(cab);
  // haunches over the rear wheels
  for (const s of [-1, 1]) {
    const h = mesh(rbox(0.62, 0.66, 2.0, 0.28), body, s * 1.02, 0.86, -1.15);
    g.add(h);
    const sidepod = mesh(rbox(0.42, 0.34, 1.5, 0.16), acc, s * 1.12, 0.66, 0.65);
    g.add(sidepod);
  }
  // rear wing
  const wingPost = mesh(rbox(0.16, 0.6, 0.2, 0.06), acc, 0, 1.30, -2.5);
  g.add(wingPost);
  const wing = mesh(rbox(2.5, 0.13, 0.72, 0.06), acc, 0, 1.66, -2.6);
  wing.rotation.x = -0.16;
  g.add(wing);
  for (const s of [-1, 1]) {
    const ep = mesh(rbox(0.1, 0.42, 0.72, 0.05), body, s * 1.24, 1.60, -2.6);
    g.add(ep);
  }
  // exhaust glow
  for (const s of [-1, 1]) {
    const ex = new THREE.Mesh(cyl(0.20, 0.24, 0.18, 12), makeGlow(spec.glow, 0.95));
    ex.rotation.x = Math.PI / 2;
    ex.position.set(s * 0.42, 0.78, -2.62);
    g.add(ex); glows.push(ex);
  }
  // headlights
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(rbox(0.5, 0.12, 0.1, 0.04), makeGlow(0xfff4d0, 0.9));
    hl.position.set(s * 0.55, 0.70, 3.42);
    g.add(hl);
  }
  const d = bean(0xffd9a8, spec.accent, 0.62);
  d.position.set(0, 0.95, -0.15);
  g.add(d);

  for (const [x, z, r] of [[-1.02, 1.68, 0.52], [1.02, 1.68, 0.52], [-1.08, -1.35, 0.62], [1.08, -1.35, 0.62]]) {
    const w = wheel(r, 0.44, spec.accent);
    w.position.set(x, r, z);
    g.add(w); wheels.push(w);
  }
});

// THE BEAST. Comically oversized. The cab is far too small for the tyres.
export const buildBeast = heroWrap((g, spec, wheels, glows) => {
  const body = sharedToon('b-body' + spec.body, {
    color: spec.body, rim: 0xfff0c0, rimStrength: 0.85, rimPower: 2.2, bounceStrength: 0.4
  });
  const acc = sharedToon('b-acc' + spec.accent, { color: spec.accent, rim: 0xffffff, rimStrength: 0.8 });

  const chassis = mesh(rbox(2.5, 0.5, 4.6, 0.22), matDark(), 0, 1.30, 0);
  g.add(chassis);
  const tub = mesh(rbox(2.7, 1.25, 3.4, 0.45), body, 0, 2.10, -0.35);
  g.add(tub);
  const cab = mesh(rbox(2.0, 0.95, 1.5, 0.36), matGlass(), 0, 2.95, 0.25);
  g.add(cab);
  const hood = mesh(rbox(2.5, 0.7, 1.5, 0.30), body, 0, 2.05, 1.75);
  g.add(hood);
  // bull bar, the business end
  const bar = mesh(rbox(3.0, 0.34, 0.32, 0.15), acc, 0, 1.60, 2.75);
  g.add(bar);
  for (const s of [-1, 1]) {
    const tooth = mesh(rbox(0.26, 1.1, 0.28, 0.12), acc, s * 1.05, 2.00, 2.72);
    g.add(tooth);
  }
  const grille = mesh(rbox(2.2, 0.7, 0.2, 0.08), matDark(), 0, 2.05, 2.55);
  g.add(grille);
  // roof lights
  for (let i = 0; i < 4; i++) {
    const l = new THREE.Mesh(sph(0.16, 10), makeGlow(0xfff0b0, 0.95));
    l.position.set(-0.75 + i * 0.5, 3.52, 0.15);
    g.add(l); glows.push(l);
  }
  // exhaust stacks
  for (const s of [-1, 1]) {
    const st = mesh(cyl(0.16, 0.19, 1.8, 10), matChrome(), s * 1.25, 2.85, -0.9);
    g.add(st);
    const puff = new THREE.Mesh(sph(0.18, 8), makeGlow(spec.glow, 0.8));
    puff.position.set(s * 1.25, 3.78, -0.9);
    g.add(puff); glows.push(puff);
  }
  const d = bean(0xffd9a8, spec.accent, 0.7);
  d.position.set(0, 2.45, 0.25);
  g.add(d);

  for (const [x, z] of [[-1.42, 1.55], [1.42, 1.55], [-1.42, -1.5], [1.42, -1.5]]) {
    const w = wheel(1.30, 0.95, spec.accent);
    w.position.set(x, 1.30, z);
    g.add(w); wheels.push(w);
  }
});

// THE COMET. Long, low, hovering. Two glowing wheels that never touch anything.
export const buildComet = heroWrap((g, spec, wheels, glows) => {
  const body = sharedToon('c-body' + spec.body, {
    color: spec.body, rim: 0xd0faff, rimStrength: 1.15, rimPower: 1.9, bounceStrength: 0.35
  });
  const acc = sharedToon('c-acc' + spec.accent, { color: spec.accent, rim: 0xffffff, rimStrength: 1.0 });

  const spine = mesh(rbox(0.66, 0.52, 4.5, 0.26), body, 0, 1.10, 0);
  g.add(spine);
  const tank = mesh(cap(0.42, 1.5, 12), body, 0, 1.34, 0.35);
  tank.rotation.x = Math.PI / 2;
  g.add(tank);
  // long front fairing
  const fair = mesh(rbox(0.72, 0.62, 1.9, 0.30), acc, 0, 1.18, 1.95);
  g.add(fair);
  const screen = mesh(rbox(0.5, 0.4, 0.5, 0.2), matGlass(), 0, 1.55, 2.35);
  screen.rotation.x = -0.4;
  g.add(screen);
  // tail
  const tail = mesh(rbox(0.5, 0.36, 1.4, 0.18), body, 0, 1.30, -2.0);
  tail.rotation.x = 0.16;
  g.add(tail);
  // side winglets, this is what gives it the silhouette
  for (const s of [-1, 1]) {
    const wl = mesh(rbox(0.9, 0.1, 1.6, 0.05), acc, s * 0.68, 1.05, -0.5);
    wl.rotation.z = s * 0.22;
    g.add(wl);
    const strip = new THREE.Mesh(rbox(0.86, 0.05, 1.3, 0.02), makeGlow(spec.glow, 0.55));
    strip.position.set(s * 0.70, 1.11, -0.5);
    strip.rotation.z = s * 0.22;
    g.add(strip); glows.push(strip);
  }
  // thruster
  const th = new THREE.Mesh(cyl(0.30, 0.34, 0.2, 14), makeGlow(spec.glow, 0.75));
  th.rotation.x = Math.PI / 2;
  th.position.set(0, 1.24, -2.62);
  g.add(th); glows.push(th);
  // underglow slab, sells the hover
  const ug = new THREE.Mesh(rbox(1.1, 0.06, 3.6, 0.03), makeGlow(spec.glow, 0.28));
  ug.position.set(0, 0.42, 0);
  g.add(ug); glows.push(ug);

  const d = bean(0xffd9a8, spec.accent, 0.66);
  d.position.set(0, 1.32, -0.35);
  d.rotation.x = 0.22;
  g.add(d);
  const helm = mesh(sph(0.34, 14), matGlass(), 0, 1.94, -0.22);
  g.add(helm);

  for (const [z, r] of [[1.85, 0.66], [-1.55, 0.72]]) {
    const w = wheel(r, 0.34, spec.accent, spec.glow);
    w.position.set(0, r + 0.10, z);
    g.add(w); wheels.push(w);
  }
});

export const HERO_BUILDERS = { velocity: buildVelocity, beast: buildBeast, comet: buildComet };

// ---------------------------------------------------------------------------
// THE FAMILY
// Eight silhouettes, each instantly readable at a distance. Built from one
// parametric chassis so they stay a family, then pushed around hard so no two
// look alike.
// ---------------------------------------------------------------------------
const RIDE_SHAPES = {
  //          w    h    len  cabW  cabH  cabZ  wheelR  wheelW  ride  extras
  sports:   { w:1.9, h:0.62, l:4.2, cw:1.3, ch:0.55, cz:-0.3, wr:0.50, ww:0.40, ry:0.52, spoiler:1 },
  sedan:    { w:1.9, h:0.90, l:4.4, cw:1.6, ch:0.78, cz:-0.1, wr:0.52, ww:0.38, ry:0.60 },
  suv:      { w:2.2, h:1.35, l:4.8, cw:1.9, ch:1.05, cz:-0.1, wr:0.68, ww:0.48, ry:0.86, roofrack:1 },
  hatch:    { w:1.7, h:0.95, l:3.2, cw:1.45, ch:0.85, cz:-0.25, wr:0.46, ww:0.34, ry:0.56 },
  auto:     { w:1.5, h:1.15, l:2.7, cw:1.35, ch:1.0, cz:-0.1, wr:0.42, ww:0.30, ry:0.52, three:1, canopy:1 },
  ambassador:{ w:2.0, h:1.10, l:4.4, cw:1.7, ch:0.85, cz:-0.15, wr:0.54, ww:0.40, ry:0.68, round:1 },
  oldcar:   { w:1.6, h:1.05, l:3.0, cw:1.35, ch:0.9, cz:-0.05, wr:0.44, ww:0.32, ry:0.58, round:1 },
  jeep:     { w:2.0, h:1.05, l:3.9, cw:1.8, ch:0.5, cz:-0.2, wr:0.62, ww:0.46, ry:0.76, open:1 }
};

export function buildFamilyRide(rideId, color, accent) {
  const dropIn = fromDropIn(rideId, null);
  if (dropIn) {
    dropIn.userData.height = 2.2;
    return dropIn;
  }
  const s = RIDE_SHAPES[rideId] || RIDE_SHAPES.sedan;
  const g = new THREE.Group();
  const wheels = [];
  const body = sharedToon('f' + color, {
    color, rim: 0xffffff, rimStrength: 0.8, rimPower: 2.2, bounceStrength: 0.35
  });
  const acc = sharedToon('fa' + accent, { color: accent, rim: 0xffffff, rimStrength: 0.7 });

  const hull = mesh(rbox(s.w, s.h, s.l, s.round ? Math.min(s.w, s.h) * 0.45 : 0.28), body, 0, s.ry, 0);
  g.add(hull);
  if (!s.open) {
    const cab = mesh(rbox(s.cw, s.ch, s.l * 0.46, 0.26), matGlass(), 0, s.ry + s.h * 0.5 + s.ch * 0.42, s.cz);
    g.add(cab);
  } else {
    // roll cage
    for (const sx of [-1, 1]) {
      const bar = mesh(rbox(0.1, 1.0, 0.1, 0.04), matDark(), sx * s.cw * 0.5, s.ry + s.h * 0.5 + 0.5, s.cz);
      g.add(bar);
    }
    const top = mesh(rbox(s.cw + 0.1, 0.1, 0.12, 0.04), matDark(), 0, s.ry + s.h * 0.5 + 1.0, s.cz);
    g.add(top);
  }
  if (s.canopy) {
    const c = mesh(rbox(s.w + 0.1, 0.22, s.l * 0.8, 0.1), acc, 0, s.ry + s.h * 0.5 + s.ch * 0.9, -0.1);
    g.add(c);
  }
  if (s.roofrack) {
    const r = mesh(rbox(s.cw * 0.85, 0.16, s.l * 0.34, 0.07), acc, 0, s.ry + s.h * 0.5 + s.ch + 0.12, s.cz);
    g.add(r);
    // luggage, because of course there is luggage
    for (let i = 0; i < 3; i++) {
      const bag = mesh(rbox(0.5, 0.32, 0.5, 0.12), acc, -0.45 + i * 0.45, s.ry + s.h * 0.5 + s.ch + 0.34, s.cz);
      bag.rotation.y = Math.random() * 0.4;
      g.add(bag);
    }
  }
  if (s.spoiler) {
    const sp = mesh(rbox(s.w * 0.95, 0.09, 0.5, 0.04), acc, 0, s.ry + s.h * 0.7 + 0.3, -s.l * 0.46);
    g.add(sp);
  }
  // bumpers and lights
  for (const zz of [1, -1]) {
    const b = mesh(rbox(s.w * 0.98, 0.2, 0.22, 0.09), acc, 0, s.ry - s.h * 0.28, zz * s.l * 0.49);
    g.add(b);
  }
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(sph(0.15, 8), makeGlow(0xfff2c8, 0.9));
    hl.position.set(sx * s.w * 0.32, s.ry + s.h * 0.12, s.l * 0.48);
    g.add(hl);
    const tl = new THREE.Mesh(sph(0.13, 8), makeGlow(0xff3a4a, 0.9));
    tl.position.set(sx * s.w * 0.32, s.ry + s.h * 0.12, -s.l * 0.48);
    g.add(tl);
  }

  const d = bean(0xffd9a8, accent, 0.55);
  d.position.set(0, s.ry + s.h * 0.4, s.cz + 0.1);
  g.add(d);

  const zf = s.l * 0.34, zr = -s.l * 0.34;
  const spots = s.three
    ? [[0, zf, s.wr], [-s.w * 0.44, zr, s.wr], [s.w * 0.44, zr, s.wr]]
    : [[-s.w * 0.5, zf, s.wr], [s.w * 0.5, zf, s.wr], [-s.w * 0.5, zr, s.wr], [s.w * 0.5, zr, s.wr]];
  for (const [x, z, r] of spots) {
    const w = wheel(r, s.ww, accent);
    w.position.set(x, r, z);
    g.add(w); wheels.push(w);
  }

  g.userData.wheels = wheels;
  g.userData.height = s.ry + s.h;
  addOutline(g, 0.05);
  return g;
}
