# The Driver — Requirements

> **Living document.** Every change to gameplay, controls, flags, tech or scope updates this file **in the same commit**
> (see `../CLAUDE.md`). IDs are stable; retire rows with ❌ instead of deleting or reusing them.
> Status legend: ✅ implemented and verified · 🚧 implemented but not (fully) verified, or in progress · 📋 planned · ❌ retired

## 1. Vision
A small single-player browser game. You are behind the wheel, looking out through the windscreen. Weave through the
evening traffic for three minutes, from afternoon to night, without hitting anyone: the faster and cleaner you drive,
the higher the score.

## 2. Owner requirements
| ID | Requirement | Status |
|----|-------------|--------|
| PR-1 | Game called **"The Driver"**, one player. | ✅ |
| PR-2 | The player drives a car, avoiding the traffic. | ✅ |
| PR-3 | First person, looking out from inside the car. | ✅ |
| PR-4 | Playable for 3 minutes before it is completed. | ✅ D20 |
| PR-5 | Listed side by side with the existing games in the Side Quest Project launcher. | ✅ D20 |
| TR-1 | Runs in any modern browser; tested in Chrome. | 🚧 |
| TR-2 | Minimal dependencies (D1: none). | ✅ |

Process rules from the owner (apply to all work): implement several reasonable options behind flags or pick one; document
assumptions and decisions (`DECISIONS.md`); keep this file current; iterate fast and commit often; Opus plans and verifies,
Sonnet implements, Haiku looks up docs; never ask the owner questions.

## 3. Functional requirements

### 3.1 The drive
| ID | Requirement | Status |
|----|-------------|--------|
| G-1 | A drive lasts 180 s of game time (flag `length`: `normal` 180 s, `short` 60 s), then it is completed ("You made it home") and the end screen shows. Pausing stops the clock. | ✅ D20 |
| G-2 | The drive has three equal stages: afternoon (fields), sunset (forest), night (city lights; headlights and tail lights). Each stage has more traffic than the one before; a toast announces it. | ✅ |
| G-3 | The road is generated from the seed: straights, left and right curves of varying sharpness, hills and dips. The same seed gives the same road and traffic for the same inputs. | 🚧 |
| G-4 | Road type (flag `road`): `highway` (default, three lanes one way) or `country` (two lanes, oncoming traffic in the left lane). | ✅ |

### 3.2 The player's car
| ID | Requirement | Status |
|----|-------------|--------|
| C-1 | Speed 0–180 km/h. `pedals=auto` (default): accelerates by itself to a cruising speed of 110 km/h, gas goes up to 180, brake slows down. `pedals=manual`: gas accelerates, letting go coasts down, brake slows down. | ✅ |
| C-2 | Steering (flag `steer`): `free` (default; hold to steer; curves push the car outward in proportion to speed² × curvature) or `lanes` (a tap slides one lane over; curves need no correction). | ✅ D20 |
| C-3 | Off the asphalt the car is limited to 60 km/h and rumbles (shake, sound). Barriers at the road edge stop sideways movement (the car stops with its side against the rail, D20); touching them is not a crash. | 🚧 |

