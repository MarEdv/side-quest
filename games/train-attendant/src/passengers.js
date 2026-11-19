// Passengers (P-1..P-5, A-2, A-4): boarding, alighting, needs, stress, complaints, and the actions the attendant can do
// on them (check a ticket, answer, hand over, lead, seat). Pure; works on the game state (see game.js).
import { CFG } from './config.js';
import { emit, addScore, addPotential, byId, difficultyOf, freeSeatCount, delayMult, setCarried } from './core.js';
import { carAt, rowAt, frontCars } from './train.js';

// Given names only, one list for both languages (A-1).
export const NAMES = Object.freeze([
  'Anna', 'Omar', 'Lena', 'Mats', 'Sofia', 'Karim', 'Elsa', 'Jonas', 'Maja', 'Ravi', 'Nora', 'Pär', 'Ida', 'Tariq', 'Olle',
  'Hanna', 'Viktor', 'Amira', 'Gustav', 'Selma', 'Erik', 'Yara', 'Nils', 'Clara', 'Hugo', 'Linnea', 'Samir', 'Alva', 'Oskar', 'Mira',
]);

// ---- creating and removing

function create(s, o) {
  const p = {
    id: s.nextId++, name: s.rng.pick(NAMES), dest: o.dest, seat: null, spot: null, x: 0, following: false,
    need: null, pending: o.rescue ? null : 'ticket', nextNeed: s.rng.range(...CFG.needs.ticketDelay), seatCounted: false,
    stress: o.rescue ? CFG.quests.rescue.stress : s.rng.range(...CFG.stress.start),
    ticket: !!o.rescue, noTicket: !!o.rescue, role: o.rescue ? 'rescue' : null, complaints: 0, boarded: s.route.at,
  };
  s.passengers.push(p);
  return p;
}

export function seatPassenger(s, p, seatId) {
  p.seat = seatId; p.spot = null; p.following = false; p.x = s.train.seats[seatId].x;
  s.seatOwner[seatId] = p.id;
}

// A standing place: the least crowded one, a seeded pick between equals; `order` limits / orders the places.
function stand(s, p, order) {
  const load = new Map();
  for (const q of s.passengers) if (q.spot !== null) load.set(q.spot, (load.get(q.spot) || 0) + 1);
  const spots = order || s.train.spots;
  const min = Math.min(...spots.map((sp) => load.get(sp.id) || 0));
  const best = spots.filter((sp) => (load.get(sp.id) || 0) === min);
  const spot = order ? best[0] : s.rng.pick(best);
  p.spot = spot.id; p.x = spot.x;
}

function place(s, p, order) {
  const free = [];
  s.seatOwner.forEach((o, i) => { if (o === null) free.push(i); });
  if (!order && free.length) seatPassenger(s, p, s.rng.pick(free));
  else stand(s, p, order);
}

export function removePassenger(s, p) {
  s.passengers = s.passengers.filter((q) => q !== p);
  if (p.seat !== null) s.seatOwner[p.seat] = null;
  s.followers = s.followers.filter((id) => id !== p.id);
  if (s.hold && s.hold.pid === p.id) s.hold = null;
}

// Boards `count` passengers at station `at` (they take free seats, else stand in a vestibule).
export function board(s, count, at) {
  for (let i = 0; i < count; i++) {
    const p = create(s, { dest: s.rng.int(at + 1, s.route.last) });
    place(s, p);
    addPotential(s, CFG.points.ticket + CFG.points.calm + (p.seat === null ? CFG.points.seat : 0));
    if (p.seat === null) p.seatCounted = true;
  }
  return count;
}

// How many board at station `at`, from the difficulty and the number of seats. One attendant serves every car, so the
// share shrinks with more cars and grows with fewer: (3 / cars) ^ carScale (D39).
export function boardCount(s, at) {
  const d = difficultyOf(s);
  const share = (at === 0 ? d.first : d.board) * (3 / s.train.carCount) ** CFG.carScale;
  const [lo, hi] = CFG.boardJitter;
  return Math.max(1, Math.round(s.train.seats.length * share * s.rng.range(lo, hi)));
}

