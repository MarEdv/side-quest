// Top-5 best completion times per world size (pure). Shape: { "256": [{ time, seed, date }], ... }
export const MAX_SCORES = 5;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/; // anything else in stored data is dropped (D24)

export function normalizeScores(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    const clean = list
      .filter((e) => e && Number.isFinite(e.time) && e.time > 0)
      .map((e) => ({ time: e.time, seed: Number.isInteger(e.seed) ? e.seed : 0, date: DATE_RE.test(e.date) ? e.date : '' }))
      .sort((a, b) => a.time - b.time).slice(0, MAX_SCORES);
    if (clean.length) out[k] = clean;
  }
  return out;
}

// Returns { scores, rank } with the new scores object (input is not mutated); rank is 1-based, or 0 if it did not
// make the top 5.
export function addScore(scores, size, entry) {
  const base = normalizeScores(scores);
  const list = [...(base[size] || [])];
  const e = { time: entry.time, seed: entry.seed || 0, date: entry.date || '' };
  let pos = list.findIndex((x) => e.time < x.time);
  if (pos < 0) pos = list.length;
  list.splice(pos, 0, e);
  const rank = pos < MAX_SCORES ? pos + 1 : 0;
  base[size] = list.slice(0, MAX_SCORES);
  return { scores: base, rank };
}

export const scoresFor = (scores, size) => (normalizeScores(scores)[size] || []);

export function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0'), ss = String(r).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
