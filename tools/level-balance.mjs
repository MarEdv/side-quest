// Balance report for the four levels (L-4, D-27, D-28). Usage: node tools/level-balance.mjs [seedsPerLevel=200] [firstSeed=1]
// Runs every bot policy (tools/level-bot.mjs: naive, hider, sloppy) through every level and prints one table per policy.
// Pass/fail, for the naive and the hider policy: win rate must not rise and mean slack must strictly fall from one level
// to the next, and each step must lower slack by at least 0.05 of the day; L1 >= 95 % wins for both; L4 >= 30 % wins for the
// hider and >= 10 % for the naive bot. The sloppy table is informational (harmony pressure).
import { LEVELS, levelFlags } from '../src/levels.js';
import { runMany, POLICIES } from './level-bot.mjs';

const n = Number(process.argv[2]) || 200, first = Number(process.argv[3]) || 1;
const f = (x, d = 1) => x.toFixed(d);
let ok = true;
const say = (cond, msg) => { if (!cond) ok = false; console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
for (const policy of POLICIES) {
  const rows = LEVELS.map((l) => ({ level: l, r: runMany(levelFlags(l), n, first, policy) }));
  console.log(`\nPolicy ${policy}, ${n} seeds per level (seeds ${first}..${first + n - 1})`);
  console.log('| Level | Win rate | Slack s (frac) | Quests given | Failed | Avoided | Harmony losses | Final harmony | Lowest harmony |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const { level, r } of rows) {
    console.log(`| ${level.id} ${level.name} | ${f(r.winRate * 100)}% | ${f(r.slack)} (${f(r.slackFrac, 3)}) | ${f(r.given)} | ${f(r.failed, 2)} | ${f(r.avoided, 2)} | ${f(r.harmonyLosses * 100)}% | ${f(r.harmony)} | ${f(r.minHarmony)} |`);
  }
  if (policy === 'sloppy') continue;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    say(b.r.winRate <= a.r.winRate, `${policy}: win rate ${b.level.id} <= ${a.level.id}`);
    say(b.r.slackFrac <= a.r.slackFrac - 0.05, `${policy}: slack ${b.level.id} at least 0.05 of the day below ${a.level.id}`);
  }
  say(rows[0].r.winRate >= 0.95, `${policy}: L1 win rate >= 95%`);
  say(rows[rows.length - 1].r.winRate >= (policy === 'hider' ? 0.3 : 0.1), `${policy}: L4 win rate >= ${policy === 'hider' ? 30 : 10}%`);
}
process.exit(ok ? 0 : 1);
