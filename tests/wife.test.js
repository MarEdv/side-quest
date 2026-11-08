import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canSee, WIFE, updateWife, createWife, sightDistance } from '../src/wife.js';
import { createWorld } from '../src/world.js';
import { createRng } from '../src/rng.js';
import { normalizeAngle, segmentIntersectsAABB, rectsOverlap } from '../src/geometry.js';
import { createChores } from '../src/chores.js';
import { update, PLAYER_SPEED, PLAYER_HALF } from '../src/game.js';
import { giveQuest } from '../src/quests.js';
import { playing, NO_INPUT, mkFlags } from './helpers.js';

const world = createWorld();
const wifeAt = (dir) => ({ x: 480, y: 128, dir });

test('wife sees player in open ground within cone', () => {
  assert.equal(canSee(wifeAt(Math.PI / 2), { x: 480, y: 300 }, world.obstacles), true);
});

test('too far or outside cone is not seen', () => {
  assert.equal(canSee(wifeAt(Math.PI / 2), { x: 480, y: 128 + WIFE.range + 30 }, world.obstacles), false);
  assert.equal(canSee(wifeAt(Math.PI / 2), { x: 150, y: 140 }, world.obstacles), false);
});

test('hedge blocks line of sight, visible once clear of it', () => {
  // hedgeA spans x250-410, y180-210. Wife at (480,128) looking toward (300,260) passes through it.
  const dir = Math.atan2(260 - 128, 300 - 480);
  assert.equal(canSee(wifeAt(dir), { x: 300, y: 260 }, world.obstacles), false);
  assert.equal(canSee(wifeAt(dir), { x: 300, y: 260 }, world.obstacles.filter((o) => o.id !== 'hedgeA')), true);
});

test('shed blocks sight', () => {
  const w = (tx, ty) => ({ x: 600, y: 128, dir: Math.atan2(ty - 128, tx - 600) });
  assert.equal(canSee(w(700, 260), { x: 700, y: 260 }, world.obstacles), true); // left of shed: clear
  assert.equal(canSee(w(815, 230), { x: 815, y: 230 }, world.obstacles), false); // behind shed
});

test('vision mode: gives quest when spotted, counts avoided when hidden', () => {
  const flags = mkFlags({ questInterval: 3 });
  const rng = createRng(1);
  const ctxFor = (player) => ({ player, obstacles: world.obstacles, rng, flags });
  // spotted
  const w = createWife(world, rng, flags);
  w.phase = 'out'; w.timer = 5; w.sweepT = 0; // dir straight down
  const evs = updateWife(w, ctxFor({ x: 480, y: 300 }), 0.01);
  assert.ok(evs.includes('spotted'));
  // hidden behind hedge A
  const w2 = createWife(world, rng, flags);
  w2.phase = 'out'; w2.timer = 0.05; w2.sweepT = 0;
  const seen = [];
  for (let i = 0; i < 10; i++) seen.push(...updateWife(w2, ctxFor({ x: 330, y: 230 }), 0.02));
  assert.ok(!seen.includes('spotted'));
  assert.ok(seen.includes('avoided'));
});

test('game: spotted gives a quest with speech bubble; hidden player gets none', () => {
  const s = playing({ questInterval: 3 });
  s.wife.phase = 'out'; s.wife.timer = 5; s.wife.sweepT = 0;
  s.player.x = 480; s.player.y = 250;
  update(s, NO_INPUT, 1 / 60);
  assert.equal(s.quests.length, 1);
  assert.ok(s.wife.bubble && s.wife.bubble.text.length > 0);
  assert.ok(s.events.some((e) => e.type === 'spotted'));

  const h = playing({ questInterval: 3 });
  h.wife.phase = 'out'; h.wife.timer = 0.05; h.wife.sweepT = 0;
  h.player.x = 330; h.player.y = 240;
  for (let i = 0; i < 10; i++) update(h, NO_INPUT, 1 / 60);
  assert.equal(h.quests.length, 0);
  assert.equal(h.stats.questsAvoided, 1);
});

test('wife warns about 1.5s before coming out', () => {
  const flags = mkFlags({ questInterval: 3 });
  const rng = createRng(2);
  const w = createWife(world, rng, flags);
  w.timer = 0.01;
  const ctx = { player: { x: 0, y: 500 }, obstacles: world.obstacles, rng, flags };
  assert.ok(updateWife(w, ctx, 0.02).includes('warning'));
  assert.equal(w.phase, 'warning');
  assert.equal(w.timer > 1.4, true);
});

test('random mode: quest called regardless of player location', () => {
  const s = playing({ wifeMode: 'random', questInterval: 3 });
  s.player.x = 100; s.player.y = 500; // far, out of any cone
  for (let i = 0; i < 60 * 8 && s.quests.length === 0; i++) update(s, NO_INPUT, 1 / 60);
  assert.equal(s.quests.length, 1);
});

