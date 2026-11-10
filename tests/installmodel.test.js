import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { installKind, detectIOS, detectStandalone } from '../src/installmodel.js';
import { ROOT } from '../tools/build-registry.mjs';

test('installKind: native prompt, iOS instructions, or nothing', () => {
  assert.equal(installKind({ hasDeferredPrompt: true }), 'native');
  assert.equal(installKind({ isIOS: true }), 'ios-instructions');
  assert.equal(installKind({}), 'none');
  assert.equal(installKind({ hasDeferredPrompt: true, isStandalone: true }), 'none');
  assert.equal(installKind({ isIOS: true, installed: true }), 'none');
});

test('detectIOS: iPhone UA and iPad-as-Mac with touch points', () => {
  assert.equal(detectIOS({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }), true);
  assert.equal(detectIOS({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 }), true);
  assert.equal(detectIOS({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 0 }), false);
});

test('detectStandalone: fullscreen counts only on touch hardware', () => {
  assert.equal(detectStandalone({ standaloneMQ: true }), true);
  assert.equal(detectStandalone({ navStandalone: true }), true);
  assert.equal(detectStandalone({ fullscreenMQ: true }), false);
  assert.equal(detectStandalone({ fullscreenMQ: true, touchHardware: true }), true);
  assert.equal(detectStandalone({ referrer: 'android-app://com.example' }), true);
});

test('manifest: required fields, root scope, and icons that exist with the stated sizes', () => {
  const m = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
  for (const k of ['id', 'name', 'short_name', 'start_url', 'scope', 'display', 'background_color', 'theme_color']) assert.ok(m[k], k);
  assert.equal(m.id, './', 'same id as the old Side Quest app, so old installs update to the launcher (D-6)');
  assert.equal(m.scope, './');
  for (const purpose of ['any', 'maskable']) assert.ok(m.icons.some((i) => i.purpose === purpose && i.sizes === '512x512'), purpose);
  for (const icon of [...m.icons, { src: 'icons/icon-180.png', sizes: '180x180' }]) {
    const file = join(ROOT, icon.src);
    assert.ok(existsSync(file), icon.src);
    const png = readFileSync(file);
    const [w, h] = icon.sizes.split('x').map(Number);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [w, h], icon.src);
  }
});

test('index.html links the manifest and the apple-touch-icon', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /<link rel="manifest" href="manifest.webmanifest">/);
  assert.match(html, /<link rel="apple-touch-icon" href="icons\/icon-180.png">/);
});
