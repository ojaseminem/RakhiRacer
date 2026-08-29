// All the tunable data for the game lives here so the rest of the code stays
// about behaviour rather than numbers.

export const STUDIO = {
  name: 'TURTLE GAME WORKS',
  presents: 'A TURTLE GAME WORKS PRODUCTION',
  year: '2026'
};

// ---------------------------------------------------------------------------
// PALETTES
// Each sector owns a full colour set. The swing between them is what gives the
// race its shape, so they are deliberately far apart.
// ---------------------------------------------------------------------------
// Each sector is a full art direction, not just a colour. The rule that holds
// them together: the road is always the darkest large area so the vehicles read
// against it, the ground sits mid value, the sky is lightest, and the only
// really bright things are small (kerbs, neon, lava, banners). Shadow tint is
// always the complement of the key light, which is what stops shade going grey.
export const SECTORS = [
  {
    id: 'city',
    num: 1,
    name: 'THE FAMILY CITY',
    kicker: 'SECTOR 1',
    from: 0.000, to: 0.190,
    sky: [0x2196f3, 0x8fd8ff, 0xffe8b0],
    fog: 0xb8e2ff, fogNear: 700, fogFar: 5200, haze: 0.62,
    road: 0x241a3e, kerbA: 0xff2f6b, kerbB: 0xfff2dc,
    ground: 0x6b4f9e, rim: 0xfff0c0, rimI: 0.42,
    sun: 0xfff0cc, sunI: 1.42, sunPos: [0.45, 0.72, 0.42],
    amb: 0x9fd0ff, ambI: 0.48,
    shadowTint: 0x2b3a8c, shadowAmt: 0.46, skyTint: 0x9fd8ff, skyAmt: 0.20,
    music: 'arcade'
  },
  {
    id: 'highway',
    num: 2,
    name: 'THE IMPOSSIBLE HIGHWAY',
    kicker: 'SECTOR 2',
    from: 0.190, to: 0.320,
    sky: [0x1e7fd4, 0xa8e0ff, 0xffd0a0],
    fog: 0xe8f2ff, fogNear: 1100, fogFar: 8000, haze: 0.78,
    road: 0x2e2748, kerbA: 0xff6a2b, kerbB: 0xffffff,
    ground: 0xcfe4ff, rim: 0xffffff, rimI: 0.48,
    sun: 0xffffff, sunI: 1.55, sunPos: [-0.35, 0.78, 0.42],
    amb: 0xd4ecff, ambI: 0.58,
    shadowTint: 0x3a56a8, shadowAmt: 0.40, skyTint: 0xd0eaff, skyAmt: 0.26,
    music: 'tension'
  },
  {
    id: 'forest',
    num: 3,
    name: 'THE FOREST OF CHAOS',
    kicker: 'SECTOR 3',
    from: 0.320, to: 0.520,
    sky: [0x0d2b3e, 0x5f9c86, 0xffd486],
    fog: 0x1f4a34, fogNear: 260, fogFar: 2600, haze: 0.44,
    road: 0x2b2116, kerbA: 0xffbe2b, kerbB: 0xe8dcb4,
    ground: 0x27502e, rim: 0xffe08a, rimI: 0.40,
    sun: 0xfff0b8, sunI: 1.62, sunPos: [0.62, 0.44, -0.42],
    amb: 0x2f6b40, ambI: 0.40,
    shadowTint: 0x123c46, shadowAmt: 0.52, skyTint: 0x86d8a0, skyAmt: 0.18,
    music: 'tension'
  },
  {
    id: 'volcano',
    num: 4,
    name: 'THE FAMILY VOLCANO',
    kicker: 'SECTOR 4',
    from: 0.520, to: 0.700,
    sky: [0x150620, 0x521a4e, 0xff7a4a],
    fog: 0x2a0d24, fogNear: 200, fogFar: 2200, haze: 0.5,
    road: 0x180d1c, kerbA: 0xff5a3d, kerbB: 0xffb84a,
    ground: 0x160a16, rim: 0xff8adc, rimI: 0.55,
    sun: 0xffab48, sunI: 1.30, sunPos: [-0.5, 0.34, -0.62],
    amb: 0x4a1a44, ambI: 0.42,
    shadowTint: 0x4a1252, shadowAmt: 0.5, skyTint: 0xc46aff, skyAmt: 0.24,
    music: 'dread'
  },
  {
    id: 'underground',
    num: 5,
    name: 'THE UNDERGROUND',
    kicker: 'SECTOR 5',
    from: 0.700, to: 0.870,
    // dark, but the road still has to be readable at two hundred and sixty. The
    // first pass at this was so dark the tarmac vanished under the car.
    sky: [0x0a0618, 0x1c1038, 0x3a1a5e],
    fog: 0x120a26, fogNear: 200, fogFar: 1700, haze: 0.30,
    road: 0x2e2748, kerbA: 0xb06aff, kerbB: 0xff3d8a,
    ground: 0x140c26, rim: 0xc48aff, rimI: 0.78,
    sun: 0xb8ecff, sunI: 1.35, sunPos: [0.2, 0.9, 0.1],
    amb: 0x2a5c78, ambI: 0.82,
    shadowTint: 0x271552, shadowAmt: 0.48, skyTint: 0x9a6cff, skyAmt: 0.24,
    music: 'dread'
  },
  {
    id: 'arena',
    num: 6,
    name: 'THE ARENA',
    kicker: 'FINAL SECTOR',
    from: 0.870, to: 1.000,
    sky: [0x120a26, 0x46256e, 0xffb03d],
    fog: 0x1d1136, fogNear: 420, fogFar: 4200, haze: 0.48,
    road: 0x1c1330, kerbA: 0xffc93d, kerbB: 0xff4f9b,
    ground: 0x160d28, rim: 0xffcf7a, rimI: 0.52,
    sun: 0xffd49a, sunI: 1.34, sunPos: [0.18, 0.56, 0.72],
    amb: 0x53368c, ambI: 0.52,
    shadowTint: 0x2a1a5e, shadowAmt: 0.48, skyTint: 0xa985ff, skyAmt: 0.22,
    music: 'boss'
  }
];

