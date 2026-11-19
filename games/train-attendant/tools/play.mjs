// Plays one whole trip headlessly with a bot (bots.mjs) and measures the pace of the work (D38). Used by tools/sim.mjs
// and tests/balance.test.js.
//   pace.needsPerMin   non-ticket needs (coffee, snack, question) drawn per minute of the trip
//   pace.cafe          coffee and snack needs drawn (each is a walk to the café counter)
//   pace.firstNeed     seconds until the first non-ticket need (Infinity when there was none)
//   pace.gapMax        longest stretch with no open work after the first `warmup` seconds (the idle stretches)
//   pace.gapMean       mean length of those stretches that last at least 1 s (0 when there is none)
//   pace.idle          share of the time after the warm-up with no open work
//   pace.questPoints   points from quests (rewards of done quests plus penalties of failed ones)
// Open work: a passenger need (ticket, seat, coffee, snack, question) or an active quest that is not waiting for its stop.
import { createGame, step } from '../src/game.js';
import { CFG } from '../src/config.js';
import { createBot } from './bots.mjs';

const NON_TICKET = new Set(['coffee', 'snack', 'question']);

export function playTrip(flags, seed, kind, warmup = 20) {
  const s = createGame(flags, seed);
  const bot = createBot(kind, seed);
  const gaps = [];
  let nonTicket = 0, cafe = 0, firstNeed = Infinity, gap = 0, idleTime = 0, measured = 0, questPoints = 0, guard = 60 * 3600;
  while (!s.ended && guard-- > 0) {
    step(s, bot(s));
    for (const e of s.events) {
      if (e.type === 'questDone') questPoints += e.reward;
      if (e.type === 'questFailed') questPoints += e.penalty;
      if (e.type !== 'need' || !NON_TICKET.has(e.need)) continue;
      nonTicket++;
      if (e.need !== 'question') cafe++;
      firstNeed = Math.min(firstNeed, e.at);
    }
    if (s.ended || s.time < warmup) continue;
    const open = s.passengers.some((p) => p.need) || s.quests.active.some((q) => q.stage !== 'wait');
    measured += 1;
    if (open) { if (gap) gaps.push(gap); gap = 0; } else { gap += 1; idleTime += 1; }
  }
  if (gap) gaps.push(gap);
  const dt = CFG.dt;
  const long = gaps.filter((g) => g * dt >= 1);
  const pace = {
    needsPerMin: nonTicket / (s.time / 60), nonTicket, cafe, firstNeed,
    gapMax: gaps.length ? Math.max(...gaps) * dt : 0,
    gapMean: long.length ? (long.reduce((a, b) => a + b, 0) / long.length) * dt : 0,
    idle: measured ? idleTime / measured : 0,
    questPoints,
  };
  return { ...s.summary, pace };
}
