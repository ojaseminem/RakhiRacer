import * as THREE from 'three';
import { SECTORS, VEHICLES, sectorAt } from './config.js';
import { Track, buildRoadMesh } from './world/track.js';
import { makeToon, makeSky, blendSector } from './art/materials.js';
import { HERO_BUILDERS } from './art/build.js';
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
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.5, 120000);
scene.fog = new THREE.Fog(0xbfe9ff, 900, 6200);

const sky = makeSky();
scene.add(sky);

const sun = new THREE.DirectionalLight(0xfff2d0, 1.55);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 800;
const SH = 150;
sun.shadow.camera.left = -SH; sun.shadow.camera.right = SH;
sun.shadow.camera.top = SH; sun.shadow.camera.bottom = -SH;
sun.shadow.bias = -0.0011;
sun.shadow.normalBias = 0.7;
scene.add(sun, sun.target);

const ambient = new THREE.HemisphereLight(0x8fb6ff, 0x3a2a55, 0.62);
scene.add(ambient);
const env = { sky, fog: scene.fog, sun, ambient };

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------
setStatus('shaping the rakhi');
const track = new Track();

setStatus('paving thirty kilometres');
const road = new THREE.Mesh(buildRoadMesh(track), makeToon({
  vertexColors: true, rim: 0xffffff, rimStrength: 0.20, rimPower: 3.8,
  bounce: 0x2a1a3a, bounceStrength: 0.18
}));
road.receiveShadow = true;
scene.add(road);

setStatus('building a city');
const world = buildWorld(scene, track);

const vfx = new VFX(scene);
const speedLines = makeSpeedLines();
scene.add(speedLines);

const post = makePost(renderer, scene, camera);
const hud = new HUD();
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
  m.position.x = (i - 1) * 14;
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
  for (const k of ['blocks', 'cyls', 'cones', 'blobs', 'neon', 'clouds', 'ground']) {
    if (world[k]) world[k].visible = false;
  }
  road.visible = false;
  race.finishGate.visible = false;
  race.boss.group.visible = false;
  for (const r of race.pack.racers) r.group.visible = false;
  race.items.mesh.visible = false;
  race.items.core.visible = false;
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
  for (const k of ['blocks', 'cyls', 'cones', 'blobs', 'neon', 'clouds', 'ground']) {
    if (world[k]) world[k].visible = true;
  }
  road.visible = true;
  race.items.mesh.visible = true;
  race.items.core.visible = true;
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
$('go-race').onclick = () => { pendingMode = 'story'; podium.visible = true; setScreen('select'); };
$('go-time').onclick = () => { pendingMode = 'time'; podium.visible = true; setScreen('select'); };
$('go-rush').onclick = () => { pendingMode = 'boss'; podium.visible = true; setScreen('select'); };
$('res-again').onclick = () => { restoreWorld(); podium.visible = true; setScreen('select'); };
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

function menuCamera(dt) {
  menuCam.a += dt * (State === 'select' ? 0.20 : 0.05);
  if (State === 'select') {
    const target = podiumModels[selIndex];
    const c = target.getWorldPosition(new THREE.Vector3());
    c.y += 1.4;
    const r = 12.5;
    director.pos.lerp(new THREE.Vector3(
      c.x + Math.cos(menuCam.a) * r, c.y + 4.2, c.z + Math.sin(menuCam.a) * r), Math.min(1, 2.4 * dt));
    director.look.lerp(c, Math.min(1, 3 * dt));
    director.fov += (36 - director.fov) * Math.min(1, 3 * dt);
    podiumModels.forEach((m, i) => {
      const on = i === selIndex;
      m.position.y += ((on ? 0.8 : 0) - m.position.y) * Math.min(1, 5 * dt);
      m.rotation.y += dt * (on ? 0.45 : 0.10);
      const s = m.scale.x + ((on ? 1 : 0.82) - m.scale.x) * Math.min(1, 5 * dt);
      m.scale.setScalar(s);
    });
  } else {
    const t = 0.02 + (menuCam.a * 0.0008) % 0.14;
    director.pos.lerp(track.posAt(t, 16, 10, new THREE.Vector3()), Math.min(1, 1.2 * dt));
    director.look.lerp(track.posAt(t + 0.007, 0, 3, new THREE.Vector3()), Math.min(1, 2 * dt));
    director.fov += (54 - director.fov) * Math.min(1, 2 * dt);
  }
  director.cam.position.copy(director.pos);
  director.cam.lookAt(director.look);
  director.cam.fov = director.fov;
  director.cam.updateProjectionMatrix();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;

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
  if (race.state !== 'reveal') blendSector(env, sec, next, i === SECTORS.length - 1 ? 0 : k);

  // ---- shadow follows the action ----
  const focus = race.player && race.player.group.visible ? race.player.group.position : camera.position;
  sun.target.position.copy(focus);
  sun.position.copy(focus).addScaledVector(
    new THREE.Vector3(sec.sunPos[0], sec.sunPos[1], sec.sunPos[2]).normalize(), 300);
  sky.position.copy(camera.position);

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
    race.player.update(d, { steer: 0, steerRaw: 0, boost: false, brake: false });
    director.update(d, race.player);
  }
  if (qs.has('boss')) race.startBoss();
  if (qs.has('reveal')) playEnding();
} else {
  setScreen('boot');
}

requestAnimationFrame(frame);

window.RAKHI = { scene, camera, track, director, post, race, vfx, audio, playEnding, startRace, setScreen };
