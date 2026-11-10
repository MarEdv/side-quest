# 🎮 Side Quest Project

A collection of small single-player browser games about getting distracted, behind one launcher page.

**Play:** https://maredv.github.io/side-quest/

| Game | What it is |
|------|------------|
| [Garden Day](games/garden-day/) | Finish the garden chores before sunset while your wife hands out side quests. |
| [Poo Sandwich](games/poo-sandwich/) | Survive the office work day while your boss throws poo sandwiches at you. |

Install it as an app with the **Install app** button (Chrome, Edge, Android), or on iPhone / iPad via Share > **Add to Home
Screen**. Games open inside the app.

Zero dependencies: vanilla JS ES modules, no build step. Each game lives in its own folder with its own README,
tests and docs.

## Develop

```sh
npm start          # http://localhost:8000 (launcher), games at /games/<slug>/
npm test           # launcher + registry tests, then every game's tests
npm run registry   # rebuild games.json from games/*/game.json
```

## Add a game

Put it in `games/<slug>/` with an `index.html` and a `game.json`, then run `npm run registry`.
Details (including how to bring along another repo's git history): [docs/ADDING-A-GAME.md](docs/ADDING-A-GAME.md).

## Docs

- Launcher requirements: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)
- Decisions: [docs/DECISIONS.md](docs/DECISIONS.md)
