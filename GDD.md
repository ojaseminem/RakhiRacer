# RAKHI: THE GRAND FAMILY RACE
**One race. One Rakhi. One very angry Mom.**

Cinematic arcade racing. Browser, desktop, Three.js + WebGL. Single player.
Roughly 11 minutes end to end. Built for Raksha Bandhan.

---

## 0. What changed in the merge

Your GPT pass had better bones than mine in four places, so those win:

| Thing | Locked version | Why |
|---|---|---|
| Title | RAKHI: THE GRAND FAMILY RACE | Better than mine. Says the whole game in five words. |
| Vehicle names | VELOCITY / THE BEAST / THE COMET | Cleaner and more readable than MITHAI GT / BELAN / CHAND. Indian flavour moves into the ability names and the family instead, where it belongs. |
| Track | Six sectors, one continuous journey | Beats my single city loop by a mile. The world collapsing behind her is the whole point. |
| The "backwards" moment | The **camera** reverses, not the gearbox | See section 6. This is the important call and it is the right one. |

And three places where mine wins, so those stay:

| Thing | Locked version | Why |
|---|---|---|
| Soft fail | She always finishes | It is a gift. Nobody gets locked out of the ending by a skill wall. Rank carries the challenge instead. |
| Replay modes | Time Attack + Mom Rush | An 11 minute one shot gets played once. These make it a game she comes back to. |
| Relative names | Hindi family titles | Mummy, Chachu, Mausi, Bua, Nana, Nani. You picked this and it is what makes it hers and not a demo. |

Plus one new thing that is the spine of the whole design:

> **The track is literally shaped like a rakhi.** Not as a decoration. The
> actual racing spline, seen from above, forms a rakhi: two long threads with a
> flower knot in the middle. Every sector sits on a specific part of that shape.
> The final camera flyback reveals it. This is now a hard authoring constraint,
> not an easter egg.

---

## 1. THE FLOW

```
0:00  BLACK. Engine rev. BOOM.
0:10  Camera rises out of darkness over the starting grid.
      Thousands of vehicles to the horizon.
0:25  Holographic sign:  THE GRAND FAMILY RACE
                         DESTINATION: THE RAKHI
0:40  TITLE
0:45  VEHICLE SELECT          three rides, live 3D, stat bars
1:00  Grid. 3. 2. 1. GO. The world explodes forward.

1:00  SECTOR 1   THE FAMILY CITY            thread, lower left
2:20  SECTOR 2   THE IMPOSSIBLE HIGHWAY     thread rising
      >>> first cutaway: the relatives behind her miss the gap
3:40  SECTOR 3   THE FOREST OF CHAOS        into the knot
5:00  SECTOR 4   THE FAMILY VOLCANO         knot core, route split
6:20  SECTOR 5   THE UNDERGROUND            under the knot
      >>> THE CAMERA TURNS AROUND
      >>> the track collapses, relatives fall, Chachu signs off
7:50  SECTOR 6   THE ARENA                  thread, upper right

8:00  MOM
      Phase 1  SURVIVE      she destroys the road behind you
      Phase 2  FIGHT BACK   each vehicle has its own answer
      Phase 3  COLLAPSE     no track left, floating platforms
9:40  The final ramp. Slow motion. Her hand misses by nothing.

10:00 FINISH. Confetti. Survivors limp in behind her.
      One is upside down. One is hanging in a tree.
10:20 CHAMPION. Rank. Stats.
10:40 The camera flies backward. City, highway, forest, volcano,
      underground, arena. Further. Further.
      The track resolves into the shape of a RAKHI.
11:00 Her brother is standing at the finish platform with a gift.
      "You made it."
11:20 Your message. Fade.
```

---

## 2. THE THREE RIDES

Difficulty is hidden inside the vehicle choice. No difficulty menu.

### VELOCITY | "I want to go FAST."
Sleek, tiny, absurdly aerodynamic. Deep red.

|  |  |
|---|---|
| Speed | 5 / 5 |
| Acceleration | 5 / 5 |
| Weight | 2 / 5 |
| Handling | 1 / 5 |

**NITRO BURST.** Enormous boost, glowing ribbon trail, camera FOV punches out,
the world smears. Commit to the line or spin.
**Against Mom:** hits her exposed weak points on the flyby. Highest damage, has
to get close.

