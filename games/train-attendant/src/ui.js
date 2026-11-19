// DOM overlays (browser only): the title, pause and end screens, the in-game HUD (chips, quest list, radio offer card,
// café picker, toasts). Everything dynamic is built from t() in the current language and rebuilt on every language switch.
import { CFG } from './config.js';
import { t, clock } from './i18n.js';
import { questKey } from './quests.js';
import { eta, nextStation } from './route.js';

export const QUEST_ICON = { rescue: '🚨', connection: '🔁', nervous: '😰', lost: '🧳', sick: '🤒' };
const ITEM_ICON = { coffee: '☕', snack: '🥪', water: '💧', kit: '🩹', bag: '🧳' };
const $ = (id) => document.getElementById(id);
const SCREENS = ['title', 'pause', 'end'];

export function createUI(h) {
  const el = {
    score: $('hudScore'), next: $('hudNext'), delay: $('hudDelay'), compl: $('hudComplaints'), carry: $('hudCarry'), lead: $('hudLead'),
    quests: $('quests'), offer: $('offer'), offerText: $('offerText'), offerBar: $('offerBar'), picker: $('picker'),
    toasts: $('toasts'), debug: $('debugLine'),
  };
  let current = null;
  const cache = new Map();
  // Writes only when the value changed (the HUD updates every frame).
  const set = (key, value, write) => { if (cache.get(key) !== value) { cache.set(key, value); write(value); } };
  const text = (key, node, value) => set(key, value, (v) => { node.textContent = v; });
  // A chip: icon, a label that narrow screens hide, a value.
  const chip = (key, node, icon, label, value) => set(key, `${icon}|${label}|${value}`, () => { node.innerHTML = `${icon} <span class="lbl">${esc(label)} </span>${esc(String(value))}`; });

  // ---- screens
  function show(name) {
    current = name;
    for (const s of SCREENS) $(s).hidden = s !== name;
    const first = { title: 'startBtn', pause: 'resumeBtn', end: 'againBtn' }[name];
    if (first) $(first).focus({ preventScroll: true });
  }
  function hide() { current = null; for (const s of SCREENS) $(s).hidden = true; document.activeElement?.blur?.(); }

  $('startBtn').addEventListener('click', () => h.start());
  $('pauseBtn').addEventListener('click', () => h.pause());
  $('resumeBtn').addEventListener('click', () => h.resume());
  $('soundBtn').addEventListener('click', () => h.toggleSound());
  $('quitBtn').addEventListener('click', () => h.quit());
  $('againBtn').addEventListener('click', () => h.start());
  $('endTitleBtn').addEventListener('click', () => h.quit());
  $('fastBtn').addEventListener('click', () => h.toggleFast());
  // Buttons that raise input edges react on pointerdown (works while another finger holds the walk pad).
  const press = (node, fn) => node.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); });
  press($('acceptBtn'), () => h.accept());
  press($('declineBtn'), () => h.decline());
  for (const b of el.picker.querySelectorAll('[data-pick]')) press(b, () => h.pick(b.dataset.pick));

  const scoreList = (list, me = 0) => {
    if (!list.length) return `<p class="small">${esc(t('noScores'))}</p>`;
    return `<ol class="scores">${list.map((e, i) => `<li${me === i + 1 ? ' class="me"' : ''}>${esc(t('scoreRow', {
      score: e.score, stars: e.stars, difficulty: t(`diff_${e.difficulty}`) }))}${e.date ? ` <span class="small">${esc(e.date)}</span>` : ''}</li>`).join('')}</ol>`;
  };

  function renderTitle({ scores, trip, controls, flags }) {
    $('bestScores').innerHTML = `<h3>${esc(t('scoresTitle', { trip: t(`trip_${trip}`) }))}</h3>${scoreList(scores)}`;
    $('controlsHelp').textContent = controls;
    $('flagsLine').textContent = flags;
    $('flagsLine').hidden = !flags;
  }
  function renderPause(soundOn) { $('soundBtn').textContent = t(soundOn ? 'soundOn' : 'soundOff'); }
  function renderEnd({ summary: s, rank, list, debug, trip }) {
    $('endScore').textContent = s.score;
    $('endStars').textContent = '★'.repeat(s.stars) + '☆'.repeat(5 - s.stars);
    $('endStarsText').textContent = t('endStars', { n: s.stars });
    const stat = (label, value) => `<div>${esc(label)}<b>${esc(String(value))}</b></div>`;
    $('endStats').innerHTML = [
      stat(t('endCarried'), s.carried), stat(t('endCalm'), `${Math.round(s.calmShare * 100)}%`), stat(t('endComplaints'), s.complaints),
      stat(t('endTime'), clock(s.time)), stat(t('endQuestsDone'), s.questsDone), stat(t('endQuestsFailed'), s.questsFailed),
      stat(t('endQuestsDeclined'), s.questsDeclined),
    ].join('');
    $('endRank').textContent = debug ? t('debugRun') : rank ? t('newBest', { rank, trip: t(`trip_${trip}`) }) : '';
    $('endBest').innerHTML = debug ? '' : `<p class="small">${esc(t('scoresTitle', { trip: t(`trip_${trip}`) }))}</p>${scoreList(list, rank)}`;
  }

  // ---- HUD
  function hudVisible(v) { $('hud').hidden = !v; }
  function resetHud() { cache.clear(); el.quests.innerHTML = ''; el.toasts.innerHTML = ''; el.offer.hidden = true; el.picker.hidden = true; }

  function nextText(s) {
    const r = s.route, name = r.stations[nextStation(r)];
    if (r.phase === 'dwell') return `🚉 ${t('hudStation', { station: name })} · ${clock(CFG.dwell - r.timer)}`;
    if (r.phase === 'stop') return `🛑 ${t('hudStopped')}`;
    return `🚉 ${t('hudNext', { station: name })} · ${t('hudEta', { time: clock(eta(r, nextStation(r))) })}`;
  }

  function questHtml(s) {
    return s.quests.active.map((q) => {
      let sub = '';
      if (q.remaining !== undefined) sub = t('hudDeadline', { n: Math.ceil(Math.max(0, q.remaining)) });
      else if (q.deadlineStation !== undefined) sub = t('hudStopsLeft', { station: s.route.stations[q.deadlineStation] });
      const bar = q.remaining !== undefined ? `<i style="width:${Math.max(0, Math.min(100, (q.remaining / CFG.quests.sick.limit) * 100)).toFixed(0)}%"></i>` : '';
      return `<li><b>${QUEST_ICON[q.type]} ${esc(t(questKey(q.type, 'title')))}</b>${esc(t(q.goal, q.vars))}<small>${esc(sub)}</small>${bar}</li>`;
    }).join('');
  }

  function hud(s) {
    chip('score', el.score, '⭐', t('hudScore'), s.score);
    text('next', el.next, nextText(s));
    const d = Math.round(s.route.delay);
    text('delay', el.delay, `⏱ ${d > 0 ? t('hudDelay', { n: d }) : t('hudOnTime')}`);
    set('delayCls', d > 15 ? 'bad' : d === 0 ? 'good' : '', (v) => { el.delay.className = `chip ${v}`; });
    chip('compl', el.compl, '😠', t('hudComplaints'), s.stats.complaints);
    chip('carry', el.carry, s.carried ? ITEM_ICON[s.carried] : '🤲', s.carried ? '' : t('hudEmpty'), s.carried ? t('item_' + s.carried) : '');
    set('leadShow', s.followers.length, (n) => { el.lead.hidden = !n; el.lead.textContent = `👣 ${t('hudFollowers', { n })}`; });
    set('quests', questHtml(s), (v) => { el.quests.innerHTML = v; });
    const o = s.quests.offer;
    set('offerId', o ? o.id : 0, () => { el.offer.hidden = !o; if (o) el.offerText.textContent = t(questKey(o.type, 'offer'), o.vars); });
    if (o) el.offerBar.style.width = `${Math.max(0, Math.min(100, (o.expires / CFG.quests.offerExpire) * 100)).toFixed(1)}%`;
    set('picker', s.picker.open, (v) => { el.picker.hidden = !v; });
  }

  // kind: 'good' | 'bad' | 'info'. At most 4 toasts at once, each fades after ~2.8 s.
  function toast(msg, kind = 'info') {
    const n = document.createElement('div');
    n.className = `toast ${kind}`; n.textContent = msg;
    el.toasts.appendChild(n);
    while (el.toasts.children.length > 4) el.toasts.firstChild.remove();
    setTimeout(() => n.classList.add('out'), 2400);
    setTimeout(() => n.remove(), 2900);
  }

  return {
    get current() { return current; },
    show, hide, renderTitle, renderPause, renderEnd, hudVisible, resetHud, hud, toast,
    setDebug(v) { el.debug.textContent = v; },
    showFast(v) { $('fastBtn').hidden = !v; },
    markFast(on) { $('fastBtn').classList.toggle('on', on); },
  };
}

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
