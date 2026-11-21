// Short WebAudio sounds (V-3, D17; browser-free itself: the kit's engine owns the AudioContext). This game's sound table
// over src/kit/audio.js. Created lazily on the first user gesture; a missing or blocked AudioContext never breaks play
// (flag `sound`). `engine(v)` is the engine putt, called by main.js at a rate that follows the speed (v is 0..1).
import { createAudio as createEngine } from './kit/audio.js';

export function createAudio({ enabled = true } = {}) {
  const sounds = (tone) => ({
    nearMiss() { tone(1100, 0.2, { type: 'sine', vol: 0.07, slide: -800 }); tone(600, 0.22, { type: 'triangle', vol: 0.05, slide: -380, at: 0.03 }); },
    crash() { tone(150, 0.4, { type: 'sawtooth', vol: 0.16, slide: -110 }); tone(95, 0.3, { type: 'square', vol: 0.1, slide: -50 }); tone(60, 0.5, { type: 'triangle', vol: 0.14, slide: -25, at: 0.04 }); },
    stage() { [523, 659, 784].forEach((f, k) => tone(f, 0.3, { type: 'sine', vol: 0.08, at: k * 0.11 })); },
    rumble() { tone(62, 0.1, { type: 'square', vol: 0.05 }); tone(81, 0.08, { type: 'sawtooth', vol: 0.03, at: 0.02 }); },
    barrier() { tone(1700, 0.14, { type: 'sawtooth', vol: 0.04, slide: -900 }); tone(240, 0.12, { type: 'square', vol: 0.05 }); },
    finish() { [523, 659, 784, 1047, 1319].forEach((f, k) => tone(f, 0.2, { type: 'triangle', vol: 0.09, at: k * 0.1 })); tone(1047, 0.6, { type: 'sine', vol: 0.07, at: 0.55 }); },
    wrecked() { [330, 277, 220, 165].forEach((f, k) => tone(f, 0.28, { type: 'sawtooth', vol: 0.07, at: k * 0.18 })); },
  });
  const base = createEngine({ enabled, sounds, ramp: 'exp' });
  // Engine putt: a quiet low pulse, pitched up with the speed.
  const engine = (v) => base.tone(46 + 58 * Math.min(1, Math.max(0, v)), 0.09, { type: 'sawtooth', vol: 0.028 });
  return {
    play: base.play, unlock: base.unlock, engine,
    set enabled(v) { base.enabled = v; },
    get enabled() { return base.enabled; },
  };
}
