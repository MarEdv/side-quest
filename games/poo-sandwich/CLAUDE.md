# Poo Sandwich — rules for agents working in this game

## Non-negotiable
1. **Keep `docs/REQUIREMENTS.md` up to date** in the same commit as any change to behaviour, scope, controls, feature
   flags or tech. Update status markers (✅/🚧/📋/❌).
2. **Log decisions and assumptions** in `docs/DECISIONS.md` (append-only; supersede, never rewrite). Append a new
   `D<n>` entry.
3. **Feature flags**: when several reasonable solutions exist, pick one or put them behind a flag in `src/flags.js`;
   document the flag in REQUIREMENTS §2.3.
4. **Zero dependencies** (runtime and dev). Vanilla JS ES modules, Canvas 2D. No build step.
5. **Self-contained**: relative URLs only. Never import from the launcher, another game or the root `kit/` folder.
   Files in `src/kit/` are generated copies of root `kit/` modules: never edit them; change `kit/<name>.js` at the repo
   root and run `npm run kit` there (root `CLAUDE.md` rule 5).
6. **localStorage is shared by every game on the origin.** This game uses `poo-sandwich-best` and `poo-sandwich-lang`:
   the kit's storage with prefix `poo-sandwich-` (`src/main.js`). Never rename them: players' best scores live there.
7. **Commit often**, small focused commits. Run `npm test` in this folder and at the repo root before committing.
8. Don't ask the owner questions — make a reasonable assumption and log it.

## Layout
- `index.html` – entry; `style.css` – styles; `src/` – game code; `tests/` – `node --test` unit tests; `docs/` –
  requirements and decisions.
- Modules that may touch the browser are listed in `package.json` (`"browserModules"`); every other module in `src/`
  stays DOM-free so it can be tested in Node (the root `tests/conventions.test.js` checks this).
- Must work on desktop (keyboard/mouse) and mobile (touch). Test in Chrome (desktop + device emulation).

## Commands
- Run with `npm start` at the repo root and open `http://localhost:8000/games/poo-sandwich/` (also works with `npm
  start` inside this folder, then `http://localhost:8000/`).
- `npm test` in this folder runs `node --test tests/*.test.js`.

## Deploy
Part of the Side Quest Project monorepo (see the root `CLAUDE.md`): push `main` → GitHub Actions → GitHub Pages at
https://maredv.github.io/side-quest/games/poo-sandwich/
