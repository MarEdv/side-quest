// DOM overlays (browser only): the title, pause and end screens, the in-game HUD (chips, toasts) and the debug line.
// Everything dynamic is built from t() in the current language and rebuilt on every language switch.
import { CFG } from './config.js';
import { t, clock } from './i18n.js';
import { multiplier } from './game.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['title', 'pause', 'end'];

export function createUI(h) {
  const el = {
    time: $('hudTime'), score: $('hudScore'), mult: $('hudMult'), crashes: $('hudCrashes'), speed: $('hudSpeed'),
    toasts: $('toasts'), debug: $('debugLine'),
  };
  let current = null;
  const cache = new Map();
  // Writes only when the value changed (the HUD updates every frame).
  const set = (key, value, write) => { if (cache.get(key) !== value) { cache.set(key, value); write(value); } };
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
  $('resumeBtn').addEventListener('click', () => h.resume());
  $('soundBtn').addEventListener('click', () => h.toggleSound());
  $('quitBtn').addEventListener('click', () => h.quit());
  $('againBtn').addEventListener('click', () => h.start());
  $('endTitleBtn').addEventListener('click', () => h.quit());
  $('fastBtn').addEventListener('click', () => h.toggleFast());
  // Pause also reacts on pointerdown (a finger on the steer pad must not block it); `click` stays for Enter / Space.
  $('pauseBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); h.pause(); });
  $('pauseBtn').addEventListener('click', () => h.pause());

  const scoreList = (list, me = 0) => {
    if (!list.length) return `<p class="small">${esc(t('noScores'))}</p>`;
    return `<ol class="scores">${list.map((e, i) => `<li${me === i + 1 ? ' class="me"' : ''}>${esc(t('scoreRow', {
      score: e.score, stars: e.stars, difficulty: t(`diff_${e.difficulty}`) }))}${e.date ? ` <span class="small">${esc(e.date)}</span>` : ''}</li>`).join('')}</ol>`;
  };

  function renderTitle({ scores, length, controls, flags }) {
    $('bestScores').innerHTML = `<h3>${esc(t('scoresTitle', { length: t(`length_${length}`) }))}</h3>${scoreList(scores)}`;
    $('controlsHelp').textContent = controls;
    $('flagsLine').textContent = flags;
    $('flagsLine').hidden = !flags;
  }
  function renderPause(soundOn) { $('soundBtn').textContent = t(soundOn ? 'soundOn' : 'soundOff'); }
  function renderEnd({ summary: s, rank, list, debug, length, saved = true }) {
    const wrecked = s.endReason === 'wrecked';
    $('endTitle').textContent = t(wrecked ? 'endWrecked' : 'endDone');
    $('endText').textContent = t(wrecked ? 'endWreckedText' : 'endDoneText');
    $('endScore').textContent = s.score;
    $('endStars').textContent = '★'.repeat(s.stars) + '☆'.repeat(5 - s.stars);
    $('endStarsText').textContent = t('endStars', { n: s.stars });
    const stat = (label, value) => `<div>${esc(label)}<b>${esc(String(value))}</b></div>`;
    $('endStats').innerHTML = [
      stat(t('endDistance'), t('endDistanceValue', { km: (s.distance / 1000).toFixed(1) })),
      stat(t('endTopSpeed'), t('endTopSpeedValue', { n: Math.round(s.topSpeed * 3.6) })),
      stat(t('endNearMisses'), s.nearMisses), stat(t('endCrashes'), s.crashes),
    ].join('');
    $('endRank').textContent = debug ? t('debugRun') : rank ? t('newBest', { rank, length: t(`length_${length}`) }) : '';
    $('endNote').textContent = t('notSaved'); $('endNote').hidden = debug || saved; // storage unavailable: the rank lives in memory only
    $('endBest').innerHTML = debug ? '' : `<p class="small">${esc(t('scoresTitle', { length: t(`length_${length}`) }))}</p>${scoreList(list, rank)}`;
  }

  // ---- HUD
  function hudVisible(v) { $('hud').hidden = !v; }
  function resetHud() { cache.clear(); el.toasts.innerHTML = ''; }

  function hud(s, hood) {
    chip('time', el.time, '⏱', t('hudTime'), clock(s.duration - s.time));
    chip('score', el.score, '⭐', t('hudScore'), s.score);
    const mult = multiplier(s.streak);
    set('mult', mult, (m) => { el.mult.hidden = m < 2; el.mult.textContent = t('hudStreak', { n: m }); el.mult.className = 'chip hot'; });
    const hard = s.flags.crash === 'hard';
    chip('crashes', el.crashes, '💥', hard ? t('hudCrashesOf', { n: s.crashes, max: CFG.crash.hardLimit }) : t('hudCrashes'), hard ? '' : s.crashes);
    set('crashCls', s.crashes > 0 ? 'bad' : '', (v) => { el.crashes.className = `chip ${v}`; });
    set('speedShow', hood, (v) => { el.speed.hidden = !v; });
    if (hood) set('speed', Math.round(s.player.speed * 3.6), (v) => { el.speed.textContent = `🚗 ${v} ${t('hudSpeed')}`; });
  }

  // kind: 'good' | 'bad' | 'info'. At most 3 toasts at once, each fades after ~2.4 s.
  function toast(msg, kind = 'info') {
    const n = document.createElement('div');
    n.className = `toast ${kind}`; n.textContent = msg;
    el.toasts.appendChild(n);
    while (el.toasts.children.length > 3) el.toasts.firstChild.remove();
    setTimeout(() => n.classList.add('out'), 2200);
    setTimeout(() => n.remove(), 2700);
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
