// Builds games.json from games/*/game.json. No dependencies.
// Usage: node tools/build-registry.mjs          writes games.json
//        node tools/build-registry.mjs --check  exits non-zero if games.json is out of date
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateMeta, toEntry, sortGames, serialize } from '../src/registry.js';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export function collect(root = ROOT) {
  const gamesDir = join(root, 'games');
  const errors = [];
  const games = [];
  for (const d of readdirSync(gamesDir, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith('.')) continue;
    const dir = join(gamesDir, d.name);
    if (!existsSync(join(dir, 'index.html'))) errors.push(`games/${d.name}/index.html is missing`);
    if (!existsSync(join(dir, 'game.json'))) { errors.push(`games/${d.name}/game.json is missing`); continue; }
    let meta;
    try { meta = JSON.parse(readFileSync(join(dir, 'game.json'), 'utf8')); } catch (e) { errors.push(`games/${d.name}/game.json: ${e.message}`); continue; }
    if (meta && typeof meta === 'object' && 'movedTo' in meta) {
      // A renamed game's old folder: a redirect stub, not listed in the launcher.
      if (typeof meta.movedTo !== 'string' || !existsSync(join(gamesDir, meta.movedTo, 'game.json'))) {
        errors.push(`games/${d.name}/game.json: "movedTo" must name another game folder`);
      }
      continue;
    }
    const errs = validateMeta(d.name, meta);
    if (meta?.thumbnail && !existsSync(join(dir, meta.thumbnail))) errs.push(`games/${d.name}/game.json: thumbnail ${meta.thumbnail} not found`);
    errors.push(...errs);
    if (!errs.length) games.push(toEntry(d.name, meta));
  }
  return { games: sortGames(games), errors };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { games, errors } = collect();
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  const out = join(ROOT, 'games.json');
  const text = serialize(games);
  if (process.argv.includes('--check')) {
    const current = existsSync(out) ? readFileSync(out, 'utf8') : '';
    if (current !== text) { console.error('games.json is out of date: run npm run registry'); process.exit(1); }
    console.log(`games.json is up to date (${games.length} games)`);
  } else {
    writeFileSync(out, text);
    console.log(`wrote games.json (${games.length} games: ${games.map((g) => g.slug).join(', ')})`);
  }
}
