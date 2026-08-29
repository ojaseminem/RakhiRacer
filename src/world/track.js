import * as THREE from 'three';
import { TRACK, SECTORS, sectorAt } from '../config.js';

// ---------------------------------------------------------------------------
// The racing line is a rakhi.
//
// A long wavy thread comes in from the left, ties itself into a flower knot in
// the middle, and a shorter thread trails off to the right. The knot is a six
// petal rose curve traversed one and a half times, which means it crosses over
// itself. Rather than fight that, the road spirals in height through the knot,
// so every crossing becomes a real over and under pass. That is also where the
// forest, the volcano and the underground live, descending the whole way.
//
// Everything downstream of this file works in track space: a distance along the
// spline, a lateral offset from the centre, and a height above the road. That
// keeps the AI, the collisions, the respawns and the camera all trivial.
// ---------------------------------------------------------------------------

const SCALE = 0.8;

// The left hand thread. It has to arrive at the heart's left point travelling
// in the +Z direction, which is why it swings down and comes back up.
function threadIn() {
  return [
    [-13400, 1400], [-12200, 2400], [-10900, 2900], [-9500, 2400],
    [-8300, 1200], [-7100, 100], [-5900, -700], [-4700, -1100],
    [-3700, -1000], [-3100, -500], [-2880, 200]
  ];
}

// And the right hand one leaves the heart's right point travelling in -Z.
function threadOut() {
  return [
    [2880, 100], [3100, -700], [3700, -1500], [4700, -2000],
    [5900, -2100], [7000, -1700], [7900, -900], [8400, 200],
    [8400, 1300], [7800, 2000], [7000, 2100]
  ];
}

// ---------------------------------------------------------------------------
// The knot is a heart.
//
// The classic parametric heart, traversed one and a half times. Entering at the
// left point and leaving one and a half turns later puts the exit at the right
// point, and the half turn of overlap is exactly what the height spiral turns
// into over and under passes. The cusp at the bottom becomes a hairpin, which
// is the best corner on the track.
// ---------------------------------------------------------------------------
function heartPoints(steps) {
  const out = [];
  const S = TRACK.heartScale;
  const start = -Math.PI / 2;                 // the left point
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const th = start + u * Math.PI * 3;       // one and a half turns
    // the second lap is drawn a little smaller, so the two passes sit inside
    // one another rather than fighting for the same ground
    const k = S * (1 - 0.16 * Math.min(1, Math.max(0, (u - 0.30) / 0.70)));
    const x = 16 * Math.pow(Math.sin(th), 3);
    const y = 13 * Math.cos(th) - 5 * Math.cos(2 * th)
            - 2 * Math.cos(3 * th) - Math.cos(4 * th);
    out.push([x * k, y * k]);
  }
  return out;
}

// height profile, keyed on normalised distance along the whole track
const HEIGHT_KEYS = [
  [0.000,    0], [0.100,   60], [0.175,   30], [0.205,  420],
  [0.235,  900], [0.262, 1020], [0.276,  990], [0.300,  700],
  [0.320,  380], [0.380,  120], [0.470,   40], [0.530,  -40],
  [0.600,  -90], [0.690, -260], [0.722, -680], [0.800, -880],
  [0.858, -420], [0.880,  120], [0.930,  170], [1.000,  110]
];

// road half width, keyed the same way. wide and generous in the city, tight in
// the underground, enormous in the arena.
const WIDTH_KEYS = [
  [0.000, 1.35], [0.140, 1.20], [0.190, 1.05], [0.300, 1.00],
  [0.330, 1.10], [0.520, 1.00], [0.560, 1.25], [0.700, 0.95],
  [0.760, 0.85], [0.865, 1.00], [0.885, 2.30], [0.960, 2.60], [1.000, 2.00]
];

function keyed(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last[1];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t >= a[0] && t <= b[0]) {
      let k = (t - a[0]) / (b[0] - a[0]);
      k = k * k * (3 - 2 * k);                          // smoothstep
      return a[1] + (b[1] - a[1]) * k;
    }
  }
  return last[1];
}

export class Track {
  constructor() {
    this.build();
  }

