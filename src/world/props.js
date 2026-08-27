import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SECTORS, sectorAt } from '../config.js';
import { makeToon, makeGlow } from '../art/materials.js';

// ---------------------------------------------------------------------------
// Everything that is not the road.
//
// All of it is instanced, so the whole 30km of city, forest, canyon, tunnel and
// arena costs about a dozen draw calls. Placement walks the spline and drops
// things to either side, biased by sector, with a deterministic random so the
// world is the same every run.
// ---------------------------------------------------------------------------

let seed = 1337;
function rnd() { seed = (seed * 1664525 + 1013904223) & 0x7fffffff; return seed / 0x7fffffff; }
const rr = (a, b) => a + rnd() * (b - a);
const pick = (arr) => arr[Math.floor(rnd() * arr.length) % arr.length];

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion();
const _s = new THREE.Vector3(), _e = new THREE.Euler(), _c = new THREE.Color();

function inst(geo, mat, count, scene, shadow = true) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
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

const CITY_COLORS = [0xff6fa8, 0x7fe8ff, 0xffe066, 0xa88fff, 0x5fe0b0, 0xff9a5f, 0xfff0e0, 0xff4f8f];
const FOREST_COLORS = [0x2e8b4a, 0x3fa35c, 0x1f6b39, 0x58bf6a, 0x8fd67a];
const NEON_COLORS = [0x27e0d0, 0xff3d7a, 0xffd23d, 0x6a8fff, 0xb44aff];

export function buildWorld(scene, track) {
  seed = 1337;
  const N = track.samples;
  const W = {};

  // ---- shared geometry ----
  const gBox = new RoundedBoxGeometry(1, 1, 1, 2, 0.14);
  const gCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
  const gCone = new THREE.ConeGeometry(0.5, 1, 9);
  const gSphere = new THREE.SphereGeometry(0.5, 12, 8);
  const gPlane = new THREE.PlaneGeometry(1, 1);

  // ---- materials ----
  const mSolid = makeToon({ rim: 0xffffff, rimStrength: 0.7, rimPower: 2.3, bounceStrength: 0.35 });
  const mSolid2 = makeToon({ rim: 0xffe8c0, rimStrength: 0.55, rimPower: 2.8, bounceStrength: 0.4 });
  const mNeon = new THREE.MeshBasicMaterial({ fog: true, toneMapped: false });
  const mCloud = makeToon({ color: 0xffffff, rim: 0xcfe8ff, rimStrength: 1.1, rimPower: 1.6, bounceStrength: 0.5 });

  W.blocks = inst(gBox, mSolid, 2600, scene);        // buildings, rocks, pillars, crates
  W.cyls = inst(gCyl, mSolid2, 1800, scene);         // trunks, columns, pipes, pylons
  W.cones = inst(gCone, mSolid, 1500, scene);        // tree canopies, spires
  W.blobs = inst(gSphere, mSolid, 1200, scene);      // canopy blobs, boulders, clouds
  W.neon = inst(gBox, mNeon, 1400, scene, false);    // signs, lava cracks, lights
  W.clouds = inst(gSphere, mCloud, 420, scene, false);

  // ---- the ground ribbon ----
  W.ground = buildGround(scene, track);

  // ---- walk the spline and dress it ----
  const pos = new THREE.Vector3();
  const step = 5;
  for (let i = 0; i < N; i += step) {
    const t = i / N;
    const sec = sectorAt(t);
    const half = track.half[i];
    const c = track.pts[i], nrm = track.nrm[i], up = track.up[i];

    switch (sec.id) {
      case 'city': dressCity(W, c, nrm, up, half, t); break;
      case 'highway': dressHighway(W, c, nrm, up, half, t); break;
      case 'forest': dressForest(W, c, nrm, up, half, t); break;
      case 'volcano': dressVolcano(W, c, nrm, up, half, t); break;
      case 'underground': dressUnderground(W, c, nrm, up, half, t); break;
      case 'arena': dressArena(W, c, nrm, up, half, t); break;
    }
  }

  // big soft clouds sitting under the highway
  for (let i = 0; i < 380; i++) {
    // keep these strictly under the suspended highway. the knot passes close
    // enough that a wide scatter leaks white blobs into the volcano.
    const t = rr(0.180, 0.298);
    track.posAt(t, rr(-780, 780), rr(-560, -40), pos);
    const s = rr(90, 300);
    put(W.clouds, pos, [0, rr(0, 6), 0], [s, s * rr(0.34, 0.5), s * rr(0.7, 1.0)]);
  }

  for (const k of ['blocks', 'cyls', 'cones', 'blobs', 'neon', 'clouds']) {
    W[k].instanceMatrix.needsUpdate = true;
    if (W[k].instanceColor) W[k].instanceColor.needsUpdate = true;
  }

  W.track = track;
  return W;
}

