# Feature Flags

Flags live in `src/flags.js` (`DEFAULT_FLAGS`): the schema is this game's, the parser comes from the shared kit
(`src/kit/flags.js`, generated from the repo's `kit/flags.js`). Set them in the URL query string, e.g.
`http://localhost:8000/games/train-attendant/?trip=short&quests=assign`.

Precedence: **URL query > default**. There is no settings screen; the in-game sound toggle lasts for the session only.

Booleans accept `1/0/true/false/on/off/yes/no` (any case, spaces ignored). Unknown flags and invalid values are ignored
(the default applies). **Any new flag must be added here.**

| Flag | Type | Default | Values / meaning |
|------|------|---------|------------------|
| `trip` | enum | `normal` | `short` (4 stations, 45 s legs), `normal` (6 stations, 60 s), `long` (8 stations, 70 s). T-2. Best scores are kept per trip. |
| `cars` | enum (number) | `3` | `2`, `3`, `4`: passenger cars (the café car is extra): 40 / 60 / 80 seats. Boarders per station are the 3-car share × (3 / cars)^0.5, so 2 cars is a little easier and 4 cars harder (one attendant, a longer train). T-1, D13, D39. |
| `difficulty` | enum | `normal` | `easy`, `normal`, `hard`: boarders, how soon and how often needs come, stress speed. S-5, D39. |
| `quests` | enum | `offer` | `offer` (Accept / Decline) or `assign` (every offer is accepted). Q-1, D5. |
| `stress` | enum | `solo` | `solo` or `contagious` (a passenger above 70 adds 0.5 stress/s to neighbours within 4 m in the same car). P-4, D6, D13. |
| `seed` | int | random | Trip seed, `0`-`2147483647`: stations, passengers and quests. |
| `touch` | enum | `auto` | Touch controls: `auto` (on touch devices), `on`, `off`. |
| `sound` | bool | `true` | Sound effects. |
| `debug` | bool | `false` | Shows FPS and the seed, a 4× time button, and exposes `window.__game` (`state`, ...). Runs with debug on are not saved to the best scores. |
