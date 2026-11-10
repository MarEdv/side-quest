import { getFlags } from './flags.js';
import { createGame, update } from './game.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';

const flags = getFlags();
const $ = (id) => document.getElementById(id);
const canvas = $('game');
const renderer = createRenderer(canvas);
const BEST_KEY = 'poo-sandwich-best';

const readBest = () => { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch (_) { return 0; } };
const writeBest = (v) => { try { localStorage.setItem(BEST_KEY, String(v)); } catch (_) { /* ignore */ } };

let mode = 'title'; // title | playing | paused | over
let state = createGame(flags, 1);
let last = 0;

const input = createInput(canvas, {
  mode: flags.controls,
  toWorld: (x, y) => renderer.toWorld(x, y),
  onPause: () => (mode === 'playing' ? pause() : mode === 'paused' ? resume() : null),
});

function show(id, on) { $(id).hidden = !on; }
function setMode(m) {
  mode = m;
  show('title', m === 'title'); show('pause', m === 'paused'); show('over', m === 'over');
  show('pauseBtn', m === 'playing');
}

function describeFlags() {
  $('pooRule').innerHTML = flags.poo === 'choice'
    ? '💩 Dodged sandwiches stay on the floor for a few seconds. <b>Walk over one to take the challenge</b> for bonus points, or ignore it (a little stress). A direct hit gives you the task anyway.'
    : '💩 If a sandwich <b>hits you</b>, you get an urgent poo task with a deadline. Solve it at its station before time runs out!';
  const touch = flags.controls === 'joystick' ? 'Drag on the left half of the screen to steer (virtual joystick).'
    : flags.controls === 'tap' ? 'Tap or click where you want the worker to walk.'
      : 'Keyboard: WASD / arrows to move, P or Esc to pause. Mouse: click to walk. Touch: drag on the left half as a joystick.';
  $('controlsHelp').textContent = touch;
  $('flagsLine').textContent = `controls=${flags.controls} · poo=${flags.poo} · day=${flags.daySeconds}s${flags.debug ? ' · debug' : ''}`;
  const best = readBest();
  $('bestTitle').textContent = best ? `Best score: ${best}` : '';
}

function start() {
  state = createGame(flags, (Date.now() & 0x7fffffff) || 1);
  input.reset();
  last = 0;
  setMode('playing');
}
function pause() { if (mode === 'playing') { input.reset(); setMode('paused'); } }
function resume() { if (mode === 'paused') { last = 0; setMode('playing'); } }
function toTitle() { describeFlags(); state = createGame(flags, 1); setMode('title'); }

function endGame() {
  const sm = state.summary;
  const best = readBest();
  const isBest = sm.score > best;
  if (isBest) writeBest(sm.score);
  $('overTitle').textContent = sm.won ? '🎉 Survived the day!' : '🔥 Burnout!';
  $('overText').textContent = sm.won
    ? `17:00. You clocked out with ${sm.stress}% stress. Calm bonus: +${sm.bonus}.`
    : 'Stress hit 100%. HR sends you a mug that says "Resilience".';
  $('overScore').textContent = sm.score;
  $('overBest').textContent = isBest ? '🏆 New best score!' : `Best score: ${Math.max(best, sm.score)}`;
  $('overStats').textContent = `Tasks ${sm.tasksDone} · Poo tasks solved ${sm.pooDone} · Hits ${sm.hits} · Dodged ${sm.dodged} · Missed deadlines ${sm.pooExpired}`;
  setMode('over');
}

$('startBtn').addEventListener('click', start);
$('againBtn').addEventListener('click', start);
$('menuBtn').addEventListener('click', toTitle);
$('quitBtn').addEventListener('click', toTitle);
$('resumeBtn').addEventListener('click', resume);
$('pauseBtn').addEventListener('click', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('blur', pause);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' || e.code === 'Space') {
    if (mode === 'title' || mode === 'over') { e.preventDefault(); start(); }
    else if (mode === 'paused') { e.preventDefault(); resume(); }
  }
});
window.addEventListener('resize', () => renderer.resize());
window.addEventListener('orientationchange', () => setTimeout(() => renderer.resize(), 100));
// Block pinch/double-tap zoom on iOS
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (e.target === canvas) e.preventDefault(); }, { passive: false });

function frame(now) {
  requestAnimationFrame(frame);
  const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
  last = now;
  if (mode === 'playing') {
    update(state, dt, input.read());
    renderer.handle(state.events, state);
    if (state.phase !== 'playing') endGame();
  }
  renderer.draw(state, now, input);
}

describeFlags();
renderer.resize();
requestAnimationFrame(frame);
if (flags.debug) window.__game = { get state() { return state; }, start };
