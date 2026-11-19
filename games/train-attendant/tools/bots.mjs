// Balance bots (V-6, D14): they read the game state and return an input object each step, like a player would.
//   idle   never acts (it still gets offers; it lets them expire).
//   sloppy slow and distracted: pauses between jobs, picks jobs at random, sometimes the wrong café item, walks in fits
//          and starts, declines half of the offers and skips quest jobs half of the time.
//   good   greedy: always goes to the job with the least slack (time before the complaint or the deadline, plus the
//          walk, so near jobs win a tie), fetches the right item at the café, leads passengers to seats in batches, accepts every offer.
import { CFG } from '../src/config.js';
import { createRng } from '../src/kit/rng.js';
import { eta } from '../src/route.js';
import { delayMult, difficultyOf } from '../src/core.js';

const SPEED = CFG.attendant.speed;
const QUEST_BONUS = 15;   // seconds of urgency a quest job gets over a plain need
const PROFILES = {
  good: { think: [0, 0], accept: 1, react: [0.4, 0.8], random: 0, skip: 0, wrongItem: 0, questSkip: 0, hysteresis: 8 },
  sloppy: { think: [0.3, 1.6], accept: 0.5, react: [2, 12], random: 0.2, skip: 0.08, wrongItem: 0.1, questSkip: 0.5, hysteresis: 1000 },
};

export const BOT_KINDS = ['idle', 'sloppy', 'good'];

export function createBot(kind, seed = 1) {
  if (kind === 'idle') return () => ({});
  const P = PROFILES[kind];
  const rnd = createRng(seed * 7919 + 13);
  const decided = new Map();  // offer id -> { accept, at }
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
    let best = null, bs = Infinity;
    for (const j of list) { const v = j.slack - (target && target.key === j.key ? P.hysteresis : 0); if (v < bs) { bs = v; best = j; } }
    return best;
  }

  return function act(s) {
    const inp = {};
    const o = s.quests.offer;
    if (o) {
      let dcs = decided.get(o.id);
      if (!dcs) { dcs = { accept: rnd.chance(P.accept), at: rnd.range(...P.react) }; decided.set(o.id, dcs); }
      if (CFG.quests.offerExpire - o.expires >= dcs.at) inp[dcs.accept ? 'accept' : 'decline'] = true;
    }
    if (idle > 0) { idle -= CFG.dt; return inp; }
    const sloppy = P.hysteresis > 100;
    // a committed (sloppy) target stays until its job is gone; a good bot re-plans every step
    const live = target && jobs(s).find((j) => j.key === target.key);
    if (sloppy && target && !live) { target = null; idle = rnd.range(...P.think); return inp; }
    if (!sloppy || !target) { target = choose(s); if (target && sloppy) target = { ...target }; }
    if (!target) return inp;
    const cur = sloppy ? (live || target) : target;
    const dx = cur.x - s.attendant.x;
    if (Math.abs(dx) > 0.2) {
      if (!(P.skip && rnd.chance(P.skip))) inp[dx > 0 ? 'right' : 'left'] = true;
    } else if (cur.mode === 'hold') inp.action = true;
    else if (cur.mode === 'fetch') inp.pick = P.wrongItem && rnd.chance(P.wrongItem) ? ['coffee', 'snack', 'water'][rnd.int(0, 2)] : cur.item;
    else { flip = !flip; if (flip) { inp.action = true; inp.actionPressed = true; } }
    return inp;
  };
}