// Rescue boarding through the front vestibule: standing places from the front backwards. Returns the new passengers.
export function boardRescue(s, count, minDest) {
  const order = frontCars(s.train).flatMap((c) => s.train.spots.filter((sp) => sp.car === c.index).sort((a, b) => b.x - a.x));
  const out = [];
  for (let i = 0; i < count; i++) {
    const p = create(s, { dest: s.rng.int(minDest, s.route.last), rescue: true });
    stand(s, p, order);
    addPotential(s, CFG.points.seat + CFG.points.calm); // they can arrive calm too (D31)
    p.seatCounted = true;
    out.push(p);
  }
  return out;
}

// Everyone whose destination is station k gets off. A calm arrival scores, a missing ticket check costs the fare.
export function alight(s, k) {
  const leaving = s.passengers.filter((p) => p.dest === k);
  for (const p of leaving) {
    const calm = p.stress < CFG.stress.calmBelow;
    const lostFare = !p.ticket && !p.noTicket;
    if (calm) { addScore(s, CFG.points.calm); s.stats.calm++; }
    if (lostFare) addScore(s, CFG.points.lostFare);
    s.stats.carried++;
    emit(s, { type: 'alight', id: p.id, name: p.name, calm, lostFare });
    removePassenger(s, p);
  }
  return leaving.length;
}

// ---- needs, stress, complaints

// Seconds until a calm passenger's next need (D39). The first one after the ticket check, or after being seated (a rescued
// passenger has no ticket to check), comes soon: the difficulty's `firstNeed` range. Later ones come after its `need` range,
// scaled by the trip length.
export function needGap(s, first = false) {
  const d = difficultyOf(s);
  if (first) return s.rng.range(...d.firstNeed);
  return s.rng.range(...d.need) * (CFG.trips[s.flags.trip] || CFG.trips.normal).needScale;
}

export function clearNeed(s, p, served = null) {
  p.need = null;
  p.nextNeed = needGap(s, served === 'ticket');
}

function drawNeed(s) {
  const w = CFG.needs.weights, keys = Object.keys(w);
  let r = s.rng.next() * keys.reduce((a, k) => a + w[k], 0);
  for (const k of keys) { r -= w[k]; if (r < 0) return k; }
  return keys[keys.length - 1];
}

export function updatePassengers(s, dt) {
  const d = difficultyOf(s), ST = CFG.stress, dl = delayMult(s), free = freeSeatCount(s);
  for (const p of s.passengers) {
    const standing = p.seat === null;
    // needs
    if (!p.need) {
      if (p.pending) {
        p.nextNeed -= dt;
        if (p.nextNeed <= 0) { p.need = p.pending; p.pending = null; emit(s, { type: 'need', id: p.id, need: p.need }); }
      } else if (standing) {
        if (free > 0) {
          p.need = 'seat';
          if (!p.seatCounted) { p.seatCounted = true; addPotential(s, CFG.points.seat); }
        }
      } else if (p.role !== 'nervous') {
        p.nextNeed -= dt;
        if (p.nextNeed <= 0) {
          p.need = drawNeed(s);
          addPotential(s, CFG.points[p.need]);
          emit(s, { type: 'need', id: p.id, need: p.need });
        }
      }
    } else if (p.need === 'seat' && free === 0) p.need = null;
    // stress
    let rise = 0;
    if (p.need) rise = ST.rate[p.need] * d.stress * dl * (standing ? ST.standing : 1);
    else if (standing) rise = ST.standIdle * d.stress * dl;
    if (p.role === 'nervous') rise += CFG.quests.nervous.idleRise * CFG.quests.nervous.riseMult;
    if (rise > 0) p.stress += rise * dt;
    else if (!standing && p.role !== 'nervous') p.stress -= ST.calmDecay * dt;
  }
  if (s.flags.stress === 'contagious') spreadStress(s, dt);
  for (const p of s.passengers) {
    p.stress = Math.max(0, p.stress);
    if (p.stress >= ST.complaintAt) {
      p.stress = ST.afterComplaint; p.complaints++; s.stats.complaints++;
      addScore(s, CFG.points.complaint);
      // A coffee, snack or question the passenger complained about is given up (D39): the points are lost, no spiral of
      // complaints about the same need. A ticket or a seat stays.
      const gaveUp = CFG.needs.giveUp.includes(p.need);
      emit(s, { type: 'complaint', id: p.id, name: p.name, need: p.need, gaveUp });
      if (gaveUp) clearNeed(s, p);
    }
  }
}

