// Side quests (Q-1..Q-7, D5): the manager's offers, the five quest types, their progress, deadlines and rewards. Pure.
// state.quests = { timer, offer, active: [quest], nextId }. A quest is plain data:
//   { id, type, vars, stage, goal (text key), reward, penalty, pid, pids, deadlineStation, remaining, ... }
// Texts: t(questKey(type, 'offer' | 'done' | 'failed' | 'title'), vars); the goal line is t(quest.goal, quest.vars).
import { CFG, QUEST_TYPES } from './config.js';
import { emit, addScore, addPotential, byId, freeSeatCount, setCarried, setStage } from './core.js';
import { eta, planStop, legProgress } from './route.js';
import { boardRescue } from './passengers.js';
import { carAt } from './train.js';

const Q = CFG.quests;
export const questKey = (type, kind) => `q_${type}_${kind}`;

export function createQuestState(rng) {
  return { timer: rng.range(...Q.offerEvery), offer: null, active: [], nextId: 1 };
}

// A seeded pick from a list; an empty list draws nothing.
const choose = (s, list) => (list.length ? s.rng.pick(list) : null);
const reschedule = (s) => { s.quests.timer = s.rng.range(...Q.offerEvery); };

// ---- offers

// The leg (the station it leaves) on which a rescue accepted now would stop the train; null when there is none.
function rescueLeg(s) {
  const r = s.route;
  const leg = r.phase === 'dwell' ? r.at : legProgress(r) < Q.rescue.thisLegBefore && r.phase === 'leg' ? r.at : r.at + 1;
  return leg <= r.last - 1 ? leg : null;
}

// Passengers who can be given a named quest: riding, no role, getting off at least `minEta` seconds from now.
function candidates(s, minEta, range) {
  return s.passengers.filter((p) => !p.role && !p.following && p.seat !== null
    && eta(s.route, p.dest) >= minEta && (!range || (p.dest - s.route.at >= range[0] && p.dest - s.route.at <= range[1])));
}

const MAKE = {
  rescue(s) {
    if (s.quests.active.some((q) => q.type === 'rescue') || s.route.stop) return null;
    const leg = rescueLeg(s);
    const n = s.rng.int(...Q.rescue.count);
    if (leg === null || freeSeatCount(s) < n + Q.rescue.spareSeats) return null;
    return { vars: { n, station: s.route.stations[leg + 1] }, reward: Q.rescue.reward, penalty: Q.rescue.penalty };
  },
  connection(s) {
    const p = choose(s, candidates(s, Q.connection.minEta, Q.connection.ahead));
    if (!p) return null;
    return { vars: { name: p.name, station: s.route.stations[p.dest], platform: s.rng.int(1, 9) }, pid: p.id, reward: Q.connection.reward, penalty: Q.connection.penalty };
  },
  nervous(s) {
    const p = choose(s, candidates(s, Q.nervous.minEta));
    if (!p) return null;
    return { vars: { name: p.name, done: 0, n: Q.nervous.talks }, pid: p.id, reward: Q.nervous.reward, penalty: Q.nervous.penalty };
  },
  lost(s) {
    const p = choose(s, candidates(s, Q.lost.minEta));
    if (!p) return null;
    const cars = s.train.cars.filter((c) => c.kind === 'car');
    const car = s.rng.pick(cars);
    const bag = { x: Math.round(s.rng.range(car.start + 3, car.end - 3) * 10) / 10, car: car.index };
    return { vars: { name: p.name, car: car.number }, pid: p.id, bag, reward: Q.lost.reward, penalty: Q.lost.penalty };
  },
  sick(s) {
    const p = choose(s, candidates(s, Q.sick.minEta));
    if (!p) return null;
    return { vars: { name: p.name }, pid: p.id, reward: Q.sick.reward, penalty: Q.sick.penalty };
  },
};

// Picks a type by weight (without repeats) until one of them can be made.
function makeOffer(s) {
  const left = [...QUEST_TYPES];
  while (left.length) {
    const total = left.reduce((a, k) => a + Q.weights[k], 0);
    let r = s.rng.next() * total, i = 0;
    for (; i < left.length - 1; i++) { r -= Q.weights[left[i]]; if (r < 0) break; }
    const type = left.splice(i, 1)[0];
    const made = MAKE[type](s);
    if (made) return { id: s.quests.nextId++, type, expires: Q.offerExpire, ...made };
  }
  return null;
}

// ---- accepting, declining, finishing

