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

### D-12 — "Avoided" only counts when a quest was possible (2026-11-08)
- **Problem:** with `maxActiveQuests` reached (or set to 0) she has nothing to hand out, yet every appearance spent
  hidden still added `questsAvoided` (+25 score each, D-8). Hiding with two quests open farmed points.
- **Chosen:** `game.js` counts `avoided` only if `canGiveQuest()` is true when she goes back in. This mirrors D-9,
  where being spotted at the cap is "carry on" and not counted. **Alternative:** count it but score it 0 (two
  stats with the same name meaning different things; rejected).

### D-13 — Loop, DPR and audio robustness (2026-11-08)
- Frame dt is clamped at 0 as well as 0.25 s: the first rAF timestamp can precede the `performance.now()` read at load.
- A one-shot `matchMedia('(resolution: Xdppx)')` listener re-runs `resize()` when devicePixelRatio changes without a
  resize event (window dragged to a monitor with a different DPR), and re-arms itself for the new DPR.
- Auto-pause also fires on `visibilitychange` → hidden, and clears held keys (`input.clear()`), not just on window blur.
- `AudioContext.resume()` rejection is caught (it is retried on the next gesture anyway). The context is still
  created lazily inside the first keydown/pointerdown handler, which counts as a user gesture.
- The wife's speech bubble is not drawn on the won/lost screens (it overlapped the title). `index.html` gets an empty
  data: favicon so the console has no 404.
- FLAGS.md now spells out what `questInterval` measures (time inside, not the full cycle). Behaviour unchanged.

