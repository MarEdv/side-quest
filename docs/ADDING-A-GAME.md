# Adding a game

A game is a folder `games/<slug>/` (lower-case kebab-case, it becomes the URL) containing at least:

- `index.html` – the game's entry page. Use **relative URLs only** (`src/main.js`, not `/src/main.js`), so the game works
  at `https://maredv.github.io/side-quest/games/<slug>/` and when served on its own.
- `game.json` – launcher metadata:

  ```json
  {
    "title": "My Game",
    "description": "One or two sentences shown on the card.",
    "thumbnail": "icons/icon-512.png",
    "icon": "🎲",
    "tags": ["keyboard", "touch"],
    "order": 3
  }
  ```

  `title` and `description` are required. `thumbnail` is a path inside the game folder; without it the card shows `icon`
  (an emoji, default 🎮). Games with `order` come first, ascending; the rest follow by title.

Optional but recommended: a `package.json` with an `npm test` script (the root `npm test` and CI run it inside the folder),
plus the game's own `README.md`, `CLAUDE.md` and `docs/`.

## Steps

1. Create or copy the folder into `games/<slug>/`.
2. Add `game.json`.
3. Run `npm run registry` (rewrites `games.json`) and `npm test`.
4. Commit the folder and `games.json` together, then push `main`. CI tests and deploys.

## Bringing a game's git history from another repo

Requires [`git filter-repo`](https://github.com/newren/git-filter-repo) (`brew install git-filter-repo`), used once, not a
project dependency.

```sh
git clone --no-local <path-or-url-of-game-repo> /tmp/my-game
cd /tmp/my-game && git filter-repo --to-subdirectory-filter games/my-game
cd <this repo>
git remote add my-game /tmp/my-game && git fetch my-game
git merge --allow-unrelated-histories my-game/main -m "Merge My Game history into games/my-game"
git remote remove my-game
```

Then move anything that must live at the repo root (CI workflows, `.gitignore` entries) out of `games/my-game/`, add
`game.json` and run `npm run registry`. `git log --follow games/my-game/<file>` shows the full history.

## Renaming a game

1. `git mv games/<old> games/<new>` and change the title in `game.json`, `index.html` and any manifest.
2. Leave a stub at `games/<old>/`: a `game.json` containing `{ "movedTo": "<new>" }` (the registry skips it and checks the
   target exists) and an `index.html` that redirects to `../<new>/`, keeping `location.search` and `location.hash`.
3. If the game had a service worker, also put a retire worker at `games/<old>/sw.js` (see `games/side-quest/sw.js`):
   installed copies keep their old registration until a worker at that exact URL unregisters itself.
4. Keep localStorage keys and cache names unchanged so players keep their progress. Run `npm run registry` and `npm test`.

## Things to watch

- **Service workers**: register with a relative URL (`register('sw.js')`) so the scope stays inside the game folder, and use
  a cache name unique to the game. Never register a worker at the site root (the root `sw.js` is reserved, D-2).
- **localStorage** is shared by every game on the origin: prefix your keys with the game's slug.
- A link back to the launcher is `../../`.
