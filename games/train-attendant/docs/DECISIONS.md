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
