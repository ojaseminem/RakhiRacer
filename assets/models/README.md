# Drop-in models

The game generates every vehicle in code and needs nothing in this folder. This
is here for when you want to swap one out for something nicer.

## How

1. Download a model as **.glb** (or export one to .glb from Blender).
2. Rename it to one of the filenames below and put it in this folder.
3. Add that filename to `index.json`.

That is the whole process. Whatever is listed gets used, whatever is not keeps
the built in version, and you can mix the two freely.

```json
["velocity.glb", "family-auto.glb"]
```

## Filenames

| Filename | Replaces | Expected length |
|---|---|---|
| `velocity.glb` | VELOCITY, the supercar | 4.8 m |
| `beast.glb` | THE BEAST, the monster truck | 5.6 m |
| `comet.glb` | THE COMET, the hover bike | 4.6 m |
| `family-sports.glb` | Chachu and Didi | 4.2 m |
| `family-sedan.glb` | Papa | 4.4 m |
| `family-suv.glb` | Mama and Mami | 4.8 m |
| `family-hatch.glb` | Mausi and Chachi | 3.2 m |
| `family-auto.glb` | Bua's auto rickshaw | 2.7 m |
| `family-ambassador.glb` | Nana | 4.4 m |
| `family-oldcar.glb` | Nani and Dadi | 3.0 m |
| `family-jeep.glb` | Dada | 3.9 m |
| `brother.glb` | the brother avatar at the end | 2.6 m |
| `sister.glb` | the sister avatar at the end | 2.6 m |

## What the game does to your model

- **Scales it** so its longest horizontal axis matches the length in the table.
  You do not need to model to any particular scale.
- **Sits it on the ground** and centres it. The origin can be anywhere.
- **Re-materials it** into the game's toon shading, keeping the model's own
  colours and any baked texture. This is on purpose. A downloaded model left
  with its original materials looks pasted on top of the game rather than part
  of it.
- **Adds a toon outline.**
- **Spins anything** whose object name contains `wheel`, `tyre`, `tire` or
  `rim`. If the wheels do not turn, that is why: rename them in Blender.

If a model faces the wrong way, change its `forward` value in
`src/art/assets.js` (`+z`, `-z`, `+x` or `-x`) rather than rotating it in
Blender. If it sits too low or floats, adjust `lift`.

## Licences

Whatever you download, check the licence allows redistribution, because pushing
this repo publishes the model with it. CC0 is the safe choice. If a model is
CC-BY, add the attribution to the credits in `README.md` at the repo root.
