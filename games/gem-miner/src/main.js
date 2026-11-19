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
import { i18n, t as T, num, hatchetName } from './i18n.js';
import { setupLang } from './kit/langdom.js';

const flags = parseFlags(location.search);
let backend = null;
try { backend = window.localStorage; } catch { /* blocked storage: play in memory */ }
const storage = createStorage(backend);
const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const audio = createAudio({ enabled: flags.sound });
const cam = createCamera();
let state = null, newArmed = false, mapFrom = 'play', persistAsked = false, lastSave = 0, soundOn = flags.sound;

const input = createInput({ touchMode: flags.touch, scheme: flags.touchScheme, isBlocked: () => ui.current !== null || !state });

const ui = createUI({
  continueGame, newGame, resume, pause, quit, toggleSound, openMap: () => openMap(),
  closeShop: () => resume(), sellAll: doSellAll, sell: doSell, buy: doBuy,
  escape(name) {
    if (name === 'shop' || name === 'pause') resume();
    else if (name === 'map') { if (mapFrom === 'pause') ui.renderPause(state, soundOn); else resume(); }
  },
  toTitle: () => { state = null; showTitle(); },
});

// Language (P-5, D31): ?lang= from the launcher, else the saved choice, else the browser's; a ?lang= is remembered.
// The kit applies the page's data-i18n* texts; a switch on the title screen redraws it, focus kept on the pressed button.
const lang = setupLang(i18n, {
  storage, key: 'lang',
  onChange(l) { ui.resetHud(); showTitle(titleNote, `lang-${l}`); },
});
lang.bindSwitch(document.getElementById('langSwitch'));
lang.apply();

const isTouch = () => input.touchActive();
const controlsText = () => T(isTouch() ? 'controlsTouch' : 'controlsKeys');
const flagsText = () => {
  const bits = [];
  if (flags.seed !== null) bits.push(T('flagSeed', { n: flags.seed }));
  if (flags.worldSize !== 256) bits.push(T('flagWorld', { n: flags.worldSize }));
  if (flags.camera !== 'deadzone') bits.push(T('flagCamera'));
  if (!flags.fog) bits.push(T('flagFog'));
  if (flags.durability) bits.push(T('flagWear'));
  if (flags.debug) bits.push(T('flagDebug'));
  return bits.length ? T('flags', { list: bits.join(' · ') }) : '';
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
// `note` replaces the controls help (a message key); `focus` keeps focus on that element instead of the default button.
let titleNote = '';
function showTitle(note = '', focus = null) {
  titleNote = note;
  ui.hudVisible(false); ui.touchVisible(false); input.showShop(false);
  newArmed = false;
  const d = peekSave();
  // Continue always resumes the saved world as it was started; world flags in the URL apply to New game (D25).
  const differs = d && ((flags.seed !== null && flags.seed !== d.seed) || flags.worldSize !== d.size);
  const fl = [flagsText(), differs ? T('saveDiffers', { size: d.size }) : '']
    .filter(Boolean).join(' · ');
  ui.renderTitle({
    hasSave: !!d, saveInfo: d ? `${formatTime(d.t)}, ${d.size} × ${d.size}` : '',
    scores: scoresFor(storage.get('scores'), flags.worldSize), size: flags.worldSize,
    controls: titleNote ? T(titleNote) : controlsText(), flags: fl, focus,
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
  // Starting over replaces the saved game, so the title asks for a second tap first (D25). Debug runs never touch it.
  if (ui.current === 'title' && !flags.debug && peekSave() && !newArmed) { newArmed = true; ui.armNewGame(); return; }
  newArmed = false;
  const seed = flags.seed !== null ? flags.seed : randomSeed();
  state = createGame({ seed, size: flags.worldSize, flags });
  if (!flags.debug) storage.remove('save');
  save();
  enterPlay();
}
function continueGame() {
  const s = restore(storage.get('save'), flags);
  if (!s) { storage.remove('save'); showTitle('badSave'); return; }
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
  ui.renderShop(state, r.ok ? T('soldFor', { n: num(r.coins) }) : T('nothingToSell'), key);
}
function doSellAll() {
  const r = sellAll(state);
  flushEvents();
  ui.renderShop(state, r.ok ? T('soldGems', { count: num(r.count), n: num(r.coins) }) : T('backpackEmpty'), 'sellAllBtn');
}
function doBuy(tier, key) {
  const r = buyHatchet(state, tier);
  flushEvents();
  const hatchet = hatchetName(HATCHETS[tier].id);
  const msg = r.ok ? T('bought', { hatchet }) : r.reason === 'poor' ? T('poor', { n: num(r.need), hatchet }) : r.reason === 'owned' ? T('alreadyOwned') : r.reason === 'worse' ? T('alreadyBetter') : T('cannotBuy');
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
    else if (e.type === 'atShop') say(state, T(isTouch() ? 'atShopTouch' : 'atShopKeys'), 'atShop');
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
// A DPR change without a resize (window dragged to another screen) would leave the canvas blurry: watch it too.
(function watchDpr() {
  try {
    const mq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    mq.addEventListener('change', () => { onResize(); watchDpr(); }, { once: true });
  } catch { /* old browsers: resize still covers zoom */ }
})();
function onResize() {
  const v = renderer.resize();
  if (state) follow(cam, state.player.x + 0.5, state.player.y + 0.5, v, state.size, flags.camera);
}
input.onTouchChange(() => { if (state) ui.touchVisible(isTouch()); });
renderer.resize();
// Inspection hook for scripted browser checks (D36): `window.__game` in every game; `window.__gem` is the old name, kept.
if (flags.debug) window.__game = window.__gem = { get state() { return state; }, cam, renderer };
showTitle();
requestAnimationFrame(frame);
