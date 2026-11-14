// Browser glue: wires the pure game logic to the canvas, input, audio and the DOM overlays.
import { parseFlags } from './flags.js';
import { randomSeed } from './rng.js';
import { createGame, update, sellAll, sellGem, buyHatchet, say, STEP_TIME } from './game.js';
import { serialize, restore, SAVE_VERSION } from './save.js';
import { createStorage } from './storage.js';
import { addScore, scoresFor, formatTime } from './scores.js';
import { createCamera, follow } from './camera.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createUI } from './ui.js';
import { HATCHETS } from './mining.js';

const flags = parseFlags(location.search);
let backend = null;
try { backend = window.localStorage; } catch { /* blocked storage: play in memory */ }
const storage = createStorage(backend);
const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const audio = createAudio({ enabled: flags.sound });
const cam = createCamera();
let state = null, mapFrom = 'play', persistAsked = false, lastSave = 0, soundOn = flags.sound;

const input = createInput({ touchMode: flags.touch, scheme: flags.touchControls, isBlocked: () => ui.current !== null || !state });

const ui = createUI({
  continueGame, newGame, resume, pause, quit, toggleSound, openMap: () => openMap(),
  closeShop: () => resume(), sellAll: doSellAll, sell: doSell, buy: doBuy,
  escape(name) {
    if (name === 'shop' || name === 'pause') resume();
    else if (name === 'map') { if (mapFrom === 'pause') ui.renderPause(state, soundOn); else resume(); }
  },
  toTitle: () => { state = null; showTitle(); },
});

const isTouch = () => input.touchActive();
const controlsText = () => (isTouch()
  ? 'Touch: hold the D-pad (or stick) to walk and dig. Tap Shop when you are in town. 🗺 for the minimap.'
  : 'WASD / arrows: walk and dig · E / Enter: shop (in town) · M: minimap · P / Esc: pause');
const flagsText = () => {
  const bits = [];
  if (flags.seed !== null) bits.push(`seed ${flags.seed}`);
  if (flags.worldSize !== 256) bits.push(`world ${flags.worldSize}`);
  if (flags.camera !== 'deadzone') bits.push('camera: centre');
  if (!flags.fog) bits.push('fog off');
  if (flags.durability) bits.push('hatchets wear out');
  if (flags.debug) bits.push('DEBUG (not saved to best times)');
  return bits.length ? 'Flags: ' + bits.join(' · ') : '';
};

