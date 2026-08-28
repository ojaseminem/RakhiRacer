import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';

// ---------------------------------------------------------------------------
// The finishing chain.
//
//   render  ->  ambient occlusion  ->  bloom  ->  tone map  ->  grade  ->  AA
//
// The occlusion pass is the one that matters. Stylised flat shading with no
// contact darkening is exactly what makes a 3D scene read as untextured
// geometry floating in a void, and putting it back is worth more than any
// amount of extra polygons.
//
// The grade after tone mapping is a real lift/gamma/gain with a contrast curve
// and a split tone, so the palette can be pushed as a whole rather than by
// hand tuning forty material colours.
// ---------------------------------------------------------------------------

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },

    // grade
    uLift: { value: new THREE.Vector3(0.0, 0.0, 0.012) },
    uGamma: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
    uGain: { value: new THREE.Vector3(1.04, 1.0, 0.98) },
    uContrast: { value: 1.16 },
    uSaturation: { value: 1.18 },
    uShadowTone: { value: new THREE.Color(0x1b2a5c) },
    uHighTone: { value: new THREE.Color(0xffe8c4) },
    uToneAmt: { value: 0.16 },

    // motion and state
    uSpeed: { value: 0 },
    uAberration: { value: 0 },
    uVignette: { value: 0.62 },
    uGrain: { value: 0.028 },
    uTime: { value: 0 },
    uLetterbox: { value: 0 },
    uDesat: { value: 0 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(0xffffff) },
    uCentre: { value: new THREE.Vector2(0.5, 0.5) },
    uWarp: { value: 0 },
    uBleach: { value: 0 }
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec3 uLift, uGamma, uGain, uShadowTone, uHighTone, uFlashColor;
    uniform float uContrast, uSaturation, uToneAmt;
    uniform float uSpeed, uAberration, uVignette, uGrain, uTime, uLetterbox, uDesat, uFlash, uWarp, uBleach;
    uniform vec2 uCentre;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

    void main() {
      vec2 uv = vUv;

      // gentle barrel warp that ramps with speed
      vec2 d0 = uv - uCentre;
      uv = uCentre + d0 * (1.0 + uWarp * dot(d0, d0));

      vec2 dir = uv - uCentre;
      float dist = length(dir);

      // radial smear, weighted toward the edges of frame
      vec3 col;
      float amt = uSpeed * 0.055;
      if (amt > 0.0005) {
        float total = 0.0;
        col = vec3(0.0);
        for (int i = 0; i < 10; i++) {
          float f = float(i) / 9.0;
          float w = 1.0 - f * 0.75;
          col += texture2D(tDiffuse, uv - dir * f * amt * smoothstep(0.06, 0.75, dist)).rgb * w;
          total += w;
        }
        col /= total;
      } else {
        col = texture2D(tDiffuse, uv).rgb;
      }

      if (uAberration > 0.001) {
        vec2 off = dir * uAberration * 0.026 * smoothstep(0.0, 0.9, dist);
        col.r = texture2D(tDiffuse, uv + off).r;
        col.b = texture2D(tDiffuse, uv - off).b;
      }

      // ---- grade ----
      col = max(col, 0.0);
      col = col * uGain + uLift;                                  // lift and gain
      col = pow(max(col, 0.0), 1.0 / max(uGamma, vec3(0.001)));   // gamma

      // contrast about mid grey, as an s curve rather than a straight scale
      col = (col - 0.5) * uContrast + 0.5;
      col = clamp(col, 0.0, 1.0);
      col = col * col * (3.0 - 2.0 * col) * 0.30 + col * 0.70;

      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(lum), col, uSaturation);

      // split tone: cool into the shadows, warm into the highlights
      col += uShadowTone * (1.0 - smoothstep(0.0, 0.55, lum)) * uToneAmt;
      col += uHighTone * smoothstep(0.55, 1.0, lum) * uToneAmt * 0.55;

      // bleach bypass, used when the world drains out underground
      if (uBleach > 0.001) col = mix(col, vec3(lum) * 1.15, uBleach);

      float v = smoothstep(1.02, 0.24, dist);
      col *= mix(1.0, v, uVignette);

      col = mix(col, vec3(lum), uDesat);
      col = mix(col, uFlashColor, uFlash);

      col += (hash(gl_FragCoord.xy + fract(uTime) * 137.0) - 0.5) * uGrain;

      float bar = uLetterbox * 0.115;
      if (vUv.y < bar || vUv.y > 1.0 - bar) col = vec3(0.0);

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `
};

export function makePost(renderer, scene, camera, opts = {}) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // ---- ambient occlusion ----
  let gtao = null;
  if (opts.ao !== false) {
    gtao = new GTAOPass(scene, camera, size.x, size.y);
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.blendIntensity = 1.0;
    gtao.updateGtaoMaterial({
      radius: 1.6,          // metres. the world is in metres, so this is a real distance
      distanceExponent: 1.0,
      thickness: 1.4,
      scale: 1.0,
      samples: 8,
      distanceFallOff: 1.0,
      screenSpaceRadius: false
    });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, radiusExponent: 1, rings: 2, samples: 6 });
    composer.addPass(gtao);
  }

  // only genuinely bright things should bloom: kerbs, neon, lava, headlights.
  const bloom = new UnrealBloomPass(size, 0.46, 0.42, 0.94);
  composer.addPass(bloom);

  composer.addPass(new OutputPass());

  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  const smaa = new SMAAPass(size.x, size.y);
  composer.addPass(smaa);

  return {
    composer, bloom, grade, gtao, smaa,
    u: grade.uniforms,
    setAO(on) { if (gtao) gtao.enabled = on; },
    setSize(w, h) {
      composer.setSize(w, h);
      bloom.setSize(w, h);
      if (gtao) gtao.setSize(w, h);
      smaa.setSize(w, h);
    },
    render(dt) {
      grade.uniforms.uTime.value += dt;
      composer.render(dt);
    }
  };
}