test('sightDistance: full range in the open, clipped at a hedge, and consistent with canSee', () => {
  const w = wifeAt(Math.PI / 2);
  assert.equal(sightDistance(w, Math.PI / 2, world.obstacles), WIFE.range);
  const a = Math.atan2(260 - 128, 300 - 480); // through hedgeA
  const d = sightDistance(w, a, world.obstacles);
  assert.ok(d > 60 && d < 200, `clipped distance ${d}`);
  const just = (k) => ({ x: 480 + Math.cos(a) * (d + k), y: 128 + Math.sin(a) * (d + k) });
  assert.equal(canSee({ ...w, dir: a }, just(-2), world.obstacles), true);
  assert.equal(canSee({ ...w, dir: a }, just(40), world.obstacles), false);
});

test('hiding while the quest cap is full is not counted as avoided', () => {
  for (const flags of [{ questInterval: 3, maxActiveQuests: 0 }, { questInterval: 3, maxActiveQuests: 1 }]) {
    const h = playing(flags);
    if (flags.maxActiveQuests === 1) giveQuest(h);
    h.wife.phase = 'out'; h.wife.timer = 0.05; h.wife.sweepT = 0;
    h.player.x = 330; h.player.y = 240;
    for (let i = 0; i < 10; i++) update(h, NO_INPUT, 1 / 60);
    assert.equal(h.wife.phase, 'inside');
    assert.equal(h.stats.questsAvoided, 0);
  }
});

test('W-9: from every chore a hiding spot is reachable in a straight line within the warning', async () => {
  const { createChores } = await import('../src/chores.js');
  const { PLAYER_SPEED, PLAYER_HALF } = await import('../src/game.js');
  const { rectsOverlap, segmentIntersectsAABB } = await import('../src/geometry.js');
  const reach = PLAYER_SPEED * WIFE.warnTime;
  const dirs = Array.from({ length: 41 }, (_, i) => WIFE.baseDir - WIFE.sweepAmp + (i / 40) * 2 * WIFE.sweepAmp);
  const walkable = (x, y) => !world.obstacles.some((o) => rectsOverlap({ x: x - PLAYER_HALF, y: y - PLAYER_HALF, w: 2 * PLAYER_HALF, h: 2 * PLAYER_HALF }, o));
  // Conservative straight path: inflate obstacles by the player's half-size.
  const pathClear = (x1, y1, x2, y2) => !world.obstacles.some((o) => segmentIntersectsAABB(x1, y1, x2, y2, { x: o.x - PLAYER_HALF, y: o.y - PLAYER_HALF, w: o.w + 2 * PLAYER_HALF, h: o.h + 2 * PLAYER_HALF }));
  for (const c of createChores({})) {
    let found = false;
    for (let x = 10; x < 950 && !found; x += 6) for (let y = 110; y < 530 && !found; y += 6) {
      if (Math.hypot(x - c.x, y - c.y) > reach * 0.9 || !walkable(x, y) || !pathClear(c.x, c.y, x, y)) continue;
      found = dirs.every((dir) => !canSee({ ...world.wifePos, dir }, { x, y }, world.obstacles));
    }
    assert.ok(found, `no reachable hiding spot from ${c.type} at ${c.x},${c.y}`);
  }
});

// ---- wifeRoam / visionRange (D-15) ----
const roamCtx = (flags, player, rng) => ({ player, obstacles: world.obstacles, rng, flags, world });
const NOWHERE = { x: -5000, y: -5000 };
function startRoam(flagOver = {}, routeIdx = 0) {
  const flags = mkFlags({ questInterval: 3, ...flagOver });
  const rng = createRng(5);
  const w = createWife(world, rng, flags);
  w.phase = 'warning'; w.timer = 0.01;
  return { flags, rng, w, routeIdx };
}
const pathLength = (route) => { let L = 0, p = world.wifePos; for (const q of route) { L += Math.hypot(q.x - p.x, q.y - p.y); p = q; } return L; };

test('roam: she walks out to a waypoint, looks around, and returns to the door', () => {
  const { flags, rng, w } = startRoam();
  const ctx = roamCtx(flags, NOWHERE, rng);
  const seen = [];
  let reachedStop = null, t = 0;
  for (let i = 0; i < 60 * 60 && !seen.includes('left'); i++, t += 1 / 60) {
    seen.push(...updateWife(w, ctx, 1 / 60));
    if (w.leg === 'look' && !reachedStop) reachedStop = { x: w.x, y: w.y };
  }
  assert.ok(seen.includes('out') && seen.includes('avoided') && seen.includes('left'));
  assert.ok(!seen.includes('spotted'));
  assert.ok(reachedStop, 'reached the look-around stage');
  assert.ok(world.wifeRoutes.some((r) => { const e = r[r.length - 1]; return e.x === reachedStop.x && e.y === reachedStop.y; }), 'stopped exactly on a route end');
  assert.equal(w.phase, 'inside');
  assert.equal(w.x, world.wifePos.x); assert.equal(w.y, world.wifePos.y);
  const route = world.wifeRoutes.find((r) => r[r.length - 1].x === reachedStop.x && r[r.length - 1].y === reachedStop.y);
  const expected = 2 * pathLength(route) / WIFE.walkSpeed + WIFE.lookTime;
  assert.ok(Math.abs(t - expected) < 0.2, `took ${t.toFixed(2)}s, expected ~${expected.toFixed(2)}s`);
});