### D-14 — Verification pass results (2026-11-08)
- **Method:** `npm test`; headless Chrome (`--screenshot`) on the real page and on a throwaway harness outside the repo
  that renders chosen states; real-time Chrome driven over the DevTools protocol (Node's built-in WebSocket) with
  trusted key events (start, move, pause, sunset, restart); a grid path-planning bot; and a hiding-spot reachability
  analysis. `--virtual-time-budget` starves rAF (3 frames), so it can't be used for gameplay checks.
- **Confirmed:** movement speed (150 px/s), pause freezes time, edges don't repeat, no page scroll, restart resets all
  state (now a test), harmony decay = −1/in-game hour, score = D-8, all flags honoured. C-3: the bot finishes a normal day
  in 109–117 s of 180 (61–65%) and hard in 134 s. No quest expired even with `hard`, 5 quests and a 5 s interval.
  W-9: from every chore a spot hidden from her whole sweep is ≤0.8 s away (now a test).
- **Balance observation (no change made):** 5 of 8 chores lie beyond her 320 px range or are already shadowed, so a bot
  that ignores her is spotted at most once per vision-mode day. Vision mode is easy. Raising `WIFE.range` or
  letting her walk the path would make it harder. This is left to a gameplay iteration rather than a verification fix.
- **Not verified:** non-Chrome browsers (TR-1) and audible sound (P-4). Those rows are marked 🚧.

### D-15 — Wife roams the garden; `visionRange` (2026-11-08) — supersedes the D-14 balance concern
- **Problem (D-14):** on the patio only 3 of 8 chores were reliably in view, so a player ignoring her was barely spotted.
- **Chosen (flag `wifeRoam`, default on; vision mode only):** after the warning she walks out along a random one of 6
  hand-placed routes (`world.wifeRoutes`, 1–2 straight legs each, chosen so every leg is clear of obstacles and the ends
  cover the yard, incl. the left side behind hedge A which no single straight walk from the door reaches), stands and
  sweeps for 4 s, and retraces the route. Speed 90 px/s (player 150). Direction = direction of motion while walking;
  while standing the existing sin sweep (±1 rad, 4.5 s) around the direction she arrived in. If she sees the player
  she stops (`linger`, ≥3 s, bubble) and then walks home; if she sees him on the way home she still calls out while
  walking. `random` mode keeps the patio (nothing to dodge there). **Alternatives:** a single waypoint list with straight
  lines from the door (rejected: ≤50 % of chores coverable per trip, left chores unreachable); real path-finding
  (more code, no benefit for 6 fixed routes).
- **`visionRange`** (default 320, 50–1200) is stored on the wife (`wife.range`) and used by `canSee`, `sightDistance`
  and the renderer. Default left at 320 as asked.
- **Pace tuning:** a trip is ~9 s instead of 5 s, so with `questInterval` 20 she would appear only ~3.5×/day. While
  roaming the inside wait is scaled by `WIFE.roamInsideScale = 0.55` (about 11 s), giving ~5 appearances per 108 s day.
  Alternative: lower the default `questInterval`, rejected because it would also change `random` mode.
- **Measured** (throwaway bot outside the repo: grid A*, nearest-chore-first, never hides, 200 seeds, finishes the
  day in ~108 s, `maxActiveQuests=0` so that early harmony loss cannot end the run): spots per day
  patio (`wifeRoam=0`) **2.29** (histogram 1:9 2:125 3:65 4:1; 3.97 appearances), roaming **3.2** (1:9 2:48 3:66 4:50 5:26;
  5.0 appearances). `visionRange` 240 → 2.65, 400 → 3.24. The D-14 "at most once per day" figure came from a different
  bot route; my bot gets 2.3 on the patio, so the improvement is 2.3 → 3.2, within the 3–5 target but at its low end.
  Per trip a single stop covers about half the yard, so ~3 is what 5 appearances allow without more trips.
- **Hiding stays possible:** for every (chore, route) pair there is a spot hidden from her whole trip (walking out,
  sweep, walking home; all sampled cone directions) that the player reaches within warning + her outbound walk time.
  Smallest slack over all 48 pairs: 3.05 s (test uses a coarser grid). `W-9` (patio) test unchanged.
- **Unsure:** the 3–5 target is met only on average, and with a bot that never reacts; a human who hides reacts to
  the warning and sees which way she turns, so real counts will be lower.

### D-16 — Hosting on GitHub Pages from `main` root (2026-11-08)
- **Chosen:** public repo `MarEdv/side-quest`, Pages source = branch `main`, folder `/`. Every push to `main` redeploys.
- **Alternatives:** a GitHub Actions deploy workflow (unneeded — no build step); a `gh-pages` branch (extra branch to keep in sync); `docs/` folder (would mix docs and site).
- **Assumptions:** repo is public (Pages on private repos needs a paid plan; the code has nothing secret). All asset paths are relative, so the site works under the `/side-quest/` sub-path. A `.nojekyll` file disables Jekyll processing so files are served as-is.

### D-17 — Mobile support (2026-11-08) — supersedes A-2
- **Owner request:** "make it playable on mobile as well".
- **Chosen:** touch controls as an extra input source that feeds the same `{up,down,left,right,action,pause,start,restart}`
  input object as the keyboard, so `game.js` needs no touch-specific logic except analog movement (see below).
- **Two schemes behind flag `touchScheme`** (PROC-1): `joystick` (default — the most familiar for top-down mobile games,
  works without precise aiming on a small screen) and `tap` (tap-to-walk, one-finger play, more casual).
  Alternatives considered: fixed on-screen D-pad (rejected: imprecise for 8-way movement, and it covers the play area), swipe gestures (rejected: no good way to "hold" a chore).
- **Analog movement:** the joystick gives a direction vector with magnitude 0–1. The input object gains optional `moveX/moveY`
  (−1..1); when present they override the digital keys. This keeps keyboard behaviour identical.
- **Overlay:** controls are drawn on a separate full-viewport layer above the canvas, not inside the 960×540 game,
  so they can use letterbox space (especially in portrait) and don't cover the garden more than necessary.
- **Visibility flag `touch`** = `auto|on|off`; `auto` shows controls on touch devices, or after the first touch event, so hybrid laptops work.
- **Portrait is supported, not forced to landscape:** the Screen Orientation lock API is unavailable on iOS Safari, and
  forcing it is hostile. We show a hint instead.

### D-18 — Mobile implementation choices (2026-11-08) — implements D-17
- **DOM overlay, not a second canvas** (`src/touch.js`): CSS handles safe-area insets, the dashed idle ring, the pause button and
  hit-testing (`e.target`) for free. Alternative: a second canvas (rejected: manual hit-testing and DPR handling).
- **Pure maths in `src/touchmath.js`**: layout (`computeLayout`, portrait top-aligned / landscape centred), `screenToGame`,
  `joystickVector` (radius 60 px, dead zone 15 %, rescaled so speed ramps from 0), tap-to-walk, task hit-testing, `mergeInput`.
- **Merging:** `main.js` ORs keyboard and touch booleans; touch analog `moveX/moveY` override keys when non-zero (`game.js` ignores
  them when zero, so keyboard behaviour is bit-identical).
- **Pulses:** touch start/restart/pause stay true until a fixed step has run (`ack()`), because a 120 Hz frame can run zero steps and
  `game.js` edge-detects. Pointers that go down outside `playing` get role `ui` and never steer or work, so the start tap is inert.
- **Tap scheme magnet:** a finger within 40 game px of an open task snaps the walk target to the spot (otherwise stopping 3 px short of a
  finger 40 px away could leave the player just outside the 40 px interaction range). `action` is set once the player is in range.
- **End-screen guard:** new touches within 700 ms of the game ending do not restart, so a mashed WORK button cannot skip the results.
- **Pause:** top-right 44 px button; a tap anywhere on the paused screen also resumes.
- **Hint line:** swapped for touch; hidden in landscape touch (saves 30 px of a ~390 px screen), shown under the canvas in portrait.
- **Manifest `orientation: "any"`** instead of landscape-only, consistent with D-17 (no orientation forcing). Icon is an inline SVG data URI;
  iOS ignores SVG so main.js also draws a 180 px PNG `apple-touch-icon` at runtime (best effort, untested on iOS).
- **`window.__state`** is exposed when `debug=1`, used by the headless-Chrome self-check.
- **Verification:** headless Chrome via CDP (mobile emulation 844x390 / 390x844, DPR 3, `Input.dispatchTouchEvent`); no real devices.

### D-19 — Mobile verification fixes (2026-11-08) — amends D-18
- **Verification:** headless Chrome over CDP, served under `/side-quest/` like GitHub Pages: 844x390 and 390x844 at DPR 3, a 1024x768 tablet,
  desktop 1280x720 without touch (`touch=auto`) and with `touch=on` plus the mouse. Every screenshot was looked at. No console errors.
- **Portrait pause button moved below the game** (`chromeLayout` in `touchmath.js`). Top-right of the viewport is on top of the HUD's
  side-quest panel in portrait, so it hid the countdown seconds. It now sits right-aligned just under the canvas, and the hint line and the rotate
  hint move down by one button height. Landscape keeps the corner (the side letterbox on phones, the top letterbox on tablets).
  Alternatives: draw the button inside the canvas HUD (rejected: hit-testing in game coordinates, and it would still take HUD space) and
  shrinking it (rejected: 44 px is the minimum comfortable touch target). Known limit: a landscape phone at exactly 16:9 has no side letterbox,
  so the corner button overlaps the HUD's top-right corner there.
- **Rotation drops held pointers** (`touch.setLayout`). In emulation a stick held through a rotate kept its old-orientation origin, and the next
  move made the player run off. Real browsers usually send `pointercancel` here, but that isn't guaranteed. When `portrait` flips, all pointers are
  forgotten, so a finger that stays down is inert until lifted (the same rule as the start tap).
- **Rotate hint no longer swallows taps.** In portrait it sits mid-screen, and a tap on its text never reached the overlay, so it neither started,
  restarted, resumed nor steered. That dead zone showed up when a start tap landed on it in emulation. Now `#rotate` is `pointer-events: none`
  except its ✕, whose padding grew to a ~38 px target. Alternative: a tap anywhere on the hint dismisses it (rejected: it would eat the first
  start tap).
