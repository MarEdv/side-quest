// Greedy bot used to balance the levels (L-4, D-27). Zero dependencies; runs the real game logic headlessly.
// It walks a grid-path distance field (8-neighbour Dijkstra over the world obstacles) to the nearest unfinished chore,
// does any quest it is given first (most urgent first, skipping one it cannot make in time), and NEVER hides from the wife.
// Humans can hide, so the bot is a pessimistic player: it measures how hard the *timing* is, not how hard it is to dodge.
import { createGame, update, PLAYER_SPEED, PLAYER_HALF } from '../src/game.js';
import { createWorld } from '../src/world.js';
import { INTERACT_RANGE } from '../src/chores.js';
import { questTarget } from '../src/quests.js';
import { DEFAULT_FLAGS } from '../src/config.js';
import { levelFlags } from '../src/levels.js';

const CELL = 10;
const world = createWorld();
const GW = Math.ceil(world.width / CELL), GH = Math.ceil(world.height / CELL);
const GOAL_R = INTERACT_RANGE - 8; // stop this close to a task's spot (inside the 40 px interact range)

const free = new Uint8Array(GW * GH);
for (let gy = 0; gy < GH; gy++) {
  for (let gx = 0; gx < GW; gx++) {
    const x = gx * CELL + CELL / 2, y = gy * CELL + CELL / 2, m = PLAYER_HALF + 2;
    free[gy * GW + gx] = world.obstacles.some((o) => x > o.x - m && x < o.x + o.w + m && y > o.y - m && y < o.y + o.h + m) ? 0 : 1;
  }
}
const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
const isFree = (gx, gy) => gx >= 0 && gy >= 0 && gx < GW && gy < GH && free[gy * GW + gx] === 1;

// Distance (in px) to the goal region around (tx, ty) for every cell; Infinity where unreachable.
const fields = new Map();
function field(tx, ty) {
  const key = `${tx},${ty}`;
  if (fields.has(key)) return fields.get(key);
  const dist = new Float64Array(GW * GH).fill(Infinity);
  const heap = []; // [d, idx] binary min-heap
  const push = (d, i) => { heap.push([d, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
    if (isFree(gx, gy) && Math.hypot(gx * CELL + CELL / 2 - tx, gy * CELL + CELL / 2 - ty) <= GOAL_R) { dist[gy * GW + gx] = 0; push(0, gy * GW + gx); }
  }
  while (heap.length) {
    const [d, i] = pop();
    if (d > dist[i]) continue;
    const gx = i % GW, gy = (i / GW) | 0;
    for (const [dx, dy, w] of NB) {
      const nx = gx + dx, ny = gy + dy;
      if (!isFree(nx, ny) || (dx && dy && (!isFree(gx + dx, gy) || !isFree(gx, gy + dy)))) continue;
      const nd = d + w * CELL;
      if (nd < dist[ny * GW + nx]) { dist[ny * GW + nx] = nd; push(nd, ny * GW + nx); }
    }
  }
  fields.set(key, dist);
  return dist;
}
const cellOf = (x, y) => [Math.min(GW - 1, Math.max(0, Math.floor(x / CELL))), Math.min(GH - 1, Math.max(0, Math.floor(y / CELL)))];
const distTo = (x, y, tx, ty) => { const [gx, gy] = cellOf(x, y); return field(tx, ty)[gy * GW + gx]; };

// Input that moves the player one step down the distance field toward (tx, ty); action when inside the goal region.
function steer(p, tx, ty) {
  const f = field(tx, ty), [gx, gy] = cellOf(p.x, p.y);
  const here = f[gy * GW + gx];
  if (here === 0 || Math.hypot(p.x - tx, p.y - ty) <= GOAL_R) return { action: true };
  let best = null, bd = here;
  for (const [dx, dy] of NB) {
    const nx = gx + dx, ny = gy + dy;
    if (!isFree(nx, ny) || (dx && dy && (!isFree(gx + dx, gy) || !isFree(gx, gy + dy)))) continue;
    const d = f[ny * GW + nx];
    if (d < bd) { bd = d; best = [nx, ny]; }
  }
  if (!best) return { action: true };
  const mx = best[0] * CELL + CELL / 2 - p.x, my = best[1] * CELL + CELL / 2 - p.y, len = Math.hypot(mx, my) || 1;
  return { moveX: mx / len, moveY: my / len };
}

// Decide what to do this tick. Returns an input object.
function decide(s) {
  const p = s.player;
  // Carrying: deliver.
  if (s.carry != null) {
    const q = s.quests.find((x) => x.id === s.carry);
    if (q) return steer(p, q.drop.x, q.drop.y);
  }
  // Quests, most urgent first; skip one that cannot be finished in time.
  const qs = [...s.quests].sort((a, b) => a.timeLeft - b.timeLeft);
  for (const q of qs) {
    const t = questTarget(q);
    const go = distTo(p.x, p.y, t.x, t.y);
    const rest = q.stage === 'fetch' ? distTo(q.pickup.x, q.pickup.y, q.drop.x, q.drop.y) : 0;
    if ((go + rest) / PLAYER_SPEED + 0.5 <= q.timeLeft) return steer(p, t.x, t.y);
  }
  // Chores: nearest unfinished one by path length.
  let best = null, bd = Infinity;
  for (const c of s.chores) {
    if (c.done) continue;
    const d = distTo(p.x, p.y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best ? steer(p, best.x, best.y) : {};
}

const IDLE = { up: false, down: false, left: false, right: false, action: false, pause: false, start: false, restart: false };

// Play one whole day. `flags` must be a complete flag set (e.g. levelFlags(level)). Returns the result row.
export function runBot(flags, seed) {
  const s = createGame({ ...flags, seed }, 'playing');
  let slackAt = null;
  let given = 0;
  while (s.phase === 'playing') {
    update(s, { ...IDLE, ...decide(s) }, 1 / 60);
    for (const e of s.events) if (e.type === 'questGiven') given++;
    s.events.length = 0;
  }
  const won = s.phase === 'won';
  slackAt = won ? Math.max(0, s.dayLength - s.time) : 0;
  return {
    won, slack: slackAt, slackFrac: slackAt / s.dayLength, time: s.time, reason: s.endReason,
    given, completed: s.stats.questsCompleted, failed: s.stats.questsFailed, avoided: s.stats.questsAvoided,
    harmony: s.harmony, score: s.score,
  };
}

// Aggregate over seeds 1..n for one flag set.
export function runMany(flags, n, firstSeed = 1) {
  const rows = [];
  for (let i = 0; i < n; i++) rows.push(runBot(flags, firstSeed + i));
  const mean = (k) => rows.reduce((a, r) => a + r[k], 0) / rows.length;
  return {
    n, winRate: rows.filter((r) => r.won).length / rows.length, slack: mean('slack'), slackFrac: mean('slackFrac'),
    given: mean('given'), completed: mean('completed'), failed: mean('failed'), avoided: mean('avoided'),
    harmony: mean('harmony'), score: mean('score'), harmonyLosses: rows.filter((r) => r.reason === 'harmony').length / rows.length,
  };
}

export { levelFlags, DEFAULT_FLAGS };
