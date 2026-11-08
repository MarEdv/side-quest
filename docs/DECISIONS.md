# Decisions & Assumptions Log

> Append-only. Each entry: ID, date, decision, alternatives considered, rationale.
> If a decision is reversed, add a new entry that supersedes the old one (don't delete).

## Assumptions

| ID | Date | Assumption |
|----|------|------------|
| A-1 | 2026-11-08 | Tone is light comedy; no violence, no fail state harsher than "sleeping on the couch". |
| A-2 | 2026-11-08 | Desktop keyboard play is sufficient for v1; mobile/touch is out of scope. |
| A-3 | 2026-11-08 | "Avoiding" a side quest means not being handed it (staying out of sight), not refusing it after being asked. |
| A-4 | 2026-11-08 | One session = one day, ~3 minutes. Short sessions suit "iterate fast". |
| A-5 | 2026-11-08 | Characters are generic (no names shown other than "you" and "your wife"); the protagonist uses he/him per the owner's brief. |
| A-6 | 2026-11-08 | No art assets are available, so everything is drawn procedurally. |

## Decisions

### D-1 — Zero dependencies, vanilla JS + Canvas 2D (2026-11-08)
- **Chosen:** Plain ES modules, Canvas 2D, WebAudio. No npm packages at all (runtime or dev).
- **Alternatives:** Phaser / PixiJS / Kaplay (faster to prototype, but a dependency); TypeScript + Vite (needs a build step).
- **Rationale:** Owner asked to limit dependencies. The game is small enough that an engine adds more than it saves.

### D-2 — No build step; serve statically (2026-11-08)
- ES modules don't load over `file://` in Chrome (CORS), so the game must be served over HTTP.
  `python3 -m http.server` (preinstalled on macOS) or `npx serve` both work. `npm start` runs the Python one.

### D-3 — Tests with Node's built-in runner (2026-11-08)
- `node --test` + `node:assert/strict`. Game logic modules have no DOM access so they run in Node directly.

### D-4 — Architecture (2026-11-08)
- `src/config.js` flags (defaults + URL query overrides) → `src/game.js` pure state & `update(state, input, dt)` →
  `src/render.js` draws state → `src/main.js` wires input, fixed-timestep loop (1/60 s), audio.
- Subsystems: `world.js` (layout, obstacles), `chores.js`, `quests.js`, `wife.js` (AI + vision), `rng.js`, `geometry.js`.
- Game logic emits **events** (`state.events`) that render/audio consume, keeping logic side-effect free.

### D-5 — Wife quest-giving: two modes behind a flag (2026-11-08)
- `wifeMode=vision` (default): stealth-ish — she spots you with a vision cone blocked by obstacles. Gives the player real agency to *avoid* quests (PR-4).
- `wifeMode=random`: classic timer-based interruptions; simpler, more chaotic.
- Rationale: both are reasonable interpretations of "throws side quests"; PROC-1 says implement both behind a flag.

### D-6 — Hold-to-work interaction (2026-11-08)
- Holding the action key progresses a chore; progress persists. Alternative was press-to-complete minigames per chore (more fun, much more work). Can be revisited later.

### D-7 — Fixed logical resolution 960×540, letterboxed and DPR-aware (2026-11-08)
- Simplifies layout and collision; canvas backing store is scaled by `devicePixelRatio` for crisp output.

### D-8 — Score formula (2026-11-08)
- `score = 100·choresDone + 50·questsCompleted + 25·questsAvoided − 40·questsFailed + Harmony + (win ? 500 : 0)`.
  Tunable; lives in `game.js`.

### D-9 — Implementation assumptions (2026-11-08)
- **Input edges:** `input.js` reports level state only; `game.js` edge-detects `pause`/`start`/`restart` via `state.prev`. `Space` is both `start` and `action`; `Enter` also starts. `P`/`Esc` pause (and also resume); on the end screen `R` restarts straight into a new day (same seed if a numeric `seed` was given, else a fresh random one).
- **Quest interaction:** instant on holding the action key within 40 px of a pickup spot (hands empty) or the drop spot of the carried quest; quest spots take priority over chores. Only one quest item carried; other pickups are ignored while hands are full. Delivery targets are the front door (or the curb for bins) — no need for the wife to be outside.
- **Vision mode:** she walks onto the patio after a 1.5 s warning (door rattles + blinking "!"), stays 5 s sweeping the cone (±57° around straight down, 4.5 s period, 70° wide, 320 px range). On spotting the player she calls out a quest (bubble) and stays at least 3 s more; if she leaves without having spotted him it counts as `avoided`. If the quest cap is reached when spotted she just says "carry on" (no quest, not counted as avoided). Sight is blocked by the shed, the three hedges and the tree trunk (not the car or bench).
- **Random mode:** same warning/appearance cycle, but she calls out a quest as soon as she steps out (cap permitting); no "avoided" stat is counted in this mode.
- **Quest picking:** random template not already active; deadlines 40–50 s × difficulty (easy ×1.3, hard ×0.75). Harmony decay is `1 / (dayLength/9)` per second while any quest is active; Harmony clamped 0–100.
- **Tuning:** chore times 11/13/15/10 s (rake/trim/mow/water, ×0.75 easy, ×1.25 hard) → 98 s of work per normal day; with walking a scripted bot finishes in about 105–130 s of the 180 s day (~60–70%).
- **Canvas scaling:** the canvas CSS size is `960·s × 540·s` and the backing store `960·s·dpr × 540·s·dpr`; each frame `setTransform(k,0,0,k,0,0)` with `k = backing/960` (= `s·dpr`). Sharper than a fixed `960·dpr` store when upscaled.
- **Auto-pause** when the window loses focus; large frame gaps are clamped to 250 ms.
- **Tests:** `npm test` runs `node --test` (auto-discovers `tests/*.test.js`; `tests/helpers.js` is shared fixture code).

### D-10 — Verification pass: rendering fixes (2026-11-08)
- **Vision cone is drawn clipped by sight blockers.** It used to be a full wedge through hedges/shed/trunk, so a
  player who was correctly hidden (logic uses line of sight) still appeared inside the cone. Now `render.js` casts
  48 rays with `sightDistance()` (`wife.js`, built on the new `segmentAABBEntry()` in `geometry.js`) — the same
  rule as `canSee`. Alternative: keep the wedge and draw "shadows" on top (more draw calls, same result).
- **Harmony number** in the HUD is white when the bar fill doesn't reach the centre (it was dark-on-dark below ~50).
- **Warning "!" badge** moved from y=40 to y=50 (r 14) so the 34 px HUD bar no longer covers its top half.

### D-11 — Ignore modified key presses (2026-11-08)
- **Problem:** `input.js` called `preventDefault()` on every game key, including Cmd/Ctrl+R (reload) and Cmd+W/A/S/D,
  and recorded them as held. macOS sends no `keyup` for keys released while Cmd is held, so Cmd+A left "left" stuck on.
- **Chosen:** keydown with `metaKey`/`ctrlKey`/`altKey` is ignored entirely (not recorded, default kept), and a Meta
  keyup clears all held keys. **Alternative:** track modifiers and filter only known shortcuts (more code, same
  outcome for a game that uses no modified keys).
- Covered by `tests/input.test.js`, which drives `createInput` with Node's built-in `EventTarget`.
