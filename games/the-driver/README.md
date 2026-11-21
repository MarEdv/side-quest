# 🚗 The Driver

A single-player browser game: three minutes behind the wheel. Weave through the evening traffic from afternoon to night
without hitting anyone; the faster and cleaner you drive, the higher the score. First-person pseudo-3D road in Canvas 2D,
English and Swedish, desktop and touch.

**Play:** https://maredv.github.io/side-quest/games/the-driver/ (part of the [Side Quest Project](../../README.md))

- Requirements: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)
- Decisions, assumptions and the balance numbers: [docs/DECISIONS.md](docs/DECISIONS.md)

## Controls
- **Keyboard:** ←/→ or A/D steer, ↑ / W gas, ↓ / S / Space brake, **P** / Esc pause.
- **Touch:** ◀ ▶ bottom left, BRAKE and GAS pedals bottom right (multi-touch), a ⏸ button. Shown automatically on touch devices.
- The game pauses when the window loses focus or the page is hidden.

## Feature flags
Append to the URL, e.g. `?road=country&steer=lanes&seed=42`. Full table in [docs/FLAGS.md](docs/FLAGS.md): `length`
(normal/short), `road` (highway/country), `steer` (free/lanes), `pedals` (auto/manual), `crash` (soft/hard), `view`
(cockpit/hood), `difficulty` (easy/normal/hard), `seed`, `touch` (auto/on/off), `sound` (1/0), `debug` (0/1: nothing saved
to the best scores).

## Develop
```sh
npm start        # at the repo root: http://localhost:8000/games/the-driver/ (or here, then http://localhost:8000/)
npm test         # in this folder: node --test tests/*.test.js, no dependencies
node tools/sim.mjs   # balance bots (idle / sloppy / good) over many seeds: stars, crashes, near misses, cars passed per stage
```
The pure logic (`src/game.js`, `track.js`, `car.js`, `traffic.js` and friends) is deterministic for a seed and tested in
Node; the browser layer lives in `main.js`, `render.js`, `cockpit.js`, `input.js`, `ui.js`. Best scores (top 5 per drive
length) are kept in `localStorage` under `the-driver.scores`.
