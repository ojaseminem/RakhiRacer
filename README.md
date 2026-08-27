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

`index.html` is at the repository root and everything it needs is committed
alongside it, so Pages needs no configuration at all:

1. Push this folder to a GitHub repository.
2. Settings, then Pages, then Source: **Deploy from a branch**.
3. Branch `main`, folder `/ (root)`. Save.

It will be live at `https://<user>.github.io/<repo>/` in a minute or two.
`.nojekyll` is included so GitHub does not try to run Jekyll over it.

## Controls

| | |
|---|---|
| Steer | Arrow keys or **A** / **D** |
| Boost | **Shift** |
| Ability | **Space** |
| Item | **E** |
| Skip a cinematic | **Esc** |

Gamepad works too. The throttle is automatic and the steering has a generous
assist, so it plays fine for someone who has never held a controller.

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

## How it is put together

```
index.html            the page, the import map, all the UI markup
vendor/               three.js and the handful of jsm modules used
src/
  config.js           every tunable number and every piece of content
  main.js             boot, the frame loop, screens, save data
  core/
    director.js       the camera: chase rig, cinematic shots, shake, hit stop
    input.js          keyboard and gamepad
    post.js           bloom, speed blur, aberration, vignette, grain, letterbox
  world/
    track.js          the rakhi shaped spline and the road mesh
    props.js          instanced city, forest, canyon, tunnel and arena dressing
  art/
    materials.js      the toon and rim shading everything uses
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
