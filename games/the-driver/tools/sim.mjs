// Balance simulation (V-7): plays whole drives headlessly with the bots in bots.mjs and prints the average score, stars,
// crashes, near misses and the cars passed per stage, per bot, road and difficulty.
// Usage: node tools/sim.mjs [--seeds 10] [--road highway,country] [--difficulty easy,normal,hard] [--bots idle,sloppy,good]
//                           [--length normal|short] [--steer free] [--pedals auto] [--crash soft] [--json]
// Columns: dist = km, avg = mean speed km/h, nm = near misses, pass = cars passed in stage 1/2/3, near = mean cars within
// 300 m ahead in stage 1/2/3, stars dist = how many drives got 1/2/3/4/5 stars.
import { BOT_KINDS } from './bots.mjs';
import { playDrive } from './play.mjs';

const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : d; };
const list = (v) => String(v).split(',');
const seeds = Number(opt('seeds', 10));
const roads = list(opt('road', 'highway,country'));
const diffs = list(opt('difficulty', 'easy,normal,hard'));
const bots = list(opt('bots', BOT_KINDS.join(',')));
const base = { length: opt('length', 'normal'), steer: opt('steer', 'free'), pedals: opt('pedals', 'auto'), crash: opt('crash', 'soft') };

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const f = (n, d = 1) => n.toFixed(d);
const rows = [];
for (const road of roads) for (const difficulty of diffs) for (const kind of bots) {
  const runs = [];
  for (let seed = 1; seed <= seeds; seed++) runs.push(playDrive({ ...base, road, difficulty }, seed, kind));
  rows.push({
    road, difficulty, bot: kind, score: mean(runs.map((r) => r.score)), stars: mean(runs.map((r) => r.stars)),
    starDist: [1, 2, 3, 4, 5].map((n) => runs.filter((r) => r.stars === n).length).join('/'),
    crashes: mean(runs.map((r) => r.crashes)), nearMisses: mean(runs.map((r) => r.nearMisses)), km: mean(runs.map((r) => r.distance)) / 1000,
    avgKmh: mean(runs.map((r) => r.avgSpeed)) * 3.6, passed: [0, 1, 2].map((i) => mean(runs.map((r) => r.passedByStage[i]))),
    near: [0, 1, 2].map((i) => mean(runs.map((r) => r.carsByStage[i]))), wrecked: runs.filter((r) => r.endReason === 'wrecked').length,
  });
}

if (args.includes('--json')) console.log(JSON.stringify(rows, null, 1));
else {
  console.log(`seeds 1..${seeds}, flags ${JSON.stringify(base)}`);
  console.log('road     diff    bot     score  stars  dist(1-5)    crashes    nm   km   avg    pass 1/2/3      near 1/2/3     wrecked');
  for (const r of rows) {
    console.log([r.road.padEnd(8), r.difficulty.padEnd(7), r.bot.padEnd(7), f(r.score, 0).padStart(6), f(r.stars).padStart(6), r.starDist.padStart(11),
      f(r.crashes).padStart(10), f(r.nearMisses).padStart(5), f(r.km).padStart(4), f(r.avgKmh, 0).padStart(5),
      r.passed.map((n) => f(n, 0).padStart(4)).join(' ').padStart(16), r.near.map((n) => f(n).padStart(4)).join(' ').padStart(16), String(r.wrecked).padStart(8)].join(' '));
  }
}
