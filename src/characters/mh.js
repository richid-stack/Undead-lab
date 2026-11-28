/**
 * mh.js
 * Realistic people from the MakeHuman base mesh (CC0), built in the browser:
 *   - the BODY is always bare. Gender, age, build, height, ethnicity and the face are "modifiers" (small per-vertex offset files called targets)
 *     that are blended into the base mesh; the skin is a real 2048 px skin texture
 *   - HAIR, CLOTHES, SHOES and HATS are separate meshes ("proxies"). Each one stores, for every vertex, three vertices of the base mesh,
 *     their weights and an offset, so it re-fits itself onto any body shape. Wherever a garment covers the body, the body triangles
 *     below it are dropped (so nothing pokes through, and nothing is drawn twice)
 *   - one skeleton (the "game_engine" rig: 53 bones) is placed inside the finished body; body and every proxy share it, so any garment
 *     moves with the body in every animation
 * Data: public/models/mh (downloaded by tools/fetch-assets.mjs; source NastyFFM/HumanGenWeb, a conversion of the CC0 MakeHuman assets).
 * Everything here is data-driven: a person is a plain object (see PEOPLE in people.js), and the wardrobe can change at any time.
 */
import * as THREE from 'three';

const SCALE = .1;                                   // MakeHuman units are decimetres
const MACROS = ['gender', 'age', 'muscle', 'weight', 'height', 'proportions', 'cupsize', 'firmness'];
const RACES = ['african', 'asian', 'caucasian'];
const BASE = () => import.meta.env.BASE_URL + 'models/mh/';

// ---------- data (loaded once) ----------
let core = null;
const targetCache = new Map(), jsonCache = new Map(), texCache = new Map();
const json = url => { if (!jsonCache.has(url)) jsonCache.set(url, fetch(BASE() + url).then(r => { if (!r.ok) throw new Error('missing ' + url); return r.json() })); return jsonCache.get(url) };
const loader = new THREE.TextureLoader();
export function mhTexture(url, srgb = true) {
  const k = url + srgb; if (!texCache.has(k)) { const t = loader.load(BASE() + url); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; texCache.set(k, t) } return texCache.get(k);
}
async function target(name) {
  if (!targetCache.has(name)) targetCache.set(name, fetch(BASE() + `targets/${name}.bin`).then(r => { if (!r.ok) throw new Error('missing target ' + name); return r.arrayBuffer() }).then(b => {
    const n = new Uint32Array(b, 0, 1)[0]; return { idx: new Uint16Array(b, 4, n), d: new Int16Array(b, 4 + 2 * n, n * 3) };          // deltas in 0.1 mm
  }));
  return targetCache.get(name);
}
export async function mhCore() {
  if (core) return core;
  return core = (async () => {
    const [info, buf, meta, rigInfo, rigBin, eye] = await Promise.all([json('mesh.json'), fetch(BASE() + 'mesh.bin').then(r => r.arrayBuffer()), json('targets.json'), json('rigs/game_engine.json'), fetch(BASE() + 'rigs/game_engine.bin').then(r => r.arrayBuffer()), json('eye.json')]);
    let off = 0; const take = (T, n) => { const a = new T(buf, off, n); off += n * T.BYTES_PER_ELEMENT; return a };
    const basePos = take(Float32Array, info.vertexCount * 3), rvMap = take(Uint32Array, info.renderCount), rvUV = take(Float32Array, info.renderCount * 2), quads = take(Uint32Array, info.quadCornerCount);
    const bytes = new Uint8Array(rigBin), n = bytes.length / 8, ji = new Uint8Array(n * 4), jw = new Uint8Array(n * 4);                      // 4 joints + 4 weights per base vertex
    for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { ji[i * 4 + k] = bytes[i * 8 + k]; jw[i * 4 + k] = bytes[i * 8 + 4 + k] }
    const detail = new Map(); for (const items of Object.values(meta.sections)) for (const it of items) detail.set(it.name, it);
    return { info, basePos, rvMap, rvUV, quads, meta, detail, rig: rigInfo, ji, jw, eye };
  })();
}

