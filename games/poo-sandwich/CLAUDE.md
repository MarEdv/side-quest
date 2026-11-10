# Poo Sandwich — repo rules

## Always
- **Keep `docs/REQUIREMENTS.md` up to date** in the same commit as any change to behaviour, scope, controls, feature flags or tech. Update status markers (✅/🚧/⏳).
- **Log decisions and assumptions** in `docs/DECISIONS.md` (append a new `D<n>` entry; don't rewrite history — supersede instead).
- When several solutions are reasonable, pick one or put both behind a feature flag in `src/flags.js` (and document the flag in REQUIREMENTS §2.3).
- Don't ask the owner questions — make reasonable assumptions and document them.
- Iterate fast; commit small, often, with clear messages.

## Tech constraints
- Vanilla JS ES modules + Canvas 2D. No runtime dependencies, no build step.
- Pure game logic lives in modules without DOM access so it can be tested with `node --test`.
- Must work on desktop (keyboard/mouse) and mobile (touch). Test in Chrome (desktop + device emulation).

## Commands
- Run locally: `npm start` (or `python3 -m http.server 8000`) then open http://localhost:8000
- Tests: `npm test` (runs `node --test`)

## Deploy
- Push to `main` → GitHub Actions → GitHub Pages: https://maredv.github.io/poo-sandwich/
