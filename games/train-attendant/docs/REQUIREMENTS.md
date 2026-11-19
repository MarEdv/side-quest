# Train Attendant — Requirements

> **Living document.** Every change to gameplay, controls, flags, tech or scope updates this file **in the same commit**
> (see `../CLAUDE.md`). IDs are stable; retire rows with ❌ instead of deleting or reusing them.
> Status legend: ✅ implemented and verified · 🚧 implemented but not (fully) verified, or in progress · 📋 planned · ❌ retired

## 1. Vision
A small single-player browser game. You are the attendant on a passenger train. Walk the aisle, check tickets, serve
coffee and snacks and keep the passengers calm from the first station to the last, while the train manager radios you
side quests: pick up the passengers of a broken-down train, calm a panicking traveller, save someone's connection,
find a lost bag, help a sick passenger.

## 2. Owner requirements
| ID | Requirement | Status |
|----|-------------|--------|
| PR-1 | Game called **"Train Attendant"**, one player. | 📋 |
| PR-2 | The player is a train attendant who manages a train full of passengers. | 📋 |
| PR-3 | The player is given side quests during the trip, such as saving passengers from another broken-down train, handling stressed passengers and managing connections for passengers. | 📋 |
| PR-4 | Listed side by side with the existing games in the Side Quest Project launcher. | 📋 |
| TR-1 | Runs in any modern browser; tested in Chrome. | 📋 |
| TR-2 | Minimal dependencies (D1: none). | 📋 |

Process rules from the owner (apply to all work): implement several reasonable options behind flags or pick one; document
assumptions and decisions (`DECISIONS.md`); keep this file current; iterate fast and commit often; Opus plans and verifies,
Sonnet implements, Haiku looks up docs; never ask the owner questions.

## 3. Functional requirements

### 3.1 Train and trip
| ID | Requirement | Status |
|----|-------------|--------|
| T-1 | The train is seen from above: a cab at the front (right), then passenger cars with a café car in the middle. Default 3 passenger cars + café (flag `cars`: 2/3/4 passenger cars). Each passenger car has 5 seat rows of 4 seats (2 each side of the aisle) and a vestibule with standing room at each end. | 📋 |
| T-2 | A trip runs through a route of fictional stations (flag `trip`: `short` 4 stations, `normal` 6, `long` 8). The train travels between stations (`short` 45 s, `normal` 60 s, `long` 70 s of game time per leg) and dwells 8 s at each station. The trip ends on arrival at the last station. | 📋 |
| T-3 | At each station passengers whose destination it is leave and new passengers board; boarders take a free seat, or stand in a vestibule when the train is full. Standing passengers get stressed faster. | 📋 |
| T-4 | The train has a **delay** (seconds late), shown in the HUD. Side quests can add delay (a rescue stop); each station dwell wins back up to 5 s. Delay makes every passenger a little more stressed and decides whether a connection can be held (Q-3). | 📋 |
| T-5 | Outside the windows the landscape scrolls while the train moves; a platform with the station name appears at stations. | 📋 |

### 3.2 Passengers
| ID | Requirement | Status |
|----|-------------|--------|
| P-1 | Each passenger has a seat (or a standing spot), a destination station, a **stress** level 0–100 shown by colour (green → amber → red), and at most one **need** shown as a bubble icon. | 📋 |
| P-2 | Needs: 🎫 **ticket** (every boarder, once, soon after boarding), ☕ **coffee** and 🥪 **snack** (bring the item from the café counter), ❓ **question** (answer by holding the action). An unmet need raises stress; meeting it lowers stress and scores points. | 📋 |
| P-3 | A passenger whose stress reaches 100 files a **complaint** (score penalty, shown in the HUD); their stress drops back to 60 and the need stays. | 📋 |
| P-4 | Stress model (flag `stress`): `solo` (default, each passenger on their own) or `contagious` (very stressed passengers raise the stress of their neighbours in the same car). | 📋 |
| P-5 | A passenger who leaves the train calm (stress under 30) scores a small bonus; one who leaves with an unchecked ticket loses the fare. | 📋 |

### 3.3 The attendant
| ID | Requirement | Status |
|----|-------------|--------|
| A-1 | The attendant walks along the aisle through the whole train (doors between cars open automatically). The camera follows; a **train strip** at the top of the screen shows every car, the attendant and a dot per open need, so the player knows where to go. | 📋 |
| A-2 | The action serves the most urgent passenger in reach: checks a ticket (hold 0.6 s), answers a question (hold 1.2 s), hands over a carried coffee or snack (instant) or quest item. A progress ring shows a hold. | 📋 |
| A-3 | The attendant carries at most one item. At the **café counter** the action opens a small picker (☕ coffee, 🥪 snack, 💧 water; or put the item back) without pausing the game. | 📋 |
| A-4 | The attendant can **lead** passengers: the action on a passenger who needs a seat makes them follow; the action at a row with a free seat seats the first follower there. Up to 4 followers at once. | 📋 |

