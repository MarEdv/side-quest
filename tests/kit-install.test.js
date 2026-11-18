import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installKind, detectIOS, detectStandalone } from '../kit/install.js';

test('installKind: native prompt, iOS instructions, or nothing', () => {
  assert.equal(installKind(), 'none');
  assert.equal(installKind({ hasDeferredPrompt: true }), 'native');
  assert.equal(installKind({ hasDeferredPrompt: true, isIOS: true }), 'native');
  assert.equal(installKind({ isIOS: true }), 'ios-instructions');
  for (const done of [{ isStandalone: true }, { installed: true }]) {
    assert.equal(installKind({ ...done, hasDeferredPrompt: true, isIOS: true }), 'none');
  }
});

test('detectIOS: iPhone, iPad, iPadOS-as-Mac (touch points), real Mac, Android', () => {
  const ipadOs = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
  assert.equal(detectIOS({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }), true);
  assert.equal(detectIOS({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)', platform: 'iPad' }), true);
  assert.equal(detectIOS({ userAgent: ipadOs, platform: 'MacIntel', maxTouchPoints: 5 }), true);
  assert.equal(detectIOS({ userAgent: ipadOs, platform: 'MacIntel', maxTouchPoints: 0 }), false);
  assert.equal(detectIOS({ userAgent: ipadOs, platform: 'MacIntel', maxTouchPoints: 1 }), false);
  assert.equal(detectIOS({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120 Mobile', platform: 'Linux armv8l', maxTouchPoints: 5 }), false);
  assert.equal(detectIOS(), false);
});

test('detectStandalone: navigator.standalone, display-mode standalone, fullscreen on touch hardware only, TWA referrer', () => {
  assert.equal(detectStandalone(), false);
  assert.equal(detectStandalone({ navStandalone: true }), true);
  assert.equal(detectStandalone({ standaloneMQ: true }), true);
  assert.equal(detectStandalone({ fullscreenMQ: true, touchHardware: true }), true);
  assert.equal(detectStandalone({ fullscreenMQ: true }), false, 'F11 browser fullscreen on a desktop');
  assert.equal(detectStandalone({ referrer: 'android-app://com.example' }), true);
  assert.equal(detectStandalone({ referrer: 'https://example.com/' }), false);
});
