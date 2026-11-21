// Balance bots (V-7, D10+): they read the game state and return an input object each step, like a player would.
//   idle   holds its lane with auto pedals and only corrects for curves; never brakes or dodges.
//   sloppy distracted: notices trouble late (and sometimes not at all), dodges to a random side without looking, brakes
//          half of the time, steers with a wide margin.
//   good   looks ahead: picks the lane with the most room (leaving a lane only into a free side gap), brakes when boxed
//          in, uses the gas on a free road, slips close past cars for near misses, and overtakes on the country road
//          only through a gap in the oncoming traffic.
import { CFG } from '../src/config.js';
import { createRng } from '../src/kit/rng.js';
import { segmentAt, laneX, laneAt } from '../src/track.js';

export const BOT_KINDS = ['idle', 'sloppy', 'good'];

const PROFILES = {
  good: { think: 4, want: 42, shave: 0.7, margin: 0.5, comfort: 6, safeHead: 0.9, hyst: 30 },
  sloppy: { think: [10, 30], notice: 0.9, wrongSide: 0.4, brake: 0.7, deadband: 0.6, want: 31 },
};

// Steering for the free mode: a target x, pulse-width modulated (steer needed, held as left/right presses over a few
// steps), which also cancels the centrifugal push.
function steerFree(s, st, targetX, deadband = 0) {
  const p = s.player, v = Math.max(p.speed, 1);
  const err = targetX - p.x;
  const drift = -v * v * segmentAt(s.track, p.z + 10).curve * CFG.player.drift;
  const vNeed = Math.max(-5, Math.min(5, Math.abs(err) < deadband ? 0 : err * 1.6)) - drift;
  const u = Math.max(-1, Math.min(1, vNeed / (v * CFG.player.lateral)));
  st.acc += u;
  const inp = {};
  if (st.acc >= 0.5) { inp.right = true; st.acc -= 1; } else if (st.acc <= -0.5) { inp.left = true; st.acc += 1; }
  st.acc = Math.max(-1.5, Math.min(1.5, st.acc));
  return inp;
}

// Lanes mode: press towards the target lane (one press per step at most).
function steerLanes(s, lane) {
  const p = s.player;
  if (lane > p.laneTarget) return { rightPressed: true };
  if (lane < p.laneTarget) return { leftPressed: true };
  return {};
}

const steer = (s, st, lane, x, deadband) => (s.flags.steer === 'lanes' ? steerLanes(s, lane) : steerFree(s, st, x, deadband));

// The nearest car ahead whose body would be in the way at lateral position x: { gap, closing, car } (closing > 0 means
// we are catching up), or null. Looks `reach` metres ahead.
function ahead(s, x, reach = 300) {
  const p = s.player;
  let best = null;
  for (const c of s.cars) {
    const dz = c.z - p.z - (c.length + p.length) / 2;
    if (dz < -2 || dz > reach) continue;
    if (Math.abs(c.x - x) >= (c.width + p.width) / 2 + 0.5) continue;
    if (!best || dz < best.gap) best = { gap: Math.max(0, dz), closing: p.speed - c.speed, car: c };
  }
  return best;
}

// Is the stretch between x0 and x1 free of cars alongside (and fast ones coming up behind) right now?
function sideFree(s, x0, x1, back = 14, front = 22, except = null) {
  const p = s.player;
  const lo = Math.min(x0, x1) - 2.1, hi = Math.max(x0, x1) + 2.1;
  for (const c of s.cars) {
    if (c === except) continue;
    const dz = c.z - p.z;
    const edges = [c.x - c.width / 2, c.x + c.width / 2];
    // the target band: room ahead and behind, more for a fast car coming up behind
    const closeBehind = dz < 0 ? Math.max(0, c.speed - p.speed) * 2.2 : 0;
    const inBand = edges[1] > x1 - 2.1 && edges[0] < x1 + 2.1;
    if (inBand && dz <= front + c.length / 2 + Math.max(0, p.speed - c.speed) * 0.8 && dz >= -(back + c.length / 2 + closeBehind)) return false;
    // the way over: nobody right beside me
    if (edges[1] > lo && edges[0] < hi && Math.abs(dz) < c.length / 2 + p.length / 2 + 2 && Math.abs(c.x - x0) > 1) return false;
  }
  return true;
}

export function createBot(kind, seed = 1, tune = {}) {
  const rnd = createRng(seed * 7919 + 13);
  const st = { acc: 0, lane: null, x: null, timer: 0, ignore: 0, goHome: false };
  if (kind === 'idle') return (s) => {
    if (st.lane === null) { st.lane = s.player.laneTarget; st.x = s.player.x; }
    const inp = steer(s, st, st.lane, laneX(s.track, st.lane), 0);
    if (s.flags.pedals === 'manual' && s.player.speed < CFG.player.cruise) inp.gas = true;
    return inp;
  };
  const P = { ...PROFILES[kind], ...tune };
  return kind === 'good' ? good(P, st, rnd) : sloppy(P, st, rnd);
}

function pedals(s, inp, wantSpeed, brake) {
  const p = s.player;
  if (brake) inp.brake = true;
  else if (p.speed < wantSpeed && (s.flags.pedals === 'manual' || wantSpeed > CFG.player.cruise + 0.5 || p.speed < CFG.player.cruise)) inp.gas = true;
}