  build() {
    // ---- flat plan of the rakhi, in XZ ----
    const plan = [];
    for (const p of threadIn()) plan.push(p);
    const knot = heartPoints(460);
    for (let i = 1; i < knot.length; i++) plan.push(knot[i]);
    for (const p of threadOut()) plan.push(p);

    const raw = plan.map(([x, z]) => new THREE.Vector3(x * SCALE, 0, z * SCALE));
    const curve = new THREE.CatmullRomCurve3(raw, false, 'centripetal', 0.5);

    // ---- resample to even spacing so distance along the track is meaningful ----
    const N = 5200;
    const pts = curve.getSpacedPoints(N);

    // apply the height profile once we know each point's normalised distance
    for (let i = 0; i <= N; i++) pts[i].y = keyed(HEIGHT_KEYS, i / N) * SCALE;

    // total length, and per sample distance
    let total = 0;
    const dist = new Float32Array(N + 1);
    for (let i = 1; i <= N; i++) {
      total += pts[i].distanceTo(pts[i - 1]);
      dist[i] = total;
    }

    this.samples = N;
    this.length = total;
    this.pts = pts;
    this.dist = dist;
    this.step = total / N;

    // ---- tangents, normals and banking ----
    const tan = [], nrm = [], up = [], bank = new Float32Array(N + 1);
    const WORLD_UP = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= N; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)];
      const t = new THREE.Vector3().subVectors(b, a).normalize();
      tan.push(t);
      // Careful: this is the vehicle's local +X, which for an object facing
      // +Z is its LEFT. Positive `lat` therefore means left of the centre line.
      // The steering input is negated in the vehicle to account for it.
      const n = new THREE.Vector3().crossVectors(WORLD_UP, t).normalize();
      nrm.push(n);
    }
    // curvature drives the bank angle
    for (let i = 0; i <= N; i++) {
      const a = tan[Math.max(0, i - 6)], b = tan[Math.min(N, i + 6)];
      const cross = new THREE.Vector3().crossVectors(a, b);
      const sign = Math.sign(cross.y) || 1;
      const amt = Math.min(1, a.angleTo(b) / 0.30);
      bank[i] = -sign * amt * 0.42;
    }
    // smooth the bank so it does not snap
    const sb = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      let s = 0, c = 0;
      for (let k = -14; k <= 14; k++) {
        const j = i + k; if (j < 0 || j > N) continue;
        s += bank[j]; c++;
      }
      sb[i] = s / c;
    }
    this.bank = sb;

    for (let i = 0; i <= N; i++) {
      const u = new THREE.Vector3().crossVectors(tan[i], nrm[i]).normalize();
      const q = new THREE.Quaternion().setFromAxisAngle(tan[i], sb[i]);
      up.push(u.applyQuaternion(q));
      nrm[i].applyQuaternion(q);
    }
    this.tan = tan; this.nrm = nrm; this.up = up;

    // ---- half width per sample ----
    this.half = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) this.half[i] = TRACK.roadHalfWidth * keyed(WIDTH_KEYS, i / N);
  }

  // normalised distance -> sample index, with the fractional part
  idxAt(t) {
    const f = THREE.MathUtils.clamp(t, 0, 1) * this.samples;
    const i = Math.min(this.samples - 1, Math.floor(f));
    return [i, f - i];
  }

  posAt(t, lateral = 0, height = 0, out = new THREE.Vector3()) {
    const [i, f] = this.idxAt(t);
    out.copy(this.pts[i]).lerp(this.pts[i + 1], f);
    if (lateral) out.addScaledVector(this.nrm[i], lateral);
    if (height) out.addScaledVector(this.up[i], height);
    return out;
  }

  tanAt(t, out = new THREE.Vector3()) {
    const [i, f] = this.idxAt(t);
    return out.copy(this.tan[i]).lerp(this.tan[i + 1], f).normalize();
  }

  nrmAt(t, out = new THREE.Vector3()) {
    const [i] = this.idxAt(t);
    return out.copy(this.nrm[i]);
  }

  upAt(t, out = new THREE.Vector3()) {
    const [i] = this.idxAt(t);
    return out.copy(this.up[i]);
  }

  halfAt(t) {
    const [i, f] = this.idxAt(t);
    return this.half[i] * (1 - f) + this.half[i + 1] * f;
  }

  bankAt(t) {
    const [i, f] = this.idxAt(t);
    return this.bank[i] * (1 - f) + this.bank[i + 1] * f;
  }

  // curvature, signed, useful for the AI and for the camera lead
  curveAt(t) {
    const [i] = this.idxAt(t);
    const a = this.tan[Math.max(0, i - 8)], b = this.tan[Math.min(this.samples, i + 8)];
    const cross = new THREE.Vector3().crossVectors(a, b);
    return (Math.sign(cross.y) || 1) * a.angleTo(b);
  }

  inGap(t) { return t > TRACK.gap.from && t < TRACK.gap.to; }
  inFork(t) { return t > TRACK.fork.from && t < TRACK.fork.to; }

  // seconds of race time this normalised position roughly corresponds to,
  // used to place the cinematics
  metersAt(t) { return t * this.length; }
}

