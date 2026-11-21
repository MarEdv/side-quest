import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import {
  stripCode, findAbsoluteUrls, findImports, checkRelativeUrls, checkImports, checkPackage,
  browserGlobalsIn, checkPurity, gameSlugs, checkGame, checkLauncher, checkKitModules, checkConventions,
  findUnusedCatchBindings, checkCatchStyle, checkI18nTest,
} from '../tools/check-conventions.mjs';
import { ROOT } from '../tools/build-registry.mjs';

// A throwaway folder: files is { 'relative/path': 'text' }.
function fixture(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'conv-test-'));
  t.after(() => rmSync(root, { recursive: true }));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
}

// ---- the real repo

test('the real repo lists the five games', () => {
  assert.deepEqual(gameSlugs(ROOT).sort(), ['garden-day', 'gem-miner', 'poo-sandwich', 'the-driver', 'train-attendant']);
});

for (const slug of ['garden-day', 'gem-miner', 'poo-sandwich', 'the-driver', 'train-attendant']) {
  test(`${slug} follows the conventions (relative URLs, imports, package.json, DOM-free logic)`, () => {
    assert.deepEqual(checkGame(ROOT, slug), []);
  });
}

test('the launcher keeps everything but launcher.js DOM-free', () => {
  assert.deepEqual(checkLauncher(ROOT), []);
});

test('checkConventions covers every game and the launcher', () => {
  assert.deepEqual(checkConventions(ROOT), []);
});

// ---- stripCode

test('stripCode blanks comments, regex literals and (optionally) string contents', () => {
  const src = "const a = 'window'; // document\n/* navigator */ const r = /window\\//g; const t = `x${location}y`;";
  const full = stripCode(src);
  assert.match(full, /'window'/);
  assert.doesNotMatch(full, /document|navigator/);
  assert.doesNotMatch(full.replace("'window'", ''), /window/, 'the regex literal is blanked');
  const bare = stripCode(src, { strings: false });
  assert.doesNotMatch(bare, /window/);
  assert.match(bare, /location/, 'code inside ${} stays visible');
  assert.equal(stripCode('a\n// c\nb').split('\n').length, 3, 'line numbers survive');
});

test('stripCode treats a division as division, not a regex', () => {
  assert.match(stripCode('const x = a / b; const y = c / d; // window'), /a \/ b; const y = c \/ d;/);
});

// ---- A: relative URLs

test('findAbsoluteUrls flags site-absolute references in html', () => {
  const html = '<link href="/style.css"><script src="/a.js"></script><img src=\'/x.png\'><style>b{background:url(/i.png)}</style>';
  assert.equal(findAbsoluteUrls('index.html', html).length, 4);
});

test('findAbsoluteUrls accepts relative, external, protocol-relative, data: and commented references', () => {
  const html = '<!-- <a href="/old"> --><link href="style.css"><script src="./a.js"></script><a href="https://x.org/">x</a>'
    + '<img src="data:image/png;base64,AAAA"><script src="//cdn.example/a.js"></script><b>bold</b></b><a href="#top">t</a>';
  assert.deepEqual(findAbsoluteUrls('index.html', html), []);
});

test('findAbsoluteUrls flags absolute fetch, register, import, from and .src assignments in scripts', () => {
  const js = "fetch('/a.json'); navigator.serviceWorker.register('/sw.js'); import x from '/m.js'; await import('/n.js'); img.src = '/i.png';";
  assert.equal(findAbsoluteUrls('main.js', js).length, 5);
});

test('findAbsoluteUrls ignores regex literals, // comments, closing tags in strings and relative calls', () => {
  const js = "// fetch('/a')\nconst re = /\\/a\\/b/; const s = '</b>'; fetch('a.json'); fetch('https://x.org/a'); register('./sw.js'); const d = a / b;";
  assert.deepEqual(findAbsoluteUrls('main.js', js), []);
});

test('findAbsoluteUrls flags absolute css urls and imports, not comments', () => {
  assert.equal(findAbsoluteUrls('s.css', "a{background:url('/i.png')} @import '/x.css';").length, 2);
  assert.deepEqual(findAbsoluteUrls('s.css', '/* url(/i.png) */ a{background:url(i.png)} b{background:url(data:image/png;base64,AA)}'), []);
});

test('findAbsoluteUrls checks the manifest start_url, scope and icon src', () => {
  const bad = JSON.stringify({ start_url: '/', scope: '/g/', icons: [{ src: '/i.png' }, { src: 'ok.png' }] });
  assert.equal(findAbsoluteUrls('manifest.webmanifest', bad).length, 3);
  assert.deepEqual(findAbsoluteUrls('manifest.webmanifest', JSON.stringify({ start_url: './', scope: './', icons: [{ src: 'icons/a.png' }] })), []);
});

