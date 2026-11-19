// Balance bots (V-6, D14, D38): they read the game state and return an input object each step, like a player would.
//   idle   never acts (it still gets offers; it lets them expire).
//   sloppy slow and distracted: pauses between jobs, picks jobs at random, sometimes the wrong café item, walks in fits
//          and starts, declines half of the offers and skips quest jobs half of the time; otherwise it walks to the job
//          with the least slack (plus the walk) and sticks to it until it is gone. It does not watch the stations.
//   good   a skilled player who plans a few jobs ahead (D38): about six times a second it tries each order of the next
//          `depth` jobs out of the most urgent and the nearest ones and keeps the order with the fewest expected points
//          lost: complaints (when stress reaches 100; a ticket or seat again every (100 - afterComplaint) / rate s, a
//          given-up need loses its points), fares and needs lost because the passenger may get off at the next station,
//          failed quests, and a little for the time it takes. It reacts to a new job after `notice` s, sees stress (the
//          colours) but not destinations (only the public chance 1 / stations left), follows the first walk of the plan,
//          stops as soon as the job is in reach, fetches the right item, leads passengers to seats and accepts every
//          offer. `tune` overrides the profile in experiments (e.g. { knowDest: true } lets it see destinations).
import { CFG } from '../src/config.js';
import { createRng } from '../src/kit/rng.js';
import { eta, nextStation } from '../src/route.js';
import { delayMult, difficultyOf } from '../src/core.js';

const SPEED = CFG.attendant.speed;
const QUEST_BONUS = 15;   // seconds of urgency a quest job gets over a plain need (sloppy)
const PROFILES = {
  good: { accept: 1, react: [0.4, 0.8], depth: 3, pool: 4, replan: 10, notice: 0.5, keep: 6, timeCost: 3, near: 0.25 },
  sloppy: { think: [0.3, 1.6], accept: 0.5, react: [2, 12], random: 0.2, skip: 0.08, wrongItem: 0.1, questSkip: 0.5 },
};

export const BOT_KINDS = ['idle', 'sloppy', 'good'];

export function createBot(kind, seed = 1, tune = {}) {
  if (kind === 'idle') return () => ({});
  const P = { ...PROFILES[kind], ...tune };
  const rnd = createRng(seed * 7919 + 13);
  const decided = new Map();  // offer id -> { accept, at }
  const offers = (s, inp) => {
    const o = s.quests.offer;
    if (!o) return;
    let dcs = decided.get(o.id);
    if (!dcs) { dcs = { accept: rnd.chance(P.accept), at: rnd.range(...P.react) }; decided.set(o.id, dcs); }
    if (CFG.quests.offerExpire - o.expires >= dcs.at) inp[dcs.accept ? 'accept' : 'decline'] = true;
  };
  return kind === 'good' ? planner(P, offers) : sloppyBot(P, rnd, offers);
}

// Walks to x and does `act` there: 'hold', 'press' (one press edge) or a café pick (an item, or 'none' to put back).
function goDo(s, x, reach, act, near, flip) {
  const inp = {};
  const dx = x - s.attendant.x;
  if (Math.abs(dx) > Math.max(0.2, reach - near)) inp[dx > 0 ? 'right' : 'left'] = true;
  else if (act === 'hold') inp.action = true;
  else if (act === 'press') { if (flip) { inp.action = true; inp.actionPressed = true; } }
  else inp.pick = act;
  return inp;
}

// ---- the good bot

