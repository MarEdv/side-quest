// Balance simulation (V-6): plays whole trips headlessly with the bots in bots.mjs and prints the average score, stars,
// complaints, quests and the pace of the work (tools/play.mjs) per bot, trip length and difficulty. The bots only use the
// state and the input object.
// Usage: node tools/sim.mjs [--seeds 20] [--trip short,normal,long] [--difficulty easy,normal,hard] [--bots idle,sloppy,good]
//                           [--quests offer|assign] [--stress solo|contagious] [--cars 3] [--json]
// Pace columns: need/m = non-ticket needs per minute, café = coffee + snack needs per trip, 1st = seconds to the first
// non-ticket need, gapMax / gapAvg = longest / mean stretch (>= 1 s) with no open work after the first 20 s, idle% = share
// of that time with no open work.
import { BOT_KINDS } from './bots.mjs';
import { playTrip } from './play.mjs';

const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : d; };
const list = (v) => String(v).split(',');
const seeds = Number(opt('seeds', 20));
const trips = list(opt('trip', 'short,normal,long'));
const diffs = list(opt('difficulty', 'easy,normal,hard'));
const bots = list(opt('bots', BOT_KINDS.join(',')));
const base = { quests: opt('quests', 'offer'), stress: opt('stress', 'solo'), cars: Number(opt('cars', 3)) };

export const play = (flags, seed, kind) => playTrip(flags, seed, kind);

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const f = (n, d = 1) => n.toFixed(d);
const rows = [];
for (const trip of trips) for (const difficulty of diffs) for (const kind of bots) {
  const runs = [];
  for (let seed = 1; seed <= seeds; seed++) runs.push(play({ ...base, trip, difficulty }, seed, kind));
  const stars = [1, 2, 3, 4, 5].map((n) => runs.filter((r) => r.stars === n).length);
  const pace = (k) => mean(runs.map((r) => r.pace[k]));
  rows.push({
    trip, difficulty, bot: kind, score: mean(runs.map((r) => r.score)), stars: mean(runs.map((r) => r.stars)), starDist: stars.join('/'),
    ratio: mean(runs.map((r) => r.score / r.potential)), complaints: mean(runs.map((r) => r.complaints)), carried: mean(runs.map((r) => r.carried)),
    calm: mean(runs.map((r) => r.calmShare)) * 100, done: mean(runs.map((r) => r.questsDone)), failed: mean(runs.map((r) => r.questsFailed)),
    declined: mean(runs.map((r) => r.questsDeclined)), minutes: mean(runs.map((r) => r.time)) / 60,
    cleanTrips: runs.filter((r) => r.complaints === 0).length,
    needsPerMin: pace('needsPerMin'), cafe: pace('cafe'), firstNeed: mean(runs.map((r) => Math.min(r.pace.firstNeed, r.time))),
    gapMax: pace('gapMax'), gapMean: pace('gapMean'), idle: pace('idle') * 100,
  });
}

if (args.includes('--json')) console.log(JSON.stringify(rows, null, 1));
else {
  console.log(`seeds 1..${seeds}, flags ${JSON.stringify(base)}`);
  console.log('trip    diff    bot     score  ratio  stars  dist(1-5)    complaints  clean  carried  calm%  done  failed  decl  min  need/m  café   1st  gapMax  gapAvg  idle%');
  for (const r of rows) {
    console.log([r.trip.padEnd(7), r.difficulty.padEnd(7), r.bot.padEnd(7), f(r.score, 0).padStart(6), f(r.ratio, 2).padStart(6), f(r.stars).padStart(6), r.starDist.padStart(11),
      f(r.complaints).padStart(11), `${r.cleanTrips}/${seeds}`.padStart(6), f(r.carried, 0).padStart(8), f(r.calm, 0).padStart(6), f(r.done).padStart(5), f(r.failed).padStart(7), f(r.declined).padStart(5), f(r.minutes).padStart(4),
      f(r.needsPerMin).padStart(7), f(r.cafe).padStart(5), f(r.firstNeed, 0).padStart(5), f(r.gapMax).padStart(7), f(r.gapMean).padStart(7), f(r.idle, 0).padStart(6)].join(' '));
  }
}