export function sectorAt(t) {
  for (let i = SECTORS.length - 1; i >= 0; i--) if (t >= SECTORS[i].from) return SECTORS[i];
  return SECTORS[0];
}

// ---------------------------------------------------------------------------
// THE THREE RIDES
// Difficulty is hidden in here. There is no difficulty menu.
// ---------------------------------------------------------------------------
// Speeds.
//
// The race was asked to be a quarter shorter. Rather than cut the track, which
// would have flattened the heart and steepened every climb, all three cars got
// a third more speed. The drag here is linear and the throttle curve is written
// against each car's own ceiling, so multiplying top speed, acceleration and
// braking together scales the whole race exactly and leaves the handling,
// the steering response and the cornering feel untouched.
export const VEHICLES = [
  {
    id: 'velocity',
    name: 'VELOCITY',
    tag: 'THE SUPERCAR',
    quote: 'I want to go FAST.',
    blurb: 'Sleek. Tiny. Ridiculously aerodynamic. The fastest thing on the grid and the least forgiving.',
    body: 0xe8203f, accent: 0xfff0d0, glow: 0xff6a4a, trail: 0xff9e3d,
    stats: [['SPEED', 5], ['ACCELERATION', 5], ['WEIGHT', 2], ['HANDLING', 1]],
    // physics
    topSpeed: 123, accel: 70, brake: 45, grip: 5.6, turn: 1.55, mass: 0.8,
    boostMul: 1.62, boostTime: 2.4, boostDrain: 34, boostRegen: 12,
    ability: {
      name: 'NITRO BURST',
      desc: 'A colossal boost that leaves a burning ribbon behind her.',
      cool: 9, dur: 3.2
    },
    bossPlay: 'Strikes the weak points on the flyby. Most damage, has to get close.',
    ride: 'car'
  },
  {
    id: 'beast',
    name: 'THE BEAST',
    tag: 'HEAVY MONSTER TRUCK',
    quote: 'GET OUT OF MY WAY.',
    blurb: 'Massive. Chunky. Comically oversized. It does not avoid things, it removes them.',
    body: 0xffb01f, accent: 0x2bb8a8, glow: 0xffd84a, trail: 0xffc93d,
    stats: [['ATTACK', 5], ['DEFENSE', 4], ['WEIGHT', 5], ['SPEED', 3]],
    topSpeed: 104, accel: 50, brake: 40, grip: 7.4, turn: 1.15, mass: 2.4,
    boostMul: 1.44, boostTime: 2.8, boostDrain: 28, boostRegen: 14,
    ability: {
      name: 'FAMILY FURY',
      desc: 'Charge forward. Everything in front goes weeeee off the track.',
      cool: 8, dur: 2.6
    },
    bossPlay: 'The only ride that can ram Mom’s armour plates head on.',
    ride: 'truck'
  },
  {
    id: 'comet',
    name: 'THE COMET',
    tag: 'FUTURISTIC HOVER BIKE',
    quote: 'I want to do cool shit.',
    blurb: 'One rider. Glowing wheels. Long body, neon trails, and it floats a little off the road.',
    body: 0x18c8ff, accent: 0xfff2ff, glow: 0x6affff, trail: 0x39e6ff,
    stats: [['HANDLING', 5], ['SPEED', 4], ['BOOST', 4], ['WEIGHT', 2]],
    topSpeed: 115, accel: 65, brake: 43, grip: 9.2, turn: 2.05, mass: 0.7,
    boostMul: 1.55, boostTime: 3.2, boostDrain: 26, boostRegen: 16,
    ability: {
      name: 'PHASE DASH',
      desc: 'For a few seconds she passes clean through obstacles and vehicles.',
      cool: 7.5, dur: 3.4
    },
    bossPlay: 'Phases straight through Mom’s attacks and hits her from inside.',
    ride: 'bike'
  }
];

