# RAKHI RACER
### A Grand Prix of the Ancestors

Built for Raksha Bandhan. Three.js / WebGL, desktop, hosted on GitHub Pages.

---

## 1. The pitch

Your sister's avatar enters a race nobody has ever finished. Twelve relative
vehicles on the grid, a candy-coloured city loop, and a forty-foot Mom waiting
at the far end. Everyone races forward. Everyone dies.

The secret is that you have to go backwards.

Five minutes, three acts, one continuous run. At the finish line her brother's
avatar is waiting with the rakhi.

---

## 2. Art direction

The whole thing lives or dies on this, so it gets its own rules.

**Fall Guys grammar, taken seriously**

- Over-inflated forms. Everything reads as vinyl and foam, not metal. Rounded
  bevels everywhere, no sharp edges anywhere.
- Jellybean vehicle proportions: fat tyres, tiny cabins, squashed silhouettes,
  slight squash-and-stretch on landing.
- Palette: high-chroma pastels against deep saturated ground. Bubblegum, mint,
  sunshine yellow, cyan, coral, over a soft lilac road and cream kerbs.
- Materials: no PBR. A custom toon shader with a 3-band ramp, a strong fresnel
  rim light, and a warm bounce term on the underside. Matte and slightly waxy.

**The tonal swing**

Act 1 is bright and stupid and fun. Act 2 inverts the palette completely:
desaturated teal and amber, volumetric shafts, dust in the air, the pastel world
seen from underneath as broken candy. That swing is where the Ready Player One
feeling actually comes from, not from copying the movie's assets.

**Banned list** (this is how it avoids looking machine-generated)

- No default grey MeshStandardMaterial, no chrome spheres, no HDRI studio look
- No purple-to-blue gradient background
- No Inter, Poppins, or Montserrat in the game UI
- No glassmorphism panels, no thin neon grid floor, no lens flare sprites
- No emoji in UI copy

**Fonts** (all widely used, none of them defaults)

| Role | Face | Why |
|---|---|---|
| Titles, nameplates, boss cards | **Titan One** | Heavy rounded arcade, closest free match to the Fall Guys feel |
| HUD, speed, timer, rank | **Chakra Petch** | Racing telemetry, squared-off, reads fast at speed |
| In-world signage and billboards | **Bungee** | Real arcade signage lettering, sells the OASIS-arcade texture |

---

## 3. The three vehicles

A proper risk / reward triangle so all three are worth replaying.

**MITHAI GT** (the supercar)
Lowest, longest, highest top speed, worst grip. Pink and cream with gold trim.
Signature: *Sugar Rush*, a boost that leaves a candy-ribbon afterimage.
Plays like: commit to the line or spin out.

**THE BELAN** (the heavy monster truck)
Named after Mom's rolling pin, which becomes a joke later. Slowest, heaviest,
enormous foam tyres, teal and orange.
Signature: *Thump*, a shoulder-check that punts relatives clean off the track.
Also the only vehicle that can drive straight over Act 2 rubble.
Plays like: you are the hazard.

**CHAND** (the bike)
Long, low, red and white, wide rear tyre, underglow. The Art3mis silhouette
without being her bike.
Signature: *Slipstream*, draft behind a relative to bank a huge burst, plus a
lean-tuck for gaps nothing else fits through.
Plays like: highest ceiling, one hit and she is off it.

---

## 4. Structure

### Act 1: The Forward Run (~90s)

Candy boulevard, twelve relatives on the grid. Full Mario Kart layer here:

- Drift-boost with a three-stage charge (blue, orange, violet)
- Item boxes: Chappal Missile, Laddoo Mines, Ghee Slick, Turbo Chai, Diya Shield
- Escalating hazards: a rolling giant laddoo, then a living inflatable dinosaur
  bouncy-castle that chomps karts off the road

The boulevard opens into a plaza. Mom is standing in it. She swats the entire
field. Sister included. Hard cut to black.

### Act 2: The Revelation (~2 min)

Rewind to the grid. Reverse gear, camera flipped, the whole field roars past her
the other way. The road cracks and she drops into the **Under-Track**: a
collapsing half-lit undercity beneath the circuit.

This is the centrepiece. No rivals down here, just driving. And one at a time,
each relative's vehicle punches through the ceiling above her and is destroyed
in slow motion, each with its own title card:

