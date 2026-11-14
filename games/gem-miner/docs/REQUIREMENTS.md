# Gem Miner — Requirements

> **Living document.** Every change to gameplay, controls, flags, tech or scope updates this file **in the same commit**
> (see `../CLAUDE.md`). IDs are stable; retire rows with ❌ instead of deleting or reusing them.
> Status: ✅ done & verified · 🚧 partial / unverified (note says what) · 📋 planned · ❌ retired

## 1. Vision
A small single-player browser game. You are a miner searching a big underground world for gems, hoping to find the
**Diamond of Your Dreams**. Better hatchets let you dig through harder rock, and you find them in the mine or buy them
in town with the gems you sell.

## 2. Owner requirements
| ID | Requirement | Status |
|----|-------------|--------|
| PR-1 | Game called **"Gem Miner"**, one player. | 📋 |
| PR-2 | The player is a miner looking for gems in mines, searching for the diamond of their dreams. | 📋 |
| PR-3 | The player can find or buy hatchets made of different materials: wood, stone, steel, gem. | 📋 |
| PR-4 | The world scrolls in all four directions and is rather big. | 📋 |
| PR-5 | Listed side by side with the existing games in the Side Quest Project launcher. | 📋 |
| TR-1 | Runs in any modern browser; tested in Chrome. | 📋 |
| TR-2 | Minimal dependencies (D1: none). | 📋 |

Process rules from the owner (apply to all work): implement several reasonable options behind flags or pick one; document
assumptions and decisions (`DECISIONS.md`); keep this file current; iterate fast and commit often; Opus plans and verifies,
Sonnet implements, Haiku looks up docs; never ask the owner questions.

## 3. Functional requirements

### 3.1 World
| ID | Requirement | Status |
|----|-------------|--------|
| W-1 | Top-down tile world, default **256 × 256 tiles** (flag `worldSize`: 128 / 256 / 512), generated from a seed (flag `seed`), the same every time for the same seed. | 🚧 logic + unit tests done; not yet verified in the browser |
| W-2 | The camera follows the miner and scrolls in all four directions; only visible tiles are drawn. Flag `camera`: `deadzone` (default, the camera only moves when the miner leaves a central box) or `center` (always centred). | 📋 |
| W-3 | The **town** (surface camp with the shop and the start point) sits at the centre of the world. Rock gets harder and gems rarer and more valuable with distance from town, in rings: **dirt → stone → granite → obsidian**. The world edge is unbreakable bedrock. | 🚧 logic + unit tests done; not yet verified in the browser |
| W-4 | Gems embedded in rock: quartz, amethyst, topaz, emerald, sapphire, ruby, diamond (rarest), with value and rarity rising in that order and deeper rings favouring better gems. | 🚧 logic + unit tests done; not yet verified in the browser |
| W-5 | Exactly one **Diamond of Your Dreams** is placed in a sealed obsidian chamber in the outer ring, far from town. | 🚧 logic + unit tests done; not yet verified in the browser |
| W-6 | **Treasure chests** are scattered through the mine. Some guarantee a hatchet (one stone hatchet within the dirt ring near town, one steel hatchet in the stone/granite rings); others hold coins or gems. | 🚧 logic + unit tests done; not yet verified in the browser |
| W-7 | Fog of war (flag `fog`, default on): unexplored tiles are dark; the miner's lamp reveals a radius around them, and revealed tiles stay visible. | 📋 |
| W-8 | A minimap (toggle **M** / minimap button) shows the explored area, town, and the miner's position. | 📋 |

