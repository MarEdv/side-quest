import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFlags } from '../src/flags.js';

test('defaults', () => {
  assert.deepEqual(parseFlags(''), { controls: 'auto', poo: 'hit', daySeconds: 180, debug: false });
});
test('valid values', () => {
  const f = parseFlags('?controls=tap&poo=choice&daySeconds=60&debug=1');
  assert.deepEqual(f, { controls: 'tap', poo: 'choice', daySeconds: 60, debug: true });
});
test('invalid values fall back', () => {
  const f = parseFlags('?controls=x&poo=y&daySeconds=abc&debug=2');
  assert.deepEqual(f, { controls: 'auto', poo: 'hit', daySeconds: 180, debug: false });
  assert.equal(parseFlags('?daySeconds=-5').daySeconds, 180);
  assert.equal(parseFlags('?daySeconds=99999').daySeconds, 180);
  assert.equal(parseFlags('?daySeconds=').daySeconds, 180);
});
