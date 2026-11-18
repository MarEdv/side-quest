// Pure decision logic for the "install as an app" feature (I-1..I-3, D-25). No DOM, no storage backend: the browser
// module src/install.js gathers the facts and calls these.

// installKind, detectIOS and detectStandalone come from the kit (src/kit/install.js, root D-15; D-35), shared with the
// launcher: what can be offered ('native' / 'ios-instructions' / 'none'), iOS / iPadOS detection, and "already running as an
// app" (fullscreen only counts on touch hardware, D-26).
import { installKind } from './kit/install.js';
export { installKind, detectIOS, detectStandalone } from './kit/install.js';

export const SNOOZE_DAYS = 7;
export const SNOOZE_MS = SNOOZE_DAYS * 24 * 60 * 60 * 1000;

// Whether to invite after a finished day: only on touch devices, only after at least one finished day, never when
// the player said "Don't ask again", not before the "Not now" snooze ran out, and only when something can be offered.
export function inviteKind(f) {
  const kind = installKind(f);
  if (kind === 'none' || !f.isTouch || f.neverAsk) return 'none';
  if ((f.finishedDays || 0) < 1) return 'none';
  // Snoozed: "Not now" hides it until dismissedUntil. A date further away than one snooze means the clock was wrong when
  // it was set (or has been turned back since); treat it as over so a bad clock cannot silence the invitation for good.
  if (f.dismissedUntil && f.now < f.dismissedUntil && f.dismissedUntil - f.now <= SNOOZE_MS) return 'none';
  return kind;
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
