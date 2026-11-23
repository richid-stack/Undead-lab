#!/usr/bin/env node
/**
 * fetch-osm.mjs
 * Downloads OpenStreetMap data for a bounding box from the Overpass API and writes data/osm/<name>.json.
 *
 *   node tools/fetch-osm.mjs                                    # the Legon area (default box below)
 *   node tools/fetch-osm.mjs --name madina --bbox 5.66,-0.18,5.69,-0.15
 *
 * The box is SOUTH,WEST,NORTH,EAST in degrees. Check it on openstreetmap.org (the script prints a link to the centre).
 * Data (c) OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright. The game must credit it.
 *
 * The AI workspace cannot reach Overpass, so run this on your computer or from the "Fetch OSM" GitHub Action.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_BBOX = [5.630, -0.205, 5.668, -0.170];   // Legon campus and surroundings: a starting guess, adjust after checking the map
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d };
const name = arg('name', 'legon').replace(/[^a-z0-9_-]/gi, '');
const bbox = arg('bbox') ? arg('bbox').split(',').map(Number) : DEFAULT_BBOX;
if (bbox.length !== 4 || bbox.some(Number.isNaN) || bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) { console.error('Bad --bbox. Use SOUTH,WEST,NORTH,EAST'); process.exit(1) }
const b = bbox.join(',');

// Everything the game can use: buildings, roads and paths, rail (incl. disused), water and drains, land use, barriers, power, named places and amenities.
const query = `[out:json][timeout:180];
(
  way["building"](${b});
  relation["building"](${b});
  way["highway"](${b});
  way["railway"](${b});
  node["railway"](${b});
  way["waterway"](${b});
  way["natural"](${b});
  way["landuse"](${b});
  way["leisure"](${b});
  way["barrier"](${b});
  node["barrier"](${b});
  way["power"](${b});
  node["power"](${b});
  node["amenity"](${b});
  way["amenity"](${b});
  node["shop"](${b});
  node["highway"~"bus_stop|crossing|traffic_signals"](${b});
  node["public_transport"](${b});
  node["tourism"](${b});
  node["man_made"](${b});
);
out geom tags;`;

const centre = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
console.log(`Area "${name}", box ${b}`);
console.log(`Check it: https://www.openstreetmap.org/#map=15/${centre[0].toFixed(5)}/${centre[1].toFixed(5)}`);

let data = null, lastErr = null;
for (const url of MIRRORS) {
  try {
    console.log('Asking', url, '...');
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'undead-lab-osm-fetch/1.0 (https://github.com/richid-stack/undead-lab)' }, body: 'data=' + encodeURIComponent(query), signal: AbortSignal.timeout(240000) });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    data = await r.json(); break;
  } catch (e) { lastErr = e; console.warn('  failed:', e.message) }
}
if (!data) { console.error('All Overpass servers failed:', lastErr && lastErr.message); process.exit(1) }

const counts = {};
for (const e of data.elements) { const k = e.tags ? (e.tags.building ? 'building' : e.tags.highway ? 'highway' : e.tags.railway ? 'railway' : e.tags.waterway ? 'waterway' : e.tags.barrier ? 'barrier' : e.tags.power ? 'power' : 'other') : 'untagged'; counts[k] = (counts[k] || 0) + 1 }

const out = { name, bbox, fetched: new Date().toISOString(), attribution: '(c) OpenStreetMap contributors, ODbL 1.0, https://www.openstreetmap.org/copyright', osm3s: data.osm3s, counts, elements: data.elements };
const file = resolve(ROOT, 'data', 'osm', `${name}.json`);
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, JSON.stringify(out));
console.log('Elements:', data.elements.length, JSON.stringify(counts));
console.log('Wrote', file);
