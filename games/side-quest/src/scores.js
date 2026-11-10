// High scores and per-level records on top of a storage object (src/storage.js). Pure: no DOM.
export const MAX_ENTRIES = 10;
const SCORES_KEY = 'scores';    // { v: 1, arcade: [ {score, won, date, summary} ... ] }
const PROGRESS_KEY = 'progress'; // { v: 1, levels: { [id]: {best, won} } }

const num = (n) => (typeof n === 'number' && Number.isFinite(n));

// Coerce stored junk into a clean, sorted, truncated list. Anything unusable is dropped (never throws).
export function sanitizeArcade(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const e of list) {
    if (!e || typeof e !== 'object' || !num(e.score)) continue;
    const d = typeof e.date === 'string' && !Number.isNaN(Date.parse(e.date)) ? e.date : '';
    out.push({
      score: Math.round(e.score),
      won: e.won === true,
      date: d,
      summary: typeof e.summary === 'string' ? e.summary.slice(0, 40) : '',
    });
  }
  // Array.prototype.sort is stable: equal scores keep stored order (earlier entry first).
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, MAX_ENTRIES);
}

export function sanitizeLevels(map) {
  const out = {};
  if (!map || typeof map !== 'object' || Array.isArray(map)) return out;
  for (const [id, r] of Object.entries(map)) {
    if (id.length === 0 || id.length > 40 || !r || typeof r !== 'object' || !num(r.best)) continue;
    out[id] = { best: Math.round(r.best), won: r.won === true };
  }
  return out;
}

export function createScores(storage) {
  const readArcade = () => { const d = storage.get(SCORES_KEY); return sanitizeArcade(d && d.arcade); };
  const readLevels = () => { const d = storage.get(PROGRESS_KEY); return sanitizeLevels(d && d.levels); };

  return {
    arcade: readArcade,
    best() { const a = readArcade(); return a.length ? a[0].score : null; },

    // result: { score, won, date (ISO string), summary }. Returns { rank (1-based or null), isBest, best }.
    recordArcade(result) {
      const entry = sanitizeArcade([result])[0];
      const list = readArcade();
      if (!entry) return { rank: null, isBest: false, best: list.length ? list[0].score : null };
      // The new entry goes after every entry with an equal or higher score: the earlier entry ranks higher.
      let i = 0;
      while (i < list.length && list[i].score >= entry.score) i++;
      const rank = i < MAX_ENTRIES ? i + 1 : null;
      if (rank !== null) {
        list.splice(i, 0, entry);
        list.length = Math.min(list.length, MAX_ENTRIES);
        storage.set(SCORES_KEY, { v: 1, arcade: list });
      }
      return { rank, isBest: rank === 1, best: list.length ? list[0].score : null };
    },

    levels: readLevels,
    level(id) { return readLevels()[id] || { best: null, won: false }; },
    // result: { score, won }. Keeps the best score and sticky "won". Returns the new record plus isBest (improved).
    recordLevel(id, result) {
      if (typeof id !== 'string' || !id || id.length > 40 || !result || !num(result.score)) return null;
      const all = readLevels();
      const prev = all[id];
      const score = Math.round(result.score);
      const isBest = !prev || score > prev.best;
      all[id] = { best: isBest ? score : prev.best, won: (prev && prev.won) || result.won === true };
      storage.set(PROGRESS_KEY, { v: 1, levels: all });
      return { ...all[id], isBest };
    },

    clearArcade() { storage.remove(SCORES_KEY); },
    clearAll() { storage.remove(SCORES_KEY); storage.remove(PROGRESS_KEY); },
  };
}
