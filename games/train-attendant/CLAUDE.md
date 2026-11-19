# Train Attendant — rules for agents working in this game

## Non-negotiable
1. **Keep `docs/REQUIREMENTS.md` up to date** in the same commit as any change to behaviour, scope, controls, feature
   flags or tech. Change status markers (✅/🚧/📋/❌) honestly; when editing a status, keep the requirement text intact.
2. **Log decisions and assumptions** in `docs/DECISIONS.md` (append-only; supersede, never rewrite). Append a new
   `D<n>`.
3. **Feature flags**: when several reasonable solutions exist, pick one or put them behind a flag in `src/flags.js`;
   document the flag in `docs/FLAGS.md`.
4. **Zero dependencies** (runtime and dev). Vanilla JS ES modules, Canvas 2D, WebAudio. No build step.
5. **Self-contained**: relative URLs only. Never import from the launcher, another game or the root `kit/` folder.
   Files in `src/kit/` are generated copies of root `kit/` modules: never edit them; change `kit/<name>.js` at the repo
   root and run `npm run kit` there (root `CLAUDE.md` rule 5).
6. **localStorage is shared by every game on the origin.** Every key starts with `train-attendant.` (`src/storage.js`).
7. **Commit often**, small focused commits. Run `npm test` in this folder and at the repo root before committing.
8. Don't ask the owner questions — make a reasonable assumption and log it.

## Layout
- `index.html` – entry; `style.css` – styles; `tools/` – scripts (`sim.mjs` balance bot); `src/` – game code; `tests/` –
  `node --test` unit tests; `docs/` – requirements, decisions, flags.
- Modules that may touch the browser are listed in `package.json` (`"browserModules"`); every other module in `src/`
  stays DOM-free so it can be tested in Node (the root `tests/conventions.test.js` checks this).
- The simulation is deterministic: a seeded RNG (`src/kit/rng.js`) and a fixed 1/60 s step, so `tools/sim.mjs` and the
  tests replay the same trip for the same seed and inputs.
- Desktop (keyboard) and mobile (touch). Test in Chrome, including device emulation.

## Commands
- Run with `npm start` at the repo root and open `http://localhost:8000/games/train-attendant/` (also works with
  `npm start` inside this folder, then `http://localhost:8000/`).
- `npm test` in this folder runs `node --test tests/*.test.js`.
- `node tools/sim.mjs` runs the balance bots (see `docs/DECISIONS.md` for the current numbers).

## Deploy
Part of the Side Quest Project monorepo (see the root `CLAUDE.md`): push `main` → GitHub Actions → GitHub Pages at
https://maredv.github.io/side-quest/games/train-attendant/
