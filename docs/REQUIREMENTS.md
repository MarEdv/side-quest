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
| PR-5 | Published on GitHub Pages. | 🚧 Workflow in place (DP-1); first deploy pending. |

## 3. Launcher

| ID | Requirement | Status |
|----|-------------|--------|
| L-1 | `index.html` lists every game in `games.json` as a card (thumbnail or emoji, title, description, tags, "Play"). | ✅ |
| L-2 | A card is a normal link to `games/<slug>/` (no iframe), so each game keeps full-screen, input and its own PWA. | ✅ |
| L-3 | Works with keyboard (cards are focusable links with a visible focus ring), mouse and touch; responsive down to 320 px. | ✅ |
| L-4 | Follows the system dark/light theme; respects reduced motion. | ✅ |
| L-5 | When opened as the old installed Side Quest app (standalone display mode), shows a "Side Quest moved here" notice. | 🚧 Not tried on a device. |
| L-6 | If `games.json` can't be loaded, shows an error message instead of an empty page. | ✅ |

## 4. Registry

| ID | Requirement | Status |
|----|-------------|--------|
| R-1 | Each game is `games/<slug>/` with `index.html` and `game.json` (`title`, `description` required; `thumbnail`, `icon`, `tags`, `order` optional). | ✅ `src/registry.js` |
| R-2 | `npm run registry` writes `games.json` from the folders; the file is committed so no build step is needed. | ✅ D-3 |
| R-3 | `npm test` fails when `games.json` is stale or a game folder is invalid. | ✅ `tests/registry.test.js` |

## 5. Tech, tests and deploy

| ID | Requirement | Status |
|----|-------------|--------|
| T-1 | Zero dependencies, vanilla ES modules, no build step; `npm start` serves everything. | ✅ |
| T-2 | Root `npm test` runs the root tests and every game's own `npm test` in its folder. | ✅ `tools/test-all.mjs` |
| DP-1 | Push to `main` → Actions runs `npm test`, then deploys the repo root to Pages at https://maredv.github.io/side-quest/. | 🚧 Pages source must be set to "GitHub Actions". |
| DP-2 | The old Side Quest root service worker is retired without breaking the relocated game's offline cache. | ✅ Root `sw.js` (D-2), unit-tested in `tests/sw.test.js`. 🚧 not tried on a device with the old app installed. |