// stress=contagious (P-4, D6): a passenger above the threshold stresses the others in the same car within `range` m.
function spreadStress(s, dt) {
  const C = CFG.stress.contagious;
  const hot = s.passengers.filter((p) => p.stress > C.above);
  if (!hot.length) return;
  for (const p of s.passengers) {
    let n = 0;
    for (const h of hot) if (h !== p && Math.abs(h.x - p.x) <= C.range && carAt(s.train, h.x).index === carAt(s.train, p.x).index) n++;
    if (n) p.stress += C.rate * n * dt;
  }
}

// ---- serving

function serve(s, p, need) {
  const pts = CFG.points[need];
  addScore(s, pts); s.stats.served++;
  p.stress = Math.max(0, p.stress - CFG.stress.relief);
  if (need === 'ticket') p.ticket = true;
  clearNeed(s, p, need);
  emit(s, { type: 'served', id: p.id, name: p.name, need, points: pts });
}

export function lead(s, p) {
  p.following = true; p.spot = null;
  s.followers.push(p.id);
  emit(s, { type: 'follow', id: p.id, name: p.name });
}

// Seats the first follower in the row (a free seat there). Returns true when somebody sat down.
export function seatFirstFollower(s, row) {
  const seatId = row.seats.find((id) => s.seatOwner[id] === null);
  const p = seatId === undefined ? null : byId(s, s.followers[0]);
  if (!p) return false;
  s.followers.shift();
  seatPassenger(s, p, seatId);
  p.need = null; p.nextNeed = needGap(s, true);
  p.stress = Math.max(0, p.stress - CFG.stress.seatRelief);
  addScore(s, CFG.points.seat);
  emit(s, { type: 'seated', id: p.id, name: p.name, seat: seatId, points: CFG.points.seat });
  return true;
}

// Followers trail the attendant (A-4).
export function moveFollowers(s, dt) {
  const A = CFG.attendant;
  s.followers.forEach((id, i) => {
    const p = byId(s, id);
    if (!p) return;
    const target = Math.min(s.train.length, Math.max(0, s.attendant.x - s.attendant.facing * A.followGap * (i + 1)));
    const d = target - p.x, step = A.followSpeed * dt;
    p.x = Math.abs(d) <= step ? target : p.x + Math.sign(d) * step;
  });
}

// Candidate actions on passengers near x: { key, kind: 'press' | 'hold', x, reach, dur?, prio, stress, pid, run }.
export function needActions(s, ax) {
  const out = [], A = CFG.attendant;
  for (const p of s.passengers) {
    if (Math.abs(p.x - ax) > A.reach) continue;
    const base = { x: p.x, reach: A.reach, stress: p.stress, pid: p.id };
    if (p.need === 'ticket' || p.need === 'question') {
      out.push({ ...base, key: `${p.need}:${p.id}`, kind: 'hold', dur: CFG.hold[p.need], prio: 10, run: () => serve(s, p, p.need) });
    } else if ((p.need === 'coffee' || p.need === 'snack') && s.carried === p.need) {
      out.push({ ...base, key: `give:${p.id}`, kind: 'press', prio: 12, run: () => { const n = p.need; setCarried(s, null); serve(s, p, n); } });
    } else if (p.need === 'seat' && !p.following && s.followers.length < A.maxFollowers && freeSeatCount(s) > 0) {
      out.push({ ...base, key: `lead:${p.id}`, kind: 'press', prio: 8, run: () => lead(s, p) });
    }
  }
  const row = s.followers.length ? rowAt(s.train, ax, A.rowReach) : null;
  if (row && row.seats.some((id) => s.seatOwner[id] === null)) {
    out.push({ key: `seat:${row.id}`, kind: 'press', x: row.x, reach: A.rowReach, prio: 20, stress: 0, pid: null, run: () => seatFirstFollower(s, row) });
  }
  return out;
}
