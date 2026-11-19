// Short WebAudio sounds (V-2, browser only): this game's sound table over the kit's engine (src/kit/audio.js).
// Created lazily on the first user gesture; a missing or blocked AudioContext never breaks play (flag `sound`).
import { createAudio as createEngine } from './kit/audio.js';

export function createAudio({ enabled = true } = {}) {
  const sounds = (tone) => ({
    served() { tone(660, 0.08, { type: 'triangle', vol: 0.09 }); tone(990, 0.12, { type: 'triangle', vol: 0.08, at: 0.06 }); },
    complaint() { tone(220, 0.28, { type: 'sawtooth', vol: 0.07, slide: -90 }); },
    offer() { [880, 660, 880, 660].forEach((f, k) => tone(f, 0.12, { type: 'square', vol: 0.04, at: k * 0.16 })); },
    station() { tone(784, 0.45, { type: 'sine', vol: 0.09 }); tone(587, 0.7, { type: 'sine', vol: 0.09, at: 0.32 }); },
    questDone() { [523, 659, 784, 1047].forEach((f, k) => tone(f, 0.16, { type: 'triangle', vol: 0.09, at: k * 0.08 })); },
    questFailed() { [392, 330, 262].forEach((f, k) => tone(f, 0.2, { type: 'sawtooth', vol: 0.06, at: k * 0.14 })); },
    pickup() { tone(520, 0.06, { type: 'square', vol: 0.05 }); tone(780, 0.08, { type: 'square', vol: 0.05, at: 0.05 }); },
    seated() { tone(190, 0.1, { type: 'triangle', vol: 0.1, slide: -50 }); tone(330, 0.08, { type: 'sine', vol: 0.06, at: 0.08 }); },
  });
  return createEngine({ enabled, sounds, ramp: 'exp' });
}
