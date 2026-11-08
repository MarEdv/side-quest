// Tiny localStorage wrapper. Pure: no DOM; the browser backend is passed in by main.js.
// Every backend access is wrapped in try/catch (private mode, quota, blocked storage). When the backend is missing
// or throws, values live in memory for the rest of the session so the game never breaks (HS-1).
export const KEY_PREFIX = 'sidequest.v1.';

export function createStorage(backend) {
  const mem = new Map();   // fallback / write-through cache of the raw JSON strings
  let healthy = !!backend && typeof backend.getItem === 'function' && typeof backend.setItem === 'function';

  const fail = () => { healthy = false; };

  return {
    // True while the backend has worked for every access so far (i.e. data will survive a reload).
    get persistent() { return healthy; },
    get(key, fallback = null) {
      const k = KEY_PREFIX + key;
      let raw = null;
      if (healthy) {
        try { raw = backend.getItem(k); } catch { fail(); }
      }
      if (raw == null) raw = mem.has(k) ? mem.get(k) : null;
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
      mem.delete(k);
      if (!healthy) return;
      try { backend.removeItem(k); } catch { fail(); }
    },
  };
}
