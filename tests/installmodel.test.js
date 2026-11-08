import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  installKind, inviteKind, detectIOS, detectStandalone, defaultInstall, sanitizeInstall,
  withFinishedDay, withSnooze, withNeverAsk, withInstalled, createInstallStore, SNOOZE_MS,
} from '../src/installmodel.js';
import { createStorage } from '../src/storage.js';

const NOW = 1_700_000_000_000;
const F = (o = {}) => ({ isTouch: true, isStandalone: false, hasDeferredPrompt: false, isIOS: false, installed: false,
  dismissedUntil: 0, neverAsk: false, finishedDays: 1, now: NOW, ...o });

test('installKind: native with a stashed prompt, ios-instructions on iOS, otherwise none', () => {
  assert.equal(installKind(F({ hasDeferredPrompt: true })), 'native');
  assert.equal(installKind(F({ isIOS: true })), 'ios-instructions');
  assert.equal(installKind(F()), 'none');            // Firefox, desktop Safari, ...
  assert.equal(installKind(F({ isTouch: false, hasDeferredPrompt: true })), 'native'); // menu item on desktop Chrome is fine
});

test('installKind: standalone or already installed always hides everything', () => {
  for (const o of [{ hasDeferredPrompt: true }, { isIOS: true }]) {
    assert.equal(installKind(F({ ...o, isStandalone: true })), 'none');
    assert.equal(installKind(F({ ...o, installed: true })), 'none');
  }
});

test('inviteKind: needs touch, a finished day, no neverAsk, snooze over, and something to offer', () => {
  const ok = { hasDeferredPrompt: true };
  assert.equal(inviteKind(F(ok)), 'native');
  assert.equal(inviteKind(F({ isIOS: true })), 'ios-instructions');
  assert.equal(inviteKind(F({ ...ok, finishedDays: 0 })), 'none');   // not on first load
  assert.equal(inviteKind(F({ ...ok, isTouch: false })), 'none');    // desktop: menu item only
  assert.equal(inviteKind(F({ ...ok, neverAsk: true })), 'none');
  assert.equal(inviteKind(F({ ...ok, isStandalone: true })), 'none');
  assert.equal(inviteKind(F({ ...ok, installed: true })), 'none');
  assert.equal(inviteKind(F()), 'none');                              // nothing installable
});

test('inviteKind: snooze boundary (7 days)', () => {
  const ok = { hasDeferredPrompt: true };
  assert.equal(inviteKind(F({ ...ok, dismissedUntil: NOW + 1 })), 'none');
  assert.equal(inviteKind(F({ ...ok, dismissedUntil: NOW })), 'native');
  assert.equal(inviteKind(F({ ...ok, dismissedUntil: NOW - 1 })), 'native');
  assert.equal(SNOOZE_MS, 7 * 24 * 3600 * 1000);
});

test('neverAsk hides the invitation but keeps the menu item', () => {
  const f = F({ hasDeferredPrompt: true, neverAsk: true });
  assert.equal(inviteKind(f), 'none');
  assert.equal(installKind(f), 'native');
});

test('detectIOS: iPhone, iPad, iPadOS-as-Mac (touch points), real Mac, Android', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
  const ipadOs = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
  assert.equal(detectIOS({ userAgent: iphone, platform: 'iPhone', maxTouchPoints: 5 }), true);
  assert.equal(detectIOS({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)', platform: 'iPad', maxTouchPoints: 5 }), true);
  assert.equal(detectIOS({ userAgent: ipadOs, platform: 'MacIntel', maxTouchPoints: 5 }), true);
  assert.equal(detectIOS({ userAgent: ipadOs, platform: 'MacIntel', maxTouchPoints: 0 }), false); // a real Mac
  assert.equal(detectIOS({ userAgent: ipadOs, platform: 'MacIntel', maxTouchPoints: 1 }), false);
  assert.equal(detectIOS({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120 Mobile', platform: 'Linux armv8l', maxTouchPoints: 5 }), false);
  assert.equal(detectIOS({}), false);
});

test('detectStandalone: navigator.standalone, display-mode standalone or fullscreen, TWA referrer', () => {
  assert.equal(detectStandalone({}), false);
  assert.equal(detectStandalone({ navStandalone: true }), true);
  assert.equal(detectStandalone({ standaloneMQ: true }), true);
  assert.equal(detectStandalone({ fullscreenMQ: true }), true);
  assert.equal(detectStandalone({ referrer: 'android-app://com.example' }), true);
  assert.equal(detectStandalone({ referrer: 'https://example.com/' }), false);
});

test('state transitions and sanitising', () => {
  let s = defaultInstall();
  s = withFinishedDay(withFinishedDay(s));
  assert.equal(s.finishedDays, 2);
  assert.equal(withSnooze(s, NOW).dismissedUntil, NOW + SNOOZE_MS);
  assert.equal(withNeverAsk(s).neverAsk, true);
  assert.equal(withInstalled(s, true).installed, true);
  assert.deepEqual(sanitizeInstall(null), defaultInstall());
  assert.deepEqual(sanitizeInstall({ v: 2, neverAsk: true }), defaultInstall());
  assert.deepEqual(sanitizeInstall({ v: 1, finishedDays: -3, dismissedUntil: 'x', neverAsk: 'yes', installed: 1 }), defaultInstall());
  assert.equal(sanitizeInstall({ v: 1, finishedDays: 2.9 }).finishedDays, 2);
});

test('store round trip under sidequest.v1.install, garbage ignored', () => {
  const m = new Map();
  const st = createStorage({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) });
  const store = createInstallStore(st);
  assert.deepEqual(store.load(), defaultInstall());
  store.save(withNeverAsk(withFinishedDay(defaultInstall())));
  assert.ok(m.has('sidequest.v1.install'));
  assert.deepEqual(store.load(), { v: 1, finishedDays: 1, dismissedUntil: 0, neverAsk: true, installed: false });
  m.set('sidequest.v1.install', '{not json');
  assert.deepEqual(store.load(), defaultInstall());
});
