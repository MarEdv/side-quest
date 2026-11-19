// Small helpers shared by the game modules: the event queue, score, lookups, the carried item and quest stages. Pure.
import { CFG } from './config.js';

const r2 = (n) => Math.round(n * 100) / 100;

// Appends an event for this step (state.events is emptied at the start of every step()).
export const emit = (s, ev) => { s.events.push({ ...ev, at: r2(s.time) }); };
export const addScore = (s, pts) => { s.score += pts; };
export const addPotential = (s, pts) => { s.stats.potential += pts; };
export const byId = (s, id) => s.passengers.find((p) => p.id === id) || null;
export const difficultyOf = (s) => CFG.difficulty[s.flags.difficulty] || CFG.difficulty.normal;
export const freeSeatCount = (s) => s.seatOwner.reduce((n, o) => n + (o === null ? 1 : 0), 0);
export const delayMult = (s) => 1 + Math.min(s.route.delay, CFG.delayStressCap) / CFG.delayStressScale;

// Quest stage → the text key shown as the quest's goal in the HUD.
export const GOALS = {
  rescue: { wait: 'q_rescue_wait', seat: 'q_rescue_goal' },
  connection: { radio: 'q_connection_goal', tell: 'q_connection_goalTell' },
  nervous: { talk: 'q_nervous_goal' },
  lost: { find: 'q_lost_goal', give: 'q_lost_goalGive' },
  sick: { fetch: 'q_sick_goal', deliver: 'q_sick_goalGive' },
};
export function setStage(q, stage) { q.stage = stage; q.goal = GOALS[q.type][stage]; }

// What the attendant carries: null, 'coffee', 'snack', 'water', 'kit' or 'bag'. Taking something else puts a bag or kit
// being delivered back (the quest returns to its fetch stage).
export function setCarried(s, item) {
  const old = s.carried;
  s.carried = item;
  if (old && old !== item && (old === 'bag' || old === 'kit')) {
    for (const q of s.quests.active) {
      if (old === 'bag' && q.type === 'lost' && q.stage === 'give') setStage(q, 'find');
      if (old === 'kit' && q.type === 'sick' && q.stage === 'deliver') setStage(q, 'fetch');
    }
  }
}
