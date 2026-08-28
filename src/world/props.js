import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SECTORS, sectorAt } from '../config.js';
import { makeToon, makeGlow } from '../art/materials.js';

// ---------------------------------------------------------------------------
// Everything that is not the road.
//
// All instanced, so thirty kilometres of city, forest, canyon, tunnel and arena
// costs about fifteen draw calls. The rules that keep it from reading as a pile
// of primitives:
//
//   - nothing is one box. every tower is a stack of three or four setbacks with
//     clutter on the roof, so the skyline has a silhouette
//   - windows are drawn in the building shader from world position, so they are
//     free and every tower gets thousands of them
//   - rocks and canopies are flat shaded low poly solids, never smooth spheres
//   - something crosses overhead every few hundred metres. gantries and arches
//     sell speed better than any amount of motion blur
// ---------------------------------------------------------------------------

let seed = 1337;
function rnd() { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return seed / 0x7fffffff; }
const rr = (a, b) => a + rnd() * (b - a);
const pick = (arr) => arr[Math.floor(rnd() * arr.length) % arr.length];
const shadeHex = (hex, mul) =>
  (Math.min(255, Math.round((hex >> 16 & 255) * mul)) << 16) |
  (Math.min(255, Math.round((hex >> 8 & 255) * mul)) << 8) |
  Math.min(255, Math.round((hex & 255) * mul));

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
const _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();

function inst(geo, mat, count, scene, shadow = true) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.castShadow = shadow;
  m.receiveShadow = true;
  m.count = 0;
  m.frustumCulled = false;
  scene.add(m);
  m.userData.colors = new Float32Array(count * 3);
  m.instanceColor = new THREE.InstancedBufferAttribute(m.userData.colors, 3);
  return m;
}

function put(im, pos, rot, scale, color) {
  if (im.count >= im.instanceMatrix.count) return;
  _e.set(rot[0], rot[1], rot[2]);
  _q.setFromEuler(_e);
  _s.set(scale[0], scale[1], scale[2]);
  _m.compose(pos, _q, _s);
  im.setMatrixAt(im.count, _m);
  if (color !== undefined) {
    _c.setHex(color);
    im.userData.colors[im.count * 3] = _c.r;
    im.userData.colors[im.count * 3 + 1] = _c.g;
    im.userData.colors[im.count * 3 + 2] = _c.b;
  }
  im.count++;
}

// Muted enough that the vehicles stay the most saturated thing on screen, but
// still unmistakably a candy city.
const CITY_WALL = [
  0xd4718f, 0x5fa8c4, 0xe0b04e, 0x7f74bd, 0x4fa882,
  0xd98a52, 0xe6dccb, 0x3f8fb0, 0xc9d16a, 0xb85f7e,
  0x9dc4d8, 0xe8a878
];
const CITY_TRIM = [0xffd9e8, 0xfff0d0, 0xd8f4ff, 0xffe0c0];
const FOREST_LEAF = [
  0x2f7a45, 0x3f9455, 0x1f5230, 0x4fa860, 0x74bf6a,
  0x1a4430, 0x8fbf52, 0xb8973a, 0xc06f38, 0x3d7d6a
];
const NEON = [0x27e0d0, 0xff3d7a, 0xffd23d, 0x6a8fff, 0xb44aff, 0xff7a3d];

