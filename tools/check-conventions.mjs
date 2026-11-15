// Checks the repo's written conventions (S-2): relative URLs, imports that stay inside the game, a standard
// package.json, and DOM-free logic modules. No dependencies. Every function returns a list of problem strings.
// Usage: node tools/check-conventions.mjs   prints the problems and exits non-zero when there are any
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, collect } from './build-registry.mjs';

// ---------------------------------------------------------------- reading code

// Blanks comments and regex literals (and string contents when strings is false) so patterns do not see them.
// Newlines are kept, so line numbers survive. `${...}` inside a template literal stays code.
export function stripCode(text, { strings = true } = {}) {
  let i = 0, out = '';
  const n = text.length;
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  const REGEX_AFTER = /[(,=:[!&|?{};+\-*%<>~^]$|(?:^|[^\w$.])(?:return|typeof|case|in|of|delete|void|throw|new)$|^$/;

  function quoted(q) { // at the opening quote; returns the whole literal
    let j = i + 1;
    while (j < n && text[j] !== q && text[j] !== '\n') j += text[j] === '\\' ? 2 : 1;
    const s = text.slice(i, Math.min(j + 1, n));
    i = Math.min(j + 1, n);
    return strings ? s : q + blank(s.slice(1, -1)) + (s.endsWith(q) && s.length > 1 ? q : '');
  }
  function template() { // at the opening backtick
    let res = '`';
    i++;
    while (i < n && text[i] !== '`') {
      if (text[i] === '\\') { const s = text.slice(i, i + 2); res += strings ? s : blank(s); i += 2; }
      else if (text[i] === '$' && text[i + 1] === '{') {
        res += '${'; i += 2;
        res += code('}');
        res += '}'; i++;
      } else { res += strings ? text[i] : blank(text[i]); i++; }
    }
    i++;
    return res + '`';
  }
  function code(until) { // scans code until the unmatched `until` brace (or the end)
    let res = '', depth = 0;
    while (i < n) {
      const c = text[i], d = text[i + 1];
      if (until && c === '}' && depth === 0) return res;
      if (c === '/' && d === '/') { let j = i; while (j < n && text[j] !== '\n') j++; res += blank(text.slice(i, j)); i = j; }
      else if (c === '/' && d === '*') { let j = text.indexOf('*/', i + 2); j = j < 0 ? n : j + 2; res += blank(text.slice(i, j)); i = j; }
      else if (c === '"' || c === "'") res += quoted(c);
      else if (c === '`') res += template();
      else if (c === '/' && REGEX_AFTER.test(res.replace(/\s+$/, '').slice(-12))) {
        let j = i + 1, cls = false;
        while (j < n && text[j] !== '\n' && (cls || text[j] !== '/')) {
          if (text[j] === '\\') j++;
          else if (text[j] === '[') cls = true;
          else if (text[j] === ']') cls = false;
          j++;
        }
        j++;
        while (j < n && /[a-z]/.test(text[j])) j++;
        res += '/' + blank(text.slice(i + 1, Math.min(j, n))); i = Math.min(j, n);
      } else {
        if (c === '{') depth++; else if (c === '}') depth--;
        res += c; i++;
      }
    }
    return res;
  }
  return code(null);
}

// ---------------------------------------------------------------- files

const SKIP_DIRS = new Set(['node_modules', 'tests', 'tools', 'docs']);

// Relative paths (with /) of the files under dir with one of the extensions. skip: folder names to leave out
// (at any depth); dot folders are always left out.
export function listFiles(dir, exts, skip = new Set(['node_modules'])) {
  const out = [];
  (function walk(d, prefix) {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (e.name.startsWith('.')) continue;
      if (e.isDirectory()) { if (!skip.has(e.name)) walk(join(d, e.name), prefix + e.name + '/'); }
      else if (exts.includes(extname(e.name))) out.push(prefix + e.name);
    }
  })(dir, '');
  return out;
}

const read = (path) => readFileSync(path, 'utf8');

// ---------------------------------------------------------------- A: relative URLs

const ABS = String.raw`\/(?!\/)`; // a site-absolute path: one slash, not the start of //host
const HTML_ATTR = new RegExp(String.raw`\b(?:src|href|action|poster|srcset|data-[\w-]*src)\s*=\s*["']\s*${ABS}`, 'g');
const CSS_URL = new RegExp(String.raw`\burl\(\s*["']?\s*${ABS}`, 'g');
const CSS_IMPORT = new RegExp(String.raw`@import\s+["']\s*${ABS}`, 'g');
const JS_CALL = new RegExp(String.raw`\b(?:fetch|register|import|importScripts|Worker|SharedWorker|open)\s*\(\s*["'\`]\s*${ABS}`, 'g');
const JS_FROM = new RegExp(String.raw`\b(?:from|import)\s*["']\s*${ABS}`, 'g');
const JS_ASSIGN = new RegExp(String.raw`\.(?:src|href)\s*=\s*["'\`]\s*${ABS}`, 'g');

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

// Site-absolute references in one file's text. name decides the kind of file (.html, .css, .js/.mjs, .webmanifest).
export function findAbsoluteUrls(name, text) {
  const ext = extname(name);
  const hits = [];
  const scan = (re, src, what) => { for (const m of src.matchAll(re)) hits.push(`${name}:${lineOf(src, m.index)}: ${what} starts with / (${m[0].trim()})`); };
  if (ext === '.webmanifest' || ext === '.json') {
    let m;
    try { m = JSON.parse(text); } catch { return [`${name}: not valid JSON`]; }
    const check = (what, v) => { if (typeof v === 'string' && /^\/(?!\/)/.test(v)) hits.push(`${name}: ${what} "${v}" starts with /`); };
    check('start_url', m.start_url); check('scope', m.scope); check('id', m.id);
    for (const icon of m.icons || []) check('icon src', icon?.src);
    for (const s of m.shortcuts || []) { check('shortcut url', s?.url); for (const icon of s?.icons || []) check('shortcut icon src', icon?.src); }
    for (const s of m.screenshots || []) check('screenshot src', s?.src);
  } else if (ext === '.css') {
    const css = text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
    scan(CSS_URL, css, 'url()'); scan(CSS_IMPORT, css, '@import');
  } else if (ext === '.html') {
    const html = text.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '));
    scan(HTML_ATTR, html, 'attribute'); scan(CSS_URL, html, 'url()'); scan(CSS_IMPORT, html, '@import');
    scan(JS_CALL, html, 'call'); scan(JS_FROM, html, 'import'); scan(JS_ASSIGN, html, 'assignment');
  } else {
    const js = stripCode(text);
    scan(JS_CALL, js, 'call'); scan(JS_FROM, js, 'import'); scan(JS_ASSIGN, js, 'assignment');
  }
  return hits;
}

// Rule 4: a game uses relative URLs only. Looks at the game's own pages, styles, scripts and manifests.
export function checkRelativeUrls(gameDir, label = gameDir) {
  const problems = [];
  const files = listFiles(gameDir, ['.html', '.css', '.js', '.mjs', '.webmanifest'], new Set([...SKIP_DIRS]));
  for (const f of files) for (const p of findAbsoluteUrls(f, read(join(gameDir, f)))) problems.push(`${label}/${p}`);
  return problems;
}

// ---------------------------------------------------------------- B: imports stay in the game

// Every module specifier a script loads: static import, export ... from, side-effect import and import('...').
export function findImports(text) {
  const code = stripCode(text), bare = stripCode(text, { strings: false });
  const out = [];
  const res = [
    /\b(?:import|export)\b[^'"`;()]*?\bfrom\s*(['"])([^'"\n]*)\1/g,
    /\bimport\s*(['"])([^'"\n]*)\1/g,
    /\bimport\s*\(\s*(['"`])([^'"`\n]*)\1\s*[,)]/g,
  ];
  // The keyword must survive in the copy with string contents blanked, or it was itself inside a string.
  for (const re of res) for (const m of code.matchAll(re)) if (bare.slice(m.index, m.index + 6) === code.slice(m.index, m.index + 6)) out.push({ spec: m[2], line: lineOf(code, m.index) });
  return out.sort((a, b) => a.line - b.line);
}

// Rule 4 + zero dependencies: each import is a relative file inside the game, or (tests/ and tools/ only) a node: builtin.
export function checkImports(gameDir, label = gameDir) {
  const problems = [];
  const root = resolve(gameDir);
  for (const f of listFiles(gameDir, ['.js', '.mjs'])) {
    const where = `${label}/${f}`;
    const mayUseNode = /^(?:tests|tools)\//.test(f);
    for (const { spec, line } of findImports(read(join(gameDir, f)))) {
      const at = `${where}:${line}: import '${spec}'`;
      if (spec.startsWith('node:')) { if (!mayUseNode) problems.push(`${at} is a Node builtin; only tests/ and tools/ may use those`); continue; }
      if (!/^\.\.?\//.test(spec)) { problems.push(`${at} is not a relative path (no packages, no absolute paths, no URLs)`); continue; }
      const target = resolve(dirname(join(gameDir, f)), spec);
      if (target !== root && !target.startsWith(root + sep)) { problems.push(`${at} leaves the game folder`); continue; }
      if (!existsSync(target) || !statSync(target).isFile()) problems.push(`${at} does not resolve to a file`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------- C: package.json

export function checkPackage(pkg, label) {
  const problems = [];
  if (pkg === null || typeof pkg !== 'object') return [`${label}/package.json is missing or not an object`];
  if (pkg.private !== true) problems.push(`${label}/package.json: "private" must be true`);
  if (pkg.type !== 'module') problems.push(`${label}/package.json: "type" must be "module"`);
  if (pkg.scripts?.start !== 'python3 -m http.server 8000') problems.push(`${label}/package.json: scripts.start must be "python3 -m http.server 8000"`);
  if (pkg.scripts?.test !== 'node --test tests/*.test.js') problems.push(`${label}/package.json: scripts.test must be "node --test tests/*.test.js"`);
  return problems;
}

// ---------------------------------------------------------------- D, E: DOM-free logic modules

export const BROWSER_GLOBALS = [
  'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'location', 'matchMedia', 'requestAnimationFrame',
  'cancelAnimationFrame', 'performance', 'AudioContext', 'webkitAudioContext', 'fetch', 'alert', 'confirm', 'HTMLElement',
  'Image', 'OffscreenCanvas', 'innerWidth', 'innerHeight', 'devicePixelRatio',
];
// Not a property access (x.location) and not an object key ({ fetch: 'hämta' }, as in a table of strings).
const GLOBAL_RE = new RegExp(String.raw`(?<![.\w$])(?<![{,]\s*(?=\w+\s*:))(?:${BROWSER_GLOBALS.join('|')})(?![\w$])`, 'g');

// The browser globals a script mentions in code (not in comments or strings), sorted and without repeats.
export function browserGlobalsIn(text) {
  return [...new Set(stripCode(text, { strings: false }).match(GLOBAL_RE) || [])].sort();
}

// srcDir holds the modules; browserModules are the ones (paths relative to srcDir) allowed to touch the browser.
// Every other .js file under srcDir must be DOM-free, and the list must stay honest.
export function checkPurity(srcDir, browserModules, label) {
  const problems = [];
  if (!Array.isArray(browserModules) || !browserModules.every((m) => typeof m === 'string')) {
    return [`${label}: "browserModules" must be a list of file names relative to src/`];
  }
  const files = listFiles(srcDir, ['.js']);
  for (const m of browserModules) if (!files.includes(m)) problems.push(`${label}: "browserModules" lists ${m}, which is not a .js file in src/`);
  for (const f of files) {
    const used = browserGlobalsIn(read(join(srcDir, f)));
    const listed = browserModules.includes(f);
    if (!listed && used.length) problems.push(`${label}/src/${f} touches the browser (${used.join(', ')}); keep it DOM-free or list it in "browserModules"`);
    if (listed && !used.length) problems.push(`${label}/src/${f} is in "browserModules" but uses no browser global: remove it from the list`);
  }
  return problems;
}

// ---------------------------------------------------------------- everything

export function gameSlugs(root = ROOT) {
  return collect(root).games.map((g) => g.slug);
}

export function checkGame(root, slug) {
  const dir = join(root, 'games', slug), label = `games/${slug}`;
  let pkg = null;
  try { pkg = JSON.parse(read(join(dir, 'package.json'))); } catch { /* reported by checkPackage */ }
  return [
    ...checkRelativeUrls(dir, label),
    ...checkImports(dir, label),
    ...checkPackage(pkg, label),
    ...checkPurity(join(dir, 'src'), pkg?.browserModules ?? null, label),
  ];
}

// The launcher's only browser module is launcher.js. Files in kit/ are not checked yet.
export const LAUNCHER_BROWSER_MODULES = ['launcher.js'];
export function checkLauncher(root = ROOT) {
  return checkPurity(join(root, 'src'), LAUNCHER_BROWSER_MODULES, 'launcher');
}

export function checkConventions(root = ROOT) {
  return [...gameSlugs(root).flatMap((slug) => checkGame(root, slug)), ...checkLauncher(root)];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = checkConventions();
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log(`conventions ok (${gameSlugs().length} games and the launcher)`);
}