/**
 * The library's tees carry the MakeHuman project's logo. The story names no real brand, so the logos are painted out when a texture loads
 * (the same table also fixes one stray detail):
 * each patch is [x, y, w, h, fromX, fromY] in texture pixels (2048 square), copying a clean piece of the same fabric over the logo.
 */
const LOGO_PATCHES = {
  male_casualsuit06: [[915, 250, 355, 165, 915, 430], [415, 246, 214, 86, 415, 345], [1500, 320, 45, 40, 1500, 370]],
  male_casualsuit04: [[1030, 215, 235, 250, 260, 200]], male_casualsuit02: [[1020, 215, 250, 255, 260, 200]],
  female_casualsuit01: [[1468, 331, 303, 286, 480, 331]],
  female_casualsuit02: [[1468, 331, 303, 286, 480, 331], [1545, 815, 130, 135, 250, 950]],          // (the second patch replaces a stray pink button that lands on the shorts' fly)
};
function clothTexture(name) {
  const patches = LOGO_PATCHES[name]; if (!patches) return mhTexture(`proxies/clothes/${name}.webp`);
  const c = document.createElement('canvas'), t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; c.width = c.height = 2048;
  const img = new Image(); img.onload = () => { const g = c.getContext('2d'); g.drawImage(img, 0, 0, 2048, 2048); for (const [x, y, w, h, sx, sy] of patches) g.drawImage(c, sx, sy, w, h, x, y, w, h); t.needsUpdate = true };
  img.src = BASE() + `proxies/clothes/${name}.webp`; return t;
}

/** eye textures; 'darkbrown' is the library's brown iris darkened (its own browns are red and amber) */
function eyeTexture(name) {
  if (name !== 'darkbrown') return mhTexture(`textures/eye_${name}.png`);
  const c = document.createElement('canvas'), t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; c.width = c.height = 1024;
  const img = new Image(); img.onload = () => {
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, 1024, 1024); const d = g.getImageData(0, 0, 1024, 1024), a = d.data;
    for (let i = 0; i < a.length; i += 4) { const sat = a[i] - a[i + 2]; if (sat > 34 && a[i + 3] > 0) { const k = Math.min(1, (sat - 34) / 40); a[i] += (a[i] * .36 - a[i]) * k; a[i + 1] += (a[i + 1] * .3 - a[i + 1]) * k; a[i + 2] += (a[i + 2] * .26 - a[i + 2]) * k } }
    g.putImageData(d, 0, 0); t.needsUpdate = true;
  };
  img.src = BASE() + 'textures/eye_brown.png'; return t;
}

// ---------- the modifier stack (which targets, at which strength, make this body) ----------
function interp(meta, name, value) {
  const out = [];
  for (const p of meta.macro[name].parts) if (value > p.lowest && value < p.highest) { const t = (value - p.lowest) / (p.highest - p.lowest); if (p.low) out.push([p.low, 1 - t]); if (p.high) out.push([p.high, t]) }
  return out;
}
function macroStack(meta, m, cutoff = .01) {
  const c = {}; for (const k of MACROS) c[k] = interp(meta, k, m[k]);
  const sum = RACES.reduce((s, r) => s + m[r], 0) || 1, out = [], push = (n, w) => { if (w > cutoff) out.push([n, w]) };
  for (const r of RACES) for (const [a, aw] of c.age) for (const [g, gw] of c.gender) push(`macrodetails/${r}-${g}-${a}`, m[r] / sum * gw * aw);
  for (const [g, gw] of c.gender) for (const [a, aw] of c.age) for (const [mu, muw] of c.muscle) for (const [w, ww] of c.weight) {
    const base = `${g}-${a}-${mu}-${w}`, bw = gw * aw * muw * ww;
    push(`macrodetails/universal-${base}`, bw);
    for (const [h, hw] of c.height) push(`macrodetails/height/${base}-${h}`, bw * hw);
    if (a !== 'baby') for (const [p, pw] of c.proportions) push(`macrodetails/proportions/${base}-${p}`, bw * pw);
    if (g === 'female' && a !== 'baby') for (const [cu, cuw] of c.cupsize) for (const [f, fw] of c.firmness) if (!(cu === 'averagecup' && f === 'averagefirmness')) push(`breast/${base}-${cu}-${f}`, aw * muw * ww * cuw * fw);
  }
  return out;
}
export const MACRO_DEFAULT = { gender: .5, age: .5, muscle: .5, weight: .5, height: .5, proportions: .5, cupsize: .5, firmness: .5, african: 1, asian: 0, caucasian: 0 };
export function stackOf(core_, spec) {
  const macro = { ...MACRO_DEFAULT, gender: spec.sex === 'f' ? 0 : 1, ...(spec.macro || {}) }, stack = macroStack(core_.meta, macro);
  for (const [name, v] of Object.entries(spec.details || {})) { const it = core_.detail.get(name); if (it) for (const t of (v > 0 ? it.pos : it.neg)) stack.push([t, Math.abs(v)]) }
  return stack.filter(([, w]) => w > .0001);
}