export function buildWorld(scene, track) {
  seed = 1337;
  const N = track.samples;
  const W = {};

  // ---- geometry ----
  const gBox = new RoundedBoxGeometry(1, 1, 1, 2, 0.10);
  const gBoxSharp = new THREE.BoxGeometry(1, 1, 1);
  const gCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
  const gCone = new THREE.ConeGeometry(0.5, 1, 7);            // faceted on purpose
  const gRock = new THREE.IcosahedronGeometry(0.5, 0);        // hard facets, not a ball
  const gSphere = new THREE.SphereGeometry(0.5, 10, 7);
  const gCap = new THREE.CapsuleGeometry(0.34, 0.5, 3, 7);

  // ---- materials ----
  const mWall = makeToon({
    rim: 0xffffff, rimStrength: 0.42, rimPower: 3.4, bounceStrength: 0.30,
    noise: 0.13, noiseScale: 0.06,
    windows: 0.80, winSize: [3.6, 4.6], winColor: 0xfff0c0, winDark: 0x54658c, winLit: 0.14
  });
  const mTrim = makeToon({ rim: 0xffffff, rimStrength: 0.55, rimPower: 3.0, noise: 0.08 });
  const mRock = makeToon({ rim: 0xffe8c0, rimStrength: 0.5, rimPower: 2.6, noise: 0.20, noiseScale: 0.22, flatShading: true });
  const mLeaf = makeToon({ rim: 0xd8ff9e, rimStrength: 0.6, rimPower: 2.4, noise: 0.22, noiseScale: 0.14, flatShading: true });
  const mBark = makeToon({ rim: 0xd8b98a, rimStrength: 0.4, noise: 0.24, noiseScale: 0.5 });
  const mCrowd = makeToon({ rim: 0xffffff, rimStrength: 0.7, rimPower: 2.2, noise: 0.05 });
  const mNeon = new THREE.MeshBasicMaterial({ fog: true, toneMapped: false });
  const mCloud = makeToon({ color: 0xffffff, rim: 0xcfe8ff, rimStrength: 0.9, rimPower: 1.8, bounceStrength: 0.5, noise: 0.06 });

  // big flat areas should not be washed blue by the sky term
  mWall.userData.skyScale = 0.45;

  // These budgets are shared across the whole track and filled in order, so if
  // the city runs one dry the tunnel four sectors later simply never gets built.
  // Sized from an actual count per sector with headroom, not guessed.
  //
  // None of the instanced scenery casts shadows. Thirty thousand instances
  // through a second shadow pass is most of a frame's budget, and in a racer
  // moving at three hundred kilometres an hour nobody sees a building's shadow.
  // The vehicles and Mom still cast, which is all that reads.
  W.walls = inst(gBox, mWall, 7000, scene, false);     // towers and their setbacks
  W.trim = inst(gBox, mTrim, 11000, scene, false);     // ledges, caps, clutter, rails
  W.cyls = inst(gCyl, mTrim, 4000, scene, false);      // posts, pylons, pipes, columns
  W.rocks = inst(gRock, mRock, 2600, scene, false);    // boulders, canyon walls, rubble
  W.leaves = inst(gCone, mLeaf, 6000, scene, false);   // canopies and undergrowth
  W.bark = inst(gCyl, mBark, 2000, scene, false);      // trunks and fallen logs
  W.crowd = inst(gCap, mCrowd, 6500, scene, false);    // people in the stands
  W.neon = inst(gBoxSharp, mNeon, 6000, scene, false);
  W.clouds = inst(gSphere, mCloud, 420, scene, false);

  W.ground = buildGround(scene, track);

  // ---- walk the spline ----
  const pos = new THREE.Vector3();
  for (let i = 0; i < N; i += 5) {
    const t = i / N;
    const sec = sectorAt(t);
    const half = track.half[i];
    const c = track.pts[i], nrm = track.nrm[i], up = track.up[i];
    switch (sec.id) {
      case 'city': dressCity(W, c, nrm, up, half, t, i); break;
      case 'highway': dressHighway(W, c, nrm, up, half, t, i); break;
      case 'forest': dressForest(W, c, nrm, up, half, t, i); break;
      case 'volcano': dressVolcano(W, c, nrm, up, half, t, i); break;
      case 'underground': dressUnderground(W, c, nrm, up, half, t, i); break;
      case 'arena': dressArena(W, c, nrm, up, half, t, i); break;
    }
  }

  // cloud bank under the suspended highway
  for (let i = 0; i < 380; i++) {
    const t = rr(0.180, 0.298);
    track.posAt(t, rr(-820, 820), rr(-560, -40), pos);
    const s = rr(90, 300);
    put(W.clouds, pos, [0, rr(0, 6), 0], [s, s * rr(0.30, 0.46), s * rr(0.7, 1.0)]);
  }

  for (const k of ['walls', 'trim', 'cyls', 'rocks', 'leaves', 'bark', 'crowd', 'neon', 'clouds']) {
    W[k].instanceMatrix.needsUpdate = true;
    if (W[k].instanceColor) W[k].instanceColor.needsUpdate = true;
  }
  W.track = track;
  return W;
}

