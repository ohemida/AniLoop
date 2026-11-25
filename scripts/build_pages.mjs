import { cp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitPool } from './split_pool.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'pages-build'));
const config = JSON.parse(await readFile(path.join(root, 'supabase/project.json'), 'utf8'));
if (!config.enabled || !config.url || !config.publishableKey) {
  throw new Error('Set the Supabase project URL and publishable key in supabase/project.json first.');
}
try { await stat(out); throw new Error(`${out} already exists; choose a fresh output folder. Nothing was removed.`); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

const json = async (name) => JSON.parse(await readFile(path.join(root, name), 'utf8'));
const sources = new Map((await json('data/media-sources.json')).map((row) => [row.path, row.source]));
const registry = await json('data/media-index.json');
const pool = await json('data/pool.json');
function media(value) {
  if (typeof value !== 'string') return value;
  if (value.startsWith('assets/media/')) {
    if (!sources.has(value)) throw new Error(`Unregistered media path: ${value}`);
    return sources.get(value);
  }
  if (value.startsWith('media/')) {
    const entry = registry[value.slice(6)];
    if (!entry) throw new Error(`Unknown media ID: ${value}`);
    return entry.url;
  }
  return value;
}
for (const anime of pool.anime) {
  anime.screenshots = (anime.screenshots || []).map(media);
  for (const key of ['cover', 'characterImage']) if (anime[key]) anime[key] = media(anime[key]);
  for (const key of ['opening', 'ending']) if (anime[key]) {
    for (const prop of ['audio', 'video']) if (anime[key][prop]) anime[key][prop] = media(anime[key][prop]);
  }
  for (const character of anime.characters || []) character.image = media(character.image);
}

await mkdir(out, { recursive: true });
for (const name of ['index.html', 'admin.html', 'app.js', 'catalog.js', 'social-ui.js', 'core.js', 'storage.js', 'styles.css', 'skin.css']) {
  await cp(path.join(root, name), path.join(out, name));
}
await cp(path.join(root, 'assets'), path.join(out, 'assets'), {
  recursive: true,
  filter: (source) => !source.split(path.sep).includes('media') && !source.endsWith('.py') && !source.includes('__pycache__'),
});
await mkdir(path.join(out, 'data'));
await writeFile(path.join(out, 'data/pool.json'), JSON.stringify(pool));
const {lite, synopses} = splitPool(pool);
await writeFile(path.join(out, 'data/pool-lite.json'), JSON.stringify(lite));
await writeFile(path.join(out, 'data/synopsis.json'), JSON.stringify(synopses));
for (const name of ['media-index.json', 'media-sources.json']) await cp(path.join(root, 'data', name), path.join(out, 'data', name));
const runtime = {
  mode: 'supabase', supabaseUrl: config.url, publishableKey: config.publishableKey,
  functionUrl: `${config.url.replace(/\/$/, '')}/functions/v1/aniloop`, videoHintsEnabled: false,
};
await writeFile(path.join(out, 'assets/runtime-config.js'), `export const runtimeConfig=Object.freeze(${JSON.stringify(runtime)});\n`);
await writeFile(path.join(out, '.nojekyll'), '');
const localHintCache = path.join(root, '.tools/hint-cache');
let derivativeCount = 0;
try { derivativeCount = (await readdir(localHintCache)).filter((name) => name.endsWith('.mp4')).length; } catch {}
const status = {
  artifact: 'github-pages-supabase-static', pythonRuntimeRequired: false,
  edgeFunction: 'supabase/functions/aniloop', databaseMigration: 'supabase/cloud_runtime.sql',
  protectedVideoHints: 'not bundled; no original or unblurred video is exposed',
  cachedLocalVideoDerivatives: derivativeCount, requiresSupabaseFunctionDeployment: true,
};
await writeFile(path.join(out, 'BUILD_STATUS.json'), `${JSON.stringify(status, null, 2)}\n`);
let bytes = 0;
async function size(dir) { for (const e of await readdir(dir, { withFileTypes: true })) { const file = path.join(dir, e.name); if (e.isDirectory()) await size(file); else bytes += (await stat(file)).size; } }
await size(out);
console.log(`Python-free Pages bundle created at ${out} (${bytes.toLocaleString()} bytes).`);
console.log(`Supabase Edge Function required. ${derivativeCount} local protected video derivatives were excluded.`);