// --- sector dressers ---------------------------------------------------------

function dressCity(W, c, nrm, up, half, t) {
  const p = new THREE.Vector3();
  const G = -14;   // top of the ground ribbon, relative to the road
  for (const side of [-1, 1]) {
    // two rows of towers so the street has depth rather than one flat wall
    for (let row = 0; row < 2; row++) {
      if (rnd() > (row ? 0.55 : 0.78)) continue;
      const off = (half * 1.9 + rr(24, 90) + row * rr(90, 200)) * side;
      const w = rr(26, 64), d = rr(26, 64);
      const h = rr(60, 300) * (rnd() > 0.88 ? 2.4 : 1) * (1 + row * 0.5);
      p.copy(c).addScaledVector(nrm, off).addScaledVector(up, G + h * 0.5);
      put(W.blocks, p, [0, rr(0, 3.14), 0], [w, h, d], pick(CITY_COLORS));

      if (row === 0 && rnd() > 0.55) {
        p.copy(c).addScaledVector(nrm, off - side * (w * 0.5 + 0.9)).addScaledVector(up, G + h * rr(0.35, 0.8));
        put(W.neon, p, [0, 0, 0], [1.4, h * rr(0.12, 0.34), d * 0.55], pick(NEON_COLORS));
      }
      if (rnd() > 0.6) {
        p.copy(c).addScaledVector(nrm, off).addScaledVector(up, G + h + rr(4, 14));
        put(W.blocks, p, [0, rr(0, 3), 0], [w * rr(0.3, 0.6), rr(10, 34), d * rr(0.3, 0.6)], pick(CITY_COLORS));
      }
    }
  }
  if (rnd() > 0.42) {
    const side = rnd() > 0.5 ? 1 : -1;
    p.copy(c).addScaledVector(nrm, half * 1.28 * side).addScaledVector(up, -2);
    put(W.cyls, p, [0, 0, 0], [1.1, 13, 1.1], 0xf0e8ff);
    p.copy(c).addScaledVector(nrm, half * 1.28 * side).addScaledVector(up, 11.5);
    put(W.neon, p, [0, 0, 0], [3.2, 1.0, 1.8], 0xfff2c0);
  }
  if (rnd() > 0.55) {
    const side = rnd() > 0.5 ? 1 : -1;
    for (let k = 0; k < 3; k++) {
      p.copy(c).addScaledVector(nrm, (half * 1.42 + k * 5.5) * side).addScaledVector(up, -9 + k * 3.2);
      put(W.blocks, p, [0, 0, 0], [14, 4.5, 26], k % 2 ? 0xffe0f0 : 0xffc0dc);
    }
  }
}

