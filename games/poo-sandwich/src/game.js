// Pure game state + update logic. No DOM access.
import { CONFIG as C } from './config.js';
import { WORLD, OBSTACLES, STATIONS, TASKS, POO_TASKS, BOSS_WAYPOINTS, PLAYER_START, BOSS_START } from './world.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// ---------- collision ----------
export function circleRectOverlap(x, y, r, rc) {
  const cx = Math.max(rc.x, Math.min(x, rc.x + rc.w));
  const cy = Math.max(rc.y, Math.min(y, rc.y + rc.h));
  return (x - cx) ** 2 + (y - cy) ** 2 < r * r;
}

export function pointInRect(x, y, rc) {
  return x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h;
}

// Push a circle out of every rect it overlaps.
export function resolveCircle(x, y, r, rects) {
  for (const rc of rects) {
    const cx = Math.max(rc.x, Math.min(x, rc.x + rc.w));
    const cy = Math.max(rc.y, Math.min(y, rc.y + rc.h));
    let dx = x - cx, dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      y = cy + (dy / d) * r;
    } else {
      // centre inside rect: push out via the nearest edge
      const l = x - rc.x, rr = rc.x + rc.w - x, t = y - rc.y, b = rc.y + rc.h - y;
      const m = Math.min(l, rr, t, b);
      if (m === l) x = rc.x - r;
      else if (m === rr) x = rc.x + rc.w + r;
      else if (m === t) y = rc.y - r;
      else y = rc.y + rc.h + r;
    }
  }
  return { x, y };
}

// Move a circle by (dx, dy), sliding along obstacles (axis-separated).
export function moveCircle(x, y, dx, dy, r, rects = OBSTACLES) {
  let p = resolveCircle(x + dx, y, r, rects);
  p = resolveCircle(p.x, p.y + dy, r, rects);
  return p;
}

// ---------- path finding (tiny BFS on a grid) ----------
const CELL = 16;
export function findPath(from, to, r = C.player.r, rects = OBSTACLES) {
  const gw = Math.ceil(WORLD.w / CELL), gh = Math.ceil(WORLD.h / CELL);
  const blocked = new Uint8Array(gw * gh);
  const infl = r - 2;
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const cx = gx * CELL + CELL / 2, cy = gy * CELL + CELL / 2;
    for (const rc of rects) if (circleRectOverlap(cx, cy, infl, rc)) { blocked[gy * gw + gx] = 1; break; }
  }
  const cell = (p) => ({
    gx: Math.max(0, Math.min(gw - 1, Math.floor(p.x / CELL))),
    gy: Math.max(0, Math.min(gh - 1, Math.floor(p.y / CELL))),
  });
  const s = cell(from);
  let g = cell(to);
  const idx = (c) => c.gy * gw + c.gx;
  // if the goal is blocked, snap to the nearest free cell
  if (blocked[idx(g)]) {
    let best = null, bd = Infinity;
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      if (blocked[gy * gw + gx]) continue;
      const d = (gx - g.gx) ** 2 + (gy - g.gy) ** 2;
      if (d < bd) { bd = d; best = { gx, gy }; }
    }
    if (!best) return null;
    g = best;
  }
  blocked[idx(s)] = 0;
  const prev = new Int32Array(gw * gh).fill(-2);
  prev[idx(s)] = -1;
  const q = [idx(s)];
  const goal = idx(g);
  for (let qi = 0; qi < q.length && prev[goal] === -2; qi++) {
    const cur = q[qi];
    const cx = cur % gw, cy = (cur / gw) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
      const ni = ny * gw + nx;
      if (blocked[ni] || prev[ni] !== -2) continue;
      if (dx && dy && (blocked[cy * gw + nx] || blocked[ny * gw + cx])) continue;
      prev[ni] = cur;
      q.push(ni);
    }
  }
  if (prev[goal] === -2) return null;
  const pts = [];
  for (let c = goal; c !== -1; c = prev[c]) pts.push({ x: (c % gw) * CELL + CELL / 2, y: ((c / gw) | 0) * CELL + CELL / 2 });
  pts.reverse();
  pts.shift(); // current cell
  // exact target if it was reachable as-is
  if (idx(cell(to)) === goal) pts.push({ x: to.x, y: to.y });
  return pts;
}

