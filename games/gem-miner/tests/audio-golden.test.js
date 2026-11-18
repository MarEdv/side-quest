// Golden values: every sound this game makes, as the oscillators it schedules, recorded from src/audio.js before the
// engine moved to the kit (S-9). Never edit a value to make a test pass: a different line is a different sound.
import test from 'node:test';
import assert from 'node:assert/strict';

// A fake AudioContext: each oscillator becomes one line,
//   "<type> f <frequency events> | g <gain events> | <start>..<stop>"
// with events written as value@time, lin>value@time or exp>value@time (currentTime is 0, numbers rounded to 1e-6).
const lines = [];
const n = (x) => +x.toFixed(6);
const param = (ev) => ({
  setValueAtTime: (v, t) => ev.push(`${n(v)}@${n(t)}`),
  linearRampToValueAtTime: (v, t) => ev.push(`lin>${n(v)}@${n(t)}`),
  exponentialRampToValueAtTime: (v, t) => ev.push(`exp>${n(v)}@${n(t)}`),
});
class FakeContext {
  constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  createGain() {
    const g = { ev: [], connect(node) { g.to = node; return node; } };
    g.gain = param(g.ev);
    return g;
  }
  createOscillator() {
    const o = { ev: [], type: 'sine', connect(node) { o.to = node; return node; }, start(t) { o.t0 = t; } };
    o.frequency = param(o.ev);
    o.stop = (t) => {
      const wired = o.to?.to === this.destination ? '' : ' (not wired)';
      lines.push(`${o.type} f ${o.ev.join(' ')} | g ${o.to?.ev.join(' ')} | ${n(o.t0)}..${n(t)}${wired}`);
    };
    return o;
  }
}
globalThis.window = { AudioContext: FakeContext };
const { createAudio } = await import('../src/audio.js');

const GOLDEN = {
  hit: [
    'triangle f 160@0 exp>100@0.07 | g 0.08@0 exp>0.0001@0.07 | 0..0.09',
  ],
  mined: [
    'sawtooth f 110@0 exp>60@0.1 | g 0.06@0 exp>0.0001@0.1 | 0..0.12',
  ],
  gem: [
    'sine f 880@0 | g 0.09@0 exp>0.0001@0.09 | 0..0.11',
    'sine f 1320@0.07 | g 0.08@0.07 exp>0.0001@0.21 | 0.07..0.23',
  ],
  chest: [
    'triangle f 523@0 | g 0.08@0 exp>0.0001@0.12 | 0..0.14',
    'triangle f 659@0.07 | g 0.08@0.07 exp>0.0001@0.19 | 0.07..0.21',
    'triangle f 784@0.14 | g 0.08@0.14 exp>0.0001@0.26 | 0.14..0.28',
    'triangle f 1047@0.21 | g 0.08@0.21 exp>0.0001@0.33 | 0.21..0.35',
  ],
  sell: [
    'square f 1175@0 | g 0.05@0 exp>0.0001@0.06 | 0..0.08',
    'square f 1568@0.06 | g 0.05@0.06 exp>0.0001@0.16 | 0.06..0.18',
  ],
  buy: [
    'triangle f 392@0 | g 0.08@0 exp>0.0001@0.12 | 0..0.14',
    'triangle f 523@0.08 | g 0.08@0.08 exp>0.0001@0.2 | 0.08..0.22',
    'triangle f 659@0.16 | g 0.08@0.16 exp>0.0001@0.28 | 0.16..0.3',
  ],
  toohard: [
    'square f 120@0 exp>90@0.16 | g 0.05@0 exp>0.0001@0.16 | 0..0.18',
  ],
  broke: [
    'sawtooth f 300@0 exp>80@0.3 | g 0.07@0 exp>0.0001@0.3 | 0..0.32',
  ],
  win: [
    'sine f 523@0 | g 0.09@0 exp>0.0001@0.25 | 0..0.27',
    'sine f 659@0.12 | g 0.09@0.12 exp>0.0001@0.37 | 0.12..0.39',
    'sine f 784@0.24 | g 0.09@0.24 exp>0.0001@0.49 | 0.24..0.51',
    'sine f 1047@0.36 | g 0.09@0.36 exp>0.0001@0.61 | 0.36..0.63',
    'sine f 1319@0.48 | g 0.09@0.48 exp>0.0001@0.73 | 0.48..0.75',
    'sine f 1568@0.6 | g 0.09@0.6 exp>0.0001@0.85 | 0.6..0.87',
  ],
};

const record = (fn) => { lines.length = 0; fn(); return [...lines]; };

test('every sound schedules exactly the oscillators it did before the engine moved to the kit', (t) => {
  t.mock.method(Math, 'random', () => 0.25);
  t.mock.method(performance, 'now', () => 1000);
  const audio = createAudio({ enabled: true });
  audio.unlock();
  for (const name of Object.keys(GOLDEN)) assert.deepEqual(record(() => audio.play(name)), GOLDEN[name], name);
});

test('hit: pitch follows Math.random (150..190 Hz) and plays at most once per 90 ms', (t) => {
  let now = 1000;
  t.mock.method(performance, 'now', () => now);
  t.mock.method(Math, 'random', () => 0);
  const audio = createAudio();
  assert.match(record(() => audio.play('hit'))[0], /^triangle f 150@0 exp>90@0\.07 \|/);
  now = 1089;
  assert.deepEqual(record(() => audio.play('hit')), []);
  now = 1090;
  t.mock.method(Math, 'random', () => 0.999);
  assert.match(record(() => audio.play('hit'))[0], /^triangle f 189\.96@0 exp>129\.96@0\.07 \|/);
  assert.equal(record(() => audio.play('mined')).length, 1, 'the limit is for hit only');
});

test('enabled: off schedules nothing (a muted hit does not use up the 90 ms); the setter works live', (t) => {
  let now = 1000;
  t.mock.method(performance, 'now', () => now);
  const audio = createAudio({ enabled: false });
  assert.equal(audio.enabled, false);
  assert.deepEqual(record(() => { audio.unlock(); audio.play('win'); audio.play('hit'); }), []);
  audio.enabled = true;
  assert.equal(audio.enabled, true);
  assert.equal(record(() => audio.play('hit')).length, 1);
  assert.deepEqual(record(() => audio.play('nope')), []);
  audio.enabled = false;
  now = 2000;
  assert.deepEqual(record(() => { audio.play('win'); audio.play('hit'); }), []);
});
