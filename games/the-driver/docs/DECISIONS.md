# Decisions & Assumptions Log

> Append-only. Format: `D<n> — <date> — <title>`, then Context / Decision / Alternatives / Consequences.
> Supersede an entry with a new one; never rewrite history.

## D1 — 2026-11-21 — Tech: vanilla JS + Canvas 2D, zero dependencies, the shared kit
- **Context:** "Limit number of dependencies", any modern browser, Chrome for testing; the monorepo's rules (root
  `CLAUDE.md`: zero dependencies, no build step, self-contained games, shared code from `kit/`).
- **Decision:** ES modules loaded by `index.html`, Canvas 2D, WebAudio, `node --test`. From the kit: `audio.js`,
  `flags.js`, `lang.js`, `langdom.js`, `rng.js`, `storage.js` (the same six as Gem Miner and Train Attendant). Page
  shell, Back to games link, `window.__game` and EN/SV as in the other games (root T-4, T-5, L-9).
- **Alternatives:** WebGL / three.js for real 3D (a dependency, or a lot of hand-written shader code for a small game);
  TypeScript (a build step).

## D2 — 2026-11-21 — First person through pseudo-3D road projection in Canvas 2D
- **Context:** "A first-person game looking out from inside the car."
- **Decision:** The road is a list of short segments (5 m) with a curvature and a height. Each frame projects the
  segments ahead of the camera onto the screen from the driver's eye (1.2 m above the road), far to near, as filled
  trapezoids (grass, rumble strip, asphalt, lane marks), with curves accumulated as a sideways shift per segment. Other
  cars and roadside scenery are flat procedural sprites scaled by distance. This is the classic technique for driving
  games without a 3D engine: cheap, smooth at 60 fps on a phone, no image files. On top of the road the **cockpit** is
  drawn: windscreen frame (A-pillars and roof), dashboard with a speedometer, a steering wheel that turns with the
  steering, and a **rear-view mirror** that shows the cars behind (it matters: faster cars overtake you, D5).
- **Alternatives:** true 3D in WebGL (D1); a top-down view (not first person).

## D3 — 2026-11-21 — One drive is one game, exactly 3 minutes, no fail state by default
- **Context:** "Make it playable for 3 minutes before completed."
- **Decision:** A drive lasts 180 s of game time and then is completed ("You made it home"). The clock counts down in
  the HUD. Score = distance + near-miss bonuses − crash penalties, so driving fast and clean is what scores. The flag
  `length` adds a 60 s `short` drive (quick play, testing); the default is the owner's 3 minutes.
- Crashes: two reasonable rules, so both behind the flag `crash`: `soft` (default: a crash costs points and most of your
  speed and shakes the car for a moment; the drive always runs the full 3 minutes, like the sibling games that have no
  fail state) and `hard` (the third crash wrecks the car and ends the drive early; the score so far counts).
- **Alternatives:** a distance goal (the drive could take much more or less than 3 minutes); lives as the default
  (a beginner might not reach the end of the 3 minutes the owner asked for).

## D4 — 2026-11-21 — The drive: three stages, from afternoon to night, traffic rising
- **Decision:** Three 60 s stages (20 s each on `short`): **afternoon** (open fields, light traffic), **sunset** (forest,
  medium traffic, more trucks), **night** (city lights, dense traffic; the road is lit by your headlights, other cars
  show tail lights). The sky, the light and the scenery change over the drive, so the 3 minutes feel like a journey, and
  difficulty rises within one drive. A toast announces each stage.
- **Assumption:** the road is fictional: no real roads, places, car makes or logos (A-1).

## D5 — 2026-11-21 — Road type behind a flag: highway or country road
- **Decision:** `road=highway` (default): three lanes in your direction, slower cars and trucks to weave through, some
  faster cars that come up from behind (seen in the mirror), cars that change lane after signalling with their blinker
  for ~1.2 s. `road=country`: two lanes, one each way; oncoming traffic in the left lane, so overtaking a slow truck
  means timing a gap. Both use the same traffic model (an oncoming car is a car with a negative speed).
- **Alternatives:** only one road type (the two give very different games from the same code; the country road is the
  harder, more tense one, the highway the more forgiving default).

