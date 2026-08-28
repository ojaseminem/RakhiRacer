import * as THREE from 'three';

// ---------------------------------------------------------------------------
// The look.
//
// Nothing here uses physically based shading. Every surface is a hard stepped
// ramp with four things layered on top, and it is those four that stop it
// reading as untextured geometry:
//
//   1. a cool tint poured into the shadow side, so shade is blue and not black
//   2. a sky term on upward facing surfaces, so tops lift away from sides
//   3. a fresnel rim, tight and bright, which is what draws the silhouette
//   4. a slow world space noise, so no two square metres are exactly the flat
//      same colour
//
// It is built on MeshToonMaterial so shadows, fog, instancing and vertex
// colours keep working, and the sun direction arrives as a view space uniform
// so the shading terms cost almost nothing.
// ---------------------------------------------------------------------------

const ALL = [];   // every material we make, so the sun uniform can be pushed once a frame

// A stepped ramp with a deliberately tight terminator and a broad lit side.
let RAMP = null;
function ramp() {
  if (RAMP) return RAMP;
  const data = new Uint8Array([38, 74, 132, 196, 236, 255]);
  RAMP = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  RAMP.minFilter = RAMP.magFilter = THREE.NearestFilter;
  RAMP.needsUpdate = true;
  return RAMP;
}

const PARS_V = /* glsl */`
  varying vec3 vWPos;
  varying vec3 vWNrm;
`;
// Instanced meshes carry their transform in instanceMatrix rather than
// modelMatrix, so world position has to be built by hand here. Getting this
// wrong makes every instance share one position, which silently kills both the
// windows and the surface noise.
const MAIN_V = /* glsl */`
  vec4 rkWPos = vec4(transformed, 1.0);
  vec3 rkNrm = objectNormal;
  #ifdef USE_INSTANCING
    rkWPos = instanceMatrix * rkWPos;
    rkNrm = mat3(instanceMatrix) * rkNrm;
  #endif
  rkWPos = modelMatrix * rkWPos;
  vWPos = rkWPos.xyz;
  vWNrm = normalize(mat3(modelMatrix) * rkNrm);
`;

const PARS_F = /* glsl */`
  uniform vec3 uSunView;        // sun direction, view space
  uniform vec3 uUpView;         // world up, view space
  uniform vec3 uShadowTint;
  uniform float uShadowAmt;
  uniform vec3 uSkyTint;
  uniform float uSkyAmt;
  uniform vec3 uRimColor;
  uniform float uRimPower;
  uniform float uRimAmt;
  uniform vec3 uBounceColor;
  uniform float uBounceAmt;
  uniform float uNoiseAmt;
  uniform float uNoiseScale;
  uniform float uFlashAmount;
  uniform vec3 uFlashColor;
  uniform vec2 uWinSize;
  uniform vec3 uWinColor;
  uniform vec3 uWinDark;
  uniform float uWinAmt;
  uniform float uWinLitChance;
  varying vec3 vWPos;
  varying vec3 vWNrm;

  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  // cheap value noise, three octaves. enough to break up a flat face without
  // ever being legible as a pattern.
  float h31(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float vnoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n = mix(
      mix(mix(h31(i + vec3(0,0,0)), h31(i + vec3(1,0,0)), f.x),
          mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x),
          mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
    return n;
  }
`;

