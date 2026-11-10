// Game registry logic (no DOM, no fs) shared by tools/build-registry.mjs, the launcher and the tests.
// A game is a folder games/<slug>/ with an index.html and a game.json; games.json at the root lists them all.

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Returns a list of problems with one game.json (empty = valid).
export function validateMeta(slug, meta) {
  const errors = [];
  const fail = (msg) => errors.push(`games/${slug}/game.json: ${msg}`);
  if (!SLUG_RE.test(slug)) fail(`folder name "${slug}" must be lower-case kebab-case`);
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return [...errors, `games/${slug}/game.json: must be a JSON object`];
  if (typeof meta.title !== 'string' || !meta.title.trim()) fail('"title" is required');
  if (typeof meta.description !== 'string' || !meta.description.trim()) fail('"description" is required');
  if (meta.thumbnail !== undefined && typeof meta.thumbnail !== 'string') fail('"thumbnail" must be a path relative to the game folder');
  if (meta.icon !== undefined && typeof meta.icon !== 'string') fail('"icon" must be a string (an emoji)');
  if (meta.tags !== undefined && !(Array.isArray(meta.tags) && meta.tags.every((t) => typeof t === 'string'))) fail('"tags" must be a list of strings');
  if (meta.order !== undefined && !Number.isFinite(meta.order)) fail('"order" must be a number');
  return errors;
}

// One games.json entry. Paths are relative to the site root so the launcher can link straight to them.
export function toEntry(slug, meta) {
  const path = `games/${slug}/`;
  const entry = { slug, path, title: meta.title, description: meta.description };
  if (meta.thumbnail) entry.thumbnail = path + meta.thumbnail.replace(/^\.\//, '');
  if (meta.icon) entry.icon = meta.icon;
  entry.tags = meta.tags ?? [];
  if (meta.order !== undefined) entry.order = meta.order;
  return entry;
}

// Games with an "order" first (ascending), then the rest by title.
export function sortGames(games) {
  const key = (g) => (Number.isFinite(g.order) ? g.order : Infinity);
  return [...games].sort((a, b) => key(a) - key(b) || a.title.localeCompare(b.title));
}

export const serialize = (games) => JSON.stringify(games, null, 2) + '\n';