// ---------- geometry helpers ----------
const triIndex = quads => { const t = new Uint32Array(quads.length / 4 * 6); for (let q = 0, i = 0; q < quads.length; q += 4) { t[i++] = quads[q]; t[i++] = quads[q + 1]; t[i++] = quads[q + 2]; t[i++] = quads[q]; t[i++] = quads[q + 2]; t[i++] = quads[q + 3] } return new THREE.BufferAttribute(t, 1) };
/** vertex normals averaged across the texture seams: vertices that are the same point of the base mesh share one normal (`map`: render vertex -> base vertex) */
function smoothNormals(geo, map) {
  const pos = geo.attributes.position.array, idx = geo.index.array, acc = new Float32Array((Math.max(...map) + 1) * 3), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < idx.length; i += 3) {
    a.fromArray(pos, idx[i] * 3); b.fromArray(pos, idx[i + 1] * 3).sub(a); c.fromArray(pos, idx[i + 2] * 3).sub(a); b.cross(c);          // area-weighted
    for (let k = 0; k < 3; k++) { const m = map[idx[i + k]] * 3; acc[m] += b.x; acc[m + 1] += b.y; acc[m + 2] += b.z }
  }
  const n = new Float32Array(pos.length);
  for (let i = 0; i < map.length; i++) { const m = map[i] * 3; a.set(acc[m], acc[m + 1], acc[m + 2]).normalize(); n[i * 3] = a.x; n[i * 3 + 1] = a.y; n[i * 3 + 2] = a.z }
  geo.setAttribute('normal', new THREE.BufferAttribute(n, 3));
}

// ---------- a person ----------
/**
 * spec: { sex: 'm'|'f', macro: {...}, details: {...}, skin: 'young_african_male', skinTint, eyes, eyebrows, eyelashes, hair, hairColor, clothes: [names] }
 * returns a Human: { group (bones + meshes), bones (by game_engine name), skeleton, body, set(slot, name, opts), morphed, ... }
 */
