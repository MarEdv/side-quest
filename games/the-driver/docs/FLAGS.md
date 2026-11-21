# Feature Flags

Flags live in `src/flags.js` (`DEFAULT_FLAGS`): the schema is this game's, the parser comes from the shared kit
(`src/kit/flags.js`, generated from the repo's `kit/flags.js`). Set them in the URL query string, e.g.
`http://localhost:8000/games/the-driver/?road=country&steer=lanes`.

Precedence: **URL query > default**. There is no settings screen; the in-game sound toggle lasts for the session only.

Booleans accept `1/0/true/false/on/off/yes/no` (any case, spaces ignored). Unknown flags and invalid values are ignored
(the default applies). **Any new flag must be added here.**

| Flag | Type | Default | Values / meaning |
|------|------|---------|------------------|
| `length` | enum | `normal` | `normal` (180 s, the owner's 3 minutes) or `short` (60 s). G-1, D3. Best scores are kept per length. |
| `road` | enum | `highway` | `highway` (three lanes one way, overtaking traffic) or `country` (two lanes, oncoming traffic). G-4, D5. |
| `steer` | enum | `free` | `free` (hold to steer, curves push outward) or `lanes` (tap to slide one lane). C-2, D6. |
| `pedals` | enum | `auto` | `auto` (accelerates by itself to 110 km/h, gas for more) or `manual` (gas to accelerate). C-1, D6. |
| `crash` | enum | `soft` | `soft` (crashes cost points and speed) or `hard` (the 3rd crash ends the drive). S-1, D3. |
| `view` | enum | `cockpit` | `cockpit` (full dashboard and wheel) or `hood` (low dashboard, more road). V-2. |
| `difficulty` | enum | `normal` | `easy`, `normal`, `hard`: traffic density and how often cars change lane. TF-4. |
| `seed` | int | random | Drive seed, `0`-`2147483647`: road and traffic. |
| `touch` | enum | `auto` | Touch controls: `auto` (on touch devices), `on`, `off`. |
| `sound` | bool | `true` | Sound effects. |
| `debug` | bool | `false` | Shows FPS and the seed, a 4× time button, and exposes `window.__game` (`state`, ...). Runs with debug on are not saved to the best scores. |