// ---------------------------------------------------------------------------
// A tower is never one box. Three or four stacked sections, each inset from the
// one below, with a ledge between them and clutter on the roof. That stack is
// the entire difference between a skyline and a bar chart.
// ---------------------------------------------------------------------------
function tower(W, base, up, nrm, side, offset, groundY, hMax) {
  const wall = pick(CITY_WALL);
  const trim = pick(CITY_TRIM);
  let w = rr(20, 46), d = rr(20, 46);
  let y = groundY;
  const tiers = 2 + Math.floor(rnd() * 3);
  const p = new THREE.Vector3();

  for (let k = 0; k < tiers; k++) {
    const h = (hMax / tiers) * rr(0.6, 1.35);
    p.copy(base).addScaledVector(nrm, offset).addScaledVector(up, y + h * 0.5);
    put(W.walls, p, [0, 0, 0], [w, h, d], wall);

    // a ledge on top of each setback catches light and reads as a floor line
    p.copy(base).addScaledVector(nrm, offset).addScaledVector(up, y + h);
    put(W.trim, p, [0, 0, 0], [w * 1.07, 1.7, d * 1.07], trim);

    y += h;
    w *= rr(0.62, 0.86);
    d *= rr(0.62, 0.86);
  }

  // roof clutter, which stops every tower ending in a flat line
  const rc = Math.floor(rnd() * 4);
  for (let k = 0; k < rc; k++) {
    const bw = w * rr(0.16, 0.42);
    p.copy(base)
      .addScaledVector(nrm, offset + rr(-w * 0.3, w * 0.3))
      .addScaledVector(up, y + rr(2, 9));
    put(W.trim, p, [0, rr(0, 3), 0], [bw, rr(4, 16), bw], trim);
  }
  if (hMax > 190 && rnd() > 0.4) {
    p.copy(base).addScaledVector(nrm, offset).addScaledVector(up, y + 23);
    put(W.cyls, p, [0, 0, 0], [1.4, 46, 1.4], 0xd8d0e8);
    p.copy(base).addScaledVector(nrm, offset).addScaledVector(up, y + 46);
    put(W.neon, p, [0, 0, 0], [3, 3, 3], 0xff3d5a);
  }
  // a lit sign board down one face
  if (rnd() > 0.5) {
    p.copy(base)
      .addScaledVector(nrm, offset - side * (w * 0.62))
      .addScaledVector(up, groundY + hMax * rr(0.3, 0.7));
    put(W.neon, p, [0, 0, 0], [1.5, hMax * rr(0.10, 0.26), d * rr(0.3, 0.5)], pick(NEON));
  }
  return y;
}

// A run of people in the stands. Capsules, two colours, packed tight.
function crowdRow(W, base, up, nrm, offset, y, count, spread) {
  const p = new THREE.Vector3();
  for (let k = 0; k < count; k++) {
    p.copy(base)
      .addScaledVector(nrm, offset + (rnd() - 0.5) * 4)
      .addScaledVector(up, y + 0.9);
    p.x += (rnd() - 0.5) * spread;
    p.z += (rnd() - 0.5) * spread;
    const c = rnd() > 0.5 ? pick(CITY_TRIM) : pick(CITY_WALL);
    put(W.crowd, p, [0, 0, (rnd() - 0.5) * 0.2], [1.5, 1.5 * rr(0.85, 1.15), 1.5], c);
  }
}

// Something crossing overhead. The cheapest way to make speed legible.
function gantry(W, base, up, nrm, half, color, height = 26) {
  const p = new THREE.Vector3();
  for (const s of [-1, 1]) {
    p.copy(base).addScaledVector(nrm, half * 1.3 * s).addScaledVector(up, height * 0.5);
    put(W.cyls, p, [0, 0, 0], [2.6, height, 2.6], 0xe4dcf0);
  }
  p.copy(base).addScaledVector(up, height);
  put(W.trim, p, [0, 0, 0], [half * 2.9, 3.4, 4.2], 0xe4dcf0);
  p.copy(base).addScaledVector(up, height - 3.4);
  put(W.neon, p, [0, 0, 0], [half * 1.5, 3.2, 1.4], color);
}

