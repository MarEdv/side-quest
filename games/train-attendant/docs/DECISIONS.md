# Decisions & Assumptions Log

> Append-only. Format: `D<n> — <date> — <title>`, then Context / Decision / Alternatives / Consequences.
> Supersede an entry with a new one; never rewrite history.

## D1 — 2026-11-19 — Tech: vanilla JS + Canvas 2D, zero dependencies, the shared kit
- **Context:** "Limit number of dependencies", any modern browser, Chrome for testing; the monorepo's rules (root
  `CLAUDE.md`: zero dependencies, no build step, self-contained games, shared code from `kit/`).
- **Decision:** ES modules loaded by `index.html`, Canvas 2D, WebAudio, `node --test`. From the kit: `audio.js`,
  `flags.js`, `lang.js`, `langdom.js`, `rng.js`, `storage.js` (the same six as Gem Miner). Page shell, Back to games
  link, `window.__game` and EN/SV as in the other three games (root T-4, T-5, L-9).
- **Alternatives:** a game engine (a dependency), TypeScript (a build step).

## D2 — 2026-11-19 — Top-down view along one aisle
- **Context:** "Manages a train full of passengers." A train is long and thin; what matters is getting to the right
  passenger in time.
- **Decision:** The train is drawn from above, the attendant only walks left and right along the aisle, the camera
  follows horizontally, and a strip at the top shows the whole train with a dot per open need. One axis keeps the
  controls the same on keyboard and touch (two buttons plus action) and turns the game into a routing problem: which
  need do I walk to next?
- **Alternatives:** free 2D movement inside cars (more input, nothing gained: seats are reached from the aisle); a side
  view (passengers on the far side would hide behind the near ones).

## D3 — 2026-11-19 — One trip is one game; no levels, no save
- **Assumption:** The owner asked for "this trip". A game is one trip from the first to the last station, 4–9 minutes
  depending on `trip`. Because a trip is short there is no mid-trip save (out of scope). Replay value comes from the
  seed (route names, passengers, quest order) and the flags.
