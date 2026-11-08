// Browser entry: fixed-timestep loop, canvas sizing, input, audio, rendering.
import { parseFlags } from './config.js';
import { createGame, update } from './game.js';
import { createInput } from './input.js';
import { createTouch } from './touch.js';
import { computeLayout, chromeLayout, mergeInput } from './touchmath.js';
import { createAudio } from './audio.js';
import { render } from './render.js';
import { W, H } from './world.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25; // clamp big gaps (tab switches)

const flags = parseFlags(location.search);
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput(window);
const audio = createAudio(flags.sound);
const state = createGame(flags);
if (flags.debug) window.__state = state; // inspection hook for browser self-checks

const hintEl = document.getElementById('hint');
const rotateEl = document.getElementById('rotate');
const probe = document.getElementById('probe');
const HINT_KEYS = hintEl.textContent;
const HINT_TOUCH = {
  joystick: 'Left thumb: steer \u00b7 hold WORK: work / interact \u00b7 II: pause',
  tap: 'Tap / drag: walk \u00b7 hold on a task: work \u00b7 II: pause',
};
let rotateDismissed = false;

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
  const ui = chromeLayout(L, isTouch);
  touch.setLayout(L, ui);
  canvas.style.left = `${L.left}px`; canvas.style.top = `${L.top}px`;
  canvas.style.width = `${L.width}px`; canvas.style.height = `${L.height}px`;
  canvas.width = Math.round(L.width * dpr);
  canvas.height = Math.round(L.height * dpr);
  hintEl.textContent = isTouch ? HINT_TOUCH[flags.touchScheme] : HINT_KEYS;
  hintEl.style.display = showHint ? '' : 'none';
  hintEl.style.top = `${ui.hintTop}px`;
  const showRotate = isTouch && portrait && !rotateDismissed;
  rotateEl.style.display = showRotate ? 'flex' : 'none';
  rotateEl.style.top = `${ui.rotateTop}px`;
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

let last = performance.now(), acc = 0, fps = 60, tickT = 0;
function frame(now) {
  // rAF's timestamp can precede the performance.now() taken at load, so clamp both ends.
  let dt = Math.max(0, (now - last) / 1000);
  last = now;
  if (dt > MAX_FRAME) dt = MAX_FRAME;
  if (dt > 0) fps = fps * 0.95 + (1 / dt) * 0.05;
  acc += dt;
  const inp = mergeInput(input.read(), touch.read(state));
  let steps = 0;
  while (acc >= STEP) {
    update(state, inp, STEP);
    acc -= STEP; steps++;
  }
  if (steps > 0) touch.ack(); // taps are held until a step has seen them (game.js edge-detects)
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
