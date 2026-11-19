// Browser glue: the fixed-step loop, screens and wiring of the pure game (src/game.js) to the canvas, input, audio
// and the DOM overlays. Flags: docs/FLAGS.md.
import { parseFlags } from './flags.js';
import { randomSeed } from './kit/rng.js';
import { setupLang } from './kit/langdom.js';
import { createGame, step } from './game.js';
import { CFG } from './config.js';
import { createStorage } from './storage.js';
import { recordRun, loadScores, scoresFor } from './scores.js';
import { doneKey, questKey } from './quests.js';
import { createRenderer } from './render.js';
import { createInput, held } from './input.js';
import { createAudio } from './audio.js';
import { createUI } from './ui.js';
import { i18n, t, backHref } from './i18n.js';

const flags = parseFlags(location.search);
let backend = null;
try { backend = window.localStorage; } catch { /* blocked storage: play in memory */ }
const storage = createStorage(backend);
const canvas = document.getElementById('game');
const renderer = createRenderer(canvas, document.getElementById('strip'));
const audio = createAudio({ enabled: flags.sound });
const DT = CFG.dt;

let state = null;
let phase = 'title';        // title | play | pause | ending | end
let soundOn = flags.sound;
let acc = 0, speed = 1, endTimer = 0, lastRank = 0;
const questVars = new Map(); // quest id -> vars, kept so a finished quest can still be named in its toast

const input = createInput({ touchMode: flags.touch, isBlocked: () => phase !== 'play', onPause: () => (phase === 'play' ? pause() : phase === 'pause' ? resume() : null) });

const ui = createUI({
  start, pause, resume, quit, toggleSound,
  accept: () => input.accept(), decline: () => input.decline(), pick: (k) => input.pick(k),
  toggleFast() { speed = speed === 1 ? 4 : 1; ui.markFast(speed !== 1); },
});

// Language: ?lang= from the launcher, else the saved choice, else the browser's (kit/langdom.js).
const setBackLink = () => { document.getElementById('backLink').href = backHref(); };
const lang = setupLang(i18n, {
  storage, key: 'lang',
  onChange() { setBackLink(); ui.resetHud(); if (phase === 'title') showTitle(); else if (phase === 'pause') ui.renderPause(soundOn); else if (phase === 'end') showEnd(); },
});
lang.bindSwitch(document.getElementById('langSwitch'));
lang.apply();
setBackLink();

const flagsText = () => {
  const bits = [];
  if (flags.trip !== 'normal') bits.push(t(`trip_${flags.trip}`));
  if (flags.cars !== 3) bits.push(t('flagCars', { n: flags.cars }));
  if (flags.difficulty !== 'normal') bits.push(t(`diff_${flags.difficulty}`));
  if (flags.stress === 'contagious') bits.push(t('flagContagious'));
  if (flags.quests === 'assign') bits.push(t('flagAssign'));
  if (flags.seed !== null) bits.push(t('flagSeed', { n: flags.seed }));
  if (flags.debug) bits.push(t('flagDebug'));
  return bits.length ? t('flags', { list: bits.join(' · ') }) : '';
};

// ---------- screens
function showTitle() {
  phase = 'title'; state = null;
  ui.hudVisible(false); input.showTouch(false); ui.showFast(false);
  renderer.draw(null);
  ui.renderTitle({ scores: scoresFor(loadScores(storage), flags.trip), trip: flags.trip, controls: t(input.touchActive() ? 'controlsTouch' : 'controlsKeys'), flags: flagsText() });
  ui.show('title');
}

function start() {
  const seed = flags.seed ?? randomSeed();
  state = createGame(flags, seed);
  questVars.clear(); acc = 0; endTimer = 0; lastRank = 0;
  phase = 'play';
  ui.hide(); ui.resetHud();
  ui.hudVisible(true); input.showTouch(input.touchActive()); ui.showFast(flags.debug); ui.markFast(speed !== 1);
  input.reset(); renderer.resize(); renderer.reset(state);
  audio.unlock();
  collect(state.events);
}

function pause() {
  if (phase !== 'play') return;
  phase = 'pause'; input.reset();
  ui.renderPause(soundOn); ui.show('pause');
}
function resume() {
  if (phase !== 'pause') return;
  phase = 'play'; ui.hide(); input.reset(); acc = 0; audio.unlock();
}
function quit() { ui.hide(); showTitle(); }
function toggleSound() { soundOn = !soundOn; audio.enabled = soundOn; if (soundOn) audio.unlock(); ui.renderPause(soundOn); }

let endView = null;
function showEnd() {
  const s = state.summary;
  endView = { summary: s, rank: lastRank, list: scoresFor(loadScores(storage), flags.trip), debug: flags.debug, trip: flags.trip };
  phase = 'end'; ui.hudVisible(false); input.showTouch(false); ui.showFast(false);
  ui.renderEnd(endView); ui.show('end');
}

