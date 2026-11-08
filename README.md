# Side Quest

A tiny single-player browser game. You are a homeowner who just wants to finish his garden chores
before sunset. Your wife keeps handing you "side quests" (fetch the groceries, rescue the cat, take
the bins to the curb). Finish all 8 chores before 18:00 and keep Harmony above zero, or you are
sleeping on the couch. Stay out of her line of sight (hedges and the shed block it) to avoid errands.

Zero dependencies: vanilla JS ES modules, Canvas 2D, WebAudio. No build step.

**Play online:** https://maredv.github.io/side-quest/ (deployed from `main` via GitHub Pages)

## Run

```
npm start
```

then open http://localhost:8000 in Chrome (ES modules need HTTP, not `file://`).

## Controls

- **WASD / arrow keys**: walk
- **Hold Space or E** next to a chore: work on it; next to a quest spot: pick up / deliver
- **P / Esc**: pause · **R**: restart on the end screen · **Space / Enter**: start

## Flags

Tweak the game with URL query parameters, e.g. `http://localhost:8000/?wifeMode=random&difficulty=hard&debug=1`.
All flags are documented in [docs/FLAGS.md](docs/FLAGS.md).

## Test

```
npm test
```

Runs Node's built-in test runner (`node --test`) over `tests/*.test.js`. Game logic is DOM-free.

## Layout

`src/` game code (`config`, `rng`, `geometry`, `world`, `chores`, `quests`, `wife`, `game` are pure logic;
`main`, `render`, `input`, `audio` touch the browser) · `tests/` · `docs/` (requirements, decisions, flags).
