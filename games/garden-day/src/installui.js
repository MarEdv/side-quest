// "Install app" screens (browser only, D-25): the main-menu button, the end-screen invitation and the iOS instructions.
// ctx.install: { kind(), inviteKind(), prompt(), snooze(), never() } from install.js.
import { t } from './i18n.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...kids) => {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...kids);
  return e;
};
// The iOS Share glyph: a box open at the top with an arrow leaving it.
const shareIcon = () => svg('svg', { viewBox: '0 0 24 24', width: 28, height: 28, class: 'shareicon', role: 'img', 'aria-label': t('share') },
  svg('g', { fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    svg('path', { d: 'M12 15V3' }), svg('path', { d: 'M8 7l4-4 4 4' }), svg('path', { d: 'M7 10H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2' })));

export function registerInstall(api, ctx, btn) {
  const { h } = api;
  const I = ctx.install;

  // Choosing Install: the native dialog straight away, or the iOS how-to screen.
  const doInstall = () => { if (I.kind() === 'native') I.prompt(); else if (I.kind() === 'ios-instructions') api.push('install-ios'); };

  api.register('install-ios', {
    build: (a) => h('div', { class: 'menu' },
      h('h2', {}, t('installTitle')),
      h('p', { class: 'tag' }, t('iosIntro')),
      h('ol', { class: 'steps' },
        h('li', {}, t('step1a'), h('span', { class: 'sicon' }, shareIcon(), h('b', {}, t('share'))), t('step1b')),
        h('li', {}, t('step2a'), h('b', {}, t('addHome')), t('step2b')),
        h('li', {}, t('step3a'), h('b', {}, t('add')), t('step3b'))),
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', 'data-autofocus': true, onclick: () => a.back() }, t('back')))),
  });

  // Main menu entry: null (nothing added) unless the browser can install or this is iOS, and the app is not running installed.
  const installButton = () => (I.kind() === 'none' ? null : btn(t('installApp'), doInstall));

  // Inline end-screen invitation: not a modal, so Play again / R / the touch overlay keep working under it.
  const inviteBlock = () => {
    if (I.inviteKind() === 'none') return null;
    return h('div', { class: 'invite', role: 'group', 'aria-label': t('installGroup') },
      h('p', { class: 'small' }, t('invite')),
      h('div', { class: 'row' },
        btn(t('installApp'), doInstall, { guard: true }),
        btn(t('notNow'), () => I.snooze(), { guard: true }),
        btn(t('neverAsk'), () => I.never(), { guard: true })));
  };
  return { installButton, inviteBlock };
}
