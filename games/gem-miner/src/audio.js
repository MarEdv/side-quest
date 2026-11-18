// Tiny WebAudio sound effects (browser only): this game's sound table over the kit's engine (src/kit/audio.js, D34).
// Created lazily on the first user gesture; a missing or blocked AudioContext never breaks play (flag `sound`).
// Slides are exponential (never below 30 Hz). tests/audio-golden.test.js pins every sound.
import { createAudio as createEngine } from './kit/audio.js';

export function createAudio({ enabled = true } = {}) {
  let lastHit = 0;
  const sounds = (tone) => ({
    hit() { const n = performance.now(); if (n - lastHit < 90) return; lastHit = n; tone(150 + Math.random() * 40, 0.07, { type: 'triangle', vol: 0.08, slide: -60 }); },
    mined() { tone(110, 0.1, { type: 'sawtooth', vol: 0.06, slide: -50 }); },
    gem() { tone(880, 0.09, { type: 'sine', vol: 0.09 }); tone(1320, 0.14, { type: 'sine', vol: 0.08, at: 0.07 }); },
    chest() { [523, 659, 784, 1047].forEach((f, k) => tone(f, 0.12, { type: 'triangle', vol: 0.08, at: k * 0.07 })); },
    sell() { tone(1175, 0.06, { type: 'square', vol: 0.05 }); tone(1568, 0.1, { type: 'square', vol: 0.05, at: 0.06 }); },
    buy() { [392, 523, 659].forEach((f, k) => tone(f, 0.12, { type: 'triangle', vol: 0.08, at: k * 0.08 })); },
    toohard() { tone(120, 0.16, { type: 'square', vol: 0.05, slide: -30 }); },
    broke() { tone(300, 0.3, { type: 'sawtooth', vol: 0.07, slide: -220 }); },
    win() { [523, 659, 784, 1047, 1319, 1568].forEach((f, k) => tone(f, 0.25, { type: 'sine', vol: 0.09, at: k * 0.12 })); },
  });
  // { play(name), unlock(), enabled } as before (and tone, unused here).
  return createEngine({ enabled, sounds, ramp: 'exp' });
}
