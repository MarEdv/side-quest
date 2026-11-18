# Feature Flags

Flags live in `src/flags.js` (`DEFAULT_FLAGS`): the schema is this game's, the parser comes from the shared kit
(`src/kit/flags.js`, generated from the repo's `kit/flags.js`, D24); `tests/flags-golden.test.js` pins what every link gives.
Set them in the URL query string, e.g. `http://localhost:8000/?controls=joystick&poo=choice`.

Precedence: **URL query > default**. There is no settings screen.

Booleans accept `1/0/true/false/on/off/yes/no` (any case, spaces ignored). Enum values must be written exactly as listed
(lower case, no spaces). When a flag is given twice, only the first occurrence counts, even when it is invalid. Unknown
flags and invalid values are ignored (the default applies). **Any new flag must be added here.**

| Flag | Type | Default | Values / meaning |
|------|------|---------|------------------|
| `controls` | enum | `auto` | `tap`: tap/click a point and the worker walks there. `joystick`: virtual thumb stick. `auto`: joystick on touch devices, keyboard+click-to-move on desktop. |
| `poo` | enum | `hit` | `hit`: being hit automatically assigns the poo task. `choice`: sandwiches that land stay on the floor briefly; walking over one picks it up (accept = more points), ignoring it is "avoiding" but adds a little stress. Being hit directly still assigns it. |
| `dayLength` | number (s) | `180` | Real-time length of the work day, 10-3600. |
| `debug` | bool | `false` | Show zones, hitboxes, FPS. Also exposes `window.__game` (`state`, `start()`) for scripted testing. Debug runs are not recorded as best score (D22). |

**Aliases** (old names, so old links keep working; when both are given, a valid value under the new name wins):

| Old name | New name |
|----------|----------|
| `daySeconds` | `dayLength` (renamed in D24, the same name as in Garden Day) |
