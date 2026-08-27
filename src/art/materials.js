import * as THREE from 'three';

// ---------------------------------------------------------------------------
// The look.
//
// Nothing in this game uses physically based shading. Everything is a hard
// three band toon ramp with a strong fresnel rim and a warm bounce term coming
// up from underneath, which is what makes the world read as moulded vinyl
// instead of metal. Building it on top of MeshToonMaterial rather than a raw
// ShaderMaterial means shadows, fog, instancing and vertex colours all keep
// working for free.
// ---------------------------------------------------------------------------

let RAMP = null;
function ramp() {
  if (RAMP) return RAMP;
  // four steps, weighted so the lit side stays broad and the terminator is tight
  const data = new Uint8Array([56, 108, 190, 255]);
  RAMP = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  RAMP.minFilter = RAMP.magFilter = THREE.NearestFilter;
  RAMP.needsUpdate = true;
  return RAMP;
}

const RIM_PARS = /* glsl */`
  uniform vec3 uRimColor;
  uniform float uRimPower;
  uniform float uRimStrength;
  uniform vec3 uBounceColor;
  uniform float uBounceStrength;
  uniform float uFlashAmount;
  uniform vec3 uFlashColor;
`;

const RIM_MAIN = /* glsl */`
  vec3 vN = normalize(vNormal);
  vec3 vV = normalize(vViewPosition);
  float fres = pow(1.0 - clamp(dot(vN, vV), 0.0, 1.0), uRimPower);
  gl_FragColor.rgb += uRimColor * fres * uRimStrength;
  // light bouncing back up off the ground keeps the undersides from going dead
  float bounce = clamp(-vN.y, 0.0, 1.0);
  gl_FragColor.rgb += uBounceColor * bounce * bounce * uBounceStrength;
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
    fog: opts.fog !== false
  });

  const u = {
    uRimColor: { value: new THREE.Color(opts.rim ?? 0xffffff) },
    uRimPower: { value: opts.rimPower ?? 2.4 },
    uRimStrength: { value: opts.rimStrength ?? 0.55 },
    uBounceColor: { value: new THREE.Color(opts.bounce ?? 0x402a55) },
    uBounceStrength: { value: opts.bounceStrength ?? 0.30 },
    uFlashColor: { value: new THREE.Color(0xffffff) },
    uFlashAmount: { value: 0 }
  };
  m.userData.u = u;

  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + RIM_PARS)
      .replace(
        '#include <dithering_fragment>',
        RIM_MAIN + '\n#include <dithering_fragment>'
      );
  };
  m.customProgramCacheKey = () => 'toonrim';
  return m;
}

// Unlit, additive. Used for anything that is supposed to be its own light
// source: neon, lava cracks, boost trails, item boxes, Mom's eyes.
export function makeGlow(color, opacity = 1, additive = true) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false
  });
}

// Flat unlit but fogged, for very distant scenery where shading is wasted.
export function makeFlat(color) {
  return new THREE.MeshBasicMaterial({ color, fog: true });
}

// ---------------------------------------------------------------------------
// Sky. A three stop vertical gradient on an inverted sphere, plus a soft sun
// disc that we can move per sector. No HDRIs, no equirect maps.
// ---------------------------------------------------------------------------
export function makeSky() {
  const geo = new THREE.SphereGeometry(1, 40, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x7fd8ff) },
      uMid: { value: new THREE.Color(0xffd6ec) },
      uBot: { value: new THREE.Color(0xfff3c4) },
      uSun: { value: new THREE.Vector3(0.4, 0.8, 0.35) },
      uSunColor: { value: new THREE.Color(0xfff2d0) },
      uSunSize: { value: 0.982 },
      uBands: { value: 0.0 }
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;   // always at the far plane
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vDir;
      uniform vec3 uTop, uMid, uBot, uSunColor;
      uniform vec3 uSun;
      uniform float uSunSize, uBands;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y * 0.5 + 0.5;
        // posterise the gradient a touch so it matches the toon shading
        float hb = mix(h, floor(h * 14.0) / 14.0, uBands);
        vec3 c = hb < 0.5
          ? mix(uBot, uMid, smoothstep(0.16, 0.5, hb))
          : mix(uMid, uTop, smoothstep(0.5, 0.92, hb));
        float s = dot(d, normalize(uSun));
        c += uSunColor * smoothstep(uSunSize, 1.0, s) * 1.6;
        c += uSunColor * pow(max(s, 0.0), 12.0) * 0.22;
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
// Per sector palette blending. Called every frame with the two sectors either
// side of the player and a blend factor, so the world changes colour smoothly
// instead of snapping at a boundary.
// ---------------------------------------------------------------------------
const _a = new THREE.Color(), _b = new THREE.Color();

export function blendSector(env, from, to, k) {
  const { sky, fog, sun, ambient } = env;
  const su = sky.material.uniforms;
  su.uTop.value.setHex(from.sky[0]).lerp(_a.setHex(to.sky[0]), k);
  su.uMid.value.setHex(from.sky[1]).lerp(_a.setHex(to.sky[1]), k);
  su.uBot.value.setHex(from.sky[2]).lerp(_a.setHex(to.sky[2]), k);
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
  ambient.color.setHex(from.amb).lerp(_b.setHex(to.amb), k);
  ambient.intensity = from.ambI + (to.ambI - from.ambI) * k;

  sun.position.set(
    from.sunPos[0] + (to.sunPos[0] - from.sunPos[0]) * k,
    from.sunPos[1] + (to.sunPos[1] - from.sunPos[1]) * k,
    from.sunPos[2] + (to.sunPos[2] - from.sunPos[2]) * k
  ).normalize().multiplyScalar(900);
}
