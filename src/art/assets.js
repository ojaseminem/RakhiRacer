import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeToon, addOutline } from './materials.js';

// ---------------------------------------------------------------------------
// Drop-in models.
//
// Everything in this game is generated in code and works with no downloads at
// all. But if you want a nicer car, put a .glb in assets/models/ with the right
// filename and it will be used instead, automatically, with no code changes.
//
// Anything that loads is re-materialled into the game's toon shading, keeping
// the model's own colours. That is deliberate: a downloaded model dropped in
// with its original PBR materials would look pasted on top of the game rather
// than part of it.
//
// Each slot below says what filename to use and roughly what size and facing
// the game expects. If a model comes in the wrong way round, fix it here rather
// than in Blender.
//
//   forward   which way the model's nose points in its own file
//   size      the length in metres the game will scale it to
//   lift      metres to raise it, if its origin is not on the ground
// ---------------------------------------------------------------------------

export const MANIFEST = {
  // ---- the three hero rides ----
  velocity: { file: 'velocity.glb', size: 4.8, forward: '+z', lift: 0 },
  beast: { file: 'beast.glb', size: 5.6, forward: '+z', lift: 0 },
  comet: { file: 'comet.glb', size: 4.6, forward: '+z', lift: 0.3 },

  // ---- the family ----
  sports: { file: 'family-sports.glb', size: 4.2, forward: '+z', lift: 0 },
  sedan: { file: 'family-sedan.glb', size: 4.4, forward: '+z', lift: 0 },
  suv: { file: 'family-suv.glb', size: 4.8, forward: '+z', lift: 0 },
  hatch: { file: 'family-hatch.glb', size: 3.2, forward: '+z', lift: 0 },
  auto: { file: 'family-auto.glb', size: 2.7, forward: '+z', lift: 0 },
  ambassador: { file: 'family-ambassador.glb', size: 4.4, forward: '+z', lift: 0 },
  oldcar: { file: 'family-oldcar.glb', size: 3.0, forward: '+z', lift: 0 },
  jeep: { file: 'family-jeep.glb', size: 3.9, forward: '+z', lift: 0 },

  // ---- the two avatars at the end ----
  brother: { file: 'brother.glb', size: 2.6, forward: '+z', lift: 0 },
  sister: { file: 'sister.glb', size: 2.6, forward: '+z', lift: 0 }
};

const CACHE = new Map();
let loadedAny = false;

export function hasModel(slot) { return CACHE.has(slot); }
export function anyModelsLoaded() { return loadedAny; }

// A fresh copy, already scaled, oriented and outlined.
export function getModel(slot) {
  const entry = CACHE.get(slot);
  if (!entry) return null;
  const g = entry.scene.clone(true);
  const wrap = new THREE.Group();
  wrap.add(g);
  return wrap;
}

// ---------------------------------------------------------------------------
// Re-shade an imported model into the game's look, keeping its own colours.
// ---------------------------------------------------------------------------
function restyle(root) {
  const swapped = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!src) return;

    let m = swapped.get(src);
    if (!m) {
      const col = src.color ? src.color.getHex() : 0xcccccc;
      const emissive = src.emissive ? src.emissive.getHex() : 0x000000;
      const bright = src.color ? (src.color.r + src.color.g + src.color.b) / 3 : 0.5;
      m = makeToon({
        color: col,
        emissive,
        rim: 0xffffff,
        rimStrength: 0.55 + (1 - bright) * 0.4,
        rimPower: 2.6,
        bounceStrength: 0.3,
        noise: 0.06,
        transparent: !!src.transparent,
        opacity: src.opacity ?? 1,
        flatShading: !!src.flatShading
      });
      // keep any baked texture the model brought with it
      if (src.map) m.map = src.map;
      swapped.set(src, m);
    }
    o.material = m;
  });
  return root;
}

// Normalise scale and facing so the game can treat every model identically.
function normalise(root, entry) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const centre = new THREE.Vector3();
  box.getCenter(centre);

  // face the model down +z
  switch (entry.forward) {
    case '-z': root.rotation.y = Math.PI; break;
    case '+x': root.rotation.y = -Math.PI / 2; break;
    case '-x': root.rotation.y = Math.PI / 2; break;
    default: break;
  }
  root.updateMatrixWorld(true);

  // rescale so the long axis matches the size the game expects
  const box2 = new THREE.Box3().setFromObject(root);
  const s2 = new THREE.Vector3();
  box2.getSize(s2);
  const longest = Math.max(s2.z, s2.x);
  const scale = longest > 0.001 ? entry.size / longest : 1;
  root.scale.setScalar(scale);
  root.updateMatrixWorld(true);

  // sit it on the ground, centred left to right and front to back
  const box3 = new THREE.Box3().setFromObject(root);
  const c3 = new THREE.Vector3();
  box3.getCenter(c3);
  root.position.x -= c3.x;
  root.position.z -= c3.z;
  root.position.y -= box3.min.y;
  root.position.y += entry.lift || 0;
  return root;
}

// ---------------------------------------------------------------------------
// Load whatever happens to be there. Missing files are not an error, they just
// mean that slot keeps its built in model.
// ---------------------------------------------------------------------------
export async function loadDropInModels(base = './assets/models/', onProgress) {
  // index.json says which models are actually present. Probing for every slot
  // instead would spray a dozen 404s into the console on every single load,
  // which is a horrible thing to leave in a finished game.
  let index = [];
  try {
    const res = await fetch(base + 'index.json', { cache: 'no-cache' });
    if (res.ok) index = await res.json();
  } catch (e) { /* no index, no drop-ins, nothing to do */ }
  if (!Array.isArray(index) || !index.length) return 0;

  const wanted = new Set(index.map(String));
  const loader = new GLTFLoader();
  const slots = Object.keys(MANIFEST).filter(k => wanted.has(MANIFEST[k].file) || wanted.has(k));
  let done = 0;

  await Promise.all(slots.map(async (slot) => {
    const entry = MANIFEST[slot];
    const url = base + entry.file;
    try {
      const gltf = await loader.loadAsync(url);
      const scene = gltf.scene || gltf.scenes[0];
      restyle(scene);
      normalise(scene, entry);
      addOutline(scene, 0.04);
      CACHE.set(slot, { scene, entry });
      loadedAny = true;
    } catch (e) {
      console.warn(`[rakhi] could not use ${entry.file}, keeping the built in model`, e.message);
    } finally {
      done++;
      if (onProgress) onProgress(done, slots.length);
    }
  }));

  return CACHE.size;
}
