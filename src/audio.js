// Tiny WebAudio blips. Context is created lazily on the first user gesture.
export function createAudio(enabled) {
  let ctx = null;
  const ensure = () => {
    if (!enabled) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch { return null; }
    }
    // 'suspended' before a gesture; iOS also uses 'interrupted' (call, backgrounding). Rejects if not allowed yet;
    // retried on the next gesture.
    if (ctx.state !== 'running' && ctx.state !== 'closed') ctx.resume().catch(() => {});
    return ctx;
  };
  function blip(freq, dur = 0.1, type = 'square', vol = 0.06, slide = 0, delay = 0) {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  const SOUNDS = {
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
  return {
    unlock: ensure, // call from a user gesture
    play(type) { const f = SOUNDS[type]; if (f) f(); },
    tick() { blip(180 + Math.random() * 40, 0.03, 'square', 0.015); },
  };
}