// ---------------------------------------------------------------------------
// FAMILY POWER-UPS
// ---------------------------------------------------------------------------
export const ITEMS = [
  { id:'sugar',   name:'SUGAR RUSH',      glyph:'S', color:0xff4f9b, weight:16,
    blurb:'Everything goes faster for four seconds.' },
  { id:'banana',  name:'BANANA PEEL',     glyph:'B', color:0xffd23d, weight:20,
    blurb:'Drops behind you. Whoever touches it spins.' },
  { id:'bazooka', name:'CHAPPAL BAZOOKA', glyph:'Z', color:0xff5a2b, weight:16,
    blurb:'A homing slipper. It finds whoever is ahead of you.' },
  { id:'slick',   name:'GHEE SLICK',      glyph:'G', color:0xffe08a, weight:16,
    blurb:'A wide slippery patch behind you. Nobody steers on it.' },
  { id:'blessing',name:'MOM\u2019S BLESSING', glyph:'M', color:0xffd23d, weight:10,
    blurb:'Six seconds where nothing can touch you and everything you touch flies.' },
  { id:'thread',  name:'RAKHI THREAD',    glyph:'T', color:0xff2f6b, weight:12,
    blurb:'A glowing tether snaps onto the racer ahead and reels you in.' },
  { id:'bonk',    name:'BROTHER\u2019S BONK', glyph:'K', color:0x2be0c0, weight:12,
    blurb:'A giant boxing glove on a spring. Ridiculous. Effective.' },
  { id:'thunder', name:'THUNDER CLAP',    glyph:'!', color:0x8f6aff, weight:8,
    blurb:'Every single relative ahead of you gets hit at once.' }
];



// ---------------------------------------------------------------------------
// THE FAMILY
// Every one of them is a recognisable vehicle with a behaviour and a mouth.
// skill  : how fast they are, 0..1
// chaos  : how likely they are to wreck themselves
// aggro  : how much they hunt the player
// ---------------------------------------------------------------------------
export const FAMILY = [
  { id:'chachu', title:'CHACHU', ride:'sports', color:0x1fd45f, accent:0x0a3d1e,
    skill:0.97, chaos:0.30, aggro:0.85, rival:true,
    note:'Overpowered sports car. Shortcuts. Rams. Taunts.',
    barks:['HAT JA!','MAIN JEET RAHA HOON!','DEKHA?!','BAS ITNA HI?'] },

  { id:'papa', title:'PAPA', ride:'sedan', color:0xe8e2d4, accent:0x36405c,
    skill:0.88, chaos:0.02, aggro:0.10,
    note:'Drives flawlessly. Never crashes. Never wins.',
    barks:['DHYAN SE BETA','SEAT BELT?','INDICATOR DE KE'] },

  { id:'mama', title:'MAMA', ride:'suv', color:0x2f5fd4, accent:0xc8d6ff,
    skill:0.72, chaos:0.06, aggro:0.45, unpushable:true,
    note:'Enormous SUV. Slow, heavy, literally cannot be knocked out.',
    barks:['HATO PICHE!','GAADI BADI HAI','TAKKAR MAT MAAR'] },

  { id:'mausi', title:'MAUSI', ride:'hatch', color:0xff2f8f, accent:0xffe0f2,
    skill:0.93, chaos:0.34, aggro:0.78,
    note:'Tiny hatchback. Terrifyingly fast. No fear whatsoever.',
    barks:['ITNI TEZ KYUN?!','SIDE DO!','AAJ TO MAIN'] },

  { id:'bua', title:'BUA', ride:'auto', color:0xffd21f, accent:0x1f8f4a,
    skill:0.64, chaos:0.55, aggro:0.30,
    note:'Three wheels. Should not be here. Somehow keeping up.',
    barks:['ARRE RUKO!','MERI GAADI!','BHAAG RAHE HO?'] },

  { id:'nana', title:'NANA', ride:'ambassador', color:0xf4f0e2, accent:0x2a2f38,
    skill:0.50, chaos:0.04, aggro:0.05, unkillable:true,
    note:'Slow. Survives absolutely everything. Dignified throughout.',
    barks:['AARAM SE','HAMARE ZAMANE MEIN','JALDI KYA HAI'] },

  { id:'nani', title:'NANI', ride:'oldcar', color:0xb8e0ff, accent:0x5a4a7a,
    skill:0.42, chaos:0.95, aggro:0.02, earlyExit:true,
    note:'Starts in the lead. Off the track in ten seconds.',
    barks:['MAIN AAGE HOON!','OH HO','KYA HUA?!'] },

  { id:'dada', title:'DADA', ride:'jeep', color:0x7a8f3d, accent:0xe2e8c4,
    skill:0.58, chaos:0.20, aggro:0.22, barks:['CHALO CHALO','SHABASH'] },
  { id:'dadi', title:'DADI', ride:'oldcar', color:0xe0a8ff, accent:0x4a2f5c,
    skill:0.46, chaos:0.30, aggro:0.05, barks:['DHEERE!','BHAGWAN!'] },
  { id:'chachi', title:'CHACHI', ride:'hatch', color:0x2be0c0, accent:0x0a4a44,
    skill:0.78, chaos:0.22, aggro:0.40, barks:['ROKO INKO','AAGE DEKH'] },
  { id:'mami', title:'MAMI', ride:'suv', color:0xff7a3d, accent:0x5c2410,
    skill:0.70, chaos:0.18, aggro:0.35, barks:['SIDE!','HORN BAJA'] },
  { id:'didi', title:'DIDI', ride:'sports', color:0xb44aff, accent:0xf0d8ff,
    skill:0.84, chaos:0.16, aggro:0.52, barks:['CHAL PICHE','BYE!'] }
];