function planner(P, offers) {
  const A = CFG.attendant;
  let plan = null, wait = 0, flip = false;
  const seen = new Map(); // job key -> when the bot first saw it (it reacts `notice` s later)
  function noticed(s, list) {
    const keys = new Set(list.map((j) => j.key));
    for (const k of seen.keys()) if (!keys.has(k)) seen.delete(k);
    for (const k of keys) if (!seen.has(k)) seen.set(k, s.time);
    return list.filter((j) => s.time - seen.get(j.key) >= P.notice);
  }

  // Open jobs. A job: { key, value, lost (points lost when it disappears undone), pen (points per complaint or for failing),
  // bad (s until the first complaint / failure), every (s between later complaints; 0: once), giveUp (the complaint ends
  // the need), gone (s until it disappears), next / pLeave (s to the next station, the chance the passenger gets off there),
  // route(x, carried) -> { legs: [{ x, reach, act, dur }], carried } }.
  function jobs(s) {
    const tr = s.train, d = difficultyOf(s), dl = delayMult(s), out = [];
    const rate = (p, need) => CFG.stress.rate[need] * d.stress * dl * (p.seat === null ? CFG.stress.standing : 1);
    const after = CFG.stress.complaintAt - CFG.stress.afterComplaint;
    // Destinations are not shown: the bot knows only that a passenger aboard leaves at the next station with the chance
    // 1 / (stations left), as every destination ahead is equally likely.
    const nextK = nextStation(s.route), next = eta(s.route, nextK), pLeave = 1 / Math.max(1, s.route.last - nextK + 1);
    const leg = (x, act, dur = 0.05, reach = A.reach) => ({ x, reach, act, dur });
    const fixed = (...legs) => (_, carried) => ({ legs, carried });
    const passengerJob = (p, need, key, route, value, lost) => {
      const r = rate(p, need);
      const giveUp = (CFG.needs.giveUp || []).includes(need); // a complaint ends the need: once, and its points are gone
      const j = { key, value, lost, pen: -CFG.points.complaint, bad: (CFG.stress.complaintAt - p.stress) / r, every: giveUp ? 0 : after / r, giveUp, gone: Infinity, next, pLeave, route };
      if (P.knowDest) { j.gone = eta(s.route, p.dest); j.pLeave = 0; }
      out.push(j);
    };
    const handsFree = s.carried !== 'kit' && s.carried !== 'bag';
    for (const p of s.passengers) {
      if (p.need === 'ticket') passengerJob(p, 'ticket', `ticket:${p.id}`, fixed(leg(p.x, 'hold', CFG.hold.ticket)), CFG.points.ticket, CFG.points.ticket - CFG.points.lostFare);
      else if (p.need === 'question') passengerJob(p, 'question', `question:${p.id}`, fixed(leg(p.x, 'hold', CFG.hold.question)), CFG.points.question, CFG.points.question);
      else if ((p.need === 'coffee' || p.need === 'snack') && handsFree) {
        const item = p.need;
        passengerJob(p, item, `cafe:${p.id}`, (_, carried) => ({
          legs: carried === item ? [leg(p.x, 'press')] : [leg(tr.counterX, item), leg(p.x, 'press')], carried: null,
        }), CFG.points[item], CFG.points[item]);
      } else if (p.need === 'seat' && !p.following && s.followers.length < A.maxFollowers) {
        passengerJob(p, 'seat', `lead:${p.id}`, fixed(leg(p.x, 'press')), CFG.points.seat / 2, CFG.points.seat);
      }
    }
    if (s.followers.length) {
      let best = null;
      for (const row of tr.rows) if (row.seats.some((id) => s.seatOwner[id] === null) && (!best || Math.abs(row.x - s.attendant.x) < Math.abs(best.x - s.attendant.x))) best = row;
      const fs = s.followers.map((id) => s.passengers.find((q) => q.id === id)).filter(Boolean);
      if (best && fs.length) {
        const p = fs.reduce((a, b) => (a.stress > b.stress ? a : b));
        passengerJob(p, 'seat', 'seat', fixed(leg(best.x, 'press', 0.05, A.rowReach)), CFG.points.seat * fs.length, CFG.points.seat);
        out[out.length - 1].pen *= fs.length;
      }
    }
    const cab = tr.cab;
    for (const q of s.quests.active) {
      const p = q.pid ? s.passengers.find((x) => x.id === q.pid) : null;
      const fail = q.reward - q.penalty;
      const quest = (key, value, bad, route) => out.push({ key, value, lost: fail, pen: fail, bad, every: 0, gone: Infinity, next: Infinity, pLeave: 0, route, quest: true });
      const dl2 = q.deadlineStation !== undefined ? eta(s.route, q.deadlineStation) - 0.5 : Infinity;
      const putBack = (carried) => (carried && carried !== 'kit' && carried !== 'bag' ? [leg(tr.counterX, 'none')] : []);
      if (q.type === 'connection' && q.stage === 'radio' && p) quest(`radio:${q.id}`, q.reward, dl2, fixed(leg(cab.x, 'hold', CFG.hold.radio, cab.reach), leg(p.x, 'press')));
      if (q.type === 'connection' && q.stage === 'tell' && p) quest(`tell:${q.id}`, q.reward, dl2, fixed(leg(p.x, 'press')));
      if (q.type === 'nervous' && p && s.time >= q.nextTalk) {
        const bad = Math.min(dl2, (CFG.stress.complaintAt - p.stress) / (CFG.quests.nervous.idleRise * CFG.quests.nervous.riseMult));
        quest(`talk:${q.id}`, q.reward / CFG.quests.nervous.talks, bad, fixed(leg(p.x, 'hold', CFG.hold.talk)));
      }
      if (q.type === 'lost' && q.stage === 'find' && p) quest(`bag:${q.id}`, q.reward, dl2, (_, c) => ({ legs: [...putBack(c), leg(q.bag.x, 'press'), leg(p.x, 'press')], carried: null }));
      if (q.type === 'lost' && q.stage === 'give' && p) quest(`bagback:${q.id}`, q.reward, dl2, fixed(leg(p.x, 'press')));
      if (q.type === 'sick' && q.stage === 'fetch' && p) quest(`kit:${q.id}`, q.reward, q.remaining, (_, c) => ({ legs: [...putBack(c), leg(cab.x, 'press', 0.05, cab.reach), leg(p.x, 'press')], carried: null }));
      if (q.type === 'sick' && q.stage === 'deliver' && p) quest(`kitgive:${q.id}`, q.reward, q.remaining, fixed(leg(p.x, 'press')));
    }
    return out;
  }

  const walkTime = (from, l) => Math.max(0, Math.abs(l.x - from) - Math.max(0, l.reach - P.near)) / SPEED;
  const stopX = (from, l) => { const m = Math.max(0, l.reach - P.near); return Math.abs(l.x - from) <= m ? from : l.x - Math.sign(l.x - from) * m; };
  // Points lost by a job finished at time t (Infinity: not done within the plan, judged at the plan's end `end`).
  function loss(j, t, end) {
    const at = t === Infinity ? end : t;
    let lost = 0;
    if (at > j.bad) lost += j.pen * (j.every ? 1 + Math.floor((at - j.bad) / j.every) : 1);
    const late = j.pLeave && at > j.next ? j.pLeave : 0; // the chance the passenger is gone by then
    if (t === Infinity) { if (j.gone < end) lost += j.lost; else lost += late * j.lost; if (j.giveUp && at > j.bad) lost += j.value; }
    else lost += late * j.lost - (1 - late) * j.value;
    return lost;
  }

  function best(s, list, current) {
    const ax = s.attendant.x;
    const pick = new Set();
    const byBad = [...list].sort((a, b) => Math.min(a.bad, a.gone) - Math.min(b.bad, b.gone));
    const byNear = [...list].sort((a, b) => Math.abs(a.route(ax, s.carried).legs[0].x - ax) - Math.abs(b.route(ax, s.carried).legs[0].x - ax));
    for (const j of byBad.slice(0, P.pool)) pick.add(j);
    for (const j of byNear.slice(0, P.pool)) pick.add(j);
    if (current) { const c = list.find((j) => j.key === current); if (c) pick.add(c); }
    const cand = [...pick];
    const depth = Math.min(P.depth, cand.length);
    let bestCost = Infinity, bestSeq = null;
    const used = new Array(cand.length).fill(false), seq = [], done = new Map();
    const leaf = (t, costSoFar) => {
      let c = costSoFar + P.timeCost * t;
      for (const j of list) if (!done.has(j)) c += loss(j, Infinity, t);
      if (current && seq[0].key === current) c -= P.keep;
      if (c < bestCost) { bestCost = c; bestSeq = [...seq]; }
    };
    const walk = (x, t, carried, costSoFar) => {
      if (seq.length === depth) { leaf(t, costSoFar); return; }
      let ext = false;
      for (let i = 0; i < cand.length; i++) {
        if (used[i]) continue;
        const j = cand[i];
        const r = j.route(x, carried);
        let t2 = t, x2 = x;
        for (const l of r.legs) { t2 += walkTime(x2, l) + l.dur; x2 = stopX(x2, l); }
        if (t2 > j.gone || (j.giveUp && t2 > j.bad)) continue; // gone, or given up, before the bot gets there
        ext = true;
        used[i] = true; seq.push(j); done.set(j, t2);
        walk(x2, t2, r.carried, costSoFar + loss(j, t2, t2));
        used[i] = false; seq.pop(); done.delete(j);
      }
      if (!ext && seq.length) leaf(t, costSoFar);
    };
    walk(ax, 0, s.carried, 0);
    return bestSeq ? bestSeq[0] : null;
  }

  return function act(s) {
    const inp = {};
    offers(s, inp);
    const holding = s.hold && plan && s.hold.key.startsWith(plan.key.split(':')[0]);
    if (!holding && (--wait <= 0 || !plan)) {
      wait = P.replan;
      const list = noticed(s, jobs(s));
      const j = list.length ? best(s, list, plan && plan.key) : null;
      plan = j ? { key: j.key } : null;
    }
    if (!plan) return inp;
    const j = jobs(s).find((x) => x.key === plan.key);
    if (!j) { plan = null; wait = 0; return inp; }
    const l = j.route(s.attendant.x, s.carried).legs[0];
    flip = !flip;
    return { ...inp, ...goDo(s, l.x, l.reach, l.act, P.near, flip) };
  };
}

