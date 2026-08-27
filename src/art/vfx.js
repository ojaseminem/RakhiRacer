import * as THREE from 'three';

// ---------------------------------------------------------------------------
// One particle system for the whole game.
//
// A single Points object with a ring buffer of slots and a custom shader, so
// sparks, dust, debris, boost trails and confetti all cost one draw call
// between them. Position and velocity are integrated on the GPU from a spawn
// time, which means the CPU only touches a particle once, when it is born.
// ---------------------------------------------------------------------------

const MAX = 4200;

const VERT = /* glsl */`
  attribute vec3 aVel;
  attribute vec4 aData;      // birth, life, size, spin
  attribute vec3 aColor;
  attribute float aKind;     // 0 spark 1 smoke 2 debris 3 confetti 4 trail
  uniform float uTime;
  uniform float uPixelRatio;
  varying vec3 vColor;
  varying float vAge;
  varying float vKind;

  void main() {
    float age = (uTime - aData.x) / aData.y;
    vAge = age;
    vKind = aKind;
    vColor = aColor;
    if (age < 0.0 || age > 1.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);   // off screen, cheap discard
      gl_PointSize = 0.0;
      return;
    }
    float t = age * aData.y;
    vec3 g = vec3(0.0, aKind == 1.0 ? 3.4 : -26.0, 0.0);
    float drag = aKind == 1.0 ? 1.6 : (aKind == 3.0 ? 2.2 : 0.35);
    float damp = (1.0 - exp(-drag * t)) / drag;
    vec3 pos = position + aVel * damp + 0.5 * g * t * t;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float grow = aKind == 1.0 ? (1.0 + age * 2.6) : (1.0 - age * 0.45);
    gl_PointSize = aData.z * grow * uPixelRatio * 260.0 / max(1.0, -mv.z);
  }
`;

const FRAG = /* glsl */`
  varying vec3 vColor;
  varying float vAge;
  varying float vKind;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    float alpha;
    if (vKind == 3.0) {
      // confetti: little squares that tumble, not soft blobs
      vec2 q = abs(d);
      alpha = step(max(q.x, q.y * 2.2), 0.44);
    } else if (vKind == 2.0) {
      alpha = step(r, 0.44);                       // hard chunks of debris
    } else {
      alpha = smoothstep(0.5, 0.06, r);            // soft
    }
    if (alpha <= 0.01) discard;
    float fade = vKind == 1.0
      ? smoothstep(0.0, 0.18, vAge) * (1.0 - smoothstep(0.35, 1.0, vAge)) * 0.55
      : (1.0 - vAge * vAge);
    gl_FragColor = vec4(vColor, alpha * fade);
  }
`;