function sloppy(P, st, rnd) {
  return (s) => {
    const p = s.player;
    if (st.lane === null) { st.lane = p.laneTarget; st.timer = rnd.range(...P.think); }
    const country = s.track.road === 'country';
    if (--st.timer <= 0) {
      st.timer = rnd.range(...P.think);
      const lead = ahead(s, laneX(s.track, st.lane), 70);
      const ttc = lead && lead.closing > 0 ? lead.gap / lead.closing : Infinity;
      if (ttc < 1.6 && rnd.chance(P.notice)) {
        const opts = [st.lane - 1, st.lane + 1].filter((l) => l >= (country ? 1 : 0) && l < s.track.lanes);
        if (opts.length && rnd.chance(0.8)) {
          const l = rnd.pick(opts);
          if (rnd.chance(1 - P.wrongSide) ? sideFree(s, p.x, laneX(s.track, l)) : true) st.lane = l;
        }
        st.brakeFor = rnd.chance(P.brake) ? 30 : 0;
      }
    }
    const inp = steer(s, st, st.lane, laneX(s.track, st.lane), P.deadband);
    const braking = st.brakeFor > 0; if (braking) st.brakeFor--;
    pedals(s, inp, P.want, braking);
    return inp;
  };
}

function good(P, st, rnd) {
  return (s) => {
    const p = s.player, track = s.track, country = track.road === 'country';
    if (st.lane === null) { st.lane = p.laneTarget; st.x = p.x; }
    const lanes = track.lanes;
    const here = laneAt(track, p.x);
    if (--st.timer <= 0) {
      st.timer = P.think;
      // score every lane: the room ahead (up to 250 m), a penalty for changing, and a closed door when the side is not free
      let bestLane = st.lane, bestScore = -1e9;
      for (let l = 0; l < lanes; l++) {
        const x = laneX(track, l);
        if (country && l === 0 && !(st.lane === 0 || oncomingOk(s, p))) continue;
        const lead = ahead(s, x, 250);
        let sc = lead && lead.closing > 0.5 ? lead.gap : 250;
        if (lead && lead.closing > 0.5) sc = Math.min(250, lead.gap * (1 + Math.max(0, 6 - lead.closing) / 6));
        if (l !== st.lane) {
          sc -= P.hyst;
          if (!sideFree(s, p.x, x)) sc = -1e5;
        }
        if (country && l === 0) sc -= 60; // the oncoming lane is only for passing
        if (sc > bestScore) { bestScore = sc; bestLane = l; }
      }
      st.lane = bestLane;
    }
    // slip close past a car in the next lane for a near miss
    let tx = laneX(track, st.lane);
    if (s.flags.steer !== 'lanes' && !country && st.shave !== false && Math.abs(p.x - tx) < 1.2) {
      for (const c of s.cars) {
        const dz = c.z - p.z;
        if (c.speed >= p.speed - 3 || dz < -8 || dz > 22 + p.speed * 0.5) continue;
        const side = Math.sign(c.x - p.x);
        if (!side || Math.abs(c.x - tx) < 2.5 || Math.abs(c.x - tx) > 4.2) continue;
        if (c.id % 100 / 100 > P.shave) continue;
        const gapX = (c.width + p.width) / 2 + P.margin;
        const want = c.x - side * gapX;
        // only when nobody else is in the way of that slot
        if (Math.abs(want - tx) < 1.6 && sideFree(s, want, want, 4, 4, c) && !hasCarBetween(s, p, want, c)) { tx = want; break; }
      }
    }
    const inp = steer(s, st, st.lane, tx, 0);
    // pedals: keep a safe gap to whatever is ahead, brake when it closes faster than a comfortable stop allows
    const lead = ahead(s, p.x, 200);
    const safe = 6 + p.speed * P.safeHead;
    let brake = false, want = P.want;
    if (lead && lead.gap < 160) {
      const follow = lead.car.speed + (lead.gap - safe) * 0.5;
      want = Math.min(want, Math.max(0, follow));
      const need = lead.closing > 0 ? (lead.closing * lead.closing) / (2 * P.comfort) + 5 : 0;
      brake = lead.gap < need || (lead.gap < safe * 0.6 && lead.closing > -0.5);
    }
    if (s.flags.steer !== 'lanes' && Math.abs(p.x - tx) > 1.5) want = Math.min(want, 30);
    if (p.crashTimer > 0) want = CFG.player.cruise;
    pedals(s, inp, want, brake);
    if (!brake && p.speed > want + 1.5 && s.flags.pedals === 'manual') inp.gas = false;
    return inp;
  };
}

// A car in my way to the slot (between me and it, ahead of me), other than `c`.
function hasCarBetween(s, p, x, c) {
  return s.cars.some((o) => o !== c && o.z - p.z > -6 && o.z - p.z < 30 && Math.abs(o.x - x) < (o.width + p.width) / 2 + 0.3);
}

// Country road: is the oncoming lane clear enough to pull out and pass? Oncoming cars close at (my speed + theirs); a
// pass takes about 9 s, and the car being passed must be within reach.
function oncomingOk(s, p) {
  const need = 10;
  for (const c of s.cars) {
    if (c.cruise >= 0) continue;
    const dz = c.z - p.z;
    if (dz < -15) continue;
    if (dz / (p.speed - c.speed) < need) return false;
  }
  return true;
}
