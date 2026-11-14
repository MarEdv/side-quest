// Tiny WebAudio sound effects (browser only). Created lazily on the first user gesture; every call is wrapped so a
// missing or blocked AudioContext never breaks play (flag `sound`).
export function createAudio({ enabled = true } = {}) {
  let ctx = null, on = enabled, lastHit = 0;
  const ensure = () => {
    if (!on) return null;
    try {
      if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) { on = false; return null; } ctx = new AC(); }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch { on = false; return null; }
  };
  function tone(freq, dur, { type = 'square', vol = 0.06, at = 0, slide = 0 } = {}) {
    const c = ensure(); if (!c) return;
    try {
      const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch { /* ignore */ }
  }
  const sfx = {
    hit() { const n = performance.now(); if (n - lastHit < 90) return; lastHit = n; tone(150 + Math.random() * 40, 0.07, { type: 'triangle', vol: 0.08, slide: -60 }); },
    mined() { tone(110, 0.1, { type: 'sawtooth', vol: 0.06, slide: -50 }); },
    gem() { tone(880, 0.09, { type: 'sine', vol: 0.09 }); tone(1320, 0.14, { type: 'sine', vol: 0.08, at: 0.07 }); },
    chest() { [523, 659, 784, 1047].forEach((f, k) => tone(f, 0.12, { type: 'triangle', vol: 0.08, at: k * 0.07 })); },
    sell() { tone(1175, 0.06, { type: 'square', vol: 0.05 }); tone(1568, 0.1, { type: 'square', vol: 0.05, at: 0.06 }); },
    buy() { [392, 523, 659].forEach((f, k) => tone(f, 0.12, { type: 'triangle', vol: 0.08, at: k * 0.08 })); },
    toohard() { tone(120, 0.16, { type: 'square', vol: 0.05, slide: -30 }); },
    broke() { tone(300, 0.3, { type: 'sawtooth', vol: 0.07, slide: -220 }); },
    win() { [523, 659, 784, 1047, 1319, 1568].forEach((f, k) => tone(f, 0.25, { type: 'sine', vol: 0.09, at: k * 0.12 })); },
  };
  return {
    play(name) { const f = sfx[name]; if (f && on) f(); },
    unlock() { ensure(); },
    set enabled(v) { on = !!v; },
    get enabled() { return on; },
  };
}
