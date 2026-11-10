// App-shell checks: service worker precache list, icons, manifest (D-25, I-4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const read = (p) => readFileSync(join(root, p));
const manifest = JSON.parse(read('manifest.webmanifest'));

function pngSize(p) {
  const b = read(p);
  assert.deepEqual([...b.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `${p} PNG signature`);
  assert.equal(b.toString('ascii', 12, 16), 'IHDR');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

test('sw.js precache list = index, manifest, every src/*.js and every icon', () => {
  const sw = read('sw.js').toString();
  const list = JSON.parse(/const PRECACHE = (\[[\s\S]*?\]);/.exec(sw)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
  const expected = ['./', 'index.html', 'manifest.webmanifest',
    ...readdirSync(join(root, 'icons')).filter((f) => f.endsWith('.png')).map((f) => `icons/${f}`),
    ...readdirSync(join(root, 'src')).filter((f) => f.endsWith('.js')).map((f) => `src/${f}`)];
  assert.deepEqual([...list].sort(), [...expected].sort());
  for (const u of list) assert.ok(u === './' || existsSync(join(root, u)), `${u} exists`);
  assert.match(sw, /const CACHE = 'sidequest-v\d+'/);
  assert.match(sw, /self\.addEventListener\('fetch'/);
  assert.match(sw, /caches\.delete/); // old caches are cleaned on activate
});

test('index.html registers nothing absolute and links manifest + real PNG apple-touch-icon', () => {
  const html = read('index.html').toString();
  assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
  const m = /rel="apple-touch-icon" href="([^"]+)"/.exec(html);
  assert.ok(m, 'apple-touch-icon link');
  assert.ok(!m[1].startsWith('/') && !m[1].startsWith('data:'));
  assert.deepEqual(pngSize(m[1]), { w: 180, h: 180 });
  assert.ok(!/register\(['"]\//.test(read('src/install.js').toString()), 'SW registered with a relative URL');
  assert.match(read('src/install.js').toString(), /register\('sw\.js'\)/);
});

test('icons: files exist with the right PNG dimensions', () => {
  assert.deepEqual(pngSize('icons/icon-192.png'), { w: 192, h: 192 });
  assert.deepEqual(pngSize('icons/icon-512.png'), { w: 512, h: 512 });
  assert.deepEqual(pngSize('icons/icon-maskable-512.png'), { w: 512, h: 512 });
  assert.deepEqual(pngSize('icons/icon-180.png'), { w: 180, h: 180 });
});

test('manifest: required fields, relative paths, icons exist and match their declared size', () => {
  for (const k of ['id', 'name', 'short_name', 'start_url', 'scope', 'display', 'background_color', 'theme_color']) assert.ok(manifest[k], k);
  assert.ok(['standalone', 'fullscreen'].includes(manifest.display));
  for (const k of ['id', 'start_url', 'scope']) assert.ok(!/^(\/|[a-z]+:)/i.test(manifest[k]), `${k} is relative`);
  const purposes = new Set();
  const sizes = new Set();
  for (const ic of manifest.icons) {
    assert.ok(!/^(\/|[a-z]+:)/i.test(ic.src), `${ic.src} is relative`);
    assert.equal(ic.type, 'image/png');
    const { w, h } = pngSize(ic.src);
    assert.equal(ic.sizes, `${w}x${h}`);
    purposes.add(ic.purpose); sizes.add(ic.sizes);
  }
  assert.ok(purposes.has('any') && purposes.has('maskable'));
  assert.ok(sizes.has('192x192') && sizes.has('512x512'));
  assert.ok(manifest.icons.some((i) => i.purpose === 'any' && i.sizes === '192x192'));
  assert.ok(manifest.icons.some((i) => i.purpose === 'any' && i.sizes === '512x512'));
});

test('a full-page menu hides the controls hint and the rotate chip behind it (intro over an end screen, Settings over pause, D-28)', () => {
  const html = read('index.html').toString();
  const rule = html.split('\n').find((l) => l.includes('.ui[data-kind="page"]:not([hidden])') && l.includes('#hint') && l.includes('#rotate'));
  assert.ok(rule, 'rule present');
  assert.match(rule, /visibility:\s*hidden\s*!important/); // must beat main.js's inline style.visibility
});
