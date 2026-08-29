import * as THREE from 'three';
import { SECTORS, VEHICLES, TRACK, sectorAt } from './config.js';
import { Track, buildRoadMesh, buildBarriers } from './world/track.js';
import { makeToon, makeSky, blendSector, syncLighting } from './art/materials.js';
import { HERO_BUILDERS } from './art/build.js';
import { loadDropInModels, anyModelsLoaded } from './art/assets.js';
import { VFX, makeSpeedLines } from './art/vfx.js';
import { Director } from './core/director.js';
import { Input } from './core/input.js';
import { makePost } from './core/post.js';
import { buildWorld } from './world/props.js';
import { HUD } from './ui/hud.js';
import { Race } from './game/race.js';
import { audio } from './audio/audio.js';
import { buildRakhiScene, playRakhiScene, showGiftCard } from './scenes/rakhi.js';

const qs = new URLSearchParams(location.search);
const DEV = qs.has('dev');
const $ = (id) => document.getElementById(id);
function setStatus(t) { const e = $('boot-status'); if (e) e.textContent = t; }

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------
const canvas = $('stage');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: true, powerPreference: 'high-performance', stencil: false
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.96;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.5, 120000);
scene.fog = new THREE.Fog(0xbfe9ff, 900, 6200);

const sky = makeSky();
scene.add(sky);

// A three light rig. The key throws the shadows and sets the colour of light,
// the hemisphere fills from sky above and ground below, and the rim sits behind
// the action to cut every silhouette away from the background. One flat
// directional plus one ambient, which is what this had before, is exactly what
// makes a scene look like untextured geometry.
const sun = new THREE.DirectionalLight(0xfff0cc, 1.42);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 8;
sun.shadow.camera.far = 620;
const SH = 110;
sun.shadow.camera.left = -SH; sun.shadow.camera.right = SH;
sun.shadow.camera.top = SH; sun.shadow.camera.bottom = -SH;
sun.shadow.bias = -0.0008;
sun.shadow.normalBias = 0.45;
sun.shadow.radius = 3;
scene.add(sun, sun.target);

const ambient = new THREE.HemisphereLight(0x9fd0ff, 0x6b4f9e, 0.48);
scene.add(ambient);

const rim = new THREE.DirectionalLight(0xfff0c0, 0.42);
rim.castShadow = false;
scene.add(rim, rim.target);

const env = { sky, fog: scene.fog, sun, ambient, rim };
const _sunDir = new THREE.Vector3();

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------
// Any .glb dropped into assets/models/ replaces the built in version of that
// vehicle. Nothing there is the normal case, and the game does not care.
setStatus('looking for models');
const foundModels = await loadDropInModels('./assets/models/');
if (foundModels) console.info(`[rakhi] using ${foundModels} drop-in model(s)`);

setStatus('shaping the rakhi');
const track = new Track();

setStatus('paving thirty kilometres');
const roadMat = makeToon({
  vertexColors: true, rim: 0xffffff, rimStrength: 0.16, rimPower: 4.4,
  bounce: 0x2a1a3a, bounceStrength: 0.14, noise: 0.09, noiseScale: 0.45
});
// the road is the largest upward facing surface in the game, so the sky term
// has to be dialled right back or the whole thing washes out to pale blue
roadMat.userData.skyScale = 0.18;
const road = new THREE.Mesh(buildRoadMesh(track), roadMat);
road.receiveShadow = true;
scene.add(road);

// a fence down both sides, matching the hard wall in the vehicle exactly, so
// what she can see is what she can hit
const barrierMat = makeToon({
  vertexColors: true, rim: 0xffffff, rimStrength: 0.22, rimPower: 3.6,
  side: THREE.DoubleSide, noise: 0.04, bounceStrength: 0.18
});
const barriers = new THREE.Mesh(buildBarriers(track), barrierMat);
barriers.receiveShadow = true;
scene.add(barriers);

setStatus('building a city');
const world = buildWorld(scene, track);

const vfx = new VFX(scene);
const speedLines = makeSpeedLines();
scene.add(speedLines);

const post = makePost(renderer, scene, camera);