// --- sectors ----------------------------------------------------------------

function dressCity(W, c, nrm, up, half, t, i) {
  const G = -14;
  const p = new THREE.Vector3();

  for (const side of [-1, 1]) {
    for (let row = 0; row < 3; row++) {
      if (rnd() > (row === 0 ? 0.62 : row === 1 ? 0.5 : 0.4)) continue;
      const offset = (half * 2.2 + rr(46, 96) + row * rr(120, 250)) * side;
      const hMax = rr(70, 210) * (1 + row * 0.55) * (rnd() > 0.9 ? 1.9 : 1);
      tower(W, c, up, nrm, side, offset, G, hMax);
    }
  }

  // pavement, so the road has an edge instead of just stopping
  for (const side of [-1, 1]) {
    p.copy(c).addScaledVector(nrm, half * 1.32 * side).addScaledVector(up, -2.4);
    put(W.trim, p, [0, 0, 0], [8, 3.6, 7], 0xb9a6d8);
  }

  if (rnd() > 0.55) {
    const side = rnd() > 0.5 ? 1 : -1;
    p.copy(c).addScaledVector(nrm, half * 1.36 * side).addScaledVector(up, 5);
    put(W.cyls, p, [0, 0, 0], [0.9, 15, 0.9], 0xe8e0f4);
    p.copy(c).addScaledVector(nrm, half * 1.20 * side).addScaledVector(up, 12.6);
    put(W.trim, p, [0, 0, 0], [4.6, 0.8, 1.6], 0xe8e0f4);
    p.copy(c).addScaledVector(nrm, half * 1.14 * side).addScaledVector(up, 12.0);
    put(W.neon, p, [0, 0, 0], [3.2, 0.7, 1.3], 0xfff0c0);
  }

  if (rnd() > 0.5) {
    const side = rnd() > 0.5 ? 1 : -1;
    for (let k = 0; k < 3; k++) {
      const off = (half * 1.55 + k * 6.5) * side;
      p.copy(c).addScaledVector(nrm, off).addScaledVector(up, -8 + k * 3.4);
      put(W.trim, p, [0, 0, 0], [15, 3.6, 26], k % 2 ? 0x6a5590 : 0x7b64a4);
      crowdRow(W, c, up, nrm, off, -6.0 + k * 3.4, 4, 20);
    }
  }

  if (i % 90 === 0) gantry(W, c, up, nrm, half, pick(NEON), rr(24, 30));

  for (const side of [-1, 1]) {
    p.copy(c).addScaledVector(nrm, half * 1.14 * side).addScaledVector(up, 2.0);
    put(W.trim, p, [0, 0, 0], [0.9, 2.6, 8], rnd() > 0.5 ? 0xff2f6b : 0xfff2dc);
  }
}

function dressHighway(W, c, nrm, up, half, t, i) {
  const p = new THREE.Vector3();
  if (rnd() > 0.5) {
    for (const side of [-1, 1]) {
      p.copy(c).addScaledVector(nrm, half * 1.2 * side).addScaledVector(up, -100);
      put(W.cyls, p, [0, 0, 0], [8, 200, 8], 0xdde6f4);
    }
    p.copy(c).addScaledVector(up, -198);
    put(W.trim, p, [0, 0, 0], [half * 2.7, 9, 18], 0xcbd8ee);
    // diagonal bracing, which is what makes a bridge look engineered
    for (const side of [-1, 1]) {
      p.copy(c).addScaledVector(nrm, half * 0.6 * side).addScaledVector(up, -60);
      put(W.trim, p, [0, 0, side * 0.42], [2.6, 120, 2.6], 0xcbd8ee);
    }
  }
  for (const side of [-1, 1]) {
    p.copy(c).addScaledVector(nrm, half * 1.12 * side).addScaledVector(up, 2.4);
    put(W.trim, p, [0, 0, 0], [1.1, 3.2, 9], side > 0 ? 0xff6a2b : 0xffffff);
    p.copy(c).addScaledVector(nrm, half * 1.12 * side).addScaledVector(up, 4.4);
    put(W.cyls, p, [Math.PI / 2, 0, 0], [0.6, 9, 0.6], 0xe8eef8);
  }
  if (i % 80 === 0) gantry(W, c, up, nrm, half, 0xff6a2b, rr(22, 28));
}

