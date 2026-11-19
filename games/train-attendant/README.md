# 🚆 Train Attendant

A single-player browser game: you are the attendant on a passenger train. Walk the aisle, check tickets, serve coffee and
snacks and keep the passengers calm from the first station to the last, while the train manager radios you side quests
(rescue the passengers of a broken-down train, calm a panicking traveller, save a connection, find a lost bag, help a sick
passenger). Top-down Canvas 2D, English and Swedish, desktop and touch.

**Play:** https://maredv.github.io/side-quest/games/train-attendant/ (part of the [Side Quest Project](../../README.md))

- Requirements: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)
- Decisions, assumptions and the balance numbers: [docs/DECISIONS.md](docs/DECISIONS.md)

## Controls
- **Keyboard:** ←/→ or A/D walk, **Space** / **E** action (hold for tickets, questions and the radio), **1 2 3** pick ☕ 🥪 💧
  at the café counter (**0** / Backspace puts the item back), **Y** / **N** accept / decline a radio offer, **P** / Esc pause.
- **Touch:** ◀ ▶ bottom left (slide between them), a big ACTION button bottom right (hold works, walking and the action at
  the same time), on-screen Accept / Decline and café buttons, a ⏸ button. Shown automatically on touch devices.
- The game pauses when the window loses focus or the page is hidden.

## Feature flags
Append to the URL, e.g. `?trip=short&quests=assign&seed=42`. Full table in [docs/FLAGS.md](docs/FLAGS.md): `trip`
(short/normal/long), `cars` (2/3/4), `difficulty` (easy/normal/hard), `quests` (offer/assign), `stress` (solo/contagious),
`seed`, `touch` (auto/on/off), `sound` (1/0), `debug` (0/1: FPS and seed line, a 4× speed button, `window.__game`, nothing
saved to the best scores).

## Develop
```sh
npm start        # at the repo root: http://localhost:8000/games/train-attendant/ (or here, then http://localhost:8000/)
npm test         # in this folder: node --test tests/*.test.js, no dependencies
node tools/sim.mjs   # balance bots (idle / sloppy / good / hider) over many seeds
```
The pure logic (`src/game.js` and the modules it uses) is deterministic for a seed and tested in Node; the browser layer is
`src/main.js` (loop and screens), `render.js` (canvas), `input.js`, `ui.js` (DOM overlays) and `audio.js`.
Best scores (top 5 per trip length) are kept in `localStorage` under `train-attendant.scores`.