// ---------------------------------------------------------------------------
// The inset view.
//
// Hold C and it shows what is behind her. During the underground sequence,
// where the main camera turns around to watch the world end, it flips and shows
// the road AHEAD instead, so she can still steer while she watches. Either way
// her own vehicle is in the picture, which is what stops the whole thing being
// disorienting.
//
// It renders straight into a viewport after the composer has finished, so it
// costs one extra scene pass and no post processing.
// ---------------------------------------------------------------------------
const insetCam = new THREE.PerspectiveCamera(58, 16 / 9, 0.5, 12000);
const _ip = new THREE.Vector3(), _il = new THREE.Vector3();

// Holding the look key swings the whole camera round behind her, the same way
// the cinematic does, rather than opening a little window somewhere. The inset
// then flips to the road ahead so she can still steer. Releasing swings back.
// A small panel in the corner was never going to read as "looking back".
let lookHeld = false;

function updateLookBack(dt) {
  const racing = State === 'hud' && race.state === 'racing';
  const want = racing && Input.look && !race.reverse;
  if (want !== lookHeld) {
    lookHeld = want;
    // fast enough that the swing feels like a head turn, not a broken camera
    if (!race.reverse) director.setReverse(want, 7.0);
  }
  return lookHeld;
}

function updateInset(dt) {
  const P = race.player;
  if (!P || !P.group.visible) return null;
  const racing = State === 'hud' || State === 'none';
  if (!racing || race.state === 'reveal') return null;

  // whenever the main camera is facing backwards, for whatever reason, the
  // inset carries the road ahead
  const facingBack = race.reverse || lookHeld;
  if (!facingBack) return null;

  const L = track.length;
  track.posAt(Math.max(0, P.t - 12 / L), P.lat * 0.8, 4.4, _ip);
  track.posAt(Math.min(1, P.t + 70 / L), P.lat * 0.4, 3.0, _il);
  insetCam.position.copy(_ip);
  insetCam.up.set(0, 1, 0);
  insetCam.lookAt(_il);
  return 'THE ROAD AHEAD';
}

function renderInset() {
  const w = renderer.domElement.width, h = renderer.domElement.height;
  const iw = Math.round(w * 0.26), ih = Math.round(iw * 9 / 16);
  const x = Math.round(w * 0.5 - iw * 0.5);
  const y = Math.round(h - ih - 24 * renderer.getPixelRatio());
  insetCam.aspect = iw / ih;
  insetCam.updateProjectionMatrix();
  renderer.autoClear = false;
  renderer.setViewport(x, y, iw, ih);
  renderer.setScissor(x, y, iw, ih);
  renderer.setScissorTest(true);
  renderer.clearDepth();
  renderer.render(scene, insetCam);
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, w, h);
  renderer.autoClear = true;
}
const hud = new HUD();
hud.setSectors(SECTORS, track.length);
const director = new Director(camera, track);

setStatus('waking the family');
const race = new Race({ scene, track, camera, director, hud, vfx, post, env });

const rakhiScene = buildRakhiScene(scene, track, 0.99915);
rakhiScene.group.visible = false;

// ---------------------------------------------------------------------------
// Vehicle select podium
// ---------------------------------------------------------------------------
const podium = new THREE.Group();
scene.add(podium);
const podiumModels = VEHICLES.map((v, i) => {
  const m = HERO_BUILDERS[v.id](v);
  m.position.x = (i - 1) * 34;   // far enough apart that neighbours stay out of frame
  podium.add(m);
  return m;
});
{
  const pt = 0.0026;
  podium.position.copy(track.posAt(pt, 0, 0.3, new THREE.Vector3()));
  const tn = track.tanAt(pt, new THREE.Vector3());
  const up = track.upAt(pt, new THREE.Vector3());
  const rt = new THREE.Vector3().crossVectors(up, tn).normalize();
  podium.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(rt, up, tn));
}
podium.visible = false;

// ---------------------------------------------------------------------------
// Save data
// ---------------------------------------------------------------------------
const SAVE_KEY = 'rakhi-racer-v1';
const load = () => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } };
const save = (d) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch (e) { /* private window */ } };
let SAVE = load();

