# Feature Flags

Flags live in `src/flags.js` (`DEFAULT_FLAGS`): the schema is this game's, the parser comes from the shared kit
(`src/kit/flags.js`, generated from the repo's `kit/flags.js`, D35); `tests/flags-golden.test.js` pins what every link gives.
Set them in the URL query string, e.g. `http://localhost:8000/?worldSize=128&camera=center`.

Precedence: **URL query > default**. There is no settings screen; the in-game sound toggle lasts for the session only.
Continue always resumes the saved world as it was started: `seed` and `worldSize` apply to New game (D25).

Booleans accept `1/0/true/false/on/off/yes/no` (any case, spaces ignored). Enum values must be written exactly as listed
(lower case, no spaces). When a flag is given twice, only the first occurrence counts, even when it is invalid. Unknown
flags and invalid values are ignored (the default applies). **Any new flag must be added here.**

| Flag | Type | Default | Values / meaning |
|------|------|---------|------------------|
| `worldSize` | enum (number) | `256` | `128`, `256`, `512`: world width and height in tiles. |
| `seed` | int | random | World seed, `0`-`2147483647`. A new game without `seed` picks a random one and saves it. |
| `camera` | enum | `deadzone` | Camera follow style (W-2): `deadzone` or `center`. |
| `fog` | bool | `true` | Fog of war (W-7). |
| `durability` | bool | `false` | Hatchets wear out (M-5). |
| `touch` | enum | `auto` | Touch controls: `auto` (on touch devices), `on`, `off`. |
| `touchScheme` | enum | `dpad` | Touch control style: `dpad` (on-screen D-pad) or `joystick` (floating joystick). |
| `sound` | bool | `true` | Sound effects. |
| `debug` | bool | `false` | Show tile coordinates and FPS, reveal the map, start with coins; runs with debug on are not autosaved and not saved to the best times. Also exposes `window.__game` (`state`, `cam`, `renderer`) for scripted testing; `window.__gem` is the same object under its old name (D36). |

**Aliases** (old names, so old links keep working; when both are given, a valid value under the new name wins):

| Old name | New name |
|----------|----------|
| `touchControls` | `touchScheme` (renamed in D35, the same name as in Garden Day) |
