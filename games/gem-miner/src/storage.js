// Tiny localStorage wrapper (pure: the backend is passed in by main.js). Every access is wrapped in try/catch; when the
// backend is missing or throws (private mode, quota), values live in memory for the session so play never breaks (G-3).
// Every write is tried again on the backend (D24): a quota error is often temporary, and giving up for the session
// would leave an ever older save on disk for the next visit.
export const KEY_PREFIX = 'gem-miner.';

export function createStorage(backend) {
  const mem = new Map();   // write-through cache: the latest value per key, even when the backend refused it
  let ok = false;
  try { ok = !!backend && typeof backend.getItem === 'function' && typeof backend.setItem === 'function'; } catch { /* hostile */ }
  let lastOk = ok;
  return {
    // false after the most recent write failed (or there is no backend)
    get persistent() { return lastOk; },
    get(key, fallback = null) {
      const k = KEY_PREFIX + key;
      let raw = null;
      if (mem.has(k)) raw = mem.get(k);
      else if (ok) { try { raw = backend.getItem(k); } catch { raw = null; } }
      if (raw == null) return fallback;
      try { return JSON.parse(raw); } catch { return fallback; }
    },
    set(key, value) {
      const k = KEY_PREFIX + key;
      let raw;
      try { raw = JSON.stringify(value); } catch { return false; }
      if (raw === undefined) return false;
      mem.set(k, raw);
      if (!ok) return (lastOk = false);
      try { backend.setItem(k, raw); return (lastOk = true); } catch { return (lastOk = false); }
    },
    remove(key) {
      const k = KEY_PREFIX + key;
      mem.set(k, null);
      if (!ok) return;
      try { backend.removeItem(k); } catch { /* the in-memory null still hides it this session */ }
    },
  };
}
