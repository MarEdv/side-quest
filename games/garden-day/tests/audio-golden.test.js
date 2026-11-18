// Golden values: every sound this game makes, as the oscillators it schedules, recorded from src/audio.js before the
// engine moved to the kit (S-9). Never edit a value to make a test pass: a different line is a different sound.
import { test } from 'node:test';
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
  warning: [
    'square f 880@0 | g 0.06@0 exp>0.0001@0.08 | 0..0.1',
    'square f 880@0.14 | g 0.06@0.14 exp>0.0001@0.22 | 0.14..0.24',
  ],
  wifeOut: [
    'triangle f 300@0 | g 0.08@0 exp>0.0001@0.12 | 0..0.14',
  ],
  spotted: [
    'sawtooth f 220@0 lin>100@0.25 | g 0.07@0 exp>0.0001@0.25 | 0..0.27',
  ],
  questGiven: [
    'square f 523@0 | g 0.06@0 exp>0.0001@0.1 | 0..0.12',
    'square f 659@0.1 | g 0.06@0.1 exp>0.0001@0.2 | 0.1..0.22',
    'square f 784@0.2 | g 0.06@0.2 exp>0.0001@0.35 | 0.2..0.37',
  ],
  pickup: [
    'square f 660@0 lin>960@0.08 | g 0.06@0 exp>0.0001@0.08 | 0..0.1',
  ],
  questCompleted: [
    'triangle f 523@0 | g 0.08@0 exp>0.0001@0.1 | 0..0.12',
    'triangle f 659@0.1 | g 0.08@0.1 exp>0.0001@0.2 | 0.1..0.22',
    'triangle f 1047@0.2 | g 0.08@0.2 exp>0.0001@0.4 | 0.2..0.42',
  ],
  questFailed: [
    'sawtooth f 300@0 lin>100@0.35 | g 0.07@0 exp>0.0001@0.35 | 0..0.37',
  ],
  choreDone: [
    'square f 784@0 | g 0.06@0 exp>0.0001@0.08 | 0..0.1',
    'square f 1047@0.08 | g 0.06@0.08 exp>0.0001@0.22 | 0.08..0.24',
  ],
  avoided: [
    'sine f 1200@0 lin>1400@0.06 | g 0.05@0 exp>0.0001@0.06 | 0..0.08',
  ],
  won: [
    'triangle f 523@0 | g 0.09@0 exp>0.0001@0.18 | 0..0.2',
    'triangle f 659@0.14 | g 0.09@0.14 exp>0.0001@0.32 | 0.14..0.34',
    'triangle f 784@0.28 | g 0.09@0.28 exp>0.0001@0.46 | 0.28..0.48',
    'triangle f 1047@0.42 | g 0.09@0.42 exp>0.0001@0.6 | 0.42..0.62',
  ],
  lost: [
    'sawtooth f 392@0 | g 0.06@0 exp>0.0001@0.25 | 0..0.27',
    'sawtooth f 330@0.2 | g 0.06@0.2 exp>0.0001@0.45 | 0.2..0.47',
    'sawtooth f 262@0.4 | g 0.06@0.4 exp>0.0001@0.65 | 0.4..0.67',
    'sawtooth f 196@0.6 | g 0.06@0.6 exp>0.0001@0.85 | 0.6..0.87',
  ],
  tick: [
    'square f 190@0 | g 0.015@0 exp>0.0001@0.03 | 0..0.05',
  ],
};

const record = (fn) => { lines.length = 0; fn(); return [...lines]; };

test('every sound schedules exactly the oscillators it did before the engine moved to the kit', (t) => {
  t.mock.method(Math, 'random', () => 0.25);
  const audio = createAudio(true);
  audio.unlock();
  for (const name of Object.keys(GOLDEN)) {
    const got = name === 'tick' ? record(() => audio.tick()) : record(() => audio.play(name));
    assert.deepEqual(got, GOLDEN[name], name);
  }
});

test('the tick pitch follows Math.random (180..220 Hz)', (t) => {
  const audio = createAudio(true);
  t.mock.method(Math, 'random', () => 0);
  assert.match(record(() => audio.tick())[0], /^square f 180@0 \|/);
  t.mock.method(Math, 'random', () => 0.999);
  assert.match(record(() => audio.tick())[0], /^square f 219\.96@0 \|/);
});

test('sound off schedules nothing; setEnabled turns it on and off live; unknown names are ignored', () => {
  const audio = createAudio(false);
  assert.deepEqual(record(() => { audio.unlock(); audio.play('won'); audio.tick(); }), []);
  audio.setEnabled(true);
  assert.equal(record(() => audio.play('pickup')).length, 1);
  assert.deepEqual(record(() => audio.play('nope')), []);
  audio.setEnabled(false);
  assert.deepEqual(record(() => { audio.play('won'); audio.tick(); }), []);
});
