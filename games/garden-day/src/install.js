// Browser glue for "install as an app" (D-25): collects the platform facts, stashes beforeinstallprompt, registers the
// service worker, persists the player's choices. All decisions are in installmodel.js.
import {
  installKind, inviteKind, detectIOS, detectStandalone, createInstallStore,
  withFinishedDay, withSnooze, withNeverAsk, withInstalled,
} from './installmodel.js';

// Relative URL: resolves against the page, so the worker's scope is the game's own folder (on Pages: /side-quest/games/garden-day/).
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const reg = () => navigator.serviceWorker.register('sw.js').catch(() => { /* cosmetic: the game works without it */ });
  if (document.readyState === 'complete') reg(); else window.addEventListener('load', reg, { once: true });
}

// ctx: { storage, isTouch(): bool, now(): ms epoch, onChange(): re-render menus }
export function createInstall(ctx) {
  const store = createInstallStore(ctx.storage);
  let state = store.load();
  let deferred = null;       // the stashed beforeinstallprompt event (each can be used once)
  let inviteOpen = false;    // the end-screen invitation is showing
  let sessionInvited = false; // at most one invitation per page visit
  const isIOS = detectIOS({ userAgent: navigator.userAgent, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints || 0 });

  const standalone = () => detectStandalone({
    navStandalone: navigator.standalone === true,
    standaloneMQ: !!window.matchMedia && matchMedia('(display-mode: standalone)').matches,
    fullscreenMQ: !!window.matchMedia && matchMedia('(display-mode: fullscreen)').matches,
    // The device, not the ?touch= flag: a touch screen or a coarse pointer.
    touchHardware: (navigator.maxTouchPoints || 0) > 0 || (!!window.matchMedia && matchMedia('(pointer: coarse)').matches),
    referrer: document.referrer,
  });
  const facts = () => ({
    isTouch: ctx.isTouch(), isStandalone: standalone(), hasDeferredPrompt: !!deferred, isIOS, installed: state.installed,
    dismissedUntil: state.dismissedUntil, neverAsk: state.neverAsk, finishedDays: state.finishedDays, now: ctx.now(),
  });
  const update = (s) => { state = s; store.save(state); };
  const changed = () => ctx.onChange();

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep the mini-infobar away; we prompt from our own button
    deferred = e;
    if (state.installed) update(withInstalled(state, false)); // the browser offers it again: it was uninstalled
    changed();
  });
  window.addEventListener('appinstalled', () => { deferred = null; inviteOpen = false; update(withInstalled(state, true)); changed(); });

  return {
    kind: () => installKind(facts()),
    inviteKind: () => (inviteOpen ? installKind(facts()) : 'none'), // the rules were checked when it opened
    // A day just finished (won / lost): count it and open the invitation if the rules allow and none was shown yet this visit.
    dayFinished() {
      update(withFinishedDay(state));
      if (!sessionInvited && inviteKind(facts()) !== 'none') { inviteOpen = true; sessionInvited = true; }
    },
    closeInvite() { inviteOpen = false; },
    snooze() { inviteOpen = false; update(withSnooze(state, ctx.now())); changed(); },
    never() { inviteOpen = false; update(withNeverAsk(state)); changed(); },
    // Native prompt; must be called from a user gesture. A refusal counts as "Not now".
    async prompt() {
      const ev = deferred;
      if (!ev) return 'none';
      deferred = null; // single use
      inviteOpen = false;
      let outcome = 'dismissed';
      try { await ev.prompt(); outcome = (await ev.userChoice).outcome; } catch { /* prompt refused */ }
      if (outcome !== 'accepted') update(withSnooze(state, ctx.now()));
      changed();
      return outcome;
    },
    get isIOS() { return isIOS; },
  };
}
