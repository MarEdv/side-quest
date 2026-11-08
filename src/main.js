// Browser entry: fixed-timestep loop, canvas sizing, input, audio, rendering.
import { DEFAULT_FLAGS, settingsSummary } from './config.js';
import { resolveFlags, withSetting, createSettingsStore, gameplayOf, controlOf, GAMEPLAY_FLAGS } from './settings.js';
import { createGame, update, startGame, toMenu } from './game.js';
import { createInput } from './input.js';
import { createTouch } from './touch.js';
import { computeLayout, chromeLayout, mergeInput } from './touchmath.js';
import { createAudio } from './audio.js';
import { createStorage } from './storage.js';
import { createScores } from './scores.js';
import { createUI } from './ui.js';
import { gateInput, shouldRecord, startsDay } from './uimodel.js';
import { render } from './render.js';
import { W, H } from './world.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25; // clamp big gaps (tab switches)

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput(window);

// Even reading window.localStorage can throw (blocked cookies / sandboxed iframes): guard it, fall back to memory.
let backend = null;
try { backend = window.localStorage; } catch { backend = null; }
const storage = createStorage(backend);
const scores = createScores(storage);
const settingsStore = createSettingsStore(storage);

// Flags, three layers (D-23). `resolved` = URL > saved > default, what Settings shows. `flags` = what the running game
// reads (state.flags is this same object): control/display flags follow `resolved` at once, gameplay flags are copied
// in by applyGameplay() only when no day is in progress, so a change never alters a day already running.
let saved = settingsStore.load();
let resolved = resolveFlags(DEFAULT_FLAGS, saved, location.search);
const flags = { ...resolved.flags };
const audio = createAudio(flags.sound);
const state = createGame(flags);
if (flags.debug) window.__state = state; // inspection hook for browser self-checks

const dayInProgress = () => state.phase === 'playing' || state.phase === 'paused';
const pendingKeys = () => GAMEPLAY_FLAGS.filter((k) => flags[k] !== resolved.flags[k]);
function applyGameplay() { Object.assign(flags, gameplayOf(resolved.flags)); }
let debugTainted = false; // a day with debug on at any moment is never recorded (D-22/D-23)

function applyControl() {
  Object.assign(flags, controlOf(resolved.flags));
  audio.setEnabled(flags.sound);
  touch.setOptions({ mode: flags.touch, scheme: flags.touchScheme });
  if (flags.debug) window.__state = state;
  else delete window.__state; // the inspection hook only exists while debug is on (D-24)
}
function setSetting(key, value) {
  saved = withSetting(saved, key, value, DEFAULT_FLAGS);
  settingsStore.save(saved);
  refreshResolved();
}
function refreshResolved() {
  resolved = resolveFlags(DEFAULT_FLAGS, saved, location.search);
  applyControl();
  if (!dayInProgress()) { applyGameplay(); if (state.phase === 'title') toMenu(state); }
}

const hintEl = document.getElementById('hint');
const rotateEl = document.getElementById('rotate');
const probe = document.getElementById('probe');
const HINT_KEYS = hintEl.textContent;
const HINT_TOUCH = {
  joystick: 'Left thumb: steer \u00b7 hold WORK: work / interact \u00b7 II: pause',
  tap: 'Tap / drag: walk \u00b7 hold on a task: work \u00b7 II: pause',
};
let rotateDismissed = false;

const controlsText = () => (touch.active() ? HINT_TOUCH[flags.touchScheme] : HINT_KEYS);
const startDay = () => { debugTainted = false; applyGameplay(); startGame(state); };
const menus = createUI({
  scores, now: () => performance.now(),
  persistent: () => storage.persistent,
  controlsText, summary: () => settingsSummary(resolved.flags), isTouch: () => touch.active(),
  settings: {
    state: () => ({ flags: resolved.flags, locked: resolved.locked }),
    pending: pendingKeys,
    dayInProgress,
    set: setSetting,
    reset() { saved = settingsStore.reset(); refreshResolved(); },
    clearLinks() { location.assign(location.pathname + location.hash); }, // reload without the query string
  },
  actions: {
    play: () => { audio.unlock(); startDay(); },
    again: () => startDay(),
    resume: () => { if (state.phase === 'paused') state.phase = 'playing'; },
    quit: () => { applyGameplay(); toMenu(state); },
  },
});

let ready = false;
const touch = createTouch({ mode: flags.touch, scheme: flags.touchScheme, onChange: () => { if (ready) resize(); } });

