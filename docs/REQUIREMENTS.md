# Side Quest — Requirements

> **Living document.** Every change to gameplay, controls, tech, or flags MUST update this file
> in the same commit. See `CLAUDE.md`. Requirement IDs are stable; never reuse a retired ID.

Status legend: ✅ implemented and verified · 🚧 implemented but not (fully) verified, or in progress · 📋 planned · ❌ retired

Last verification pass: 2026-11-08 (D-14): `npm test`, headless Chrome screenshots (title, play, hidden, warning,
paused, won, lost, debug, DPR 2), trusted key input via the DevTools protocol, and a path-planning bot over flag combos.

## 1. Product vision

A small, single-player, browser-based comedy game. A homeowner wants a quiet day of garden
chores. His wife keeps handing him "side quests". The player must finish the garden chores
before sunset while completing — or sneakily avoiding — the side quests.

## 2. Product requirements (from the owner)

| ID | Requirement | Status |
|----|-------------|--------|
| PR-1 | Game is called **"Side Quest"**, single player. | ✅ |
| PR-2 | Protagonist is a homeowner doing garden chores (raking leaves, trimming bushes, etc.). | ✅ |
| PR-3 | The wife throws side quests at the protagonist. | ✅ |
| PR-4 | Player must finish their chores while completing **or avoiding** side quests. | ✅ |

## 3. Technical requirements (from the owner)

| ID | Requirement | Status |
|----|-------------|--------|
| TR-1 | Runs in any modern evergreen browser; primary test target is Chrome. | 🚧 Verified in Chrome (headless, real-time key input). Firefox/Safari not tested. |
| TR-2 | Minimise dependencies. (Decision D-1: zero runtime and zero dev dependencies.) | ✅ |

## 4. Process requirements (from the owner)

| ID | Requirement |
|----|-------------|
| PROC-1 | When several reasonable solutions exist, pick one or implement several behind a feature flag. |
| PROC-2 | Always document assumptions and decisions (`docs/DECISIONS.md`). |
| PROC-3 | Keep this requirements document up to date — enforced via `CLAUDE.md`. |
| PROC-4 | Iterate fast, commit to git often. |
| PROC-5 | Model usage: Opus for planning/hard problems/verification, Sonnet for implementation, Haiku for doc lookups. |
| PROC-6 | Do not ask the owner questions; make and document reasonable assumptions. |

## 5. Gameplay requirements (derived — see DECISIONS.md for rationale)

### 5.1 Core loop
| ID | Requirement | Status |
|----|-------------|--------|
| G-1 | Top-down 2D garden viewed on a single screen (logical 960×540, scaled to fit). | ✅ |
| G-2 | Player walks with WASD / arrow keys. Holding **Space** (or **E**) next to a task works on it. | ✅ |
| G-3 | A day lasts a fixed time (default 180 s real time, flag `dayLength`), shown as a clock from 09:00 to 18:00 (sunset); the HUD uses 12-hour format (9:00 AM – 6:00 PM). | ✅ |
| G-4 | **Win**: all chores completed before sunset. **Lose**: sunset with chores left, or Harmony reaches 0. | ✅ |
| G-5 | End screen shows outcome, chores done, quests completed/failed/avoided, Harmony, and a score. | ✅ |
| G-6 | Pause with **P** / **Esc** (also auto-pauses on window blur or when the tab is hidden); restart with **R** on the end screen. Title screen: press Space/Enter to start. | ✅ |
| G-7 | Game keys don't scroll the page (preventDefault on arrows/Space etc.). Keys pressed with Cmd/Ctrl/Alt are ignored so browser shortcuts (reload, close tab) still work; held keys are released on window blur and on Meta keyup (D-11). | ✅ |

### 5.2 Chores (main tasks)
| ID | Requirement | Status |
|----|-------------|--------|
| C-1 | Chore types: **Rake leaves** (leaf piles), **Trim bush**, **Mow lawn patch**, **Water flowers**. | ✅ |
| C-2 | Each chore instance has a position and a work time; progress accumulates while the player holds the action key in range, and is kept if interrupted. | ✅ |
| C-3 | Default day has 8 chores (2 of each type). Work times: rake 11 s, trim 13 s, mow 15 s, water 10 s (scaled by difficulty); total work+walking targets ~60–70% of `dayLength`. | ✅ |
| C-4 | Chore progress is shown as a ring/bar above the chore; completed chores change appearance. | ✅ |

### 5.3 The wife and side quests
| ID | Requirement | Status |
|----|-------------|--------|
| W-1 | The wife lives in the house. Periodically (flag `questInterval`) she comes out after a warning: with `wifeRoam` (default, vision mode) she roams the garden (W-12); otherwise she steps onto the patio and looks around. | ✅ |
| W-2 | Quest-giving mode is selected by flag `wifeMode` (see FLAGS.md): `vision` (default) — she gives a quest only if she **sees** the player (vision cone of length `visionRange`, default 320 px, blocked by the shed and hedges); `random` — she calls out a quest on a timer regardless of where the player is. | ✅ |
| W-3 | At most `maxActiveQuests` (default 2) side quests active at once. | ✅ |
| W-4 | Side quest types are fetch/deliver errands: pick up an item at a spot, deliver it to a spot (often the wife/house door). Examples: groceries from the car, glasses from the garden bench, trash bins to the curb, the cat from the tree, the mail from the mailbox. | ✅ |
| W-5 | Each side quest has a deadline. Completing it raises Harmony; letting it expire lowers Harmony more. | ✅ |
| W-6 | **Avoiding** a quest = never getting it: staying out of her sight (vision mode). Each wife appearance that ends without spotting the player counts as an "avoided" quest for the end-screen stat — only if she could have given a quest (cap not full, D-12). | ✅ |
| W-7 | Player can carry only one quest item at a time. Carrying an item does not block chores. | ✅ |
| W-8 | **Harmony** meter 0–100, starts at 60. +15 per completed quest, −20 per expired quest, slow decay of −1 per in-game hour while any quest is active. | ✅ |

