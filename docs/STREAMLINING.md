# Streamlining the launcher and the three games

Analysis of how the four parts (launcher, Garden Day, Gem Miner, Poo Sandwich) solve the same technical problems, where
they differ, and a prioritised plan to align them. Written 2026-11-15 against commit `e62de2a`. Nothing in this document
had been implemented when it was written (D-8 in `DECISIONS.md`); section 4 tracks progress.

## 1. Summary

The four parts agree on the big things: zero dependencies, vanilla ES modules, no build step, pure logic modules tested
with `node --test` and `node:assert/strict`, English and Swedish with the same language rules, and a
requirements-plus-decision-log process. All 289 tests pass (22 root, 175 Garden Day, 64 Gem Miner, 28 Poo Sandwich).

Below that level, the same problem is solved two to four times, each slightly differently:

- **Eight pieces of generic code exist as hand-made copies**: language picking, text lookup, the `data-i18n` text
  applier, the EN/SV switch, the storage wrapper, the seeded random generator, the audio engine and the URL flag parser.
  The copies have already drifted apart in behaviour, not only in style (section 3).
- **Rule 4 ("games stay self-contained") is why the copies exist**, and nothing checks either the rule or the copies.
- **Poo Sandwich is the outlier in infrastructure** (raw `localStorage`, no sound, RNG inside `game.js`, scores recorded
  in debug runs). **Garden Day is the outlier in presentation** (CSS inline in `index.html`, screens built in JS, its own
  `t()` signature).

The recommendation is one mechanism plus a sequence of small adoptions:

1. Keep rule 4, but make the copies deliberate: a canonical `kit/` folder at the repo root, synced into each game by a
   script and guarded by a test, the same way `games.json` is generated, committed and checked today (S-1).
2. Add a root conventions test so the alignment cannot silently erode (S-2).
3. Move the duplicated code into the kit one module at a time, language and storage first (S-3 to S-10).
4. Align lighter-weight conventions (HTML shell, flags, docs) and leave the genuinely game-specific code alone
   (section 6).

Section 4 lists the 17 tasks in priority order with a model for each; section 5 says how Fable orchestrates them.

## 2. How to share code without breaking rule 4

Rule 4 says a game works both at `games/<slug>/` and served on its own, and never imports from the launcher or another
game. That rules out a shared module that games import at runtime. Three options remain:

| Option | What it means | Verdict |
|--------|---------------|---------|
| Convention only | Keep hand-made copies, document the pattern. | This is today. Section 3 shows the copies drift. |
| **Synced kit** | Canonical modules in root `kit/`. `npm run kit` copies them into `games/<slug>/src/kit/` with a "generated, do not edit" header. A root test fails when a copy differs. The launcher imports `kit/` directly. | **Recommended.** Games stay self-contained (the copy is inside the folder), and the repo already uses this pattern for `games.json` (D-3). |
| Relax rule 4 | Games import `../../kit/`. | A game no longer works served on its own; reverses a non-negotiable rule for a small saving. |

What belongs in the kit: code that has no knowledge of any one game. Language rules, the storage wrapper, the random
generator, the audio engine, the flag parser, the install-detection helpers. What does not: strings, sound tables, flag
schemas, score shapes, rendering, input.