export function acceptOffer(s) {
  const o = s.quests.offer;
  if (!o || s.quests.active.length >= Q.maxActive) return false;
  s.quests.offer = null;
  reschedule(s);
  const q = { ...o, expires: undefined, accepted: s.time };
  delete q.expires;
  const p = q.pid ? byId(s, q.pid) : null;
  if (q.pid && !p) return cancel(s, q);
  if (q.type === 'rescue') {
    const leg = rescueLeg(s);
    if (leg === null || s.route.stop) return cancel(s, q);
    planStop(s.route, leg);
    q.deadlineStation = leg + 1; q.pids = []; q.vars = { ...q.vars, station: s.route.stations[leg + 1] };
    setStage(q, 'wait');
  } else if (q.type === 'connection') {
    q.deadlineStation = p.dest; p.role = 'connection'; setStage(q, 'radio');
  } else if (q.type === 'nervous') {
    q.deadlineStation = p.dest; p.role = 'nervous'; p.need = null; p.stress = Math.max(p.stress, Q.nervous.stress);
    q.talks = 0; q.nextTalk = 0; q.c0 = p.complaints; setStage(q, 'talk');
  } else if (q.type === 'lost') {
    q.deadlineStation = p.dest; p.role = 'lost'; setStage(q, 'find');
  } else if (q.type === 'sick') {
    p.role = 'sick'; p.stress = Math.min(99, p.stress + Q.sick.stress); q.remaining = Q.sick.limit; setStage(q, 'fetch');
  }
  s.quests.active.push(q);
  emit(s, { type: 'questAccepted', id: q.id, qtype: q.type });
  return true;
}

export function declineOffer(s) {
  const o = s.quests.offer;
  if (!o) return false;
  s.quests.offer = null; s.stats.questsDeclined++;
  reschedule(s);
  emit(s, { type: 'questDeclined', id: o.id, qtype: o.type });
  return true;
}

function cancel(s, q) {
  emit(s, { type: 'questCancelled', id: q.id, qtype: q.type });
  return false;
}

function drop(s, q) {
  s.quests.active = s.quests.active.filter((x) => x !== q);
  for (const id of [q.pid, ...(q.pids || [])]) { const p = id && byId(s, id); if (p) p.role = null; }
}

function complete(s, q, opts = {}) {
  const reward = Math.round(q.reward * (opts.rebooked ? Q.connection.rebookedShare : 1));
  addScore(s, reward); s.stats.questsDone++;
  for (const id of [q.pid, ...(q.pids || [])]) {
    const p = id && byId(s, id);
    if (p) p.stress = Math.max(0, p.stress - Q.calmInvolved);
  }
  drop(s, q);
  emit(s, { type: 'questDone', id: q.id, qtype: q.type, reward, rebooked: !!opts.rebooked, kind: opts.rebooked ? 'rebooked' : 'done' });
}

function fail(s, q, reason) {
  addScore(s, q.penalty); s.stats.questsFailed++;
  drop(s, q);
  emit(s, { type: 'questFailed', id: q.id, qtype: q.type, reason, penalty: q.penalty });
}

// The quest's text key for a result: 'done' ('rebooked' for a connection that left), 'failed', 'offer', 'title'.
export const doneKey = (type, kind) => questKey(type, kind === 'rebooked' ? 'rebooked' : 'done');

// ---- the clock

// Called when the train arrives at station k, before anybody gets off.
export function onArrive(s, k) {
  for (const q of [...s.quests.active]) if (q.deadlineStation === k) fail(s, q, q.type === 'rescue' ? 'late' : 'station');
}

// Called when the rescue stop begins: the stranded passengers board through the front vestibule.
export function onStopStart(s) {
  const q = s.quests.active.find((x) => x.type === 'rescue' && x.stage === 'wait');
  if (!q) return;
  const n = Math.min(q.vars.n, freeSeatCount(s));
  if (n < 1) { s.quests.active = s.quests.active.filter((x) => x !== q); cancel(s, q); return; }
  q.vars = { ...q.vars, n };
  q.pids = boardRescue(s, n, q.deadlineStation).map((p) => p.id);
  setStage(q, 'seat');
  emit(s, { type: 'board', n, rescue: true, station: s.route.at });
}