### 5.4 Presentation
| ID | Requirement | Status |
|----|-------------|--------|
| P-1 | All art is procedural canvas drawing (no image assets). | ✅ |
| P-2 | HUD: clock, Harmony meter, chore count, active quest list with countdown. | ✅ |
| P-3 | Wife's quest is shown as a speech bubble; her vision cone (walking with her when roaming) is drawn faintly when she is out (flag `showVisionCone`), clipped by sight blockers so it matches what she can actually see (D-10). | ✅ |
| P-4 | Simple WebAudio blips for events (flag `sound`, default on). No audio files. | 🚧 Code-reviewed only: the AudioContext is created in the first keydown/pointerdown handler and `sound=0` disables it. Not listened to (headless). |
| P-5 | Arrow/position indicator toward the current quest target. | ✅ |

### 5.5 Implementation notes (added with first implementation)
| ID | Requirement | Status |
|----|-------------|--------|
| W-9 | The wife gives a ~1.5 s warning before appearing (door rattles, blinking "!") so the player can avoid her. After spotting the player she stays ≥3 s with a speech bubble. | ✅ |
| W-10 | Sight blockers: shed, hedges, tree trunk. Car and bench do not block sight. | ✅ |
| W-11 | In `random` mode no "avoided" stat is counted (quests cannot be dodged). | ✅ |
| W-12 | **Roaming** (flag `wifeRoam`, default on, vision mode only; D-15): after the warning she walks at 90 px/s (player 150) along a random one of 6 clear routes into the garden, sweeps the cone for 4 s at the end, then retraces the route home. The cone faces her direction of motion while she walks and sweeps while she stands. Spotting the player stops her for ≥3 s (bubble), then she walks home. A player who ignores her is spotted ~3.2×/day (patio-only: ~2.3); hiding stays possible from every chore. Rendered with a bobbing walk. Off = the patio behaviour of W-1. | ✅ Unit-tested (route reached and returned, cone direction, speed, spotted/linger, flag off, hiding reachability); numbers from a throwaway bot, see D-15. |
| Q-1 | Quest interaction is instant while holding the action key within 40 px of a pickup/drop; quest spots win over chores. | ✅ |
| Q-2 | Debug overlay (flag `debug`): obstacle boxes, interact range, FPS, wife/player state. | ✅ |

### 5.6 Mobile / touch (added 2026-11-08, D-17)
| ID | Requirement | Status |
|----|-------------|--------|
| M-1 | Playable on phones and tablets (iOS Safari, Android Chrome) with touch only. Keyboard play is unchanged. | 📋 |
| M-2 | Touch controls appear when flag `touch` = `auto` (default: on if the device reports touch / a coarse pointer, or on the first touch), `on` (always), or `off` (never). | 📋 |
| M-3 | Control scheme flag `touchScheme`: `joystick` (default) — a floating virtual stick appears wherever the thumb lands on the left half of the screen, and a large hold-to-work **action button** sits bottom-right; `tap` — tap/drag anywhere on the game to walk toward that point (straight line, sliding along obstacles), and hold a finger on/near a chore or quest spot to work on it. | 🚧 pure logic + flags done (touchmath.js, analog movement); UI pending |
| M-4 | Multi-touch: steering and the action button work at the same time (two thumbs). | 📋 |
| M-5 | Tap to start on the title screen and tap to restart on the end screen; an on-screen **pause button** (top-right) pauses and resumes. | 📋 |
| M-6 | No page scroll, pinch-zoom, double-tap zoom, text selection, long-press callout or pull-to-refresh while playing. Layout uses the dynamic viewport and respects safe-area insets (notch, home bar). | 📋 |
| M-7 | Landscape fills the screen (letterboxed 16:9). In portrait the game sits at the top and the controls use the free space below; a dismissible "rotate for a bigger view" hint is shown. | 📋 |
| M-8 | On-screen text adapts to the input: touch players see touch instructions (title screen, hint line, end screen "tap to play again"). | 📋 |
| M-9 | Sound unlocks on the first touch (iOS needs a user gesture). | 📋 |
| M-10 | Can be added to the home screen and launched full-screen (web app manifest + Apple meta tags, inline/data-URI icon; no extra assets beyond one small manifest file). | 📋 |

## 6. Non-functional
| ID | Requirement | Status |
|----|-------------|--------|
| NF-1 | No build step. Serve the folder statically (`python3 -m http.server`) and open in Chrome. | ✅ |
| NF-2 | Game logic is DOM-free and unit-tested with Node's built-in test runner (`node --test`). | ✅ |
| NF-3 | 60 fps target; fixed-timestep simulation (1/60 s) independent of frame rate; frame dt clamped to [0, 0.25 s]. Canvas re-sizes on window resize and on devicePixelRatio change (D-13). | ✅ |
| NF-4 | Deterministic seeded RNG (flag `seed`) so runs are reproducible. | ✅ |
| NF-5 | Published on GitHub Pages at https://maredv.github.io/side-quest/ straight from `main` (repo root, no build/CI). Flags work via the URL query there too. | ✅ |

## 7. Out of scope (for now)
- Gamepad, haptics, orientation lock, multiple levels/days, save games, localisation, multiplayer.
