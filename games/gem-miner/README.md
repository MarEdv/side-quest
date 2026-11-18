# 💎 Gem Miner

A single-player browser game: dig through dirt, stone, granite and obsidian for gems, sell them in town, buy better hatchets
(wood, stone, steel, gem) and find the **Diamond of Your Dreams**.

**Play:** https://maredv.github.io/side-quest/games/gem-miner/ (part of the [Side Quest Project](../../README.md))

- Requirements: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)
- Decisions, assumptions and the balance numbers: [docs/DECISIONS.md](docs/DECISIONS.md)

## Controls
- **Keyboard:** WASD / arrows walk and dig (hold toward rock to mine), **E** / Enter shop (in town; stepping on the shop tile
  opens it too), **M** minimap, **P** / Esc pause.
- **Touch:** on-screen D-pad (or `touchScheme=joystick`), a Shop button in town, 🗺 and ⏸ buttons.

## Feature flags
Append to the URL, e.g. `?worldSize=128&seed=42&durability=1`. Full table in [docs/FLAGS.md](docs/FLAGS.md):
`worldSize` (256/128/512), `seed`, `camera` (deadzone/center), `fog` (1/0), `durability` (0/1), `touch` (auto/on/off),
`touchScheme` (dpad/joystick; old name `touchControls`), `sound` (1/0), `debug` (0/1: reveals the map, 99,999 coins, no autosave, no best times).

## Develop
```sh
npm start        # at the repo root: http://localhost:8000/games/gem-miner/ (or here, then http://localhost:8000/)
npm test         # in this folder: node --test tests/*.test.js, no dependencies
node tools/sim.mjs --size 128,256,512 --seeds 1,2,3   # balance bot: how long a perfect player takes
```
The progress autosaves in `localStorage` under `gem-miner.save`; best times under `gem-miner.scores`.
