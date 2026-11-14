# Decisions & Assumptions Log

> Append-only. Format: `D<n> — <date> — <title>`, then Context / Decision / Alternatives / Consequences.
> Supersede an entry with a new one; never rewrite history.

## D1 — 2026-11-14 — Tech: vanilla JS + Canvas 2D, zero dependencies
- **Context:** "Limit number of dependencies", any modern browser, lives in the zero-dependency Side Quest Project monorepo.
- **Decision:** ES modules loaded directly by `index.html`, Canvas 2D, WebAudio, `node --test` for tests. No packages.
- **Alternatives:** Phaser/PixiJS (a dependency, though a tilemap engine would help), TypeScript + bundler (build step).

## D2 — 2026-11-14 — Top-down view, not side-view
- **Context:** "Mines", "scrollable in four ways", "rather big". A side-view digger (gravity, ladders, falling) is the
  classic mining look but scrolls mostly up and down and needs physics.
- **Decision:** Top-down tile grid. The world spreads equally in four directions around a central town, so all four scroll
  directions matter.
- **Alternatives:** Side-view with gravity (more work, mostly vertical). Both views behind a flag was rejected as doubling
  the game for little gain. Recorded as out of scope.

## D3 — 2026-11-14 — Tile-based movement, bump to mine
- **Decision:** The miner moves tile by tile (with a short slide animation); pushing into rock mines it. This keeps controls
  identical on keyboard and touch (a direction is all you need) and makes mining speed easy to reason about.
- **Alternatives:** Free movement with a mining button aimed at the facing tile (more fiddly on touch).

## D4 — 2026-11-14 — Rings of difficulty around the town
- **Decision:** Distance from the centre decides the rock type (dirt → stone → granite → obsidian, with noise so the edges
  are ragged) and the gem table. The dream diamond sits in the outer ring behind a crystal wall only the Gem hatchet cuts,
  so the hatchet ladder (wood → stone → steel → gem) is the progression.
- **Assumption:** "Hatchet" is the owner's word for the digging tool; we keep it rather than "pickaxe". "Gem" hatchet means a
  hatchet with a gem blade.

## D5 — 2026-11-14 — Find or buy
- **Decision:** Chests guarantee one stone and one steel hatchet somewhere in the mine; all tiers except wood can also be
  bought in the shop. The Gem hatchet is shop-only (an endgame purchase), so selling gems matters.

## D6 — 2026-11-14 — No fail state; best times as the score
- **Assumption:** The owner asked for a simple, exploratory game. There is no death or timer pressure; the score is how fast
  you found the dream diamond. Best times are kept on the device, like the sibling games' local best scores. No handle entry
  (not asked for this game).

## D7 — 2026-11-14 — Autosave
- **Decision:** A big world makes a game longer than one sitting, so progress autosaves to localStorage (prefix
  `gem-miner.`, shared origin with the other games) every few seconds and on page hide. The save stores the seed plus the
  changes (mined tiles, opened chests, fog) rather than the whole world.

## D8 — 2026-11-14 — Mobile support and the launcher
- **Assumption:** The sibling games support touch and the launcher is an installable app, so Gem Miner supports touch too
  (D-pad default, joystick by flag). No game-specific service worker or install prompt: the launcher app already covers
  install, and it keeps this game simple. Listed in the launcher via `game.json` + `npm run registry`.
