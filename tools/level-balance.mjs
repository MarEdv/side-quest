// Balance report for the four levels (L-4, D-27). Usage: node tools/level-balance.mjs [seedsPerLevel=200] [firstSeed=1]
// Runs the greedy bot (tools/level-bot.mjs, never hides) through every level and prints one row per level.
// Pass/fail: win rate and mean slack must not increase from one level to the next; L1 >= 95% and L4 >= 30% wins.
import { LEVELS, levelFlags } from '../src/levels.js';
import { runMany } from './level-bot.mjs';

const n = Number(process.argv[2]) || 200, first = Number(process.argv[3]) || 1;
const rows = LEVELS.map((l) => ({ level: l, r: runMany(levelFlags(l), n, first) }));
const f = (x, d = 1) => x.toFixed(d);
console.log(`Bot (greedy, never hides), ${n} seeds per level (seeds ${first}..${first + n - 1})`);
console.log('| Level | Win rate | Slack s (frac) | Quests given | Failed | Avoided | Harmony loss | Final harmony |');
console.log('|---|---|---|---|---|---|---|---|');
for (const { level, r } of rows) {
  console.log(`| ${level.id} ${level.name} | ${f(r.winRate * 100, 1)}% | ${f(r.slack)} (${f(r.slackFrac, 3)}) | ${f(r.given)} | ${f(r.failed, 2)} | ${f(r.avoided, 2)} | ${f(r.harmonyLosses * 100, 1)}% | ${f(r.harmony)} |`);
}
let ok = true;
const say = (cond, msg) => { if (!cond) ok = false; console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); };
for (let i = 1; i < rows.length; i++) {
  say(rows[i].r.winRate <= rows[i - 1].r.winRate, `win rate ${rows[i].level.id} <= ${rows[i - 1].level.id}`);
  say(rows[i].r.slackFrac <= rows[i - 1].r.slackFrac, `slack ${rows[i].level.id} <= ${rows[i - 1].level.id}`);
}
say(rows[0].r.winRate >= 0.95, 'L1 win rate >= 95%');
say(rows[rows.length - 1].r.winRate >= 0.3, 'L4 win rate >= 30%');
process.exit(ok ? 0 : 1);