export async function makeHuman(spec) {
  const C = await mhCore(), stack = stackOf(C, spec), loaded = await Promise.all(stack.map(([n]) => target(n)));
  const morphed = new Float32Array(C.basePos);
  stack.forEach(([, w], i) => { const { idx, d } = loaded[i]; w *= .001; for (let k = 0; k < idx.length; k++) { const o = idx[k] * 3; morphed[o] += d[k * 3] * w; morphed[o + 1] += d[k * 3 + 1] * w; morphed[o + 2] += d[k * 3 + 2] * w } });

  // skeleton: each joint sits at the mean of its base-mesh vertices; bones have identity rotation (the bind pose is the mesh's own pose)
  const group = new THREE.Group(), byName = new Map(), heads = new Map();
  const bones = C.rig.bones.map(b => { const o = new THREE.Bone(); o.name = b.name; byName.set(b.name, o); return o });
  C.rig.bones.forEach((b, i) => {
    let h = [0, 0, 0]; if (b.head.length) for (const v of b.head) for (let k = 0; k < 3; k++) h[k] += morphed[v * 3 + k] * SCALE / b.head.length;
    heads.set(b.name, h); const p = b.parent ? heads.get(b.parent) : [0, 0, 0];
    bones[i].position.set(h[0] - p[0], h[1] - p[1], h[2] - p[2]); (b.parent ? byName.get(b.parent) : group).add(bones[i]);
  });
  const skeleton = new THREE.Skeleton(bones); group.updateMatrixWorld(true); skeleton.calculateInverses();

  const skinAttrs = (geo, map, fit) => {                                         // body: the weights of its base vertex; proxy: the blend of its three fit vertices' weights
    const n = geo.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    const wOf = v => [0, 1, 2, 3].map(k => [C.ji[v * 4 + k], C.jw[v * 4 + k] / 255]);
    const set = (i, pairs) => pairs.forEach(([b, w], k) => { si[i * 4 + k] = b; sw[i * 4 + k] = w });
    if (!fit) for (let i = 0; i < n; i++) set(i, wOf(map[i]));
    else {
      const per = fit.map(([v1, v2, v3, w1, w2, w3]) => {
        const acc = new Map(); for (const [v, wv] of [[v1, w1], [v2, w2], [v3, w3]]) for (const [b, w] of wOf(v)) if (w) acc.set(b, (acc.get(b) || 0) + w * wv);
        const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4), tot = top.reduce((s, [, w]) => s + w, 0) || 1; while (top.length < 4) top.push([0, 0]); return top.map(([b, w]) => [b, w / tot]);
      });
      map.forEach((src, i) => set(i, per[src]));
    }
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  };
  const skinned = (geo, mat, name) => { const m = new THREE.SkinnedMesh(geo, mat); m.name = name; m.frustumCulled = false; m.castShadow = m.receiveShadow = true; group.add(m); m.bind(skeleton, new THREE.Matrix4()); return m };           // always bound with the identity: the skeleton's inverses were measured in the unmoved, unscaled pose

  // body
  const bgeo = new THREE.BufferGeometry(), bpos = new Float32Array(C.rvMap.length * 3);
  for (let i = 0; i < C.rvMap.length; i++) { const s = C.rvMap[i] * 3; bpos[i * 3] = morphed[s] * SCALE; bpos[i * 3 + 1] = morphed[s + 1] * SCALE; bpos[i * 3 + 2] = morphed[s + 2] * SCALE }
  bgeo.setAttribute('position', new THREE.BufferAttribute(bpos, 3)); bgeo.setAttribute('uv', new THREE.BufferAttribute(C.rvUV, 2)); bgeo.setIndex(triIndex(C.quads));
  smoothNormals(bgeo, C.rvMap); skinAttrs(bgeo, C.rvMap, null);
  const skin = spec.skin || `young_african_${spec.sex === 'f' ? 'female' : 'male'}`;
  const bodyMat = new THREE.MeshStandardMaterial({ map: mhTexture(`skins/${skin}.jpg`), roughness: .62, metalness: 0 });
  if (spec.skinTint != null) bodyMat.color.set(spec.skinTint);
  const body = skinned(bgeo, bodyMat, 'body');

  // measurements the game needs (metres, in the bind pose)
  let top = -1e9, bottom = 1e9; for (let i = 1; i < bpos.length; i += 3) { top = Math.max(top, bpos[i]); bottom = Math.min(bottom, bpos[i]) }

  const human = { spec, core: C, group, skeleton, bones, byName, body, morphed, height: top - bottom, ground: bottom, items: new Map(), kind: 'mh' };

  // eyes: a proxy of their own, skinned to the head
  const makeProxy = (kind, name, data, opts = {}) => {
    const geo = new THREE.BufferGeometry(), fitted = new Float32Array(data.fit.length * 3), pos = new Float32Array(data.map.length * 3);
    const s = [1, 1, 1]; for (const [axis, [a, b, ref]] of Object.entries(data.scale)) { const k = 'xyz'.indexOf(axis); s[k] = Math.abs(morphed[a * 3 + k] - morphed[b * 3 + k]) / ref }
    data.fit.forEach(([v1, v2, v3, w1, w2, w3, dx, dy, dz], i) => { const d = [dx * s[0], dy * s[1], dz * s[2]]; for (let k = 0; k < 3; k++) fitted[i * 3 + k] = w1 * morphed[v1 * 3 + k] + w2 * morphed[v2 * 3 + k] + w3 * morphed[v3 * 3 + k] + d[k] });
    data.map.forEach((src, i) => { for (let k = 0; k < 3; k++) pos[i * 3 + k] = fitted[src * 3 + k] * SCALE });
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(Float32Array.from(data.uv), 2)); geo.setIndex(triIndex(data.quads));
    smoothNormals(geo, data.map); skinAttrs(geo, data.map, data.fit);
    const url = `proxies/${kind}/${name}`, mat = new THREE.MeshStandardMaterial({ map: kind === 'clothes' ? clothTexture(name) : kind === 'eyes' ? null : mhTexture(url + '.webp'), roughness: opts.roughness ?? .8, metalness: 0, side: THREE.DoubleSide, transparent: !!opts.alpha, alphaTest: opts.alpha ? .25 : 0 });
    if (data.normal) mat.normalMap = mhTexture(url + '_normal.webp', false);
    if (opts.color != null) mat.color.set(opts.color);
    const m = skinned(geo, mat, name); m.userData.hide = data.hide || []; m.userData.kind = kind; return m;
  };
  human.eyes = makeProxy('eyes', 'eyes', C.eye, { roughness: .2, alpha: true });
  human.eyes.material.map = eyeTexture(spec.eyes || 'brown'); human.eyes.material.normalMap = null; human.eyes.name = 'eyes';

  // ---- the wardrobe ----
  const hideBody = () => {                                                       // body triangles whose four corners are all covered by something worn are removed
    const hidden = new Uint8Array(C.info.vertexCount);
    for (const m of human.items.values()) { const h = m.userData.hide; for (let i = 0; i < h.length; i += 2) hidden.fill(1, h[i], h[i + 1] + 1) }
    const keep = [], q = C.quads, r = C.rvMap;
    for (let i = 0; i < q.length; i += 4) if (!(hidden[r[q[i]]] && hidden[r[q[i + 1]]] && hidden[r[q[i + 2]]] && hidden[r[q[i + 3]]])) keep.push(q[i], q[i + 1], q[i + 2], q[i + 3]);
    bgeo.setIndex(triIndex(Uint32Array.from(keep))); smoothNormals(bgeo, C.rvMap);
  };
  /**
   * Put something on (or take it off with name = null). Slots: hair, eyebrows, eyelashes, and any number of clothes whose slot is 'clothes/<anything you like>'.
   * opts: { color (tint), alpha (hair is cut-out), roughness }
   */
  human.set = async (slot, name, opts = {}) => {
    const old = human.items.get(slot); if (old) { group.remove(old); old.geometry.dispose(); human.items.delete(slot) }
    if (name) {
      const kind = slot.split('/')[0], data = await json(`proxies/${kind}/${name}.json`), m = makeProxy(kind, name, data, { alpha: kind === 'hair' || kind === 'eyebrows' || kind === 'eyelashes' || !!opts.alpha, ...opts });
      if (human.items.has(slot)) { group.remove(m); m.geometry.dispose() } else { human.items.set(slot, m); m.userData.name = name; m.userData.slot = slot }
    }
    hideBody(); return human.items.get(slot) || null;
  };
  await Promise.all([
    spec.hair && human.set('hair', spec.hair, { color: spec.hairColor ?? 0x15100c, roughness: .9 }),
    spec.eyebrows !== null && human.set('eyebrows', spec.eyebrows || 'eyebrow001', { color: spec.hairColor ?? 0x15100c, roughness: .9 }),
    spec.eyelashes !== null && human.set('eyelashes', spec.eyelashes || 'eyelashes01', { color: 0x0a0807, roughness: .9 }),
    ...(spec.clothes || []).map(c => human.set('clothes/' + (typeof c === 'string' ? c : c.name), typeof c === 'string' ? c : c.name, typeof c === 'string' ? {} : c)),
  ].filter(Boolean));
  return human;
}