export function stepQuests(s, dt) {
  const Qs = s.quests;
  if (Qs.offer) {
    Qs.offer.expires -= dt;
    if (Qs.offer.expires <= 0) {
      emit(s, { type: 'offerExpired', id: Qs.offer.id, qtype: Qs.offer.type });
      Qs.offer = null; s.stats.questsDeclined++; reschedule(s);
    }
  } else if (s.route.phase === 'leg') {
    Qs.timer -= dt; // offers come "of travel": only while the train is moving
    if (Qs.timer <= 0 && Qs.active.length < Q.maxActive) {
      const o = makeOffer(s);
      if (!o) Qs.timer = Q.retryAfter;
      else {
        Qs.offer = o; addPotential(s, o.reward);
        emit(s, { type: 'offer', id: o.id, qtype: o.type });
        if (s.flags.quests === 'assign') acceptOffer(s);
      }
    }
  }
  for (const q of [...Qs.active]) {
    const p = q.pid ? byId(s, q.pid) : null;
    if (q.pid && !p) { fail(s, q, 'left'); continue; }
    if (q.type === 'rescue' && q.stage === 'seat') {
      const all = q.pids.map((id) => byId(s, id));
      if (all.every((x) => x && x.seat !== null)) complete(s, q);
    } else if (q.type === 'nervous') {
      q.vars.done = q.talks;
      if (p.complaints > q.c0) fail(s, q, 'complaint');
    } else if (q.type === 'sick') {
      q.remaining -= dt;
      if (q.remaining <= 0) fail(s, q, 'late');
    }
  }
}

// ---- the attendant's actions for quests

function progress(s, q) { emit(s, { type: 'questProgress', id: q.id, qtype: q.type, stage: q.stage }); }

// Candidate actions, in the shape passengers.js gives (see game.js).
export function questActions(s, ax) {
  const out = [], A = CFG.attendant, cab = s.train.cab;
  for (const q of s.quests.active) {
    const p = q.pid ? byId(s, q.pid) : null;
    if (q.type === 'connection' && q.stage === 'radio') {
      out.push({ key: `radio:${q.id}`, kind: 'hold', x: cab.x, reach: cab.reach, dur: CFG.hold.radio, prio: 40, stress: 0, pid: null,
        run: () => {
          emit(s, { type: 'radio', id: q.id });
          if (s.route.delay > Q.connection.holdLimit) complete(s, q, { rebooked: true });
          else { setStage(q, 'tell'); progress(s, q); }
        } });
    } else if (q.type === 'connection' && q.stage === 'tell' && p) {
      out.push({ key: `tell:${q.id}`, kind: 'press', x: p.x, reach: A.reach, prio: 40, stress: 0, pid: p.id, run: () => complete(s, q) });
    } else if (q.type === 'nervous' && p) {
      const talk = () => {
        q.talks++; q.nextTalk = s.time + Q.nervous.gap; q.vars.done = q.talks;
        p.stress = Math.max(0, p.stress - Q.nervous.talkRelief);
        progress(s, q);
        if (q.talks >= Q.nervous.talks) complete(s, q);
      };
      if (s.time >= q.nextTalk) out.push({ key: `talk:${q.id}`, kind: 'hold', x: p.x, reach: A.reach, dur: CFG.hold.talk, prio: 40, stress: p.stress, pid: p.id, run: talk });
      if (s.time >= q.nextTalk && s.carried === 'water') out.push({ key: `water:${q.id}`, kind: 'press', x: p.x, reach: A.reach, prio: 45, stress: p.stress, pid: p.id, run: () => { setCarried(s, null); talk(); } });
    } else if (q.type === 'lost' && q.stage === 'find' && carAt(s.train, ax).index === q.bag.car) {
      out.push({ key: `bag:${q.id}`, kind: 'press', x: q.bag.x, reach: A.reach, prio: 40, stress: 0, pid: null,
        run: () => { setCarried(s, 'bag'); setStage(q, 'give'); emit(s, { type: 'pickup', item: 'bag' }); progress(s, q); } });
    } else if (q.type === 'lost' && q.stage === 'give' && s.carried === 'bag' && p) {
      out.push({ key: `bagback:${q.id}`, kind: 'press', x: p.x, reach: A.reach, prio: 40, stress: 0, pid: p.id, run: () => { setCarried(s, null); complete(s, q); } });
    } else if (q.type === 'sick' && q.stage === 'fetch') {
      out.push({ key: `kit:${q.id}`, kind: 'press', x: cab.x, reach: cab.reach, prio: 40, stress: 0, pid: null,
        run: () => { setCarried(s, 'kit'); setStage(q, 'deliver'); emit(s, { type: 'pickup', item: 'kit' }); progress(s, q); } });
    } else if (q.type === 'sick' && q.stage === 'deliver' && s.carried === 'kit' && p) {
      out.push({ key: `kitgive:${q.id}`, kind: 'press', x: p.x, reach: A.reach, prio: 40, stress: 0, pid: p.id, run: () => { setCarried(s, null); complete(s, q); } });
    }
  }
  return out;
}