const MAIN_F = /* glsl */`
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewPosition);

  // how lit this fragment is, taken straight from the key light rather than
  // unpicking what the toon lighting already did
  float ndl = dot(N, normalize(uSunView));
  float shade = smoothstep(-0.35, 0.30, ndl);

  // shadows go cool instead of dark. this one line does most of the work.
  gl_FragColor.rgb = mix(gl_FragColor.rgb * (1.0 - uShadowAmt * 0.55) + uShadowTint * uShadowAmt,
                         gl_FragColor.rgb, shade);

  // sky light on upward faces separates horizontal from vertical surfaces
  float up = max(dot(N, normalize(uUpView)), 0.0);
  gl_FragColor.rgb += uSkyTint * pow(up, 1.4) * uSkyAmt;

  // bounce coming back up off the ground keeps undersides from dying
  float down = max(-dot(N, normalize(uUpView)), 0.0);
  gl_FragColor.rgb += uBounceColor * down * down * uBounceAmt;

  // the rim. tight, bright, and the reason anything reads at a distance.
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), uRimPower);
  gl_FragColor.rgb += uRimColor * fres * uRimAmt;

  // surface break up
  if (uNoiseAmt > 0.0001) {
    float n = vnoise(vWPos * uNoiseScale) * 0.6
            + vnoise(vWPos * uNoiseScale * 3.7) * 0.3
            + vnoise(vWPos * uNoiseScale * 11.0) * 0.1;
    gl_FragColor.rgb *= 1.0 + (n - 0.5) * uNoiseAmt;
  }

  // ---- windows ----------------------------------------------------------
  // Drawn in the shader from world position rather than placed as geometry, so
  // a thousand buildings all get lit windows for the cost of a few instructions.
  if (uWinAmt > 0.0001) {
    vec3 wn = normalize(vWNrm);
    float vertical = 1.0 - smoothstep(0.35, 0.6, abs(wn.y));
    vec2 uvw = abs(wn.x) > abs(wn.z) ? vec2(vWPos.z, vWPos.y) : vec2(vWPos.x, vWPos.y);
    vec2 g = uvw / uWinSize;
    vec2 cell = floor(g);
    vec2 f = fract(g);
    float pane = step(0.16, f.x) * step(f.x, 0.84) * step(0.22, f.y) * step(f.y, 0.80);
    float r = h21(cell + floor(vWPos.xz * 0.0137));
    float lit = step(1.0 - uWinLitChance, r);
    float bright = 0.55 + 0.45 * h21(cell * 1.37 + 7.1);
    // an unlit pane is the wall's own colour darkened and pushed cool, not a
    // fixed navy. otherwise every building in the game turns into night time.
    vec3 dark = gl_FragColor.rgb * uWinDark;
    vec3 pc = mix(dark, uWinColor * bright, lit);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, pc, pane * vertical * uWinAmt);
  }

  gl_FragColor.rgb = mix(gl_FragColor.rgb, uFlashColor, uFlashAmount);
`;

export function makeToon(opts = {}) {
  const m = new THREE.MeshToonMaterial({
    color: opts.color ?? 0xffffff,
    gradientMap: ramp(),
    transparent: !!opts.transparent,
    opacity: opts.opacity ?? 1,
    vertexColors: !!opts.vertexColors,
    emissive: opts.emissive ?? 0x000000,
    side: opts.side ?? THREE.FrontSide,
    depthWrite: opts.depthWrite !== false,
    fog: opts.fog !== false,
    flatShading: !!opts.flatShading
  });

  const u = {
    uSunView: { value: new THREE.Vector3(0.4, 0.8, 0.4) },
    uUpView: { value: new THREE.Vector3(0, 1, 0) },
    uShadowTint: { value: new THREE.Color(opts.shadowTint ?? 0x2a2f6e) },
    uShadowAmt: { value: opts.shadowAmt ?? 0.42 },
    uSkyTint: { value: new THREE.Color(opts.skyTint ?? 0x8fc4ff) },
    uSkyAmt: { value: opts.skyAmt ?? 0.16 },
    uRimColor: { value: new THREE.Color(opts.rim ?? 0xffffff) },
    uRimPower: { value: opts.rimPower ?? 3.0 },
    uRimAmt: { value: opts.rimStrength ?? 0.5 },
    uBounceColor: { value: new THREE.Color(opts.bounce ?? 0x40305a) },
    uBounceAmt: { value: opts.bounceStrength ?? 0.26 },
    uNoiseAmt: { value: opts.noise ?? 0.10 },
    uNoiseScale: { value: opts.noiseScale ?? 0.11 },
    uFlashColor: { value: new THREE.Color(0xffffff) },
    uFlashAmount: { value: 0 },
    uWinSize: { value: new THREE.Vector2(opts.winSize ? opts.winSize[0] : 5.5, opts.winSize ? opts.winSize[1] : 7.5) },
    uWinColor: { value: new THREE.Color(opts.winColor ?? 0xffe9a8) },
    uWinDark: { value: new THREE.Color(opts.winDark ?? 0x6e7f9e) },   // multiplier, not a colour
    uWinAmt: { value: opts.windows ?? 0 },
    uWinLitChance: { value: opts.winLit ?? 0.42 }
  };
  m.userData.u = u;

  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + PARS_V)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + MAIN_V);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + PARS_F)
      .replace('#include <dithering_fragment>', MAIN_F + '\n#include <dithering_fragment>');
  };
  m.customProgramCacheKey = () => 'toonrim5';
  ALL.push(m);
  return m;
}

