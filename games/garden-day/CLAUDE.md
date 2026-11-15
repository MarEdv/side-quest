# Garden Day — rules for agents working in this game

## Non-negotiable
1. **Keep `docs/REQUIREMENTS.md` up to date.** Any change to gameplay, controls, flags, tech, or scope must update the
   relevant requirement rows (add/modify/retire with status) **in the same commit**. A change without a matching
   requirements update is incomplete.
2. **Log decisions and assumptions** in `docs/DECISIONS.md` (append-only, dated, with alternatives + rationale;
   supersede, never rewrite). Decision IDs look like `D-<n>`.
3. **Feature flags**: when several reasonable solutions exist, pick one or put them behind a flag in `src/config.js`;
   document every flag in `docs/FLAGS.md`.
4. **Zero dependencies** (runtime and dev). Vanilla JS ES modules, Canvas 2D, WebAudio. No build step.
5. **Self-contained**: relative URLs only. Never import from the launcher, another game or the root `kit/` folder.
   Files in `src/kit/` are generated copies of root `kit/` modules: never edit them; change `kit/<name>.js` at the repo
   root and run `npm run kit` there (root `CLAUDE.md` rule 5).
6. **localStorage is shared by every game on the origin.** Every key starts with `sidequest.v1.` (`KEY_PREFIX` in
   `src/storage.js`). That is a legacy name and must never change: players' progress lives there.
7. **Commit often**, small focused commits. Run `npm test` in this folder and at the repo root before committing.
8. Don't ask the owner questions — make a reasonable assumption and log it.

## Layout
- `index.html` – entry; `sw.js` – service worker; `manifest.webmanifest` + `icons/` – installable app; `tools/` –
  scripts; `src/` – game code; `tests/` – `node --test` unit tests; `docs/` – requirements, decisions, flags.
- Modules that may touch the browser are listed in `package.json` (`"browserModules"`); every other module in `src/`
  stays DOM-free so it can be tested in Node (the root `tests/conventions.test.js` checks this).
- Player-facing text goes through `src/i18n.js` (English and Swedish, D-31): `t(key)` for UI strings, `tx(english)` for
  text kept in data tables. New text needs both languages (`tests/i18n.test.js` checks).

## Commands
- Run with `npm start` at the repo root and open `http://localhost:8000/games/garden-day/` (also works with `npm start`
  inside this folder, then `http://localhost:8000/`).
- `npm test` in this folder runs `node --test tests/*.test.js`.

## Deploy
Part of the Side Quest Project monorepo (see the root `CLAUDE.md`): push `main` → GitHub Actions → GitHub Pages at
https://maredv.github.io/side-quest/games/garden-day/