### THE BEAST | "GET OUT OF MY WAY."
Comically oversized monster truck. Teal and orange, foam tyres.

|  |  |
|---|---|
| Speed | 3 / 5 |
| Attack | 5 / 5 |
| Defense | 4 / 5 |
| Weight | 5 / 5 |

Rams cars, flips smaller vehicles, smashes barricades, shrugs off hazards.
**FAMILY FURY.** Charge forward. Everything in front goes *weeeeee* off the
track. The forgiving pick: it barely notices mistakes.
**Against Mom:** the only ride that can ram her armour plates directly.

### THE COMET | "I want to do cool shit."
Futuristic hover bike. One rider, glowing wheels, long body, neon trails, slight
float. The hero silhouette. Not a copy of anyone's bike.

|  |  |
|---|---|
| Speed | 4 / 5 |
| Handling | 5 / 5 |
| Boost | 4 / 5 |
| Weight | 2 / 5 |

**PHASE DASH.** For a few seconds she passes straight through obstacles and
vehicles. Highest skill ceiling, and the sector 5 collapse basically becomes a
playground.
**Against Mom:** phases through her attacks entirely. Style pick.

---

## 3. THE WORLD

Six sectors, one unbroken spline, laid out along a rakhi.

**SECTOR 1 | THE FAMILY CITY**
Enormous saturated city. Billboards, crowds, moving traffic. The road splits
into multiple routes with shortcuts, ramps and jump pads. Thousands of racers
visible. This sector teaches everything without a tutorial.

**SECTOR 2 | THE IMPOSSIBLE HIGHWAY**
Road launches skyward onto a suspended highway. City below, clouds above, and a
MASSIVE GAP ahead. Cars jump. Some make it.
Then the camera cuts to the back of the pack and we watch relatives miss it, one
after another, dropping into cloud. No gore, pure spectacle. Cut back to her.

**SECTOR 3 | THE FOREST OF CHAOS**
Collapsing trees, swinging branches, rolling logs, mud that kills grip,
explosive barrels. A giant boulder crosses the track and everyone swerves.
One relative does not. BONK.

**SECTOR 4 | THE FAMILY VOLCANO**
Volcanic canyon, lava on both sides. The road forks:
**SAFE ROUTE** (longer, clean) or **DANGEROUS ROUTE** (shorter, collapsing
platforms). A real decision, not a hold-forward corridor.

**SECTOR 5 | THE UNDERGROUND**
Plunges into vast dark neon tunnels. Then the floor begins to go. CHUNK. A slab
drops with cars on it. CHUNK. Another. Then silence, and the camera turns
around. See section 6.

**SECTOR 6 | THE ARENA**
The road opens into a colossal arena and everything goes quiet.

---

## 4. FAMILY POWER-UPS

Glowing boxes on track. One slot, fire with **E**.

| | |
|---|---|
| **SUGAR RUSH** | Huge temporary speed boost |
| **FAMILY FIRECRACKER** | Bouncing explosive dropped behind you |
| **RELATIVE MAGNET** | Drags nearby vehicles toward you. Devastating on The Beast |
| **MOM'S BLESSING** | Brief invincibility, gold aura |
| **RAKHI THREAD** | Glowing tether snaps onto the vehicle ahead and reels you in |
| **BROTHER'S BONK** | A giant cartoon boxing glove on a spring. Absolutely ridiculous |

---

## 5. THE FAMILY

Not generic AI. Every one is a recognisable vehicle with a behaviour and a mouth.

| Who | Vehicle | Behaviour |
|---|---|---|
| **CHACHU** | Overpowered sports car | **The rival.** Shortcuts, rams her, taunts |
| **PAPA** | Sensible sedan | Drives flawlessly. Never crashes. Never wins |
| **MAMA** | Enormous SUV | Slow, heavy, literally cannot be knocked out |
| **MAUSI** | Tiny hatchback | Terrifyingly fast, aggressive, no fear |
| **BUA** | Auto rickshaw | Three wheels. Should not be here. Somehow keeps up |
| **NANA** | Vintage Ambassador | Slow. Survives absolutely everything. Dignified |
| **NANI** | Little old car | Starts in the lead. Falls off the track in ten seconds |
| **DADA / DADI / CHACHI / MAMI / DIDI** | assorted family chaos | Grid dressing with personality |