// ---------------------------------------------------------------------------
// Road ribbon. One mesh for the whole track: a driving surface, two kerbs and
// a skirt that falls away at the edges so the road reads as a solid object
// rather than a decal. Vertex colours carry the sector palette, which means the
// entire 30km of road is a single draw call.
// ---------------------------------------------------------------------------
export function buildRoadMesh(track) {
  const N = track.samples;
  const STRIDE = 2;
  const rows = Math.floor(N / STRIDE) + 1;

  // cross section: fraction of half width, then height offset. the centre pair
  // carries the dashed line so the whole road is still one draw call.
  const section = [
    [-1.34, -16], [-1.06, -1.8], [-1.00, 0.05], [-0.90, 0.06],
    [-0.86, 0.20], [-0.075, 0.27], [-0.032, 0.28],
    [ 0.032, 0.28], [ 0.075, 0.27], [ 0.86, 0.20],
    [ 0.90, 0.06], [ 1.00, 0.05], [ 1.06, -1.8], [ 1.34, -16]
  ];
  const cols = section.length;

  const pos = new Float32Array(rows * cols * 3);
  const col = new Float32Array(rows * cols * 3);
  const nor = new Float32Array(rows * cols * 3);
  const uv  = new Float32Array(rows * cols * 2);

  const c = new THREE.Color();
  const cRoad = new THREE.Color(), cKerbA = new THREE.Color(), cKerbB = new THREE.Color();
  const cSkirt = new THREE.Color(), cLine = new THREE.Color();
  const p = new THREE.Vector3();

  for (let r = 0; r < rows; r++) {
    const i = Math.min(N, r * STRIDE);
    const t = i / N;
    const sec = sectorAt(t);
    const next = SECTORS[Math.min(SECTORS.length - 1, SECTORS.indexOf(sec) + 1)];
    const fadeIn = THREE.MathUtils.smoothstep(t, sec.to - 0.022, sec.to);
    cRoad.setHex(sec.road).lerp(c.setHex(next.road), fadeIn);
    cKerbA.setHex(sec.kerbA).lerp(c.setHex(next.kerbA), fadeIn);
    cKerbB.setHex(sec.kerbB).lerp(c.setHex(next.kerbB), fadeIn);
    cSkirt.copy(cRoad).multiplyScalar(0.42);
    cLine.copy(cKerbB).multiplyScalar(0.78);

    const half = track.half[i];
    const kerbTooth = (Math.floor(i / 5) % 2) === 0;
    const dash = (Math.floor(i / 11) % 3) !== 0;

    for (let k = 0; k < cols; k++) {
      const [lat, h] = section[k];
      p.copy(track.pts[i])
        .addScaledVector(track.nrm[i], lat * half)
        .addScaledVector(track.up[i], h);
      const o = (r * cols + k) * 3;
      pos[o] = p.x; pos[o + 1] = p.y; pos[o + 2] = p.z;
      nor[o] = track.up[i].x; nor[o + 1] = track.up[i].y; nor[o + 2] = track.up[i].z;

      let use = cRoad;
      if (k <= 1 || k >= cols - 2) use = cSkirt;
      else if (k === 2 || k === 3 || k === cols - 3 || k === cols - 4) use = kerbTooth ? cKerbA : cKerbB;
      else if ((k === 6 || k === 7) && dash) use = cLine;

      col[o] = use.r; col[o + 1] = use.g; col[o + 2] = use.b;

      const uo = (r * cols + k) * 2;
      uv[uo] = (lat + 1.34) / 2.68;
      uv[uo + 1] = i * 0.02;
    }
  }

  const idx = [];
  for (let r = 0; r < rows - 1; r++) {
    // the road genuinely stops in sector two. this is the gap.
    const tr0 = (r * STRIDE) / N;
    if (tr0 > TRACK.gap.from && tr0 < TRACK.gap.to) continue;
    for (let k = 0; k < cols - 1; k++) {
      const a = r * cols + k, b = a + 1, d = a + cols, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}



// ---------------------------------------------------------------------------
// Barriers.
//
// A continuous rail down both edges with posts at intervals, built as one mesh
// so thirty kilometres of fence costs a single draw call. It matches the hard
// wall in the vehicle exactly, so what she can see is what she can hit.
// ---------------------------------------------------------------------------
const _tmpCol = new THREE.Color();

export function buildBarriers(track) {
  const N = track.samples;
  const STRIDE = 3;
  const pos = [], col = [], idx = [];
  const cBand = new THREE.Color(), cDark = new THREE.Color(), cCap = new THREE.Color();
  const p = new THREE.Vector3();

  // A guard rail, not a wall. One striped band held up on posts, with a bright
  // line along the top. Open underneath so the roadside is still visible, but
  // unmissable in peripheral vision, which is the only place you ever see the
  // edge of a road from at this speed.
  const RAIL_LO = 1.2, RAIL_HI = 3.4, CAP_HI = 4.0, POST_LO = -2.6, LAT = 1.06;
  const vert = (x, y, z, r, g2, b) => { pos.push(x, y, z); col.push(r, g2, b); return pos.length / 3 - 1; };
  const quad = (a, b, d, e) => { idx.push(a, d, b, b, d, e, b, d, a, e, d, b); };

  for (const side of [-1, 1]) {
    let prev = null;
    for (let r = 0; r * STRIDE <= N; r++) {
      const i = Math.min(N, r * STRIDE);
      const sec = sectorAt(i / N);
      // striped by distance so the bands stay the same length whatever the
      // sampling works out to, and dark against bright rather than two pale
      // colours, which just averaged out to grey at a distance
      const band = Math.floor(track.dist[i] / 17) % 2 === 0;
      cDark.setHex(sec.road).multiplyScalar(0.85);
      cBand.copy(band ? _tmpCol.setHex(sec.kerbA) : cDark);
      cCap.setHex(sec.kerbB);

      const half = track.half[i];
      const base = track.pts[i], nrm = track.nrm[i], up = track.up[i];
      const at = (y, cc, mul) => vert(
        ...p.copy(base).addScaledVector(nrm, half * LAT * side).addScaledVector(up, y).toArray(),
        cc.r * mul, cc.g * mul, cc.b * mul);

      const row = [
        at(RAIL_LO, cBand, 0.72), at(RAIL_HI, cBand, 1.15),
        at(RAIL_HI, cCap, 1.0), at(CAP_HI, cCap, 1.25)
      ];
      if (prev) for (let k = 0; k < 4; k += 2) quad(prev[k], prev[k + 1], row[k], row[k + 1]);
      prev = row;

      // a post every so often, dropping past the kerb toward the ground
      if (i % 24 === 0) {
        const pv = [];
        for (const dz of [-0.55, 0.55]) {
          for (const y of [POST_LO, CAP_HI]) {
            pv.push(vert(
              ...p.copy(base)
                .addScaledVector(nrm, half * LAT * side)
                .addScaledVector(track.tan[i], dz)
                .addScaledVector(up, y).toArray(),
              cDark.r * 0.7, cDark.g * 0.7, cDark.b * 0.7));
          }
        }
        quad(pv[0], pv[1], pv[2], pv[3]);
      }
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
