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
