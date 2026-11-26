// Cache busting for GitHub Pages. Pages caches files for ~10 minutes, so after an
// update a browser could otherwise mix old and new modules (for example an old
// appearance.js that does not know a new theme yet and falls back to the default).
// This script gives every local script and stylesheet a content hash: index.html and
// admin.html get versioned URLs plus an import map, so nested `import './x.js'`
// statements are versioned too. Run after changing any .js or .css file:
//   node scripts/stamp_assets.mjs
// tests/asset_versions.test.js fails when the stamps are out of date.
import {readFile, writeFile, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = ['index.html', 'admin.html'];
const ROOT_MODULES = ['app.js', 'core.js', 'catalog.js', 'storage.js', 'social-ui.js'];

const hash = (text) => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex').slice(0, 10);

async function assetHashes() {
  const assets = (await readdir(path.join(root, 'assets'))).filter((f) => /\.(js|css)$/.test(f)).map((f) => 'assets/' + f);
  const files = [...ROOT_MODULES, ...assets, 'styles.css', 'skin.css', 'assets/fonts/fonts.css'];
  const out = {};
  for (const file of files) out[file] = hash(await readFile(path.join(root, file), 'utf8'));
  return out;
}

export function stampPage(html, hashes) {
  const modules = Object.keys(hashes).filter((f) => f.endsWith('.js')).sort();
  const map = JSON.stringify({imports: Object.fromEntries(modules.map((f) => ['./' + f, `./${f}?v=${hashes[f]}`]))});
  const tag = `<script type="importmap">${map}</script>`;
  let next = html.replace(/<script type="importmap">[^<]*<\/script>/, '');
  // The import map must come before the first module script or modulepreload.
  const anchor = next.search(/<link rel="modulepreload"|<script type="module"/);
  if (anchor >= 0) next = next.slice(0, anchor) + tag + next.slice(anchor);
  next = next.replace(/(href|src)="([a-z0-9/_-]+\.(?:js|css))(?:\?v=[0-9a-f]+)?"/gi, (all, attr, file) => (hashes[file] ? `${attr}="${file}?v=${hashes[file]}"` : all));
  return next;
}

export async function stampedPages() {
  const hashes = await assetHashes();
  const pages = {};
  for (const page of PAGES) {
    const html = await readFile(path.join(root, page), 'utf8');
    pages[page] = {html, stamped: stampPage(html, hashes)};
  }
  return pages;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const [page, {html, stamped}] of Object.entries(await stampedPages())) {
    if (html !== stamped) await writeFile(path.join(root, page), stamped);
    console.log(`${page}: ${html === stamped ? 'up to date' : 'stamped'}`);
  }
}
