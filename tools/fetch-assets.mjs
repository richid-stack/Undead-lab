// Downloads the character rigs and the head scan into public/models/.
//
// The binary models are NOT stored in this repository. They come, byte for byte, from the
// three.js examples at the pinned tag below, and every file is checked against a SHA-256
// so a changed or corrupted download fails loudly instead of rendering wrongly.
//
//   npm run assets            (also runs automatically before `npm run dev` and `npm run build`)
//   SKIP_ASSETS=1 npm run build   to skip (for example if you placed the files yourself)
//
// Licences: see docs/ASSETS.md. The Soldier / Xbot / Michelle rigs originate from Mixamo.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TAG = 'r160';
const BASE = `https://raw.githubusercontent.com/mrdoob/three.js/${TAG}/examples/models/gltf/`;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'models');

const FILES = [
  ['Soldier.glb', 'soldier.glb', 'dfb230fc1f942f259dd00281a1186953ad602fc5d69067ce63e24b2aa439736b'],
  ['Xbot.glb', 'xbot.glb', '002f8d269de68e5dce3d25195caf390d1aa359bbfaae3fcf4c8dc78ec36c3ba5'],
  ['Michelle.glb', 'michelle.glb', '7a87e15a99ccbc5e5877be66e1e4ecae0a581adcafa0cce1a5569f49909e968e'],
  ['LeePerrySmith/LeePerrySmith.glb', 'head/head.glb', '402b8a8ac9f03232e6d64b5962929703a069daf99d3c49ac8eb0e48bedc9c576'],
  ['LeePerrySmith/Map-COL.jpg', 'head/col.jpg', 'e976d73b31407f8d0967412bf468019ed26a5d5a32cf5811aabff7e816458a65'],
  ['LeePerrySmith/Infinite-Level_02_Tangent_SmoothUV.jpg', 'head/nrm.jpg', '36925e51ad9b324b94e8faf4692da1b4132809f2762bb8d5bd549ffd215d4ca6'],
  ['LeePerrySmith/Map-SPEC.jpg', 'head/spc.jpg', 'cbb96b60e355b804d9b6c7338372d13ec8cc7adf664f50a00a3d32c66afd293a'],
];

const sha256 = buf => createHash('sha256').update(buf).digest('hex');

async function download(url) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 1000 * attempt)); }
  }
  throw lastErr;
}

if (process.env.SKIP_ASSETS) { console.log('assets: SKIP_ASSETS set, skipping'); process.exit(0); }

let fetched = 0;
for (const [remote, local, hash] of FILES) {
  const dest = join(OUT, local);
  if (existsSync(dest) && sha256(readFileSync(dest)) === hash) continue;
  process.stdout.write(`assets: downloading ${local} ... `);
  let buf;
  try { buf = await download(BASE + remote); } catch (e) {
    console.error(`\nassets: could not download ${BASE + remote}: ${e.message}`);
    console.error('assets: check your internet connection, or download the files by hand into public/models/ (see docs/ASSETS.md).');
    process.exit(1);
  }
  if (sha256(buf) !== hash) {
    console.error(`\nassets: ${local} does not match the expected SHA-256; refusing to use it.`);
    process.exit(1);
  }
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, buf);
  fetched++;
  console.log(`${(buf.length / 1048576).toFixed(1)} MB ok`);
}
console.log(fetched ? `assets: ${fetched} file(s) downloaded` : 'assets: all present and verified');