## D6 — 2026-11-21 — Controls
- **Steering** behind the flag `steer`: `free` (default: hold left / right to steer; the car drifts outward in curves
  in proportion to speed² × curvature, which the player corrects) or `lanes` (a tap moves the car one lane over in a
  short smooth slide; curves need no correction: easier, arcade-like, good for small phones).
- **Speed** behind the flag `pedals`: `auto` (default: the car accelerates by itself up to cruising speed, gas goes
  faster up to top speed, brake slows down) or `manual` (nothing happens without gas; letting go coasts down).
  `auto` keeps the touch layout simple and lets a beginner focus on steering.
- Keyboard: ←/→ or A/D steer, ↑/W gas, ↓/S or Space brake, P / Esc pause. Touch: ◀ ▶ bottom left, BRAKE and GAS
  pedals bottom right, multi-touch (steer and pedal at once), ⏸ button.
- Off the asphalt (on the grass) the car is limited to 60 km/h and rumbles; it never leaves the area between the
  roadside barriers. Hitting the barrier is not a crash, it just stops the sideways movement.
- **Alternatives:** tilt steering (needs a motion-permission prompt on iOS; listed as a gap), mouse steering.

## D7 — 2026-11-21 — Deterministic simulation, fixed timestep, focus loss pauses
- **Decision:** As Train Attendant (its D7): all game logic is pure and advanced by `step(state, input, 1/60)` from a
  fixed-timestep accumulator; randomness from one seeded `createRng` (kit). Same seed and inputs, same drive, which
  `tools/sim.mjs` and the tests rely on. Hiding the page or losing focus pauses (root S-16's rule).

## D8 — 2026-11-21 — Module plan and the state contract
Pure (DOM-free, tested in Node):
- `config.js` – every tuning number in one frozen object.
- `flags.js` – the URL flag schema on the kit's parser (`docs/FLAGS.md`).
- `i18n.js` – EN/SV texts, `backHref(lang)`, `clock(s)`.
- `track.js` – the seeded road: segments (curve, height), scenery, `segmentAt(z)`, stage at a time.
- `traffic.js` – spawning, car behaviour (follow, change lane with blinker, oncoming), despawning.
- `car.js` – the player car: steering (free / lanes), speed (auto / manual), off-road, centrifugal drift.
- `game.js` – `createGame(flags, seed)`, `step(state, input, dt)`: time, stages, collisions, near misses, score,
  events, summary.
- `scores.js` – best 5 per `length` on top of a storage object; `storage.js` binds the kit wrapper to `the-driver.`.
Browser: `main.js` (loop, screens, wiring), `render.js` (road, sprites, sky), `cockpit.js` (windscreen frame,
dashboard, wheel, mirror), `input.js` (keyboard and touch), `ui.js` (DOM HUD, screens), `audio.js` (sound table on the
kit engine), plus `kit/audio.js` and `kit/langdom.js`.

The input for one step: `{ left, right, gas, brake, leftPressed, rightPressed }` (held booleans; `*Pressed` are edges
for `steer=lanes`). Units: metres, seconds, m/s; `x` is metres from the road centre (positive to the right), `z` metres
along the road. Every event is `{ type, at, ... }` in `state.events`, emptied at the start of every step.

## D9 — 2026-11-21 — Out of scope and gaps known up front
- No service worker / offline / install as an app (root S-17 is an owner decision; Gem Miner, Poo Sandwich and Train
  Attendant have none either).
- No real-device testing (headless Chrome with device emulation only), no Safari testing; same as the siblings.
- No continuous engine sound: the kit's audio engine (`kit/audio.js`) only plays short, fading tones and does not
  expose its context, so a sustained engine drone would need a kit change. The game plays a short engine "putt" whose
  rate follows the speed instead (V-2). Gap reported to the owner.
- No tilt steering (D6).

| ID | Date | Assumption |
|----|------|------------|
| A-1 | 2026-11-21 | Fictional road and generic procedural cars (box shapes, no makes, models or logos); driving on the right, as in Sweden. |
| A-2 | 2026-11-21 | Speeds are shown in km/h (the owner is in Sweden; the game has EN and SV, no unit switch). |
| A-3 | 2026-11-21 | "For one player": single player, no ghost cars or leaderboard beyond the device's best scores. |
| A-4 | 2026-11-21 | "3 minutes before completed": 3 minutes of game time; pausing stops the clock. |

## D10 — 2026-11-21 — The pure logic: units, geometry and the state contract as built
- **Decision:** `src/config.js` holds every number. Units: metres, seconds, m/s (UI shows km/h = m/s × 3.6). Player: 1.9 m
  × 4.4 m, top 50 m/s (180 km/h), auto cruise 30.6 m/s, grass cap 16.7 m/s (reached at 30 m/s², not instantly), auto
  accel 5 m/s², gas 6 m/s², coast 3 m/s² (auto) / 2 m/s² (manual), brake 22 m/s². Free steering: sideways speed =
  steer × speed × 0.25 (steer is smoothed at 7/s, also the wheel angle); centrifugal drift = speed² × curve × 0.0045 (a
  right curve pushes towards -x). Lanes steering: x follows the target lane at 9/s, at most 10 m/s. Road: segments of
  5 m, lane 3.6 m (highway 3 lanes, centres -3.6/0/3.6; country 2, centres -1.8 oncoming / +1.8), barriers at halfWidth +
  2.5 m, road length = duration × 50 m/s + 2000 m (2200 segments for 180 s). The player starts in lane 1 at z = 0 at
  cruising speed (also with `pedals=manual`). Cars: car 1.9×4.4, van 2.1×5.6, truck 2.5×10 m; 10 palette colours in
  `CFG.traffic.palette`.
- **Scenery vs stage:** the scenery of a segment is baked per stage by *metres* (`track.stageZ`, laid out for 32 m/s), while the
  sky follows the *time* (`stageAt`). A slow driver sees the wrong scenery for a while; the renderer should take the
  light/sky from `state.stage` and the objects from `segment.scenery[].kind`. `stageAtZ(track, z)` exists.
- **State** (`createGame(flags, seed)`): `{ version, flags, seed, tick, time, duration, stage, track, player, cars, score,
  crashes, nearMisses, streak, distance, passed:[n0,n1,n2], bonus, penalty, pointAcc, events, ended, endReason, summary,
  nextId, spawn }` (`rng` is a non-enumerable property, like Train Attendant). Time is `tick / 60` (no float drift), the
  drive ends at exactly `duration × 60` ticks. Events: `stage`, `crash`, `nearMiss`, `offroad`, `barrier`, `blink`, `end`
  (fields in the header comment of `src/game.js`); the initial `stage 0` event is there right after `createGame`.
- `summary` = `{ score, stars, distance (m), topSpeed (m/s), nearMisses, crashes, endReason, seed, length, road,
  difficulty, time, passed }` (extras beyond the brief: `time`, `passed`).

## D11 — 2026-11-21 — Traffic model
- **Decision:** Per-lane density held in a window of 600 m ahead; cars spawn 320-450 m ahead (out of sight: the renderer
  should not draw cars farther than ~320 m, or fade them), at most one per lane per 0.4-1.4 s, never within 45 m of
  another car in the lane; at the start nothing is closer than 90 m. Despawn > 150 m behind or > 600 m ahead. Cars per
  100 m **per lane** (× difficulty density 0.7 / 1 / 1.35, × lane weight 0.8 / 1 / 1.2 on the highway):
  highway 0.55 / 0.85 / 1.2 (stage 1/2/3); country same direction 0.2 / 0.3 / 0.42; country oncoming 0.35 / 0.5 / 0.7.
  Trucks/vans share: highway 10-20 % trucks (right lane only) and 12-14 % vans; country 25-30 % trucks.
- **Speeds (m/s):** highway lanes left to right 27-31.5 / 22.5-26.5 / 18-22, trucks 16.5-19, vans 1.5 slower; country same
  direction 20-26 (trucks 13.5-17), oncoming 18-27. The narrow speed range inside a lane is on purpose: with wide ranges
  every lane turned into a slow platoon behind its slowest vehicle and the player was boxed in (first try: avg 80 km/h).
  Faster cars from behind (highway): a try every 9-18 s ÷ (difficulty × (1 + 0.4 × stage)), 80-120 m behind, 3-8 m/s
  faster than the player (max 40 m/s), only with a 45 m free gap in lane 0 or 1.
- **Following:** the wanted speed is `min(cruise, leader + (gap - (6 + v × 1.2)) × 0.4)`, accel 2 m/s², decel up to 9 m/s²;
  the brake light is on when slowing by more than 1 m/s². The player counts as a leader for same-direction cars, so
  braking hard in front of a car can get you rear-ended. A leader is anything whose body overlaps the car's lane band
  (±0.5 m), so a car sliding over is seen.
- **Lane changes (highway):** when blocked 0.6 / s, otherwise 0.012 / s (× difficulty 0.6 / 1 / 1.5), cooldown 4-9 s;
  blinker 1.2 s, then a 1.5 s slide, only if the target lane is free (10 m + 1.5 s of closing speed ahead, 12 m + 2.2 s
  behind, the player included) at the start of the blinker and again at the end (else the blink is cancelled). Trucks never
  go to the left lane.
- **Country:** no lane changes; oncoming cars are cars with negative speed in lane 0; the player may use lane 0.

## D12 — 2026-11-21 — Crashes, near misses, score and stars
- **Crash:** player speed × 0.25, steering locked 1.2 s, the same car cannot hit again for 1.5 s (other cars can), the
  car is pushed clear (rear-ended: forward and +3 m/s; hit from behind: back and slowed; side or head-on: 1.2 m sideways,
  the player 0.4 m the other way), penalty 100 points (score never below 0), streak reset. `crash=hard`: the 3rd ends
  the drive ('wrecked').
- **Near miss:** when the sign of the distance along the road to a car changes (a pass, oncoming included), the closest
  lateral gap seen while the cars overlapped in length is < 0.8 m, the speed > 60 km/h and there was no crash with that
  car. Bonus 40 × multiplier, multiplier = 1 + floor(streak / 3), capped at 5; `streak` = near misses since the last crash.
  **Deviation:** with `steer=lanes` cars are always a lane apart (gap 1.3-1.6 m) so the threshold is 1.8 m and the bonus
  halves; otherwise near misses would be impossible there.
- **Score:** 1 point per 10 m + near misses − crashes.
- **Stars:** score per second of the drive's full length: 2 / 3 / 4 / 5 stars at 0.6 / 1.5 / 3.2 / 4.6, times the difficulty's
  `starScale` 0.85 / 1 / 1.2 (a 60 s drive needs a third of the points). Reason for the scale: more traffic gives a good
  driver more near misses, so by points alone hard paid more than normal.

## D13 — 2026-11-21 — Balance bots and results
- `tools/bots.mjs`: **idle** keeps its lane (corrects curves only), **sloppy** notices trouble late (90 %), dodges to a
  side without always looking, brakes 70 % of the time, wide steering margin, **good** scores each lane by the room ahead
  (hysteresis, closed doors when the side is not free), keeps a safe gap, uses the gas on a free road (up to 42 m/s), slips
  to 0.5 m from cars it passes for near misses and on the country road pulls out only when no oncoming car is within 10 s.
  Targets met on the normal highway: idle 1.0, sloppy 2.3, good 4.0; country good 3.7. Hard is harder for every bot on the
  highway and on short drives, but **not** quite on the normal country road for the good bot (3.8 vs 3.7: more oncoming
  cars mean more near misses): a known gap. Cars passed per stage rises for idle (3/5/6 highway, 14/19/24 country, the
  oncoming cars count) and the cars within 300 m ahead rise 7/9.5/10.8 (the good bot's passes are limited by traffic).
- The whole `npm test` takes about 2 s.

```
seeds 1..12, flags {"length":"normal","steer":"free","pedals":"auto","crash":"soft"}
road     diff    bot     score  stars  dist(1-5)    crashes    nm   km   avg    pass 1/2/3      near 1/2/3     wrecked
highway  easy    idle        10    1.0  12/0/0/0/0       23.9   1.8  4.3    85      3    4    4    5.0  6.4  8.7        0
highway  easy    sloppy     382    2.9   2/1/6/2/1        4.1   4.6  5.1   102      5    8   10    4.7  7.3  9.4        0
highway  easy    good       773    4.6   0/0/0/5/7        0.8   5.8  5.2   105      8    9    8    4.9  8.1 10.1        0
highway  normal  idle         7    1.0  12/0/0/0/0       25.5   3.1  4.2    84      3    5    6    6.3  8.6  9.8        0
highway  normal  sloppy     312    2.3   5/2/2/2/1        6.0   5.8  4.9    97      5   10   11    6.6  9.7 11.3        0
highway  normal  good       767    4.0   0/0/3/6/3        0.1   4.8  4.9    98      9    9    7    7.1  9.5 10.8        0
highway  hard    idle         4    1.0  12/0/0/0/0       27.1   2.5  4.1    82      4    4    7    7.9 11.0 13.4        0
highway  hard    sloppy     220    1.8   4/6/2/0/0        6.6   6.1  4.8    96      7   11   12    8.5 11.1 11.6        0
highway  hard    good       764    3.6   0/0/7/3/2        0.3   5.2  4.8    96     10    9    9    9.3 11.5 13.4        0
country  easy    idle        22    1.1  11/1/0/0/0       26.6   5.3  4.0    81      7   13   18    1.6  2.5  3.4        0
country  easy    sloppy     293    2.3   6/1/3/0/2        6.7   7.8  4.0    79      7   12   19    1.6  2.5  3.4        0
country  easy    good       665    3.9   0/0/5/3/4        0.3   4.6  4.0    80      7   13   18    1.7  2.5  3.5        0
country  normal  idle         8    1.0  12/0/0/0/0       28.9   6.9  3.9    79     14   19   24    2.4  3.6  4.8        0
country  normal  sloppy     273    2.1   6/2/2/1/1        8.3  10.2  3.9    79     14   19   23    2.4  3.4  4.8        0
country  normal  good       596    3.7   0/0/6/4/2        0.3   4.2  3.8    76     14   18   23    2.4  3.6  4.8        0
country  hard    idle         3    1.0  12/0/0/0/0       34.6   7.8  3.6    72     19   23   32    3.7  4.5  5.9        0
country  hard    sloppy     330    2.1   7/2/0/1/2       10.9  11.8  3.6    72     19   23   32    3.7  4.6  5.9        0
country  hard    good      1156    3.8   0/3/3/0/6        0.3   7.8  3.6    72     19   23   31    3.7  4.5  5.9        0
```
Short drives, normal difficulty:
```
seeds 1..8, flags {"length":"short","steer":"free","pedals":"auto","crash":"soft"}
road     diff    bot     score  stars  dist(1-5)    crashes    nm   km   avg    pass 1/2/3      near 1/2/3     wrecked
highway  normal  idle        13    1.1   7/1/0/0/0        4.0   0.5  1.6    98      1    2    2    5.2  7.2  9.7        0
highway  normal  sloppy     119    2.8   1/2/3/2/0        1.1   0.9  1.7   104      1    2    3    5.2  7.6 10.6        0
highway  normal  good       230    4.0   0/0/3/2/3        0.3   1.6  1.9   114      3    3    4    6.1  9.1 11.3        0
country  normal  idle        12    1.1   7/1/0/0/0        8.3   2.9  1.4    84      5    6    8    2.4  3.4  4.5        0
country  normal  sloppy     154    2.8   3/1/1/1/2        2.4   4.0  1.4    84      5    6    8    2.4  3.3  4.5        0
country  normal  good       253    3.9   0/0/3/3/2        0.0   2.4  1.4    83      5    6    8    2.5  3.4  4.5        0
```

## D14 — 2026-11-21 — Repo-level changes the pure logic needed
- `tests/conventions.test.js` (root) lists `the-driver` among the games, `npm run registry` regenerated `games.json`.
- `games/the-driver/index.html` is a **placeholder** (the registry requires one); the browser layer replaces it.
- `package.json` `"browserModules"` is temporarily `["kit/audio.js", "kit/langdom.js"]` (the conventions check requires every
  listed module to exist and use a browser global); the browser layer adds `main.js`, `render.js`, `cockpit.js`,
  `input.js`, `ui.js` back.