// Push the frame's lighting direction into every material at once.
const _sv = new THREE.Vector3(), _uv = new THREE.Vector3();
export function syncLighting(camera, sunWorldDir, shadowTint, skyTint, shadowAmt, skyAmt) {
  const vm = camera.matrixWorldInverse;
  _sv.copy(sunWorldDir).transformDirection(vm);
  _uv.set(0, 1, 0).transformDirection(vm);
  for (const m of ALL) {
    const u = m.userData.u;
    if (!u) continue;
    u.uSunView.value.copy(_sv);
    u.uUpView.value.copy(_uv);
    if (shadowTint) u.uShadowTint.value.copy(shadowTint);
    if (skyTint) u.uSkyTint.value.copy(skyTint);
    if (shadowAmt !== undefined) u.uShadowAmt.value = shadowAmt * (m.userData.shadowScale ?? 1);
    if (skyAmt !== undefined) u.uSkyAmt.value = skyAmt * (m.userData.skyScale ?? 1);
  }
}

// ---------------------------------------------------------------------------
// Toon outline, the inverted hull trick: the same geometry again, scaled a
// hair, with only the back faces drawn in near black. Costs one extra draw and
// it is the difference between a shape reading against the background and
// dissolving into it.
// ---------------------------------------------------------------------------
export function addOutline(object, thickness = 0.035, color = 0x140a1c) {
  const mat = new THREE.MeshBasicMaterial({
    color, side: THREE.BackSide, fog: true, toneMapped: false
  });
  const add = [];
  object.traverse((o) => {
    if (!o.isMesh || o.userData.noOutline) return;
    if (o.material && o.material.blending === THREE.AdditiveBlending) return;
    if (o.material && o.material.transparent && o.material.opacity < 0.95) return;
    add.push(o);
  });
  for (const o of add) {
    const s = new THREE.Mesh(o.geometry, mat);
    s.position.copy(o.position);
    s.quaternion.copy(o.quaternion);
    s.scale.copy(o.scale).multiplyScalar(1 + thickness);
    s.renderOrder = -1;
    s.userData.noOutline = true;
    s.castShadow = false;
    s.receiveShadow = false;
    o.parent.add(s);
  }
  return object;
}

// Unlit, additive. Neon, lava, boost trails, item boxes, Mom's eyes.
export function makeGlow(color, opacity = 1, additive = true) {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false, fog: false, toneMapped: false
  });
}

export function makeFlat(color) {
  return new THREE.MeshBasicMaterial({ color, fog: true });
}

