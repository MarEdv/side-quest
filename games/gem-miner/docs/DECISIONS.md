# Decisions & Assumptions Log

> Append-only. Format: `D<n> — <date> — <title>`, then Context / Decision / Alternatives / Consequences.
> Supersede an entry with a new one; never rewrite history.

## D1 — 2026-11-14 — Tech: vanilla JS + Canvas 2D, zero dependencies
- **Context:** "Limit number of dependencies", any modern browser, lives in the zero-dependency Side Quest Project monorepo.
- **Decision:** ES modules loaded directly by `index.html`, Canvas 2D, WebAudio, `node --test` for tests. No packages.
- **Alternatives:** Phaser/PixiJS (a dependency, though a tilemap engine would help), TypeScript + bundler (build step).

## D2 — 2026-11-14 — Top-down view, not side-view
- **Context:** "Mines", "scrollable in four ways", "rather big". A side-view digger (gravity, ladders, falling) is the
  classic mining look but scrolls mostly up and down and needs physics.
- **Decision:** Top-down tile grid. The world spreads equally in four directions around a central town, so all four scroll
  directions matter.
- **Alternatives:** Side-view with gravity (more work, mostly vertical). Both views behind a flag was rejected as doubling
  the game for little gain. Recorded as out of scope.

## D3 — 2026-11-14 — Tile-based movement, bump to mine
- **Decision:** The miner moves tile by tile (with a short slide animation); pushing into rock mines it. This keeps controls
  identical on keyboard and touch (a direction is all you need) and makes mining speed easy to reason about.
- **Alternatives:** Free movement with a mining button aimed at the facing tile (more fiddly on touch).

## D4 — 2026-11-14 — Rings of difficulty around the town
- **Decision:** Distance from the centre decides the rock type (dirt → stone → granite → obsidian, with noise so the edges
  are ragged) and the gem table. The dream diamond sits in the outer ring behind a crystal wall only the Gem hatchet cuts,
  so the hatchet ladder (wood → stone → steel → gem) is the progression.
- **Assumption:** "Hatchet" is the owner's word for the digging tool; we keep it rather than "pickaxe". "Gem" hatchet means a
  hatchet with a gem blade.

## D5 — 2026-11-14 — Find or buy
- **Decision:** Chests guarantee one stone and one steel hatchet somewhere in the mine; all tiers except wood can also be
  bought in the shop. The Gem hatchet is shop-only (an endgame purchase), so selling gems matters.

## D6 — 2026-11-14 — No fail state; best times as the score
- **Assumption:** The owner asked for a simple, exploratory game. There is no death or timer pressure; the score is how fast
  you found the dream diamond. Best times are kept on the device, like the sibling games' local best scores. No handle entry
  (not asked for this game).

## D7 — 2026-11-14 — Autosave
- **Decision:** A big world makes a game longer than one sitting, so progress autosaves to localStorage (prefix
  `gem-miner.`, shared origin with the other games) every few seconds and on page hide. The save stores the seed plus the
  changes (mined tiles, opened chests, fog) rather than the whole world.

## D8 — 2026-11-14 — Mobile support and the launcher
- **Assumption:** The sibling games support touch and the launcher is an installable app, so Gem Miner supports touch too
  (D-pad default, joystick by flag). No game-specific service worker or install prompt: the launcher app already covers
  install, and it keeps this game simple. Listed in the launcher via `game.json` + `npm run registry`.

## D9 — 2026-11-14 — Module layout and data model
- **Decision:** Pure logic: `flags, rng, noise, tiles, world, mining, economy, game, save, scores, storage, camera,
  touchmath` (a test fails if any of them touches a browser global). Browser glue: `main, render, input, audio, ui`.
  The world is two `Uint8Array`s (tile id per cell, difficulty ring per cell) plus a chest index map; changes to the
  world are only ever "this cell became open", which keeps the save a small diff (D-NF-4). A gem tile is as hard as the
  ring it sits in; chests and the dream diamond are "bump to take" tiles.
- **Alternatives:** one object per tile (too heavy at 512 x 512), storing the whole tile array in the save (260 KB).

## D10 — 2026-11-14 — World generation numbers
- **Decision:** Ring edges at 18 % / 42 % / 68 % of the distance from town to the bedrock edge, each edge pushed around by
  +-0.07 of fractal value noise so the rings are ragged. Town is a disc of radius 4.5 with the shop on its centre tile and
  the start two tiles south. Gems appear per rock cell with probability 2.0-2.4 % (by ring) times a vein multiplier from
  low-frequency noise (0.35 outside veins, up to ~3x inside), so rich and poor areas exist. Gem mix per ring: dirt
  quartz/amethyst/topaz; stone adds emerald; granite topaz..ruby; obsidian sapphire, ruby and the only diamonds.
