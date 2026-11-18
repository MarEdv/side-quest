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

## D16 — 2026-11-10 — Verification review: logic fixes
- **Zero-dt frames:** the first frame after start/resume has `dt = 0`, which made player velocity `0/0 = NaN` (harmless only by luck, since the boss aims with it). Velocity is now 0 for zero-dt frames.
- **Projectile tunneling:** at the 0.05 s dt cap a late-day sandwich moves 16.5 px per update, more than the 12 px meeting-room walls. Projectiles now sub-step in <= 6 px steps.
- **Unreachable pickups:** in `choice` mode a sandwich could land on the meeting table (it flies over tables), leaving a pickup the player cannot reach and guaranteed "ignored" stress. Landings on the table now splat without a pickup.
- **Duplicate poo tasks:** two identical poo tasks could be active at once; poo templates are now drawn from those not already active (like regular tasks).
- **Not changed:** `CONFIG.stress.passiveRegen` is unused; wiring it in would change the tuned balance (D13), so it is left as dead config.

## D17 — 2026-11-10 — Verification review: layout and mobile fixes
- **Method:** headless Chrome 157 driven over the DevTools protocol from a scratch Node script (outside the repo): `Emulation.setDeviceMetricsOverride` (DPR 3, mobile), touch emulation, `Emulation.setSafeAreaInsetsOverride` for iPhone-style insets, CDP mouse/touch/key events, and `?debug=1`'s `window.__game` to stage mid-game states (wind-up, sandwich in flight, progress ring, poo tasks, game over). No extra debug flag was needed.
- **Safe areas:** with `viewport-fit=cover` the canvas HUD was drawn under the notch/status bar while the HTML pause button respected `env(safe-area-inset-*)`, so in portrait the button sat over the map and in landscape it covered the score. The renderer now reads the insets (from the body's `env()` padding) and lays out top bar, world and to-do panel inside the safe area; only backgrounds bleed to the edges.
- **Title card on landscape phones:** the card had `max-height: 100%`, so on 390 px tall screens its content spilled out below the card. The cap is removed (the overlay scrolls) and a `max-height: 420px` rule compacts the card so the Start button fits on 844x390 / 568x320.
- **Small HUD:** at 320 px wide the stress bar is ~74 px and "STRESS 62%" overflowed it; narrow bars show only the percentage.
- **Overlay mode:** the "EXEC SUITE" label showed through the semi-transparent to-do panel; it is not drawn when the panel covers it.
- **Restart:** floating texts / screen shake from the previous day were carried into a new game; `renderer.reset()` clears them on start. Verified that restart keeps a single RAF loop (game time advances 1.0 s per real second after several restarts) and that P/Esc/Space/blur pause and resume correctly.
- **Canvas CSS:** `100vh` replaced by `100%` (iOS Safari's 100vh is taller than the visible area); the size is set from `innerWidth/innerHeight` anyway.
- **Known, not changed:** in portrait the 16:9 world is scaled to ~0.4 (characters ~10 px on a 390 px phone) with spare space below the to-do list; a rotated or zoomed camera would be a design change. In `auto` controls a touch on the right half of the screen does nothing (by design, D12).

## D18 — 2026-11-10 — Moved into the Side Quest Project monorepo
- History imported into `MarEdv/side-quest` under `games/poo-sandwich/` (git filter-repo + merge); now served at
  https://maredv.github.io/side-quest/games/poo-sandwich/ behind the project launcher. Game code unchanged (all URLs relative).
- The Pages workflow moved to the repo root and now runs every game's tests before deploying. See root `docs/DECISIONS.md` D-1.

## D19 — 2026-11-15 — English and Swedish (F13)
- **Chosen:** `src/i18n.js` (pure) holds both languages and the language rules; `main.js` applies them to the HTML via
  `data-i18n` / `data-i18n-html` / `data-i18n-aria` attributes, and `render.js` draws canvas text through `t()` after
  `renderer.setLang()`. Task and station names keep their English `label` in `world.js` because the game logic uses it to
  avoid duplicate tasks; `NAMES` translates them at draw time, and a test fails when a label has no Swedish name.
- **Language order:** `?lang=` (from the launcher card, root D-7), saved choice, `navigator.languages`, English. A `?lang=`
  is saved, so reopening the game directly keeps the language. The switch sits on the title card only (not in pause/game
  over) to keep the small screens uncluttered; the corner position moves above the heading below 560 px wide.
- **Wording:** "poo sandwich" → "bajsmacka", "poo task" → "bajsuppdrag"; the game name stays "Poo Sandwich". Swedish
  uses "100 %" in prose; the HUD keeps the compact "62%".
- **Not a flag:** language is a player setting, not a design alternative, so it is not in `src/flags.js` (§2.3).
- **Alternatives:** translating the labels inside `world.js` (would make game logic depend on the language); a shared
  i18n module with the launcher (games must stay self-contained).

## D20 — 2026-11-15 — Repo conventions: `browserModules` and one docs shape
- **Chosen:** part of the repo-wide alignment (root D-10, `docs/STREAMLINING.md` S-2 and S-14 at the repo root).
  `package.json` lists the modules that may touch the browser (`"browserModules"`: `flags.js`, `input.js`, `main.js`,
  `render.js`); the root `tests/conventions.test.js` fails when any other module in `src/` uses a browser global, when a
  listed one uses none, when a URL is site-absolute or when an import leaves this folder.
- **`flags.js` is on the list** because `getFlags()` reads `location` itself (behind a `typeof` guard). `parseFlags()` is
  pure and is what the tests use. Moving the `location.search` read to `main.js`, as Gem Miner does, would take it off the
  list; left for the flags alignment (root S-10).
- **Docs:** the three game `CLAUDE.md` files now follow one skeleton (Non-negotiable 1..8 / Layout / Commands / Deploy), the
  requirements use the root status legend and the README gives the same run and test instructions as the other games.
  The legend gained "retired" (❌) and "planned" is now 📋 instead of ⏳; no row used ⏳. ✅ now reads "implemented and
  verified" as in the other games: existing ✅ rows were not re-verified for this change.

## D21 — 2026-11-15 — Language code moved to the repo kit
- **Chosen:** part of the repo-wide alignment (root S-4, `kit/README.md`). `src/i18n.js` keeps `STRINGS` and `NAMES` and
  builds the rest with `createI18n()` from `src/kit/lang.js` (one current language: `t(key, vars)`, `name(english)`,
  `getLang`/`setLang`, `pickLang`, `normalizeLang`). `src/main.js` uses `src/kit/langdom.js` (`?lang=` memory, the saved
  choice, the `data-i18n*` attributes, the EN / SV switch) and `src/kit/storage.js` for the language key; `render.js` no
  longer holds a language (`renderer.setLang` is gone). `describeFlags()` runs from `onChange` and once at start.
- **Unchanged:** every key and text in `STRINGS`/`NAMES`, the order of precedence (`?lang=`, saved, browser, English) and the
  saved key `poo-sandwich-lang`; a bare `sv` saved by the earlier code is still read. The best score keeps its own
  storage code (`BEST_KEY`) for now.
- **Alternatives:** keeping the game's own copy of the language code (duplicated in all four parts, already drifting).

## D22 — 2026-11-18 — Best score through the shared kit's storage; debug runs are not recorded
- **Chosen:** part of the repo-wide alignment (root D-14, `docs/STREAMLINING.md` S-7 at the repo root). The best score
  goes through the same `createStorage(backend, 'poo-sandwich-')` as the language (D21), under key `best`, so the stored
  key is still `poo-sandwich-best`. The old code stored a bare number string (`"1200"`), which is valid JSON, so old scores
  read as numbers; the kit writes them the same way. `BEST_KEY` and the direct `localStorage` calls are gone.
- **New rule (behaviour change):** a run with `debug` on is never recorded and never a "New best!", as in the other two
  games. The game-over line then reads "Debug run: not saved as best score. · Best: <stored best>" (Swedish:
  "Felsökningsläge: sparas inte som bästa poäng."). Before, `?debug=1` could put any score on the board.
- **Pure decision:** `src/best.js` (`sanitizeBest`, `judgeRun`) decides whether a run is a new best and whether to save
  it, so the rule is tested in Node (`tests/best.test.js`); `main.js` only stores and shows the result. A stored value
  that is not a finite number above 0 counts as no best.
- **Alternatives:** keep the best score out of storage when `debug` is on but still show "New best!" (says something
  that is not true); a debug-only best score (nobody asked for one).