// ---------- state ----------
export function createGame(flags = {}, seed = 1) {
  const f = { controls: 'auto', poo: 'hit', daySeconds: 180, debug: false, ...flags };
  const rng = mulberry32(seed);
  return {
    flags: f, rng, t: 0, day: 0, phase: 'playing', score: 0, stress: 10,
    player: { x: PLAYER_START.x, y: PLAYER_START.y, r: C.player.r, vx: 0, vy: 0, face: 1, working: null, hitFlash: 0 },
    boss: { x: BOSS_START.x, y: BOSS_START.y, r: C.boss.r, state: 'wander', wp: null, pause: 1, throwT: C.firstThrowDelay, windT: 0, aimX: 0, aimY: 0, stuck: 0, face: -1 },
    tasks: [], projectiles: [], splats: [], events: [],
    nextId: 1, spawnT: 1.2, spawned: 0, target: null, targetId: null, path: null, pathT: 0,
    stats: { tasksDone: 0, pooDone: 0, hits: 0, dodged: 0, pooExpired: 0 },
    summary: null,
  };
}

const emit = (s, type, data = {}) => s.events.push({ type, ...data });
export const clockString = (s) => {
  const mins = Math.floor(9 * 60 + s.day * 8 * 60);
  return String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
};
export const throwInterval = (d) => lerp(C.throwInterval.start, C.throwInterval.end, d);
export const sandwichSpeed = (d) => lerp(C.sandwichSpeed.start, C.sandwichSpeed.end, d);

function pick(s, arr) { return arr[Math.floor(s.rng() * arr.length)]; }

export function addStress(s, amount) {
  s.stress = Math.max(0, Math.min(C.stress.max, s.stress + amount));
}

export function spawnTask(s) {
  const regular = s.tasks.filter((t) => t.kind === 'task');
  if (regular.length >= C.tasks.maxActive) {
    addStress(s, 3);
    emit(s, 'overload');
    return null;
  }
  const free = TASKS.filter((tpl) => !regular.some((t) => t.label === tpl.label));
  const tpl = pick(s, free.length ? free : TASKS);
  const task = { id: s.nextId++, kind: 'task', station: tpl.station, icon: tpl.icon, label: tpl.label, hold: tpl.hold, progress: 0, points: C.tasks.points };
  s.tasks.push(task);
  s.spawned++;
  emit(s, 'spawn', { task });
  return task;
}

export function addPooTask(s, accepted = false) {
  if (s.tasks.filter((t) => t.kind === 'poo').length >= C.poo.maxActive) return null;
  const tpl = pick(s, POO_TASKS);
  const dl = s.flags.poo === 'choice' ? C.poo.deadlineChoice : C.poo.deadline;
  const task = {
    id: s.nextId++, kind: 'poo', station: tpl.station, icon: tpl.icon, label: tpl.label, hold: tpl.hold,
    progress: 0, deadline: dl, timeLeft: dl, accepted, points: accepted ? C.poo.choicePoints : C.poo.points,
  };
  s.tasks.push(task);
  emit(s, 'pooTask', { task, accepted });
  return task;
}

// ---------- update ----------
export function update(s, dt, input = {}) {
  s.events.length = 0;
  if (s.phase !== 'playing') return s;
  dt = Math.min(dt, 0.05);
  s.t += dt;
  s.day = Math.min(1, s.t / s.flags.daySeconds);

  updatePlayer(s, dt, input);
  updateBoss(s, dt);
  updateProjectiles(s, dt);
  updateSplats(s, dt);
  updateTasks(s, dt);

  if (s.stress >= C.stress.max) {
    s.phase = 'lost';
    finish(s, false);
  } else if (s.day >= 1) {
    s.phase = 'won';
    const bonus = Math.round((C.stress.max - s.stress) * C.win.bonusPerStress);
    s.score += bonus;
    finish(s, true, bonus);
  }
  return s;
}

function finish(s, won, bonus = 0) {
  s.summary = { won, bonus, score: s.score, stress: Math.round(s.stress), ...s.stats };
  emit(s, won ? 'win' : 'lose');
}