function dressHighway(W, c, nrm, up, half, t) {
  const p = new THREE.Vector3();
  // support pylons dropping into the cloud
  if (rnd() > 0.55) {
    for (const side of [-1, 1]) {
      p.copy(c).addScaledVector(nrm, half * 1.25 * side).addScaledVector(up, -95);
      put(W.cyls, p, [0, 0, 0], [7, 190, 7], 0xe8eef8);
    }
    p.copy(c).addScaledVector(up, -190);
    put(W.blocks, p, [0, 0, 0], [half * 2.6, 8, 16], 0xd8e4f4);
  }
  // guard rails
  for (const side of [-1, 1]) {
    p.copy(c).addScaledVector(nrm, half * 1.14 * side).addScaledVector(up, 2.6);
    put(W.blocks, p, [0, 0, 0], [1.2, 3.4, 9], side > 0 ? 0xff7a4d : 0xffffff);
  }
  // overhead gantries
  if (rnd() > 0.9) {
    p.copy(c).addScaledVector(up, 26);
    put(W.blocks, p, [0, 0, 0], [half * 2.6, 3, 3], 0xffffff);
    p.addScaledVector(up, -4);
    put(W.neon, p, [0, 0, 0], [half * 1.2, 5, 1.2], 0xff7a4d);
  }
}

function dressForest(W, c, nrm, up, half, t) {
  const p = new THREE.Vector3();
  for (let k = 0; k < 5; k++) {
    const side = rnd() > 0.5 ? 1 : -1;
    const off = (half * 1.5 + rr(4, 160)) * side;
    p.copy(c).addScaledVector(nrm, off).addScaledVector(up, rr(-3, 1));
    const h = rr(22, 64);
    const tilt = rr(-0.09, 0.09);
    put(W.cyls, p.clone().addScaledVector(up, h * 0.22), [tilt, rr(0, 3), tilt], [rr(2.2, 4.4), h * 0.5, rr(2.2, 4.4)], 0x5c4326);
    const cc = pick(FOREST_COLORS);
    for (let b = 0; b < 3; b++) {
      const bh = h * (0.45 + b * 0.22);
      const br = rr(9, 17) * (1 - b * 0.24);
      put(W.cones, p.clone().addScaledVector(up, bh), [tilt, rr(0, 3), tilt], [br, rr(14, 22), br], cc);
    }
  }
  // rocks and logs near the road
  if (rnd() > 0.7) {
    const side = rnd() > 0.5 ? 1 : -1;
    p.copy(c).addScaledVector(nrm, half * rr(1.15, 1.5) * side).addScaledVector(up, 1);
    put(W.blobs, p, [rr(0, 3), rr(0, 3), rr(0, 3)], [rr(5, 13), rr(4, 9), rr(5, 13)], 0x6b6252);
  }
  if (rnd() > 0.88) {
    const side = rnd() > 0.5 ? 1 : -1;
    p.copy(c).addScaledVector(nrm, half * 1.3 * side).addScaledVector(up, 2);
    const l = rr(26, 50);
    put(W.cyls, p, [Math.PI / 2, rr(-0.4, 0.4), 0], [rr(3, 5), l * 0.5, rr(3, 5)], 0x4a3a22);
  }
}

function dressVolcano(W, c, nrm, up, half, t) {
  const p = new THREE.Vector3();
  for (const side of [-1, 1]) {
    // canyon walls
    const off = (half * 1.6 + rr(10, 60)) * side;
    const h = rr(50, 190);
    p.copy(c).addScaledVector(nrm, off).addScaledVector(up, h * 0.32 - 20);
    put(W.cones, p, [rr(-0.1, 0.1), rr(0, 3), rr(-0.1, 0.1)], [rr(30, 70), h, rr(30, 70)], rnd() > 0.7 ? 0x2e1820 : 0x1a0d12);

    // lava at the base, glowing
    if (rnd() > 0.45) {
      p.copy(c).addScaledVector(nrm, (half * 1.4 + rr(2, 34)) * side).addScaledVector(up, -8);
      put(W.neon, p, [0, rr(0, 3), 0], [rr(14, 40), 1.5, rr(14, 40)], rnd() > 0.5 ? 0xff5a1f : 0xffb03d);
    }
  }
  // glowing cracks running across the road surface
  if (rnd() > 0.86) {
    p.copy(c).addScaledVector(up, 0.6);
    put(W.neon, p, [0, rr(-0.4, 0.4), 0], [half * 2.1, 0.4, rr(1.5, 4)], 0xff6a1f);
  }
}

