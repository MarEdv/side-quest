# 🥪💩 Poo Sandwich

A tiny single-player browser game: survive the office work day while your boss throws poo sandwiches at you.

**Play:** https://maredv.github.io/side-quest/games/poo-sandwich/ (part of the [Side Quest Project](../../README.md))

- Requirements: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)
- Decisions & assumptions: [docs/DECISIONS.md](docs/DECISIONS.md)
- Feature flags: append to the URL, e.g. `?controls=tap&poo=choice&dayLength=120&debug=1` (see [docs/FLAGS.md](docs/FLAGS.md))

## Develop
```sh
npm start   # at the repo root: http://localhost:8000/games/poo-sandwich/ (or here, then http://localhost:8000/)
npm test    # in this folder: node --test tests/*.test.js, no dependencies
```
