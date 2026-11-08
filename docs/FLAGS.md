# Feature Flags

Flags live in `src/config.js` (`DEFAULT_FLAGS`). Override any flag via URL query string, e.g.
`http://localhost:8000/?wifeMode=random&dayLength=120&debug=1`.

Booleans accept `1/0/true/false`. Unknown flags are ignored. **Any new flag must be added here and in REQUIREMENTS.md.**

| Flag | Type | Default | Values / meaning |
|------|------|---------|------------------|
| `wifeMode` | enum | `vision` | `vision`: quests only when she sees you (avoidable). `random`: quests on a timer wherever you are. |
| `dayLength` | number (s) | `180` | Real seconds from 09:00 to sunset 18:00. |
| `maxActiveQuests` | int | `2` | Cap on simultaneous side quests. |
| `questInterval` | number (s) | `20` | Mean seconds between wife appearances (vision) or quest calls (random). |
| `difficulty` | enum | `normal` | `easy` (chore/quest times ×0.75, longer deadlines) · `normal` · `hard` (×1.25, shorter deadlines). |
| `showVisionCone` | bool | `true` | Draw the wife's vision cone. |
| `sound` | bool | `true` | WebAudio blips. |
| `seed` | int | `random` | RNG seed for reproducible runs. |
| `debug` | bool | `false` | Show hitboxes, FPS, state overlay. |
