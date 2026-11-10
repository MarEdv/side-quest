# Feature Flags

Flags live in `src/config.js` (`DEFAULT_FLAGS`). Override any flag via URL query string, e.g.
`http://localhost:8000/?wifeMode=random&dayLength=120&debug=1`.

**Settings screen.** Every flag below can also be edited in the game (main menu or pause screen > Settings). Choices are saved
on this device (`localStorage` key `sidequest.v1.settings`). Precedence: **URL query > saved setting > default**
(`resolveFlags` in `src/settings.js`). A flag set by a valid URL parameter is shown locked in Settings ("Set by link (?wifeMode=random)");
"Clear link overrides" reloads without the query string, "Reset to defaults" forgets the saved choices. Saved values go through the
same validation and clamps as URL values; unusable ones are ignored. Two kinds of flag:

- **Control / display / debug** (`touch`, `touchScheme`, `showVisionCone`, `sound`, `debug`): apply immediately and also apply in Levels (from Settings and from the URL).
- **Gameplay** (`wifeMode`, `wifeRoam`, `difficulty`, `dayLength`, `maxActiveQuests`, `questInterval`, `visionRange`, `seed`): apply when the next day
  starts, never to a day in progress. **They apply to Arcade only.** Levels use fixed gameplay settings (`src/levels.js`, D-27): a flag a level
  does not list uses `DEFAULT_FLAGS`, never your saved Settings, and **URL gameplay parameters are ignored in levels** (so a level plays the same for
  everyone; `?wifeMode=random` only changes Arcade). `seed` is random in levels unless `debug` is on, then the Settings / URL seed is used
  (`GAMEPLAY_FLAGS` / `CONTROL_FLAGS` in `src/settings.js`).

**Levels** (tuned in D-28). 1 Saturday Morning (vision, patio, easy, 1 quest, interval 24) · 2 Honey-Do List (random, normal, 2 quests, interval 24) ·
3 Eyes Everywhere (vision + roam, normal, range 600, 2 quests, interval 11) · 4 The Inspection (hybrid, hard, 3 quests, interval 12, range 320, 175 s day).

Booleans accept `1/0/true/false`. Unknown flags are ignored. **Any new flag must be added here and in REQUIREMENTS.md.**

| Flag | Type | Default | Values / meaning |
|------|------|---------|------------------|
| `wifeMode` | enum | `vision` | `vision`: quests only when she sees you (avoidable). `random`: quests on a timer wherever you are. `hybrid`: she roams the garden with vision like `vision` + `wifeRoam` (roaming is implied, `wifeRoam` is ignored), and when a trip ends without spotting you she calls a quest anyway with probability 0.4 (`WIFE.hybridCallChance`), if fewer than `maxActiveQuests` are active. Such a forced quest is not counted as "avoided". Used by level 4. |
| `dayLength` | number (s) | `180` | Real seconds from 09:00 to sunset 18:00. |
| `maxActiveQuests` | int | `2` | Cap on simultaneous side quests. |
| `questInterval` | number (s) | `20` | Mean seconds she stays inside between appearances (×0.7–1.3; first one after 0.5–1×). Each appearance then adds 1.5 s warning + 5 s outside, so a full cycle averages `questInterval + 6.5` s. Same timing in `random` mode and in `vision` with `wifeRoam=0`. With `wifeRoam` on (vision mode) the time inside is scaled by 0.55 because each trip outside takes about 9 s instead of 5 (D-15). |
| `difficulty` | enum | `normal` | `easy` (chore/quest times ×0.75, longer deadlines) · `normal` · `hard` (×1.25, shorter deadlines). |
| `wifeRoam` | bool | `true` | `vision` mode only. After the warning she walks (90 px/s) along one of 6 random routes into the garden, sweeps the cone for 4 s at its end, then retraces it home. The cone points along her walk. Off: she stays on the patio for 5 s (original behaviour). Ignored in `random` mode and always on in `hybrid` mode. |
| `visionRange` | number (px) | `320` | How far she can see (cone length), 50–1200. Applies to both patio and roaming; used by `vision` and `hybrid`, not `random`. |
| `showVisionCone` | bool | `true` | Draw the wife's vision cone. |
| `sound` | bool | `true` | WebAudio blips. |
| `seed` | int | `random` | RNG seed for reproducible runs. |
| `debug` | bool | `false` | Show hitboxes, FPS, state overlay. Days played with `debug=1` are not recorded as high scores (the end screen says so, D-22). |
| `touch` | enum | `auto` | Touch controls: `auto` (on touch devices / after first touch), `on`, `off`. |
| `touchScheme` | enum | `joystick` | `joystick`: floating virtual stick (left) + action button (right). `tap`: tap/drag to walk to a point, hold on a task to work. |
