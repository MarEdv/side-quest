// Browser entry: fixed-timestep loop, canvas sizing, input, audio, rendering.
import { parseFlags } from './config.js';
import { createGame, update } from './game.js';
import { createInput } from './input.js';
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

let scale = 1, dpr = 1;
function resize() {
  dpr = window.devicePixelRatio || 1;
  const hintH = 30;
  scale = Math.max(0.1, Math.min(window.innerWidth / W, (window.innerHeight - hintH) / H));
  canvas.style.width = `${W * scale}px`;
  canvas.style.height = `${H * scale}px`;
  canvas.width = Math.round(W * scale * dpr);
  canvas.height = Math.round(H * scale * dpr);
}
window.addEventListener('resize', resize);
// DPR can change without a resize event (window dragged to another monitor): re-arm a one-shot query each time.
function watchDpr() {
  if (!window.matchMedia) return;
  matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`).addEventListener('change', () => { resize(); watchDpr(); }, { once: true });
}
resize();
watchDpr();

// Browsers need a gesture before audio can start.
window.addEventListener('keydown', () => audio.unlock());
window.addEventListener('pointerdown', () => audio.unlock());

// Auto-pause when the tab loses focus.
const autoPause = () => { input.clear(); if (state.phase === 'playing') state.phase = 'paused'; };
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
  const inp = input.read();
  while (acc >= STEP) {
    update(state, inp, STEP);
    acc -= STEP;
  }
  for (const e of state.events) audio.play(e.type);
  state.events.length = 0;
  if (state.player.working && state.phase === 'playing') {
    tickT -= dt;
    if (tickT <= 0) { audio.tick(); tickT = 0.18; }
  }
  // DPR-aware transform, reset every frame: logical 960x540 -> backing store.
  const k = canvas.width / W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  render(ctx, state, { fps, time: now / 1000 });
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