test('roam: walking speed is slower than the player (90 vs 150 px/s)', () => {
  assert.ok(WIFE.walkSpeed < 150);
  const { flags, rng, w } = startRoam();
  const ctx = roamCtx(flags, NOWHERE, rng);
  updateWife(w, ctx, 0.02); updateWife(w, ctx, 0.02); // warning -> out, first step
  const x0 = w.x, y0 = w.y;
  for (let i = 0; i < 60; i++) updateWife(w, ctx, 1 / 60); // one second
  assert.ok(Math.abs(Math.hypot(w.x - x0, w.y - y0) - WIFE.walkSpeed) < 1, 'moved ~90px in 1 s');
});

test('roam: cone faces her direction of motion while walking and sweeps while standing', () => {
  for (let ri = 0; ri < world.wifeRoutes.length; ri++) {
    const { flags, rng, w } = startRoam();
    const ctx = roamCtx(flags, NOWHERE, rng);
    updateWife(w, ctx, 0.02); updateWife(w, ctx, 0.02);
    let walkSamples = 0, lookDirs = [], lookPos = null;
    for (let i = 0; i < 60 * 40 && w.phase === 'out'; i++) {
      const px = w.x, py = w.y;
      updateWife(w, ctx, 1 / 60);
      const dx = w.x - px, dy = w.y - py;
      if (w.moving && Math.hypot(dx, dy) > 0.5) {
        const diff = Math.abs(normalizeAngle(Math.atan2(dy, dx) - w.dir));
        assert.ok(diff < 0.01, `walking dir off by ${diff}`);
        walkSamples++;
      } else if (w.leg === 'look') {
        lookPos ??= { x: w.x, y: w.y };
        assert.ok(w.x === lookPos.x && w.y === lookPos.y);
        lookDirs.push(w.dir);
      }
    }
    assert.ok(walkSamples > 100);
    assert.ok(Math.max(...lookDirs) - Math.min(...lookDirs) > 1.5, 'cone sweeps while she stands');
    break; // one random route per run is enough; the other routes are covered by the legs-clear test
  }
});

test('roam: spotting stops her, she lingers >= 3 s, then walks home; no avoided', () => {
  const { flags, rng, w } = startRoam();
  const player = { x: 480, y: 300 }; // straight below the door: seen as soon as she turns toward it
  const ctx = roamCtx(flags, player, rng);
  const seen = [];
  let stillFor = 0;
  for (let i = 0; i < 60 * 60 && !seen.includes('left'); i++) {
    seen.push(...updateWife(w, ctx, 1 / 60));
    if (w.leg === 'linger') { stillFor += 1 / 60; assert.equal(w.moving, false); }
  }
  if (seen.includes('spotted')) {
    assert.ok(stillFor >= WIFE.spottedLinger - 0.05);
    assert.ok(!seen.includes('avoided'));
  }
  assert.ok(seen.includes('left'));
});

test('roam: flag off keeps the patio behaviour (she stays at the door and sweeps for outTime)', () => {
  const { flags, rng, w } = startRoam({ wifeRoam: false });
  const ctx = roamCtx(flags, NOWHERE, rng);
  const seen = [];
  let t = 0;
  while (!seen.includes('left') && t < 30) { seen.push(...updateWife(w, ctx, 1 / 60)); t += 1 / 60; assert.equal(w.x, world.wifePos.x); assert.equal(w.leg, null); }
  assert.ok(Math.abs(t - WIFE.outTime) < 0.1);
  assert.ok(seen.includes('avoided'));
});

test('roam: random mode keeps the patio behaviour', () => {
  const { flags, rng, w } = startRoam({ wifeMode: 'random' });
  const ctx = roamCtx(flags, NOWHERE, rng);
  for (let i = 0; i < 60 * 3; i++) updateWife(w, ctx, 1 / 60);
  assert.equal(w.leg, null); assert.equal(w.x, world.wifePos.x);
});

