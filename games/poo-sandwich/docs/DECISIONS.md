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