### 3.4 Side quests
| ID | Requirement | Status |
|----|-------------|--------|
| Q-1 | The train manager radios a side-quest **offer** every 30–45 s of travel (seeded). Flag `quests`: `offer` (default; Accept / Decline, an ignored offer expires after 15 s) or `assign` (every offer is accepted automatically). At most 2 quests are active at once; no offer arrives while 2 are active. Active quests are listed in the HUD with their goal and deadline. | 📋 |
| Q-2 | **Rescue** 🚨: a train has broken down ahead. If accepted, the train stops beside it in the middle of the next leg for 10 s (+20 s delay); 6–10 stranded passengers (stress 60) board through the front vestibule. Goal: lead every rescued passenger to a seat before the next station. They have no ticket to check. | 📋 |
| Q-3 | **Connection** 🔁: a named passenger must catch a connection at a station 1–3 stops ahead. Goal, before that station: radio the connection from the **cab** (hold 1.5 s) and then tell the passenger the platform (action). If the train is more than 45 s late when you radio, the connection is gone and the passenger is rebooked (half reward). | 📋 |
| Q-4 | **Nervous passenger** 😰: a named passenger panics (stress 80, rising 3× as fast). Goal: talk to them 3 times (hold 1.5 s each, at least 6 s apart) before their stress reaches 100 or they reach their station; bringing them 💧 water counts as one talk. | 📋 |
| Q-5 | **Lost bag** 🧳: a named passenger lost a bag somewhere on the train. The bag lies in a random spot (seen only when the attendant is in that car). Goal: pick it up and hand it over before the owner's station. | 📋 |
| Q-6 | **Sick passenger** 🤒: fetch the first-aid kit 🩹 from the cab and bring it to the passenger within 45 s. | 📋 |
| Q-7 | A completed quest scores its reward and calms the passengers involved; a failed one (deadline passed, passenger left, complaint for a nervous passenger) costs points. Declining costs nothing. | 📋 |

### 3.5 Score and end of trip
| ID | Requirement | Status |
|----|-------------|--------|
| S-1 | Points: tickets, served needs, quest rewards, calm arrivals; minus complaints, lost fares and failed quests. The HUD shows the score, the next station with its countdown, the delay and the complaints. | 📋 |
| S-2 | End of trip screen: score, a 1–5 star rating, passengers carried, share of calm arrivals, complaints, quests done / failed / declined. | 📋 |
| S-3 | The 5 best scores per trip length are kept on the device (localStorage, keys prefixed `train-attendant.`) and shown on the title and end screens. Storage failures never break the game. Runs with `debug` on are not recorded. | 📋 |
| S-4 | No fail state: a trip always reaches the last station. | 📋 |
| S-5 | Difficulty (flag `difficulty`: `easy`/`normal`/`hard`) scales how many passengers board, how often needs appear and how fast stress rises. | 📋 |

### 3.6 Controls and platforms
| ID | Requirement | Status |
|----|-------------|--------|
| C-1 | Desktop: ←/→ or A/D walk, **Space** / **E** action (hold for timed actions), **1/2/3** pick at the café (0 or Backspace puts the item back), **Y**/**N** accept / decline an offer, **P** / Esc pause. | 📋 |
| C-2 | Touch: ◀ ▶ buttons bottom left, a large action button bottom right (hold works), on-screen Accept / Decline and café buttons, a pause button. Shown automatically on touch devices (flag `touch`: auto/on/off). Multi-touch: walking and the action at the same time. | 📋 |
| C-3 | No page scroll, zoom or text selection while playing; works in landscape and portrait (portrait shows a shorter slice of the train). Losing focus or hiding the page pauses the game. | 📋 |

### 3.7 Presentation and platform
| ID | Requirement | Status |
|----|-------------|--------|
| V-1 | Procedural Canvas 2D graphics, no image files: cars, seats, passengers coloured by stress, need bubbles (emoji), the attendant in a cap; crisp on high-DPI screens. | 📋 |
| V-2 | Short WebAudio sounds (kit `audio.js`): served, complaint, radio offer, station chime, quest done, quest failed (flag `sound`). | 📋 |
| V-3 | English and Swedish: EN / SV switch on the title screen, `?lang=` from the launcher, the kit's language rules (`kit/lang.js`, `kit/langdom.js`). Station names stay as they are. | 📋 |
| V-4 | The title screen has a "Back to games" link to `../../?lang=<current language>` (root T-5). The page shell follows the shared shape (root T-4); with `debug` on the state is on `window.__game`. | 📋 |
| V-5 | Pure game logic (no DOM) in modules tested with `node --test`; the browser modules are listed in `package.json`; root conventions check passes. | 📋 |
| V-6 | A balance bot (`tools/sim.mjs`) plays trips with several strategies (idle, sloppy, good) over many seeds; the tuning keeps idle play at 1 star and good play at 4–5 stars. | 📋 |

## 4. Out of scope (for now)
- Offline play / service worker and install as an app (same as Gem Miner and Poo Sandwich; root `docs/STREAMLINING.md` S-17).
- Saving a trip in progress (a trip lasts about 4–9 minutes).
- Real railway networks, timetables or station names.