### 3.2 Mining and hatchets
| ID | Requirement | Status |
|----|-------------|--------|
| M-1 | Movement is tile-based. Pushing toward an open tile walks there; pushing toward rock mines it. Holding the direction keeps mining; mining time depends on rock hardness and hatchet power. | 🚧 logic + unit tests done; not yet verified in the browser |
| M-2 | Hatchets: **Wood** (dirt, stone), **Stone** (+granite), **Steel** (+obsidian), **Gem** (fastest; the only one that cuts the dream chamber's crystal wall). Each tier digs faster than the previous one. | 🚧 logic + unit tests done; not yet verified in the browser |
| M-3 | Rock harder than the current hatchet can cut shows a "too hard" hint and can't be mined. | 🚧 logic + unit tests done; not yet verified in the browser |
| M-4 | The player owns a set of hatchets and always uses the best one (no manual switching needed). | 🚧 logic + unit tests done; not yet verified in the browser |
| M-5 | Hatchet durability: flag `durability` (default off). When on, hatchets wear down with each block mined and break at 0; the wooden hatchet never breaks, so the player can't get stuck. | 🚧 logic + unit tests done; not yet verified in the browser |
| M-6 | Mining a gem tile adds that gem to the backpack. | 🚧 logic + unit tests done; not yet verified in the browser |

### 3.3 Town, shop and economy
| ID | Requirement | Status |
|----|-------------|--------|
| E-1 | Standing on the shop tile in town opens the shop: sell gems (one or all) for coins, buy hatchets (Stone, Steel, Gem) and see their prices and what they can cut. | 🚧 logic + unit tests done; not yet verified in the browser |
| E-2 | Prices are tuned so a player who mines steadily can buy the next hatchet roughly every few minutes, and finding a hatchet in a chest is a real shortcut. | 🚧 tuned with tools/sim.mjs (see D12); not yet played by a human |
| E-3 | The Diamond of Your Dreams cannot be sold. | 🚧 logic + unit tests done; not yet verified in the browser |

### 3.4 Goal, saving and scores
| ID | Requirement | Status |
|----|-------------|--------|
| G-1 | **Win:** pick up the Diamond of Your Dreams. A win screen shows play time, gems found, coins earned and blocks mined. | 🚧 logic + unit tests done; not yet verified in the browser |
| G-2 | No fail state (a relaxing game); the timer measures how fast you found the dream diamond. | 🚧 logic + unit tests done; not yet verified in the browser |
| G-3 | Progress is saved on the device automatically (localStorage, keys prefixed `gem-miner.`); **Continue** resumes and **New game** starts a fresh world. Storage failures never break the game. | 📋 |
| G-4 | The best completion times (top 5) are kept on the device and shown on the title and win screens. | 📋 |
| G-5 | A "Back to games" link leads to the launcher (`../../`). | 📋 |

### 3.5 Controls and platforms
| ID | Requirement | Status |
|----|-------------|--------|
| C-1 | Desktop: WASD / arrows to move and mine, **E** / Enter to use the shop, **M** minimap, **P** / Esc pause. | 📋 |
| C-2 | Touch (like the sibling games): an on-screen D-pad (default, flag `touchControls=dpad`) or a floating joystick (`joystick`). A shop button appears in town. Shown automatically on touch devices (flag `touch`: auto/on/off). | 📋 |
| C-3 | No page scroll, zoom or text selection while playing; safe-area insets respected; works in portrait and landscape. | 📋 |

### 3.6 Presentation
| ID | Requirement | Status |
|----|-------------|--------|
| P-1 | Procedural canvas graphics, no image files: each rock type has its own colour and texture, gems sparkle, the miner is a small figure with a helmet lamp. Crisp on high-DPI screens. | 📋 |
| P-2 | HUD: coins, current hatchet, backpack gem counts, distance/direction hint toward town. | 📋 |
| P-3 | Short WebAudio sounds for mining, gems, buying and winning (flag `sound`). | 📋 |

### 3.7 Feature flags
URL query parameters, e.g. `?worldSize=128&camera=center`. Defined in `src/flags.js`; unknown or invalid values fall back to the default.

| Flag | Values (default first) | Meaning |
|------|------------------------|---------|
| `worldSize` | `256`, `128`, `512` | World width and height in tiles. |
| `seed` | random / integer | World seed. A new game without `seed` picks a random one and saves it. |
| `camera` | `deadzone`, `center` | Camera follow style (W-2). |
| `fog` | `1`, `0` | Fog of war (W-7). |
| `durability` | `0`, `1` | Hatchets wear out (M-5). |
| `touch` | `auto`, `on`, `off` | Touch controls. |
| `touchControls` | `dpad`, `joystick` | Touch control style. |
| `sound` | `1`, `0` | Sound effects. |
| `debug` | `0`, `1` | Show tile coordinates and FPS, reveal the map, start with coins; runs with debug on are not saved to the best times. |

## 4. Non-functional
| ID | Requirement | Status |
|----|-------------|--------|
| NF-1 | No build step, no dependencies; vanilla ES modules + Canvas 2D; relative URLs only so the game works at `games/gem-miner/` and on its own. | 📋 |
| NF-2 | Pure game logic (world generation, mining, economy, saving) has no DOM access and is unit-tested with `node --test`. | 🚧 logic + unit tests done; not yet verified in the browser |
| NF-3 | 60 fps on a mid-range phone at 512 × 512: tile storage is typed arrays, drawing is culled to the viewport. | 📋 |
| NF-4 | The save file is small (fog and mined tiles stored compactly, e.g. as a diff from the seed) and versioned. | 🚧 logic + unit tests done; not yet verified in the browser |

## 5. Out of scope (for now)
Side-view gravity/ladders, enemies, oxygen/energy limits, multiplayer, online leaderboard, an offline service worker for this game.