// ---- the sloppy bot (D14)

function sloppyBot(P, rnd, offers) {
  let target = null, idle = 0, flip = false;

  function jobs(s) {
    const ax = s.attendant.x, tr = s.train, d = difficultyOf(s), dl = delayMult(s), out = [];
    const walk = (x) => Math.abs(ax - x) / SPEED;
    const tl = (p, need) => (100 - p.stress) / (CFG.stress.rate[need] * d.stress * dl * (p.seat === null ? CFG.stress.standing : 1));
    const noItem = s.carried !== 'kit' && s.carried !== 'bag';
    const standingNeed = s.passengers.filter((p) => p.need === 'seat' && !p.following);
    for (const p of s.passengers) {
      if (p.need === 'ticket' || p.need === 'question') {
        out.push({ key: `${p.need}:${p.id}`, x: p.x, mode: 'hold', slack: tl(p, p.need) + walk(p.x) - CFG.hold[p.need] });
      } else if ((p.need === 'coffee' || p.need === 'snack') && noItem) {
        if (s.carried === p.need) out.push({ key: `give:${p.id}`, x: p.x, mode: 'press', slack: tl(p, p.need) + walk(p.x) });
        else out.push({ key: `fetch:${p.need}:${p.id}`, x: tr.counterX, mode: 'fetch', item: p.need, slack: tl(p, p.need) + walk(tr.counterX) + Math.abs(tr.counterX - p.x) / SPEED - 0.4 });
      } else if (p.need === 'seat' && !p.following && s.followers.length < CFG.attendant.maxFollowers) {
        out.push({ key: `lead:${p.id}`, x: p.x, mode: 'press', slack: tl(p, 'seat') + walk(p.x) - (s.followers.length ? 8 : 0) });
      }
    }
    if (s.followers.length) {
      let best = null;
      for (const row of tr.rows) if (row.seats.some((id) => s.seatOwner[id] === null) && (!best || Math.abs(row.x - ax) < Math.abs(best.x - ax))) best = row;
      if (best) {
        const worst = Math.min(...s.followers.map((id) => { const p = s.passengers.find((q) => q.id === id); return p ? tl(p, 'seat') : 99; }));
        const collecting = s.followers.length < CFG.attendant.maxFollowers && standingNeed.some((p) => Math.abs(p.x - ax) < 7);
        out.push({ key: 'seat', x: best.x, mode: 'press', slack: worst + walk(best.x) + (collecting ? 8 : -2) });
      }
    }
    for (const q of s.quests.active) {
      const p = q.pid ? s.passengers.find((x) => x.id === q.pid) : null;
      const ex = { quest: true };
      if (q.type === 'connection' && q.stage === 'radio') out.push({ ...ex, key: 'radio', x: tr.cab.x, mode: 'hold', slack: eta(s.route, q.deadlineStation) + walk(tr.cab.x) - 15 - QUEST_BONUS });
      if (q.type === 'connection' && q.stage === 'tell' && p) out.push({ ...ex, key: 'tell', x: p.x, mode: 'press', slack: eta(s.route, q.deadlineStation) + walk(p.x) - 10 - QUEST_BONUS });
      if (q.type === 'nervous' && p && s.time >= q.nextTalk) out.push({ ...ex, key: `talk:${q.id}`, x: p.x, mode: 'hold', slack: (100 - p.stress) / 0.9 + walk(p.x) - 6 - QUEST_BONUS });
      if (q.type === 'lost' && q.stage === 'find') out.push({ ...ex, key: 'bag', x: q.bag.x, mode: 'press', slack: eta(s.route, q.deadlineStation) + walk(q.bag.x) - 25 - QUEST_BONUS });
      if (q.type === 'lost' && q.stage === 'give' && p) out.push({ ...ex, key: 'bagback', x: p.x, mode: 'press', slack: eta(s.route, q.deadlineStation) + walk(p.x) - 5 - QUEST_BONUS });
      if (q.type === 'sick' && q.stage === 'fetch' && p) out.push({ ...ex, key: 'kit', x: tr.cab.x, mode: 'press', slack: q.remaining + walk(tr.cab.x) + Math.abs(tr.cab.x - p.x) / SPEED - 4 - QUEST_BONUS });
      if (q.type === 'sick' && q.stage === 'deliver' && p) out.push({ ...ex, key: 'kitgive', x: p.x, mode: 'press', slack: q.remaining + walk(p.x) - 2 - QUEST_BONUS });
    }
    return out;
  }

  function choose(s) {
    let list = jobs(s);
    if (P.questSkip) list = list.filter((j) => !j.quest || !rnd.chance(P.questSkip));
    if (!list.length) return null;
    if (P.random && rnd.chance(P.random)) return list[rnd.int(0, list.length - 1)];
    let best = null;
    for (const j of list) if (!best || j.slack < best.slack) best = j;
    return best;
  }

  return function act(s) {
    const inp = {};
    offers(s, inp);
    if (idle > 0) { idle -= CFG.dt; return inp; }
    // the target stays until its job is gone, then a short pause
    const live = target && jobs(s).find((j) => j.key === target.key);
    if (target && !live) { target = null; idle = rnd.range(...P.think); return inp; }
    if (!target) target = choose(s);
    if (!target) return inp;
    const cur = live || target;
    const dx = cur.x - s.attendant.x;
    if (Math.abs(dx) > 0.2) {
      if (!(P.skip && rnd.chance(P.skip))) inp[dx > 0 ? 'right' : 'left'] = true;
    } else if (cur.mode === 'hold') inp.action = true;
    else if (cur.mode === 'fetch') inp.pick = P.wrongItem && rnd.chance(P.wrongItem) ? ['coffee', 'snack', 'water'][rnd.int(0, 2)] : cur.item;
    else { flip = !flip; if (flip) { inp.action = true; inp.actionPressed = true; } }
    return inp;
  };
}