A game that copies only the kit modules it uses is fine; the sync script takes a per-game list (a `"kit"` array in the
game's `package.json` is the simplest place).

## 3. Findings by area

Each table shows what the four parts do today and the proposed target. "GD" is Garden Day, "GM" Gem Miner, "PS" Poo
Sandwich.

### 3.1 Language (i18n)

| | Launcher | GD | GM | PS |
|---|---|---|---|---|
| `normalizeLang`, `pickLang` | identical copies in all four | | | |
| `t()` signature | `t(lang, key)`, no placeholders | `t(key, vars)`, module-level current language (`setLang`) | `t(lang, key, vars)` | `t(lang, key, vars)` |
| How the language reaches the code | variable in `launcher.js` | global in `i18n.js` | `state.lang`, `ui.setLang`, a `T` wrapper in `main.js` | `renderer.setLang`, variable in `main.js` |
| Static texts | `data-i18n`, `-html`, `-aria` walker | none: screens are built in JS | same walker plus `data-i18n-title` | same walker as the launcher |
| EN/SV switch | `#lang`, click handler | built in `ui.js` | `#langSwitch`, same handler | `#langSwitch`, same handler |
| A `?lang=` in the URL is remembered | **no** | yes | yes | yes |
| Saved under | `launcher.lang` (raw) | `sidequest.v1.lang` (JSON) | `gem-miner.lang` (JSON) | `poo-sandwich-lang` (raw) |
| Text in data tables | n/a | `tx(english)` | `NAMES` by id | `name(lang, english)` |
| Locale formatting | none | `dateLocale()` | `num()` | none |

Target: `kit/lang.js` (pure: `LANGS`, `normalizeLang`, `pickLang`, `setLang`/`getLang`, a `t(key, vars)` built from the
part's own `STRINGS`) and `kit/langdom.js` (browser: read `?lang=` and the saved choice, remember both, apply
`data-i18n*` attributes, wire a `[data-lang]` switch). Each part keeps only its string tables and name lookups.

Garden Day's signature is the better one to standardise on: a single current language removes the three different ways
the other parts thread `lang` through renderers, UI and game state. The launcher should also remember `?lang=` so all
four follow the rule `ADDING-A-GAME.md` already states.

### 3.2 Persistence

| | Launcher | GD | GM | PS |
|---|---|---|---|---|
| Wrapper | inline `try/catch` | `createStorage(backend)` | `createStorage(backend)` | inline `try/catch`, three places |
| When a write fails | not remembered | gives up for the session; later reads prefer memory (D-22) | **retries every write** (D24) | not remembered |
| Key scheme | `launcher.lang` | `sidequest.v1.<key>` (legacy name, must stay) | `gem-miner.<key>` | `poo-sandwich-<key>` |
| Value format | raw string | JSON | JSON | raw string / number |
| Stored data sanitised on read | n/a | yes (`sanitizeArcade`, settings) | yes (`normalizeScores`, `restore`) | `Number(x) \|\| 0` |
| Debug runs recorded | n/a | never (D-22) | never | **yes** |

The two `createStorage` files started as the same code and now disagree on the one interesting case. Gem Miner's D24
(retry, because quota errors are often temporary) is the later and better-argued decision; Garden Day still carries the
older behaviour. Target: one `kit/storage.js` taking `(backend, prefix)` with the D24 semantics, adopted by all four.
Existing keys stay readable: Garden Day keeps its prefix, and Poo Sandwich's two raw-string keys need a read-side
migration (`sv` is not valid JSON).

Score shapes differ for good reasons (arcade list and level records, best times per world size, a single best score) and
should not be unified. One rule should hold everywhere: a run with `debug` on is never recorded. Poo Sandwich breaks it.

### 3.3 Random numbers

Three copies of mulberry32: `createRng(seed)` returning helpers in GD (`rng.js`), a bare `mulberry32(seed)` plus `hash2`
and `randomSeed` in GM (`rng.js`), and a bare `mulberry32` inside PS's `game.js`. The core arithmetic is the same; the
zero-seed handling differs (GD substitutes `0x9e3779b9`, PS callers pass `|| 1`, GM accepts 0). Target: one `kit/rng.js`
with all the helpers. The sequences must stay bit-identical: Gem Miner rebuilds saved worlds from the seed, and Garden
Day's level tuning (D-28) depends on its sequences. Golden-sequence tests go in first.

### 3.4 Audio

| | GD | GM | PS |
|---|---|---|---|
| API | `createAudio(bool)`, `setEnabled(on)` | `createAudio({ enabled })`, `enabled` setter | no sound |
| Resume | any non-running state, including iOS `interrupted`; rejection caught | `suspended` only; **`resume()` promise not caught** | |
| Errors | constructor guarded | everything guarded; turns itself off on failure | |

Target: `kit/audio.js` with the engine (lazy context, unlock on gesture, resume, one `tone()` primitive, enable/disable)
taking Garden Day's resume handling and Gem Miner's guarding; each game keeps its own sound table. This also fixes two
small Gem Miner defects: sound that does not come back after an iOS interruption, and a possible unhandled promise
rejection. Giving Poo Sandwich sound is a feature, not an alignment, and is left out.

### 3.5 Flags and settings

| | GD | GM | PS |
|---|---|---|---|
| File | `src/config.js` | `src/flags.js` | `src/flags.js` (`config.js` here means tunables) |
| Parser | schema-driven (`ENUMS`, `NUMBERS`, `BOOLS`) | hand-written per flag | hand-written per flag |
| Booleans accept | `1/0/true/false/on/off/yes/no` | `1/0` | `debug=1` only |
| Touch scheme flag | `touchScheme` | `touchControls` | `controls` |
| Touch on/off flag | `touch=auto/on/off` | `touch=auto/on/off` | folded into `controls=auto` |
| Day length | `dayLength` | n/a | `daySeconds` |
| Seed | `seed=random` or integer | `seed` integer or absent | no flag (`Date.now()`) |
| In-game settings screen | yes, saved | sound toggle, not saved | no |
| Documented in | `docs/FLAGS.md` | REQUIREMENTS §3.7 | REQUIREMENTS §2.3 |

Target: Garden Day's schema-driven parser as `kit/flags.js`; each game declares a schema. Same name for the same concept
(`touch`, `touchScheme`, `sound`, `seed`, `debug`, `dayLength`), with the old names accepted as aliases. Flags file
named `flags.js` everywhere, documented in `docs/FLAGS.md` everywhere. A settings screen for the other two games is a
feature and is left out.

### 3.6 Page shell and presentation

| | Launcher | GD | GM | PS |
|---|---|---|---|---|
| CSS | `launcher.css` | **about 180 lines inline in `index.html`** | `style.css` | `style.css` |
| Screens | static HTML | built in JS (`ui.js`, `settingsui.js`, `levelsui.js`, `installui.js`) | static HTML + `ui.js` | static HTML + `main.js` |
| Viewport | no zoom lock | no zoom lock | `user-scalable=no` | `user-scalable=no` |
| Favicon | PNG | PNG | emoji data URI | emoji data URI |
| Link back to the launcher | n/a | none | "Back to games" | none |
| Installable / offline | manifest, no worker (L-8) | manifest + service worker | neither | neither |
| `window` debug hook | n/a | `__state` | `__gem` | `__game` |
| Device pixel ratio | n/a | uncapped, watched | capped at 2, watched | capped at 3, not watched |

Targets: Garden Day's CSS moves to `style.css` (its service worker precache list and cache version must change in the
same commit); every game links back to `../../`; one head-tag set; one debug hook name. The screen-building approach is
not worth unifying (section 6), but new games should use static HTML with `data-i18n`, the majority pattern.