// ---------- events -> sounds and toasts (C: after every step)
function collect(events) {
  for (const q of state.quests.active) if (!questVars.has(q.id)) questVars.set(q.id, q.vars);
  for (const ev of events) {
    switch (ev.type) {
      case 'served': audio.play('served'); ui.toast(t('toastServed', { name: ev.name, need: t(`need_${ev.need}`) }), 'good'); break;
      case 'complaint': audio.play('complaint'); ui.toast(t('toastComplaint', { name: ev.name }), 'bad'); break;
      case 'alight': if (ev.lostFare) ui.toast(t('toastLostFare', { name: ev.name }), 'bad'); break;
      case 'station':
        audio.play('station'); ui.toast(t('toastStation', { station: ev.name }), 'info');
        if (ev.alighted) ui.toast(t('toastAlight', { n: ev.alighted }), 'info');
        if (ev.boarded) ui.toast(t('toastBoard', { n: ev.boarded }), 'info');
        break;
      case 'board': if (ev.rescue) ui.toast(t('toastBoard', { n: ev.n }), 'info'); break;
      case 'depart': ui.toast(t('toastDepart', { station: ev.name }), 'info'); break;
      case 'slip': ui.toast(t('toastSlip', { n: ev.seconds }), 'bad'); break;
      case 'stopStart': ui.toast(t('toastStop'), 'info'); break;
      case 'seated': audio.play('seated'); ui.toast(t('toastSeated', { name: ev.name }), 'good'); break;
      case 'follow': audio.play('pickup'); ui.toast(state.followers.length > 1 ? t('toastFollowers', { n: state.followers.length }) : t('toastFollow', { name: ev.name }), 'info'); break;
      case 'pickup': audio.play('pickup'); ui.toast(t(ev.item === 'bag' ? 'toastBagFound' : 'toastPicked', { item: t(`item_${ev.item}`) }), 'info'); break;
      case 'radio': ui.toast(t('toastRadioed'), 'good'); break;
      case 'offer': audio.play('offer'); ui.toast(t('toastOffer'), 'info'); break;
      case 'offerExpired': ui.toast(t('toastExpired'), 'info'); break;
      case 'questDeclined': ui.toast(t('toastDeclined'), 'info'); break;
      case 'questCancelled': ui.toast(t('toastCancelled'), 'bad'); break;
      case 'questAccepted': ui.toast(t('toastAccepted', { quest: t(questKey(ev.qtype, 'title')) }), 'info'); break;
      case 'questDone': audio.play('questDone'); ui.toast(t(doneKey(ev.qtype, ev.kind), questVars.get(ev.id) || {}), 'good'); break;
      case 'questFailed': audio.play('questFailed'); ui.toast(t(questKey(ev.qtype, 'failed'), questVars.get(ev.id) || {}), 'bad'); break;
      case 'end': {
        let rank = 0;
        try {
          rank = recordRun(storage, flags, { score: ev.summary.score, stars: ev.summary.stars, seed: ev.summary.seed, difficulty: ev.summary.difficulty, date: new Date().toISOString().slice(0, 10) });
        } catch { /* a failing store never breaks the end screen */ }
        lastRank = rank; phase = 'ending'; endTimer = 1.6;
        break;
      }
      default: break;
    }
  }
}

// ---------- the loop
let lastTop = 0, last = performance.now(), fpsFrames = 0, fpsT = 0, fps = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const real = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now; // a long gap (tab switch, breakpoint) is cut
  let simDt = 0;
  if (phase === 'play') {
    acc += real * speed;
    const max = 5 * speed;
    let n = 0, inp = null;
    while (acc >= DT && n < max && phase === 'play') {
      const first = inp === null;
      inp = first ? input.read() : held(inp);
      step(state, inp, DT);
      collect(state.events);
      acc -= DT; n++; simDt += DT;
    }
    if (acc > DT) acc = DT; // never let a backlog build up
  } else if (phase === 'ending') {
    endTimer -= real;
    if (endTimer <= 0) showEnd();
  }
  if (state && phase !== 'title') {
    const hudEl = document.getElementById('hudHead');
    const top = hudEl && !document.getElementById('hud').hidden ? hudEl.getBoundingClientRect().bottom + 6 : 80;
    if (top !== lastTop) { lastTop = top; document.documentElement.style.setProperty('--head-b', `${top - 6}px`); }
    renderer.draw(state, { dt: simDt, now, top, bottom: input.touchActive() ? 92 : 0 });
    if (!document.getElementById('hud').hidden) ui.hud(state);
  }
  if (flags.debug) {
    fpsFrames++; fpsT += real;
    if (fpsT >= 0.5) { fps = Math.round(fpsFrames / fpsT); fpsFrames = 0; fpsT = 0; }
    ui.setDebug(`${fps} fps · seed ${state ? state.seed : flags.seed ?? '-'} · ${speed}× · t ${state ? state.time.toFixed(0) : 0}s`);
  }
}

// C-3: the game never runs unseen: losing focus or hiding the page pauses it.
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') pause(); });
window.addEventListener('resize', () => { renderer.resize(); });
input.onTouchChange((on) => { if (phase === 'play') input.showTouch(on); if (phase === 'title') showTitle(); });

if (flags.debug) {
  window.__game = {
    get state() { return state; }, get phase() { return phase; }, flags,
    setSpeed(n) { speed = n; ui.markFast(n !== 1); },
    // Advances the game without rendering: for tests (n fixed steps with the given input).
    steps(n, inp = {}) { for (let i = 0; i < n && state && !state.ended; i++) { step(state, i ? held(inp) : inp, DT); collect(state.events); } },
  };
}

renderer.resize();
showTitle();
requestAnimationFrame(frame);
