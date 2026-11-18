// Tiny WebAudio blips: this game's sound table over the kit's engine (src/kit/audio.js, D-37). Context is created
// lazily on the first user gesture. Slides are linear. tests/audio-golden.test.js pins every sound.
import { createAudio as createEngine } from './kit/audio.js';

const SOUNDS = (tone) => {
  const blip = (freq, dur = 0.1, type = 'square', vol = 0.06, slide = 0, delay = 0) => tone(freq, dur, { type, vol, slide, at: delay });
  return {
    warning: () => { blip(880, 0.08, 'square'); blip(880, 0.08, 'square', 0.06, 0, 0.14); },
    wifeOut: () => blip(300, 0.12, 'triangle', 0.08),
    spotted: () => blip(220, 0.25, 'sawtooth', 0.07, -120),
    questGiven: () => { blip(523, 0.1, 'square'); blip(659, 0.1, 'square', 0.06, 0, 0.1); blip(784, 0.15, 'square', 0.06, 0, 0.2); },
    pickup: () => blip(660, 0.08, 'square', 0.06, 300),
    questCompleted: () => { blip(523, 0.1, 'triangle', 0.08); blip(659, 0.1, 'triangle', 0.08, 0, 0.1); blip(1047, 0.2, 'triangle', 0.08, 0, 0.2); },
    questFailed: () => blip(300, 0.35, 'sawtooth', 0.07, -200),
    choreDone: () => { blip(784, 0.08, 'square', 0.06); blip(1047, 0.14, 'square', 0.06, 0, 0.08); },
    avoided: () => blip(1200, 0.06, 'sine', 0.05, 200),
    won: () => [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.18, 'triangle', 0.09, 0, i * 0.14)),
    lost: () => [392, 330, 262, 196].forEach((f, i) => blip(f, 0.25, 'sawtooth', 0.06, 0, i * 0.2)),
  };
};

export function createAudio(initiallyEnabled) {
  const engine = createEngine({ enabled: initiallyEnabled, sounds: SOUNDS, ramp: 'linear' });
  return {
    unlock: engine.unlock, // call from a user gesture
    setEnabled(on) { engine.enabled = on; }, // Settings toggles sound live
    play: engine.play,
    tick() { engine.tone(180 + Math.random() * 40, 0.03, { type: 'square', vol: 0.015 }); }, // work in progress
  };
}
