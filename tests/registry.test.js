import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateMeta, toEntry, sortGames, serialize } from '../src/registry.js';
import { collect, ROOT } from '../tools/build-registry.mjs';

test('every games/<slug>/ has a valid game.json and index.html', () => {
  const { errors, games } = collect();
  assert.deepEqual(errors, []);
  assert.ok(games.length >= 2);
});

test('games.json is in sync with the game folders (run npm run registry)', () => {
  const { games } = collect();
  assert.equal(readFileSync(join(ROOT, 'games.json'), 'utf8'), serialize(games));
});

test('validateMeta rejects bad slugs and missing fields', () => {
  assert.deepEqual(validateMeta('ok-game', { title: 'T', description: 'D' }), []);
  assert.equal(validateMeta('Bad_Slug', { title: 'T', description: 'D' }).length, 1);
  assert.equal(validateMeta('ok', { description: 'D' }).length, 1);
  assert.equal(validateMeta('ok', { title: 'T', description: 'D', tags: 'x', order: 'first' }).length, 2);
  assert.equal(validateMeta('ok', []).length, 1);
});

test('toEntry makes paths relative to the site root', () => {
  const e = toEntry('demo', { title: 'Demo', description: 'D', thumbnail: './icons/a.png' });
  assert.equal(e.path, 'games/demo/');
  assert.equal(e.thumbnail, 'games/demo/icons/a.png');
  assert.deepEqual(e.tags, []);
});

test('sortGames puts ordered games first, then the rest by title', () => {
  const s = sortGames([{ title: 'Zed' }, { title: 'Beta', order: 2 }, { title: 'Alpha' }, { title: 'Gamma', order: 1 }]);
  assert.deepEqual(s.map((g) => g.title), ['Gamma', 'Beta', 'Alpha', 'Zed']);
});
