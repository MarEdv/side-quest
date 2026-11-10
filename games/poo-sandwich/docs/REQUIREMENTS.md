# Poo Sandwich — Requirements

> Living document. **Must be updated in the same commit as any change to behaviour, scope, controls, flags or tech.**
> Status legend: ✅ done · 🚧 in progress · ⏳ planned

## 1. Vision

A very simple, single-player, comedic browser game. You are an ordinary office
worker trying to get through your work day. Your boss keeps throwing
(metaphorical) *poo sandwiches* at you — unpleasant surprise assignments. You
must finish your own tasks while either dodging the sandwiches or taking them on
and solving them.

## 2. Functional requirements

### 2.1 Core loop
| ID | Requirement | Status |
|----|-------------|--------|
| F1 | One player, one office level seen top-down on a single screen. | ✅ |
| F2 | The work day runs from 09:00 to 17:00, compressed into ~3 minutes of real time (configurable flag). | ✅ |
| F3 | The player has a to-do list of **regular tasks**: get coffee (coffee machine), fetch papers (printer), attend meeting (meeting room), file a report (own desk), etc. A task is completed by standing in the station's zone for a short time (progress ring). | ✅ |
| F4 | New regular tasks are added over the day; at most a handful are active at once. | ✅ |
| F5 | The **boss** wanders the office and periodically throws a **poo sandwich** projectile toward the player. | ✅ |
| F6 | If the sandwich misses, it splats on the floor and disappears (dodged). | ✅ |
| F7 | If it hits, the player receives a **poo task** (e.g. "Redo the TPS report", "Fix the printer for the CEO") with a deadline, to be solved at a station. See flag `poo` for variants. | ✅ |
| F8 | **Stress** meter 0–100. Rises when poo tasks expire, when regular tasks pile up, and slightly when hit. Drops a little when tasks are completed and when drinking coffee. | ✅ |
| F9 | Game over ("Burnout") when stress reaches 100. Win ("Survived the day") at 17:00. | ✅ |
| F10 | Score: points for regular tasks, more points for solved poo tasks, bonus for low stress at 17:00. Best score stored in `localStorage`. | ✅ |
| F11 | Difficulty ramps during the day (boss throws more often, sandwiches faster). | ✅ |
| F12 | Screens: title / how-to-play, playing, paused, game-over/win summary with restart. | ✅ |

### 2.2 Controls & platforms
| ID | Requirement | Status |
|----|-------------|--------|
| C1 | Desktop: arrow keys / WASD to move, P/Esc to pause. | ✅ |
| C2 | Mobile: touch controls (see flag `controls`). Playable in portrait and landscape. | 🚧 Implemented (joystick, tap-to-move with BFS pathing, portrait/landscape/side layouts); not yet tried on a real device. |
| C3 | Canvas scales to fit the viewport while preserving aspect ratio; no page scroll/zoom while playing. | ✅ |
| C4 | Runs in any modern evergreen browser (Chrome, Firefox, Safari, Edge). Primary test target: Chrome desktop + Chrome mobile emulation. | 🚧 Verified only with desktop headless Chrome screenshots; real touch devices untested. |

### 2.3 Feature flags
Selectable via URL query string (e.g. `?controls=joystick&poo=choice`) and listed in `src/flags.js`. Defaults in **bold**.

| Flag | Values | Meaning |
|------|--------|---------|
| `controls` | **`auto`**, `tap`, `joystick` | `tap`: tap/click a point and the worker walks there. `joystick`: virtual thumb stick. `auto`: joystick on touch devices, keyboard+click-to-move on desktop. |
| `poo` | **`hit`**, `choice` | `hit`: being hit automatically assigns the poo task. `choice`: sandwiches that land stay on the floor briefly; walking over one picks it up (accept = more points), ignoring it is "avoiding" but adds a little stress. Being hit directly still assigns it. |
| `daySeconds` | number, **`180`** | Real-time length of the work day. |
| `debug` | **`0`**, `1` | Show zones, hitboxes, FPS. |

All four flags are implemented (✅) in `src/flags.js`; invalid values fall back to defaults. `daySeconds` accepts 10-3600.

## 3. Non-functional requirements
| ID | Requirement |
|----|-------------|
| N1 | Zero runtime dependencies. Vanilla JS (ES modules), HTML5 Canvas 2D, CSS. No build step. |
| N2 | Dev/test tooling limited to what ships with Node (≥ 20): `node --test` for unit tests of pure logic. |
| N3 | Graphics drawn procedurally (shapes + emoji) — no external asset files required. |
| N4 | 60 fps target on mid-range phones; frame-rate independent updates (delta time). |
| N5 | Deployed to GitHub Pages via GitHub Actions on every push to `main`. |
| N6 | Accessible basics: readable font sizes, pause on tab blur, no flashing. |

## 4. Out of scope (for now)
Sound/music, multiplayer, multiple levels, online leaderboards, i18n.
