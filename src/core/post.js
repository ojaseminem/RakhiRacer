import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ---------------------------------------------------------------------------
// One combined finishing pass. Radial speed blur out of the centre, a little
// chromatic split that only shows up under boost, a soft vignette, fine grain
// and the letterbox bars. Doing it in a single shader keeps it cheap enough to
// leave on all the time.
// ---------------------------------------------------------------------------
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSpeed: { value: 0 },
    uAberration: { value: 0 },
    uVignette: { value: 0.55 },
    uGrain: { value: 0.035 },
    uTime: { value: 0 },
    uLetterbox: { value: 0 },
    uDesat: { value: 0 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(0xffffff) },
    uCentre: { value: new THREE.Vector2(0.5, 0.5) },
    uWarp: { value: 0 }
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uSpeed, uAberration, uVignette, uGrain, uTime, uLetterbox, uDesat, uFlash, uWarp;
    uniform vec3 uFlashColor;
    uniform vec2 uCentre;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

    void main() {
      vec2 uv = vUv;

      // gentle barrel warp, ramps with speed. sells the tunnel feeling.
      vec2 d0 = uv - uCentre;
      uv = uCentre + d0 * (1.0 + uWarp * dot(d0, d0));

      vec2 dir = uv - uCentre;
      float dist = length(dir);

      // radial smear, sampled more heavily toward the edges
      vec3 col = vec3(0.0);
      float amt = uSpeed * 0.055;
      if (amt > 0.0005) {
        float total = 0.0;
        for (int i = 0; i < 10; i++) {
          float f = float(i) / 9.0;
          float w = 1.0 - f * 0.75;
          vec2 o = uv - dir * f * amt * smoothstep(0.06, 0.75, dist);
          col += texture2D(tDiffuse, o).rgb * w;
          total += w;
        }
        col /= total;
      } else {
        col = texture2D(tDiffuse, uv).rgb;
      }

      // chromatic split, boost only
      if (uAberration > 0.001) {
        vec2 off = dir * uAberration * 0.024 * smoothstep(0.0, 0.9, dist);
        col.r = texture2D(tDiffuse, uv + off).r;
        col.b = texture2D(tDiffuse, uv - off).b;
      }

      // vignette
      float v = smoothstep(0.95, 0.28, dist);
      col *= mix(1.0, v, uVignette);

      // desaturate, used when everything goes quiet underground
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(lum), uDesat);

      col = mix(col, uFlashColor, uFlash);

      // grain
      float g = hash(gl_FragCoord.xy + fract(uTime) * 137.0) - 0.5;
      col += g * uGrain;

      // letterbox
      float bar = uLetterbox * 0.115;
      if (vUv.y < bar || vUv.y > 1.0 - bar) col = vec3(0.0);

      gl_FragColor = vec4(col, 1.0);
    }
  `
};

export function makePost(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(size, 0.42, 0.62, 0.94);
  composer.addPass(bloom);

  // tone mapping and sRGB happen here, so the finishing pass below works in
  // display space where a vignette and grain actually behave themselves
  composer.addPass(new OutputPass());

  const final = new ShaderPass(FinalShader);
  composer.addPass(final);

  return {
    composer, bloom, final,
    u: final.uniforms,
    setSize(w, h) { composer.setSize(w, h); bloom.setSize(w, h); },
    render(dt) {
      final.uniforms.uTime.value += dt;
      composer.render(dt);
    }
  };
}
