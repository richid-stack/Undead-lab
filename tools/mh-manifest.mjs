// Rebuilds tools/mh-manifest.json: the list of MakeHuman data files the game uses, each with its SHA-256.
//
//   node tools/mh-manifest.mjs <path to a clone of NastyFFM/HumanGenWeb> <list.json> [commit]
//
// <list.json> is a JSON array of paths below the clone's data/ folder (tests can record it: open the Choose hero page, put on every wardrobe item,
// and collect every request under models/mh/). Only needed when the wardrobe grows; `npm run assets` just reads the manifest.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [clone, list, commit = 'a8ee33f96791ed15534246ac88cc8b20f9da8f6a'] = process.argv.slice(2);
if (!clone || !list) { console.error('usage: node tools/mh-manifest.mjs <HumanGenWeb clone> <list.json> [commit]'); process.exit(1) }
const files = {};
for (const f of JSON.parse(readFileSync(list, 'utf8')).sort()) files[f] = createHash('sha256').update(readFileSync(join(clone, 'data', f))).digest('hex');
const out = join(dirname(fileURLToPath(import.meta.url)), 'mh-manifest.json');
writeFileSync(out, JSON.stringify({ repo: 'NastyFFM/HumanGenWeb', commit, root: 'data/', files }, null, 1) + '\n');
console.log(`${Object.keys(files).length} files -> ${out}`);