let dpr = 1;
function resize() {
  dpr = window.devicePixelRatio || 1;
  const vv = window.visualViewport;
  const vw = vv ? vv.width : window.innerWidth, vh = vv ? vv.height : window.innerHeight;
  const cs = getComputedStyle(probe);
  const insets = { top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0, bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0 };
  const isTouch = touch.active();
  const portrait = vh > vw;
  // Keyboard players get the hint line under the canvas. Touch players only see it in portrait (free space there).
  const showHint = !isTouch || portrait;
  const L = computeLayout(vw, vh, { insets, hintH: isTouch ? 0 : 30 });
  const chrome = chromeLayout(L, isTouch);
  touch.setLayout(L, chrome);
  menus.setLayout(L, chrome);
  canvas.style.left = `${L.left}px`; canvas.style.top = `${L.top}px`;
  canvas.style.width = `${L.width}px`; canvas.style.height = `${L.height}px`;
  canvas.width = Math.round(L.width * dpr);
  canvas.height = Math.round(L.height * dpr);
  hintEl.textContent = isTouch ? HINT_TOUCH[flags.touchScheme] : HINT_KEYS;
  hintEl.style.display = showHint ? '' : 'none';
  hintEl.style.top = `${chrome.hintTop}px`;
  const showRotate = isTouch && portrait && !rotateDismissed;
  rotateEl.style.display = showRotate ? 'flex' : 'none';
  rotateEl.style.top = `${chrome.rotateTop}px`;
}
rotateEl.querySelector('button').addEventListener('click', () => { rotateDismissed = true; resize(); });
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
// DPR can change without a resize event (window dragged to another monitor): re-arm a one-shot query each time.
function watchDpr() {
  if (!window.matchMedia) return;
  matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`).addEventListener('change', () => { resize(); watchDpr(); }, { once: true });
}
ready = true;
resize();
watchDpr();

// Browsers need a gesture before audio can start.
window.addEventListener('keydown', () => audio.unlock());
window.addEventListener('pointerdown', () => audio.unlock());
window.addEventListener('pointerup', () => audio.unlock()); // iOS only honours some gestures on release
window.addEventListener('touchend', () => audio.unlock()); // older WebKit: touchend is the activation event

// iOS ignores SVG apple-touch-icon: draw a small PNG at runtime.
try {
  const ic = document.createElement('canvas'); ic.width = ic.height = 180;
  const g = ic.getContext('2d');
  g.fillStyle = '#5cae4b'; g.fillRect(0, 0, 180, 180);
  g.fillStyle = '#a85d3b'; g.fillRect(0, 0, 180, 50);
  g.fillStyle = '#f28c28'; g.beginPath(); g.arc(90, 112, 29, 0, 7); g.fill();
  g.fillStyle = '#f1c9a0'; g.beginPath(); g.arc(90, 76, 18, 0, 7); g.fill();
  const lk = document.createElement('link'); lk.rel = 'apple-touch-icon'; lk.href = ic.toDataURL('image/png');
  document.head.appendChild(lk);
} catch { /* cosmetic */ }

// Auto-pause when the tab loses focus.
const autoPause = () => { input.clear(); touch.clear(); if (state.phase === 'playing') state.phase = 'paused'; };
window.addEventListener('blur', autoPause);
document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });

// Menu hand-off: when the phase changes, record a finished day and show the matching DOM screen.
let shownPhase = null;
function syncMenus() {
  if (state.phase === shownPhase) return;
  if (shouldRecord(shownPhase, state.phase, { debug: debugTainted || flags.debug })) {
    menus.setEndResult(scores.recordArcade({ score: state.score, won: state.phase === 'won', date: new Date().toISOString(), summary: state.summary }));
  } else if (state.phase === 'won' || state.phase === 'lost') {
    menus.setEndResult((debugTainted || flags.debug) ? { rank: null, isBest: false, best: null, note: 'Debug run: not recorded' } : null);
  }
  // A new day starts clean: R on the end screen restarts from game.js without startDay(), and must not inherit the
  // previous day's debug mark (D-24). The frame loop marks it again before the next step if debug is still on.
  if (startsDay(shownPhase, state.phase)) debugTainted = false;
  shownPhase = state.phase;
  if (!dayInProgress()) applyGameplay(); // R on the end screen restarts straight from game.js: it must see the new settings
  menus.setPhase(shownPhase);
  const menu = shownPhase === 'title';
  hintEl.style.visibility = menu ? 'hidden' : '';
  rotateEl.style.visibility = menu ? 'hidden' : '';
}

let last = performance.now(), acc = 0, fps = 60, tickT = 0;
function frame(now) {
  // rAF's timestamp can precede the performance.now() taken at load, so clamp both ends.
  let dt = Math.max(0, (now - last) / 1000);
  last = now;
  if (dt > MAX_FRAME) dt = MAX_FRAME;
  if (dt > 0) fps = fps * 0.95 + (1 / dt) * 0.05;
  acc += dt;
  if (flags.debug && state.phase === 'playing') debugTainted = true;
  const inp = gateInput(state.phase, mergeInput(input.read(), touch.read(state)), menus.modal);
  let steps = 0;
  while (acc >= STEP) {
    update(state, inp, STEP);
    acc -= STEP; steps++;
  }
  if (steps > 0) touch.ack(); // taps are held until a step has seen them (game.js edge-detects)
  syncMenus();
  for (const e of state.events) audio.play(e.type);
  state.events.length = 0;
  if (state.player.working && state.phase === 'playing') {
    tickT -= dt;
    if (tickT <= 0) { audio.tick(); tickT = 0.18; }
  }
  // DPR-aware transform, reset every frame: logical 960x540 -> backing store.
  const k = canvas.width / W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  render(ctx, state, { fps, time: now / 1000, touch: touch.active() });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