- **Dream chamber:** at 80 % of the way to the edge in a seeded random direction: a 3x3 floor with the diamond, a 1-thick
  crystal wall (hardness 5) and a 9x9 obsidian block around it. Only the Gem hatchet cuts crystal.
- **Chests:** `size^2 / 1500` scattered (65 % coins, 35 % 2-4 gems, richer further out) plus two guaranteed: a Stone
  hatchet in the dirt ring (3+ tiles outside town) and a Steel hatchet in the granite ring (reachable with the Stone
  hatchet, not with wood). Opened chests become floor.
- **Reachability guarantee:** `floodReach` (tested for 6 seeds x 128/256) proves the stone chest is reachable with wood,
  the steel chest with stone, every chest and the dream diamond with the Gem hatchet, and that the gems each tier can reach
  are worth well over the next hatchet's price.

## D11 — 2026-11-14 — Hatchets, mining time, movement
- **Decision:** Hardness 1 dirt, 2 stone, 3 granite, 4 obsidian, 5 crystal. Wood cuts up to 2, Stone 3, Steel 4, Gem 5.
  Base seconds per block (speed 1): 0.30 / 0.55 / 0.95 / 1.5 / 2.5. Hatchet speed multipliers 1.0 / 1.7 / 2.8 / 4.5.
  Walking is 0.11 s per tile. Durability flag: Stone 400, Steel 800, Gem 1500 blocks; wood is infinite. A broken hatchet is
  gone (rebuy in the shop; a chest hatchet you already own pays half its price instead).
- **Alternatives:** durability that can be repaired for coins (more UI for a default-off flag).

## D12 — 2026-11-14 — Economy and balance (tools/sim.mjs)
- **Decision:** Gem values 3 / 8 / 20 / 50 / 115 / 260 / 650 (quartz..diamond). Hatchet prices for the 256 world: Stone
  140, Steel 2800, Gem 32000; they scale linearly with world size (128: 70 / 1400 / 16000, 512: 280 / 5600 / 64000),
  because gem density per tile is the same in every size and the income rate does not grow with the world, so a fixed
  price would make 128 and 512 take about the same time.
- **Method:** `node tools/sim.mjs` plays the real `update()` at 60 Hz with a bot that only sees fog-revealed tiles,
  sweeps a ring in the richest area its hatchet can cut, digs to gems worth the detour (>= 1.5 coins/s), returns to town
  when it can afford the next hatchet and, with the Gem hatchet, follows the dream compass. The bot is more efficient
  than a person (no hesitation, perfect paths), so the human target of 20-40 minutes on 256 corresponds to a bot time of
  about 15-20 minutes. Results are in D-20 (final numbers).

## D13 — 2026-11-14 — Dream compass
- **Decision:** Once the player owns the Gem hatchet the HUD shows direction and distance to the Diamond of Your Dreams
  ("the gem blade hums"). Without it, finding one chamber in 65 000 or 262 000 tiles would be luck; the owner asked for a
  20-40 minute game. Before that the HUD shows the way back to town (P-2).
- **Alternatives:** always-visible compass (removes the exploring), a rumour in the shop (more UI).

## D14 — 2026-11-14 — Rendering
- **Decision:** The world is pre-rendered in 16 x 16-tile chunks into plain offscreen `<canvas>` elements (not
  `OffscreenCanvas`, which needs Safari 16.4+), created lazily for the visible chunks and dropped (LRU, pixel budget about
  70 M px) when far away; a changed tile drops its chunk. Everything is drawn at integer device pixels (no seams or blur),
  the main canvas uses `getContext('2d', { alpha: false })`, fog is a per-frame layer of merged row rects plus a soft lamp
  gradient, gems sparkle in a cheap dynamic pass. Tile size adapts: `round(min(width, height) / 20)` CSS px clamped to
  26-40 (about 32 px on a laptop, 26 px on a phone). Resolution scaling is capped at DPR 2 (a DPR 3 phone would need
  2.25x the pixels per chunk for little gain on a blocky art style).
- **Alternatives:** redrawing every visible tile every frame (about 900 fillRects plus gems per frame, fine on desktop but
  not on phones), `OffscreenCanvas` (iOS), WebGL (a dependency-free tile renderer is more code than this needs).

## D15 — 2026-11-14 — Autosave and Safari storage eviction
- **Decision:** Autosave every 5 s, on `visibilitychange` (hidden), on `pagehide`, when pausing and on quitting to the
  title. The first save calls `navigator.storage.persist()` once inside try/catch. Safari (ITP) deletes script-written
  storage of sites with no user interaction for 7 days (not for home-screen apps), and `persist()` is the standard way to
  ask for exemption; it is a request and may be ignored, so a long break can still lose a save on Safari. All storage
  access is wrapped (`storage.js`): when the backend is missing or throws, saves stay in memory for the session and play
  continues. Winning deletes the save. `debug=1` runs never save (they reveal the map and hand out coins).
