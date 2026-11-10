// Scripted players used to balance the levels (L-4, D-27, D-28). Zero dependencies; they run the real game logic headlessly.
// Movement: an 8-neighbour Dijkstra distance field on a 10 px grid over the world obstacles (inflated by the player's half size).
//
// Policies (runBot(flags, seed, policy)):
//  - 'naive'  : walks to the nearest unfinished chore by path length, does any quest it is given first (most urgent first,
//               skipping one it cannot make in time), and NEVER hides from the wife. Measures time pressure only.
//  - 'hider'  : the naive player, plus the core skill of vision levels: when the wife comes out and could still hand out a
//               quest, it walks to the nearest spot hidden from her (the D-15 reachability idea: hidden from every position
//               and cone direction of her trip; from the patio sweep while she is on the patio or still in the warning), and
//               resumes chores once she is back inside or has already spotted it. It reads her route once she starts walking
//               (a human sees which way she turns). In `random` mode there is nothing to hide from, so it plays like 'naive'.
//  - 'sloppy' : the naive player, but it never drops the chore it is working on for a quest and only sets off for a quest
//               when the deadline is close (the trip barely fits), so quests stack up and some fail: this is the policy that
//               puts harmony under pressure.
// The bots never use Math.random and never draw from the game's RNG, so every (flags, seed, policy) run is deterministic.
import { createGame, update, PLAYER_SPEED, PLAYER_HALF } from '../src/game.js';
import { createWorld } from '../src/world.js';
import { INTERACT_RANGE, findChoreInRange, createChores } from '../src/chores.js';
import { questTarget, canGiveQuest } from '../src/quests.js';
import { canSee, WIFE } from '../src/wife.js';
import { DEFAULT_FLAGS } from '../src/config.js';
import { levelFlags } from '../src/levels.js';

export const POLICIES = Object.freeze(['naive', 'hider', 'sloppy']);

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
const centre = (i) => [(i % GW) * CELL + CELL / 2, ((i / GW) | 0) * CELL + CELL / 2];

