// DOM overlays and HUD (browser only): title, shop, pause, minimap, win. Keyboard and touch accessible; while an overlay
// is open its keydown handler runs first (capture) and stops the event, so no input reaches the game.
import { GEMS, DREAM, backpackValue, isObsolete } from './economy.js';
import { HATCHETS, bestTier } from './mining.js';
import { mapPixels } from './render.js';
import { formatTime } from './scores.js';
import { townDirection, dreamDirection } from './game.js';
import { t as T, num as n, gemName, hatchetShort, hatchetName, hatchetTitle, rockNames } from './i18n.js';

const $ = (id) => document.getElementById(id);

export function createUI(h) {
  const names = ['title', 'shop', 'pause', 'map', 'win'];
  const el = Object.fromEntries(names.map((n) => [n, $(n)]));
  let current = null;
  let last = {};
  // Texts use the current language (P-5). Static texts carry data-i18n* attributes, which main.js applies through
  // src/kit/langdom.js; everything built here is rebuilt in the current language by the next render call.

  const focusables = (root) => [...root.querySelectorAll('button:not(:disabled), a[href]')].filter((b) => !b.closest('[hidden]'));

  function show(name, { focus } = {}) {
    for (const n of names) el[n].hidden = n !== name;
    current = name;
    const f = (focus && $(focus)) || focusables(el[name])[0];
    if (f) f.focus({ preventScroll: true });
    el[name].scrollTop = 0;
  }
  function hide() {
    for (const n of names) el[n].hidden = true;
    current = null;
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  }

  window.addEventListener('keydown', (e) => {
    if (!current) return;
    // Everything is handled here and never reaches input.js.
    const k = e.key;
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); h.escape(current); return; }
    if (k === 'm' || k === 'M') { if (current === 'map') { e.preventDefault(); e.stopPropagation(); h.escape('map'); } return; }
    if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'ArrowRight' || k === 'ArrowLeft' || k === 'Tab') {
      if (k === 'Tab') { e.stopPropagation(); return; } // native tab order, kept inside by the stop
      e.preventDefault(); e.stopPropagation();
      const list = focusables(el[current]); if (!list.length) return;
      const i = list.indexOf(document.activeElement);
      const dir = (k === 'ArrowDown' || k === 'ArrowRight') ? 1 : -1;
      list[(i + dir + list.length) % list.length].focus();
      return;
    }
    e.stopPropagation();
  }, true);

  // ---- static buttons ----
  const on = (id, fn) => $(id).addEventListener('click', (e) => { e.preventDefault(); fn(); });
  on('continueBtn', () => h.continueGame());
  on('newBtn', () => h.newGame());
  on('scoresBtn', () => { const b = $('bestTimes'); b.hidden = !b.hidden; });
  on('resumeBtn', () => h.resume());
  on('pauseMapBtn', () => h.openMap());
  on('soundBtn', () => h.toggleSound());
  on('quitBtn', () => h.quit());
  on('shopClose', () => h.closeShop());
  on('sellAllBtn', () => h.sellAll());
  on('mapClose', () => h.escape('map'));
  on('againBtn', () => h.newGame());
  on('winTitleBtn', () => h.toTitle());
  on('mapBtn', () => h.openMap());
  on('pauseBtn', () => h.pause());

  // ---- title ----
  // Built with textContent: the entries come from localStorage, which every game on this origin can write (D24).
  const node = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
  function fillTimes(box, size, list, mineIndex = -1) {
    box.replaceChildren(node('h3', T('timesTitle', { size })));
    if (!list.length) { box.append(node('p', T('noTimes'), 'small')); return; }
    const ol = node('ol', undefined, 'times');
    list.forEach((e, i) => {
      const li = node('li', undefined, i === mineIndex ? 'me' : '');
      li.append(node('span', `${i + 1}.`), node('b', formatTime(e.time)), node('span', e.date || '', 'small'));
      ol.append(li);
    });
    box.append(ol);
  }
  function renderTitle({ hasSave, scores, size, controls, flags, saveInfo, focus = null }) {
    $('continueBtn').hidden = !hasSave;
    $('newBtn').textContent = T('newGame');
    $('continueBtn').textContent = hasSave && saveInfo ? T('continueInfo', { info: saveInfo }) : T('continue');
    fillTimes($('bestTimes'), size, scores);
    $('bestTimes').hidden = !scores.length;
    $('controlsHelp').textContent = controls;
    $('flagsLine').textContent = flags;
    show('title', { focus: focus || (hasSave ? 'continueBtn' : 'newBtn') });
  }

  // ---- shop ----
  function renderShop(s, msg = '', keepFocus = null) {
    const inv = s.inv;
    $('shopCoins').textContent = T('shopCoins', { n: n(inv.coins) });
    // innerHTML here only interpolates constants (i18n.js) and numbers (restore() validates every stored count as a number).
    const gems = GEMS.filter((g) => inv.gems[g.id] > 0);
    $('shopGems').innerHTML = gems.length ? gems.map((g) => {
      const gem = gemName(g.id);
      return `
      <div class="row"><span class="dot" style="background:${g.color}"></span>
        <span class="name">${gem} × ${inv.gems[g.id]}<small>${T('each', { n: n(g.value) })}</small></span>
        <button data-sell="${g.id}" data-k="sell1-${g.id}" aria-label="${T('sell1Aria', { gem })}">${T('sell1')}</button>
        <button data-sellall="${g.id}" data-k="sellall-${g.id}" aria-label="${T('sellAllGemAria', { gem })}">${T('sellAllGem')}</button></div>`;
    }).join('')
      : `<p class="small">${T('emptyBackpack')}</p>`;
    if (inv.dream) $('shopGems').insertAdjacentHTML('beforeend', `<div class="row"><span class="name">${gemName(DREAM.id)}<small>${T('notForSale')}</small></span></div>`);
    const sellAll = $('sellAllBtn');
    sellAll.disabled = !gems.length;
    sellAll.textContent = gems.length ? T('sellAllValue', { n: n(backpackValue(inv)) }) : T('sellAll');
    const best = bestTier(inv.hatchets);
    $('shopHatchets').innerHTML = HATCHETS.map((hd, t) => {
      const cuts = rockNames(hd.power);
      const owned = inv.hatchets[t];
      const price = s.prices[t];
      const need = price - inv.coins;
      const worse = !owned && t > 0 && isObsolete(inv, t, !!s.flags.durability);
      const status = t === 0 ? T('alwaysYours') : owned ? (t === best ? T('ownedInUse') : T('owned')) : worse ? T('notNeededLong') : null;
      const dur = s.flags.durability && owned && t > 0 ? T('blocksLeft', { n: n(inv.dur[t]) }) : '';
      const btn = t === 0 ? '' : owned ? `<button disabled>${T('owned')}</button>` : worse ? `<button disabled>${T('notNeeded')}</button>`
        : `<button data-buy="${t}" data-k="buy-${t}" aria-label="${T('buyAria', { hatchet: hatchetName(hd.id), n: n(price) })}"${need > 0 ? ' class="poor"' : ''}>${n(price)} 🪙</button>`;
      return `<div class="row"><span class="name">🪓 ${hatchetTitle(hd.id)}<small>${T('cuts', { rocks: cuts })}${dur}${status ? ' · ' + status : need > 0 ? ` · ${T('needMore', { n: n(need) })}` : ''}</small></span>${btn}</div>`;
    }).join('');
    $('shopMsg').textContent = msg;
    if (current !== 'shop') show('shop', { focus: 'shopClose' });
    else if (keepFocus) { const f = el.shop.querySelector(`[data-k="${keepFocus}"]`) || $('shopClose'); f.focus({ preventScroll: true }); }
  }
  el.shop.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const k = b.dataset.k || b.id;
    if (b.dataset.sell) h.sell(b.dataset.sell, 1, k);
    else if (b.dataset.sellall) h.sell(b.dataset.sellall, Infinity, k);
    else if (b.dataset.buy) h.buy(Number(b.dataset.buy), k);
  });

  // ---- pause / map / win ----
  function renderPause(s, soundOn) {
    $('pauseStats').textContent = T('pauseStats', { time: formatTime(s.stats.time), blocks: n(s.stats.blocks), gems: n(s.stats.gems) });
    $('soundBtn').textContent = T(soundOn ? 'soundOn' : 'soundOff');
    show('pause', { focus: 'resumeBtn' });
  }
  function renderMap(s) {
    const size = s.world.size, cv = $('mapCanvas');
    cv.width = size; cv.height = size;
    const c = cv.getContext('2d');
    c.putImageData(new ImageData(mapPixels(s), size, size), 0, 0);
    const r = Math.max(2, size / 70), tw = s.world.town;
    c.strokeStyle = '#ffd34d'; c.lineWidth = Math.max(1, size / 200);
    c.strokeRect(tw.x - tw.r, tw.y - tw.r, tw.r * 2, tw.r * 2);
    if (s.inv.hatchets[3]) {
      const d = s.world.dream; c.fillStyle = '#fff'; c.strokeStyle = '#06f';
      c.beginPath(); c.moveTo(d.x, d.y - r * 1.4); c.lineTo(d.x + r, d.y); c.lineTo(d.x, d.y + r * 1.4); c.lineTo(d.x - r, d.y); c.closePath(); c.fill(); c.stroke();
    }
    c.fillStyle = '#ff3b3b'; c.strokeStyle = '#fff'; c.lineWidth = Math.max(1, size / 200);
    c.beginPath(); c.arc(s.player.x + 0.5, s.player.y + 0.5, r, 0, Math.PI * 2); c.fill(); c.stroke();
    show('map', { focus: 'mapClose' });
  }
  function renderWin(s, scores, rank, debug) {
    const st = s.stats;
    $('winStats').replaceChildren(...[[formatTime(st.time), T('statTime')], [n(st.gems), T('statGems')],
      [n(st.coinsEarned), T('statCoins')], [n(st.blocks), T('statBlocks')]]
      .map(([v, label]) => { const d = node('div'); d.append(node('b', v), label); return d; }));
    $('winRank').textContent = debug ? T('debugRun') : rank ? T('newBest', { rank, size: s.size }) : '';
    fillTimes($('winBest'), s.size, scores, rank ? rank - 1 : -1);
    show('win', { focus: 'againBtn' });
  }

  // ---- HUD ----
  let hudKey = '';
  function setHud(s, extra = {}) {
    const best = bestTier(s.inv.hatchets), hd = HATCHETS[best];
    const gems = GEMS.filter((g) => s.inv.gems[g.id] > 0).map((g) => `${g.id}${s.inv.gems[g.id]}`).join(',');
    const town = townDirection(s), dream = dreamDirection(s);
    const key = [s.inv.coins, best, s.flags.durability ? s.inv.dur[best] : '', gems, town.dist, town.arrow, dream && dream.dist, dream && dream.arrow, s.hint, extra.debug || ''].join('|');
    if (key === hudKey) return;
    hudKey = key;
    $('hudCoins').textContent = `🪙 ${n(s.inv.coins)}`;
    $('hudHatchet').textContent = `🪓 ${hatchetShort(hd.id)}${s.flags.durability && best > 0 ? ` (${s.inv.dur[best]})` : ''}`;
    $('hudNav').textContent = [town.dist ? T('town', { arrow: town.arrow, dist: town.dist }) : T('inTown'), dream ? `💎 ${dream.arrow || '·'} ${dream.dist}` : ''].filter(Boolean).join('  ');
    $('hudGems').replaceChildren(...GEMS.filter((g) => s.inv.gems[g.id] > 0).map((g) => {
      const sp = node('span', undefined, 'g'), dot = node('span', undefined, 'dot');
      dot.style.background = g.color; sp.append(dot, String(s.inv.gems[g.id])); return sp;
    }));
    const t = $('toast');
    if (s.hint) { t.textContent = s.hint; t.classList.add('show'); } else t.classList.remove('show');
    $('debugLine').textContent = extra.debug || '';
  }
  const hudVisible = (v) => { $('hud').hidden = !v; $('hudBtns').hidden = !v; };
  const touchVisible = (v) => { $('touch').hidden = !v; };

  return {
    // First tap on New game while a save exists: ask for a second one (main.js decides when).
    armNewGame() { const b = $('newBtn'); b.textContent = T('newGameArmed'); b.focus({ preventScroll: true }); },
    show, hide, renderTitle, renderShop, renderPause, renderMap, renderWin, setHud, hudVisible, touchVisible,
    get current() { return current; },
    resetHud() { hudKey = ''; $('toast').classList.remove('show'); },
    setLast(x) { last = x; }, get last() { return last; },
  };
}
