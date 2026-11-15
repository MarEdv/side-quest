# Garden Day — rules for agents working in this repo

## Non-negotiable
1. **Keep `docs/REQUIREMENTS.md` up to date.** Any change to gameplay, controls, flags, tech, or scope must update the
   relevant requirement rows (add/modify/retire with status) **in the same commit**. A change without a matching
   requirements update is incomplete.
2. **Log decisions and assumptions** in `docs/DECISIONS.md` (append-only, dated, with alternatives + rationale).
3. **Feature flags**: when several reasonable solutions exist, pick one or implement several behind a flag in
   `src/config.js`; document every flag in `docs/FLAGS.md`.
4. **Zero dependencies** (runtime and dev). Vanilla JS ES modules, Canvas 2D, WebAudio. No build step.
5. **Commit often**, small focused commits. Run `npm test` before committing.
6. Don't ask the owner questions — make a reasonable assumption and log it.

## Layout
- `index.html` – entry; `src/` – game code; `tests/` – `node --test` unit tests; `docs/` – requirements, decisions, flags.
- Logic modules (`game.js`, `chores.js`, `quests.js`, `wife.js`, `world.js`, `geometry.js`, `rng.js`, `config.js`,
  `i18n.js`) must not touch the DOM so they stay testable in Node.
- Player-facing text goes through `src/i18n.js` (English and Swedish, D-31): `t(key)` for UI strings, `tx(english)` for
  text kept in data tables. New text needs both languages (`tests/i18n.test.js` checks). Only `main.js`, `render.js`, `input.js`, `audio.js` may.

## Commands
- `npm start` → serves on http://localhost:8000 (python3 http.server)
- `npm test` → `node --test`