test('checkRelativeUrls reads a game folder but skips tests, tools and docs', (t) => {
  const dir = fixture(t, {
    'index.html': '<a href="/x">x</a>', 'src/a.js': "fetch('/a')", 'sw.js': "register('/sw.js')",
    'tests/t.js': "fetch('/ok-in-tests')", 'tools/t.mjs': "fetch('/ok')", 'docs/x.html': '<a href="/ok">', 'node_modules/x/y.js': "fetch('/ok')",
  });
  const problems = checkRelativeUrls(dir, 'g');
  assert.equal(problems.length, 3);
  assert.match(problems.join('\n'), /g\/index\.html:1:/);
  assert.match(problems.join('\n'), /g\/src\/a\.js:1:/);
  assert.match(problems.join('\n'), /g\/sw\.js:1:/);
});

// ---- B: imports

test('findImports finds static, re-export, side-effect and dynamic imports, not comments or strings', () => {
  const src = "import a from './a.js';\nimport { b,\n  c } from \"./b.js\";\nexport * from './c.js';\nexport { d } from './d.js';\nimport './e.js';\nconst f = await import('./f.js');\n"
    + "// import z from './z.js'\nconst s = \"import q from './q.js'\"; export const k = 1;\nimport * as ns from '../n.js';";
  assert.deepEqual(findImports(src).map((i) => i.spec), ['./a.js', './b.js', './c.js', './d.js', './e.js', './f.js', '../n.js']);
});

test('checkImports accepts relative files inside the game and node: builtins in tests/ and tools/', (t) => {
  const dir = fixture(t, {
    'src/a.js': "import { b } from './b.js';\nexport const a = b;", 'src/b.js': 'export const b = 1;',
    'tests/a.test.js': "import test from 'node:test';\nimport { a } from '../src/a.js';\nawait import('../src/b.js');",
    'tools/t.mjs': "import { readFileSync } from 'node:fs';",
  });
  assert.deepEqual(checkImports(dir, 'g'), []);
});

test('checkImports flags leaving the game, packages, absolute paths, URLs, missing files and node: in src/', (t) => {
  const dir = fixture(t, {
    'src/a.js': [
      "import x from '../../../src/i18n.js';", "import y from 'lodash';", "import z from '/abs.js';",
      "import w from 'https://x.org/m.js';", "import v from './missing.js';", "import fs from 'node:fs';", "export * from '../../other/x.js';",
    ].join('\n'),
    'tests/t.test.js': "import q from 'left-pad';\nawait import('../../../kit/storage.js');",
  });
  const problems = checkImports(dir, 'g');
  assert.equal(problems.length, 9);
  const all = problems.join('\n');
  assert.match(all, /g\/src\/a\.js:1: import '\.\.\/\.\.\/\.\.\/src\/i18n\.js' leaves the game folder/);
  assert.match(all, /import 'lodash' is not a relative path/);
  assert.match(all, /import '\/abs\.js' is not a relative path/);
  assert.match(all, /import 'https:\/\/x\.org\/m\.js' is not a relative path/);
  assert.match(all, /import '\.\/missing\.js' does not resolve/);
  assert.match(all, /import 'node:fs' is a Node builtin/);
  assert.match(all, /g\/tests\/t\.test\.js:1: import 'left-pad'/);
  assert.match(all, /g\/tests\/t\.test\.js:2: import '\.\.\/\.\.\/\.\.\/kit\/storage\.js' leaves/);
});

// ---- C: package.json

const GOOD_PKG = { private: true, type: 'module', scripts: { start: 'python3 -m http.server 8000', test: 'node --test tests/*.test.js' } };

test('checkPackage accepts the standard package.json', () => {
  assert.deepEqual(checkPackage(GOOD_PKG, 'g'), []);
});

test('checkPackage flags each deviation', () => {
  assert.equal(checkPackage({ ...GOOD_PKG, private: false }, 'g').length, 1);
  assert.equal(checkPackage({ ...GOOD_PKG, type: undefined }, 'g').length, 1);
  assert.equal(checkPackage({ ...GOOD_PKG, scripts: { ...GOOD_PKG.scripts, test: 'node --test' } }, 'g').length, 1);
  assert.equal(checkPackage({ ...GOOD_PKG, scripts: { ...GOOD_PKG.scripts, start: 'npx serve' } }, 'g').length, 1);
  assert.equal(checkPackage({}, 'g').length, 4);
  assert.match(checkPackage(null, 'g')[0], /missing/);
});