Install-detection logic (`detectIOS`, `detectStandalone`) and the PNG encoder in `make-icons.mjs` are already
copy-pasted between the launcher and Garden Day, with comments saying so. Both belong in the kit.

Offline support is a product question rather than an alignment: the launcher installs as an app whose scope covers every
game, but only Garden Day works offline. Either every game gets a worker or the gap stays documented. It needs the
owner's call and is listed last.

### 3.7 Game loop and input

| | GD | GM | PS |
|---|---|---|---|
| Timestep | fixed 1/60 with accumulator, frame clamp 0.25 s | variable, clamp 0.05 s | variable, clamp 0.1 s |
| Loses focus | pauses | clears input and saves; **does not pause** (the score is a time) | pauses |
| Input modules | `input.js` + `touch.js` + pure `touchmath.js` | `input.js` + pure `touchmath.js` | `input.js` only |
| Touch detection | `touchActive(mode, hasTouch)` | same function, separate copy | pointer type per event |
| Stick radius / dead zone | 60 / 0.15 | 56 / 0.28 | 56 / none |

A fixed timestep makes behaviour independent of frame rate and is worth adopting in the other two, but it changes game
feel and needs play-testing, so it ranks low. Input is tied to each game's mechanics (analog walk, four-way dig,
tap-to-move); only the touch-detection rule and the focus-loss behaviour should be the same.

### 3.8 Tests and tooling

Consistent already: `test()` with `node:assert/strict` everywhere, tests next to each part, root `npm test` running all.

Gaps:

- **Rule 4 is not tested.** No check for absolute URLs or cross-game imports. (A scan finds no violations today.)
- **Purity is tested in one game.** Gem Miner's `purity.test.js` verifies that logic modules do not touch the DOM; the
  other two games state the rule in `CLAUDE.md` only.
- **i18n checks differ.** All four test key parity. "Every `data-i18n` key exists" is tested in three (Garden Day has no
  such attributes); placeholder parity in three (the launcher has no placeholders).
- Test script: `node --test` (GD) against `node --test tests/*.test.js` (the others).
- Error style: `catch {}` in GD and GM, `catch (_)` in PS and the launcher.

### 3.9 Docs and process

