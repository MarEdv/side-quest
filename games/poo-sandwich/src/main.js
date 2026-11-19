import { parseFlags } from './flags.js';
import { createGame, update } from './game.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createStorage } from './kit/storage.js';
import { setupLang } from './kit/langdom.js';
import { i18n, t, backHref } from './i18n.js';
import { sanitizeBest, judgeRun } from './best.js';

const flags = parseFlags(location.search);
const $ = (id) => document.getElementById(id);
const canvas = $('game');
const renderer = createRenderer(canvas);

// Everything this game stores goes through the kit's storage under `poo-sandwich-`: `best` and `lang` (D21, D22). It never
// throws; when storage is blocked the values last for the session. Reading window.localStorage can itself throw.
let backend = null;
try { backend = window.localStorage; } catch (_) { /* not remembered */ }
const storage = createStorage(backend, 'poo-sandwich-');
const readBest = () => sanitizeBest(storage.get('best'));

// Language (F13, D21): kit/langdom.js reads ?lang= (remembered, so later visits without it keep the language) or the saved
// choice, writes the data-i18n texts and runs the switch.
// The "Back to games" link hands the language back to the launcher (?lang=, S-12).
const setBackLink = () => { $('backLink').href = backHref(); };
const lang = setupLang(i18n, { storage, key: 'lang', onChange() { setBackLink(); describeFlags(); } });

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
  $('pooRule').innerHTML = t(flags.poo === 'choice' ? 'pooRuleChoice' : 'pooRuleHit');
  $('controlsHelp').textContent = t(flags.controls === 'joystick' ? 'controlsJoystick' : flags.controls === 'tap' ? 'controlsTap' : 'controlsAuto');
  $('flagsLine').textContent = `controls=${flags.controls} · poo=${flags.poo} · day=${flags.dayLength}s${flags.debug ? ' · debug' : ''}`;
  const best = readBest();
  $('bestTitle').textContent = best ? t('best', { n: best }) : '';
}

function start() {
  state = createGame(flags, (Date.now() & 0x7fffffff) || 1);
  input.reset();
  renderer.reset();
  last = 0;
  setMode('playing');
}
function pause() { if (mode === 'playing') { input.reset(); setMode('paused'); } }
function resume() { if (mode === 'paused') { last = 0; setMode('playing'); } }
function toTitle() { describeFlags(); state = createGame(flags, 1); setMode('title'); }

function endGame() {
  const sm = state.summary;
  // A debug run is never recorded and never a new best (D22): the line shows the note and the stored best.
  const run = judgeRun(storage.get('best'), sm.score, flags.debug);
  if (run.save) storage.set('best', run.best);
  $('overTitle').textContent = t(sm.won ? 'wonTitle' : 'lostTitle');
  $('overText').textContent = sm.won ? t('wonText', { stress: sm.stress, bonus: sm.bonus }) : t('lostText');
  $('overScore').textContent = sm.score;
  $('overBest').textContent = run.isBest ? t('newBest')
    : flags.debug ? [t('debugRun'), run.best ? t('best', { n: run.best }) : ''].filter(Boolean).join(' · ')
    : t('best', { n: run.best });
  $('overStats').textContent = t('stats', { tasks: sm.tasksDone, poo: sm.pooDone, hits: sm.hits, dodged: sm.dodged, missed: sm.pooExpired });
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
  if ((e.code === 'Enter' || e.code === 'Space') && !e.target.closest?.('#langSwitch')) {
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

lang.bindSwitch($('langSwitch'));
lang.apply();
setBackLink();
describeFlags();
renderer.resize();
requestAnimationFrame(frame);
if (flags.debug) window.__game = { get state() { return state; }, start };
