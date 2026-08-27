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
export const SECTORS = [
  {
    id: 'city',
    num: 1,
    name: 'THE FAMILY CITY',
    kicker: 'SECTOR 1',
    from: 0.000, to: 0.190,
    sky: [0x7fd8ff, 0xffd6ec, 0xfff3c4],
    fog: 0xbfe9ff, fogNear: 900, fogFar: 6200,
    road: 0x2f2450, kerbA: 0xff3d7f, kerbB: 0xfff4e2,
    ground: 0x4b3b78, rim: 0xfff0b8,
    sun: 0xfff2d0, sunPos: [0.4, 0.8, 0.35], amb: 0x8fb6ff, ambI: 0.85,
    music: 'arcade'
  },
  {
    id: 'highway',
    num: 2,
    name: 'THE IMPOSSIBLE HIGHWAY',
    kicker: 'SECTOR 2',
    from: 0.190, to: 0.320,
    sky: [0x5ec3ff, 0xffffff, 0xffc48a],
    fog: 0xe8f4ff, fogNear: 1400, fogFar: 9000,
    road: 0x6f6396, kerbA: 0xff6a33, kerbB: 0xffffff,
    ground: 0xcfe6ff, rim: 0xffffff,
    sun: 0xffffff, sunPos: [-0.3, 0.85, 0.4], amb: 0xcfe8ff, ambI: 1.0,
    music: 'tension'
  },
  {
    id: 'forest',
    num: 3,
    name: 'THE FOREST OF CHAOS',
    kicker: 'SECTOR 3',
    from: 0.320, to: 0.520,
    sky: [0x2f6b4a, 0x8fd67a, 0xffd98a],
    fog: 0x3f7a55, fogNear: 500, fogFar: 4200,
    road: 0x3d3222, kerbA: 0xffc23d, kerbB: 0xf0e4c0,
    ground: 0x1f4227, rim: 0xd6ff9e,
    sun: 0xfff0c0, sunPos: [0.6, 0.55, -0.4], amb: 0x4f8f5e, ambI: 0.75,
    music: 'tension'
  },
  {
    id: 'volcano',
    num: 4,
    name: 'THE FAMILY VOLCANO',
    kicker: 'SECTOR 4',
    from: 0.520, to: 0.700,
    sky: [0x1a0a12, 0x6b1f22, 0xff8a2b],
    fog: 0x36121a, fogNear: 350, fogFar: 3400,
    road: 0x201720, kerbA: 0xff6a1f, kerbB: 0xffd24a,
    ground: 0x1d1016, rim: 0xff9a3d,
    sun: 0xffb054, sunPos: [-0.5, 0.4, -0.6], amb: 0x662030, ambI: 0.9,
    music: 'dread'
  },
  {
    id: 'underground',
    num: 5,
    name: 'THE UNDERGROUND',
    kicker: 'SECTOR 5',
    from: 0.700, to: 0.870,
    sky: [0x040a10, 0x0a1a26, 0x123240],
    fog: 0x061019, fogNear: 220, fogFar: 2600,
    road: 0x141d27, kerbA: 0x27e0d0, kerbB: 0xff3d7a,
    ground: 0x0a141c, rim: 0x4affe8,
    sun: 0x9fe8ff, sunPos: [0.2, 0.9, 0.1], amb: 0x0f3a4a, ambI: 0.7,
    music: 'dread'
  },
  {
    id: 'arena',
    num: 6,
    name: 'THE ARENA',
    kicker: 'FINAL SECTOR',
    from: 0.870, to: 1.000,
    sky: [0x2a1a4a, 0x6b3f96, 0xffbe4a],
    fog: 0x241540, fogNear: 700, fogFar: 6000,
    road: 0x2c1f42, kerbA: 0xffc93d, kerbB: 0xff4f9b,
    ground: 0x1c1030, rim: 0xffd777,
    sun: 0xffd9a0, sunPos: [0.15, 0.62, 0.75], amb: 0x6a4aa8, ambI: 1.35,
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
    topSpeed: 92, accel: 46, brake: 60, grip: 5.6, turn: 1.55, mass: 0.8,
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
    topSpeed: 74, accel: 30, brake: 46, grip: 7.4, turn: 1.15, mass: 2.4,
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
    topSpeed: 85, accel: 40, brake: 55, grip: 9.2, turn: 2.05, mass: 0.7,
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
  { id: 'sugar',  name: 'SUGAR RUSH',        glyph: 'S', color: 0xff4f9b, kind: 'self',    weight: 22 },
  { id: 'cracker',name: 'FAMILY FIRECRACKER',glyph: 'F', color: 0xff8a1f, kind: 'drop',    weight: 20 },
  { id: 'magnet', name: 'RELATIVE MAGNET',   glyph: 'M', color: 0x7a5cff, kind: 'field',   weight: 14 },
  { id: 'blessing',name:'MOM’S BLESSING',glyph: 'B', color: 0xffd23d, kind: 'self',    weight: 14 },
  { id: 'thread', name: 'RAKHI THREAD',      glyph: 'T', color: 0xff2f6b, kind: 'tether',  weight: 16 },
  { id: 'bonk',   name: 'BROTHER’S BONK',glyph: 'K', color: 0x2be0c0, kind: 'forward', weight: 14 }
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
  // sampled control points, in world units
  threadInLength: 10200,
  knotRadius: 2450,
  knotPinch: 980,
  knotPetals: 6,
  knotPetalDepth: 0.155,
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

// tuned against a full run: a clean boosting lap lands near nine and a half
// minutes, a scrappy one closer to eleven
export const RANKS = [
  { r:'S', t: 590 }, { r:'A', t: 645 }, { r:'B', t: 710 }, { r:'C', t: 1e9 }
];