// ---- D, E: purity

test('browserGlobalsIn finds browser globals in code only', () => {
  assert.deepEqual(browserGlobalsIn('const t = document.title + window.innerWidth; localStorage.getItem(1);'), ['document', 'localStorage', 'window']);
  assert.deepEqual(browserGlobalsIn("// window\n/* document */ const s = 'navigator'; const r = /location/; const o = { a: x.location, b: y.performance };"), []);
  assert.deepEqual(browserGlobalsIn("if (typeof location !== 'undefined') f(location.search);"), ['location']);
  assert.deepEqual(browserGlobalsIn('const f = `${performance.now()}`; const imageCount = 1; const Imagery = 2;'), ['performance']);
  // An object key is not a use of the global (a table of strings may have a key called fetch); its value still counts.
  assert.deepEqual(browserGlobalsIn("const S = { fetch: 'hämta', deliver: 'lämna',\n  location: 'plats' };"), []);
  assert.deepEqual(browserGlobalsIn('const o = { win: window, fetch: fetch }; const v = a ? document : b;'), ['document', 'fetch', 'window']);
});

test('checkPurity passes when the list matches what the modules do', (t) => {
  const src = fixture(t, { 'a.js': 'export const a = 1; // window', 'main.js': 'document.title = "x";', 'kit/s.js': 'export const s = 1;' });
  assert.deepEqual(checkPurity(src, ['main.js'], 'g'), []);
});

test('checkPurity flags a logic module that touches the browser, including generated kit copies', (t) => {
  const src = fixture(t, { 'a.js': 'export const t = () => document.title;', 'main.js': 'window.x = 1;', 'kit/s.js': 'export const s = localStorage;' });
  const problems = checkPurity(src, ['main.js'], 'g');
  assert.equal(problems.length, 2);
  assert.match(problems.join('\n'), /g\/src\/a\.js touches the browser \(document\)/);
  assert.match(problems.join('\n'), /g\/src\/kit\/s\.js touches the browser \(localStorage\)/);
});

test('checkPurity flags a listed module that is pure or missing, and a bad list', (t) => {
  const src = fixture(t, { 'a.js': 'export const a = 1;', 'main.js': 'window.x = 1;' });
  const problems = checkPurity(src, ['main.js', 'a.js', 'gone.js'], 'g');
  assert.equal(problems.length, 2);
  assert.match(problems.join('\n'), /a\.js is in "browserModules" but uses no browser global/);
  assert.match(problems.join('\n'), /lists gone\.js/);
  assert.match(checkPurity(src, null, 'g')[0], /"browserModules" must be a list/);
  assert.match(checkPurity(src, [1], 'g')[0], /"browserModules" must be a list/);
});

test('checkGame runs every check on a game folder', (t) => {
  const root = fixture(t, {
    'games/g/index.html': '<script src="/x.js"></script>',
    'games/g/package.json': JSON.stringify({ ...GOOD_PKG, scripts: { start: 'x', test: 'y' }, browserModules: [] }),
    'games/g/src/a.js': "import l from 'lodash'; export const t = document.title;",
  });
  const all = checkGame(root, 'g').join('\n');
  assert.match(all, /index\.html:1/);
  assert.match(all, /import 'lodash'/);
  assert.match(all, /scripts\.start/);
  assert.match(all, /src\/a\.js touches the browser/);
});

test('the kit modules in this repo say Pure or Browser, and mean it', () => {
  assert.deepEqual(checkKitModules(join(ROOT, 'kit')), []);
});

test('checkKitModules flags a missing label and a label the code contradicts', (t) => {
  const kit = fixture(t, {
    'ok.js': '// Pure: no DOM.\nexport const a = 1;',
    'dom.js': '// Browser: reads the page.\nexport const title = () => document.title;',
    'nolabel.js': '// Helpers.\nexport const a = 1;',
    'liar.js': '// Pure: honest.\nexport const w = () => window.innerWidth;',
    'shy.js': '// Browser: or so it says.\nexport const a = 1;',
    'README.md': 'not a module',
  });
  const problems = checkKitModules(kit);
  assert.equal(problems.length, 3);
  assert.match(problems.join('\n'), /kit\/nolabel\.js: the first line must start with/);
  assert.match(problems.join('\n'), /kit\/liar\.js says Pure but touches the browser \(window\)/);
  assert.match(problems.join('\n'), /kit\/shy\.js says Browser but uses no browser global/);
});

