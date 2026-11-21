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