function dressForest(W, c, nrm, up, half, t, i) {
  const p = new THREE.Vector3();
  for (let k = 0; k < 6; k++) {
    const side = rnd() > 0.5 ? 1 : -1;
    const off = (half * 1.45 + rr(3, 170)) * side;
    p.copy(c).addScaledVector(nrm, off).addScaledVector(up, rr(-4, 0));
    const h = rr(26, 78);
    const tilt = rr(-0.07, 0.07);
    const leaf = pick(FOREST_LEAF);
    put(W.bark, p.clone().addScaledVector(up, h * 0.16),
      [tilt, rr(0, 3), tilt], [rr(2.6, 4.6), h * 0.34, rr(2.6, 4.6)], 0x4e3822);
    // three canopy tiers, each a shade lighter, faceted
    for (let b = 0; b < 3; b++) {
      const bh = h * (0.36 + b * 0.24);
      const br = rr(11, 19) * (1 - b * 0.26);
      put(W.leaves, p.clone().addScaledVector(up, bh),
        [tilt, rr(0, 3), tilt], [br, rr(16, 26), br], shadeHex(leaf, 1 + b * 0.14));
    }
  }
  if (rnd() > 0.55) {
    const side = rnd() > 0.5 ? 1 : -1;
    p.copy(c).addScaledVector(nrm, half * rr(1.15, 1.6) * side).addScaledVector(up, 0.5);
    put(W.rocks, p, [rr(0, 3), rr(0, 3), rr(0, 3)], [rr(6, 15), rr(5, 11), rr(6, 15)],
      rnd() > 0.5 ? 0x6b6252 : 0x554c40);
  }
  // undergrowth: low scrub between the trunks, so the floor is not one sheet
  for (let k = 0; k < 3; k++) {
    if (rnd() > 0.5) continue;
    const side = rnd() > 0.5 ? 1 : -1;
    p.copy(c).addScaledVector(nrm, (half * 1.3 + rr(2, 140)) * side).addScaledVector(up, rr(-3, 0));
    put(W.leaves, p, [rr(-0.2, 0.2), rr(0, 3), rr(-0.2, 0.2)],
      [rr(5, 13), rr(3, 8), rr(5, 13)], shadeHex(pick(FOREST_LEAF), rr(0.55, 0.85)));
  }
  if (rnd() > 0.86) {
    const side = rnd() > 0.5 ? 1 : -1;
    p.copy(c).addScaledVector(nrm, half * 1.28 * side).addScaledVector(up, 2);
    put(W.bark, p, [Math.PI / 2, rr(-0.4, 0.4), 0], [rr(2.4, 3.6), rr(7, 14), rr(2.4, 3.6)], 0x3f2e1a);
  }
}

function dressVolcano(W, c, nrm, up, half, t, i) {
  const p = new THREE.Vector3();
  for (const side of [-1, 1]) {
    // canyon walls built from stacked faceted rock, not one smooth cone
    for (let k = 0; k < 2; k++) {
      const off = (half * 1.5 + rr(6, 70) + k * 40) * side;
      const h = rr(50, 200) * (1 + k * 0.4);
      p.copy(c).addScaledVector(nrm, off).addScaledVector(up, h * 0.28 - 24);
      put(W.rocks, p, [rr(-0.2, 0.2), rr(0, 3), rr(-0.2, 0.2)],
        [rr(34, 78), h, rr(34, 78)], rnd() > 0.65 ? 0x33202a : 0x1c1016);
    }
    if (rnd() > 0.42) {
      p.copy(c).addScaledVector(nrm, (half * 1.36 + rr(2, 40)) * side).addScaledVector(up, -9);
      put(W.neon, p, [0, rr(0, 3), 0], [rr(16, 46), 1.4, rr(16, 46)], rnd() > 0.5 ? 0xff4a10 : 0xffa030);
    }
  }
  if (rnd() > 0.84) {
    p.copy(c).addScaledVector(up, 0.75);
    put(W.neon, p, [0, rr(-0.4, 0.4), 0], [half * 2.1, 0.4, rr(1.4, 4)], 0xff5a14);
  }
  // embers, as tiny bright dots drifting high
  if (rnd() > 0.6) {
    p.copy(c).addScaledVector(nrm, rr(-90, 90)).addScaledVector(up, rr(10, 90));
    put(W.neon, p, [0, 0, 0], [1.2, 1.2, 1.2], 0xffb03d);
  }
  for (const side of [-1, 1]) {
    if (rnd() > 0.6) {
      p.copy(c).addScaledVector(nrm, half * 1.18 * side).addScaledVector(up, 2.2);
      put(W.cyls, p, [0, 0, rr(-0.2, 0.2)], [1.1, 6, 1.1], 0x241419);
    }
  }
}

