// Pure decision logic for the "install as an app" feature (I-1..I-3, D-25). No DOM, no storage backend: the browser
// module src/install.js gathers the facts and calls these.

export const SNOOZE_DAYS = 7;
export const SNOOZE_MS = SNOOZE_DAYS * 24 * 60 * 60 * 1000;

// What can be offered: 'native' (a stashed beforeinstallprompt event: Chrome / Edge / Samsung Internet on Android, desktop
// Chromium), 'ios-instructions' (iOS / iPadOS have no API: show Share > Add to Home Screen), or 'none'. Already running as an
// app, or known to be installed (the appinstalled event), is always 'none'.
export function installKind(f) {
  if (f.isStandalone || f.installed) return 'none';
  if (f.hasDeferredPrompt) return 'native';
  if (f.isIOS) return 'ios-instructions';
  return 'none';
}

// Whether to invite after a finished day: only on touch devices, only after at least one finished day, never when
// the player said "Don't ask again", not before the "Not now" snooze ran out, and only when something can be offered.
export function inviteKind(f) {
  const kind = installKind(f);
  if (kind === 'none' || !f.isTouch || f.neverAsk) return 'none';
  if ((f.finishedDays || 0) < 1) return 'none';
  if (f.dismissedUntil && f.now < f.dismissedUntil) return 'none';
  return kind;
}

// iPhone / iPod / iPad report themselves in the UA; iPadOS 13+ asks for the desktop site and says "Macintosh", so a Mac
// with touch points (a real Mac has none) is an iPad.
export function detectIOS({ userAgent = '', platform = '', maxTouchPoints = 0 } = {}) {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  return (platform === 'MacIntel' || /Macintosh/.test(userAgent)) && maxTouchPoints > 1;
}

// Already launched as an installed app? navigator.standalone is iOS only; display-mode is everyone else. A WebKit bug
// reports fullscreen where standalone was expected, so both modes count.
export function detectStandalone({ navStandalone = false, standaloneMQ = false, fullscreenMQ = false, referrer = '' } = {}) {
  return !!(navStandalone || standaloneMQ || fullscreenMQ || String(referrer).startsWith('android-app://'));
}

// ----- persisted state (sidequest.v1.install) -----
export const defaultInstall = () => ({ v: 1, finishedDays: 0, dismissedUntil: 0, neverAsk: false, installed: false });

export function sanitizeInstall(raw) {
  const d = defaultInstall();
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return d;
  const num = (x) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0);
  return {
    v: 1,
    finishedDays: Math.min(Math.floor(num(raw.finishedDays)), 1e6),
    dismissedUntil: num(raw.dismissedUntil),
    neverAsk: raw.neverAsk === true,
    installed: raw.installed === true,
  };
}
export const withFinishedDay = (s) => ({ ...s, finishedDays: s.finishedDays + 1 });
export const withSnooze = (s, now) => ({ ...s, dismissedUntil: now + SNOOZE_MS });
export const withNeverAsk = (s) => ({ ...s, neverAsk: true });
export const withInstalled = (s, installed) => ({ ...s, installed: !!installed });

export function createInstallStore(storage) {
  return {
    load: () => sanitizeInstall(storage.get('install')),
    save: (s) => storage.set('install', s),
  };
}
