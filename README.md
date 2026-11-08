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
- **P / Esc**: pause (menu: Resume / Quit to menu) · **R**: play again on the end screen
- **Menus**: Tab / arrow keys move focus, **Enter / Space** activate, **Esc** goes back. The main menu has **Play**, **Settings** and **High scores** (top 10 on this device, stored in `localStorage`)

## Mobile / touch

Works on phones and tablets (landscape recommended; portrait shows the game on top and the controls below). Touch controls
appear automatically on touch devices (`?touch=on|off|auto`).

- **Joystick scheme (default):** drag on the left half to steer (the stick appears under your thumb); hold the **WORK** button
  (bottom right) to work / pick up / deliver. Both thumbs work at once.
- **Tap scheme (`?touchScheme=tap`):** touch and drag to walk toward that point; hold a finger on a chore or quest spot to work on it.
- Tap **Play** to start; tap the end screen or **Play again** to restart; the **II** button (top right) pauses. "Add to Home Screen" launches it full-screen.

## Flags

Every flag can be changed in **Settings** (main menu or pause screen; saved on this device). Flags in the URL win over saved
settings and show as locked there. You can also tweak the game with URL query parameters, e.g. `http://localhost:8000/?wifeMode=random&difficulty=hard&debug=1`.
All flags are documented in [docs/FLAGS.md](docs/FLAGS.md).

## Test

```
npm test
```

Runs Node's built-in test runner (`node --test`) over `tests/*.test.js`. Game logic is DOM-free.

## Layout

`src/` game code (`config`, `rng`, `geometry`, `world`, `chores`, `quests`, `wife`, `game` are pure logic;
`touchmath`, `storage`, `scores`, `uimodel` are pure too; `main`, `render`, `input`, `touch`, `audio`, `ui` touch the browser) · `tests/` · `docs/` (requirements, decisions, flags).
