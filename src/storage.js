// Tiny localStorage wrapper. Pure: no DOM; the browser backend is passed in by main.js.
// Every backend access is wrapped in try/catch (private mode, quota, blocked storage). When the backend is missing
// or throws, values live in memory for the rest of the session so the game never breaks (HS-1).
export const KEY_PREFIX = 'sidequest.v1.';

export function createStorage(backend) {
  const mem = new Map();   // fallback / write-through cache of the raw JSON strings
  let healthy = false;
  try { healthy = !!backend && typeof backend.getItem === 'function' && typeof backend.setItem === 'function'; } catch { /* hostile backend */ }

  const fail = () => { healthy = false; };

  return {
    // True while the backend has worked for every access so far (i.e. data will survive a reload).
    get persistent() { return healthy; },
    get(key, fallback = null) {
      const k = KEY_PREFIX + key;
      let raw = null;
      if (healthy) {
        try { raw = backend.getItem(k); } catch { fail(); raw = null; }
      }
      // Once the backend has failed (e.g. a quota error on write), this session's writes and removals win, but keys
      // never touched this session are still read from the backend if it allows reads (D-22).
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
      mem.set(k, null); // tombstone: a removal that the backend refused must not resurrect the old value
      if (!healthy) return;
      try { backend.removeItem(k); } catch { fail(); }
    },
  };
}
