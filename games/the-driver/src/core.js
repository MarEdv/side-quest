// Small helpers shared by the game modules: the event queue, clamping, the unit conversion. Pure.
const r2 = (n) => Math.round(n * 100) / 100;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const kmh = (ms) => ms * 3.6;
// Appends an event for this step (state.events is emptied at the start of every step()).
export const emit = (s, ev) => { s.events.push({ ...ev, at: r2(s.time) }); };
