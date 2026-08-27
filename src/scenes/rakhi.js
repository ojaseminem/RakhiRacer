import * as THREE from 'three';
import { bean, rbox } from '../art/build.js';
import { makeToon, makeGlow } from '../art/materials.js';
import { audio } from '../audio/audio.js';

// ===========================================================================
//                                THE RAKHI
//
//  >>> THIS IS THE PART YOU FILL IN. <<<
//
//  Everything about the gift lives in GIFT below. Change the words, change the
//  colours, and if you want the box to open into something specific, put it in
//  buildGiftContents(). Nothing else in the game touches this file, so you can
//  rewrite the whole thing without breaking anything.
// ===========================================================================

export const GIFT = {
  // the line he says when he hands it over
  line: 'You made it.',

  // the message that appears after. keep it short, it lands harder.
  title: 'HAPPY RAKSHA BANDHAN',
  message: 'You beat the whole family. And Mom.\nSo I think you have earned this.',

  // TODO(ojas): put the actual gift here.
  // Anything you write in `reveal` shows up in the box when it opens. It can be
  // a sentence, a voucher code, a link, a photo, whatever you decide.
  reveal: 'YOUR GIFT GOES HERE',
  revealNote: 'open me',

  // signed
  from: 'from your brother'
};

// ---------------------------------------------------------------------------
// The scene. A quiet platform past the finish line. No explosions, no camera
// shake. After eleven minutes of the world ending, stillness is the effect.
// ---------------------------------------------------------------------------
export function buildRakhiScene(scene, track, t = 0.9985) {
  const g = new THREE.Group();
  const tr = track;
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();

  tr.posAt(t, 0, 34, g.position);
  tr.tanAt(t, _v); tr.upAt(t, _v2);
  _v3.crossVectors(_v2, _v).normalize();
  _v2.crossVectors(_v, _v3).normalize();
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(_v3, _v2, _v));

  const deck = makeToon({ color: 0x241634, rim: 0xffd777, rimStrength: 0.22, rimPower: 4.5, bounceStrength: 0.1 });
  const gold = makeToon({ color: 0xffc93d, rim: 0xffffff, rimStrength: 1.1 });

  const plat = new THREE.Mesh(new THREE.CylinderGeometry(16, 18.5, 2.4, 30), deck);
  plat.position.y = 0.4;
  plat.receiveShadow = true;
  g.add(plat);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(16, 0.42, 8, 48), makeGlow(0xffc93d, 0.9));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 1.5;
  g.add(ring);

  // brother, waiting
  const brother = bean(0x2f7fd4, 0xfff2d0, 2.6);
  brother.position.set(0, 1.62, 8);
  // a soft contact patch under each of them. cheaper and more reliable than
  // hoping the shadow map reaches out here.
  const shade = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false });
  const blobGeo = new THREE.CircleGeometry(1.5, 20);
  const bShade = new THREE.Mesh(blobGeo, shade);
  bShade.rotation.x = -Math.PI / 2;
  bShade.position.y = 1.63;
  g.add(bShade);
  const sShade = new THREE.Mesh(blobGeo, shade);
  sShade.rotation.x = -Math.PI / 2;
  sShade.position.y = 1.63;
  g.add(sShade);
  brother.rotation.y = Math.PI;
  g.add(brother);

  // sister, arrives
  const sister = bean(0xff4f9b, 0xfff2d0, 2.6);
  sister.position.set(0, 1.62, -11);
  g.add(sister);

  // the gift, in his hands
  const gift = new THREE.Group();
  const box = new THREE.Mesh(rbox(3.2, 2.6, 3.2, 0.5), makeToon({
    color: 0xfff6ea, rim: 0xffc93d, rimStrength: 1.2
  }));
  gift.add(box);
  for (const rot of [0, Math.PI / 2]) {
    const rib = new THREE.Mesh(rbox(3.4, 2.8, 0.6, 0.2), gold);
    rib.rotation.y = rot;
    gift.add(rib);
  }
  const bow = new THREE.Mesh(new THREE.TorusKnotGeometry(0.8, 0.28, 48, 8, 2, 3), gold);
  bow.position.y = 1.8;
  gift.add(bow);
  gift.position.set(0, 3.0, 9.4);
  g.add(gift);

  // the rakhi itself, hovering above, slowly turning
  const rakhi = new THREE.Group();
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1.1, 0.36, 90, 10, 2, 5), gold);
  rakhi.add(knot);
  for (const s of [-1, 1]) {
    const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 8, 8),
      makeToon({ color: 0xff2f6b, rim: 0xffd0e0, rimStrength: 1.1 }));
    thread.position.set(s * 4.0, -0.9, 0);
    thread.rotation.z = s * 0.4;
    rakhi.add(thread);
  }
  rakhi.position.set(0, 8.5, 1.5);
  g.add(rakhi);

  scene.add(g);
  return { group: g, brother, sister, gift, rakhi, ring, bShade, sShade, at: t };
}