- **Save format:** `{ v: 1, seed, size, fogOn, t, p: [x, y], mined: "<sorted base-36 index deltas>", fog: "<base64
  bitset>", inv, stats }`. A 512 x 512 fog bitset is 32 KB (44 KB as base64); a 20 000-block diff is about 60 KB. Opened
  chests are the chest tiles that became open, so they are stored in `mined`. Anything that fails validation (version,
  types, ranges, bitset length) is discarded and the player is told, never thrown.

## D16 — 2026-11-14 — Shop opening, town and UI rules
- **Decision:** The shop opens when you step onto the shop tile (E-1) and with E / Enter / the touch Shop button anywhere in
  town (a disc of radius 4.5 plus a half tile). The sim only advances while no overlay is open; opening an overlay clears
  held keys, the overlay handles its keys in the capture phase and stops them, and the HUD buttons and touch controls
  become `inert`, so nothing leaks into the game. Overlays are DOM (`ui.js`): title, shop, pause, minimap, win. The shop
  has a fixed header and footer with a scrolling middle so Back stays reachable on short landscape phones. Arrow keys move
  focus between buttons, Esc closes; targets are 44 px or larger.
- **Side effect accepted:** walking across the shop tile (the centre of town) opens the shop each time.

## D17 — 2026-11-14 — Touch controls
- **Decision:** The D-pad takes the direction from where the finger is relative to the pad centre (sliding between
  directions works; one axis at a time like the keyboard); the joystick (flag) is a fixed stick with a dominant-axis dead
  zone. Shown when `touch=on`, or `auto` and the device has a coarse pointer / touch points (or a touch is seen). Page
  scroll, pinch and rubber-banding are blocked with `touch-action: none`, `overscroll-behavior: none` and iOS gesture
  event blocking; screens that need scrolling opt back in. Safe-area insets are applied to the HUD and controls.
- **Alternatives:** tap-to-walk to a tile (conflicts with mining by bump), a floating joystick (needs a free area; the
  fixed one is easier to explain).

## D18 — 2026-11-14 — Hatchets in the world and the thumbnail
- **Decision:** No thumbnail PNG: the launcher card uses the 💎 emoji icon (`game.json` `icon`). The Gem hatchet is not in
  any chest (D5); it is the endgame purchase.

## D19 — 2026-11-14 — Browser verification (headless Chrome over CDP)
- Verified on 2026-11-14: launcher shows three cards and the Gem Miner card opens the game; title; new game; fog; walk and
  mine with the keyboard; the camera scrolled right, left, down and up (deadzone) and stayed centred with `camera=center`;
  stepping on the shop tile and E opened the shop; selling one / all, buying, not enough coins, Esc; no movement while the
  shop was open; M minimap and P pause (timer frozen); reload, Continue restored position, mined tiles and counters
  (3 KB save); a corrupt save is discarded with a message; best times on the title and win screens (win on a crafted save);
  `?debug=1` minimap of the whole world; 512 world, `durability=1` (the Stone hatchet broke), `fog=0`; 390 x 844 and
  844 x 390 touch emulation with the D-pad and joystick mining, the Shop button, the minimap button; no console errors.
- Not verified: a real phone, Safari / iOS, audible sound, safe-area insets on a notched device, 60 fps on a mid-range phone
  (headless desktop Chrome reported 60 fps at 512 x 512).

## D20 — 2026-11-14 — Balance results (tools/sim.mjs, final numbers)
- Bot completion times (game time, 6 seeds per size, perfect-play bot, default flags):
  **128:** 8m06s mean (7m49s-8m30s); **256:** 17m18s mean (15m45s-19m21s; seeds 11-14: 13m10s-18m02s);
  **512:** 32m17s mean (26m43s-35m35s). With `durability=1` on 256 the bot needs 22m12s mean (3 seeds): it has to
  rebuy broken hatchets (about 4-5 shop trips) and still always finishes.
- Typical bot timeline on 256: Steel hatchet at about 4 min (or found in its chest), Gem hatchet at about 16 min, then a
  1-minute walk and dig to the chamber. A person is slower than the bot (reading, wandering, missed gems), so 20-40
  minutes on 256 is the expected human time; 128 takes about half of that. The bot's `--rate` (minimum coins per second a
  detour must pay, default 1.5) is the main knob of its efficiency.
- Prices and gem tables were tuned so the three tiers arrive roughly every 4-12 minutes for the bot (E-2).
