// Game state & fixed-step update. Pure (no DOM).
//
// Input: {up,down,left,right,action,pause,start,restart} booleans = current key state (level).
// pause/start/restart are EDGE-triggered here: game.js remembers the previous value in state.prev,
// so input.js just reports "is the key down".
import { createRng } from './rng.js';
import { createWorld } from './world.js';
import { moveWithCollision } from './geometry.js';
import { createChores, findChoreInRange, workOnChore, choresDoneCount, allChoresDone } from './chores.js';
import { HARMONY, giveQuest, tryQuestInteraction, updateQuests } from './quests.js';
import { createWife, updateWife, sayBubble } from './wife.js';
import { DEFAULT_FLAGS } from './config.js';

export const PLAYER_SPEED = 150;
export const PLAYER_HALF = 8;

export const END_MESSAGES = {
  win: 'The garden is spotless. Dinner is served!',
  harmony: 'Sleeping on the couch tonight.',
  sunset: 'The sun set on a half-finished garden.',
};

export function createGame(flags = DEFAULT_FLAGS, phase = 'title') {
  const seed = flags.seed === 'random' ? Math.floor(Math.random() * 2 ** 31) : flags.seed;
  const rng = createRng(seed);
  const world = createWorld();
  return {
    flags, seed, phase, time: 0, dayLength: flags.dayLength,
    rng, world,
    player: { x: world.playerStart.x, y: world.playerStart.y, facing: 1, moving: false, working: false },
    chores: createChores(flags),
    quests: [], carry: null, nextQuestId: 1,
    wife: createWife(world, rng, flags),
    harmony: HARMONY.start,
    stats: { questsCompleted: 0, questsFailed: 0, questsAvoided: 0 },
    endReason: null, score: 0,
    events: [],
    prev: { pause: false, start: false, restart: false },
  };
}

export function computeScore(s) {
  const won = s.phase === 'won';
  return Math.round(
    100 * choresDoneCount(s.chores) + 50 * s.stats.questsCompleted + 25 * s.stats.questsAvoided
    - 40 * s.stats.questsFailed + s.harmony + (won ? 500 : 0));
}

export const clockMinutes = (s) => 9 * 60 + Math.min(1, s.time / s.dayLength) * 9 * 60;

function endGame(s, phase, reason) {
  s.phase = phase;
  s.endReason = reason;
  s.score = computeScore(s);
  s.events.push({ type: phase === 'won' ? 'won' : 'lost', reason });
}

function handleWife(s, dt) {
  const evs = updateWife(s.wife, { player: s.player, obstacles: s.world.obstacles, rng: s.rng, flags: s.flags }, dt);
  for (const e of evs) {
    if (e === 'warning') s.events.push({ type: 'warning' });
    else if (e === 'out') s.events.push({ type: 'wifeOut' });
    else if (e === 'left') s.events.push({ type: 'wifeLeft' });
    else if (e === 'avoided') { s.stats.questsAvoided++; s.events.push({ type: 'avoided' }); }
    else if (e === 'spotted' || e === 'callout') {
      if (e === 'spotted') s.events.push({ type: 'spotted' });
      const q = giveQuest(s);
      sayBubble(s.wife, q ? q.say : 'Oh, you look busy. Carry on!', 4);
    }
  }
}

function step(s, input, dt) {
  s.time += dt;
  const p = s.player;

  // Movement
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  p.moving = dx !== 0 || dy !== 0;
  if (p.moving) {
    const len = Math.hypot(dx, dy);
    if (dx !== 0) p.facing = dx > 0 ? 1 : -1;
    moveWithCollision(p, (dx / len) * PLAYER_SPEED * dt, (dy / len) * PLAYER_SPEED * dt, PLAYER_HALF, s.world.obstacles, { w: s.world.width, h: s.world.height });
  }

  // Wife
  handleWife(s, dt);

  // Interaction: quest spots take priority over chores.
  p.working = false;
  if (input.action) {
    if (!tryQuestInteraction(s)) {
      const c = findChoreInRange(s.chores, p.x, p.y);
      if (c) {
        p.working = true;
        if (workOnChore(c, dt)) s.events.push({ type: 'choreDone', choreId: c.id, choreType: c.type });
      }
    }
  }

  updateQuests(s, dt);

  if (allChoresDone(s.chores)) endGame(s, 'won', 'win');
  else if (s.harmony <= 0) endGame(s, 'lost', 'harmony');
  else if (s.time >= s.dayLength) endGame(s, 'lost', 'sunset');
}

export function resetGame(s) {
  const fresh = createGame(s.flags, 'playing');
  // Keep the same seed unless it was random (then createGame already rolled a new one).
  for (const k of Object.keys(s)) delete s[k];
  Object.assign(s, fresh);
}

export function update(s, input, dt) {
  const edge = {
    pause: !!input.pause && !s.prev.pause,
    start: !!input.start && !s.prev.start,
    restart: !!input.restart && !s.prev.restart,
  };
  s.prev.pause = !!input.pause; s.prev.start = !!input.start; s.prev.restart = !!input.restart;

  switch (s.phase) {
    case 'title':
      if (edge.start) s.phase = 'playing';
      break;
    case 'playing':
      if (edge.pause) { s.phase = 'paused'; break; }
      step(s, input, dt);
      break;
    case 'paused':
      if (edge.pause || edge.start) s.phase = 'playing';
      break;
    case 'won':
    case 'lost':
      if (edge.restart) {
        const prev = { ...s.prev };
        resetGame(s);
        s.prev = prev;
      }
      break;
  }
}

export { choresDoneCount };
