// Builds the browser copy of the pool. data/pool.json stays the full source of
// truth (the Edge Function imports it); the browser loads data/pool-lite.json,
// which drops fields the client never shows up front. Synopses are only needed
// for one Anidle clue, so they live in data/synopsis.json and load lazily.
// Run after every pool update:  node scripts/split_pool.mjs
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DROPPED = ['synopsis', 'malLink', 'cmsId'];

export function splitPool(pool) {
  const synopses = {};
  const anime = pool.anime.map((entry) => {
    const lite = {...entry};
    if (typeof entry.synopsis === 'string' && entry.synopsis) {
      synopses[entry.id] = entry.synopsis;
      lite.hasSynopsis = true;
    }
    for (const key of DROPPED) delete lite[key];
    return lite;
  });
  return {lite: {...pool, anime, lite: true}, synopses};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pool = JSON.parse(await readFile(path.join(root, 'data/pool.json'), 'utf8'));
  const {lite, synopses} = splitPool(pool);
  await writeFile(path.join(root, 'data/pool-lite.json'), JSON.stringify(lite));
  await writeFile(path.join(root, 'data/synopsis.json'), JSON.stringify(synopses));
  console.log(`pool-lite.json: ${lite.anime.length} anime; synopsis.json: ${Object.keys(synopses).length} entries`);
}
