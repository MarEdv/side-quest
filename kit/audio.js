// Browser: tiny WebAudio sound effects, no audio files (S-9). The part brings its own sound table; this is the engine.
// The AudioContext is made lazily, on the first sound or unlock(): browsers only let it start inside a user gesture,
// so the part calls unlock() from its keydown/pointer handlers. Nothing here ever throws: with no AudioContext, or one
// that cannot be made, sound simply stays off.
//
// sounds(tone) returns the table, { name: () => ... }; a sound calls
//   tone(freq, dur, { type, vol, at, slide, ramp })
// for one oscillator: `type` the waveform, `vol` the start gain (it fades out over `dur` seconds), `at` the delay in
// seconds, `slide` the change of pitch in Hz over `dur`, `ramp` its shape: 'linear', or 'exp' (exponential, never
// below 30 Hz, since an exponential ramp cannot reach 0). The `ramp` option of createAudio is the default.
// Returns { play(name), unlock(), tone, enabled } (enabled can be set live).
export function createAudio({ enabled = true, sounds = () => ({}), ramp = 'linear', AudioContext: Context } = {}) {
  let ctx = null, on = !!enabled;

  const ensure = () => {
    if (!on) return null;
    try {
      if (!ctx) {
        const AC = Context ?? (typeof window === 'undefined' ? undefined : window.AudioContext || window.webkitAudioContext);
        if (!AC) { on = false; return null; }
        ctx = new AC();
      }
    } catch { on = false; return null; }
    // 'suspended' before a gesture; iOS also uses 'interrupted' (a call, backgrounding). Rejects when not allowed yet;
    // tried again on the next sound or gesture.
    if (ctx.state !== 'running' && ctx.state !== 'closed') {
      try { ctx.resume()?.catch?.(() => {}); } catch { /* the same: tried again later */ }
    }
    return ctx;
  };

  function tone(freq, dur = 0.1, { type = 'square', vol = 0.06, at = 0, slide = 0, ramp: shape = ramp } = {}) {
    const c = ensure();
    if (!c) return;
    try {
      const t = c.currentTime + at;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide && shape === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      else if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch { /* one lost sound, never a broken game */ }
  }

  const table = sounds(tone);
  return {
    play(name) {
      const f = table[name];
      if (!f || !on) return;
      try { f(); } catch { /* as in tone() */ }
    },
    unlock() { ensure(); }, // call from a user gesture
    tone,
    set enabled(v) { on = !!v; },
    get enabled() { return on; },
  };
}
