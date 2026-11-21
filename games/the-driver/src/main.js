// Browser glue: the fixed-step loop, screens and wiring of the pure game (src/game.js) to the canvas, input, audio
// and the DOM overlays. Flags: docs/FLAGS.md.
import { parseFlags } from './flags.js';
import { randomSeed } from './kit/rng.js';
import { setupLang } from './kit/langdom.js';
import { createGame, step } from './game.js';
import { CFG } from './config.js';
import { createStorage } from './storage.js';
import { recordRun, loadScores, scoresFor } from './scores.js';
import { createRenderer } from './render.js';
import { createInput, held } from './input.js';
import { createAudio } from './audio.js';
import { createUI } from './ui.js';
import { stageName } from './track.js';
import { i18n, t, backHref } from './i18n.js';

const flags = parseFlags(location.search);
let backend = null;
try { backend = window.localStorage; } catch { /* blocked storage: play in memory */ }
const storage = createStorage(backend);
const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const audio = createAudio({ enabled: flags.sound });
const DT = CFG.dt;

let state = null;
let preview = null;         // a still drive behind the title screen
let phase = 'title';        // title | play | pause | ending | end
let soundOn = flags.sound;
let acc = 0, speed = 1, endTimer = 0, lastRank = 0, engineT = 0, rumbleT = 0;

const input = createInput({ touchMode: flags.touch, isBlocked: () => phase !== 'play', onPause: () => (phase === 'play' ? pause() : phase === 'pause' ? resume() : null) });

const ui = createUI({
  start, pause, resume, quit, toggleSound,
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
  if (flags.length !== 'normal') bits.push(t('flagShort'));
  if (flags.road !== 'highway') bits.push(t('flagRoad'));
  if (flags.steer === 'lanes') bits.push(t('flagLanes'));
  if (flags.pedals === 'manual') bits.push(t('flagManual'));
  if (flags.crash === 'hard') bits.push(t('flagHard'));
  if (flags.view === 'hood') bits.push(t('flagHood'));
  if (flags.difficulty !== 'normal') bits.push(t('flagDifficulty', { difficulty: t(`diff_${flags.difficulty}`) }));
  if (flags.seed !== null) bits.push(t('flagSeed', { n: flags.seed }));
  if (flags.debug) bits.push(t('flagDebug'));
  return bits.length ? t('flags', { list: bits.join(' · ') }) : '';
};

// ---------- screens
function showTitle() {
  phase = 'title'; state = null;
  ui.hudVisible(false); input.showTouch(false); ui.showFast(false);
  preview ??= createGame(flags, flags.seed ?? 7);
  ui.renderTitle({ scores: scoresFor(loadScores(storage), flags.length), length: flags.length, controls: t(input.touchActive() ? 'controlsTouch' : 'controlsKeys'), flags: flagsText() });
  ui.show('title');
}

function start() {
  const seed = flags.seed ?? randomSeed();
  state = createGame(flags, seed);
  acc = 0; endTimer = 0; lastRank = 0; engineT = 0; rumbleT = 0;
  phase = 'play';
  ui.hide(); ui.resetHud();
  ui.hudVisible(true); input.showTouch(input.touchActive()); ui.showFast(flags.debug); ui.markFast(speed !== 1);
  input.reset(); renderer.resize(); renderer.reset();
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

function showEnd() {
  const s = state.summary;
  phase = 'end'; ui.hudVisible(false); input.showTouch(false); ui.showFast(false);
  ui.renderEnd({ summary: s, rank: lastRank, list: scoresFor(loadScores(storage), flags.length), debug: flags.debug, length: flags.length, saved: storage.persistent });
  ui.show('end');
}

// ---------- events -> sounds and toasts (after every step)
function collect(events) {
  for (const ev of events) {
    switch (ev.type) {
      case 'stage': audio.play('stage'); ui.toast(t(`toastStage_${stageName(ev.stage)}`), 'info'); break;
      case 'nearMiss':
        audio.play('nearMiss');
        ui.toast(ev.mult > 1 ? t('toastNearMissStreak', { points: ev.points, mult: ev.mult }) : t('toastNearMiss', { points: ev.points }), 'good');
        break;
      case 'crash':
        audio.play('crash'); ui.toast(t('toastCrash', { points: CFG.score.penalty }), 'bad');
        if (flags.crash === 'hard' && ev.count === CFG.crash.hardLimit - 1) ui.toast(t('toastLastCrash'), 'bad');
        break;
      case 'offroad': ui.toast(t('toastOffroad'), 'info'); break;
      case 'barrier': audio.play('barrier'); break;
      case 'end': {
        let rank = 0;
        try {
          rank = recordRun(storage, flags, { score: ev.summary.score, stars: ev.summary.stars, seed: ev.summary.seed, difficulty: ev.summary.difficulty, date: new Date().toISOString().slice(0, 10) });
        } catch { /* a failing store never breaks the end screen */ }
        const wrecked = ev.reason === 'wrecked';
        audio.play(wrecked ? 'wrecked' : 'finish'); ui.toast(t(wrecked ? 'toastWrecked' : 'toastFinish'), wrecked ? 'bad' : 'good');
        lastRank = rank; phase = 'ending'; endTimer = 1.8; input.reset();
        break;
      }
      default: break;
    }
  }
}

// ---------- the loop
let last = performance.now(), fpsFrames = 0, fpsT = 0, fps = 0, lastToastTop = 0, lastTop = -1;
const hudTop = document.getElementById('hudTop');
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
    // the engine putt follows the speed; the rumble follows the grass
    engineT -= real;
    if (engineT <= 0) { const v = Math.min(1, state.player.speed / state.player.topSpeed); audio.engine(v); engineT = 0.25 - 0.19 * v; }
    rumbleT -= real;
    if (state.player.offroad && state.player.speed > 3 && rumbleT <= 0) { audio.play('rumble'); rumbleT = 0.11; }
  } else if (phase === 'ending') {
    endTimer -= real;
    if (endTimer <= 0) showEnd();
  }
  const s = state || (phase === 'title' ? preview : null);
  if (s) {
    // narrow screens: the mirror hangs below the HUD chips
    const top = !document.getElementById('hud').hidden && window.innerWidth < 600 ? Math.round(hudTop.getBoundingClientRect().bottom) + 2 : 0;
    renderer.draw(s, { dt: simDt, now, top, unit: t('hudSpeed') });
    const tt = renderer.mirrorBottom + 8;
    if (tt !== lastToastTop) { lastToastTop = tt; document.documentElement.style.setProperty('--toast-t', `${tt}px`); }
    if (state && !document.getElementById('hud').hidden) ui.hud(state, flags.view === 'hood');
    lastTop = top;
  }
  if (flags.debug) {
    fpsFrames++; fpsT += real;
    if (fpsT >= 0.5) { fps = Math.round(fpsFrames / fpsT); fpsFrames = 0; fpsT = 0; }
    ui.setDebug(`${fps} fps · seed ${state ? state.seed : flags.seed ?? '-'} · ${speed}× · t ${state ? state.time.toFixed(0) : 0}s`);
  }
}

// K-3: the game never runs unseen: losing focus or hiding the page pauses it.
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') pause(); });
window.addEventListener('resize', () => renderer.resize());
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
