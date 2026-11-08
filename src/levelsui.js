// Level select and level intro screens (browser only; Features 4 & 5). Built on the ui.js screen system.
// ctx.levels: { list, records(), isUnlocked(i), start(id), flagsText(level) } from main.js.
import { levelCard } from './uimodel.js';

export function registerLevels(api, ctx, btn) {
  const { h } = api;
  const L = ctx.levels;
  let chosen = null; // id of the level whose intro card is open

  // Opens the intro card for a level (used by the select screen and by "Next level").
  api.openLevelIntro = (id) => { chosen = id; api.push('level-intro'); };

  api.register('levels', {
    build: (a) => {
      const recs = L.records();
      const cards = L.list.map((lvl, i) => {
        const unlocked = L.isUnlocked(i);
        const c = levelCard(lvl, i, recs[lvl.id], unlocked, i > 0 ? L.list[i - 1].name : '');
        return h('button', {
          type: 'button', class: `lcard${c.locked ? ' locked' : ''}${c.won ? ' won' : ''}`, disabled: c.locked, 'data-level': lvl.id,
          'data-autofocus': unlocked && i === firstOpen(recs), 'aria-label': `${c.title}. ${c.locked ? c.lockText : `${c.won ? 'Won. ' : ''}${c.bestText}`}`,
          onclick: () => a.openLevelIntro(lvl.id),
        },
        h('span', { class: 'lhead' }, h('span', { class: 'lname' }, c.title),
          c.locked ? h('span', { class: 'lbadge lock' }, '\u{1F512} Locked') : c.won ? h('span', { class: 'lbadge won' }, '✓ Won') : null),
        h('span', { class: 'lbrief' }, c.briefing),
        h('span', { class: 'lbest' }, c.locked ? c.lockText : c.bestText));
      });
      return h('div', { class: 'menu levels' }, h('h2', {}, 'Levels'),
        h('div', { class: 'ui-scroll lscroll' }, h('div', { class: 'lgrid' }, cards)),
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', 'data-back': true, onclick: () => a.back() }, 'Back')));
    },
  });
  // The level to focus when the list opens: the furthest unlocked level that has not been won yet (else the last one).
  function firstOpen(recs) {
    for (let i = 0; i < L.list.length; i++) if (L.isUnlocked(i) && !(recs[L.list[i].id] && recs[L.list[i].id].won)) return i;
    return L.list.length - 1;
  }

  api.register('level-intro', {
    build: (a) => {
      const i = L.list.findIndex((l) => l.id === chosen);
      const lvl = L.list[i];
      if (!lvl) { queueMicrotask(() => a.back()); return h('div'); }
      const rec = L.records()[lvl.id];
      return h('div', { class: 'menu intro' },
        h('p', { class: 'small dim' }, `Level ${i + 1} of ${L.list.length}`),
        h('h2', {}, lvl.name),
        h('p', { class: 'tag' }, lvl.briefing),
        h('p', { class: 'small dim' }, L.flagsText(lvl)),
        rec && rec.best != null ? h('p', { class: 'small' }, `Best: ${rec.best}${rec.won ? '  ·  ✓ won' : ''}`) : null,
        h('div', { class: 'row' },
          btn('Start', () => L.start(lvl.id), { primary: true, autofocus: true }),
          h('button', { type: 'button', class: 'btn', 'data-back': true, onclick: () => a.back() }, 'Back')));
    },
  });
}