// ---------------------------------------------------------------------------
// Sky. A four stop gradient with a banded horizon, a sun disc with a proper
// halo, and a haze band sitting on the horizon line so the world has somewhere
// to fade into rather than just stopping.
// ---------------------------------------------------------------------------
export function makeSky() {
  const geo = new THREE.SphereGeometry(1, 48, 28);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x7fd8ff) },
      uMid: { value: new THREE.Color(0xffd6ec) },
      uBot: { value: new THREE.Color(0xfff3c4) },
      uHaze: { value: new THREE.Color(0xffffff) },
      uSun: { value: new THREE.Vector3(0.4, 0.8, 0.35) },
      uSunColor: { value: new THREE.Color(0xfff2d0) },
      uSunSize: { value: 0.9955 },
      uHazeAmt: { value: 0.55 }
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vDir;
      uniform vec3 uTop, uMid, uBot, uHaze, uSunColor, uSun;
      uniform float uSunSize, uHazeAmt;

      float dither(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

      void main() {
        vec3 d = normalize(vDir);
        float h = d.y * 0.5 + 0.5;

        vec3 c = h < 0.5
          ? mix(uBot, uMid, smoothstep(0.10, 0.5, h))
          : mix(uMid, uTop, smoothstep(0.5, 0.95, h));

        // a band of haze sitting on the horizon, which is what makes a sky read
        // as atmosphere rather than a gradient
        float band = exp(-pow((d.y + 0.02) * 7.0, 2.0));
        c = mix(c, uHaze, band * uHazeAmt);

        vec3 sd = normalize(uSun);
        float s = dot(d, sd);
        c += uSunColor * smoothstep(uSunSize, 1.0, s) * 1.35;        // the disc
        c += uSunColor * pow(max(s, 0.0), 10.0) * 0.16;              // close halo
        c += uSunColor * pow(max(s, 0.0), 3.0) * 0.06;               // wide glow

        // a touch of dither kills the banding a wide gradient always shows
        c += (dither(gl_FragCoord.xy) - 0.5) * 0.006;
        gl_FragColor = vec4(c, 1.0);
      }
    `
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.setScalar(9000);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}

// ---------------------------------------------------------------------------
// Per sector palette blending, so the world changes colour over a few seconds
// rather than snapping at a boundary.
// ---------------------------------------------------------------------------
const _a = new THREE.Color(), _b = new THREE.Color();
const _shadow = new THREE.Color(), _sky = new THREE.Color();

export function blendSector(env, from, to, k) {
  const { sky, fog, sun, ambient, rim } = env;
  const su = sky.material.uniforms;
  su.uTop.value.setHex(from.sky[0]).lerp(_a.setHex(to.sky[0]), k);
  su.uMid.value.setHex(from.sky[1]).lerp(_a.setHex(to.sky[1]), k);
  su.uBot.value.setHex(from.sky[2]).lerp(_a.setHex(to.sky[2]), k);
  su.uHaze.value.setHex(from.fog).lerp(_a.setHex(to.fog), k);
  su.uHazeAmt.value = (from.haze ?? 0.5) + ((to.haze ?? 0.5) - (from.haze ?? 0.5)) * k;
  su.uSunColor.value.setHex(from.sun).lerp(_a.setHex(to.sun), k);
  su.uSun.value.set(
    from.sunPos[0] + (to.sunPos[0] - from.sunPos[0]) * k,
    from.sunPos[1] + (to.sunPos[1] - from.sunPos[1]) * k,
    from.sunPos[2] + (to.sunPos[2] - from.sunPos[2]) * k
  );

  fog.color.setHex(from.fog).lerp(_a.setHex(to.fog), k);
  fog.near = from.fogNear + (to.fogNear - from.fogNear) * k;
  fog.far = from.fogFar + (to.fogFar - from.fogFar) * k;

  sun.color.setHex(from.sun).lerp(_a.setHex(to.sun), k);
  sun.intensity = (from.sunI ?? 1.6) + ((to.sunI ?? 1.6) - (from.sunI ?? 1.6)) * k;

  ambient.color.setHex(from.amb).lerp(_b.setHex(to.amb), k);
  ambient.groundColor.setHex(from.ground).lerp(_b.setHex(to.ground), k);
  ambient.intensity = from.ambI + (to.ambI - from.ambI) * k;

  if (rim) {
    rim.color.setHex(from.rim).lerp(_a.setHex(to.rim), k);
    rim.intensity = (from.rimI ?? 0.9) + ((to.rimI ?? 0.9) - (from.rimI ?? 0.9)) * k;
  }

  _shadow.setHex(from.shadowTint ?? 0x2a2f6e).lerp(_a.setHex(to.shadowTint ?? 0x2a2f6e), k);
  _sky.setHex(from.skyTint ?? 0x8fc4ff).lerp(_a.setHex(to.skyTint ?? 0x8fc4ff), k);

  return {
    shadowTint: _shadow,
    skyTint: _sky,
    shadowAmt: (from.shadowAmt ?? 0.42) + ((to.shadowAmt ?? 0.42) - (from.shadowAmt ?? 0.42)) * k,
    skyAmt: (from.skyAmt ?? 0.16) + ((to.skyAmt ?? 0.16) - (from.skyAmt ?? 0.16)) * k
  };
}
