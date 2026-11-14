// Tiny localStorage wrapper (pure: the backend is passed in by main.js). Every access is wrapped in try/catch; when the
// backend is missing or throws (private mode, quota), values live in memory for the session so play never breaks (G-3).
export const KEY_PREFIX = 'gem-miner.';

export function createStorage(backend) {
  const mem = new Map();
  let healthy = false;
  try { healthy = !!backend && typeof backend.getItem === 'function' && typeof backend.setItem === 'function'; } catch { /* hostile */ }
  const fail = () => { healthy = false; };
  return {
    get persistent() { return healthy; },
    get(key, fallback = null) {
      const k = KEY_PREFIX + key;
      let raw = null;
      if (healthy) { try { raw = backend.getItem(k); } catch { fail(); } }
      if (!healthy) {
        if (mem.has(k)) raw = mem.get(k);
        else if (backend) { try { raw = backend.getItem(k); } catch { raw = null; } }
      }
      if (raw == null) return fallback;
      try { return JSON.parse(raw); } catch { return fallback; }
    },
    set(key, value) {
      const k = KEY_PREFIX + key;
      let raw;
      try { raw = JSON.stringify(value); } catch { return false; }
      if (raw === undefined) return false;
      mem.set(k, raw);
      if (!healthy) return false;
      try { backend.setItem(k, raw); return true; } catch { fail(); return false; }
    },
    remove(key) {
      const k = KEY_PREFIX + key;
      mem.set(k, null);
      if (!healthy) return;
      try { backend.removeItem(k); } catch { fail(); }
    },
  };
}