test('roam: with the cap full she still walks, and hiding is not counted as avoided', () => {
  const s = playing({ questInterval: 3, maxActiveQuests: 0 });
  s.wife.phase = 'warning'; s.wife.timer = 0.01;
  s.player.x = 20; s.player.y = 520;
  for (let i = 0; i < 60 * 40 && !(s.wife.phase === 'inside' && s.events.some((e) => e.type === 'wifeLeft')); i++) update(s, NO_INPUT, 1 / 60);
  assert.equal(s.stats.questsAvoided, 0);
});

test('visionRange: honoured by canSee, sightDistance and createWife', () => {
  const p = { x: 480, y: 128 + 200 };
  const base = { x: 480, y: 128, dir: Math.PI / 2 };
  assert.equal(canSee({ ...base, range: 150 }, p, world.obstacles), false);
  assert.equal(canSee({ ...base, range: 250 }, p, world.obstacles), true);
  assert.equal(canSee({ ...base, range: 500 }, { x: 480, y: 128 + 400 }, world.obstacles), true);
  assert.equal(sightDistance({ ...base, range: 180 }, Math.PI / 2, world.obstacles), 180);
  const rng = createRng(1);
  assert.equal(createWife(world, rng, mkFlags({ visionRange: 200 })).range, 200);
  assert.equal(createWife(world, rng, mkFlags()).range, 320);
  // end to end (patio mode): player 250 px away is spotted at 320 but not at 200
  for (const [range, expect] of [[320, true], [200, false]]) {
    const s = playing({ wifeRoam: false, visionRange: range, questInterval: 3 });
    s.wife.phase = 'out'; s.wife.timer = 5; s.wife.sweepT = 0;
    s.player.x = 480; s.player.y = 128 + 250;
    update(s, NO_INPUT, 1 / 60);
    assert.equal(s.events.some((e) => e.type === 'spotted'), expect);
  }
});

test('roam routes: 4-6 routes, every leg is a clear straight line, together they cover the yard', () => {
  const routes = world.wifeRoutes;
  assert.ok(routes.length >= 4 && routes.length <= 6);
  const M = 8; // her body radius
  for (const r of routes) {
    let p = world.wifePos;
    for (const q of r) {
      for (const o of world.obstacles) {
        assert.ok(!segmentIntersectsAABB(p.x, p.y, q.x, q.y, { x: o.x - M, y: o.y - M, w: o.w + 2 * M, h: o.h + 2 * M }), `leg to ${q.x},${q.y} hits ${o.id}`);
      }
      p = q;
    }
  }
  // each chore is within the (default) range of at least one route end
  for (const c of createChores({})) {
    assert.ok(routes.some((r) => { const e = r[r.length - 1]; return Math.hypot(e.x - c.x, e.y - c.y) <= WIFE.range; }), `chore ${c.type} ${c.x},${c.y} uncovered`);
  }
});

test('roam: a spot hidden from her whole trip is reachable from every chore within warning + outbound walk', () => {
  const H = PLAYER_HALF, CELL = 12, GW = 80, GH = 45;
  const free = (i, j) => i > 0 && j > 0 && i < GW - 1 && j < GH - 1 &&
    !world.obstacles.some((o) => rectsOverlap({ x: i * CELL + CELL / 2 - H - 1, y: j * CELL + CELL / 2 - H - 1, w: 2 * H + 2, h: 2 * H + 2 }, o));
  const grid = Array.from({ length: GH }, (_, j) => Array.from({ length: GW }, (_, i) => free(i, j)));
  const bfs = (sx, sy) => {
    const d = Array.from({ length: GH }, () => Array(GW).fill(Infinity));
    const q = [[Math.floor(sx / CELL), Math.floor(sy / CELL)]]; d[q[0][1]][q[0][0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const [i, j] = q[h];
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = i + a, y = j + b;
        if (x < 0 || y < 0 || x >= GW || y >= GH || !grid[y][x] || d[y][x] < Infinity) continue;
        d[y][x] = d[j][i] + CELL; q.push([x, y]);
      }
    }
    return d;
  };
  const statesOf = (route) => {
    const out = [], pts = [world.wifePos, ...route];
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
  };
  for (const c of createChores({})) {
    const d = bfs(c.x, c.y);
    for (const r of world.wifeRoutes) {
      const reach = (WIFE.warnTime + pathLength(r) / WIFE.walkSpeed) * PLAYER_SPEED;
      const st = statesOf(r);
      let ok = false;
      for (let j = 0; j < GH && !ok; j++) for (let i = 0; i < GW && !ok; i++) {
        if (d[j][i] > reach) continue;
        const p = { x: i * CELL + CELL / 2, y: j * CELL + CELL / 2 };
        ok = st.every((s) => !canSee(s, p, world.obstacles));
      }
      assert.ok(ok, `no hiding spot from ${c.type} at ${c.x},${c.y} for route ending ${JSON.stringify(r[r.length - 1])}`);
    }
  }
});