| | Root | GD | GM | PS |
|---|---|---|---|---|
| Decision IDs | `D-7` | `D-31` | `D29` | `D19` |
| Decision heading | `### D-n — title (date)` | same | `## Dn — date — title` | `## Dn — date — title` |
| Status legend | ✅ 🚧 📋 ❌ | same | same, other wording | ✅ 🚧 ⏳, no "retired" |
| `CLAUDE.md` shape | Non-negotiable / Layout / Commands / Deploy | Non-negotiable / Layout / Commands | Always / Tech / Commands / Deploy | Always / Tech / Commands / Deploy |
| Says "run `npm test` before committing" | yes | yes | yes | **no** |
| States the storage key prefix | n/a | no | yes | no |

Garden Day's `CLAUDE.md` also has a damaged sentence: the "only `main.js`, `render.js`, `input.js`, `audio.js` may"
clause was separated from the DOM rule it belongs to when the i18n bullet was inserted, and the list is out of date
(`ui.js`, `touch.js`, `install.js` touch the DOM too).

Existing IDs are referenced from code comments and must not be renumbered. The legend, the `CLAUDE.md` skeleton and the
format of new entries can be aligned.

## 4. Prioritised tasks

Progress: **S-1 done** 2026-11-15 (D-9, requirements K-1..K-4).

Priority reflects value against risk: P1 is the foundation and the two largest sources of drift; P2 is the remaining
duplicated code and visible inconsistencies; P3 changes behaviour or needs an owner decision.

Models: **Fable** takes tasks where one design decision binds all four parts or the failure semantics are subtle.
**Opus** takes multi-file refactors inside one or two games where tests cover the logic but not the wiring. **Sonnet**
takes mechanical work with a precise spec and results pinned by tests. Fable reviews and merges every task (section 5).