### 3.3 Traffic
| ID | Requirement | Status |
|----|-------------|--------|
| TF-1 | Cars, vans and trucks of different sizes and colours drive in the lanes at their own speeds (highway: mostly slower than the player, some faster ones that overtake). They keep their distance to the car ahead and brake for it (brake lights). | 🚧 |
| TF-2 | On the highway, cars change lane after signalling with a blinker for about 1.2 s, only into a free gap (the player's car counts). | 🚧 |
| TF-3 | On the country road, oncoming cars come towards the player in the left lane; slow trucks in the player's lane must be overtaken through gaps in the oncoming traffic. | 🚧 |
| TF-4 | Traffic appears out of sight ahead (or behind, for faster cars) and disappears once far behind; density follows the stage and the difficulty (flag `difficulty`: `easy`/`normal`/`hard`). A new car never appears inside or right in front of the player. | 🚧 |

### 3.4 Crashes, score and end
| ID | Requirement | Status |
|----|-------------|--------|
| S-1 | Touching another car is a crash: the screen shakes, the player's car loses most of its speed, steering is locked for a moment, the other car is pushed away, a crash sound plays and the crash count rises. Flag `crash`: `soft` (default: the drive goes on) or `hard` (the 3rd crash wrecks the car and ends the drive). | ✅ D20 (the sound: V-3) |
| S-2 | Score: points for distance driven, a bonus for each **near miss** (passing a car at speed with less than ~0.8 m between the cars), minus a penalty per crash. A clean streak (no crash) raises a multiplier for near misses. | ✅ D20 |
| S-3 | HUD: time left, score, crashes; the speedometer is on the dashboard (and a speed chip in the `hood` view). Toasts for near misses, crashes and stages. | ✅ |
| S-4 | End screen: completed or wrecked, score, 1–5 stars, distance, top speed, near misses, crashes. | ✅ |
| S-5 | The 5 best scores per `length` are kept on the device (localStorage, keys prefixed `the-driver.`) and shown on the title and end screens. Storage failures never break the game; when scores cannot be kept, the end screen says so. Runs with `debug` on are not recorded. | ✅ |

### 3.5 Controls and platforms
| ID | Requirement | Status |
|----|-------------|--------|
| K-1 | Desktop: ←/→ or A/D steer, ↑/W gas, ↓/S or Space brake, P / Esc pause. | ✅ |
| K-2 | Touch: ◀ ▶ buttons bottom left, BRAKE and GAS pedals bottom right, a ⏸ button; multi-touch (steer and a pedal at the same time). Shown automatically on touch devices (flag `touch`: auto/on/off); key hints hidden on touch. | 🚧 |
| K-3 | No page scroll, zoom or text selection while playing; works in landscape and portrait (portrait shows a narrower view). Losing focus or hiding the page pauses the game. | 🚧 |

### 3.6 Presentation and platform
| ID | Requirement | Status |
|----|-------------|--------|
| V-1 | First-person pseudo-3D road in Canvas 2D (D2), no image files: sky, hills, grass, rumble strips, lane marks, roadside scenery per stage, procedural cars seen from behind (and from the front when oncoming). Crisp on high-DPI screens, 60 fps on a mid-range phone. | 🚧 |
| V-2 | Cockpit (flag `view`: `cockpit` default, `hood` for a lower dashboard and more road): windscreen frame, dashboard with a speedometer, a steering wheel that turns with the steering, a rear-view mirror showing the cars behind. | ✅ |
| V-3 | Short WebAudio sounds (kit `audio.js`): engine putt whose rate follows the speed, near miss, crash, stage, rumble, finish (flag `sound`). | 🚧 |
| V-4 | English and Swedish: EN / SV switch on the title screen, `?lang=` from the launcher, the kit's language rules. | ✅ |
| V-5 | The title screen has a "Back to games" link to `../../?lang=<current language>` (root T-5). The page shell follows the shared shape (root T-4); with `debug` on the state is on `window.__game`. | ✅ |
| V-6 | Pure game logic (no DOM) in modules tested with `node --test`; the browser modules are listed in `package.json`; root conventions check passes. | ✅ |
| V-7 | A balance bot (`tools/sim.mjs`) drives with several strategies (idle, sloppy, good) over many seeds; tuning keeps idle play at 1 star and good play at 4–5 stars on normal; `tests/balance.test.js` guards it on fixed seeds. | ✅ |

### 3.8 Status notes
- **Browser layer built (D15..D18) and driven in headless Google Chrome (D19 lists what was and was not checked).** ✅ rows
  were seen working there: PR-1..PR-3 (a first-person drive through the windscreen), G-2 (afternoon, sunset and night
  looks with their toasts, scenery and lights), G-4 (highway and country road with oncoming cars), C-1 (110 km/h cruise, gas,
  brake and a full stop with `pedals=manual`), S-3 (HUD chips, toasts, the speed chip in `view=hood`), S-4 (completed and
  wrecked end screens), S-5 (a real, non-debug 60 s drive stored and listed; a debug run says it is not saved),
  K-1 (←/→, A/D, ↑, Space, P and Esc by real key events), V-2 (dial and digital speed, the wheel turning with the steering,
  the mirror with cars behind, `view=hood`), V-4 (EN and SV, back link follows the language), V-5 (`window.__game` only with
  debug), at 1280x800, 390x844 (DPR 2, touch) and 844x390.
- **Still 🚧:** V-1 (60 fps on a mid-range phone is unmeasured; headless Chrome ran at 46-60 fps), V-3 (the sounds are
  called without errors, nobody listened), K-2 (multi-touch steer + gas, sliding between ◀ and ▶, brake and the pause
  button by emulated touch events, not a real finger or phone), K-3 (pause on blur and on hidden by dispatched events; no real
  focus loss, no real iOS or Android), TR-1 (headless Chrome only), PR-4 and G-1 (a 60 s drive in real time and a 180 s drive
  through `window.__game.steps`; the full 3 minutes in real time were not watched), PR-5 (the launcher card was not opened).
- C-2 `steer=lanes`, C-3 (the rumble shake, the barrier scrape sound), S-1 (the crash shake and sound) and the traffic rows
  are unit-tested logic; the renderer showed their effects in the screenshots but each was not exercised by hand.
- **Independent verification (D20)** in headless Chrome 158: PR-4 and G-1 (a real 3-minute drive without debug, by key
  events, ended on "You made it home" after 180 s of play plus a 10 s pause that held the clock, and stored its score),
  PR-5 (the fifth card in EN and SV opens the game with `?lang=`), C-2 (`steer=lanes` taps by real key events: one lane
  per tap, none for auto-repeat or while paused, also at 4×), S-1 (shake, speed loss, steering lock, `crash=hard` wrecked),
  S-2 (near misses and the x2 multiplier chip), every flag in `docs/FLAGS.md`. Still 🚧 after D20: C-3 (the rumble shake
  and sound were not judged), the traffic rows TF-1..TF-4 (unit tests and a 60-drive Node probe: no car ever appeared
  within 250 m ahead or 60 m behind; not exercised by hand in Chrome), G-3, V-1, V-3, K-2, K-3, TR-1 (as above).

## 4. Out of scope (for now)
- Offline play / service worker and install as an app (same as the siblings; root `docs/STREAMLINING.md` S-17).
- Tilt steering, gamepad, a steering wheel controller.
- Real roads, places, car makes; multiplayer.