export class VFX {
  constructor(scene) {
    const pos = new Float32Array(MAX * 3);
    const vel = new Float32Array(MAX * 3);
    const dat = new Float32Array(MAX * 4);
    const col = new Float32Array(MAX * 3);
    const knd = new Float32Array(MAX);
    for (let i = 0; i < MAX; i++) dat[i * 4] = -1000;

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
    g.setAttribute('aData', new THREE.BufferAttribute(dat, 4));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aKind', new THREE.BufferAttribute(knd, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);

    this.uniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(devicePixelRatio, 2) }
    };

    this.matAdd = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
    });

    this.points = new THREE.Points(g, this.matAdd);
    this.points.frustumCulled = false;
    this.points.renderOrder = 20;
    scene.add(this.points);

    this.geo = g;
    this.head = 0;
    this.time = 0;
    this._c = new THREE.Color();
  }

  emit(x, y, z, vx, vy, vz, life, size, color, kind) {
    const i = this.head;
    this.head = (this.head + 1) % MAX;
    const p = this.geo.attributes.position.array;
    const v = this.geo.attributes.aVel.array;
    const d = this.geo.attributes.aData.array;
    const c = this.geo.attributes.aColor.array;
    const k = this.geo.attributes.aKind.array;
    p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
    v[i * 3] = vx; v[i * 3 + 1] = vy; v[i * 3 + 2] = vz;
    d[i * 4] = this.time; d[i * 4 + 1] = life; d[i * 4 + 2] = size; d[i * 4 + 3] = 0;
    this._c.setHex(color);
    c[i * 3] = this._c.r; c[i * 3 + 1] = this._c.g; c[i * 3 + 2] = this._c.b;
    k[i] = kind;
    this.dirty = true;
  }

  // ---- recipes ----------------------------------------------------------
  sparks(p, n, color, spread = 9, up = 7) {
    for (let i = 0; i < n; i++) {
      this.emit(p.x, p.y, p.z,
        (Math.random() * 2 - 1) * spread, Math.random() * up, (Math.random() * 2 - 1) * spread,
        0.35 + Math.random() * 0.5, 0.16 + Math.random() * 0.16, color, 0);
    }
  }

  dust(p, n, color, spread = 3) {
    for (let i = 0; i < n; i++) {
      this.emit(p.x, p.y + 0.4, p.z,
        (Math.random() * 2 - 1) * spread, Math.random() * 1.6, (Math.random() * 2 - 1) * spread,
        0.9 + Math.random() * 0.9, 0.6 + Math.random() * 0.8, color, 1);
    }
  }

  trail(p, back, color, size = 0.5) {
    this.emit(p.x, p.y, p.z,
      back.x + (Math.random() * 2 - 1) * 1.4,
      back.y + (Math.random() * 2 - 1) * 1.4 + 1.0,
      back.z + (Math.random() * 2 - 1) * 1.4,
      0.42, size, color, 4);
  }

  debris(p, n, color, power = 16) {
    for (let i = 0; i < n; i++) {
      this.emit(p.x, p.y, p.z,
        (Math.random() * 2 - 1) * power, Math.random() * power * 0.9, (Math.random() * 2 - 1) * power,
        1.4 + Math.random() * 1.6, 0.26 + Math.random() * 0.4, color, 2);
    }
  }

  burst(p, n, color) {
    this.sparks(p, n, color, 15, 12);
    this.dust(p, Math.floor(n * 0.5), 0xffffff, 5);
  }

  confetti(p, n, spread = 26) {
    const cols = [0xff2f6b, 0xffc93d, 0x27e0d0, 0x7a5cff, 0xffffff, 0xff7a3d];
    for (let i = 0; i < n; i++) {
      this.emit(
        p.x + (Math.random() * 2 - 1) * spread,
        p.y + Math.random() * 12,
        p.z + (Math.random() * 2 - 1) * spread,
        (Math.random() * 2 - 1) * 9, 4 + Math.random() * 16, (Math.random() * 2 - 1) * 9,
        2.6 + Math.random() * 2.4, 0.34 + Math.random() * 0.3,
        cols[(Math.random() * cols.length) | 0], 3);
    }
  }

  update(dt) {
    this.time += dt;
    this.uniforms.uTime.value = this.time;
    if (this.dirty) {
      for (const k of ['position', 'aVel', 'aData', 'aColor', 'aKind']) {
        this.geo.attributes[k].needsUpdate = true;
      }
      this.dirty = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Speed lines. A ring of thin quads around the camera that only show up when
// she is really moving. Cheap, and it does more for the sensation of speed than
// any amount of motion blur.
// ---------------------------------------------------------------------------
export function makeSpeedLines() {
  const N = 90;
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 6 * 3);
  const seed = new Float32Array(N * 6);
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + Math.random() * 0.3;
    const r = 0.62 + Math.random() * 0.55;
    const len = 0.10 + Math.random() * 0.30;
    const w = 0.0025 + Math.random() * 0.005;
    const cx = Math.cos(a) * r, cy = Math.sin(a) * r;
    const dx = Math.cos(a), dy = Math.sin(a);
    const px = -dy * w, py = dx * w;
    const quad = [
      [cx + px, cy + py], [cx - px, cy - py], [cx + dx * len + px, cy + dy * len + py],
      [cx + dx * len + px, cy + dy * len + py], [cx - px, cy - py], [cx + dx * len - px, cy + dy * len - py]
    ];
    for (let k = 0; k < 6; k++) {
      pos[(i * 6 + k) * 3] = quad[k][0];
      pos[(i * 6 + k) * 3 + 1] = quad[k][1];
      pos[(i * 6 + k) * 3 + 2] = 0;
      seed[i * 6 + k] = i / N;
    }
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

  const m = new THREE.ShaderMaterial({
    uniforms: { uAmount: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color(0xffffff) } },
    transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: `
      attribute float aSeed;
      uniform float uAmount, uTime;
      varying float vA;
      void main() {
        float flick = fract(aSeed * 43.7 + uTime * 1.7);
        vA = uAmount * smoothstep(0.0, 0.35, flick) * (1.0 - smoothstep(0.6, 1.0, flick));
        vec3 p = position;
        p.xy *= mix(2.3, 1.05, uAmount);
        gl_Position = vec4(p.xy, 0.0, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vA;
      void main() { if (vA < 0.01) discard; gl_FragColor = vec4(uColor, vA * 0.34); }`
  });

  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = 30;
  return mesh;
}
