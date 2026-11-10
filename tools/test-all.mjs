// Runs npm test inside every games/<slug>/ that has a package.json (each game's tests use paths relative to its folder).
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './build-registry.mjs';

const failed = [];
for (const d of readdirSync(join(ROOT, 'games'), { withFileTypes: true })) {
  const dir = join(ROOT, 'games', d.name);
  if (!d.isDirectory() || !existsSync(join(dir, 'package.json'))) continue;
  console.log(`\n=== games/${d.name}: npm test`);
  const r = spawnSync('npm', ['test'], { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) failed.push(d.name);
}
if (failed.length) { console.error(`\nTests failed in: ${failed.join(', ')}`); process.exit(1); }
console.log('\nAll game tests passed.');
