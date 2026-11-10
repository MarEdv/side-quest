// Chores: hold-to-work tasks. Pure.
import { dist } from './geometry.js';

export const INTERACT_RANGE = 40;

// Base work seconds per chore type at normal difficulty.
export const CHORE_TYPES = {
  rake: { label: 'Rake leaves', time: 11 },
  trim: { label: 'Trim bush', time: 13 },
  mow: { label: 'Mow lawn patch', time: 15 },
  water: { label: 'Water flowers', time: 10 },
};

export function choreScale(difficulty) {
  return difficulty === 'easy' ? 0.75 : difficulty === 'hard' ? 1.25 : 1;
}

const LAYOUT = [
  ['rake', 180, 270], ['rake', 700, 380],
  ['trim', 120, 200], ['trim', 560, 200],
  ['mow', 300, 420], ['mow', 860, 330],
  ['water', 260, 128], ['water', 700, 128],
];

export function createChores(flags = {}) {
  const k = choreScale(flags.difficulty);
  return LAYOUT.map(([type, x, y], i) => ({
    id: i, type, x, y, work: CHORE_TYPES[type].time * k, progress: 0, done: false,
  }));
}

// Add dt seconds of work. Returns true on the frame the chore completes.
export function workOnChore(chore, dt) {
  if (chore.done) return false;
  chore.progress = Math.min(chore.work, chore.progress + dt);
  if (chore.progress >= chore.work) { chore.done = true; return true; }
  return false;
}

export function findChoreInRange(chores, px, py, range = INTERACT_RANGE) {
  let best = null, bd = Infinity;
  for (const c of chores) {
    if (c.done) continue;
    const d = dist(px, py, c.x, c.y);
    if (d <= range && d < bd) { best = c; bd = d; }
  }
  return best;
}

export const choresDoneCount = (chores) => chores.filter((c) => c.done).length;
export const allChoresDone = (chores) => chores.every((c) => c.done);
