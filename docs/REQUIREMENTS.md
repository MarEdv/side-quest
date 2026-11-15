# Side Quest Project — Requirements

> **Living document.** Every change to the launcher, the registry, the repo layout or the deploy MUST update this file in
> the same commit. Requirement IDs are stable; never reuse a retired ID. Each game keeps its own requirements in
> `games/<slug>/docs/REQUIREMENTS.md`.

Status legend: ✅ implemented and verified · 🚧 implemented but not (fully) verified, or in progress · 📋 planned · ❌ retired

## 1. Product vision

One web app that offers the player a choice of small "side-quest" games built with Claude Code. New games can be added
without changing the launcher.

## 2. Product requirements (from the owner)

| ID | Requirement | Status |
|----|-------------|--------|
| PR-1 | One project, "Side Quest Project", in one git repo containing every game. | ✅ D-1 |
| PR-2 | The git history of each imported game is kept. | ✅ D-1: `git log --follow games/<slug>/…` reaches each game's first commit. |
| PR-3 | A web app lets the player pick one of the games. | ✅ Launcher at the site root (L-1). |
| PR-4 | More games can be added dynamically. | ✅ Folder + `game.json` + `npm run registry` (R-1..R-3, `docs/ADDING-A-GAME.md`). |
| PR-5 | Published on GitHub Pages. | ✅ https://maredv.github.io/side-quest/ (DP-1). |

## 3. Launcher

| ID | Requirement | Status |
|----|-------------|--------|
| L-1 | `index.html` lists every game in `games.json` as a card (thumbnail or emoji, title, description, tags, "Play"). | ✅ |
| L-2 | A card is a normal link to `games/<slug>/` (no iframe), so each game keeps full-screen, input and its own PWA. | ✅ |
| L-3 | Works with keyboard (cards are focusable links with a visible focus ring), mouse and touch; responsive down to 320 px. | ✅ |
| L-4 | Follows the system dark/light theme; respects reduced motion. | ✅ |
| L-5 | ~~When opened as the old installed Side Quest app (standalone display mode), shows a "Side Quest is now Garden Day" notice.~~ | ❌ Retired 2026-11-10 (D-6): the launcher is now an app itself, so standalone no longer means "old Side Quest app". The Garden Day card says "Formerly called Side Quest" instead. |
| L-6 | If `games.json` can't be loaded, shows an error message instead of an empty page. | ✅ |
| L-7 | The launcher can be installed as an app ("Side Quests" on the home screen): web app manifest (scope = whole site, so games open inside the app), real PNG icons (`any` + `maskable`, `apple-touch-icon`), Apple meta tags. An **Install app** button uses the browser's prompt where one exists (Chromium), shows Share > Add to Home Screen steps on iOS / iPadOS, and is hidden elsewhere and when already running as an app. | ✅ Chrome 157 reports no installability errors; native path (prompt, accept → hidden), iOS steps at 390 px and the hidden-when-standalone case checked in headless Chrome (D-6). 🚧 not installed on a real phone. |
| L-8 | Installing needs no service worker; the launcher doesn't work offline (games with their own worker, such as Garden Day, still do once visited). | ✅ D-6 |
| L-9 | The launcher is available in English and Swedish: an **EN / SV** switch in the header (remembered), first visit follows `?lang=`, then the browser language, else English. All texts are translated (lede, install button and iOS steps, card descriptions from `game.json` `i18n`, tags, "Play", status messages, footer); names stay as they are (A-3). Card links pass the language on as `?lang=<code>`. | ✅ D-7; `tests/i18n.test.js`; checked in headless Chrome: Swedish and English rendering, clicking SV (texts, `lang`, saved choice, card links), a card opening Gem Miner in Swedish, and the launcher remembering SV on reload. |

## 4. Registry

| ID | Requirement | Status |
|----|-------------|--------|
| R-1 | Each game is `games/<slug>/` with `index.html` and `game.json` (`title`, `description` required; `thumbnail`, `icon`, `tags`, `order`, `i18n` optional; `i18n` maps a language code to a translated `title` / `description`, D-7). | ✅ `src/registry.js` |
| R-2 | `npm run registry` writes `games.json` from the folders; the file is committed so no build step is needed. | ✅ D-3 |
| R-3 | `npm test` fails when `games.json` is stale or a game folder is invalid. | ✅ `tests/registry.test.js` |
| R-4 | A renamed game leaves a redirect stub at its old folder: `game.json` is `{ "movedTo": "<new-slug>" }` (not listed; the target must exist), plus an `index.html` redirect and, if the game had a service worker, a retire `sw.js`. | ✅ `games/side-quest/` → `garden-day` (D-5) |

## 5. Shared kit

| ID | Requirement | Status |
|----|-------------|--------|
| K-1 | Code that every part needs and that knows nothing about one game lives once, in `kit/` at the repo root (`kit/README.md`). The launcher imports it from there. | ✅ D-9. The folder holds no modules yet; `docs/STREAMLINING.md` (S-3..S-13) lists the ones planned. |
| K-2 | A game lists the kit modules it uses in its `package.json` (`"kit": ["<name>.js"]`); `npm run kit` writes them to `games/<slug>/src/kit/` under a "generated" header and removes copies no longer listed. The copies are committed, so no build step is needed and a game still works served on its own. | ✅ `tools/sync-kit.mjs` |
| K-3 | `npm test` fails when a copy is missing, edited or left over, when a `"kit"` list names an unknown module, or when it leaves out a module that a listed one imports. | ✅ `tests/kit.test.js` |
| K-4 | Kit modules are tested at the root (`tests/kit-<name>.test.js`). | 📋 with the first module (S-3). |

## 6. Tech, tests and deploy

| ID | Requirement | Status |
|----|-------------|--------|
| T-1 | Zero dependencies, vanilla ES modules, no build step; `npm start` serves everything. | ✅ |
| T-2 | Root `npm test` runs the root tests and every game's own `npm test` in its folder. | ✅ `tools/test-all.mjs` |
| T-3 | Root `npm test` checks the conventions every game follows: relative URLs only and no import that leaves the game folder (rule 4, zero dependencies); a `package.json` with `private`, `type: module` and the standard `start` and `test` scripts; and every module in `src/` DOM-free unless the game lists it in `package.json` `"browserModules"` (a listed module that uses no browser global is also an error). The launcher's `src/` is checked the same way (`launcher.js` is its only browser module). | ✅ D-10; `tools/check-conventions.mjs`, `tests/conventions.test.js`. Each check was seen to fail on a planted violation. |
| DP-1 | Push to `main` → Actions runs `npm test`, then deploys the repo root to Pages at https://maredv.github.io/side-quest/. | ✅ Pages source set to GitHub Actions; first deploy 2026-11-10 green, launcher, `games.json`, `sw.js` and both games return 200. |
| DP-3 | The old https://maredv.github.io/poo-sandwich/ URL redirects to `games/poo-sandwich/` (query string kept); `MarEdv/poo-sandwich` is archived. | ✅ |
| DP-2 | The old Side Quest root service worker (and its `games/side-quest/` worker, D-5) is retired without breaking Garden Day's offline cache. | ✅ Root `sw.js` (D-2) and `games/side-quest/sw.js` (D-5), unit-tested in `tests/sw.test.js`. 🚧 not tried on a device with the old app installed. |
