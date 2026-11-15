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
| L-9 | The launcher is available in English and Swedish: an **EN / SV** switch in the header (remembered), first visit follows `?lang=` (remembered since D-13, as in the games), then the browser language, else English. All texts are translated (lede, install button and iOS steps, card descriptions from `game.json` `i18n`, tags, "Play", status messages, footer); names stay as they are (A-3). Card links pass the language on as `?lang=<code>`. | ✅ D-7, D-13 (language rules, text applier and switch now come from `kit/lang.js` and `kit/langdom.js`); `tests/i18n.test.js`; checked in headless Chrome: Swedish and English rendering, clicking SV (texts, `lang`, saved choice, card links), a card opening Gem Miner in Swedish, and the launcher remembering SV on reload. |

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
| K-4 | Kit modules are tested at the root (`tests/kit-<name>.test.js`). Each module's first line says `// Pure` (no DOM, runs in Node) or `// Browser`, and `npm test` fails when the code disagrees. | ✅ `tests/kit-storage.test.js`, `tests/kit-lang.test.js`; `checkKitModules` in `tools/check-conventions.mjs` |
| K-5 | `kit/storage.js`: `createStorage(backend, prefix)` stores JSON under the part's own key prefix and never throws. A value the backend refuses lives in memory for the session, every later write tries the backend again, and a write that succeeds also delivers what was refused earlier. `persistent` is true while everything written this session is on the backend. `text(key)` returns a stored string as it is, for values saved before a part stored JSON. | ✅ D-11; checked in headless Chrome against `localStorage`. Used by the launcher and Poo Sandwich for the saved language (D-13). 📋 the rest of each part's storage (S-7). |
| K-6 | `kit/lang.js` + `kit/langdom.js`: a part builds its i18n from its own texts with `createI18n(STRINGS)` (one current language; `t(key, vars)`; fallback to the first language, then the key). `setupLang()` picks the language on load (`?lang=`, which is remembered, then the saved choice, then the browser's languages, then the default), writes texts into elements marked `data-i18n`, `data-i18n-html`, `data-i18n-aria` or `data-i18n-title`, and runs a `[data-lang]` switch. `stringProblems()` and `missingHtmlKeys()` are the checks for a part's own tests. | ✅ D-12; all four parts' current texts give identical output through it (540 lookups); checked in headless Chrome. Used by all four parts since D-13: start screens, the switch, reloads and (Gem Miner, Poo Sandwich) in-game screens were compared before and after in headless Chrome, in both languages. 🚧 Garden Day offline with the two new precached files not tried. |

## 6. Tech, tests and deploy

| ID | Requirement | Status |
|----|-------------|--------|
| T-1 | Zero dependencies, vanilla ES modules, no build step; `npm start` serves everything. | ✅ |
| T-2 | Root `npm test` runs the root tests and every game's own `npm test` in its folder. | ✅ `tools/test-all.mjs` |
| T-3 | Root `npm test` checks the conventions every game follows: relative URLs only and no import that leaves the game folder (rule 4, zero dependencies); a `package.json` with `private`, `type: module` and the standard `start` and `test` scripts; and every module in `src/` DOM-free unless the game lists it in `package.json` `"browserModules"` (a listed module that uses no browser global is also an error). The launcher's `src/` is checked the same way (`launcher.js` is its only browser module). | ✅ D-10; `tools/check-conventions.mjs`, `tests/conventions.test.js`. Each check was seen to fail on a planted violation. |
| DP-1 | Push to `main` → Actions runs `npm test`, then deploys the repo root to Pages at https://maredv.github.io/side-quest/. | ✅ Pages source set to GitHub Actions; first deploy 2026-11-10 green, launcher, `games.json`, `sw.js` and both games return 200. |
| DP-3 | The old https://maredv.github.io/poo-sandwich/ URL redirects to `games/poo-sandwich/` (query string kept); `MarEdv/poo-sandwich` is archived. | ✅ |
| DP-2 | The old Side Quest root service worker (and its `games/side-quest/` worker, D-5) is retired without breaking Garden Day's offline cache. | ✅ Root `sw.js` (D-2) and `games/side-quest/sw.js` (D-5), unit-tested in `tests/sw.test.js`. 🚧 not tried on a device with the old app installed. |
