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
| G-2 | Player walks with WASD / arrow keys. Holding **Space** (or **E**) next to a task works on it. On touch: virtual stick / tap-to-walk and the WORK button (section 5.6). | ✅ |
| G-3 | A day lasts a fixed time (default 180 s real time, flag `dayLength`), shown as a clock from 09:00 to 18:00 (sunset); the HUD uses 12-hour format (9:00 AM – 6:00 PM). | ✅ |
| G-4 | **Win**: all chores completed before sunset. **Lose**: sunset with chores left, or Harmony reaches 0. | ✅ |
| G-5 | End screen shows outcome, chores done, quests completed/failed/avoided, Harmony, and a score. | ✅ |
| G-6 | Pause with **P** / **Esc** (also auto-pauses on window blur or when the tab is hidden) or the touch pause button; the pause screen has **Resume** and **Quit to menu** buttons. **Main menu** (Play / High scores) replaces the old "press Space to start" title; the garden shows behind it. End screen: **R** or **Play again** restarts, **Menu** goes back to the menu. While any menu is open the game gets no input (D-21). | ✅ |
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
| Q-2 | Debug overlay (flag `debug`): obstacle boxes, interact range, FPS, wife/player state. Debug runs are not put on the high-score board (D-22). | ✅ |

### 5.6 Mobile / touch (added 2026-11-08, D-17)
| ID | Requirement | Status |
|----|-------------|--------|
| M-1 | Playable on phones and tablets (iOS Safari, Android Chrome) with touch only. Keyboard play is unchanged. | ✅ verified in headless Chrome mobile emulation (844x390 and 390x844 at DPR 3, 1024x768 tablet): start, steer, work a chore, pause, sunset, restart; desktop 1280x720 keyboard run unchanged (D-19). 🚧 not tested on a real iOS/Android device |
| M-2 | Touch controls appear when flag `touch` = `auto` (default: on if the device reports touch / a coarse pointer, or on the first touch), `on` (always), or `off` (never). | ✅ verified: `auto` shows no overlay on non-touch desktop 1280x720 (mouse clicks inert) and shows it under touch emulation; `on` on desktop works with mouse pointer events (stick, WORK, pause); `off` on an emulated phone creates no overlay |
| M-3 | Control scheme flag `touchScheme`: `joystick` (default) — a floating virtual stick appears wherever the thumb lands on the left half of the screen, and a large hold-to-work **action button** sits bottom-right; `tap` — tap/drag anywhere on the game to walk toward that point (straight line, sliding along obstacles), and hold a finger on/near a chore or quest spot to work on it. | ✅ both schemes verified in Chrome emulation in landscape and portrait (stick drives the player to a chore; tap-hold near a chore snaps, walks and works it; tap-drag walks) |
| M-4 | Multi-touch: steering and the action button work at the same time (two thumbs). | ✅ verified in landscape, portrait and tablet: stick held + WORK pressed by a second touch point progressed a chore (CDP multi-touch) |
| M-5 | Tap **Play** on the main menu; tap anywhere on the end screen (after the 700 ms guard) or **Play again** / **Menu** to continue; on the pause screen tap anywhere, **Resume**, or the on-screen **pause button** (top-right in landscape, right-aligned just below the game in portrait so it never covers the HUD's quest countdowns, D-19). Menu buttons are 48 px tall and respect safe areas; the stick / WORK overlay is hidden on the menu and never covers menu buttons (D-21). | ✅ verified in the browser (390x844 and 844x390 emulation): Play, pause button, Resume, tap-to-resume, end-screen guard, tap-to-restart, Play again, Menu, High scores, Back; earlier portrait pause-button placement unit-tested |
| M-6 | No page scroll, pinch-zoom, double-tap zoom, text selection, long-press callout or pull-to-refresh while playing. Layout uses the dynamic viewport and respects safe-area insets (notch, home bar). | ✅ in place and code-reviewed: `touch-action: none` on html/body and the overlay (it applies to every descendant, including the rotate ✕), `overscroll-behavior: none`, no select/callout, 100dvh, safe-area padding + probe; plus, while touch controls are shown, `gesturestart/change/end` and `touchmove` are preventDefault-ed for iOS Safari (D-19). No console interventions in Chrome. 🚧 pinch, double-tap and pull-to-refresh not tried on a real device |
| M-7 | Landscape fills the screen (letterboxed 16:9). In portrait the game sits at the top and the controls use the free space below; a dismissible "rotate for a bigger view" hint is shown. Rotating mid-game re-lays out and drops held pointers (they'd keep a stale origin). Only the hint's ✕ takes touches; taps on its text reach the game (D-19). | ✅ verified in both orientations (screenshots); rotate hint dismisses; landscape↔portrait mid-game with a held stick re-lays out without a runaway player or stuck input. 🚧 a phone exactly 16:9 in landscape (no side letterbox) gets the corner pause button over the HUD's top-right corner |
| M-8 | On-screen text adapts to the input: touch players see touch instructions (menu controls line, hint line, "Tap to resume"); keyboard players see key hints ("Play again (R)"). | ✅ verified in screenshots (menu controls line in both orientations, "Tap to resume", end buttons); desktop keeps the keyboard texts |
| M-9 | Sound unlocks on the first touch (iOS needs a user gesture). | 🚧 `audio.unlock()` runs synchronously inside the window `pointerdown`, `pointerup` and `touchend` handlers (pointerup/touchend are the activation events for touch) and also resumes an iOS `interrupted` context (D-19). Not audible headless; not tried on real iOS |
| M-10 | Can be added to the home screen and launched full-screen (web app manifest + Apple meta tags, real PNG icons in `icons/`, service worker; no build step, no dependencies). | ✅ web app manifest (`id`, relative `start_url`/`scope`, real PNG icons 192/512 `any` + 512 `maskable`, generated by `tools/make-icons.mjs`), Apple meta tags and a real 180px PNG `apple-touch-icon` (the runtime canvas icon is gone), plus a service worker `sw.js` (D-25; reviewed and fixed in D-26, rollback = `tools/sw-kill.js`). Chrome parses the manifest with no errors under `/side-quest/` and reports no installability errors (headless CDP, D-25). Unit tests check the icon PNG sizes and the manifest. 🚧 install / home-screen launch not tested on a device |

### 5.7 Menus, settings, high scores, levels, install (added 2026-11-08, D-20)
Owner request: "add, one by one: high score on local device; settings with all play modes now configured through
query params; ask player to install as app on mobile device; add 4 more levels by mixing the existing play modes,
ensure gradually increased difficulty; keep the current play mode as an 'arcade play mode'". Built in that order (levels + arcade together).

**Feature 1 — High scores (local device)**
| ID | Requirement | Status |
|----|-------------|--------|
| HS-1 | Scores are saved in `localStorage` on this device only (no server, no account). Storage failures (private mode, quota) never break the game. | ✅ `storage.js` wraps every access (and even the capability check) in try/catch with an in-memory fallback; after a failed write, this session's writes/removals win but untouched keys are still read from the backend (D-22); `main.js` guards reading `window.localStorage`. Unit-tested (throwing, write-only-failing, hostile backends). Verified in headless Chrome with `setItem` throwing and with the `localStorage` getter throwing (both injected before page scripts): the game plays, the day records in memory, the scores screen says storage is blocked, no console errors. Garbage JSON and foreign entries load as an empty / cleaned table. Scores survive a reload. 🚧 not tried in a real private-mode browser |
| HS-2 | Arcade keeps a top-10 table: score, outcome (won/lost), date, and a short settings summary (e.g. "vision·roam·normal"). | ✅ unit-tested (ordering, truncation to 10, ties: earlier entry ranks higher, corrupt-data recovery); recorded once per finished day (playing → won/lost only; not on quit from pause, restart, re-render, nor with `debug=1`, D-22). Full 10-row table verified at 1280x720, 844x390 (touch-scrolls, sticky header), 375x560 and 390x844; stored strings rendered as text (an `<img onerror>` summary shows as text). Summary from `settingsSummary()`: `vision·roam·normal`, `vision·patio·hard`, `random·easy` |
| HS-3 | Each level keeps its best score and whether it has been won (feeds level unlocking, L-3). | ✅ logic only: `recordLevel` / `level` keep `{best, won}` (won is sticky), unit-tested; unused by the UI until levels exist (L-*) |
| HS-4 | End screen shows "New high score!" / the rank achieved and the current best. A High scores screen lists them, with a "Clear scores" action that asks for confirmation inside the page. | ✅ verified in headless Chrome (desktop keyboard + 390x844 / 844x390 touch emulation, D-21): end screen banner ("New high score!" / "#3 on your board" plus "Best: N"), High scores table (rank, score, outcome, locale date, mode), Clear scores with an in-page confirmation (Esc cancels), Back / Esc. "Clear scores" also wipes level records. End panel never covers the canvas stats (checked 844x390, 390x844, 1280x720). A key held from the game (Space = WORK) no longer activates the focused Play again by auto-repeat (D-22). Debug runs show "Debug run: not recorded" |
| HS-5 | No name entry (single-player, one device). Data is versioned (`sidequest.v1.*`) so later formats can migrate. | ✅ no name entry; keys `sidequest.v1.scores` / `sidequest.v1.progress`, each value `{v: 1, ...}` |

**Feature 2 — Settings screen**
| ID | Requirement | Status |
|----|-------------|--------|
| S-1 | A Settings screen exposes **every** flag in FLAGS.md, grouped: Gameplay (arcade only), Controls, Display & sound, Advanced (seed, debug). Each shows a one-line explanation. | ✅ `src/settingsui.js` + `src/settings.js`: all 13 flags have a control (selects: wifeMode, difficulty, touch, touchScheme; toggles: wifeRoam, showVisionCone, sound, debug; number inputs with the config.js clamps: dayLength, maxActiveQuests, questInterval, visionRange; seed: "random" or a whole number), in groups Gameplay / Controls / Display & sound / Advanced, each with the FLAGS.md one-liner. Options that do not matter right now (wifeRoam and visionRange outside vision mode, touchScheme with touch off) are disabled with a reason, not hidden. Unit test asserts one control per flag. Verified in headless Chrome (1280x720, 390x844). Seed is grouped under Advanced, so Gameplay is the 7 other gameplay flags (D-23). D-24: a test also checks each control kind against the flag type and that FLAGS.md lists exactly the `DEFAULT_FLAGS`; re-verified at 844x390 touch |
| S-2 | Settings persist in `localStorage`. Precedence: URL query param > saved setting > default. A flag forced by the URL is shown as locked with a note, so links like `?wifeMode=random` keep working. | ✅ saved to `sidequest.v1.settings` as `{v: 1, flags: {...only the player's choices}}`; pure `resolveFlags(defaults, saved, urlQuery)` gives URL > saved > default and the locked set; saved values are sanitised by the same `parseFlagValue` as the URL parser. A URL-forced flag is shown disabled with "Set by link (?wifeMode=random)"; "Clear link overrides" reloads without the query string. Unit-tested (precedence, locking, bad saved values, storage round trip, seed number / "random" round trip) and verified in the browser: choices survive a reload, `?wifeMode=vision` shows locked and is effective. D-24: "Clear link overrides" keeps the `/side-quest/` path and hash; script-bearing URL / stored values are ignored, not shown, never executed |
| S-3 | "Reset to defaults" action. Changing a control/display setting applies immediately; gameplay settings apply from the next day. | ✅ "Reset to defaults" with an in-page confirmation (Esc cancels); it clears saved choices only (link overrides stay until cleared). Control/display settings apply immediately (sound, vision cone, debug, touch mode and scheme); gameplay settings apply when the next day starts, and the screen says so. Settings is reachable from the pause screen (D-23). The menu's Mode line updates. Verified in the browser incl. a mid-day change from pause: live flags changed only for control settings, gameplay changed after Quit to menu. D-24: a debug mark no longer leaks into an R-restarted day, `window.__state` goes away when debug is switched off; touch off/on and joystick/tap switched from pause while a stick finger is held leave no stuck pointer (player stays put on resume, tap-to-walk works after) |
| S-4 | Fully usable by keyboard (Tab/arrows/Enter/Esc) and touch (large targets). | ✅ keyboard: real `<label>`s, Tab / Shift+Tab cycle, arrows move between buttons and toggles (a select or number field keeps its own arrows), Enter / Space activate, Esc goes back (settings are saved on every change); no game key leaks (typing in a field is never game input; with Settings open over pause Esc does not also resume: this held only when a field had focus until D-24, now `input.js` ignores keys the menu already handled, unit-tested and re-verified with Back focused). Touch: controls 44-48 px tall, the panel scrolls on phones (`.ui-scroll`). Verified at 1280x720 keyboard-only and 390x844 touch; re-verified by real key events (D-24): W/A/S/D, arrows, Space, E typed into Day length move nothing and digits are accepted, Esc leaves and keeps the value, pause > Settings > Esc stays paused, Resume continues the day. 844x390 touch: panel scrolls by touch drag, Back reachable (footer inside the viewport), tapping a select focuses it. 🚧 not tried with a screen reader or on a real device; native select popup not driven headless |

**Feature 3 — Install prompt (mobile)**
| ID | Requirement | Status |
|----|-------------|--------|
| I-1 | On mobile/touch devices not already running as an installed app, the player is invited to install the game. Shown after their first finished day (not on first load), and always available as a menu item. | ✅ `src/installmodel.js` (pure rules, unit-tested) + `src/install.js` / `src/installui.js`: an inline invitation (Install app / Not now / Don't ask again) under the end-screen buttons after the first finished day, at most once per visit, touch devices only, not blocking Play again / R; an "Install app" main-menu button when installable or on iOS. Verified in headless Chrome with mobile + touch emulation at 844x390, 667x375 and 390x844 (stats never covered, D-25). D-26 re-check (844x390, touch, Android UA): invitation after the first day; tapping Not now hid it without restarting the day. 🚧 not tried on a real phone |
| I-2 | Browsers with `beforeinstallprompt` (Chrome/Edge/Samsung on Android): an "Install" button triggers the native prompt. iOS/iPadOS Safari (no API): show illustrated "Share → Add to Home Screen" instructions. Elsewhere: menu item hidden. | ✅ Chrome-family browsers: a stashed `beforeinstallprompt` makes the button call `prompt()` (verified with a fake event; Chrome also fired a real one). iOS / iPadOS (incl. iPad reporting as a Mac with touch points): Install app opens an instruction screen with an inline SVG Share icon, three steps and Back. Other browsers (Firefox Android, desktop Safari/Firefox, Samsung Internet when it does not fire the event): the menu item is hidden, no generic fallback (D-25). 🚧 real iOS / Samsung Internet / Firefox not tested |
| I-3 | "Not now" hides the invitation for 7 days; "Don't ask again" hides it permanently (menu item stays). Never shown when installed (display-mode standalone/fullscreen or `navigator.standalone`). | ✅ state in `sidequest.v1.install` (`finishedDays`, `dismissedUntil`, `neverAsk`, `installed`): Not now = 7 days (boundary unit-tested; a dismissed native prompt counts as Not now), Don't ask again = never (menu item stays), hidden when `navigator.standalone`, display-mode standalone, or display-mode fullscreen **on touch hardware only** (F11 fullscreen on a desktop no longer hides it, D-26; a touch laptop in F11 still does), and after the `appinstalled` event; a snooze more than 7 days ahead (wrong clock) counts as over (D-26). Verified in the browser: Not now survives a reload, simulated standalone shows nothing. 🚧 the fullscreen rule is unit-tested only (headless Chrome cannot emulate display-mode) |
| I-4 | The app meets current installability criteria (manifest with real PNG icons; service worker if needed — see D-21) and works offline once installed. | ✅ manifest + real PNG icons + `sw.js` (network-first, precached shell, versioned cache cleaned on activate); headless Chrome: SW controls the page after a reload, the game loads offline (also with `?query`), `Page.getAppManifest` no errors, `Page.getInstallabilityErrors` empty, and Chrome fired `beforeinstallprompt`. Unit tests: precache list vs `src/*.js` + icons, icon sizes, manifest. D-26 fixes: the page gets `no-cache` copies, so a deploy shows on a same-tab reload (the memory cache used to skip the worker for up to 10 min); offline page loads store and serve one newest index without the query (an older `?x` copy used to shadow it). D-26 browser checks: upgrade from a pre-SW build keeps scores and settings; edit then reload shows at once; cold offline load with a query (Chrome restarted, server down); a deploy that adds a file works offline; kill switch `tools/sw-kill.js` unregisters without a reload loop. `tests/sw.test.js` runs the worker in Node. 🚧 not installed on a real device; gzip not exercised |

**Features 4 & 5 — Levels and Arcade**
| ID | Requirement | Status |
|----|-------------|--------|
| L-1 | Main menu offers **Levels** and **Arcade**. Arcade = the current game, configured by Settings (the "arcade play mode"). | 📋 |
| L-2 | Four levels, each a fixed mix of existing modes with rising difficulty (gameplay settings ignored in levels; control/display settings still apply): **1 "Saturday Morning"** — vision, patio only, easy, 1 quest at a time, relaxed timing. **2 "Honey-Do List"** — random calls (no hiding), normal, 2 quests. **3 "Eyes Everywhere"** — vision + roaming, normal, longer sight, 2 quests, more frequent trips. **4 "The Inspection"** — new `hybrid` mode (she roams with vision *and*, if she doesn't spot you, may call a quest anyway), hard, 3 quests, frequent, shorter day. | 📋 |
| L-3 | Level 1 is unlocked; winning a level unlocks the next. Arcade is always available. | 📋 |
| L-4 | Difficulty increases monotonically L1→L4, verified by a scripted bot: win rate and time slack at sunset must not increase from one level to the next (numbers recorded in DECISIONS). | 📋 |
| L-5 | Level intro card (name + one-line briefing of what's new) before play; end screen offers Next level / Retry / Menu. | 📋 |
| L-6 | `wifeMode=hybrid` is also selectable in Arcade settings (new flag value). | 📋 |

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