function dressUnderground(W, c, nrm, up, half, t, i) {
  const p = new THREE.Vector3();
  // ribs, close together. that rhythm is what makes a tunnel feel fast.
  if (i % 15 === 0) {
    for (const side of [-1, 1]) {
      p.copy(c).addScaledVector(nrm, half * 1.42 * side).addScaledVector(up, 20);
      put(W.trim, p, [0, 0, side * 0.26], [4.2, 58, 6], 0x1a2530);
    }
    p.copy(c).addScaledVector(up, 47);
    put(W.trim, p, [0, 0, 0], [half * 2.95, 5.5, 6], 0x141d27);
    p.copy(c).addScaledVector(up, 43.5);
    put(W.neon, p, [0, 0, 0], [half * 2.5, 0.6, 2.2], pick(NEON));
  }
  // strips, not billboards. lots of small bright lines reads as a tunnel;
  // a few big flat rectangles reads as cardboard floating in the dark.
  if (rnd() > 0.18) {
    const cc = pick(NEON);
    for (const side of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        p.copy(c).addScaledVector(nrm, half * 1.29 * side).addScaledVector(up, rr(4, 26));
        put(W.neon, p, [0, 0, 0], [0.4, rr(0.5, 1.4), rr(3, 9)], cc);
      }
    }
  }
  // pools of light thrown onto the road, so the tunnel has something to read
  if (rnd() > 0.55) {
    p.copy(c).addScaledVector(nrm, rr(-half, half)).addScaledVector(up, 0.35);
    put(W.neon, p, [0, 0, 0], [rr(4, 11), 0.2, rr(6, 16)], 0x0d3a44);
  }
  // floor strips, the thing that actually lets you read the road down here
  for (const side of [-1, 1]) {
    p.copy(c).addScaledVector(nrm, half * 1.02 * side).addScaledVector(up, 0.6);
    put(W.neon, p, [0, 0, 0], [0.45, 0.3, 22], side > 0 ? 0x1fe8d4 : 0xff2f6b);
  }
  if (rnd() > 0.7) {
    const side = rnd() > 0.5 ? 1 : -1;
    p.copy(c).addScaledVector(nrm, (half * 1.5 + rr(4, 30)) * side).addScaledVector(up, rr(8, 30));
    put(W.cyls, p, [Math.PI / 2, rr(-0.3, 0.3), 0], [rr(2, 5), 40, rr(2, 5)], 0x27323e);
  }
  if (rnd() > 0.82) {
    const side = rnd() > 0.5 ? 1 : -1;
    p.copy(c).addScaledVector(nrm, (half * 1.6 + rr(8, 44)) * side).addScaledVector(up, 6);
    put(W.rocks, p, [rr(0, 3), rr(0, 3), rr(0, 3)], [rr(8, 22), rr(8, 20), rr(8, 22)], 0x141d26);
  }
}

