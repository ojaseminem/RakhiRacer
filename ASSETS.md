# Where to get better art

Everything in this game is generated in code, so none of this is required. But
if you want to swap things out, here is where to look and, more usefully, what
is actually worth swapping.

Drop-in instructions are in `assets/models/README.md`. Short version: rename the
`.glb`, put it in `assets/models/`, add the filename to `index.json`.

---

## What is worth replacing, in order

**1. The three hero rides.** On screen one hundred percent of the time, dead
centre, closer to the camera than anything else. A good car model is the single
biggest visual upgrade available and it is worth spending real time on.

**2. The twelve family vehicles.** Second most visible. An actual auto rickshaw
model for Bua would be worth it on its own.

**3. The two avatars at the end.** They hold the last shot of the game for
fifteen seconds and they are currently two beans.

**Probably not worth it: the environment.** The city, forest, canyon and tunnel
are built procedurally and shaded to match each other. Dropping in downloaded
buildings and trees means they arrive with someone else's proportions and
someone else's colour choices, and the result usually looks worse than the
coherent version, not better. If you do want to try, swap a whole sector at
once rather than a few props, or it will read as a patchwork.

---

## Sources, best fit first

### Kenney — https://kenney.nl/assets
**CC0, no attribution required.** One artist, consistent chunky low-poly style,
which is exactly this game's language. This is the first place to look.

- **Car Kit** — https://kenney.nl/assets/car-kit
  Cars, trucks, a van, a delivery truck. Modular, so the wheels are separate
  objects, which means they will spin.
- **Racing Kit** — https://kenney.nl/assets/racing-kit
  Track pieces, barriers, cones, flags.
- **City Kit (Commercial)** — https://kenney.nl/assets/city-kit-commercial
- **City Kit (Suburban)** — https://kenney.nl/assets/city-kit-suburban
- **Nature Kit** — https://kenney.nl/assets/nature-kit
- **Mini Characters 1** — https://kenney.nl/assets/mini-characters-1
  Rigged, and a much better brother and sister than the beans.
- **UI Pack** — https://kenney.nl/assets/ui-pack
- **Game Icons** — https://kenney.nl/assets/game-icons
- **Interface Sounds** — https://kenney.nl/assets/interface-sounds

Kenney ships OBJ, FBX and GLTF. Take the GLTF/GLB.

### Quaternius — https://quaternius.com
**CC0.** Also single artist, slightly more detailed than Kenney.

- Ultimate Vehicles Pack, Modular Vehicles, Animated Characters, Stylized
  Nature. All free, all CC0.

### Poly Pizza — https://poly.pizza
The Google Poly archive plus new work. **Downloads straight to GLB**, which
makes it the fastest option of all: search, download, rename, done. Licences
are per model and shown on the page, mostly CC0 or CC-BY.

Useful searches: `car`, `sports car`, `truck`, `motorcycle`, `rickshaw`,
`auto rickshaw`.

### KayKit (Kay Lousberg) — https://kaylousberg.itch.io
**CC0.** City Builder pack, Character pack, Vehicle pack. Very close in feel to
what this game is already doing.

### Sketchfab — https://sketchfab.com
Enormous, and the quality ceiling is far higher, but it needs care:

1. Search, then filter **Downloadable** and set **Licenses** to
   *CC0* or *CC Attribution*.
2. Download the **glTF** option, not FBX or the original.
3. Models here are often high poly and PBR textured. The game strips the
   materials and re-shades them, so a heavily textured model may lose the thing
   that made it look good in the preview. Low poly stylised models transfer
   much better than realistic ones.

Direct filtered link:
https://sketchfab.com/search?features=downloadable&licenses=322a749bcfa841b29dff1e8a1bb74b0b&type=models

### Textures, if you want them
- **ambientCG** — https://ambientcg.com — CC0
- **Poly Haven** — https://polyhaven.com/textures — CC0

### Sound, if you want to replace the synthesised audio
- Kenney's audio packs (CC0), linked above
- **Freesound** — https://freesound.org — licence varies per file, check each

---

## One rule

If you push this repo to GitHub Pages, you are publishing every asset in it. CC0
is the safe choice because it needs nothing from you. CC-BY is fine too, but add
the credit to the bottom of `README.md`. Anything marked non-commercial or
no-derivatives, leave alone.
