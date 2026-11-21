// Plays one whole drive headlessly with a bot (bots.mjs) and returns the summary plus some stats (D10+). Used by
// tools/sim.mjs and tests/balance.test.js.
//   avgSpeed   mean speed in m/s
//   passedByStage  cars the player passed in each of the three stages (summary.passed)
//   carsByStage    mean number of cars within 300 m ahead, per stage (how busy the road looks)
import { createGame, step } from '../src/game.js';
import { CFG } from '../src/config.js';
import { createBot } from './bots.mjs';

export function playDrive(flags, seed, kind) {
  const s = createGame(flags, seed);
  const bot = createBot(kind, seed);
  const near = [0, 0, 0], samples = [0, 0, 0];
  let speedSum = 0, ticks = 0, guard = 60 * 400;
  while (!s.ended && guard-- > 0) {
    step(s, bot(s));
    speedSum += s.player.speed; ticks++;
    if (ticks % 30 === 0) {
      near[s.stage] += s.cars.filter((c) => c.z > s.player.z && c.z < s.player.z + 300).length;
      samples[s.stage]++;
    }
  }
  return {
    ...s.summary, avgSpeed: speedSum / Math.max(1, ticks), passedByStage: s.summary.passed,
    carsByStage: near.map((n, i) => (samples[i] ? n / samples[i] : 0)), dt: CFG.dt,
  };
}