> **CHACHU** ... scooter, sideways, sparks
> **MAUSI** ... minivan, roof-first
> **NANA** ... vintage Ambassador, dignified to the last
> **BUA** ... auto-rickshaw, spinning like a coin
> **NANI** ... still holding the tiffin

Falling debris, collapsing floor, speed gates, and a very long tunnel with a
light at the far end.

### Act 3: MOM (~90s)

She erupts out of the ground behind Mom, on the finish straight, driving
backwards toward the line. Mom turns around. Three phases:

1. **Belan sweeps.** Lane-dodge, telegraphed by shadow.
2. **Chappal throws.** Ground shadows mark impact, they get faster.
3. **The arch.** She rips the finish line out of the ground. Only your
   vehicle's signature move gets you through.

Mom is not a monster. She is a forty-foot bean in a saree with a rolling pin, a
chappal and a steel ladle. Frightening and funny at the same time, which is the
whole gag and the reason this reads as a gift and not a generic racing game.

### The Rakhi

Cross the line, slow motion, confetti. Brother's avatar is waiting. Camera lands
on the two of them. He ties the rakhi.

The gift itself is a **swappable scene module** (`src/scenes/rakhi.js`) with a
clearly marked TODO, so dropping in whatever you decide later is a five minute
job and touches nothing else.

---

## 5. Replayability

- **Story Run.** Soft-fail. Crashes cost time and trigger a rewind flash, but
  she always reaches the finish. Nobody gets locked out of the gift.
- **Rank** on time, style and relatives punted: S / A / B / C.
- **Time Attack** unlocks on first finish. Full track, your own ghost, best
  times saved locally.
- **Mom Rush** unlocks at S rank. Boss fight only, endless escalating phases.
- Three vehicles, three completely different feels.

---

## 6. Technical

**No build step.** Plain ES modules and an importmap, three.js vendored into
`/vendor`. `index.html` sits at the repo root, so GitHub Pages needs zero
configuration and you can push straight from the folder.

| System | Approach |
|---|---|
| Driving | Arcade kart model, not rigid body. Longitudinal accel and drag, lateral grip with a slip-angle drift term. |
| Track | Catmull-Rom centreline with width. Makes AI, collision, respawn and progress all trivial and cheap. |
| Rendering | One directional shadow with soft PCF, custom toon and rim ShaderMaterial, instanced props and crowd, gradient sky dome, tuned fog. |
| Post | EffectComposer: soft bloom, radial speed blur that ramps with velocity, chromatic aberration on boost, vignette, fine grain, letterbox bars in cutscenes. |
| VFX | GPU point-sprite particles for drift sparks, boost trails, debris and confetti. Ribbon tyre marks, screen shake, hit-stop freeze frames on impact, speed lines. |
| Audio | Fully procedural WebAudio, no files to download. Engine is two detuned saws plus noise with pitch tied to RPM and a different timbre per vehicle. Impacts are filtered noise bursts. Music is a three-layer synth bed that reconfigures per act: bright arcade, then sparse dread, then full drums. |
| Camera | Chase spring with FOV kick on boost and look-ahead on drift, plus a director module that takes over with authored keyframes for every cinematic. |
| Input | Keyboard and gamepad. Desktop only, so the visual budget goes up accordingly. |

**Layout**

```
index.html
vendor/            three.module.js and the jsm modules we use
src/
  main.js
  core/            loop, input, audio, camera director, post stack
  game/            vehicle, track, ai, items, boss, race state
  art/             materials, palette, procedural meshes, vfx
  ui/              hud, title cards, rank screen, menus
  config/family.js Hindi titles, one file to edit
  scenes/rakhi.js  the gift moment, TODO for you
README.md
```

---

## 7. Build order

Four passes. It is playable in a browser at the end of every one, so there is
never a point where it is broken and the deadline is tomorrow.

1. **Playable core.** Track spline, kart physics, camera, three vehicles blocked
   out, working HUD. You can drive it.
2. **Art pass.** Shaders, palette, world dressing, sky, post stack, fonts. It
   starts looking like the real thing.
3. **The show.** Act 2 underground and the relative death cinematics, Mom boss,
   title cards, all audio, all VFX.
4. **Polish and ship.** Rank screen, Time Attack, menus, git init, Pages
   instructions.

---

## 8. Note on originality

Every vehicle, character and prop is designed from scratch. The references
(a certain 2018 film's opening race, a certain battle royale's art style) are
used as tone and grammar only, never as assets or direct copies. Mom, the
relatives, the track and the three vehicles are all original designs.
