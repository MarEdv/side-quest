# kit — code shared by the launcher and the games

One canonical copy of the code that every part needs and that knows nothing about any one game (K-1, D-9).
`docs/STREAMLINING.md` lists the modules planned for this folder.

## Modules

| Module | Kind | What it gives a part |
|--------|------|----------------------|
| `storage.js` | pure | `createStorage(backend, prefix)`: JSON in `localStorage` under the part's prefix; never throws; retries refused writes (D-11). |
| `lang.js` | pure | `createI18n(STRINGS)`: languages, `t(key, vars)`, `pickLang`; `stringProblems`, `missingHtmlKeys` for tests (D-12). |
| `rng.js` | pure | `mulberry32(seed)`, `createRng(seed)` (helpers; seed 0 becomes 0x9e3779b9), `hash2(x, y, seed)`, `randomSeed()`. The arithmetic must never change: games pin it with `tests/rng-golden.test.js` (D-16). |
| `install.js` | pure | `installKind()`, `detectIOS()`, `detectStandalone()`: what "install as an app" can offer here (D-15). |
| `audio.js` | browser | `createAudio({ enabled, sounds, ramp })`: a WebAudio engine; the part passes its sound table, built on `tone()`. Never throws (D-17). |
| `langdom.js` | browser | `setupLang(i18n, { storage })`: `?lang=`, the saved choice, `data-i18n*` attributes, the `[data-lang]` switch (D-12). Needs `lang.js` only through the object passed in. |

## How it reaches each part

- **The launcher** imports from here directly: `import { … } from '../kit/<name>.js'` in `src/`.
- **A game** never imports from outside its own folder (rule 4). It lists the modules it uses in its `package.json`:

  ```json
  "kit": ["storage.js", "rng.js"]
  ```

  `npm run kit` (at the repo root) then writes `games/<slug>/src/kit/<name>.js`, a copy under a "generated" header, and
  the game imports `./kit/<name>.js`. The copies are committed. `tests/kit.test.js` fails when a copy is missing, has
  been edited, or is no longer listed.

## Rules

- **Never edit a copy.** Change the module here, run `npm run kit`, and commit the module and the copies together.
- A module has no knowledge of a game: no strings, sound tables, flag schemas, score shapes or storage prefixes. Those
  are passed in by the part that uses it.
- Modules are flat files named in lower case (`storage.js`). A module may import another one as `./<name>.js`; a game
  that lists the first must list the second too (the sync script says so).
- A module's first line starts with `// Pure` (no DOM, runs in Node) or `// Browser`; `npm test` checks the code agrees.
  A game that lists a browser module adds `kit/<name>.js` to its `browserModules`.
- Tests live in the root `tests/` folder as `kit-<name>.test.js` and run with the root `npm test`.
- Changing a module changes every part that uses it: run the root `npm test`, and check each of those parts in a browser
  when the module touches the DOM. A game with a service worker precache list (Garden Day) must list its kit copies there.
