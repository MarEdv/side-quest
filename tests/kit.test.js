import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { collectKit, checkKit, writeKit, kitImports, header } from '../tools/sync-kit.mjs';

// A throwaway repo: files is { 'relative/path': 'text' }.
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'kit-test-'));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
}
const pkg = (kit) => JSON.stringify(kit === undefined ? { name: 'g' } : { name: 'g', kit });
const A = 'export const a = 1;\n';
const B = "import { a } from './a.js';\nexport const b = a + 1;\n";

test('the kit copies in this repo are in sync with kit/ (run npm run kit)', () => {
  assert.deepEqual(checkKit(), []);
});

test('kitImports finds static, re-exported and dynamic ./ imports only', () => {
  assert.deepEqual(kitImports("import { a } from './a.js';\nexport * from \"./b.js\";\nconst c = await import('./c.js');\nimport fs from 'node:fs';\nimport x from '../x.js';"), ['a.js', 'b.js', 'c.js']);
  assert.deepEqual(kitImports(A), []);
});

test('npm run kit writes a headed copy of each listed module, and only those', (t) => {
  const root = fixture({ 'kit/a.js': A, 'kit/b.js': B, 'games/one/package.json': pkg(['a.js']), 'games/two/package.json': pkg(), 'games/stub/game.json': '{}' });
  t.after(() => rmSync(root, { recursive: true }));
  assert.equal(checkKit(root).length, 1);
  assert.deepEqual(writeKit(root), { written: ['games/one/src/kit/a.js'], removed: [], errors: [] });
  assert.equal(readFileSync(join(root, 'games/one/src/kit/a.js'), 'utf8'), header('a.js') + A);
  assert.ok(!existsSync(join(root, 'games/two/src')));
  assert.deepEqual(checkKit(root), []);
  assert.deepEqual(writeKit(root).written, [], 'a second run changes nothing');
});

test('an edited copy, a missing copy and a left-over copy are all reported', (t) => {
  const root = fixture({ 'kit/a.js': A, 'kit/b.js': B, 'games/one/package.json': pkg(['a.js', 'b.js']) });
  t.after(() => rmSync(root, { recursive: true }));
  writeKit(root);
  writeFileSync(join(root, 'games/one/src/kit/a.js'), header('a.js') + 'export const a = 2;\n');
  rmSync(join(root, 'games/one/src/kit/b.js'));
  writeFileSync(join(root, 'games/one/src/kit/old.js'), 'x');
  const problems = checkKit(root);
  assert.equal(problems.length, 3);
  assert.match(problems.join('\n'), /a\.js differs/);
  assert.match(problems.join('\n'), /b\.js is missing/);
  assert.match(problems.join('\n'), /old\.js is not listed/);
});

test('a module dropped from "kit" is removed, and the empty folder with it', (t) => {
  const root = fixture({ 'kit/a.js': A, 'games/one/package.json': pkg(['a.js']) });
  t.after(() => rmSync(root, { recursive: true }));
  writeKit(root);
  writeFileSync(join(root, 'games/one/package.json'), pkg([]));
  assert.deepEqual(writeKit(root).removed, ['games/one/src/kit/a.js']);
  assert.ok(!existsSync(join(root, 'games/one/src/kit')));
  assert.ok(existsSync(join(root, 'games/one/src')));
});

test('a bad "kit" list is an error and nothing is written', (t) => {
  const root = fixture({
    'kit/a.js': A, 'kit/b.js': B, 'kit/c.js': "import './gone.js';\n",
    'games/unknown/package.json': pkg(['nope.js']),
    'games/needs/package.json': pkg(['b.js']),
    'games/shape/package.json': pkg('a.js'),
  });
  t.after(() => rmSync(root, { recursive: true }));
  const { errors } = collectKit(root);
  assert.equal(errors.length, 4);
  assert.match(errors.join('\n'), /kit\/c\.js imports \.\/gone\.js/);
  assert.match(errors.join('\n'), /games\/unknown\/package\.json: "kit" lists nope\.js/);
  assert.match(errors.join('\n'), /games\/needs\/package\.json: "kit" lists b\.js, which needs a\.js too/);
  assert.match(errors.join('\n'), /games\/shape\/package\.json: "kit" must be a list/);
  assert.deepEqual(writeKit(root).written, []);
  assert.ok(!existsSync(join(root, 'games/needs/src')));
});