// Multi-source Dijkstra: distance (px) from every cell to the nearest cell where isGoal(i) holds; Infinity if unreachable.
function buildField(isGoal) {
  const dist = new Float64Array(GW * GH).fill(Infinity);
  const heap = []; // [d, idx] binary min-heap
  const push = (d, i) => { heap.push([d, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  for (let i = 0; i < GW * GH; i++) if (free[i] && isGoal(i)) { dist[i] = 0; push(0, i); }
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
  return dist;
}

const fields = new Map();
// Field toward the goal region around a task spot (tx, ty).
function field(tx, ty) {
  const key = `${tx},${ty}`;
  if (!fields.has(key)) fields.set(key, buildField((i) => { const [x, y] = centre(i); return Math.hypot(x - tx, y - ty) <= GOAL_R; }));
  return fields.get(key);
}
const cellOf = (x, y) => [Math.min(GW - 1, Math.max(0, Math.floor(x / CELL))), Math.min(GH - 1, Math.max(0, Math.floor(y / CELL)))];
const fieldAt = (f, x, y) => { const [gx, gy] = cellOf(x, y); return f[gy * GW + gx]; };
const distTo = (x, y, tx, ty) => fieldAt(field(tx, ty), x, y);

// ---- hiding (hider policy) ----
// Every position + cone direction the wife takes during one appearance: the patio sweep (route null) or a roaming trip
// (walk out, sweep at the end, walk home), sampled like tests/wife.test.js (D-15).
function wifeStates(route) {
  const out = [];
  if (!route) {
    for (let i = 0; i <= 20; i++) out.push({ ...world.wifePos, dir: WIFE.baseDir - WIFE.sweepAmp + (i / 20) * 2 * WIFE.sweepAmp });
    return out;
  }
  const pts = [world.wifePos, ...route];
  for (const seq of [pts, [...pts].reverse()]) {
    for (let k = 0; k < seq.length - 1; k++) {
      const a = seq[k], b = seq[k + 1], L = Math.hypot(b.x - a.x, b.y - a.y), dir = Math.atan2(b.y - a.y, b.x - a.x);
      for (let t = 0; t <= L; t += 15) out.push({ x: a.x + ((b.x - a.x) * t) / L, y: a.y + ((b.y - a.y) * t) / L, dir });
    }
  }
  const e = route[route.length - 1], prev = route.length > 1 ? route[route.length - 2] : world.wifePos;
  const d0 = Math.atan2(e.y - prev.y, e.x - prev.x);
  for (let i = 0; i <= 20; i++) out.push({ x: e.x, y: e.y, dir: d0 - WIFE.sweepAmp + (i / 20) * 2 * WIFE.sweepAmp });
  return out;
}
// Cells hidden from all of those states (cell centre and corners, so standing anywhere in the cell is safe), and per chore
// a field toward the nearest hidden cell from which that chore can be worked (null when there is none). Cached per
// (trip, vision range); routeIdx -1 = the patio sweep.
const hideSets = new Map();
export function hideSet(routeIdx, range) {
  const key = `${routeIdx},${range}`;
  if (hideSets.has(key)) return hideSets.get(key);
  const st = wifeStates(routeIdx < 0 ? null : world.wifeRoutes[routeIdx]).map((w) => ({ ...w, range }));
  const off = [[0, 0], [-4, -4], [4, -4], [-4, 4], [4, 4]];
  const hidden = new Uint8Array(GW * GH);
  for (let i = 0; i < GW * GH; i++) {
    if (!free[i]) continue;
    const [x, y] = centre(i);
    hidden[i] = off.every(([ox, oy]) => st.every((w) => !canSee(w, { x: x + ox, y: y + oy }, world.obstacles))) ? 1 : 0;
  }
  const set = { hidden, chore: {} };
  for (const c of createChores({})) {
    const near = (i) => { if (!hidden[i]) return false; const [x, y] = centre(i); return Math.hypot(x - c.x, y - c.y) <= GOAL_R; };
    let has = false;
    for (let i = 0; i < GW * GH && !has; i++) has = near(i);
    set.chore[c.id] = has ? buildField(near) : null;
  }
  hideSets.set(key, set);
  return set;
}

// Input that moves the player one step down distance field f; `atGoal` is returned once the player is in a goal cell.
function stepDown(p, f, atGoal) {
  const [gx, gy] = cellOf(p.x, p.y);
  const here = f[gy * GW + gx];
  if (here === 0) return atGoal;
  let best = null, bd = here;
  for (const [dx, dy] of NB) {
    const nx = gx + dx, ny = gy + dy;
    if (!isFree(nx, ny) || (dx && dy && (!isFree(gx + dx, gy) || !isFree(gx, gy + dy)))) continue;
    const d = f[ny * GW + nx];
    if (d < bd) { bd = d; best = [nx, ny]; }
  }
  if (!best) return atGoal;
  const mx = best[0] * CELL + CELL / 2 - p.x, my = best[1] * CELL + CELL / 2 - p.y, len = Math.hypot(mx, my) || 1;
  return { moveX: mx / len, moveY: my / len };
}
// Toward a task spot; action when inside the goal region.
function steer(p, tx, ty) {
  if (Math.hypot(p.x - tx, p.y - ty) <= GOAL_R) return { action: true };
  return stepDown(p, field(tx, ty), { action: true });
}

const roams = (flags) => flags.wifeMode === 'hybrid' || (flags.wifeMode === 'vision' && !!flags.wifeRoam);
// Hider: the hiding move this tick, or null when it does not hide. When she comes out and could still hand out a quest,
// it looks for an unfinished chore that can be worked from a cell hidden from her whole appearance and that it can reach
// within `hideReach` seconds (default HIDE_REACH); if there is one it works that chore in cover (so hiding costs only the
// walk), otherwise it carries on and takes the quest. Standing idle in cover for a whole roaming trip (~9-12 s) cost more
// than the quest in every level, so the bot never does that (D-28). Patio (vision without roaming): she sweeps from the
// door, so it plans on the warning. Roaming: her route is unknown during the warning, so it keeps working and plans when
// she walks out (a human sees which way she turns). It stops hiding when she is back inside, has spotted it anyway (one
// quest per trip), or the quest cap is full, and when the chore in cover is done it only moves on to another hidden chore
// that is right there.
export const HIDE_REACH = 4;
function hideMove(s, memo) {
  const w = s.wife, f = s.flags, p = s.player;
  if (w.phase === 'inside') { memo.trip = undefined; return null; }
  if (f.wifeMode === 'random' || !canGiveQuest(s)) return null;
  if (w.phase === 'out' && w.spotted) return null;
  const roaming = roams(f);
  if (roaming && w.phase !== 'out') return null;
  // NB: the route is an object of the game's own world (s.world), not of this module's copy.
  const set = hideSet(roaming ? s.world.wifeRoutes.indexOf(w.route) : -1, w.range ?? f.visionRange);
  const trip = roaming ? w.route : 'patio';
  if (memo.trip !== trip || (memo.chore && memo.chore.done)) {
    const reach = memo.trip !== trip ? memo.reach : 0;
    memo.trip = trip; memo.field = null; memo.chore = null;
    let bd = Infinity;
    for (const c of s.chores) {
      const fc = !c.done && set.chore[c.id];
      if (!fc) continue;
      const d = fieldAt(fc, p.x, p.y);
      if (d < bd && d / PLAYER_SPEED <= reach) { bd = d; memo.field = fc; memo.chore = c; }
    }
  }
  return memo.field ? stepDown(p, memo.field, { action: true }) : null;
}

// Time (s) the quest still needs from here: walk to its target (and on to the drop when fetching), plus a margin.
function questNeed(s, q) {
  const p = s.player, t = questTarget(q);
  const go = distTo(p.x, p.y, t.x, t.y);
  const rest = q.stage === 'fetch' ? distTo(q.pickup.x, q.pickup.y, q.drop.x, q.drop.y) : 0;
  return (go + rest) / PLAYER_SPEED + 0.5;
}

// Decide what to do this tick. Returns an input object.
function decide(s, policy, memo) {
  const p = s.player;
  if (policy === 'hider') { const h = hideMove(s, memo); if (h) return h; }
  if (policy === 'sloppy') {
    // Never drop a chore that is under way.
    const c = findChoreInRange(s.chores, p.x, p.y);
    if (c && c.progress > 0) return { action: true };
  }
  // Carrying: deliver.
  if (s.carry != null) {
    const q = s.quests.find((x) => x.id === s.carry);
    if (q) return steer(p, q.drop.x, q.drop.y);
  }
  // Quests, most urgent first; skip one that cannot be finished in time. Sloppy waits until the trip barely fits.
  const qs = [...s.quests].sort((a, b) => a.timeLeft - b.timeLeft);
  for (const q of qs) {
    const need = questNeed(s, q);
    if (need > q.timeLeft) continue;
    if (policy === 'sloppy' && need + 3 < q.timeLeft) continue;
    const t = questTarget(q);
    return steer(p, t.x, t.y);
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
export function runBot(flags, seed, policy = 'naive', opts = {}) {
  if (!POLICIES.includes(policy)) throw new Error(`unknown policy ${policy}`);
  const s = createGame({ ...flags, seed }, 'playing');
  let given = 0, minHarmony = s.harmony;
  const memo = { trip: undefined, field: null, chore: null, reach: opts.hideReach ?? HIDE_REACH };
  while (s.phase === 'playing') {
    const input = decide(s, policy, memo);
    if (opts.onTick) opts.onTick(s, input, memo);
    update(s, { ...IDLE, ...input }, 1 / 60);
    for (const e of s.events) if (e.type === 'questGiven') given++;
    s.events.length = 0;
    if (s.harmony < minHarmony) minHarmony = s.harmony;
  }
  const won = s.phase === 'won';
  const slack = won ? Math.max(0, s.dayLength - s.time) : 0;
  return {
    won, slack, slackFrac: slack / s.dayLength, time: s.time, reason: s.endReason,
    given, completed: s.stats.questsCompleted, failed: s.stats.questsFailed, avoided: s.stats.questsAvoided,
    harmony: s.harmony, minHarmony, score: s.score,
  };
}

// Aggregate over seeds firstSeed..firstSeed+n-1 for one flag set and policy.
export function runMany(flags, n, firstSeed = 1, policy = 'naive', opts = {}) {
  const rows = [];
  for (let i = 0; i < n; i++) rows.push(runBot(flags, firstSeed + i, policy, opts));
  const mean = (k) => rows.reduce((a, r) => a + r[k], 0) / rows.length;
  return {
    n, policy, winRate: rows.filter((r) => r.won).length / rows.length, slack: mean('slack'), slackFrac: mean('slackFrac'),
    given: mean('given'), completed: mean('completed'), failed: mean('failed'), avoided: mean('avoided'),
    harmony: mean('harmony'), minHarmony: mean('minHarmony'), score: mean('score'),
    harmonyLosses: rows.filter((r) => r.reason === 'harmony').length / rows.length,
  };
}

export { levelFlags, DEFAULT_FLAGS };
