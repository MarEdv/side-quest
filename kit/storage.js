// Pure: no DOM. A localStorage wrapper that never throws (K-5, D-11); the part passes in window.localStorage.
// Values are stored as JSON under `prefix + key` (the origin is shared by every game, so each part has its own prefix).
// When the backend is missing or refuses a write (private mode, quota, blocked storage) the value lives in memory for
// the rest of the session, so play never breaks, and every later write tries the backend again: a quota error is
// often temporary, and giving up would leave an ever older value on disk for the next visit.
export function createStorage(backend, prefix) {
  if (typeof prefix !== 'string' || !prefix) throw new TypeError('createStorage(backend, prefix): prefix is required');
  const mem = new Map();   // the latest raw string written this session, per full key (null = removed)
  const dirty = new Set(); // full keys whose latest write or removal has not reached the backend
  let usable = false;
  try { usable = !!backend && typeof backend.getItem === 'function' && typeof backend.setItem === 'function'; } catch { /* hostile backend */ }

  // Sends this session's value for k to the backend.
  const push = (k) => {
    try {
      if (mem.get(k) === null) backend.removeItem(k); else backend.setItem(k, mem.get(k));
      dirty.delete(k);
      return true;
    } catch { dirty.add(k); return false; }
  };
  const commit = (k) => {
    if (!usable) return false;
    if (!push(k)) return false;
    for (const other of [...dirty]) if (!push(other)) break; // room again: catch up on what was refused earlier
    return true;
  };
  // A key whose latest write was refused is read from memory (this session's value wins, and a refused removal must not
  // bring the old value back). Every other key is read from the backend, so a change made in another tab is seen.
  const read = (k) => {
    if (mem.has(k) && (!usable || dirty.has(k))) return mem.get(k);
    try { return backend.getItem(k) ?? null; } catch { return mem.has(k) ? mem.get(k) : null; }
  };

  return {
    // True while everything written this session is on the backend, i.e. it will survive a reload.
    get persistent() { return usable && dirty.size === 0; },
    // The stored value, or `fallback` when there is none or it is not valid JSON.
    get(key, fallback = null) {
      const raw = read(prefix + key);
      if (raw == null) return fallback;
      try { return JSON.parse(raw); } catch { return fallback; }
    },
    // The stored string as it is, or null: for values written before the part stored JSON (a bare `sv`).
    text(key) { return read(prefix + key); },
    // Returns true when the value reached the backend. A value JSON cannot hold is refused and nothing changes.
    set(key, value) {
      let raw;
      try { raw = JSON.stringify(value); } catch { return false; }
      if (raw === undefined) return false;
      mem.set(prefix + key, raw);
      return commit(prefix + key);
    },
    remove(key) {
      mem.set(prefix + key, null);
      return commit(prefix + key);
    },
  };
}