// Order in which the family is eliminated, and where along the track it happens.
// The underground collapse (0.70 to 0.86) is where the big run of them goes.
export const ELIMINATIONS = [
  { id:'nani',   at:0.055, how:'off the track in ten seconds', where:'city' },
  { id:'dadi',   at:0.235, how:'did not make the jump',        where:'highway' },
  { id:'dada',   at:0.258, how:'did not make the jump',        where:'highway' },
  { id:'mami',   at:0.272, how:'did not make the jump',        where:'highway' },
  { id:'bua',    at:0.430, how:'boulder. bonk.',               where:'forest' },
  { id:'chachi', at:0.482, how:'met a very large log',         where:'forest' },
  { id:'mausi',  at:0.612, how:'took the dangerous route',     where:'volcano' },
  { id:'didi',   at:0.655, how:'took the dangerous route',     where:'volcano' },
  { id:'mama',   at:0.745, how:'the floor gave way',           where:'underground' },
  { id:'papa',   at:0.782, how:'the floor gave way',           where:'underground' },
  { id:'nana',   at:0.812, how:'still going, somewhere',       where:'underground', survives:true },
  { id:'chachu', at:0.846, how:'the floor gave way',           where:'underground', rival:true }
];

// ---------------------------------------------------------------------------
// TRACK SHAPE
// The racing spline, seen from above, forms a rakhi: a long thread coming in
// from the left, a flower knot in the middle, a shorter thread trailing right.
// The knot is a rose curve traversed one and a half times, and it spirals in
// height so the overlaps become real over and under passes instead of the road
// intersecting itself.
// ---------------------------------------------------------------------------
export const TRACK = {
  // Everything here was cut to three quarters of what it was: a full run was
  // pushing fifteen minutes, which is a long time to ask of anybody. The
  // height profile in track.js was scaled by the same factor so the climbs and
  // the plunge stayed exactly as steep as they were.
  // sampled control points, in world units
  threadInLength: 10200,
  // the heart in the middle of the rakhi. 16 units wide in the parametric
  // curve, so this is metres per unit.
  heartScale: 190,
  threadOutLength: 4600,
  roadHalfWidth: 11.5,
  // the gap in sector 2 that most of the family does not clear
  gap: { from: 0.2672, to: 0.2708 },
  // the fork in sector 4
  fork: { from: 0.590, to: 0.672 }
};

export const RACE = {
  gridSize: 13,          // sister plus twelve relatives
  totalLengthGuess: 31500,
  crowdRacers: 900       // background grid dressing at the start
};

// tuned against a full run on the shortened track: a clean boosting run lands
// near seven minutes, a scrappy one closer to eleven
export const RANKS = [
  { r:'S', t: 445 }, { r:'A', t: 490 }, { r:'B', t: 540 }, { r:'C', t: 1e9 }
];
