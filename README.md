# RAKHI: THE GRAND FAMILY RACE

**One race. One Rakhi. One very angry Mom.**

A cinematic arcade racing game built in Three.js and WebGL.
Made by [Turtle Game Works](https://github.com/ojaseminem).

---

## Running it

There is no build step. Open `index.html` from any static web server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening the file directly with `file://` will not work, because ES modules and
the import map need a real HTTP origin. Any server will do.

## Putting it on GitHub Pages

There is a workflow at `.github/workflows/pages.yml` that publishes the whole
repository on every push to `main`. There is no build step, so it just uploads
the folder as it is.

1. Push this folder to a GitHub repository.
2. Settings, then Pages, then Source: **GitHub Actions**.
3. Push to `main`. The Actions tab will show it deploying.

It will be live at `https://<user>.github.io/<repo>/` a minute or two later.
`.nojekyll` is included so GitHub does not try to run Jekyll over it.

If you would rather not use Actions, the branch method still works: Source
**Deploy from a branch**, branch `main`, folder `/ (root)`.

## Controls

| | |
|---|---|
| Accelerate | **W** or **Up** |
| Brake and reverse | **S** or **Down** |
| Steer | **A** / **D** or **Left** / **Right** |
| Boost | **Shift** |
| Ability | **Space** |
| Use item | **E** |
| Look behind (hold) | **C** or right mouse button |

Holding the look key swings the camera right round behind her, and the panel at
the top of the screen flips to the road ahead so she can still steer. Let go and
it swings back.

| Skip a cinematic | **Esc** |

Gamepad works too: right trigger accelerates, left trigger brakes, left stick
steers, right bumper boosts, A fires the ability, X uses the item and left
bumper looks behind.

Let go of everything and the car coasts down to a comfortable pace rather than
stopping dead, so it never strands anyone who has not held a controller before.
Pressing W is still meaningfully faster.

---

## Where to change things

**The gift.** `src/scenes/rakhi.js`, the `GIFT` object at the top. That is the
whole ending: the line he says, the message, and whatever is inside the box.
Nothing else in the game touches that file.

**The family.** `src/config.js`, the `FAMILY` array. Titles, vehicle types,
colours, personalities and the Hinglish barks are all there. `ELIMINATIONS`
below it controls who goes out where, and what the title card says about them.

**The three rides.** `src/config.js`, the `VEHICLES` array. Stats, ability names
and descriptions, and the physics numbers.

**The look.** `src/config.js`, the `SECTORS` array. Each sector owns a sky
gradient, fog, road colours, ground colour and sun direction. Changing one
changes the entire mood of that stretch of track.

**Rank thresholds.** `src/config.js`, `RANKS`. Times in seconds.

---

## The look

Nothing here is a downloaded model. The visual quality comes from five things,
in rough order of how much each one matters:

1. **Ambient occlusion.** Stylised flat shading with no contact darkening is
   exactly what makes a 3D scene read as untextured geometry floating in a void.
   `GTAOPass` puts it back. Biggest single change in the whole art pass.
2. **A three light rig.** A warm key that throws the shadows, a hemisphere
   filling from sky above and ground below, and a rim light sitting behind the
   action to cut every silhouette off the background.
3. **Four terms on every surface** (`art/materials.js`): a cool tint poured into
   the shadow side so shade is blue rather than black, a sky term on upward
   faces so tops separate from sides, a tight fresnel rim, and a slow world
   space noise so no two square metres are the exact same flat colour.
4. **Windows drawn in the shader** from world position. A thousand towers get
   thousands of lit windows each for the cost of a few instructions, and it is
   the difference between a skyline and a bar chart.
5. **A real colour grade** after tone mapping: lift, gamma, gain, a contrast
   curve, saturation and a split tone. The palette gets pushed as a whole
   instead of by hand tuning forty material colours.

Plus toon outlines on every vehicle, faceted low poly rocks and canopies rather
than smooth spheres, stacked setback towers with roof clutter, and something
crossing overhead every few hundred metres, which sells speed better than any
amount of motion blur.

There is a **quality guard** in `main.js` that watches the frame time and steps
the expensive things off one at a time if the machine cannot hold up. It only
ever steps down, so it cannot oscillate, and it means nobody has to pick a
graphics preset.

## Better art, if you want it

See **`ASSETS.md`** for where to get free models and, more usefully, what is
actually worth replacing. Drop a `.glb` into `assets/models/`, add its name to
`index.json`, and the game uses it instead of the built in one, rescaled,
re-oriented, re-shaded to match and outlined. No code changes.

## How it is put together

```
index.html            the page, the import map, all the UI markup
.github/workflows/    the Pages deploy
assets/fonts/         the four typefaces, self hosted
assets/models/        drop .glb files here to replace built in vehicles
vendor/               three.js and the handful of jsm modules used
src/
  config.js           every tunable number and every piece of content
  main.js             boot, the frame loop, screens, save data
  core/
    director.js       the camera: chase rig, cinematic shots, shake, hit stop
    input.js          keyboard and gamepad
    post.js           occlusion, bloom, colour grade, speed blur, vignette, AA
  world/
    track.js          the rakhi shaped spline and the road mesh
    props.js          instanced city, forest, canyon, tunnel and arena dressing
  art/
    materials.js      the toon shading, the shadow tint, the window shader
    assets.js         drop-in .glb loading and re-shading
    build.js          every vehicle and character, built from code
    vfx.js            one particle system for the whole game, plus speed lines
  game/
    vehicle.js        arcade driving on a rail
    ai.js             the twelve relatives and their behaviours
    items.js          the six family power-ups
    boss.js           Mom
    race.js           the run, and every cinematic beat in one readable list
  audio/audio.js      all sound, generated live. no audio files anywhere
  ui/
    hud.js            the interface
    style.css         the type system and every screen
  scenes/rakhi.js     the ending. yours to fill in
```

### A few things worth knowing

**The track is a rakhi.** Not decoratively. The racing spline, seen from above,
is a long thread, a six petal flower knot, and a shorter trailing thread. The
knot is a rose curve traversed one and a half times, so it crosses over itself,
and the road spirals in height through it, which turns every crossing into a
real over and under pass. That is also where the forest, the volcano and the
underground live. The camera reveals the shape at the very end.

**Nothing lives in world space.** Every vehicle is a distance along the spline,
an offset to one side, and a height. World position is derived from those three
numbers each frame. That is why the AI, the collisions, the respawns and the
camera are all cheap, and why the track can be any shape without any of the rest
of the code caring.

**There are no asset files.** Every model, every material and every sound is
generated in code at load time. The whole game is a few hundred kilobytes.

**Everything cinematic is a beat.** `race.js` has one array of them: a distance
along the track and a function that fires once when she passes it. The entire
eleven minute structure is readable top to bottom in that list.

---

Original work. The references (a 2018 film's opening race, a certain battle
royale's art style, a certain kart game's item chaos) informed tone and grammar
only. Every vehicle, character, prop and piece of music here was built from
scratch.