// ---- catch style and i18n tests

test('findUnusedCatchBindings flags a binding the block never uses', () => {
  const hits = findUnusedCatchBindings('a.js', 'try { x(); } catch (_) { /* ignore */ }\ntry { y(); } catch (e) { if (ok) { z(); } }');
  assert.equal(hits.length, 2);
  assert.match(hits[0], /^a\.js:1: catch \(_\) never uses _; write `catch \{`/);
  assert.match(hits[1], /^a\.js:2: catch \(e\)/);
});

test('findUnusedCatchBindings accepts used bindings and bare catch; comments and strings do not count as use', () => {
  assert.deepEqual(findUnusedCatchBindings('a.js', 'try {} catch { }\ntry {} catch (e) { log(e.message); }\ntry {} catch (err) { if (a) { throw err; } }'), []);
  assert.deepEqual(findUnusedCatchBindings('a.js', 'try {} catch ($) { f($); }'), []);
  assert.equal(findUnusedCatchBindings('a.js', "try {} catch (e) { /* e */ log('e'); }").length, 1);
  assert.equal(findUnusedCatchBindings('a.js', 'try {} catch (e) { const el = 1; } const e2 = e;').length, 1);
});

test('checkCatchStyle reads the named folders of a part', (t) => {
  const root = fixture(t, {
    'src/a.js': 'try {} catch (_) {}',
    'tools/b.mjs': 'try {} catch (e) { throw e; }',
    'other/c.js': 'try {} catch (_) {}',
  });
  const problems = checkCatchStyle(root, ['src', 'tools'], 'p');
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^p\/src\/a\.js:1: catch \(_\)/);
  assert.equal(checkCatchStyle(root, [''], 'p').length, 2);
});

test('checkI18nTest wants stringProblems( and, with data-i18n keys, missingHtmlKeys(', (t) => {
  const ok = fixture(t, { 'index.html': '<p data-i18n="a"></p>', 'tests/i18n.test.js': 'stringProblems(S); missingHtmlKeys(h, S);' });
  assert.deepEqual(checkI18nTest(ok, 'g'), []);
  const noHtml = fixture(t, { 'index.html': '<p></p>', 'tests/i18n.test.js': 'stringProblems(S);' });
  assert.deepEqual(checkI18nTest(noHtml, 'g'), []);
  const bad = fixture(t, {
    'index.html': '<p data-i18n="a"></p>',
    'tests/i18n.test.js': '// stringProblems(S) and missingHtmlKeys(h, S)\nconst s = "stringProblems(";',
  });
  const problems = checkI18nTest(bad, 'g').join('\n');
  assert.match(problems, /g\/tests\/i18n\.test\.js must call stringProblems\(/);
  assert.match(problems, /g\/tests\/i18n\.test\.js must call missingHtmlKeys\(/);
  const onlyStrings = fixture(t, { 'index.html': '<p data-i18n="a"></p>', 'tests/i18n.test.js': 'stringProblems(S);' });
  assert.match(checkI18nTest(onlyStrings, 'g').join('\n'), /missingHtmlKeys/);
  assert.match(checkI18nTest(fixture(t, { 'index.html': '' }), 'g')[0], /g\/tests\/i18n\.test\.js is missing/);
});

test('checkGame and checkLauncher run the catch and i18n checks', (t) => {
  const root = fixture(t, {
    'games/g/package.json': JSON.stringify({ ...GOOD_PKG, browserModules: [] }),
    'games/g/src/a.js': 'export const f = () => { try { return 1; } catch (_) { return 0; } };',
    'games/g/tests/i18n.test.js': '// nothing',
    'src/launcher.js': 'try { window.x(); } catch (_) {}',
    'tools/t.mjs': 'try {} catch (_) {}',
    'tests/i18n.test.js': '// nothing',
  });
  const game = checkGame(root, 'g').join('\n');
  assert.match(game, /games\/g\/src\/a\.js:1: catch \(_\)/);
  assert.match(game, /games\/g\/tests\/i18n\.test\.js must call stringProblems\(/);
  const launcher = checkLauncher(root).join('\n');
  assert.match(launcher, /launcher\/src\/launcher\.js:1: catch \(_\)/);
  assert.match(launcher, /launcher\/tools\/t\.mjs:1: catch \(_\)/);
  assert.match(launcher, /launcher\/tests\/i18n\.test\.js must call stringProblems\(/);
});

test('the real kit uses the bare catch where the error is unused', () => {
  assert.deepEqual(checkCatchStyle(join(ROOT, 'kit'), [''], 'kit'), []);
});
