// Traffic (TF-1..TF-4, D5, D8). Pure: spawning, following, lane changes with a blinker, oncoming cars, despawning.
// A car: { id, kind ('car'|'van'|'truck'), color (index into CFG.traffic.palette), x, lane, z, speed (m/s, negative =
// oncoming), cruise (the speed it wants, signed), width, length, braking, blink (-1 left | 0 | 1 right), blinkTimer,
// targetLane, slide (true while moving over), cooldown, rel/gap/hit/noNear (bookkeeping of game.js: collisions and
// near misses) }. z and x are the car's centre. The player counts as a car that others follow and look out for.
import { CFG } from './config.js';
import { clamp, emit } from './core.js';
import { laneX } from './track.js';

const T = CFG.traffic;

// Expected number of cars in one lane over the window ahead, for the stage and the difficulty.
export function targetCount(flags, track, stage, lane) {
  const diff = CFG.difficulty[flags.difficulty] || CFG.difficulty.normal;
  let per100;
  if (track.road === 'highway') per100 = T.density.highway[stage] * T.laneWeight[lane];
  else per100 = (lane === 0 ? T.density.countryOncoming : T.density.countrySame)[stage];
  return (per100 * diff.density * T.window) / 100;
}

function pickKind(s, rng, lane) {
  const [truck, van] = T.kinds[s.track.road][s.stage];
  const r = rng.next();
  if (r < truck && !(s.track.road === 'highway' && lane < 2)) return 'truck'; // highway trucks keep to the right lane
  if (r < truck + van) return 'van';
  return 'car';
}

function cruiseFor(s, rng, kind, lane) {
  const road = s.track.road;
  let v;
  if (road === 'highway') v = kind === 'truck' ? rng.range(...T.speeds.truck) : rng.range(...T.speeds.highway[lane]);
  else if (lane === 0) v = -rng.range(...T.speeds.countryOncoming);
  else v = rng.range(...(kind === 'truck' ? T.speeds.countryTruck : T.speeds.countrySame));
  if (kind === 'van') v += v < 0 ? -T.speeds.van : T.speeds.van; // vans are a little slower
  return Math.round(v * 100) / 100;
}

function makeCar(s, lane, z, kind, speed) {
  const { rng, player, track } = s;
  const dim = T.sizes[kind];
  const car = {
    id: s.nextId++, kind, color: rng.int(0, T.palette.length - 1), x: laneX(track, lane), lane, z, speed, cruise: speed,
    width: dim.width, length: dim.length, braking: false, blink: 0, blinkTimer: 0, targetLane: lane, slide: false,
    cooldown: rng.range(...T.cooldown), rel: z - player.z, gap: 99, hit: 0, noNear: false,
  };
  s.cars.push(car);
  return car;
}

const spaceFree = (s, lane, z, spacing = T.minSpacing) => !s.cars.some((o) => o.lane === lane && Math.abs(o.z - z) < spacing);

function spawnAt(s, lane, z) {
  const kind = pickKind(s, s.rng, lane);
  return makeCar(s, lane, z, kind, cruiseFor(s, s.rng, kind, lane));
}

// The first cars of a drive: spread over the window, none closer than CFG.traffic.startMin to the player.
export function populate(s) {
  s.spawn = { lane: new Array(s.track.lanes).fill(0), behind: s.rng.range(...T.behindEvery) };
  for (let lane = 0; lane < s.track.lanes; lane++) {
    const n = Math.round(targetCount(s.flags, s.track, s.stage, lane));
    for (let i = 0, tries = 0; i < n && tries < 30; tries++) {
      const z = s.player.z + s.rng.range(T.startMin, T.window);
      if (!spaceFree(s, lane, z)) continue;
      spawnAt(s, lane, z);
      i++;
    }
  }
}

// ----- looking around

// The nearest thing ahead of car `c` in its direction of travel that is (partly) in its way: { gap, speed } (the gap
// between the bumpers, the leader's speed along the direction), or null.
function leaderOf(s, c, dir) {
  let best = null;
  const look = (o) => {
    if (o === c) return;
    const dz = (o.z - c.z) * dir;
    if (dz <= 0 || dz > 150) return;
    if (Math.abs(o.x - c.x) >= (o.width + c.width) / 2 + T.latMargin) return;
    const gap = dz - (o.length + c.length) / 2;
    if (!best || gap < best.gap) best = { gap, speed: o.speed * dir };
  };
  for (const o of s.cars) if (o.cruise * dir > 0) look(o);
  if (dir > 0) look(s.player);
  return best;
}

// Is `lane` free for car c to move into: no car (the player included) in that lane close ahead or behind, with more
// room for a car that is coming up fast behind.
export function gapFree(s, c, lane) {
  const tx = laneX(s.track, lane);
  const ok = (o) => {
    if (o === c || Math.abs(o.x - tx) >= (s.track.laneWidth + o.width) / 2 - 0.3) return true;
    const dz = o.z - c.z, half = (o.length + c.length) / 2;
    if (dz >= 0) return dz - half >= T.gapAhead + Math.max(0, c.speed - o.speed) * T.closeAhead;
    return -dz - half >= T.gapBehind + Math.max(0, o.speed - c.speed) * T.closeBehind;
  };
  return s.cars.every(ok) && ok(s.player);
}

