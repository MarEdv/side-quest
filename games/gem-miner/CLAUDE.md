# Gem Miner — rules for agents working in this game

## Always
- **Keep `docs/REQUIREMENTS.md` up to date** in the same commit as any change to behaviour, scope, controls, feature flags or
  tech. Change status markers (✅/🚧/📋/❌) honestly; when editing a status, keep the requirement text intact.
- **Log decisions and assumptions** in `docs/DECISIONS.md` (append a new `D<n>`; supersede, never rewrite).
- When several solutions are reasonable, pick one or put them behind a flag in `src/flags.js` and document the flag in
  REQUIREMENTS §3.7.
- Don't ask the owner questions — make reasonable assumptions and document them.
- Iterate fast; small focused commits. Run `npm test` here (and at the repo root) before committing.

## Tech constraints
- Vanilla JS ES modules + Canvas 2D + WebAudio. Zero dependencies, no build step. Relative URLs only.
- Pure logic modules (no DOM, testable with `node --test`): world generation, mining, economy, save/load, scores, flags.
  Only `main.js`, `render.js`, `input.js`, `audio.js`, `ui.js` may touch the browser.
- localStorage keys start with `gem-miner.` (the origin is shared with the other games).
- Desktop (keyboard) and mobile (touch). Test in Chrome, including device emulation.

## Commands
- `npm start` at the repo root, then open http://localhost:8000/games/gem-miner/
- `npm test` (in this folder) runs `node --test tests/*.test.js`

## Deploy
Part of the Side Quest Project monorepo (see the root `CLAUDE.md`): push `main` → GitHub Actions → GitHub Pages at
https://maredv.github.io/side-quest/games/gem-miner/