- **Alternatives:** a campaign of routes with unlocks (like Garden Day's levels): bigger scope, possible later.

## D4 — 2026-11-19 — Score, stars, no fail state
- **Decision:** Like Gem Miner and Poo Sandwich, the game measures how well you did instead of ending early: every trip
  reaches the last station. Complaints and failed quests cost points. Stars come from the score relative to the trip's
  possible maximum (tuned with `tools/sim.mjs`, V-6). Best 5 scores per trip length on the device.
- **Alternatives:** "fired" after N complaints (a fail state; harsher than the sibling games).

## D5 — 2026-11-19 — Side quests: five types, offered over the radio
- **Context:** The owner listed rescuing passengers of a broken-down train, stressed passengers, connections, "etc.".
- **Decision:** Five quest types (Q-2..Q-6): rescue, connection, nervous passenger, lost bag, sick passenger. Each one
  asks for a different skill: seating a group (lead mechanic, A-4), a two-step errand to the cab and back, repeated
  visits, searching, and a timed fetch. Quests come as offers from the train manager. Two reasonable ways to hand them
  out, so both behind the `quests` flag: `offer` (default; the player chooses, which is what makes them *side* quests,
  as in Garden Day) and `assign` (always on: more pressure, simpler).
- **Assumption:** at most 2 active quests (the HUD stays readable on a phone).

## D6 — 2026-11-19 — Stress model behind a flag
- **Decision:** `stress=solo` (default: each passenger's stress depends on their own needs, standing and delay) or
  `stress=contagious` (a passenger above 70 adds stress to neighbours within 2 rows in the same car). Contagion makes
  neglect snowball and is harder to read, so it is the option, not the default.

## D7 — 2026-11-19 — Deterministic simulation, fixed timestep, focus loss pauses
- **Decision:** All game logic is pure (no DOM) and advanced by `step(state, input, 1/60)` from a fixed-timestep
  accumulator; randomness comes from one seeded `createRng` (kit). The same seed and inputs give the same trip, which
  `tools/sim.mjs` and the tests rely on. Hiding the page or losing focus pauses, the rule root `docs/STREAMLINING.md`
  S-16 proposes for every game.
- **Alternatives:** variable `dt` (what Gem Miner and Poo Sandwich do today; S-16 plans to move away from it).

## D8 — 2026-11-19 — Module plan
Pure (DOM-free, tested in Node):
- `config.js` – every tuning number in one frozen object (speeds, rates, rewards, layouts per difficulty / trip).
- `flags.js` – the URL flag schema on the kit's parser (`docs/FLAGS.md`).
- `i18n.js` – EN/SV texts, `backHref(lang)`.
- `train.js` – layout: cars, rows, seat positions, vestibules, café counter, cab; `x` ↔ car/row lookups.
- `route.js` – station names (seeded pick from a fixed list), leg times, schedule and delay.
- `passengers.js` – spawn, needs, stress update, boarding / alighting.
- `quests.js` – offers, the five quest types, their progress, deadlines and rewards.
- `game.js` – `createGame(flags, seed)`, `step(state, input, dt)`, the action logic, score events.
- `scores.js` – best 5 per trip length on top of a storage object.
Browser: `main.js` (loop, screens, wiring), `render.js` (canvas), `input.js` (keyboard and touch), `ui.js` (DOM
HUD, overlays, screens), `audio.js` (sound table on the kit engine), plus `kit/audio.js` and `kit/langdom.js`.

## D9 — 2026-11-19 — Out of scope and gaps known up front
- No service worker / offline / install as an app: Gem Miner and Poo Sandwich don't have one either and root S-17 says
  this is an owner decision. The launcher installs as an app and opens the game inside it (root L-7), online only.
- No real-device testing (headless Chrome with device emulation only), no Safari testing; same as the siblings.

| ID | Date | Assumption |
|----|------|------------|
| A-1 | 2026-11-19 | Fictional station names, one list for both languages (names stay untranslated, as the launcher's A-3). |
| A-2 | 2026-11-19 | Passengers are drawn as simple faces coloured by stress, not people of any specific look; the attendant's cap is generic, no real railway's livery or logo. |
| A-3 | 2026-11-19 | The player gets no tickets to sell; checking is a hold of the action button. Rescued passengers ride free. |


## D10 — 2026-11-19 — Units, layout and the numbers in `src/config.js`
- **Decision:** x runs along the train in metres, 0 at the rear and growing towards the cab (the right of the screen).
  A passenger car is 14 m (2 m vestibule, 5 rows 2 m apart, 2 m vestibule), the café car the same without seats, the cab
  4 m: a 3-car train is 60 m with 60 seats. Car order is P P Café P for 3 cars (café after the first half). The attendant
  walks 7 m/s (the whole train in 8.5 s; 5 m/s made one attendant hopelessly slow for 90+ passengers in the sim), reach
  1.1 m (a row's four seats share one x, so one stop serves all four). Standing places: 4 per vestibule end, 0.4 m apart.
  All of it, plus every rate and reward, is in `config.js` and nowhere else.
- **Alternatives:** 5 m/s with fewer passengers (a train that looks empty).

## D11 — 2026-11-19 — Deviations and additions to the requirement text
- **Trip length (T-2):** the stated leg and dwell times give about 2.8 / 6 / 9 minutes for `short` / `normal` / `long`, not
  "4–9 minutes" as D3 guessed. The numbers in T-2 win.
- **Rescue delay (Q-2, T-4):** the stop really lasts 10 s (the leg timer pauses) and the delay grows by 20 s at once (10 s
  for the stop and 10 s for slowing down and restarting). Other delay: a leg may slip (signal fault) by 5..`slipMax` s,
  chance and size by difficulty; the leg then takes that long and the delay grows by it. Without slips the 45 s
  connection limit (Q-3) could never be reached. Each departure wins back 5 s.
- **Needs:** besides ticket, coffee, snack and question there is `seat`: a standing passenger (train full, or a rescued
  passenger) needs a seat as soon as one is free; it is what the lead mechanic (A-4) answers. Water is an item only (the
  café picker, the nervous quest). Needs are drawn by weight (coffee .25, snack .2, question .55: coffee and snack cost a
  walk to the counter and back, so they are rarer).
- **Nervous passengers (Q-4)** get no other needs; "3x as fast" means their stress rises 0.9/s (3 x the idle rise 0.3/s),
  each talk takes 15 off, water counts as a talk but also respects the 6 s gap, a talk hold only starts after the gap.
- **Quest offers (Q-1)** count down only while the train moves ("of travel"), at most one is pending, and nothing is drawn
  while 2 quests are active (the timer waits). An expired offer counts as declined. If no quest type can be made (no
  suitable passenger, no free seats) the next try is 5 s later.
- **Quest details:** a connection's station is the passenger's destination, 1..3 stops ahead; a rescue needs `count + 2`
  free seats when offered and the stop is on the current leg if accepted before 40% of it, else the next one (cancelled
  if there is none); if seats were taken meanwhile the count shrinks, with none the quest is cancelled without penalty.
  Taking another item puts a bag or first-aid kit being delivered back (the quest returns to its fetch stage). Quest
  deadlines are checked when the train arrives, before anybody gets off. At the last station open quests fail.
- **Holds** (ticket, question, radio, talk) are cancelled by walking or releasing the action; after one completes, a
  held action goes on with the next job in reach. Instant actions (hand over, lead, seat, counter, pick up) need the
  press edge. Priority: quest > café counter > seating a follower > handing over > leading > holds; ties by stress.
  At the café counter `pick` works with or without the picker open; the picker closes when you walk away.
- **Stars (S-2)** are `score / potential`: potential is everything that was on offer (ticket and calm points per
  boarder, every need drawn, the seat points of standing passengers, every offered quest's reward, declined or not, so
  declining has an opportunity cost). Ratios 0.30 / 0.55 / 0.75 / 0.90 give 2..5 stars, below 0.30 is 1 star.

## D12 — 2026-11-19 — State, input and events (the contract with the browser layer)
- **Decision:** `createGame(flags, seed)` returns plain JSON-able state (the seeded kit RNG is a non-enumerable property
  `state.rng`); `step(state, input, 1/60)` mutates and returns it. Input: `{ left, right, action, actionPressed, pick,
  accept, decline }`; pause is the caller's job. `state.events` holds only the last step's events, so a caller running
  several steps per frame must collect them after each step. Event types and fields are listed in the header of
  `src/game.js`. Extra pure module `src/core.js` (events, score, carried item, quest stages) because passengers and
  quests both need them; `tests/helpers.js` and `tools/bots.mjs` are test / tool support.
- **Seed:** `createGame(flags, seed)` uses `seed ?? flags.seed ?? 1`; the caller picks a random seed (`randomSeed()`).

## D13 — 2026-11-19 — Contagious stress and the cars flag
- `stress=contagious`: every passenger above 70 adds 0.5 stress/s to each neighbour within 4 m in the same car, per source
  (1.2 made idle play spiral into thousands of complaints). With it the good bot gets about 3.5 stars on normal: the option
  is harder, as D6 intended. `cars=2` is easier (good bot 5 stars), `cars=4` harder (good bot about 3 stars): one
  attendant, more passengers.

## D14 — 2026-11-19 — Balance bots and the tuning (V-6)
- **Bots** (`tools/bots.mjs`, run with `node tools/sim.mjs`): `idle` never acts; `sloppy` pauses 0.3-1.6 s between jobs,
  picks a random job one time in five, walks in fits, takes a wrong café item one time in ten, declines half the offers
  and skips quest jobs half the time; `good` always walks to the job with the least slack (time until the complaint or
  deadline plus the walk, with an 8 s hysteresis), fetches the right item, leads passengers to seats in batches,
  accepts every offer and pursues quests. They use only the state and the input object.
- **Tuning that came out of it:** needs per calm passenger every 150-250 s on normal (easy 220-380, hard 150-250 with
  stress rate x1.25) and 1.5x longer on `long`; passengers boarding per station 22% of the seats on normal (16% easy, 26%
  hard; the first station 40/45/50%); stress rates ticket .9, coffee 1.7, snack 1.6, question 2.0, seat 1.4 per second.
  Before that the good bot was busy 96% of the time and got 100+ complaints: tickets alone were 3 minutes of work per trip.
- **Result** (`node tools/sim.mjs --seeds 20`, seeds 1..20, 3 cars, `quests=offer`, `stress=solo`; ratio = score / potential;
  dist = number of trips with 1/2/3/4/5 stars; clean = trips without a complaint):

```
seeds 1..20, flags {"quests":"offer","stress":"solo","cars":3}
trip    diff    bot     score  ratio  stars  dist(1-5)    complaints  clean  carried  calm%  done  failed  decl  min
short   easy    idle      -725  -0.84    1.0  20/0/0/0/0         5.8   0/20       37      0   0.0     0.0   2.0  2.7
short   easy    sloppy     660   0.74    3.5   1/2/7/6/4         1.1  16/20       39     93   0.9     0.2   1.0  2.8
short   easy    good       954   1.02    5.0  0/0/0/0/20         0.0  20/20       39     99   2.6     0.0   0.0  2.8
short   normal  idle     -1451  -1.31    1.0  20/0/0/0/0        23.4   0/20       50      0   0.0     0.0   2.0  2.8
short   normal  sloppy     780   0.68    3.2  0/2/12/6/0         1.3  16/20       52     89   0.7     0.1   1.6  2.8
short   normal  good      1220   1.00    4.8  0/0/0/3/17         0.0  20/20       54     99   2.5     0.0   0.0  2.9
short   hard    idle     -2522  -1.96    1.0  20/0/0/0/0        55.0   0/20       58      0   0.0     0.0   2.3  2.9
short   hard    sloppy     752   0.58    2.7   3/4/9/4/0         1.8  14/20       58     80   0.8     0.5   1.4  3.0
short   hard    good      1352   1.00    5.0  0/0/0/0/20         0.0  20/20       61     98   2.9     0.0   0.0  3.0
normal  easy    idle     -2454  -1.57    1.0  20/0/0/0/0        53.3   0/20       57      0   0.0     0.0   5.1  5.8
normal  easy    sloppy    1358   0.79    3.8  0/1/3/15/1         0.8  16/20       61     98   3.0     0.2   2.9  5.9
normal  easy    good      1775   1.01    5.0  0/0/0/0/20         0.0  20/20       61     99   6.8     0.1   0.0  5.9
normal  normal  idle     -5212  -2.65    1.0  20/0/0/0/0       135.3   0/20       77      0   0.0     0.0   5.5  6.0
normal  normal  sloppy    1185   0.53    2.5  2/7/10/1/0         7.3   6/20       83     78   2.7     0.5   3.0  6.0
normal  normal  good      2079   0.90    4.4  0/1/1/7/11         0.8  17/20       83     88   6.9     0.0   0.0  6.0
normal  hard    idle     -9401  -4.24    1.0  20/0/0/0/0       268.5   0/20       90      0   0.0     0.0   5.9  6.3
normal  hard    sloppy     692   0.29    1.7  7/12/1/0/0        25.3   0/20       92     70   2.5     0.9   3.1  6.3
normal  hard    good      2166   0.83    4.3  1/1/1/5/12         6.8  11/20       95     85   7.3     0.1   0.0  6.2
long    easy    idle     -5415  -2.36    1.0  20/0/0/0/0       142.2   0/20       77      0   0.0     0.0   9.1  9.2
long    easy    sloppy    2009   0.79    3.8  0/0/4/16/0         0.7  14/20       82    100   5.2     0.1   5.3  9.4
long    easy    good      2707   1.02    5.0  0/0/0/0/20         0.0  20/20       83    100  12.1     0.0   0.0  9.5
long    normal  idle    -11292  -4.00    1.0  20/0/0/0/0       324.1   0/20      105      0   0.0     0.0   9.4  9.5
long    normal  sloppy    1990   0.61    2.9  2/2/12/4/0         9.9   3/20      109     87   4.5     0.7   5.5  9.6
long    normal  good      3297   0.97    5.0  0/0/0/1/19         0.5  16/20      110     94  12.2     0.0   0.0  9.6
long    hard    idle    -19156  -6.13    1.0  20/0/0/0/0       578.1   0/20      121      0   0.0     0.0   9.7  9.8
long    hard    sloppy     803   0.23    1.6  11/6/3/0/0        50.1   0/20      125     76   4.3     1.2   5.3  9.8
long    hard    good      3252   0.86    4.4  1/0/2/4/13        12.3   6/20      127     92  12.4     0.1   0.0  9.9
```
- **Reading it:** idle is 1 star everywhere (and deeply negative: every passenger complains every ~20 s once ignored).
  Good gets 4.3-5 stars and on normal at most 0.8 complaints per trip (short and normal); difficulty rises for both bots
  (good on hard: 4.3-5 stars but 6.8-12 complaints on normal and long; sloppy 2.7 / 1.7 / 1.6 on hard). Sloppy is 3.2-3.8
  on easy, a bit above the 2-3 target, 2.5-3.2 on normal, 1.6-2.7 on hard. Sloppy results are bimodal on long hard
  trips: once the queue of needs outgrows the attendant, complaints repeat every ~20 s (stress falls back to 60 only,
  P-3), a spiral by design.
- `tests/balance.test.js` pins the shape on short trips (idle 1 star, good >= 4, sloppy between).

## D15 — 2026-11-19 — Registry and repo-level side effects of adding the game
- `npm run registry` rewrote `games.json`, the README table and the launcher's `docs/DECISIONS.md` (the D-22 entry) and
  `docs/ADDING-A-GAME.md` wording; these generated changes are committed with the game. The root
  `tests/conventions.test.js` lists the real games, so it now lists four.

## D16 — 2026-11-19 — Browser layer: modules and the loop
- Files: `main.js` (loop, screens, events to sounds and toasts), `render.js` (canvas), `input.js`, `ui.js` (DOM overlays),
  `audio.js` (sound table on kit audio). Only the first four plus `kit/audio.js` and `kit/langdom.js` are in
  `browserModules`; `audio.js` touches no browser global itself (the kit engine does), so the conventions check wants it out.
- Fixed 1/60 s accumulator. A frame gap is cut to 0.1 s and at most 5 steps run per frame (20 with the 4x debug button);
  a backlog is dropped, never built up. `input.read()` runs once per frame that steps, the following steps of that frame get
  the same held keys with the edges (`actionPressed`, `pick`, `accept`, `decline`) cleared, so an edge is true for exactly
  one step and a tap on a frame with no step is kept until the next one. `state.events` are collected after every step.
- The end of the trip does not cut to the end screen: the state stays on screen 1.6 s (toasts, the last sound), then the
  end screen opens. The run is recorded when the `end` event arrives (`recordRun`; debug runs return rank 0).
- Alternative considered: stepping in `requestAnimationFrame` with a variable dt. Rejected: the logic and the balance bots
  assume the fixed step.

## D17 — 2026-11-19 — Camera, scale and the HUD header
- Scale: pixels per metre = min(width / 13, free height / 5.9), clamped 20..52, where the free height is the canvas minus the
  HUD header (chips + train strip, measured every frame) and 92 px of touch controls. So a phone in portrait sees about 14 m
  of train, landscape phones about 21 m and a desktop about 25 m. Need bubbles sit outside the car walls (2.5 m from the
  aisle) so they never hide a face; they may run under the header or the touch controls on short phones.
- The camera follows the attendant with a light ease and is clamped 1.2 m beyond the train ends; the DPR is capped at 2.
- The train strip is a second small canvas in the HUD header (so it flows with the chips), not drawn on the main canvas.
- Quest list and toasts share one column under the header (no overlap); the radio card is top right, or above the controls
  in portrait. On narrow screens the chips drop their labels (icon + value).

## D18 — 2026-11-19 — The landscape, platform and rescue scene
- The scenery scrolls with a speed that eases up over the first 4 s of a leg, down over the last 5 s, and is 0 at a dwell and
  at a rescue stop. Layers: far fields (0.4x), trees (0.7x) and the fence, posts and masts beside the train (1x); objects come
  from an integer hash of their cell and the seed, so they stay put and nothing needs storing.
- The platform (bottom side, station signs every 16 m, benches, waiting people) fades in once the train has nearly stopped
  during a dwell and fades out when it leaves. The broken-down train (top side, flashing amber lights, smoke) fades in when
  the route phase is `stop`. The strip, not the scenery, shows where things are along the train.

## D19 — 2026-11-19 — Passengers and markers on screen
- A passenger is a bust: a round face coloured green to red by stress (hue 120 - 1.2 x stress) with a smile, flat mouth or
  frown (stress under 35, under 70, above) on a clothes-coloured shoulder ellipse. Need bubbles: 🎫 ☕ 🥪 ❓ 💺; from stress
  70 the bubble pulses with a red rim, from 90 it shakes. Role badges (🚨 🔁 😰 🧳 🤒) sit on the face's corner.
- The attendant has a cap with a brim towards the facing direction, a walking bob, the carried item beside it, a dashed lead
  line to the followers and a progress ring (on the passenger being served, or on the attendant for the radio).
- "Reach highlight": the renderer repeats the action choice of `game.js` (`needActions` + `questActions`, same sort) and
  shades the row of the winning action and rings its passenger. It does not call the game's private `actionsAt`; if that
  order changes the highlight must change with it.

## D20 — 2026-11-19 — Input
- Keyboard: ←/→ and A/D walk (both at once cancel), Space / E action (edge on first key down, held while any is down),
  1/2/3 pick, 0/Backspace put back, Y/N accept/decline, P/Esc pause. Menus record nothing except P/Esc.
- Touch: a walk pad (◀ ▶ in one element; the side of the pad a finger is on decides, so sliding works) and an ACTION button,
  each tracked per pointer id so walking and the action work together. Accept / Decline and the café picker buttons react on
  `pointerdown` so they work while another finger holds the pad. Touch controls follow flag `touch`; `auto` also turns on at
  the first `touchstart`. Held input is cleared on blur and when the page is hidden.
- Holding the action while walking does nothing (the logic only runs timed actions when standing still); the HUD does not
  say so. Noted for play testing.

## D21 — 2026-11-19 — Texts added and the title screen
- New EN + SV keys: `howtoTitle`, `howto1..4`, `toastAccepted`, `toastFollowers` (unused so far, kept for a "leading" toast).
  Finished quests are named from the vars cached when they were accepted (the `questDone` / `questFailed` events carry none).
- The title has no trip picker (flags only, as FLAGS.md says): it shows the best scores of the current `trip`.
- The sound toggle lives in the pause screen and lasts for the session.

## D22 — 2026-11-19 — Pause and focus
- The game pauses on `window` blur and when the page becomes hidden (C-3), and on P / Esc / the ⏸ button. Resume resets held
  input and the accumulator. P / Esc also resume from the pause screen.
- Debug (flag `debug`): FPS + seed + speed line, a 4x speed toggle button, and `window.__game` with `state`, `phase`, `flags`,
  `setSpeed(n)` and `steps(n, input)` (steps without rendering, for tests). Nothing is saved to the best scores.

## D23 — 2026-11-19 — Verification of the browser layer
Method: headless Google Chrome driven over CDP from throw-away Node scripts outside the repo (cache off), against
`python3 -m http.server`. Screenshots were read by eye.
- **Checked and working:** title in EN and SV at 1280x800, 390x844 and 844x390 (DPR 2, touch emulation); back link
  `../../?lang=sv` becoming `?lang=en` after the switch; start; the camera and strip; walking with real key events; a ticket
  hold with the ring (score 0 -> 10); picking a coffee at the counter with `1`, carrying it, handing it over (+14); the
  picker also opened by an emulated touch on the ACTION button; the radio card with a live expiry bar, `Y` accepting a sick
  passenger quest, the quest list with its deadline bar and the strip markers; lost-bag, connection and nervous quests
  appearing in the list; a rescue stop with the broken-down train, leading two rescued passengers (follow line, 👣 chip) and
  seating one; pause by a dispatched `blur`, by a faked hidden page, with Esc and P, the sound toggle text; all keys (A/D, E, 1/2/3/0, Backspace, Y/N; N and the Accept / Decline / café buttons also through dispatched events), `touch=off`
  hiding the overlay, `cars=2`, `cars=4&stress=contagious` and `trip=long&difficulty=hard` for a minute without errors; two-finger touch
  (walk right + action held), sliding from ▶ to ◀; the 4x button (a short trip ends in about 45 s real time); the end screen
  (debug text) and "Another trip"; a real non-debug short trip (about 175 s) ending with "New best score! #1", `localStorage`
  holding `train-attendant.scores`, and the title listing it; no console errors or warnings in any run.
- **Test shortcuts (state edited through `window.__game`):** the coffee need was injected into one passenger because needs
  other than the ticket only start after the ticket, minutes into a trip; the attendant was teleported to the counter in the
  touch run. The game code paths that followed were the real ones.
- **NOT checked:** any real phone or tablet (iOS Safari gestures, pinch, rubber-banding, safe-area insets with a notch), a real
  window focus loss, Firefox/Safari, sound (only that nothing throws: nobody listened), a real finger on the on-screen Accept / Decline and café buttons (only dispatched `pointerdown`), `touch=on`, long or
  contagious or 4-car trips played to the end (they only ran their first minute, no errors),
  the `ticket` emoji legibility on other platforms (🎫 is detailed and small in its bubble), performance on slow devices
  (headless ran 48-60 fps with software rendering).
- Known rough edges: standing passengers in a vestibule overlap (up to 8 in 4 m); the radio card and the touch buttons can cover
  part of the car on a short landscape phone; the debug line can sit under the café picker.


## D24 — 2026-11-19 — Verification by Opus (2026-11-19)
An Opus verifier checked the finished game in a second round. Done and green: root `npm test`; the sim result of D14
reproduced; real-input CDP play at 1280x800, at 390x844 and at 844x390 with touch at DPR 3, served at the root and under the
`/side-quest/` prefix; the launcher card in EN and SV (opens the game with `?lang=`); a keys-only normal trip with 6 quests
done and 1 declined; pause froze time; storage failure (throwing and blocked `localStorage`) did not break play or the end
screen. PR-4 is now ✅, and S-3's failure case was seen in the browser.
Findings (each verified) and where they were fixed, in the commits that follow:
1. A nervous-passenger quest dropped an unchecked ticket (fare lost): D25, commit ebcf7ec.
2. The pause button listened for `click` and could not be tapped while a finger held the walk pad: D26, 0cd5455.
3. A cancelled rescue still stopped the train (+20 s, broken-down train): D27, 13d9510.
4. Only one rescue per trip because `route.stop` was never cleared: D27, 13d9510.
5. The strip showed the lost bag's exact position (Q-5 says only the car): D28, ef41eb1.
6. README mentioned a `hider` bot that is not in the sim: D29, 5c81150.
7. Swedish wording slips: D30, a784932.
8. Rescued passengers' calm bonus was missing from the potential (stars ratio above 1): D31, 900c443.
9. Picking up the kit or the bag silently dropped a carried item: D32, c2603c9.
10. Keyboard hints (Y/N, 1/2/3/0) shown on touch screens: D33, 3d49b15.
11. End screen "Score" label hidden on narrow screens: D33, 3d49b15.
12. Unused i18n keys (and the unused follow toasts): D30, a784932.
13. Station names close to real places: D34, 4ee74e6.
14. "New best score!" with unavailable storage: D35, 5a02b4d.
15. `getBoundingClientRect` every frame: D36, 503e8c3.
After the fixes: a headless Chrome sanity run, D37.

## D25 — 2026-11-19 — Nervous quests skip passengers with an unchecked ticket
Accepting a nervous quest clears the passenger's `need`, so an open ticket need was lost and the fare was charged at their
station even if the quest was done. Alternatives: restore the need after the quest (more state, and the passenger would
sit with the need cleared for minutes); pick only passengers whose ticket is checked. Chosen: the second (candidates need
`p.ticket`), as it is one line and a pure filter; nervous quests simply come a little later to a freshly boarded passenger.
Tested in `tests/quests.test.js` (offers only to the checked passenger; a seed-7 short trip with quests assigned).

## D26 — 2026-11-19 — The pause button reacts on pointerdown
The ⏸ button used `click`, which a browser does not deliver for a second finger while the first holds the walk pad (the
same reason Accept / Decline and the café buttons use `pointerdown`). Now it listens for `pointerdown` like them, and keeps
`click` so Enter / Space on the focused button still work (`pause()` ignores a second call). Browser-only, so checked in
headless Chrome with a held walk touch (D37 lists the run), not in a unit test.

## D27 — 2026-11-19 — Rescue stops: called off without a free seat, and more than one per trip
Two bugs: a rescue cancelled at the stop (no free seat) had already stopped the train, added +20 s and drawn the
broken-down train; and `route.stop` was never cleared, so `MAKE.rescue` returned null for the rest of the trip (one rescue at
most). Chosen: `stepRoute` takes a `canStop()` callback and asks it when the planned stop is due; the game answers "a free
seat and a waiting rescue quest". If not, the plan is cleared, the event `stopCancel` is raised (the game cancels the quest,
`questCancelled`, no penalty) and nothing stops. A finished stop clears `route.stop` too (the `stopEnd` step). At most one
rescue stays pending because `MAKE.rescue` still refuses while a rescue quest is active. Alternative: check the seats when
the offer is accepted only (too early: seats change for minutes before the stop). The old cancel inside `onStopStart` stays as
a safety net. Side effect: rescues are now offered more than once on long trips, so the balance numbers of D14 may shift
(not re-tuned here).

## D28 — 2026-11-19 — The strip marks the bag's car, not its position
The train strip drew 🧳 at the bag's exact x, which showed where to look inside the car, against Q-5 ("seen only when the
attendant is in that car"). Now the strip outlines the whole car (dashed amber) and puts the 🧳 icon at the car's top
centre; the bag itself is still drawn only in the camera view of that car. The goal text already names the car. Q-5 states
this. Browser-only drawing, checked by eye in Chrome (D37).

## D29 — 2026-11-19 — README names the real bots
`README.md` listed a fourth `hider` bot. `tools/bots.mjs` has `idle`, `sloppy` and `good` only (the pre-existing `BOT_KINDS`
and its test). The README is corrected; no bot was added.

## D30 — 2026-11-19 — Texts: Swedish wording, unused keys, follow toasts
Swedish: "Resenärer som åkt med" (not "fraktade"), "◀ ▶ gå" and "caféknappar", "Sittplats", "Ge alla {n} räddade passagerare en
sittplats före {station}", "Kontakta anslutningen via radio" / "Anslutningen är kontaktad" (instead of "ropa upp"), "{n} s
försening", "vid cafédisken". All placeholders are unchanged (the i18n test checks them). Unused keys removed after grepping
`src/` and `index.html` (dynamic keys such as `need_*`, `item_*`, `trip_*`, `q_*` stay): `tripLabel`, `difficultyLabel`,
`stationsCount`, `hudCarrying`, `hold_*`, `offerExpires`. `toastFollow` and `toastFollowers` are now used: a passenger who
starts following gives "{name} follows you", and with 2 or more followers "Leading {n}" instead, so leading a whole rescue
group does not flood the 4-toast stack.

## D31 — 2026-11-19 — Rescued passengers count their calm bonus in the potential
`boardRescue` added only the seat points to the stars potential, but a calm arrival of a rescued passenger scores the calm
points too, so score / potential could pass 1.0. The potential now includes seat + calm for each rescued passenger, and
`starsFor` clamps the ratio to 1 as a second guard. The potential grows a little on trips with a rescue, so the star
cut-offs are slightly stricter there (left for the balance pass).

## D32 — 2026-11-19 — A full hand refuses the kit and the bag
Taking the kit or the bag silently dropped a carried coffee / snack / water (the carried item was overwritten). Alternatives:
swap (the old item vanishes or must be placed somewhere: no floor items exist), or refuse. Chosen: refuse. The pickup action
still shows up, with the lowest priority (5), so handing over the carried item to a passenger next to it wins; when it is the
action that fires it emits `handsFull` (EN "Hands full: put it back at the café first", SV "Händerna är fulla: lägg tillbaka
det i caféet först") and nothing changes. The picker's "Put back" still empties the hand (a carried kit or bag goes back to
its fetch stage, as before). Tests in `tests/quests.test.js`.

## D33 — 2026-11-19 — Key hints hidden on touch; the end-screen score label stays
The `<kbd>` hints (Y / N, 1 / 2 / 3 / 0) on the Accept / Decline and café buttons are hidden while the touch controls are shown
(`body.touch`, the class `showTouch` already sets). The end screen's "Score" label reused `.lbl`, which narrow screens
hide (a chip rule, max-width 560 px); it has its own class `endlbl` now and is always visible. CSS only; checked at 390 px in
Chrome (D37).

## D34 — 2026-11-19 — Clearly fictional station names
"Grimsby Cross" and "Ironbridge" are real places, and others on the list (Birchfield, Hollowell, Oakhurst, Larkspur, Juniper
Hill, Northcombe, Kettleton, Alderby, Cinderton, Fernwick) are close to real towns or villages. The whole list was replaced by
invented compounds: Alderwick, Birchmere, Cinderlow, Dunmere, Eastholm, Fernlow, Gullcross, Hollowfen, Ironwater, Junebrook,
Kettlebrae, Larkmoor, Mossgate, Northwend, Oakenholt, Pebbleford. I know of no station or town with these names, but cannot
check a map: if one turns out to be real, swap it in `src/route.js`. A-1 ("fictional names") is unchanged.

## D35 — 2026-11-19 — The end screen says when the score is not saved
With a throwing or blocked `localStorage` the scores live in memory for the session, yet the end screen said "New best
score!". The rank text stays (it is true for this session's list), and a small note under it ("Not saved on this device
(storage unavailable)", SV "Sparas inte på den här enheten (lagring ej tillgänglig)") shows when the kit storage's
`persistent` is false. Debug runs show their own text instead. Checked in headless Chrome with a throwing store (D37).

## D36 — 2026-11-19 — The HUD head is measured on resize, not every frame
`main.js` called `getBoundingClientRect()` on the HUD head every frame (a forced layout). It is now measured by a
`ResizeObserver` on the head (which also fires when the HUD is shown, the chips wrap or the language changes), on window
`resize` and when a trip starts; the frame reads the cached number. Same pixel result as before; checked in Chrome (D37).

## D37 — 2026-11-19 — Browser sanity run after the fixes
Headless Chrome over CDP (throw-away scripts outside the repo), `python3 -m http.server`: no console errors or warnings in
any run. Checked: at 390x844 touch DPR 3, one finger held on the walk pad (the attendant kept walking) while a second finger
touched the ⏸ button: the game paused (D26); Enter on the focused ⏸ button pauses (keyboard kept); the `<kbd>` hints are
`display: none` with the touch controls (D33); the strip showed a dashed outline round the bag's car with 🧳 at its top, not at
the bag (D28); the end screen at 390 px shows the "Score" label (D33); a real non-debug short trip with a throwing
`localStorage` ended with "Nytt rekord!" plus the note "Sparas inte på den här enheten (lagring ej tillgänglig)" (D35); the HUD
head still sits correctly under the chips with the cached measurement (D36). NOT re-checked in the browser: the Swedish texts
by eye beyond that run, a rescue or a lost bag played through, real phones.

## D38 — 2026-11-19 — The pace of the work in the sim, and a good bot that plans like a skilled player
- **Context:** An Opus review found that a calm passenger's next need was drawn 150-250 s after the ticket check, so a short
  trip (~170 s) was tickets only and a normal trip had no coffee, snack or question in its first 2 minutes. The old
  `good` bot also looked too crude to stand in for a skilled player: pure least-slack-first with an 8 s hysteresis, blind to
  passengers getting off, it let tickets wait 40 s on average and lost 5.5 fares per normal trip (`diag` run, 8 seeds).
- **Measuring the pace:** `tools/play.mjs` plays one trip and records non-ticket needs per minute, café (coffee + snack)
  needs, the first non-ticket need, and the stretches with no open work after the first 20 s (a passenger need or an
  active quest that is not waiting for its stop): longest, mean of those over 1 s, and the idle share. `tools/sim.mjs`
  prints them (columns need/m, café, 1st, gapMax, gapAvg, idle%), and the balance test uses the same runner.
- **The good bot is now a short-horizon planner:** about six times a second it takes the 4 most urgent and the 4 nearest
  jobs, tries every order of 3 of them and keeps the order with the fewest expected points lost: complaints (when
  stress reaches 100 and every (100 - afterComplaint) / rate s after that), needs and fares lost when the passenger may get
  off at the next station, failed quests, and 3 points per second of work. It follows the first walk of that plan, stops as
  soon as the job is in reach, carries a café item into the plan, puts a café item back before fetching the kit or the
  bag, and finishes a hold before re-planning. To stay human it sees only what the screen shows: stress (the colours), not
  destinations (only the public chance 1 / stations left that a passenger gets off at the next station), and it reacts to
  a new job 0.5 s after it appears. Knowing the destinations made no difference (5.0 / 3.8 stars on normal / long hard,
  10 seeds, with and without). Pure least-slack-first with the correct slack (walk subtracted) was far worse (58
  complaints vs 6 on the same trips): it sends the attendant on long walks.
- **Alternatives:** tuning the old greedy rule (nearest-first below an urgency threshold, smaller hysteresis): every variant
  was noisy and some spiralled (1-star trips), best 3.9 stars where the planner got 5.0; a full search (too slow for the
  sim and tests). The sloppy bot is unchanged (same moves for the same seed).
- **Result with the old numbers** (`node tools/sim.mjs --seeds 20 --bots good`): the planner gets 5.0 stars on every trip
  length and difficulty (old bot 4.2 on normal and hard, 3.3 on long hard), 0-3.5 complaints, and the pace columns show
  the starving: 0.0-0.4 non-ticket needs per minute on short trips, the first at ~170 s, the longest idle stretch 26-44 s and
  29-51% of the trip with nothing to do. So the old balance came from starved needs and a weak bot; the re-tune is D39.

```
trip    diff    bot     score  ratio  stars  dist(1-5)    complaints  clean  carried  calm%  done  failed  decl  min  need/m  café   1st  gapMax  gapAvg  idle%
short   easy    good      1021   1.00    5.0  0/0/0/0/20         0.0  20/20       42    100   2.8     0.0   0.0  2.8     0.0   0.0   170    28.7    16.7     51
short   normal  good      1231   0.99    5.0  0/0/0/0/20         0.2  19/20       55    100   2.5     0.0   0.0  2.9     0.2   0.3   166    25.7    14.8     46
short   hard    good      1340   0.98    5.0  0/0/0/1/19         0.7  16/20       61    100   2.8     0.1   0.0  3.0     0.4   0.7   170    26.2    14.6     42
normal  easy    good      1996   1.00    5.0  0/0/0/0/20         0.0  20/20       69    100   7.1     0.0   0.0  6.1     0.9   2.5   258    42.9    15.4     49
normal  normal  good      2434   0.97    5.0  0/0/0/1/19         1.0  15/20       87     99   6.9     0.1   0.0  6.2     3.6   9.9   172    34.1    12.9     33
normal  hard    good      2736   0.97    5.0  0/0/0/1/19         1.8   8/20      100    100   7.5     0.1   0.0  6.4     4.1  10.9   168    29.6    11.0     29
long    easy    good      2865   1.00    5.0  0/0/0/0/20         0.2  16/20       90    100  12.2     0.0   0.0  9.6     0.8   3.9   369    43.8    16.8     51
long    normal  good      3516   0.99    5.0  0/0/0/0/20         1.0  14/20      114    100  12.6     0.0   0.0  9.6     2.8  12.6   253    36.2    12.7     35
long    hard    good      3801   0.96    5.0  0/0/0/1/19         3.5   5/20      131     99  12.6     0.1   0.0 10.0     3.4  15.8   248    38.6    11.7     32
```

## D39 — 2026-11-19 — Re-tuned pacing and balance: needs from the first minute, a complaint ends a need, star cut-offs
Supersedes the numbers of D14 (and the star cut-offs of D11).
- **Goal:** steady, varied work from the first minute (other needs soon after the ticket check, several café trips even
  on a short trip, no stretch of more than ~10 s with nothing to do on normal after the first 20 s) and a difficulty that
  really rises: the good bot (D38) about 5 / 4 / 3-4 stars on easy / normal / hard with a few complaints on normal,
  sloppy about 3 / 2-3 / 1-2, idle 1 everywhere.
- **Mechanics (all numbers in `config.js`):**
  - `difficulty.*.firstNeed`: the first coffee / snack / question comes `firstNeed` s after the ticket check (or after a
    rescued passenger, who has no ticket, is seated); later ones after `need` s as before (×`needScale` on long trips).
  - `needs.giveUp`: a complaint ends a coffee, snack or question need (its points are lost; the `complaint` event says
    `need` and `gaveUp`); a ticket or seat need stays. P-3 changed. Without it, once a player fell behind every open
    need complained again every ~20 s (stress back to 60, the need still open): the spiral of D14 turned a slightly slow
    trip into a deep negative score, and no tuning could place a sloppy player between "fine" and "−0.3".
  - `carScale`: the boarding shares are for 3 cars and are multiplied by (3 / cars)^0.5 (2 cars ×1.22, 4 cars ×0.87).
    One attendant serves the whole train; with linear scaling 2 cars had long idle stretches and 4 cars swamped
    everybody.
- **Numbers (before → after):** easy board .16 → .12, first .30 → .25, firstNeed 15-60, need 220-380 → 120-200, stress
  ×.75 → ×.5; normal board .22 → .14, first .40 → .28, firstNeed 12-55, need 150-250 → 80-130, stress ×1 → ×.85; hard
  board .26 → .19, first .45 → .35, firstNeed 10-45, need 150-250 → 60-110, stress ×1.25 → ×1; stress rate ticket .9 →
  1.2 (an unchecked ticket now matters before the passenger gets off), seat 1.4 → 1.0; afterComplaint 60 → 45; rescue
  6-10 → 4-8 passengers at stress 60 → 45 (a failed rescue of 8-10 standing passengers was the main spiral starter for the
  sloppy bot); stars [.30 .55 .75 .90] → [.10 .35 .80 .95]. Points, quest rewards and penalties, trip lengths, walking
  speed and holds are unchanged.
- **Why fewer boarders:** every passenger now asks for something within a minute and then every 1-2 minutes, so the work
  per passenger is about three times what it was; at the old boarding rates even the planner got 14 complaints on normal
  and the sloppy bot −0.65. A normal 3-car trip now carries ~56 passengers instead of ~86 (15-27 aboard at a time).
- **Why these star cut-offs:** the planner throws away little at any load it can handle (ratio .92-.95 on normal), while
  the sloppy bot is limited by its throughput (a 0.3-1.6 s pause before every job, about 15 jobs a minute, when tickets
  alone come at about that rate on a short normal trip), so its ratio drops quickly as the load rises. 5 stars now means
  close to flawless (≥ .95), 4 stars ≥ .80, and the lower cut-offs spread the sloppy and struggling trips (.10 / .35)
  instead of putting them all at 1 star. Idle play is always negative (−0.7 to −4.6), so it stays at 1 star.
- **Tried and dropped:** only slower stress (sloppy stayed at ~.44 with no complaints: its loss is throughput, lost fares
  and needs, not stress); `firstNeed` 20-60 on normal (the first-leg idle stretch after the opening ticket burst stayed at
  ~15-18 s; 12-55 halves it); stress ×.75-.9 on normal (the sloppy bot hardly moves, the good bot only gets fewer
  complaints); `carScale` .7 (2 cars too easy for the good bot: 5.0 on normal); a higher café stress rate.
- **Result** (`node tools/sim.mjs --seeds 20`, 3 cars, `quests=offer`, `stress=solo`), before (D14 numbers and the old
  greedy bot; idle was 1.0 everywhere):

```
trip    diff    bot     score  ratio  stars  dist(1-5)    complaints  clean  carried  calm%  done  failed  decl  min  need/m  café   1st  gapMax  gapAvg  idle%
short   easy    good       949   1.00    5.0  0/0/0/0/20         0.0  20/20       39     99   2.6     0.0   0.0  2.8     0.0   0.0   167    23.4    14.2     35
short   easy    sloppy     667   0.74    3.5   1/2/7/7/3         0.8  16/20       38     93   0.9     0.1   1.1  2.8     0.0   0.0   165    12.9    11.1     14
short   normal  good      1229   0.98    4.9  0/0/0/2/18         0.0  20/20       54    100   2.5     0.0   0.0  2.9     0.2   0.2   169    19.9    10.5     25
short   normal  sloppy     767   0.66    3.1  1/1/12/6/0         1.5  16/20       52     88   0.7     0.1   1.5  2.8     0.1   0.2   167     3.8     2.9      3
short   hard    good      1350   0.98    5.0  0/0/0/1/19         0.0  20/20       61     98   2.9     0.0   0.0  3.0     0.2   0.2   177    22.0    12.9     23
short   hard    sloppy     742   0.57    2.6   4/3/9/4/0         1.8  14/20       58     80   0.8     0.5   1.5  3.0     0.1   0.1   177     3.6     3.5      2
normal  easy    good      1836   0.98    4.9  0/0/1/0/19         0.1  19/20       65     99   6.8     0.1   0.0  6.0     0.8   1.6   270    31.4    14.2     36
normal  easy    sloppy    1278   0.73    3.6  1/0/5/14/0         1.3  17/20       60     96   3.0     0.1   2.8  5.9     0.5   1.5   268    27.7    15.2     23
normal  normal  good      2010   0.82    4.2  0/2/3/4/11         3.3  10/20       86     86   6.6     0.3   0.0  6.1     3.3   8.7   173    25.8    13.3     16
normal  normal  sloppy    1159   0.51    2.5  3/5/11/1/0         7.6   6/20       83     77   2.5     0.8   2.9  6.0     2.8   7.8   178    10.5     8.8      4
normal  hard    good      2200   0.82    4.2  1/1/2/5/11         6.5   9/20       96     86   7.2     0.2   0.0  6.3     3.8  10.5   177    22.4    10.6     15
normal  hard    sloppy     527   0.22    1.6  9/11/0/0/0        27.9   1/20       92     68   2.5     1.0   3.0  6.3     3.1   8.9   181     6.5     5.6      3
long    easy    good      2806   0.97    4.8  0/0/1/1/18         0.9  15/20       92     99  11.8     0.3   0.0  9.6     0.7   3.8   370    41.1    15.0     40
long    easy    sloppy    1975   0.77    3.5  0/0/9/11/0         0.6  13/20       82    100   4.8     0.1   5.3  9.4     0.6   2.8   384    41.3    18.9     33
long    normal  good      2911   0.84    4.2  1/1/3/3/12         8.0   8/20      114     91  11.3     0.5   0.0  9.7     2.7  11.4   253    33.3    14.7     21
long    normal  sloppy    1831   0.55    2.8  1/6/10/3/0        12.2   2/20      110     84   4.5     1.1   5.3  9.6     2.4  10.6   258    23.4    13.0      9
long    hard    good      2382   0.62    3.3   4/3/3/3/7        32.1   3/20      131     84  11.6     0.8   0.0 10.0     3.2  14.3   255    31.0    14.2     16
long    hard    sloppy     601   0.17    1.5  12/6/2/0/0        55.5   0/20      126     77   3.6     1.4   5.9 10.0     2.9  13.2   263    26.4    17.0      7
```
After:
```
trip    diff    bot     score  ratio  stars  dist(1-5)    complaints  clean  carried  calm%  done  failed  decl  min  need/m  café   1st  gapMax  gapAvg  idle%
short   easy    idle      -512  -0.69    1.0  20/0/0/0/0         3.0   0/20       29      6   0.0     0.0   2.0  2.7     0.0   0.0   163     0.0     0.0      0
short   easy    sloppy     516   0.56    3.0  0/0/20/0/0         0.2  16/20       30     81   0.8     0.3   1.1  2.8     5.2   6.7    35     1.0     0.6      1
short   easy    good      1021   0.95    4.7  0/0/0/7/13         0.0  20/20       31     99   2.3     0.1   0.0  2.8     8.6  10.7    29     9.0     4.9     15
short   normal  idle     -1127  -1.35    1.0  20/0/0/0/0        20.9   0/20       33      0   0.0     0.0   2.0  2.8     0.0   0.0   169     0.0     0.0      0
short   normal  sloppy     428   0.42    2.6  2/3/15/0/0         1.3  13/20       34     65   0.6     0.4   1.1  2.8     6.6   7.8    28     0.1     0.1      0
short   normal  good      1162   0.91    4.3  0/0/2/10/8         0.1  17/20       36     97   2.5     0.3   0.0  2.9    11.2  14.3    24     5.3     3.4      6
short   hard    idle     -1972  -1.86    1.0  20/0/0/0/0        44.1   0/20       43      0   0.0     0.0   2.5  3.1     0.0   0.0   184     0.0     0.0      0
short   hard    sloppy      41   0.03    1.4  11/9/0/0/0        10.2   2/20       44     38   0.7     0.8   1.2  3.1     8.7  12.2    25     0.0     0.0      0
short   hard    good      1369   0.85    3.9  0/0/2/18/0         1.0   8/20       45     90   2.6     0.1   0.0  2.9    16.6  22.0    21     0.8     0.7      1
normal  easy    idle     -1400  -1.04    1.0  20/0/0/0/0        24.9   0/20       44      0   0.0     0.0   5.2  5.7     0.0   0.0   345     0.0     0.0      0
normal  easy    sloppy     996   0.52    2.9  1/0/19/0/0         0.7  15/20       48     76   1.9     1.1   3.0  5.9     6.5  16.6    35     0.3     0.2      0
normal  easy    good      2184   0.97    4.9  0/0/0/2/18         0.0  20/20       50    100   7.0     0.1   0.0  6.0     9.8  24.6    29    10.9     5.1     11
normal  normal  idle     -3178  -2.11    1.0  20/0/0/0/0        80.7   0/20       51      0   0.0     0.0   5.5  5.9     0.0   0.0   356     0.0     0.0      0
normal  normal  sloppy     589   0.27    2.3   4/7/9/0/0        12.3   1/20       54     55   1.9     1.5   3.0  6.1     8.5  22.4    29     0.5     0.5      0
normal  normal  good      2450   0.93    4.3  0/0/0/15/5         1.0   7/20       56     94   7.0     0.1   0.0  6.0    13.7  37.4    24     5.7     3.8      3
normal  hard    idle     -5962  -3.28    1.0  20/0/0/0/0       165.4   0/20       67      0   0.0     0.0   5.8  6.2     0.0   0.0   373     0.0     0.0      0
normal  hard    sloppy    -809  -0.30    1.1  19/1/0/0/0        52.8   0/20       71     38   1.1     2.3   2.9  6.3    11.6  31.6    25     0.0     0.0      0
normal  hard    good      2688   0.79    3.4  0/0/12/8/0         7.3   2/20       73     80   6.8     0.8   0.0  6.3    19.0  54.8    20     0.4     0.3      0
long    easy    idle     -2919  -1.43    1.0  20/0/0/0/0        68.4   0/20       58      0   0.0     0.0   9.1  9.3     0.0   0.0   559     0.0     0.0      0
long    easy    sloppy    1515   0.52    2.9  1/1/18/0/0         2.9   8/20       64     76   3.5     1.3   5.2  9.4     6.1  26.1    32     1.4     1.1      0
long    easy    good      3385   0.97    4.8  0/0/0/4/16         0.1  19/20       70     99  12.1     0.2   0.0  9.7     9.0  40.6    28    14.7     5.8     13
long    normal  idle     -6624  -2.98    1.0  20/0/0/0/0       187.0   0/20       68      0   0.0     0.0   9.3  9.4     0.0   0.0   564     0.0     0.0      0
long    normal  sloppy     717   0.24    2.1  3/11/6/0/0        26.1   0/20       71     59   3.0     1.9   5.0  9.5     8.0  35.5    28     0.1     0.1      0
long    normal  good      3725   0.95    4.5  0/0/0/9/11         1.1  10/20       77     96  12.1     0.3   0.0  9.7    12.3  52.5    24     9.3     4.8      5
long    hard    idle    -12367  -4.62    1.0  20/0/0/0/0       367.0   0/20       90      0   0.0     0.0   9.6  9.8     0.0   0.0   589     0.0     0.0      0
long    hard    sloppy   -1708  -0.41    1.0  20/0/0/0/0       108.8   0/20       97     50   2.6     2.5   5.4 10.0    11.8  52.5    22     0.0     0.0      0
long    hard    good      4141   0.80    3.5  0/0/11/9/0        14.2   0/20      104     84  11.9     0.8   0.0 10.2    18.2  83.7    20     1.2     0.8      0
```
- **Reading it:** idle 1 star everywhere. Good: 4.7-4.9 on easy, 4.3-4.5 on normal with ~1 complaint (7-17 of 20 trips
  clean), 3.4-3.9 on hard with 1-14 complaints; it does 2.3-2.6 / 7 / 12 quests on short / normal / long trips and fails
  0.1-0.8, and quests are about a quarter of its score (0.23-0.32 on normal trips, 0.13-0.26 on short ones, seeds 1-6). Sloppy: 2.9-3.0 on
  easy, 2.1-2.6 on normal, 1.0-1.4 on hard; it does 0.6-3.5 quests and fails 0.3-2.5. Pace: 9-10 non-ticket needs a
  minute on easy, 11-14 on normal, 16-19 on hard (before: 0-3.8); the first at 20-29 s (before 165-384 s); 11-22 café needs
  on a short trip for the good bot, 7-12 for the sloppy one (before 0-0.2); for the good bot the longest stretch with no open work is 5-6 s on short and normal trips
  and 9 s on long ones (before 20-41 s, idle 15-40% of the trip), 9-15 s on easy, under 1.2 s on hard.
- **Options** (12 seeds, normal-length trips; good / sloppy stars, good complaints):
  `cars=2` easy 5.0 / 3.0, normal 4.8 / 3.0 (0.1), hard 4.4 / 2.1 (0.8), the longest idle stretch 12-17 s on easy and
  normal (fewer passengers); `cars=4` easy 4.4 / 2.3, normal 4.0 / 1.3 (2.6), hard 3.0 / 1.0 (19.7), on long hard 2.8 (37
  complaints): harder, as D13 intends, still playable for a skilled player; `stress=contagious` normal 4.3 / 1.6, hard
  3.2 / 1.0: harder for a slow player, whose stress spreads through the car; `quests=assign` normal 4.4 / 1.8, hard
  3.4 / 1.0: the sloppy bot skips half its quest jobs, so forced quests fail more often.
- **Guarded by** `tests/balance.test.js` (seeds 1-6): idle 1 star; mean stars per bot and difficulty on short trips within
  ranges, rising with skill and falling with difficulty; good on a normal trip 3.8-4.6 stars with at least one complaint
  and at most 6 per trip, ≥ 5 quests done and ≤ 1 failed, hard clearly harder; quest points 15-40% of the score; the first
  non-ticket need within 60 s, ≥ 10 a minute, the longest idle stretch ≤ 16 s (mean ≤ 10 s); a short trip has ≥ 20
  non-ticket needs and ≥ 8 café needs for the good bot (≥ 12 non-ticket needs for the sloppy one); cars 2 / 4,
  contagious and assign stay above a floor for the good bot.
- **Open:** the train is emptier than before (about a third full in the middle of a trip; full trains with standing
  passengers are rare now, so the seat-leading mechanic is mostly used for rescues); the sloppy bot is bimodal near its
  capacity (4 of 20 normal trips under .10, D39 table); 4 cars on hard stays rough for everyone; a human on a phone may react more
  slowly than the good bot's 0.5 s.

## D40 — 2026-11-19 — Browser sanity run after the re-tune
Headless Chrome over CDP (throw-away scripts outside the repo), `python3 -m http.server`, 1280x800, `?trip=normal&seed=7&debug=1`:
a real keyboard ticket check (arrow keys to the passenger, Space held 0.9 s) scored 10 and drew the passenger's next need
53.7 s later (inside `firstNeed` 12-55); then the good bot (imported into the page, stepping the game while the page
rendered) played to 120 s of game time: the first non-ticket need at 28.5 s, 16 non-ticket needs in the first 2 minutes
(14 questions, 2 snacks: this seed's start is question-heavy; over whole trips about 40% are café needs), no stretch
of 1 s or more without open work after the first 20 s, 0 complaints, no console errors or warnings. Not checked: touch,
the give-up after a complaint on screen (unit-tested), a whole trip by hand.
