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
    "order": 3,
    "i18n": { "sv": { "description": "En eller två meningar på kortet." } }
  }
  ```

  `title` and `description` are required. `thumbnail` is a path inside the game folder; without it the card shows `icon`
  (an emoji, default 🎮). Games with `order` come first, ascending; the rest follow by title. `i18n` gives the card's
  `title` and/or `description` per language (the launcher offers `en` and `sv`; a missing field falls back to English).

- **Language:** the launcher links to `games/<slug>/?lang=en` or `?lang=sv`. A game with translations reads `?lang=`
  first (and remembers it under its own key), then its saved choice, then `navigator.languages`. The kit does all of
  that: keep the texts in the game's `src/i18n.js`, build the rest with `createI18n(STRINGS)` from `kit/lang.js`, and
  call `setupLang()` from `kit/langdom.js` in the browser entry (see any of the games). Mark static texts with
  `data-i18n` attributes and language buttons with `data-lang`.

- `package.json` – the root `npm test` and CI run the game's own `npm test` inside the folder, and check this shape:

  ```json
  {
    "name": "my-game",
    "private": true,
    "type": "module",
    "scripts": { "start": "python3 -m http.server 8000", "test": "node --test tests/*.test.js" },
    "browserModules": ["main.js", "render.js", "input.js"]
  }
  ```

  `browserModules` lists the files under `src/` that touch the browser (DOM, `window`, storage, audio). Every other
  module in `src/` must be DOM-free so it can be tested in Node; `tests/conventions.test.js` at the root checks both
  directions, along with the relative-URL and import rules above. It also expects `tests/i18n.test.js` to run the
  kit's `stringProblems(STRINGS)` (plus `missingHtmlKeys(html, STRINGS)` if the page uses `data-i18n`), and `catch {`
  rather than an unused `catch (e)`.

Recommended: the game's own `README.md`, `CLAUDE.md` (copy the skeleton of an existing game's) and `docs/`.

## Shared code (the kit)

Before writing a storage wrapper, a seeded random generator or language-picking code, look in `kit/` (`kit/README.md`).
To use a module, list it in the game's `package.json` and run `npm run kit` at the repo root:

```json
"kit": ["storage.js"]
```

That writes `games/<slug>/src/kit/storage.js`; import it as `./kit/storage.js` from `src/`. Commit the copy. Don't edit it
(`npm test` fails if it differs from `kit/`), and don't import `../../kit/` directly: the game must also work when its
folder is served on its own.

## Steps

1. Create or copy the folder into `games/<slug>/`.
2. Add `game.json`.
3. Run `npm run registry` (rewrites `games.json`), `npm run kit` if the game lists kit modules, and `npm test`.
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
- **Back to games:** the start screen has a link to `../../?lang=<the game's current language>` ("Back to games" /
  "Tillbaka till spelen"), updated when the player switches language: the mirror of the launcher's `?lang=` hand-off.
  The games build it with a `backHref()` in their `src/i18n.js`.
