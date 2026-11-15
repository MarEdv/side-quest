import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const BROWSER = new Set(['main.js', 'render.js', 'input.js', 'audio.js', 'ui.js']);
const FORBIDDEN = /\b(document|window|localStorage|sessionStorage|navigator|requestAnimationFrame|HTMLElement|AudioContext|Image|OffscreenCanvas|location|innerWidth|innerHeight|devicePixelRatio)\b/;

test('logic modules do not reference the DOM or browser globals', () => {
  const logic = readdirSync(SRC).filter((f) => f.endsWith('.js') && !BROWSER.has(f));
  assert.ok(logic.length >= 12, `found ${logic.join(', ')}`);
  for (const f of logic) {
    const code = readFileSync(join(SRC, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g, '""');
    assert.doesNotMatch(code, FORBIDDEN, `${f} touches a browser global`);
  }
});

test('localStorage keys are prefixed gem-miner.', async () => {
  const { KEY_PREFIX } = await import('../src/storage.js');
  assert.equal(KEY_PREFIX, 'gem-miner.');
});

test('no module imports from outside the game folder', () => {
  for (const f of readdirSync(SRC).filter((x) => x.endsWith('.js'))) {
    const code = readFileSync(join(SRC, f), 'utf8');
    for (const m of code.matchAll(/from\s+'([^']+)'/g)) assert.match(m[1], /^\.\/(kit\/)?[\w-]+\.js$/, `${f} imports ${m[1]}`); // ./kit/: generated copies
  }
});
