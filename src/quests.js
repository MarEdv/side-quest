// Side quests: fetch/deliver errands. Pure; operates on the game state object.
import { dist } from './geometry.js';
import { INTERACT_RANGE } from './chores.js';

export const HARMONY = { start: 60, onComplete: 15, onFail: -20, decayPerHour: 1, max: 100 };
export const DOOR = { x: 480, y: 118, label: 'Wife at the door' };
export const CURB = { x: 520, y: 520, label: 'The curb' };

export const QUEST_TEMPLATES = [
  { id: 'groceries', title: 'Groceries', say: 'Honey, can you grab the groceries from the car?', time: 45,
    pickup: { x: 780, y: 455, label: 'Car' }, drop: DOOR },
  { id: 'glasses', title: 'Glasses', say: 'I left my glasses on the garden bench!', time: 40,
    pickup: { x: 120, y: 330, label: 'Bench' }, drop: DOOR },
  { id: 'mail', title: 'Mail', say: 'Could you check the mailbox?', time: 45,
    pickup: { x: 55, y: 500, label: 'Mailbox' }, drop: DOOR },
  { id: 'cat', title: 'Cat', say: 'The cat is stuck in the tree again...', time: 40,
    pickup: { x: 415, y: 385, label: 'Tree' }, drop: DOOR },
  { id: 'bins', title: 'Trash bins', say: 'Bins go out to the curb today, dear.', time: 50,
    pickup: { x: 240, y: 490, label: 'Bins' }, drop: CURB },
];

export function deadlineScale(difficulty) {
  return difficulty === 'easy' ? 1.3 : difficulty === 'hard' ? 0.75 : 1;
}

export function createQuest(template, id, flags = {}) {
  const t = template.time * deadlineScale(flags.difficulty);
  return {
    id, templateId: template.id, title: template.title, say: template.say,
    stage: 'fetch', // 'fetch' -> 'deliver'
    pickup: { ...template.pickup }, drop: { ...template.drop },
    timeLeft: t, timeTotal: t,
  };
}

export function questTarget(q) {
  return q.stage === 'fetch' ? q.pickup : q.drop;
}

// The quest the HUD arrow points at: the carried one if any, else the most urgent.
export function primaryQuest(state) {
  const carried = state.quests.find((q) => q.id === state.carry);
  if (carried) return carried;
  return state.quests.reduce((best, q) => (!best || q.timeLeft < best.timeLeft ? q : best), null);
}

export function canGiveQuest(state) {
  return state.quests.length < state.flags.maxActiveQuests;
}

// Hand a new random quest (not a duplicate of an active one). Returns quest or null.
export function giveQuest(state) {
  if (!canGiveQuest(state)) return null;
  const free = QUEST_TEMPLATES.filter((t) => !state.quests.some((q) => q.templateId === t.id));
  if (!free.length) return null;
  const q = createQuest(state.rng.pick(free), state.nextQuestId++, state.flags);
  state.quests.push(q);
  state.events.push({ type: 'questGiven', questId: q.id, title: q.title });
  return q;
}

function removeQuest(state, q) {
  state.quests = state.quests.filter((x) => x !== q);
  if (state.carry === q.id) state.carry = null;
}

export function changeHarmony(state, delta) {
  state.harmony = Math.max(0, Math.min(HARMONY.max, state.harmony + delta));
}

// If the player holds the action key within range of a pickup (hands empty) or a drop
// (carrying that quest's item), do it. Returns true when a quest interaction happened.
export function tryQuestInteraction(state) {
  const p = state.player;
  if (state.carry == null) {
    for (const q of state.quests) {
      if (q.stage === 'fetch' && dist(p.x, p.y, q.pickup.x, q.pickup.y) <= INTERACT_RANGE) {
        q.stage = 'deliver';
        state.carry = q.id;
        state.events.push({ type: 'pickup', questId: q.id });
        return true;
      }
    }
  } else {
    const q = state.quests.find((x) => x.id === state.carry);
    if (q && dist(p.x, p.y, q.drop.x, q.drop.y) <= INTERACT_RANGE) {
      removeQuest(state, q);
      changeHarmony(state, HARMONY.onComplete);
      state.stats.questsCompleted++;
      state.events.push({ type: 'questCompleted', questId: q.id, title: q.title });
      return true;
    }
  }
  return false;
}

// Tick deadlines and passive harmony decay.
export function updateQuests(state, dt) {
  for (const q of [...state.quests]) {
    q.timeLeft -= dt;
    if (q.timeLeft <= 0) {
      removeQuest(state, q);
      changeHarmony(state, HARMONY.onFail);
      state.stats.questsFailed++;
      state.events.push({ type: 'questFailed', questId: q.id, title: q.title });
    }
  }
  if (state.quests.length > 0) {
    const hourSeconds = state.flags.dayLength / 9;
    changeHarmony(state, -HARMONY.decayPerHour * (dt / hourSeconds));
  }
}
