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