// ---------- saving ----------
function save() {
  if (!state || state.phase !== 'playing' || flags.debug) return;
  storage.set('save', serialize(state));
  lastSave = performance.now();
  if (!persistAsked) {
    persistAsked = true;
    // Ask the browser not to evict our storage (Safari clears site data after 7 days without interaction; D17).
    try { const p = navigator.storage && navigator.storage.persist && navigator.storage.persist(); if (p && p.catch) p.catch(() => {}); } catch { /* ignore */ }
  }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
window.addEventListener('pagehide', save);

// ---------- screens ----------
function peekSave() {
  const d = storage.get('save');
  return d && d.v === SAVE_VERSION && Number.isFinite(d.t) ? d : null;
}
function showTitle(note = '') {
  ui.hudVisible(false); ui.touchVisible(false); input.showShop(false);
  const d = peekSave();
  ui.renderTitle({
    hasSave: !!d, saveInfo: d ? `${formatTime(d.t)}, ${d.size} × ${d.size}` : '',
    scores: scoresFor(storage.get('scores'), flags.worldSize), size: flags.worldSize,
    controls: note || controlsText(), flags: flagsText(),
  });
  setInert(false);
}
function setInert(overlayOpen) {
  for (const id of ['hudBtns', 'touch']) { const e = document.getElementById(id); if (overlayOpen) e.setAttribute('inert', ''); else e.removeAttribute('inert'); }
}
function enterPlay() {
  ui.hide(); setInert(false);
  ui.resetHud();
  ui.hudVisible(true); ui.touchVisible(isTouch());
  input.reset(); renderer.clear();
  const v = renderer.resize();
  cam.x = state.player.x + 0.5 - v.w / 2; cam.y = state.player.y + 0.5 - v.h / 2;
  follow(cam, state.player.x + 0.5, state.player.y + 0.5, v, state.size, 'center');
  lastSave = performance.now();
  audio.unlock();
}
function newGame() {
  const seed = flags.seed !== null ? flags.seed : randomSeed();
  state = createGame({ seed, size: flags.worldSize, flags });
  storage.remove('save');
  save();
  enterPlay();
}
function continueGame() {
  const s = restore(storage.get('save'), flags);
  if (!s) { storage.remove('save'); showTitle('That saved game could not be read, so it was discarded. Start a new game.'); return; }
  state = s;
  enterPlay();
}
function openOverlay() { input.reset(); setInert(true); }
function pause() { if (state && state.phase === 'playing') { openOverlay(); mapFrom = 'play'; ui.renderPause(state, soundOn); save(); } }
function resume() { ui.hide(); setInert(false); input.reset(); }
function openMap() { if (!state || state.phase !== 'playing') return; mapFrom = ui.current === 'pause' ? 'pause' : 'play'; openOverlay(); ui.renderMap(state); }
function openShop() { if (state && state.phase === 'playing') { openOverlay(); ui.renderShop(state); } }
function quit() { save(); state = null; showTitle(); }
function toggleSound() { soundOn = !soundOn; audio.enabled = soundOn; ui.renderPause(state, soundOn); audio.unlock(); }

function doSell(id, n, key) {
  const r = n === Infinity ? sellGem(state, id, state.inv.gems[id]) : sellGem(state, id, n);
  flushEvents();
  ui.renderShop(state, r.ok ? `Sold for ${r.coins.toLocaleString('en')} coins.` : 'Nothing to sell.', key);
}
function doSellAll() {
  const r = sellAll(state);
  flushEvents();
  ui.renderShop(state, r.ok ? `Sold ${r.count} gems for ${r.coins.toLocaleString('en')} coins.` : 'Your backpack is empty.', 'sellAllBtn');
}
function doBuy(tier, key) {
  const r = buyHatchet(state, tier);
  flushEvents();
  const name = HATCHETS[tier].name;
  const msg = r.ok ? `You bought the ${name} hatchet!` : r.reason === 'poor' ? `Not enough coins: ${r.need.toLocaleString('en')} more for the ${name} hatchet.` : r.reason === 'owned' ? 'You already have it.' : r.reason === 'worse' ? 'You already have a better hatchet.' : 'Cannot buy that.';
  ui.renderShop(state, msg, r.ok ? 'shopClose' : key);
}

// ---------- events ----------
const SOUND = { hit: 'hit', mined: 'mined', gem: 'gem', chest: 'chest', sell: 'sell', buy: 'buy', toohard: 'toohard', broke: 'broke', win: 'win' };
function flushEvents() {
  const evs = state.events;
  let shop = false;
  for (const e of evs) {
    if (e.type === 'tile') renderer.invalidate(e.i, state.size);
    else if (e.type === 'shop') shop = true;
    else if (e.type === 'atShop') say(state, isTouch() ? 'The shop: tap 🏪 Shop to trade' : 'The shop: press E to trade', 'atShop');
    else if (SOUND[e.type]) audio.play(SOUND[e.type]);
    if (e.type === 'win') onWin();
  }
  evs.length = 0;
  return shop;
}
function onWin() {
  storage.remove('save');
  let rank = 0, scores = scoresFor(storage.get('scores'), state.size);
  if (!flags.debug) {
    const r = addScore(storage.get('scores'), state.size, { time: Math.round(state.stats.time * 10) / 10, seed: state.seed, date: new Date().toISOString().slice(0, 10) });
    storage.set('scores', r.scores);
    rank = r.rank; scores = scoresFor(r.scores, state.size);
  }
  setTimeout(() => { openOverlay(); ui.renderWin(state, scores, rank, flags.debug); }, 900);
}

// ---------- loop ----------
let lastT = 0, fps = 60;
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000));
  lastT = t;
  if (dt > 0) fps = fps * 0.95 + (1 / dt) * 0.05;
  if (!state) { canvas.getContext('2d').fillStyle = '#14110f'; canvas.getContext('2d').fillRect(0, 0, canvas.width, canvas.height); return; }
  const s = state;
  if (!ui.current) {
    const inp = input.read();
    if (s.phase === 'playing') {
      if (inp.pause) { pause(); return; }
      if (inp.map) { openMap(); return; }
      update(s, { dx: inp.dx, dy: inp.dy, shop: inp.shop }, dt);
      const shop = flushEvents();
      if (shop && s.phase === 'playing') openShop();
      if (t - lastSave > 5000) save();
    }
  }
  const p = s.player, k = s.cd > 0 ? 1 - s.cd / STEP_TIME : 1;
  const pos = { x: p.px + (p.x - p.px) * k, y: p.py + (p.y - p.py) * k };
  follow(cam, pos.x + 0.5, pos.y + 0.5, renderer.view, s.size, flags.camera);
  renderer.draw(s, cam, pos, t / 1000);
  input.showShop(s.phase === 'playing' && s.inTown && isTouch() && !ui.current);
  ui.setHud(s, flags.debug ? { debug: `x ${p.x} y ${p.y} · tile ${s.world.tiles[p.y * s.size + p.x]} · ${Math.round(fps)} fps · seed ${s.seed}` } : {});
}

window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);
function onResize() {
  const v = renderer.resize();
  if (state) follow(cam, state.player.x + 0.5, state.player.y + 0.5, v, state.size, flags.camera);
}
input.onTouchChange(() => { if (state) ui.touchVisible(isTouch()); });
renderer.resize();
if (flags.debug) window.__gem = { get state() { return state; }, cam, renderer };
showTitle();
requestAnimationFrame(frame);