**Barks** float over vehicles in Hinglish:
"HATO!" &nbsp; "MAIN JEET RAHA HOON!" &nbsp; "ARRE RUKO!" &nbsp;
"ITNI TEZ KYUN?!" &nbsp; "BETA DHYAN SE!" &nbsp; "MERI GAADI!"

### The Chachu arc
Ahead of her. She passes him. He passes her. He rams her. She gets revenge. He
is ahead again at the underground. Then the floor goes, and he does not.

Last transmission, static, over black:
> **"YOU BETTER WIN THIS."**

---

## 6. THE SIGNATURE MOMENT

Your original ask was that she drives backwards like the film. GPT's version
turns the **camera** around instead. Going with the camera, and here is why.

Driving in reverse for a whole sector fights the player, kills the speed
sensation and makes the collapse hard to read. Flipping the camera keeps her at
full speed while she watches the world end behind her. Same beat, better game.

**How it plays.** Deep in the underground, the audio drops to nothing. The
camera swings 180 degrees and locks. She is still driving forward at 300 km/h,
but now she is looking back down the tunnel at the entire race stretched into
the distance.

Then it starts.

BOOM. A whole section of track lets go. Vehicles vanish under it.
The camera picks one falling relative and follows it for a beat.
Then another. Then another.
Each one gets a title card.

Steering is inverted-feel during this, which is disorienting on purpose, and
there is a soft assist so she never actually wrecks. It lasts about 35 seconds
and it is the moment she will describe to people afterwards.

---

## 7. MOM

The road opens into the arena. Silence. The camera tilts up. And up. And up.

Not a car. A **colossal machine**: monster truck crossed with a mobile fortress
crossed with maternal authority. Headlights come on like eyes.

> **MOM HAS ENTERED THE RACE.**

She does not race you. She attacks the world you are racing on.

**PHASE 1 | SURVIVE.** Giant mechanical arm slams the ground. Road sections flip
and fold. She hurls debris. Shockwaves roll down the track. Just stay ahead.

**PHASE 2 | FIGHT BACK.** Weak points open. Beast rams the armour. Velocity
strikes on the flyby. Comet phases through and hits from inside. Power-ups
matter here.

**PHASE 3 | COLLAPSE.** She is furious. The arena disintegrates. There is no
track any more, only floating platforms toward the finish. She charges. Sister
boosts. Everything explodes behind her. Slow motion. The final ramp. Mom's hand
closes on empty air. WHOOSH.

---

## 8. THE FINISH

Silence. She lands. The line is right there. She crosses it. Confetti.

The survivors come in behind her over the next few seconds. Damaged. One
upside down. One missing wheels. One is hanging in a tree.

**CHAMPION.** Rank S to C on time, style and relatives punted.

Then the camera starts flying backward and does not stop. City, highway, forest,
volcano, underground, arena, all of it laid out with tiny wrecked vehicles
scattered across it. Further back. Further.

And the whole track resolves into a **RAKHI**.

Fade in on the finish platform. Her brother is standing there with a wrapped
gift. He walks over and hands it to her.

> **"You made it."**

Then your message.

*(The gift contents live in `src/scenes/rakhi.js`, clearly marked. Swapping in
whatever you decide is a five minute job and touches nothing else.)*

---

## 9. ART DIRECTION

**Fall Guys readability, arcade racing spectacle, cinematic sci-fi scale, Indian
rakhi visual language.**

Chunky adorable characters and comically exaggerated vehicles against a world
that is enormous and genuinely falling apart. Cute characters, ridiculous
stakes. That contrast is the entire look.

- Rounded everything. No sharp edges. Vinyl and foam, never metal.
- Saturated flat materials: custom three band toon ramp, hard fresnel rim light,
  warm bounce underneath. No PBR, no chrome, no HDRI studio look.
- Oversized props, readable silhouettes, squash and stretch on landings.
- Each sector owns a palette and they swing hard: city is bubblegum and cyan,
  highway is white cloud and hot coral, forest is deep green and amber, volcano
  is black and molten orange, underground is desaturated teal and neon, arena is
  storm purple and gold.