const fmtTime = (s) => {
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r.toFixed(2)}`;
};

function syncUnlocks() {
  if (SAVE.finished) { $('go-time').disabled = false; $('go-time').classList.remove('locked'); }
  if (SAVE.bestRank === 'S') { $('go-rush').disabled = false; $('go-rush').classList.remove('locked'); }
}

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------
let State = 'boot';
function setScreen(s) {
  State = s;
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  const el = $(s);
  if (el) el.classList.add('active');
}

// The opening. Black, an engine, then the camera climbs out of the grid.
function playIntro(onDone) {
  podium.visible = false;
  hud.skippable(true);

  const t0 = 0.0032;
  const p = track.posAt(t0, 0, 0, new THREE.Vector3());
  const tan = track.tanAt(t0, new THREE.Vector3());
  const up = track.upAt(t0, new THREE.Vector3());

  audio.rumble(2.6, 1.2);
  hud.flash('#000', 1, 1600);

  const from = p.clone().addScaledVector(up, 1.6).addScaledVector(tan, -64);
  const to = p.clone().addScaledVector(up, 84).addScaledVector(tan, -160);
  const look = p.clone().addScaledVector(up, 6).addScaledVector(tan, 110);

  let announced = false;
  director.play({
    dur: 8.5,
    at(k) {
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      if (!announced && k > 0.30) {
        announced = true;
        hud.chapter('DESTINATION', 'THE RAKHI', 3.2);
        audio.chime(0);
      }
      return { pos: from.clone().lerp(to, e), look, fov: 30 + e * 36, snap: k < 0.01 };
    },
    onEnd: () => { hud.skippable(false); onDone(); }
  });
  setTimeout(() => { if (State === 'none') hud.shout('THE GRAND FAMILY RACE', 2.4); }, 800);
}

function startRace(vehicleId, mode = 'story') {
  audio.init(); audio.resume();
  race.begin(vehicleId, mode);
  race.onFinished = showResults;
  race.resultsShown = false;
  podium.visible = false;
  rakhiScene.group.visible = false;
  if (race.player) race.player.group.visible = true;
  setScreen('hud');
  hud.skippable(false);
}

let lastResults = null;
function showResults(res) {
  lastResults = res;
  $('res-rank').textContent = res.rank;
  $('res-time').textContent = fmtTime(res.time);
  $('res-punt').textContent = res.punts;
  $('res-top').textContent = res.topSpeed;
  $('res-clean').textContent = res.clean + '%';

  const unlocks = [];
  if (!SAVE.finished) unlocks.push('TIME ATTACK unlocked');
  if (res.rank === 'S' && SAVE.bestRank !== 'S') unlocks.push('MOM RUSH unlocked');
  SAVE.finished = true;
  const order = { S: 4, A: 3, B: 2, C: 1 };
  if (!SAVE.bestRank || order[res.rank] > order[SAVE.bestRank]) SAVE.bestRank = res.rank;
  if (!SAVE.bestTime || res.time < SAVE.bestTime) SAVE.bestTime = res.time;
  save(SAVE); syncUnlocks();

  const u = $('res-unlock');
  if (unlocks.length) { u.textContent = unlocks.join('   and   '); u.classList.remove('hidden'); }
  else u.classList.add('hidden');

  setScreen('results');
}

// past the finish line the world goes away. after eleven minutes of everything
// collapsing, an empty platform and two people is the effect.
function clearWorldForEnding() {
  // every instanced layer by name. an older version of this list used names
  // the world builder does not use any more, so half the scenery stayed up
  // through the ending and the platform was floating in a city.
  for (const k of Object.keys(world)) {
    if (world[k] && world[k].isObject3D) world[k].visible = false;
  }
  road.visible = false;
  barriers.visible = false;
  race.finishGate.visible = false;
  race.boss.group.visible = false;
  for (const r of race.pack.racers) r.group.visible = false;
  race.items.setVisible(false);
  scene.fog.near = 60; scene.fog.far = 900;
  scene.fog.color.setHex(0x1a0f26);
  const sk = sky.material.uniforms;
  sk.uTop.value.setHex(0x090510);
  sk.uMid.value.setHex(0x1e1030);
  sk.uBot.value.setHex(0x3a1f4a);
  sun.intensity = 1.35;
  ambient.color.setHex(0x4a3070);
  ambient.intensity = 0.85;
}

function restoreWorld() {
  for (const k of Object.keys(world)) {
    if (world[k] && world[k].isObject3D) world[k].visible = true;
  }
  road.visible = true;
  barriers.visible = true;
  race.items.setVisible(true);
  for (const r of race.pack.racers) r.group.visible = true;
  sun.intensity = 1.55;
}

function playEnding() {
  setScreen('none');
  hud.skippable(false);
  race.playReveal(() => {
    hud.chapter('ALL OF IT', 'WAS A RAKHI', 4.0);
    setTimeout(() => {
      race.revealMesh.material.opacity = 0;
      race.revealMesh.visible = false;
      race.heartGlow.visible = false;
      clearWorldForEnding();
      rakhiScene.group.visible = true;
      if (race.player) race.player.group.visible = false;
      playRakhiScene(rakhiScene, director, hud, () => {
        setScreen('gift');
        showGiftCard($('gift-slot'), () => { });
      });
    }, 4400);
  });
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
let selIndex = 0;
let pendingMode = 'story';

hud.buildSelect(VEHICLES, (id) => {
  startRace(id, pendingMode);
  if (pendingMode === 'story') {
    // build the race first so the grid is populated, then hold the lights on
    // red while the opening cinematic runs
    race.holdCountdown = true;
    setScreen('none');
    playIntro(() => { race.holdCountdown = false; setScreen('hud'); });
  }
});
hud.onSelectChange = (v, i) => { selIndex = i; audio.init(); audio.beep(false); };

$('boot-start').onclick = () => { audio.init(); audio.resume(); setScreen('title'); };
$('go-race').onclick = () => { pendingMode = 'story'; podium.visible = true; setScreen('select'); snapMenuCamera(); };
$('go-time').onclick = () => { pendingMode = 'time'; podium.visible = true; setScreen('select'); snapMenuCamera(); };
$('go-rush').onclick = () => { pendingMode = 'boss'; podium.visible = true; setScreen('select'); snapMenuCamera(); };
$('res-again').onclick = () => { restoreWorld(); podium.visible = true; setScreen('select'); snapMenuCamera(); };
$('res-menu').onclick = () => { restoreWorld(); podium.visible = false; setScreen('title'); };
const resGift = $('res-gift');
if (resGift) resGift.onclick = playEnding;

Input.attach();
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  post.setSize(innerWidth, innerHeight);
});
addEventListener('pointerdown', () => { audio.init(); audio.resume(); }, { once: true });

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
let last = performance.now();
const menuCam = { a: 0 };

const fakePlayer = {
  t: 0.004, lat: 0, speed: 0, airY: 0, boostBlend: 0, abilityActive: false,
  spec: { topSpeed: 90, ride: 'car' },
  worldPos: (o) => track.posAt(0.004, 0, 1, o || new THREE.Vector3())
};

function selectCameraTarget(outPos, outLook) {
  const target = podiumModels[selIndex];
  target.updateWorldMatrix(true, false);
  const c = target.getWorldPosition(new THREE.Vector3());
  c.y += 1.6;
  // the cards cover the bottom half of this screen, so the ride has to sit
  // high in frame. aiming below it is what lifts it up there.
  const r = 21;
  outPos.set(c.x + Math.cos(menuCam.a) * r, c.y + 9.0, c.z + Math.sin(menuCam.a) * r);
  outLook.set(c.x, c.y - 3.4, c.z);
}

function snapMenuCamera() {
  if (State !== 'select') return;
  const p = new THREE.Vector3(), l = new THREE.Vector3();
  selectCameraTarget(p, l);
  director.pos.copy(p);
  director.look.copy(l);
  director.fov = 30;
  camera.up.set(0, 1, 0);
  camera.position.copy(p);
  camera.lookAt(l);
  camera.fov = 30;
  camera.updateProjectionMatrix();
}

function menuCamera(dt) {
  menuCam.a += dt * (State === 'select' ? 0.20 : 0.05);
  if (State === 'select') {
    const wantP = new THREE.Vector3(), wantL = new THREE.Vector3();
    selectCameraTarget(wantP, wantL);
    director.pos.lerp(wantP, Math.min(1, 6 * dt));
    director.look.lerp(wantL, Math.min(1, 7 * dt));
    director.fov += (30 - director.fov) * Math.min(1, 5 * dt);
    podiumModels.forEach((m, i) => {
      const on = i === selIndex;
      m.position.y += ((on ? 0.8 : 0) - m.position.y) * Math.min(1, 5 * dt);
      m.rotation.y += dt * (on ? 0.45 : 0.10);
      const s = m.scale.x + ((on ? 1 : 0.82) - m.scale.x) * Math.min(1, 5 * dt);
      m.scale.setScalar(s);
    });
  } else {
    // a slow drift down the boulevard behind the menus
    const t = 0.045 + (menuCam.a * 0.0009) % 0.11;
    director.pos.lerp(track.posAt(t, 26, 16, new THREE.Vector3()), Math.min(1, 1.2 * dt));
    director.look.lerp(track.posAt(t + 0.010, -8, 22, new THREE.Vector3()), Math.min(1, 2 * dt));
    director.fov += (48 - director.fov) * Math.min(1, 2 * dt);
  }
  director.cam.up.set(0, 1, 0);
  director.cam.position.copy(director.pos);
  director.cam.lookAt(director.look);
  director.cam.fov = director.fov;
  director.cam.updateProjectionMatrix();
}

// ---------------------------------------------------------------------------
// Quality guard.
//
// This is a present, and it has to run on whatever machine it gets opened on.
// Rather than ask anyone to pick a graphics preset, watch the frame time and
// step the expensive things off one at a time until it holds up. It only ever
// steps down, so a momentary hitch during a big explosion cannot cause it to
// oscillate.
// ---------------------------------------------------------------------------
const Quality = {
  level: 3,          // 3 everything, 2 no occlusion, 1 also lower resolution
  frames: 0,
  slow: 0,
  cooldown: 2.0,
  tick(dt) {
    if (this.cooldown > 0) { this.cooldown -= dt; return; }
    this.frames++;
    if (dt > 1 / 34) this.slow++;
    if (this.frames < 90) return;
    const bad = this.slow / this.frames;
    this.frames = 0; this.slow = 0;
    if (bad < 0.45) return;
    if (this.level === 3) {
      this.level = 2;
      post.setAO(false);
      this.cooldown = 3;
    } else if (this.level === 2) {
      this.level = 1;
      renderer.setPixelRatio(Math.min(1, devicePixelRatio * 0.75));
      post.setSize(innerWidth, innerHeight);
      this.cooldown = 3;
    }
  }
};
window.RAKHI_QUALITY = Quality;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  Quality.tick(dt);

  Input.update(dt);
  if (Input.skipEdge && director.shot) {
    const cb = director.shot.onEnd;
    director.stopShot();
    if (cb) cb();
  }

  const scaled = dt * director.timeScale;

  if (State === 'hud' || State === 'none') {
    race.update(scaled, Input);
    race.updateReveal(dt);
    if (!race.player) director.update(dt, fakePlayer);
  } else {
    menuCamera(dt);
  }

  // ---- sector look ----
  const t = race.player ? race.player.t : 0.01;
  const sec = sectorAt(t);
  const i = SECTORS.indexOf(sec);
  const next = SECTORS[Math.min(SECTORS.length - 1, i + 1)];
  const k = THREE.MathUtils.smoothstep(t, sec.to - 0.030, sec.to);
  let shading = null;
  if (race.state !== 'reveal') shading = blendSector(env, sec, next, i === SECTORS.length - 1 ? 0 : k);

  // ---- the rig follows the action ----
  const focus = race.player && race.player.group.visible ? race.player.group.position : camera.position;
  _sunDir.copy(sky.material.uniforms.uSun.value).normalize();
  sun.target.position.copy(focus);
  sun.position.copy(focus).addScaledVector(_sunDir, 240);
  // the rim sits opposite the key and slightly behind, so edges catch light the
  // key can never reach
  rim.target.position.copy(focus);
  rim.position.copy(focus).addScaledVector(_sunDir, -190).add(new THREE.Vector3(0, 60, 0));
  sky.position.copy(camera.position);

  if (shading) {
    syncLighting(camera, _sunDir, shading.shadowTint, shading.skyTint, shading.shadowAmt, shading.skyAmt);
  } else {
    syncLighting(camera, _sunDir);
  }

  // ---- nameplates ----
  if (State === 'hud' && race.state === 'racing') {
    race.pack.updatePlates(camera, innerWidth, innerHeight, race.player);
  } else if (race.pack.plates) {
    for (const el of race.pack.plates) el.style.display = 'none';
  }

  // ---- post ----
  const P = race.player;
  if (P && (State === 'hud' || State === 'none')) {
    const sp = Math.min(1, P.speed / P.spec.topSpeed);
    const target = sp * 0.42 + P.boostBlend * 1.4 + (P.abilityActive ? 0.4 : 0);
    post.u.uSpeed.value += (target - post.u.uSpeed.value) * Math.min(1, 6 * dt);
    post.u.uAberration.value += ((P.boostBlend * 0.85 + (P.abilityActive ? 0.3 : 0)) - post.u.uAberration.value) * Math.min(1, 6 * dt);
    post.u.uWarp.value += ((P.boostBlend * 0.12 + sp * 0.03) - post.u.uWarp.value) * Math.min(1, 5 * dt);
    post.u.uDesat.value += (race.desat - post.u.uDesat.value) * Math.min(1, 2 * dt);
    const sl = speedLines.material.uniforms;
    sl.uAmount.value += ((Math.max(0, sp - 0.80) * 2.2 + P.boostBlend * 0.85) - sl.uAmount.value) * Math.min(1, 6 * dt);
    sl.uTime.value += dt;
    sl.uColor.value.setHex(P.spec.trail);
  } else {
    post.u.uSpeed.value *= 0.9;
    post.u.uAberration.value *= 0.9;
    speedLines.material.uniforms.uAmount.value *= 0.9;
  }
  post.u.uLetterbox.value += (director.letterbox - post.u.uLetterbox.value) * Math.min(1, 5 * dt);

  vfx.update(dt);
  post.render(dt);

  const looking = updateLookBack(dt);
  const insetLabel = updateInset(dt);
  hud.inset(!!insetLabel, insetLabel || undefined);
  hud.lookingBack(looking);
  if (insetLabel) renderInset();

  Input.clearAny();
}

// ---------------------------------------------------------------------------
// Go
// ---------------------------------------------------------------------------
setStatus('compiling shaders');
renderer.compile(scene, camera);
$('boot-bar').style.width = '100%';
setStatus('ready when you are');
$('boot-start').classList.remove('hidden');
syncUnlocks();

if (DEV) {
  const t = parseFloat(qs.get('t') || '0.02');
  startRace(qs.get('v') || 'velocity', qs.get('mode') || 'story');
  race.state = 'racing';
  race.player.t = t;
  race.player.speed = parseFloat(qs.get('s') || '60');
  race.beatIndex = race.beats.findIndex(b => b.at > t);
  if (race.beatIndex < 0) race.beatIndex = race.beats.length;
  race.pack.racers.forEach((r, idx) => {
    r.t = Math.max(0, t + (idx - 6) * 0.00035);
    r.speed = 55;
    r.applyTransform();
  });
  race.player.applyTransform();
  const wp = race.player.worldPos(new THREE.Vector3());
  director.snapTo(wp.clone().addScaledVector(track.tanAt(t), -13).add(new THREE.Vector3(0, 4.5, 0)), wp);
  const d = 1 / 60;
  for (let i2 = 0; i2 < parseInt(qs.get('warm') || '90'); i2++) {
    race.player.update(d, { steer: 0, steerRaw: 0, throttle: 1, brake: 0, boost: false });
    director.update(d, race.player);
  }
  if (qs.has('boss')) race.startBoss();
  if (qs.has('reveal')) playEnding();
} else {
  setScreen('boot');
}

requestAnimationFrame(frame);

window.RAKHI = { TRACKCFG: TRACK, scene, camera, track, director, post, race, vfx, audio, playEnding, startRace, setScreen, rakhiScene, clearWorldForEnding, playRakhiScene, hud, Input };
