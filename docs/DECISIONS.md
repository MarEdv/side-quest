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
- **iOS hardening, by code review only (no device):** `touch.js` preventDefaults Safari's `gesturestart/change/end` and `touchmove` (non-passive)
  while the controls are shown. CSS `touch-action` is the primary guard, and these back it up against pinch zoom and rubber-banding.
  `touchstart` is deliberately left alone so iOS still treats the tap as a gesture. `audio.unlock()` now also listens to `touchend` (older
  WebKit's activation event) and resumes any non-running context, which covers iOS's `interrupted` state after a call or backgrounding. Reviewed and
  left as is: `pointercancel`/`lostpointercapture` both release the pointer; `setPointerCapture` keeps moves flowing outside the overlay; blur and
  `visibilitychange` clear pointers and pulses; the start tap's pointer stays role `ui`; the manifest's `./` paths and data-URI icon are
  valid under `/side-quest/` (Chrome reports no manifest errors); the logic modules stay DOM-free (now a unit test).

### D-20 — Menus, settings, scores, levels (plan) (2026-11-08)
- **Menus are DOM overlays** (main menu, settings, high scores, level select, pause, end actions) above the canvas,
  not canvas-drawn: free keyboard focus/Tab order, accessibility, native form controls, and easy touch targets.
  The canvas keeps drawing the garden behind them. Alternative (canvas UI) rejected: re-implementing focus & forms.
- **Storage:** one small module `src/storage.js` wrapping `localStorage` in try/catch with an in-memory fallback;
  keys `sidequest.v1.settings`, `sidequest.v1.scores`, `sidequest.v1.progress`, `sidequest.v1.install`.
  Score/progress logic lives in a pure module (`src/scores.js`) taking a storage object, so it is unit-testable.
- **Settings precedence** URL > saved > default keeps every existing shareable link working (S-2).
- **Levels are data** (`src/levels.js`: name, briefing, flag overrides). Gameplay flags come from the level;
  control/display flags (`touch`, `touchScheme`, `sound`, `showVisionCone`, `debug`) come from settings.
- **`hybrid` wife mode** is the "mix" for the hardest level: roaming + vision, and when a trip ends without spotting
  the player she calls a quest anyway with probability 0.4. It gives hiding *partial* value — a new feel, not just bigger numbers.
- **No name entry / no online leaderboard** — local device only, as asked.
- Order of work follows the owner's list; each feature is implemented → verified → deployed before the next.

### D-21 — High scores and the menu system (2026-11-08) — implements D-20 for Feature 1
- **Modules:** `storage.js` (pure; `createStorage(backend)`: JSON under `sidequest.v1.*`, try/catch on every access, in-memory fallback once
  the backend throws or is missing, `persistent` flag), `scores.js` (pure; arcade top 10 + per-level records on a storage object),
  `uimodel.js` (pure helpers: `gateInput`, rank/best texts, date format, arrow-key focus), `ui.js` (DOM screens). `main.js` passes
  `window.localStorage` inside a try/catch, because merely reading the property throws in some privacy modes.
- **Screen system:** `ui.register(name, {phase?, kind: 'page'|'dock', build(api), onEsc?})`, `push`/`back` for sub-screens, `setPhase`
  called by `main.js` when `state.phase` changes. A root screen is tied to a phase: `title` = main menu, `paused`, `won`, `lost`. Later
  features (Settings, Levels, Install) just register more screens and push them. Page screens dim the garden and take all pointer events;
  dock screens (pause, end) are small panels over the lower canvas (below the canvas in portrait) so a tap elsewhere still reaches the touch
  overlay (tap to resume / restart).
- **Game phases unchanged:** `title` now means "main menu shown". `game.js` gained `startGame(s)` / `toMenu(s)` / `resetGame(s, phase)` (all keep
  the key-edge memory) and `state.summary`. `gateInput(phase, input)` is applied in `main.js` before `update()`: nothing reaches the game on the menu,
  only pause while paused, only restart on the end screen, and start/restart are dropped while playing. So Space/Enter on a menu button never walks or
  "works", and Enter on "Quit to menu" cannot also start a game. `input.js` ignores Space/Enter keydowns whose target is a menu button (no
  preventDefault, so the button activates natively). `touch.js` leaves `touchmove` alone inside `.ui-scroll` so the scores table scrolls.
- **End-screen guard:** the DOM end buttons ignore clicks for 700 ms after the game ends, like the touch tap guard (a mashed Space or WORK would
  otherwise "press" the focused Play again). R still restarts immediately, as before.
- **Recording:** `main.js` records a score on the transition playing -> won/lost (once per day), including debug/seeded runs and any flag combination,
  with the summary string. Alternative (skip scores when `debug`/`seed`/`dayLength` are overridden) rejected: the summary does not show them, but
  excluding them would make links like `?difficulty=hard` unrecorded and complicate verification. Revisit when Settings/levels exist.
- **Ranking:** a new score goes after all entries with an equal or higher score (earlier entry ranks higher). `isBest` = rank 1, so tying the best is
  "#2 on your board". A score that misses the top 10 gets no rank, no banner line except "Best: N". Negative scores are valid (failed quests).
- **Summary string** (`settingsSummary` in `config.js`): `wifeMode·roam|patio·difficulty` in vision mode, `random·difficulty` in random mode
  (roaming does not exist there). Day length, vision range and the rest are not included.
- **Clear scores** wipes the arcade board and the level records (`clearAll`), because the owner asked for one "Clear scores" action and level
  records are scores too. When levels land and unlocking depends on them, revisit (maybe keep unlocks, clear bests).
- **Canvas vs DOM:** the canvas end screen keeps its stats; its "Press R" line and the whole title text moved to the DOM (title, buttons, controls line,
  mode line). The hint line and rotate hint are hidden behind the menu.
- **Verification:** headless Chrome over CDP under `/side-quest/`: desktop 1280x720 keyboard (menu navigation, Space on Play does not act, a 10 s day via
  `dayLength=10` (the minimum, `dayLength=5` is rejected by the flag parser), end banner, guard, Play again, Menu, scores table, clear with confirm,
  persistence across reloads) and 390x844 / 844x390 touch emulation (Play, pause button, Resume, end buttons, tap-to-restart, scores). No console errors.
  Not tried: a real device, a real private window, a full 10-row table scrolling on a phone.


### D-22 — High-score verification fixes (2026-11-08) — amends D-21
Independent review of D-21 plus headless-Chrome checks (full 10-row table at 1280x720 / 844x390 / 375x560 / 390x844 touch,
garbage and foreign JSON, `setItem` throwing and the `localStorage` getter throwing via `addScriptToEvaluateOnNewDocument`, a real
keyboard run, end screens in both phone orientations). Fixes:
- **Held Space restarted the day.** Holding Space (WORK) through the end of the day: the key's auto-repeat keydowns land on the
  autofocused "Play again" and, once the 700 ms guard passed, releasing Space clicked it. `ui.js` now preventDefaults repeated
  Space/Enter keydowns while a menu is open, so only a fresh press activates a button. Alternative (no autofocus on the end screen)
  rejected: keyboard players would lose Enter-to-replay. R still restarts as before.
- **Storage after a write failure.** Once a write threw (quota), every read came from memory only, so keys not written this session
  (e.g. level records) vanished until reload. Now reads fall back to the backend for keys this session has not touched; a removal
  the backend refused leaves a tombstone so cleared scores don't reappear; the capability check itself is inside try/catch.
- **Debug runs are not recorded** (reverses that part of D-21). `debug=1` shows the wife's internals and exposes `window.__state`
  for scripted browser checks; recording those runs would fill the owner's board with test days. The end screen says
  "Debug run: not recorded". `dayLength` / `seed` overrides still record (the mode column shows the gameplay mode). The rule lives in
  `uimodel.shouldRecord(prev, phase, flags)`: only playing -> won/lost records, so quitting from pause, restarting, Menu and
  re-renders never do (unit-tested; also checked in the browser).
- **Narrow tables:** a long unbreakable summary overflowed the 390 px table sideways (and `pan-y` forbids sideways panning); the mode
  cell now wraps anywhere on narrow screens.
- **Docs:** the HS-1/2/3/5 rows had lost their requirement text (status pasted over it); restored.
Checked and fine as is: XSS (stored strings only reach the DOM as text nodes; an `<img onerror>` summary renders as text), Esc (main
menu: nothing; scores: back / cancel confirm; pause: resume; end screen: nothing), touchmove still blocked outside `.ui-scroll`,
the touch overlay is hidden on the main menu and dock panels take their own taps, logic modules have no DOM access, the end panel
never overlaps the canvas stats.

### D-23 — Settings screen (2026-11-08) — implements D-20 for Feature 2
- **Pure model, thin UI.** `src/settings.js` (no DOM) holds the control list, the gameplay/control split, `resolveFlags(defaults, saved, urlQuery)`
  (URL > saved > default, returns `flags`, per-flag `source`, `locked` = values forced by the URL), `sanitizeSaved`, `withSetting` and a small
  store over storage.js. `src/settingsui.js` builds the screen. `config.js` gained `parseFlagValue` / `parseFlagEntries`; `parseFlags` and the
  saved-value sanitiser both use them, so there is one validator (clamps, enums, seed). Only primitives are accepted from storage.
- **Gameplay vs control split** is `GAMEPLAY_FLAGS` / `CONTROL_FLAGS` (+ `splitFlags`). `seed` counts as gameplay (it shapes the day; Levels will
  fix their own). `debug` is a control flag. Levels will take `gameplayOf(...)` from the level and `controlOf(...)` from Settings.
- **What is saved:** only the player's choices (`{v:1, flags:{...}}`); choosing the default value removes the key, so a later change of a default
  reaches people who never customised it. Invalid URL values neither apply nor lock (matches `parseFlags`). A locked flag keeps its saved value
  underneath; it is only shown read-only with the URL's value.
- **Three flag layers in main.js:** `resolved` (what Settings shows), `flags` (what the game reads, `state.flags` is the same object). Control flags
  are copied to `flags` at once (sound via `audio.setEnabled`, touch mode/scheme via `touch.setOptions`, cone and debug are read each frame).
  Gameplay flags are copied only when no day is in progress (title, end screens) and at day start / Quit to menu, so a pause-menu change never
  alters the running day; R on the end screen restarts from game.js and therefore also sees them. Alternative (apply gameplay mid-day) rejected:
  it would change deadlines and the wife's pattern under the player.
- **Settings is reachable from pause** (and the main menu), because sound / cone / touch scheme are exactly what players want to fix mid-day, and
  the day stays paused. Not on the end screens (they have Menu). The menu's Mode line shows `settingsSummary(resolved)`; scores record the
  summary of the day actually played (`state.summary`).
- **Debug and scores:** a day is never recorded if debug was on at any moment while playing (`debugTainted`), so toggling it off mid-day does not
  sneak a debug run onto the board (D-22 rule extended).
- **Controls:** selects for enums, checkbox toggles (a real `<label>` wraps text + box, 44 px rows), number inputs with min/max from config.js and
  inline errors (valid values save as you type, a bad entry is reverted on blur), seed is a text field (empty = random). Chosen over +/- steppers
  (extra tab stops, phones have numeric keypads). Selects and number fields keep their own arrow keys; Tab is trapped inside the screen and Tab / Shift+Tab
  reach every control. Panel updates in place, so focus and scroll survive a change.
- **Input isolation:** `input.js` ignores keys typed in input/select fields; `gateInput(phase, inp, modal)` returns nothing while a sub-screen is open
  (otherwise Esc from Settings-over-pause would also resume the game). The `touch.js` early-return stub for `touch=off` was removed; the module
  always exists and `setOptions` flips it live.
- **Reset** forgets saved choices only; link overrides remain (Clear link overrides is the other button). Confirmation is in-page (Esc cancels).
- **Not done / unsure:** the lock note prints the normalised value (`?debug=true` for `?debug=1`); no screen-reader or real-device test; native select
  popups on touch devices are the OS picker (not screenshot-verified); `wifeMode=hybrid` and level settings come with Levels.
- **Verification:** headless Chrome over CDP under `/side-quest/`, desktop 1280x720 keyboard-only (open, wifeMode random, difficulty hard via
  type-ahead, bad / good dayLength, Esc, reload persists, Play shows mode and day length applied via `window.__state`, pause > Settings > Esc returns
  to pause, `?wifeMode=vision` locked) and 390x844 touch (scroll the panel, toggle sound / cone, locked debug stays, Reset with confirmation, change
  from pause applies cone live and difficulty only after Quit to menu). No console errors.

### D-24 — Settings verification fixes (2026-11-08)
Independent review and headless-Chrome check of Feature 2 (S-1..S-4) under `/side-quest/`.
- **Esc from Settings over pause resumed the day** when a button (e.g. Back) had focus: `ui.js` handled Esc in the capture phase
  (back to pause) but `input.js` still recorded it, and once the sub-screen closed `gateInput` let the pause edge through. D-23's
  check only covered Esc from inside a field, which `input.js` already ignored. Fix: `input.js` ignores keydowns that are already
  `defaultPrevented` (the menu took them). Alternatives: `stopPropagation` in ui.js (hides the event from every other listener),
  or swallowing input for a frame after a sub-screen closes (timing-based) - rejected. Unit test in `tests/input.test.js`.
- **A debug mark leaked into the next day.** `debugTainted` was reset only by `startDay()` (Play / Play again buttons); R on the end
  screen restarts straight from game.js, so after a day that had debug on at some point, a clean R-restarted day was silently not
  recorded. Fix: `main.js` resets it whenever a phase change starts a day (`startsDay(prev, phase)` in uimodel.js, unit-tested).
  Verified in the browser: dayLength 10, debug on, debug switched off from pause, day 1 "Debug run: not recorded", R, day 2 recorded.
- **`window.__state` stayed exposed after debug was switched off** in Settings. It is now deleted when debug goes off (the hook is
  for debug runs only; turning debug back on re-exposes it).
- **Checked and fine:** all 13 FLAGS.md flags have a control of the right kind with config.js clamps (new test also pins FLAGS.md
  rows = `DEFAULT_FLAGS` and select options = `ENUMS`); `resolveFlags` precedence and locking; saved values go through
  `parseFlagValue`; seed "random" / number round trip (new test); "Clear link overrides" goes to `/side-quest/#frag` (path and
  hash kept, query dropped); malicious URL and stored values (`?wifeMode=<img src=x onerror=alert(1)>`, `<svg onload>`, `<script>`,
  an HTML-named param) neither apply nor lock, nothing injected, no dialog; the lock note only ever shows validated values, as text;
  logic modules have no DOM access; 1280x720 and 844x390 layouts readable, no console errors. Known: on macOS, arrow keys on a
  closed select open the native popup instead of stepping (platform behaviour).


### D-25 — Install as an app: icons, service worker, invitation (2026-11-08) — implements D-20 for Feature 3 (I-1..I-4)
**Research basis** (docs lookup, not re-verified on devices): Chrome Android installability = manifest with name/short_name, `start_url`,
`display` standalone/fullscreen and **real PNG icons at 192 and 512** (data-URI / SVG icons are unverified, so M-10's inline icon is replaced),
over HTTPS, with some user engagement. A service worker with a fetch handler is no longer required for the menu "Install app" entry but is
still reported as required for the automatic `beforeinstallprompt`, so we ship one. `beforeinstallprompt`: `preventDefault()` + stash,
`prompt()` from a user gesture, `await userChoice`, each event usable once; `appinstalled` fires for any install route. iOS/iPadOS has no
prompt API: Share > Add to Home Screen (other iOS browsers can do it from their share menu since iOS 16.4/17). "Already installed" =
`navigator.standalone` **or** display-mode standalone **or** fullscreen (a WebKit bug reports fullscreen where standalone is expected).
- **Icons:** `tools/make-icons.mjs` (Node, `node:zlib` PNG encoder, 4x4 supersampling) draws the old SVG design: 192 and 512 `any` (rounded
  corners, transparent outside), 512 `maskable` (full-bleed lawn and roof, figure scaled to 60% so it sits inside the 80% safe zone) and a
  180 opaque square for `apple-touch-icon` (iOS rounds it itself). PNGs are committed (no build step). Alternative: keep generating icons at
  runtime with a canvas - rejected, crawlers / the installer cannot see them. Manifest got `id: "./"`; all paths relative (works under `/side-quest/`).
- **Service worker `sw.js`** at the root (scope = the game's folder), registered with the relative URL `sw.js` after `load`. **Network-first,
  cache fallback** for same-origin GETs: the fetch uses `cache: 'no-cache'` so it revalidates instead of being answered by the HTTP cache
  (GitHub Pages sends `max-age=600`), and the good response is copied into the cache. So **a deploy shows up on the next online load; the
  cache is only ever read offline** and cannot go stale while online. Install precaches the shell (index, manifest, icons, every `src/*.js`;
  `cache: 'reload'`); `skipWaiting` + `clients.claim` so a new worker takes over at once; activate deletes any other `sidequest-*` cache; the
  cache name `sidequest-v1` is bumped only to force-purge. Offline lookups use `ignoreSearch` so `?wifeMode=random` links work. Cross-origin
  and non-GET requests are not touched. Alternatives: cache-first with a version bump per deploy (stale until the bump, needs a build step to
  automate) and stale-while-revalidate (one visit behind) - rejected. Local dev is unaffected (network-first); to drop a dev worker use
  DevTools > Application > Unregister. **PRECACHE is hand-listed** (no build step) and `tests/pwa.test.js` fails if it differs from `src/*.js`,
  `icons/*.png`, index and manifest or names a missing file (the first run of that test caught `installui.js` missing).
- **Decision logic** is pure (`installmodel.js`): `installKind` (`native` | `ios-instructions` | `none`; none when standalone or `installed`),
  `inviteKind` (adds: touch device, >= 1 finished day, not `neverAsk`, snooze over), `detectIOS` (UA iPhone/iPad/iPod, or a Mac UA / platform
  `MacIntel` with `maxTouchPoints > 1` = iPadOS in desktop mode; a real Mac has 0), `detectStandalone`. State `sidequest.v1.install` =
  `{v, finishedDays, dismissedUntil, neverAsk, installed}` (sanitised on load). `installed` (set by `appinstalled`, cleared when the browser
  offers the prompt again) is an extra fact beyond the brief: after an install it keeps the UI hidden when the game is opened in a normal browser tab.
- **UI:** the main-menu "Install app" button (shown iff `installKind != none`; also on desktop Chrome, harmless) and an **inline invitation**
  inside the end panel (not a modal sub-screen, so Play again, R and the touch tap-to-restart keep working; focus stays on Play again).
  One invitation per page visit, opened when a day finishes and the rules allow; ignoring it leaves the stored state untouched, so it can
  return next visit until the player picks Not now (7 days) / Don't ask again / Install. A native prompt the player dismisses counts as Not
  now; the single-use event is dropped. iOS "Install" opens the `install-ios` screen (inline SVG share glyph, 3 steps, Back, Esc). It is a
  sub-screen, so the game takes no input while it is open. In short landscape viewports the invitation buttons join the end screen's button row
  (CSS only, `:has`) because a stacked invitation covered the stats at 844x390.
- **Firefox Android / Samsung Internet / others without the event:** the Install item and the invitation are hidden (I-2). A generic "use
  your browser menu > Install / Add to Home screen" fallback was considered and rejected: we cannot tell which browsers have such an entry
  (desktop Firefox and Safari do not), so it would send some players on a hunt. Those browsers still install via their own menu; Samsung
  shows the button whenever it does fire the event.
- **Not done / unsure:** `display-mode: fullscreen` also matches F11 browser fullscreen on desktop, which would hide the install UI there
  (accepted). iOS standalone is detected but nothing marks an iOS home-screen install from a Safari tab, so an iOS player who already added
  the icon is still offered the steps in Safari until they pick Don't ask again. No device testing (see below).
- **Verification** (headless Chrome 157 over CDP, served from a temp dir with a `side-quest` symlink, 844x390 / 390x844 / 667x375 touch
  emulation): SW registers with scope `/side-quest/` and controls the page after a reload; `Network.emulateNetworkConditions` offline +
  reload still renders the menu (also with a query string); a file edited on disk is returned by a SW-served `fetch` immediately (no staleness);
  `Page.getAppManifest` errors `[]`; `Page.getInstallabilityErrors` `[]`; Chrome itself fired a real `beforeinstallprompt`; a fake event shows
  the button and calls `prompt()` once; the invitation appears after the first day, Not now hides it and it stays hidden after a reload and
  another day, Don't ask again persists, `appinstalled` hides the menu item; iPhone UA and iPadOS (Mac UA + 5 touch points) show the
  instructions, Esc / Back return; `navigator.standalone` hides everything (also with a fake prompt event); a Mac UA without touch shows nothing.
  No console errors.

### D-26 — Service worker and install review before the first deploy (2026-11-08) — verifies D-25 (I-1..I-4, M-10)
A verification pass over `a8722a9..47facc8` (the SW has never been deployed: `main` was 2 commits ahead of `origin/main`).
Method: `npm test`, a code review, and headless Chrome 157 over CDP. The build was served from a temp dir with a `side-quest`
symlink, by a static server that sends GitHub Pages' `Cache-Control: max-age=600` (plain `http.server` sends no
Cache-Control, so heuristic freshness hid some effects and showed others that GitHub Pages would not).
- **Defect 1 (fixed, `sw.js` `revalidating`): a deploy did not show on a reload in the same tab for up to 10 minutes.** Blink's
  in-renderer memory cache served the module scripts on reload / same-tab navigation **without asking the worker** (resource
  timing `workerStart` 0, no request at the server); only a new tab went through the SW. With GitHub Pages' max-age=600 the
  freshly revalidated index.html could also run with old modules. Fix: the page gets a copy of every good same-origin response
  with `Cache-Control: no-cache` (the Workbox `copyResponse` pattern; never redirected responses, whose URL relative imports
  need; falls back to the original response if copying throws), so the memory cache must revalidate, which goes through the
  worker and so to the network. Verified: edit a file, then normal reload, same-tab navigation and new tab all show it at once.
  Alternatives: cache-busting module URLs (needs a build step) and accepting it (D-25's "next load" promise would be false) -
  rejected.
- **Defect 2 (fixed, `sw.js` `keyOf`): offline, an old copy could shadow the current one.** Every lookup used `ignoreSearch`,
  and `cache.put` appends, so an older `?x` variant listed first won: in the browser an offline load showed an old
  `src/ui.js?x=` copy. In real use, an old `?wifeMode=random` page load would win over the newest `./`. Fix: page loads are
  stored under their URL without the query (one, always newest, index), and other requests match exactly. An offline page load
  with any query is served the cached index, then `./`, then `index.html`.
- **Defect 3 (fixed, `installmodel.detectStandalone`): F11 fullscreen hid the install UI on desktops.** `display-mode:
  fullscreen` now counts as "installed" only on touch hardware (`maxTouchPoints > 0` or a coarse pointer, read from the device,
  not the `?touch=` flag). Android installs run fullscreen (our `display_override`) on touch devices, and installed desktop apps
  never get fullscreen (they fall back to standalone), so nothing real is lost. A touch laptop in F11 is still a false
  positive (accepted). Headless Chrome cannot emulate `display-mode`, so this is unit-tested only.
- **Defect 4 (fixed, `installmodel.inviteKind`): a wrong clock could silence the invitation for good.** A `dismissedUntil`
  more than 7 days ahead (set while the clock was wrong, or the clock was turned back) now counts as over.
- **Checked and fine:** fallback only on a network error (404/500 are passed through and never cached; opaque and redirected
  responses are not cached); non-GET and cross-origin requests are not intercepted; `fetch(req, {cache: 'no-cache'})` is a
  conditional revalidation (a 304 still costs only headers; navigations' `navigate` mode becomes `same-origin`, which is allowed
  and keeps manual redirects). `addAll` is atomic: a failed precache (e.g. a 404 mid-deploy) rejects install, the new worker is
  discarded and the old one (or none) keeps working; the browser retries on the next load, and the worker never breaks the site.
  `skipWaiting` + `clients.claim` are safe because the game has **no dynamic `import()`** (the module graph loads at start-up)
  and network-first old and new workers behave the same. Cleanup deletes other `sidequest-*` caches only. Registration is
  relative (`sw.js`), scope `/side-quest/` on Pages (other repos on `maredv.github.io` are not touched). `sw.js` itself is
  fetched past the HTTP cache (`updateViaCache: 'imports'` default), so a fixed or killed worker reaches players on their next
  visit. Install logic: decisions match I-1..I-3. iPadOS = Mac UA/`MacIntel` + `maxTouchPoints > 1`. The prompt is used once
  (`deferred` is cleared before `await`, so a double tap cannot prompt twice). Snooze = 7 days. The end-screen buttons sit
  above the touch overlay, so a "Not now" tap did not restart the day. `installmodel.js` has no DOM. All text goes in via
  `h()` (text nodes / `setAttribute`) and there is no `innerHTML`.
- **Kill switch / rollback procedure** (`tools/sw-kill.js`, also in the README): (1) copy `tools/sw-kill.js` over `sw.js`, keeping
  the same path; (2) in the same commit, remove the `registerServiceWorker()` call from `src/main.js`; (3) deploy, and leave it
  deployed for weeks. On each player's next visit the browser fetches the new `sw.js`, which skips waiting, deletes the
  `sidequest-*` caches and unregisters itself, so the site is a plain page again. **Do not** just delete `sw.js`: an update that
  404s keeps the installed worker. The kill worker has no fetch handler and **does not reload open tabs**: a page that still
  registers `sw.js` would then reload forever (unit-tested). Verified in the browser: after the deploy there was no registration,
  no caches and no controller after a reload, no reload loop (even with the register call left in), and the game loaded.
  Putting the normal `sw.js` back re-registered it. A page-side `serviceWorker` flag was considered and rejected, because the
  worker-side switch also reaches pages a broken worker serves from its cache.
- **Local development:** `npm start` serves the repo at `localhost:8000/`, so the worker's scope there is `/` and it also sees
  other projects served on that port later (network-first, so they are not stale; offline it might answer with Side Quest's
  index). Edits show on a normal reload (verified). To drop it: DevTools > Application > Service workers > Unregister (or
  "Bypass for network").
- **Browser verification** (all no console errors in pages or in the worker): **upgrade** - an `a8722a9` worktree (no SW)
  played a day (score 60) and saved settings (hard, sound off); switching the served folder to the fixed HEAD and loading
  installed and activated the worker (scope `/side-quest/`), claimed the page, showed "Install app", and kept scores and
  settings. **Update** - the edits were visible at once (see defect 1). **Offline** - with the server killed and Chrome
  restarted, a cold load of `?seed=42&wifeMode=random` rendered the current build. A deploy adding `src/extra.js` (and its
  PRECACHE line) was picked up online and then ran offline after a cold restart. **Tab cycle** - 3 x open / play / reload /
  close. **Mobile** (844x390, touch, Android UA): the invitation came after the first day, Not now hid it without restarting,
  and a 7-day snooze was stored. **iPadOS** (Mac UA, `MacIntel`, 5 touch points, `beforeinstallprompt` suppressed as in
  Safari): Install app showed the steps and Esc went back. **Test-harness caveats:** headless Chrome fires a real
  `beforeinstallprompt` even with an iPad UA, and same-second mtimes made `http.server` answer 304 with old files; neither is
  a product defect. The first load after a deploy can still mix versions from the HTTP cache for players who never had the
  worker (GitHub Pages max-age=600, as before D-25). The worker cannot help before it is installed.
- **Regression tests:** `tests/sw.test.js` runs `sw.js` and `tools/sw-kill.js` in `node:vm` with fake caches / fetch. It covers
  network-first, no-cache page copies, 404/500/opaque not cached, non-GET / cross-origin untouched, offline query index,
  exact subresource match, atomic precache, activate cleanup, and that the kill switch has no fetch handler and never reloads
  pages. The no-cache and query-shadowing tests fail on the D-25 `sw.js`. `tests/installmodel.test.js` covers F11 vs touch
  fullscreen and the snooze cap.
- **Not done:** no real device (Android install, iOS Add to Home Screen, Samsung Internet, Firefox) and no gzip in the test
  server. Header copying under gzip is the widely deployed Workbox pattern, but it was not observed here.