function dressUnderground(W, c, nrm, up, half, t) {
  const p = new THREE.Vector3();
  // tunnel ribs
  if (rnd() > 0.42) {
    for (const side of [-1, 1]) {
      p.copy(c).addScaledVector(nrm, half * 1.45 * side).addScaledVector(up, 22);
      put(W.blocks, p, [0, 0, side * 0.30], [5, 62, 7], 0x1e2a36);
    }
    p.copy(c).addScaledVector(up, 50);
    put(W.blocks, p, [0, 0, 0], [half * 3.0, 6, 7], 0x18222c);
  }
  // neon strips overhead and along the walls
  if (rnd() > 0.35) {
    const cc = pick(NEON_COLORS);
    p.copy(c).addScaledVector(up, 46);
    put(W.neon, p, [0, 0, 0], [half * 0.5, 0.7, 4], cc);
    for (const side of [-1, 1]) {
      p.copy(c).addScaledVector(nrm, half * 1.33 * side).addScaledVector(up, rr(8, 30));
      put(W.neon, p, [0, 0, 0], [0.7, rr(3, 10), rr(4, 14)], cc);
    }
  }
  // big vertical pipes
  if (rnd() > 0.8) {
    const side = rnd() > 0.5 ? 1 : -1;
    p.copy(c).addScaledVector(nrm, (half * 1.55 + rr(6, 40)) * side).addScaledVector(up, 12);
    put(W.cyls, p, [0, 0, rr(-0.1, 0.1)], [rr(4, 9), 60, rr(4, 9)], 0x25313d);
  }
}

function dressArena(W, c, nrm, up, half, t) {
  const p = new THREE.Vector3();
  // colossal columns ringing the arena
  if (rnd() > 0.55) {
    for (const side of [-1, 1]) {
      p.copy(c).addScaledVector(nrm, (half * 1.25 + rr(20, 90)) * side).addScaledVector(up, 60);
      put(W.cyls, p, [0, 0, 0], [rr(14, 26), 130, rr(14, 26)], 0x4a3568);
      p.addScaledVector(up, 66);
      put(W.blocks, p, [0, 0, 0], [rr(30, 44), 10, rr(30, 44)], 0x5e4482);
    }
  }
  // banners and braziers
  if (rnd() > 0.6) {
    const side = rnd() > 0.5 ? 1 : -1;
    p.copy(c).addScaledVector(nrm, half * 1.2 * side).addScaledVector(up, 34);
    put(W.neon, p, [0, 0, 0], [1.0, 40, 14], rnd() > 0.5 ? 0xffc93d : 0xff4f9b);
  }
  // crowd tiers
  if (rnd() > 0.4) {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        p.copy(c).addScaledVector(nrm, half * (1.35 + k * 0.16) * side).addScaledVector(up, 6 + k * 9);
        put(W.blocks, p, [0, 0, 0], [half * 0.14, 8, 30], k % 2 ? 0x3a2a55 : 0x4e386f);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// The ground. A wide ribbon following the track, dropped further below in the
// sectors that are supposed to feel like a void.
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
      const shade = 1 - Math.abs(lat) * 0.25;
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

  const m = new THREE.Mesh(g, makeToon({
    vertexColors: true, rim: 0xffffff, rimStrength: 0.18, rimPower: 4.0, bounceStrength: 0.15
  }));
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

export function updateWorld(W, player, dt, time) {
  if (!W) return;
  // the neon breathes a little so the underground and the arena feel alive
  if (W.neon && W.neon.material) {
    W.neon.material.opacity = 1;
  }
}