**Cinematics get the full kit:** depth of field, motion blur, camera shake,
speed lines, particles, explosions, slow motion, dynamic lighting, large scale
environmental destruction, letterbox bars.

**Type.** Titan One for titles and nameplates, Chakra Petch for HUD telemetry,
Bungee for in-world signage.

**Explicitly banned**, because this must not look machine generated: default
grey materials, chrome spheres, purple-to-blue gradient skies, Inter, Poppins,
Montserrat, glassmorphism panels, thin neon grid floors, lens flare sprites,
emoji in UI.

---

## 10. CONTROLS

She is not a gamer. The game does most of the driving.

| | |
|---|---|
| Steer | Arrow keys or A / D |
| Boost | Shift |
| Ability | Space |
| Item | E |
| Skip cinematic | Esc |

Gamepad supported. Auto throttle, generous steering assist, magnetic racing
line, and a soft rail so she cannot fall off during cinematics. She controls
steering, boost, attack and items. The spectacle handles the rest.

**Soft fail.** Crashes cost time and trigger a rewind flash. She always finishes.

---

## 11. REPLAY

- **Story Run.** The full 11 minutes. Rank S / A / B / C.
- **Time Attack.** Unlocks on first finish. Full track, no cinematics, your own
  ghost, best times saved locally.
- **Mom Rush.** Unlocks at S rank. Boss only, endless escalating phases.
- Three rides that play completely differently.

---

## 12. TECH

**No build step.** Plain ES modules with an importmap, three.js vendored into
`/vendor`, `index.html` at the repo root. GitHub Pages needs zero configuration
and you push straight from the folder.

| System | Approach |
|---|---|
| Driving | Arcade rail model. Everything is parameterised as (distance along spline, lateral offset, height). Makes AI, collision, respawn, progress and camera all trivial and cheap, and lets the track be any shape including a rakhi. |
| Track | One Catmull-Rom spline, roughly 30km, built as a single road ribbon mesh at load. Sector boundaries are just ranges along it. |
| Rendering | One directional shadow with soft PCF, custom toon + rim ShaderMaterial, heavy instancing for props and crowd, gradient sky dome, per sector fog. |
| Post | Bloom, radial speed blur ramped by velocity, chromatic aberration on boost, vignette, grain, letterbox. |
| VFX | GPU point sprites for sparks, boost trails, debris, confetti. Ribbon trails, screen shake, hit stop on impact, speed lines. |
| Audio | Fully procedural WebAudio. Zero files to download. Engine is detuned saws plus noise with pitch on RPM and a different timbre per ride. Music is a layered synth bed that reconfigures per sector: arcade, tension, dread, then full drums for Mom. |
| Camera | Chase spring with FOV kick and drift look-ahead, plus a director that takes over with authored keyframes for every cinematic. |

**Layout**
```
index.html
vendor/                three.module.js + the jsm we use
src/
  main.js              boot, loop, state machine
  config.js            all tunables: family, vehicles, palettes, sectors
  art/                 materials, procedural meshes, vfx
  world/               spline, road, sector dressing
  game/                vehicle, ai, items, boss, race state
  audio/               procedural WebAudio
  ui/                  hud, title cards, menus, style.css
  scenes/rakhi.js      the gift moment. YOURS TO FILL.
```

---

## 13. BUILD ORDER

Four passes. Playable in a browser at the end of every one, so it is never in a
broken state.

1. **Playable core.** Rakhi-shaped spline, road mesh, kart physics, chase camera,
   three rides blocked out, HUD, sector transitions. You can drive the whole track.
2. **Art pass.** Toon shader, six sector palettes, procedural vehicles and world
   dressing, sky, post stack, type. It starts looking like the real thing.
3. **The show.** AI relatives with personalities and barks, power-ups, the
   highway cutaway, the camera reverse, the Chachu arc, Mom's three phases, all
   audio, all VFX.
4. **Polish and ship.** Results, the rakhi flyback reveal, the gift scene, Time
   Attack, Mom Rush, performance pass, git init, GitHub Pages.

---

## 14. ORIGINALITY

Every vehicle, character, prop and piece of music is built from scratch in code.
The references (a 2018 film's opening race, a certain battle royale's art style,
a certain kart game's item chaos) are used as tone and grammar only. Never as
assets, never as direct copies. Mom, the family, the track and the three rides
are original designs.
