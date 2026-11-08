// DOM menu overlay (browser only, D-20/D-21). A tiny screen system: screens are registered by name with a build()
// function; `phase` links a root screen to a game phase ('title' = menu shown, 'paused', 'won'/'lost'), and
// push()/back() navigate sub-screens (e.g. High scores on top of the main menu). Later features register more
// screens (settings, levels, install) with ui.register(). The game itself never sees menu input (uimodel.gateInput).
import { moveFocus, rankText, bestText, formatDate } from './uimodel.js';
import { registerSettings } from './settingsui.js';

export const END_GUARD_MS = 700; // end-screen buttons ignore clicks this long after the game ends (mashed WORK/Space)

function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c);
  return e;
}

// ctx: { actions: {play, resume, quit, again}, scores, settings (see settingsui.js), persistent(), controlsText(), summary(), isTouch(), now() }
export function createUI(ctx, root = document.body) {
  const host = h('div', { class: 'ui', hidden: true });
  root.appendChild(host);
  const screens = new Map();
  let stack = [], phase = null, endResult = null, shownAt = 0, layout = null, local = {};

  const current = () => (stack.length ? screens.get(stack[stack.length - 1]) : null);
  const focusables = () => [...host.querySelectorAll('button:not([disabled]):not([hidden]), input:not([disabled]), select:not([disabled])')];

  function render(focusSel) {
    const def = current();
    host.textContent = '';
    host.hidden = !def;
    if (!def) return;
    host.dataset.screen = stack[stack.length - 1];
    host.dataset.kind = def.kind || 'page';
    const panel = def.build(api);
    panel.classList.add('ui-panel');
    host.appendChild(panel);
    place(panel, def);
    const target = (focusSel && host.querySelector(focusSel)) || host.querySelector('[data-autofocus]') || focusables()[0];
    if (target) target.focus({ preventScroll: true });
  }
  // Dock panels (pause / end) sit over the lower part of the game canvas, or below it in portrait.
  function place(panel, def) {
    if (!layout || def.kind !== 'dock') return;
    const { L, chrome } = layout;
    panel.style.top = panel.style.bottom = '';
    if (L.portrait) panel.style.top = `${chrome.rotateTop + 44}px`;
    else if (def.dock === 'bottom') panel.style.bottom = `${Math.max(6, innerHeight - (L.top + L.height) + 8)}px`;
    else panel.style.top = `${L.top + L.height * 0.64}px`;
  }

  const api = {
    ctx,
    h,
    get local() { return local; },
    register(name, def) { screens.set(name, def); },
    push(name) { stack.push(name); local = {}; render(); },
    back() { if (stack.length > 1) { stack.pop(); local = {}; render(); } },
    refresh(focusSel) { render(focusSel); },
    get endResult() { return endResult; },
    setEndResult(r) { endResult = r; },
    // Called by main when the game phase changes.
    setPhase(p) {
      phase = p;
      const root0 = [...screens.entries()].find(([, d]) => d.phase === p);
      stack = root0 ? [root0[0]] : [];
      local = {}; shownAt = ctx.now();
      render();
    },
    setLayout(L, chrome) { layout = { L, chrome }; const def = current(); const panel = host.firstChild; if (def && panel) place(panel, def); },
    get open() { return !host.hidden; },
    get modal() { return !host.hidden && stack.length > 1; }, // a sub-screen is on top: it owns the keyboard
    get phase() { return phase; },
    guardOk: () => ctx.now() - shownAt >= END_GUARD_MS,
  };

  const btn = (label, onClick, opts = {}) => h('button', {
    type: 'button', class: `btn${opts.primary ? ' primary' : ''}`, disabled: !!opts.disabled,
    'data-autofocus': opts.autofocus, onclick: (e) => { if (opts.guard && !api.guardOk()) { e.preventDefault(); return; } onClick(e); },
  }, label);

  // ----- keyboard (capture phase so it runs before the game's own listeners) -----
  window.addEventListener('keydown', (e) => {
    if (host.hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    const def = current();
    if (e.code === 'Escape') {
      if (def && def.onEsc && def.onEsc(api)) { e.preventDefault(); return; }
      if (stack.length > 1) { e.preventDefault(); api.back(); }
      return; // pause / end: Esc is the game's pause key
    }
    // Auto-repeat of a key held since the game (WORK on Space, D-22) must not activate the newly focused button.
    if (e.repeat && (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter')) { e.preventDefault(); return; }
    if (!e.key.startsWith('Arrow') && e.key !== 'Tab' && e.key !== 'Enter' && e.code !== 'Space') return;
    const ae = document.activeElement;
    // Selects and text / number inputs keep their own arrow keys (change the option, step the number, move the caret); Tab leaves them.
    if (e.key.startsWith('Arrow') && ae && (ae.tagName === 'SELECT' || (ae.tagName === 'INPUT' && ae.type !== 'checkbox'))) return;
    const items = focusables();
    const idx = items.indexOf(document.activeElement);
    if (idx < 0 && items.length && e.key !== 'Tab') { // focus got lost (clicked the backdrop): grab it back
      e.preventDefault(); items[e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? items.length - 1 : 0].focus(); return;
    }
    if (e.key.startsWith('Arrow') && items.length) {
      e.preventDefault();
      items[moveFocus(items.length, idx, e.key)].focus();
    } else if (e.key === 'Tab' && items.length) { // keep Tab inside the menu
      e.preventDefault();
      items[(idx + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
    }
  }, true);

  const A = ctx.actions;

  // ----- screens -----
  api.register('main', {
    phase: 'title',
    build: () => h('div', { class: 'menu' },
      h('h1', {}, 'SIDE QUEST'),
      h('p', { class: 'tag' }, 'Finish the garden before sunset. Your wife has other plans.'),
      h('div', { class: 'col' },
        btn('Play', () => A.play(), { primary: true, autofocus: true }),
        btn('Settings', () => api.push('settings')),
        btn('High scores', () => api.push('scores'))),
      h('p', { class: 'small' }, ctx.controlsText()),
      h('p', { class: 'small dim' }, `Mode: ${ctx.summary()}`)),
  });

  api.register('scores', {
    onEsc: (a) => { if (a.local.confirm) { a.local.confirm = false; a.refresh(); return true; } return false; },
    build: (a) => {
      const list = ctx.scores.arcade();
      const body = list.length
        ? h('div', { class: 'ui-scroll' }, h('table', { class: 'scores' },
          h('thead', {}, h('tr', {}, ['#', 'Score', 'Result', 'Date', 'Mode'].map((t) => h('th', {}, t)))),
          h('tbody', {}, list.map((e, i) => h('tr', {},
            h('td', {}, String(i + 1)), h('td', { class: 'num' }, String(e.score)),
            h('td', {}, e.won ? 'Won' : 'Lost'), h('td', {}, formatDate(e.date)), h('td', { class: 'dim' }, e.summary))))))
        : h('p', { class: 'tag' }, 'No scores yet. Finish a day to get on the board.');
      const actions = a.local.confirm
        ? [h('p', { class: 'warn' }, 'Clear all saved scores? This cannot be undone.'),
          h('div', { class: 'row' },
            btn('Yes, clear', () => { ctx.scores.clearAll(); a.local.confirm = false; a.refresh('[data-back]'); }),
            btn('Cancel', () => { a.local.confirm = false; a.refresh(); }, { primary: true, autofocus: true }))]
        : [h('div', { class: 'row' },
          btn('Clear scores', () => { a.local.confirm = true; a.refresh(); }, { disabled: !list.length }),
          h('button', { type: 'button', class: 'btn primary', 'data-back': true, 'data-autofocus': true, onclick: () => a.back() }, 'Back'))];
      return h('div', { class: 'menu' }, h('h2', {}, 'High scores'), body,
        ctx.persistent() ? null : h('p', { class: 'small dim' }, 'Storage is blocked here: scores last only until you close the page.'),
        actions);
    },
  });

  api.register('pause', {
    phase: 'paused', kind: 'dock',
    build: () => h('div', { class: 'row' },
      btn('Resume', () => A.resume(), { primary: true, autofocus: true }),
      btn('Settings', () => api.push('settings')),
      btn('Quit to menu', () => A.quit())),
  });

  registerSettings(api, ctx, btn);

  const endScreen = {
    kind: 'dock', dock: 'bottom',
    build: () => {
      const r = api.endResult;
      const line = [rankText(r), bestText(r), r && r.note].filter(Boolean).join('  ·  ');
      return h('div', { class: 'endp' },
        line ? h('p', { class: `banner${r && r.isBest ? ' hi' : ''}` }, line) : null,
        h('div', { class: 'row' },
          btn(ctx.isTouch() ? 'Play again' : 'Play again (R)', () => A.again(), { primary: true, autofocus: true, guard: true }),
          btn('Menu', () => A.quit(), { guard: true })));
    },
  };
  api.register('end-won', { ...endScreen, phase: 'won' });
  api.register('end-lost', { ...endScreen, phase: 'lost' });

  return api;
}
