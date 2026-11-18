// The best score (F10, D22). Pure; main.js stores it through the kit's storage as `poo-sandwich-best`.

// A stored best is a finite number above 0; anything else (missing, corrupt, written by another page) counts as none.
// Scores saved before D22 are bare number strings ("1200"), which storage.get() already reads as numbers.
export const sanitizeBest = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

// What a finished run does to the best score. A debug run is never recorded (as in the other games), so it is never a
// new best either: the game-over screen shows the stored best instead. `save` is true when `best` should be stored.
export function judgeRun(stored, score, debug) {
  const best = sanitizeBest(stored);
  const isBest = !debug && Number.isFinite(score) && score > best;
  return { isBest, save: isBest, best: isBest ? score : best };
}