function dressArena(W, c, nrm, up, half, t, i) {
  const p = new THREE.Vector3();
  if (rnd() > 0.5) {
    for (const side of [-1, 1]) {
      const off = (half * 1.2 + rr(24, 110)) * side;
      p.copy(c).addScaledVector(nrm, off).addScaledVector(up, 62);
      put(W.cyls, p, [0, 0, 0], [rr(15, 27), 132, rr(15, 27)], 0x3f2b64);
      p.copy(c).addScaledVector(nrm, off).addScaledVector(up, 130);
      put(W.trim, p, [0, rr(0, 3), 0], [rr(32, 48), 12, rr(32, 48)], 0x54397e);
      if (rnd() > 0.55) {
        p.copy(c).addScaledVector(nrm, off).addScaledVector(up, 141);
        put(W.neon, p, [0, 0, 0], [10, 12, 10], 0xffa53d);
      }
    }
  }
  if (rnd() > 0.55) {
    const side = rnd() > 0.5 ? 1 : -1;
    p.copy(c).addScaledVector(nrm, half * 1.16 * side).addScaledVector(up, 40);
    put(W.neon, p, [0, 0, 0], [1.0, 44, 15], rnd() > 0.5 ? 0xffc93d : 0xff4f9b);
  }
  if (rnd() > 0.35) {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 5; k++) {
        const off = (half * 1.1 + k * 9) * side;
        p.copy(c).addScaledVector(nrm, off).addScaledVector(up, 4 + k * 7);
        put(W.trim, p, [0, 0, 0], [half * 0.16, 7.4, 34], k % 2 ? 0x2e1f4e : 0x3b2963);
        crowdRow(W, c, up, nrm, off, 7 + k * 7, 5, 26);
      }
    }
  }
  if (i % 70 === 0) gantry(W, c, up, nrm, half, 0xffc93d, rr(34, 44));
}

// ---------------------------------------------------------------------------
// The ground.
// ---------------------------------------------------------------------------
const GROUND_DEPTH = { city: 14, highway: 1000, forest: 6, volcano: 30, underground: 46, arena: 18 };
const GROUND_WIDTH = { city: 900, highway: 40, forest: 500, volcano: 420, underground: 150, arena: 700 };

function buildGround(scene, track) {
  const N = track.samples, STRIDE = 6;
  const rows = Math.floor(N / STRIDE) + 1;
  const cols = 5;
  const pos = new Float32Array(rows * cols * 3);
  const col = new Float32Array(rows * cols * 3);
  const c = new THREE.Color(), p = new THREE.Vector3();

  for (let r = 0; r < rows; r++) {
    const i = Math.min(N, r * STRIDE);
    const t = i / N;
    const sec = sectorAt(t);
    const idx = SECTORS.indexOf(sec);
    const next = SECTORS[Math.min(SECTORS.length - 1, idx + 1)];
    const k = THREE.MathUtils.smoothstep(t, sec.to - 0.03, sec.to);
    const depth = GROUND_DEPTH[sec.id] + (GROUND_DEPTH[next.id] - GROUND_DEPTH[sec.id]) * k;
    const width = GROUND_WIDTH[sec.id] + (GROUND_WIDTH[next.id] - GROUND_WIDTH[sec.id]) * k;
    c.setHex(sec.ground).lerp(new THREE.Color(next.ground), k);

    for (let j = 0; j < cols; j++) {
      const lat = (j / (cols - 1) - 0.5) * 2;
      p.copy(track.pts[i])
        .addScaledVector(track.nrm[i], lat * width)
        .addScaledVector(track.up[i], -depth);
      const o = (r * cols + j) * 3;
      pos[o] = p.x; pos[o + 1] = p.y; pos[o + 2] = p.z;
      const shade = 1 - Math.abs(lat) * 0.22;
      col[o] = c.r * shade; col[o + 1] = c.g * shade; col[o + 2] = c.b * shade;
    }
  }
  const idx = [];
  for (let r = 0; r < rows - 1; r++)
    for (let j = 0; j < cols - 1; j++) {
      const a = r * cols + j, b = a + 1, d = a + cols, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();

  const mat = makeToon({
    vertexColors: true, rim: 0xffffff, rimStrength: 0.10, rimPower: 5.0,
    bounceStrength: 0.10, noise: 0.30, noiseScale: 0.012
  });
  mat.userData.skyScale = 0.35;   // the ground should not go blue under an open sky
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

export function updateWorld() { /* the instanced world is static */ }