// ----- one car

function laneLogic(s, c, dt, blocked) {
  if (c.slide) return;
  if (c.blink !== 0) {
    c.blinkTimer -= dt;
    if (c.blinkTimer > 0) return;
    if (gapFree(s, c, c.targetLane)) { c.lane = c.targetLane; c.slide = true; } // the blinker stays on while sliding
    else { c.blink = 0; c.targetLane = c.lane; c.cooldown = T.cooldown[0]; }
    return;
  }
  c.cooldown -= dt;
  if (c.cooldown > 0) return;
  const diff = CFG.difficulty[s.flags.difficulty] || CFG.difficulty.normal;
  if (!s.rng.chance((blocked ? T.changeBlocked : T.changeFree) * diff.laneChange * dt)) return;
  const dirs = blocked || s.rng.chance(0.5) ? [-1, 1] : [1, -1]; // -1 = left, the passing lane
  for (const d of dirs) {
    const lane = c.lane + d;
    if (lane < 0 || lane >= s.track.lanes || (c.kind === 'truck' && lane === 0)) continue;
    if (!gapFree(s, c, lane)) continue;
    c.blink = d; c.blinkTimer = T.blink; c.targetLane = lane;
    emit(s, { type: 'blink', carId: c.id, dir: d });
    return;
  }
  c.cooldown = T.cooldown[0] / 2;
}

function driveCar(s, c, dt) {
  const dir = c.cruise < 0 ? -1 : 1;
  const lead = leaderOf(s, c, dir);
  const mine = c.speed * dir;
  const cruise = Math.abs(c.cruise);
  let want = cruise;
  if (lead) want = Math.min(cruise, Math.max(0, lead.speed + (lead.gap - (T.minGap + mine * T.headway)) * T.pull));
  const dv = clamp((want - mine) * 1.5, -T.decel, T.accel) * dt;
  c.speed = Math.max(0, mine + dv) * dir;
  c.braking = dv / dt < -T.brakeFlag;
  if (s.track.road === 'highway') laneLogic(s, c, dt, want < cruise - 1);

  const tx = laneX(s.track, c.lane);
  if (c.slide) {
    c.x += clamp(tx - c.x, -(s.track.laneWidth / T.slide) * dt, (s.track.laneWidth / T.slide) * dt);
    if (Math.abs(tx - c.x) < 1e-6) { c.x = tx; c.slide = false; c.blink = 0; c.cooldown = s.rng.range(...T.cooldown); }
  } else c.x += clamp(tx - c.x, -T.recenter * dt, T.recenter * dt);
  c.z += c.speed * dt;
}

// ----- spawning and despawning

function spawnAhead(s, dt) {
  const { player, track, rng } = s;
  for (let lane = 0; lane < track.lanes; lane++) {
    if ((s.spawn.lane[lane] -= dt) > 0) continue;
    const want = Math.round(targetCount(s.flags, track, s.stage, lane));
    const have = s.cars.reduce((n, c) => n + (c.lane === lane && c.z > player.z && c.z < player.z + T.window ? 1 : 0), 0);
    if (have >= want) { s.spawn.lane[lane] = 0.25; continue; }
    const z = player.z + rng.range(T.spawnMin, T.spawnMax);
    if (!spaceFree(s, lane, z)) { s.spawn.lane[lane] = 0.2; continue; }
    spawnAt(s, lane, z);
    s.spawn.lane[lane] = rng.range(...T.spawnCooldown);
  }
}

// Faster cars that come up from behind (highway only), only when there is room.
function spawnBehind(s, dt) {
  const { player, rng } = s;
  if ((s.spawn.behind -= dt) > 0) return;
  const diff = CFG.difficulty[s.flags.difficulty] || CFG.difficulty.normal;
  s.spawn.behind = rng.range(...T.behindEvery) / (diff.density * (1 + 0.4 * s.stage));
  const lane = rng.pick([0, 0, 1]);
  const z = player.z - rng.range(T.behindMin, T.behindMax);
  const speed = clamp(player.speed + rng.range(...T.behindFaster), T.behindSpeed[0], T.behindSpeed[1]);
  if (speed < player.speed + 2 || !spaceFree(s, lane, z, 45)) return;
  const kind = pickKind(s, rng, lane) === 'van' ? 'van' : 'car';
  makeCar(s, lane, z, kind, Math.round(speed * 100) / 100);
}

export function stepTraffic(s, dt) {
  for (const c of s.cars) driveCar(s, c, dt);
  const { player } = s;
  let n = 0;
  for (const c of s.cars) if (c.z > player.z - T.despawnBehind && c.z < player.z + T.despawnAhead) s.cars[n++] = c;
  s.cars.length = n;
  spawnAhead(s, dt);
  if (s.track.road === 'highway') spawnBehind(s, dt);
}