| # | Pri | Task | Parts | Size | Model | Why this model |
|---|-----|------|-------|------|-------|----------------|
| S-1 | P1 | Kit mechanism: root `kit/`, `tools/sync-kit.mjs` (`npm run kit`), drift test, rules in root `CLAUDE.md` and `ADDING-A-GAME.md`, decision entry. | repo | M | Fable | Sets the pattern every later task follows; amends repo rules. |
| S-2 | P1 | Root `tests/conventions.test.js`: no absolute URLs or cross-part imports in games (rule 4); each game has `package.json` with the standard test script; logic modules are DOM-free (generalise GM's purity test; each game lists its browser modules). | repo, all games | S | Sonnet | Clear spec, existing test to generalise. |
| S-3 | P1 | `kit/lang.js` + `kit/langdom.js`: design the API (section 3.1), with tests. | kit | M | Fable | One API for four call sites that work differently today. |
| S-4 | P1 | Adopt the language kit in the launcher and Poo Sandwich; the launcher remembers `?lang=`. | launcher, PS | S | Sonnet | Both already use the walker and switch the kit provides. |
| S-5 | P1 | Adopt the language kit in Gem Miner (drop `state.lang`, `ui.setLang`, the `T` wrapper) and Garden Day (keep `tx`, `summaryText`, `dateLocale`). | GM, GD | M | Opus | Signature change across `game.js`, `ui.js`, `main.js` and their tests. |
| S-6 | P1 | `kit/storage.js` with D24 semantics and a prefix argument; tests merged from both games. | kit | S | Fable | Two decision logs to reconcile; a mistake loses player data. |
| S-7 | P1 | Adopt storage in all four. Keep Garden Day's prefix; migrate Poo Sandwich's raw keys on read; launcher uses prefix `launcher.`. Poo Sandwich stops recording scores in debug runs. | all | M | Opus | Migration of live data in three key formats. |
| S-8 | P2 | `kit/rng.js` (mulberry32, helpers, `hash2`, `randomSeed`); golden-sequence tests first; adopt in all three games, moving PS's copy out of `game.js`. | kit, games | S | Sonnet | Mechanical; the golden tests catch any change in sequence. |
| S-9 | P2 | `kit/audio.js` engine; GD and GM keep their sound tables; verify in a browser, including mute/unmute. | kit, GD, GM | M | Opus | Cannot be unit-tested; merges two error-handling styles. |
| S-10 | P2 | `kit/flags.js` from GD's schema parser; schemas per game; shared names with old names as aliases; `config.js` → `flags.js` in GD; `docs/FLAGS.md` in GM and PS. | kit, games | M | Opus | Touches every flag consumer; aliases must keep old links working. |
| S-11 | P2 | Garden Day CSS to `style.css`, including the service worker precache list and cache version; one head-tag set and one debug hook name (`window.__game`) across games. | GD, GM, PS | S | Opus | Mechanical except for the worker: a stale precache breaks installed copies. |
| S-12 | P2 | "Back to games" link (`../../`, translated) in Garden Day and Poo Sandwich; retire assumption A-2. | GD, PS | S | Sonnet | Copy of an existing pattern. |
| S-13 | P2 | Move `detectIOS` / `detectStandalone` and the PNG encoder into the kit; launcher and GD use them. | kit, launcher, GD | S | Sonnet | The code is already identical. |
| S-14 | P2 | Docs: one status legend; one `CLAUDE.md` skeleton (repair GD's DOM rule, add the test and key-prefix rules to PS); `D-n — title (date)` for new decisions; README run instructions. No renumbering. | all | S | Sonnet | Text-only, checklist-driven. |
| S-15 | P2 | Style pass: `catch {}` everywhere, `node --test tests/*.test.js` everywhere, same i18n test set per part; extend S-2 to check them. | all | S | Sonnet | Search-and-replace plus test additions. |
| S-16 | P3 | Fixed 1/60 timestep in Gem Miner and Poo Sandwich; same focus-loss rule (pause); DPR capped and watched the same way; one `touchActive` in the kit. | GM, PS, GD | M | Opus | Changes game feel; needs play-testing and a balance check with `tools/sim.mjs`. |
| S-17 | P3 | Offline: decide whether every game gets Garden Day's service worker and manifest, or the gap stays documented. | owner, then GM, PS | L | Fable | Product decision first; worker scope and cache mistakes are hard to undo on installed devices. |

Size: S is under about 100 changed lines, M a few hundred, L more or with real design work.

## 5. How Fable runs the plan

Fable is the orchestrator for every task, including the ones another model implements:

1. **Brief.** Fable writes the task brief: the goal, the files in scope, the target API (from the kit), the acceptance
   checks, and the reminder that work inside `games/<slug>/` follows that game's `CLAUDE.md` (requirements and decision
   log updated in the same commit).
2. **Delegate.** One subagent per task on the model in the table, each in its own git worktree and branch.
3. **Verify.** Fable reads the diff, runs `npm test` at the root, and for anything touching the browser (S-4, S-5, S-7,
   S-9, S-11, S-12, S-16) loads the launcher and the affected games in headless Chrome in both languages.
4. **Merge** one task at a time, then start the next wave.

Order and parallelism:

| Wave | Tasks | Notes |
|------|-------|-------|
| 1 | S-1, then S-2 and S-14 in parallel | S-14 is text-only and conflicts with nothing. |
| 2 | S-3 and S-6 (Fable, kit only) | Kit modules land with tests before anyone adopts them. |
| 3 | S-4, S-5 | Split by part, so they can run in parallel. |
| 4 | S-7 | Alone: touches `main.js` in every part. |
| 5 | S-8, S-13 in parallel, then S-9, S-10 | S-9 and S-10 both edit GD's and GM's `main.js`: run one after the other. |
| 6 | S-11, S-12, then S-15 | S-15 last so its checks cover the final state. |
| 7 | S-16, S-17 | Only after an owner decision on S-17. |

Each wave leaves the repo green and deployable, so the plan can stop after any wave. Waves 1 to 4 (P1) deliver most of
the value: the mechanism, the guard rails, and the two areas where copies have diverged in behaviour.

## 6. Deliberately not aligned

- **How screens are built.** Garden Day builds its menus in JS; the others use static HTML. Rewriting either way is a
  large change with no effect a player would notice.
- **Input handling.** Each game's input matches its mechanics. Only touch detection is shared (S-16).
- **Score and save formats.** Different games record different things. The shared rules are "sanitise on read" and "no
  debug runs", both covered by S-7.
- **Existing requirement and decision IDs** (`D24`, `F13`, `P-6`). Code comments cite them.
- **Storage key names.** Renaming loses player progress (root D-5 made the same call for Garden Day).
- **Sound and a settings screen for Poo Sandwich, settings for Gem Miner.** Features, not alignment.

## 7. Assumptions

- The owner asked for analysis and a plan, not implementation. No code was changed.
- Rule 4 stays as written; the kit is designed around it.
- Model names refer to the Claude Code models available as subagents: Fable (orchestrator), Opus, Sonnet.
- Sizes are estimates from reading the code, not from attempting the changes.
