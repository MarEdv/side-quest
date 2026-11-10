# Decisions & Assumptions Log

> Append-only log. Every non-obvious choice goes here with the alternatives considered.
> Format: `D<n> — <date> — <title>`, then Context / Decision / Alternatives / Consequences.

## D1 — 2026-11-10 — Tech stack: vanilla JS + Canvas 2D, no build
- **Context:** "Limit number of dependencies", must run in any modern browser, deploy to GitHub Pages.
- **Decision:** Plain ES modules loaded directly by `index.html`, HTML5 Canvas 2D rendering, no bundler, no npm runtime deps.
- **Alternatives:** Phaser/PixiJS (heavy dependency for a simple game), TypeScript + Vite (needs a build step and devDependencies).
- **Consequences:** Static files deploy as-is. Unit tests use Node's built-in `node:test`, so pure game logic must not touch the DOM.

## D2 — 2026-11-10 — Procedural graphics with emoji
- **Decision:** Draw the office with rectangles; characters/props use simple shapes and emoji (☕ 🖨️ 📋 🥪 💩).
- **Assumption:** Emoji rendering differences across OSes are acceptable for a jokey game.

## D3 — 2026-11-10 — Interpretation of "poo sandwich"
- **Assumption:** A "poo sandwich" is an unpleasant surprise assignment from the boss. In game terms it is a thrown projectile; if it reaches you it becomes an urgent task with a deadline.
- **"Completing or avoiding":** implemented two ways behind the `poo` flag (`hit` default, `choice`). See REQUIREMENTS §2.3.

## D4 — 2026-11-10 — Mobile controls
- **Decision:** Implement both tap-to-move and a virtual joystick behind the `controls` flag; `auto` picks joystick on touch devices.
- **Reason:** Both are reasonable; user asked for flags when unsure.

## D5 — 2026-11-10 — Fixed logical resolution
- **Decision:** Game world is a fixed logical size (960×540, 16:9) scaled to fit the screen with letterboxing; on portrait phones the HUD/task list moves below the canvas via CSS where space allows.
- **Reason:** Simplest way to keep gameplay identical across devices.

## D6 — 2026-11-10 — Day length
- **Decision:** 09:00–17:00 in 180 s by default (`daySeconds` flag). Short enough for a casual mobile session.

## D7 — 2026-11-10 — Deployment
- **Decision:** GitHub Actions workflow using the official Pages actions, publishing the repo root (excluding tests/docs is unnecessary — they are harmless static files).
- **Repo:** `MarEdv/poo-sandwich` (public, required for free GitHub Pages).

## D8 — 2026-11-10 — Process / model usage
- Opus: planning, hard technical problems, verification/review. Sonnet: implementation. Haiku: fetching docs.

## D9 — 2026-11-10 — Module layout and purity
- **Decision:** `game.js` holds all logic (pure, seeded `mulberry32` RNG, events array per update); `render.js`, `input.js`, `main.js` are the only DOM/canvas users. `world.js`/`config.js` are pure data.
- **Reason:** Everything gameplay-relevant is testable with `node --test`.

## D10 — 2026-11-10 — Test script uses a glob
- **Decision:** `npm test` runs `node --test tests/*.test.js`.
- **Reason:** On Node 22, `node --test tests/` treats the directory as a module and fails.

## D11 — 2026-11-10 — Layout: HUD in screen space, three layouts
- **Decision:** The canvas fills the viewport; the 960x540 world is scaled to fit (supersedes the CSS-based HUD move in D5). Top bar (clock, stress, score) is always screen-space. The to-do list is `below` the world in portrait, in a `side` column on small landscape screens (scale < 0.9), or an `overlay` panel over the blocked "executive suite" corner of the map on larger screens.
- **Reason:** Keeps fonts readable on phones without changing gameplay geometry.

## D12 — 2026-11-10 — `auto` controls resolved per pointer
- **Decision:** In `auto`, touch pointers drive the joystick (left half of screen) and mouse/pen pointers click-to-move; the keyboard always works. `joystick`/`tap` force the behaviour for all pointers. Tap-to-move uses a tiny BFS path finder on a 16 px grid so the worker routes around desks.
- **Alternative:** detect touch capability once at startup; rejected (hybrid laptops).

## D13 — 2026-11-10 — Task and stress rules (assumptions)
- Regular tasks do not expire; with more than 2 active they add slow stress; if a spawn is due while 4 are active it adds +3 stress ("Too many tasks"). Poo tasks (max 3 active) expire after 34 s (36 s in `choice`) adding +16 stress; a hit adds +6. Task progress is kept when leaving a zone. If several tasks are at one station, the most urgent poo task is worked first. Solving a poo task relieves twice the stress of a regular one. Win bonus = (100 - stress) x 10.
- **Balance:** a naive bot survives ~25% of seeded days, an idle player always burns out around 70 s; tuned in `src/config.js`.

## D14 — 2026-11-10 — Boss and sandwiches
- Boss wanders between fixed waypoints (with collision; picks a new waypoint if stuck), winds up 0.6 s (with "!" and a dashed aim line), then throws at the player's position with 0.25 s velocity lead and +-4 degrees spread. Sandwiches fly 150 px/s at 09:00 up to 330 px/s at 17:00; throw interval 5 s down to 2.3 s. They splat at the aim point or on walls/desks. In `choice` mode splats from the aim point stay 9 s as pickups; wall splats do not.

## D15 — 2026-11-10 — Pause behaviour
- Pausing also happens on tab hide and window blur. Enter/Space start, restart or resume from screens.