function updatePlayer(s, dt, input) {
  const p = s.player;
  let mx = input.moveX || 0, my = input.moveY || 0;
  const manual = Math.hypot(mx, my) > 0.05;
  if (input.target && input.target.id !== s.targetId) {
    s.targetId = input.target.id;
    s.target = { x: input.target.x, y: input.target.y };
    s.path = null;
  }
  if (manual) { s.target = null; s.path = null; }
  else if (s.target) {
    if (!s.path || (s.pathT -= dt) <= 0) {
      s.path = findPath(p, s.target, p.r);
      s.pathT = 0.5;
    }
    while (s.path && s.path.length && dist(p.x, p.y, s.path[0].x, s.path[0].y) < 8) s.path.shift();
    if (!s.path || !s.path.length) { s.target = null; s.path = null; }
    else {
      const w = s.path[0];
      const d = dist(p.x, p.y, w.x, w.y);
      mx = (w.x - p.x) / d; my = (w.y - p.y) / d;
    }
  }
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  const sp = C.player.speed;
  const ox = p.x, oy = p.y;
  const np = moveCircle(p.x, p.y, mx * sp * dt, my * sp * dt, p.r);
  p.x = np.x; p.y = np.y;
  p.vx = (p.x - ox) / dt; p.vy = (p.y - oy) / dt;
  if (Math.abs(mx) > 0.1) p.face = mx > 0 ? 1 : -1;
  p.hitFlash = Math.max(0, p.hitFlash - dt);
}

function chooseWaypoint(s) {
  const b = s.boss;
  let best = null;
  for (let i = 0; i < 6; i++) {
    const w = pick(s, BOSS_WAYPOINTS);
    if (dist(w[0], w[1], b.x, b.y) > 80) { best = w; break; }
  }
  b.wp = best || pick(s, BOSS_WAYPOINTS);
  b.stuck = 0;
}

function updateBoss(s, dt) {
  const b = s.boss, p = s.player;
  const ramp = 1 + s.day * 0.4;
  b.throwT -= dt;
  if (b.state === 'windup') {
    b.windT -= dt;
    b.face = p.x >= b.x ? 1 : -1;
    // track the player until the throw instant, re-aiming with lead at release
    if (b.windT <= 0) { throwSandwich(s); b.state = 'wander'; b.pause = 0.4; b.throwT = throwInterval(s.day) * (0.75 + 0.5 * s.rng()); }
    return;
  }
  if (b.throwT <= 0) {
    b.state = 'windup';
    b.windT = C.boss.windup;
    emit(s, 'windup');
    return;
  }
  if (b.pause > 0) { b.pause -= dt; return; }
  if (!b.wp) chooseWaypoint(s);
  const d = dist(b.x, b.y, b.wp[0], b.wp[1]);
  if (d < 6 || b.stuck > 1.2) {
    b.wp = null;
    b.pause = C.boss.wanderPause[0] + s.rng() * (C.boss.wanderPause[1] - C.boss.wanderPause[0]);
    return;
  }
  const sp = C.boss.speed * ramp;
  const ox = b.x, oy = b.y;
  const np = moveCircle(b.x, b.y, ((b.wp[0] - b.x) / d) * sp * dt, ((b.wp[1] - b.y) / d) * sp * dt, b.r);
  b.x = np.x; b.y = np.y;
  if (dist(ox, oy, b.x, b.y) < sp * dt * 0.3) b.stuck += dt; else b.stuck = 0;
  if (Math.abs(b.wp[0] - b.x) > 2) b.face = b.wp[0] > b.x ? 1 : -1;
}

function throwSandwich(s) {
  const b = s.boss, p = s.player;
  const sp = sandwichSpeed(s.day);
  let ax = p.x + p.vx * C.sandwichLead, ay = p.y + p.vy * C.sandwichLead;
  ax = Math.max(24, Math.min(WORLD.w - 24, ax));
  ay = Math.max(24, Math.min(WORLD.h - 24, ay));
  let ang = Math.atan2(ay - b.y, ax - b.x) + (s.rng() - 0.5) * 2 * C.sandwichSpread;
  const d = Math.max(60, dist(b.x, b.y, ax, ay));
  s.projectiles.push({
    id: s.nextId++, x: b.x, y: b.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
    tx: b.x + Math.cos(ang) * d, ty: b.y + Math.sin(ang) * d, traveled: 0, dist: d, rot: 0, r: C.sandwichR,
  });
  emit(s, 'throw');
}

function splat(s, x, y, pickup) {
  const sp = { id: s.nextId++, x, y, age: 0, life: pickup ? C.poo.floorLife : 1.2, pickup, r: 16 };
  s.splats.push(sp);
  emit(s, 'splat', { x, y, pickup });
}