// ---------------------------------------------------------------------------
// The choreography. Sister walks in, he walks over, he hands it across.
// ---------------------------------------------------------------------------
export function playRakhiScene(sceneRefs, director, hud, onDone) {
  const { group, brother, sister, gift, rakhi, bShade, sShade } = sceneRefs;
  const worldOf = (obj) => obj.getWorldPosition(new THREE.Vector3());

  let time = 0;
  const startSister = sister.position.clone();
  const startBrother = brother.position.clone();
  const startGift = gift.position.clone();

  audio.setStyle('win');
  audio.chime(0);

  const mid = new THREE.Vector3(0, 1.62, -1.6);
  const midB = new THREE.Vector3(0, 1.62, 2.4);
  // they face each other the whole way in
  brother.rotation.y = Math.PI;
  sister.rotation.y = 0;

  director.play({
    dur: 15.0,
    at: (k, t) => {
      time = t;
      // 0 to 4s: she walks in
      const a = THREE.MathUtils.smoothstep(t, 0.6, 4.4);
      sister.position.lerpVectors(startSister, mid, a);
      sister.position.y = 1.62 + Math.abs(Math.sin(t * 5)) * (1 - a) * 0.5;
      sShade.position.z = sister.position.z;
      // 3 to 7s: he walks over
      const b = THREE.MathUtils.smoothstep(t, 3.2, 7.0);
      brother.position.lerpVectors(startBrother, midB, b);
      brother.position.y = 1.62 + Math.abs(Math.sin(t * 5)) * (1 - b) * 0.5;
      bShade.position.z = brother.position.z;
      gift.position.lerpVectors(startGift, new THREE.Vector3(0, 3.0, 1.4), b);
      // 7 to 9s: the handover
      const c = THREE.MathUtils.smoothstep(t, 7.2, 9.2);
      gift.position.z = 1.4 - c * 2.2;
      gift.position.y = 3.0 + Math.sin(c * Math.PI) * 1.0;
      gift.rotation.y = c * Math.PI * 0.6;

      rakhi.rotation.y = t * 0.35;
      rakhi.position.y = 15 + Math.sin(t * 0.8) * 0.8;

      // the camera comes in slowly and stops
      const e = THREE.MathUtils.smoothstep(t, 0, 11);
      const from = new THREE.Vector3(21, 15, -20);
      const to = new THREE.Vector3(8.4, 7.4, -8.2);
      const pos = from.clone().lerp(to, e);
      group.localToWorld(pos);
      const look = new THREE.Vector3(0, 3.4, 0.4);
      group.localToWorld(look);
      return { pos, look, fov: 44 - e * 12 };
    },
    onEnd: () => { if (onDone) onDone(); }
  });

  setTimeout(() => hud.say(GIFT.line, 4.0), 7600);
}

// ---------------------------------------------------------------------------
// The card that appears at the very end. This is the last thing she sees.
// ---------------------------------------------------------------------------
export function showGiftCard(container, onOpen) {
  container.innerHTML = `
    <div class="gift-card">
      <div class="gift-thread"></div>
      <p class="gift-kicker">${GIFT.from.toUpperCase()}</p>
      <h1 class="gift-title">${GIFT.title}</h1>
      <p class="gift-msg">${GIFT.message.replace(/\n/g, '<br>')}</p>
      <button class="gift-box" id="giftbox">
        <span class="gift-lid"></span>
        <span class="gift-ribbon"></span>
        <span class="gift-note">${GIFT.revealNote}</span>
      </button>
      <div class="gift-reveal" id="giftreveal">${GIFT.reveal}</div>
    </div>`;

  const boxEl = container.querySelector('#giftbox');
  const rev = container.querySelector('#giftreveal');
  boxEl.onclick = () => {
    boxEl.classList.add('open');
    rev.classList.add('show');
    audio.confetti();
    audio.chime(3);
    if (onOpen) onOpen();
  };
}
