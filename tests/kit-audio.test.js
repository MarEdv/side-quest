import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from '../kit/audio.js';

// A fake AudioContext class that records what is made and scheduled. state: the state a new context starts in;
// resume: what resume() does (returns a promise by default).
function fake({ state = 'suspended', resume } = {}) {
  const log = { contexts: 0, resumes: 0, oscillators: [] };
  class Context {
    constructor() { log.contexts++; this.state = state; this.currentTime = 2; this.destination = { out: true }; }
    resume() { log.resumes++; return resume ? resume() : Promise.resolve(); }
    createGain() {
      const g = { calls: [], connect(node) { g.to = node; return node; } };
      g.gain = param(g.calls);
      return g;
    }
    createOscillator() {
      const o = { calls: [], connect(node) { o.to = node; return node; }, start(t) { o.started = t; }, stop(t) { o.stopped = t; } };
      o.frequency = param(o.calls);
      log.oscillators.push(o);
      return o;
    }
  }
  return { Context, log };
}
const param = (calls) => ({
  setValueAtTime: (v, t) => calls.push(['set', v, t]),
  linearRampToValueAtTime: (v, t) => calls.push(['linear', v, t]),
  exponentialRampToValueAtTime: (v, t) => calls.push(['exp', v, t]),
});
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('tone schedules one oscillator: type, pitch, fade-out, delay, start and stop, wired to the output', () => {
  const { Context, log } = fake();
  const audio = createAudio({ AudioContext: Context, sounds: (tone) => ({ beep: () => tone(440, 0.2, { type: 'sine', vol: 0.1, at: 0.5 }) }) });
  audio.play('beep');
  const [o] = log.oscillators;
  assert.equal(o.type, 'sine');
  assert.deepEqual(o.calls, [['set', 440, 2.5]]);
  assert.equal(o.to.calls[0][0], 'set'); near(o.to.calls[0][1], 0.1);
  assert.deepEqual(o.to.calls[1].slice(0, 2), ['exp', 0.0001]); near(o.to.calls[1][2], 2.7);
  assert.deepEqual(o.to.to, { out: true }); // oscillator -> gain -> destination
  near(o.started, 2.5); near(o.stopped, 2.72);
});

test('tone defaults: square, 0.1 s, volume 0.06, now, no slide', () => {
  const { Context, log } = fake();
  createAudio({ AudioContext: Context }).tone(300);
  const [o] = log.oscillators;
  assert.equal(o.type, 'square');
  assert.deepEqual(o.calls, [['set', 300, 2]]);
  assert.deepEqual(o.to.calls[0], ['set', 0.06, 2]);
  near(o.stopped, 2.12);
});

test('slides: linear by default, exponential with ramp exp (never below 30 Hz); the engine option sets the default', () => {
  const { Context, log } = fake();
  const linear = createAudio({ AudioContext: Context });
  linear.tone(220, 0.25, { slide: -120 });
  linear.tone(220, 0.25, { slide: -120, ramp: 'exp' });
  linear.tone(100, 0.25, { slide: -200, ramp: 'exp' });
  const exp = createAudio({ AudioContext: Context, ramp: 'exp' });
  exp.tone(150, 0.1, { slide: -60 });
  exp.tone(150, 0.1, { slide: 60, ramp: 'linear' });
  const ramps = log.oscillators.map((o) => o.calls[1].slice(0, 2));
  assert.deepEqual(ramps, [['linear', 100], ['exp', 100], ['exp', 30], ['exp', 90], ['linear', 210]]);
  near(log.oscillators[0].calls[1][2], 2.25);
});

test('resume: for suspended and interrupted (iOS), not for running or closed', () => {
  for (const [state, resumes] of [['suspended', 1], ['interrupted', 1], ['running', 0], ['closed', 0]]) {
    const { Context, log } = fake({ state });
    createAudio({ AudioContext: Context }).unlock();
    assert.equal(log.resumes, resumes, state);
  }
});

test('resume: a rejection is caught, a throw too, and the next gesture tries again', async () => {
  let unhandled = 0;
  const count = () => { unhandled++; };
  process.on('unhandledRejection', count);
  try {
    const { Context, log } = fake({ resume: () => Promise.reject(new Error('not allowed')) });
    const audio = createAudio({ AudioContext: Context });
    audio.unlock();
    audio.unlock();
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(unhandled, 0);
    assert.equal(log.resumes, 2);
    assert.equal(log.contexts, 1);
    const throwing = fake({ resume: () => { throw new Error('sync'); } });
    const audio2 = createAudio({ AudioContext: throwing.Context });
    assert.doesNotThrow(() => { audio2.unlock(); audio2.tone(440); });
    assert.equal(throwing.log.oscillators.length, 1, 'sound is still attempted');
  } finally {
    process.off('unhandledRejection', count);
  }
});

test('no AudioContext, or one that cannot be made: silent, never throws, enabled becomes false', () => {
  // In Node there is no window: the default lookup finds nothing.
  const none = createAudio({ sounds: (tone) => ({ a: () => tone(440) }) });
  assert.doesNotThrow(() => { none.unlock(); none.play('a'); none.tone(440); });
  assert.equal(none.enabled, false);
  class Broken { constructor() { throw new Error('too many contexts'); } }
  const broken = createAudio({ AudioContext: Broken, sounds: (tone) => ({ a: () => tone(440) }) });
  assert.doesNotThrow(() => { broken.play('a'); broken.unlock(); });
  assert.equal(broken.enabled, false);
});

test('errors inside a sound or while scheduling never escape', () => {
  const { Context } = fake();
  class Failing extends Context { createOscillator() { throw new Error('nope'); } }
  const audio = createAudio({ AudioContext: Failing, sounds: (tone) => ({ a: () => tone(440), b: () => { throw new Error('bug'); } }) });
  assert.doesNotThrow(() => { audio.play('a'); audio.play('b'); audio.tone(440); });
  assert.equal(audio.enabled, true, 'one failed sound does not turn sound off');
});

test('disabled: no context and no oscillators until enabled; the setter works live; unknown names are ignored', () => {
  const { Context, log } = fake();
  let calls = 0;
  const audio = createAudio({ enabled: false, AudioContext: Context, sounds: (tone) => ({ a: () => { calls++; tone(440); } }) });
  audio.unlock(); audio.play('a'); audio.tone(440);
  assert.equal(log.contexts, 0);
  assert.equal(calls, 0, 'a muted sound does not run (so it cannot update its own state)');
  audio.enabled = true;
  assert.equal(audio.enabled, true);
  audio.play('a'); audio.play('missing');
  assert.equal(log.oscillators.length, 1);
  audio.enabled = 0;
  assert.equal(audio.enabled, false);
  audio.play('a'); audio.tone(440);
  assert.equal(log.oscillators.length, 1);
});

test('the context is made once, lazily', () => {
  const { Context, log } = fake();
  const audio = createAudio({ AudioContext: Context });
  assert.equal(log.contexts, 0);
  audio.unlock(); audio.tone(1); audio.tone(2);
  assert.equal(log.contexts, 1);
});