function updateProjectiles(s, dt) {
  const p = s.player;
  const keep = [];
  for (const pr of s.projectiles) {
    const step = Math.hypot(pr.vx, pr.vy) * dt;
    pr.x += pr.vx * dt; pr.y += pr.vy * dt;
    pr.traveled += step;
    pr.rot += dt * 12;
    if (dist(pr.x, pr.y, p.x, p.y) < pr.r + p.r) { onHit(s, pr); continue; }
    if (OBSTACLES.some((rc) => rc.kind !== 'table' && pointInRect(pr.x, pr.y, rc))) { splat(s, pr.x, pr.y, false); s.stats.dodged++; continue; }
    if (pr.traveled >= pr.dist) {
      splat(s, pr.x, pr.y, s.flags.poo === 'choice');
      s.stats.dodged++;
      emit(s, 'dodged', { x: pr.x, y: pr.y });
      continue;
    }
    keep.push(pr);
  }
  s.projectiles = keep;
}

function onHit(s, pr) {
  s.stats.hits++;
  s.player.hitFlash = 0.5;
  addStress(s, C.poo.hitStress);
  const task = addPooTask(s, false);
  splat(s, pr.x, pr.y, false);
  emit(s, 'hit', { x: pr.x, y: pr.y, task });
}

function updateSplats(s, dt) {
  const p = s.player;
  const keep = [];
  for (const sp of s.splats) {
    sp.age += dt;
    if (sp.pickup) {
      if (dist(sp.x, sp.y, p.x, p.y) < sp.r + p.r) {
        const t = addPooTask(s, true);
        if (t) { emit(s, 'pickup', { x: sp.x, y: sp.y, task: t }); continue; }
      }
      if (sp.age >= sp.life) { addStress(s, C.poo.ignoreStress); emit(s, 'ignored', { x: sp.x, y: sp.y }); continue; }
    } else if (sp.age >= sp.life) continue;
    keep.push(sp);
  }
  s.splats = keep;
}

export function stationAt(x, y, r = 0) {
  for (const st of Object.values(STATIONS)) if (dist(x, y, st.x, st.y) <= st.r + r * 0) return st;
  return null;
}

function updateTasks(s, dt) {
  const p = s.player;
  // spawning
  s.spawnT -= dt;
  if (s.spawnT <= 0) {
    spawnTask(s);
    s.spawnT = lerp(C.tasks.spawnInterval.start, C.tasks.spawnInterval.end, s.day) * (0.7 + 0.6 * s.rng());
  }
  // poo deadlines
  for (const t of s.tasks) {
    if (t.kind === 'poo') {
      t.timeLeft -= dt;
      if (t.timeLeft <= 0) {
        t.expired = true;
        addStress(s, C.poo.expireStress);
        s.stats.pooExpired++;
        emit(s, 'pooExpired', { task: t });
      }
    }
  }
  s.tasks = s.tasks.filter((t) => !t.expired);
  // pile-up stress
  const regularN = s.tasks.filter((t) => t.kind === 'task').length;
  if (regularN > 2) addStress(s, (regularN - 2) * C.tasks.pileStressPerSec * dt);
  // working: most urgent task at the station the player stands in
  const st = stationAt(p.x, p.y);
  let active = null;
  if (st) {
    const cands = s.tasks.filter((t) => t.station === st.id);
    cands.sort((a, b) => (a.kind === 'poo' ? a.timeLeft : 1e9) - (b.kind === 'poo' ? b.timeLeft : 1e9));
    active = cands[0] || null;
  }
  p.working = active ? active.id : null;
  if (active) {
    active.progress += dt;
    if (active.progress >= active.hold) completeTask(s, active);
  }
}

function completeTask(s, t) {
  s.tasks = s.tasks.filter((x) => x !== t);
  s.score += t.points;
  if (t.kind === 'poo') s.stats.pooDone++; else s.stats.tasksDone++;
  const relief = t.station === 'coffee' ? C.tasks.coffeeRelief : C.tasks.stressRelief;
  addStress(s, t.kind === 'poo' ? -relief * 2 : -relief);
  emit(s, t.kind === 'poo' ? 'pooDone' : 'taskDone', { task: t, x: s.player.x, y: s.player.y, points: t.points });
}
