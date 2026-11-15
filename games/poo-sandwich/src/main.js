import { getFlags } from './flags.js';
import { createGame, update } from './game.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { pickLang, normalizeLang, t } from './i18n.js';

const flags = getFlags();
const $ = (id) => document.getElementById(id);
const canvas = $('game');
const renderer = createRenderer(canvas);
const BEST_KEY = 'poo-sandwich-best';
const LANG_KEY = 'poo-sandwich-lang';

const readBest = () => { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch (_) { return 0; } };
const writeBest = (v) => { try { localStorage.setItem(BEST_KEY, String(v)); } catch (_) { /* ignore */ } };

// Language (F13): ?lang= from the launcher is remembered, so later visits without it keep the same language.
let lang = (() => {
  let saved = null;
  try { saved = localStorage.getItem(LANG_KEY); } catch (_) { /* ignore */ }
  const query = normalizeLang(new URLSearchParams(location.search).get('lang'));
  const picked = pickLang({ query, saved, browser: navigator.languages?.length ? navigator.languages : [navigator.language] });
  if (query) saveLang(query);
  return picked;
})();
function saveLang(l) { try { localStorage.setItem(LANG_KEY, l); } catch (_) { /* ignore */ } }

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

// Static texts carry data-i18n (text), data-i18n-html (markup from i18n.js only) or data-i18n-aria (aria-label).
function applyLang() {
  document.documentElement.lang = lang;
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(lang, node.dataset.i18n);
  for (const node of document.querySelectorAll('[data-i18n-html]')) node.innerHTML = t(lang, node.dataset.i18nHtml);
  for (const node of document.querySelectorAll('[data-i18n-aria]')) node.setAttribute('aria-label', t(lang, node.dataset.i18nAria));
  for (const b of document.querySelectorAll('#langSwitch [data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  renderer.setLang(lang);
  describeFlags();
}

function describeFlags() {
  $('pooRule').innerHTML = t(lang, flags.poo === 'choice' ? 'pooRuleChoice' : 'pooRuleHit');
  $('controlsHelp').textContent = t(lang, flags.controls === 'joystick' ? 'controlsJoystick' : flags.controls === 'tap' ? 'controlsTap' : 'controlsAuto');
  $('flagsLine').textContent = `controls=${flags.controls} · poo=${flags.poo} · day=${flags.daySeconds}s${flags.debug ? ' · debug' : ''}`;
  const best = readBest();
  $('bestTitle').textContent = best ? t(lang, 'best', { n: best }) : '';
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
  const best = readBest();
  const isBest = sm.score > best;
  if (isBest) writeBest(sm.score);
  $('overTitle').textContent = t(lang, sm.won ? 'wonTitle' : 'lostTitle');
  $('overText').textContent = sm.won ? t(lang, 'wonText', { stress: sm.stress, bonus: sm.bonus }) : t(lang, 'lostText');
  $('overScore').textContent = sm.score;
  $('overBest').textContent = isBest ? t(lang, 'newBest') : t(lang, 'best', { n: Math.max(best, sm.score) });
  $('overStats').textContent = t(lang, 'stats', { tasks: sm.tasksDone, poo: sm.pooDone, hits: sm.hits, dodged: sm.dodged, missed: sm.pooExpired });
  setMode('over');
}

$('startBtn').addEventListener('click', start);
$('againBtn').addEventListener('click', start);
$('menuBtn').addEventListener('click', toTitle);
$('quitBtn').addEventListener('click', toTitle);
$('resumeBtn').addEventListener('click', resume);
$('pauseBtn').addEventListener('click', pause);
$('langSwitch').addEventListener('click', (e) => {
  const next = normalizeLang(e.target.closest('[data-lang]')?.dataset.lang);
  if (!next || next === lang) return;
  lang = next;
  saveLang(lang);
  applyLang();
});
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

applyLang();
renderer.resize();
requestAnimationFrame(frame);
if (flags.debug) window.__game = { get state() { return state; }, start };
