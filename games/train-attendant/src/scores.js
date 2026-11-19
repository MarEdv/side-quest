// Top-5 best scores per trip length (S-3, pure). Shape: { short: [{ score, stars, seed, difficulty, date }], ... }.
// The stored copy lives under the key `scores` of the game's storage (prefix train-attendant.).
import { TRIP_NAMES, DIFFICULTIES } from './config.js';

export const MAX_SCORES = 5;
export const SCORES_KEY = 'scores';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/; // anything else in stored data is dropped

const clean = (e) => ({
  score: Math.round(e.score), stars: Math.min(5, Math.max(1, Math.round(e.stars) || 1)),
  seed: Number.isInteger(e.seed) ? e.seed : 0,
  difficulty: DIFFICULTIES.includes(e.difficulty) ? e.difficulty : 'normal',
  date: DATE_RE.test(e.date) ? e.date : '',
});

export function normalizeScores(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const trip of TRIP_NAMES) {
    if (!Array.isArray(raw[trip])) continue;
    const list = raw[trip].filter((e) => e && Number.isFinite(e.score)).map(clean).sort((a, b) => b.score - a.score).slice(0, MAX_SCORES);
    if (list.length) out[trip] = list;
  }
  return out;
}

// Returns { scores, rank } with a new scores object (the input is not mutated); rank is 1-based, 0 when the score did
// not make the top 5. A tie goes below the older score.
export function addScore(scores, trip, entry) {
  const base = normalizeScores(scores);
  if (!TRIP_NAMES.includes(trip) || !Number.isFinite(entry?.score)) return { scores: base, rank: 0 };
  const list = [...(base[trip] || [])];
  const e = clean(entry);
  let pos = list.findIndex((x) => e.score > x.score);
  if (pos < 0) pos = list.length;
  list.splice(pos, 0, e);
  base[trip] = list.slice(0, MAX_SCORES);
  return { scores: base, rank: pos < MAX_SCORES ? pos + 1 : 0 };
}

export const scoresFor = (scores, trip) => normalizeScores(scores)[trip] || [];

// Loads, adds and stores a finished run. Debug runs are not recorded (rank 0). Returns the rank.
export function recordRun(storage, flags, entry) {
  if (flags.debug) return 0;
  const { scores, rank } = addScore(storage.get(SCORES_KEY, {}), flags.trip, entry);
  if (rank) storage.set(SCORES_KEY, scores);
  return rank;
}

export const loadScores = (storage) => normalizeScores(storage.get(SCORES_KEY, {}));
