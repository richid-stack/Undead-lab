/**
 * world.js
 * The test street: a 112 x 78 m walled yard with an asphalt road, a side road, open drains, laterite earth and a few
 * West-African-style buildings (compound houses, a shop row, kiosks, a chop bar, a container shop and an unfinished
 * concrete frame), electricity poles, trees and street clutter. Everything solid also gets a Rapier collider.
 *
 * Geometry is collected per material and merged once at the end (a few dozen draw calls instead of thousands).
 * This is a deliberately simple stand-in: the real Ghana streets come from OpenStreetMap later (docs/ROADMAP.md, M4).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, glow } from '../core/engine.js';
import * as T from './textures.js';

const V = new THREE.Vector3(), Q = new THREE.Quaternion(), E = new THREE.Euler(), M4 = new THREE.Matrix4(), ONE = new THREE.Vector3(1, 1, 1);
const PI = Math.PI;

function boxGeo(w, h, d, tile = 3) {                          // world-metre UVs so one texture tiles evenly on any size
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) { const [a, b] = dims[f]; for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * a / tile, uv.getY(k) * b / tile) } }
  return g;
}

export function buildStreet(P) {
  const group = new THREE.Group(), R = rng(11), batches = new Map(), lights = [];

  // ---------- materials ----------
  const S = (o) => new THREE.MeshStandardMaterial(o);
  const over = (m, f = -2) => { m.polygonOffset = true; m.polygonOffsetFactor = f; m.polygonOffsetUnits = f; return m };
  const mLat = S({ map: T.laterite(), bumpMap: T.laterite(), bumpScale: 2, roughness: 1 });
  const mAsph = over(S({ map: T.asphalt(), bumpMap: T.asphalt(), bumpScale: 1.5, roughness: .93 }));
  const mAsph2 = over(S({ map: T.asphalt(), bumpMap: T.asphalt(), bumpScale: 1.5, roughness: .93 }), -3);
  const mConc = S({ map: T.concrete(), bumpMap: T.concrete(), bumpScale: 1.5, color: 0xe6d8c2, roughness: .9 });
  const mConcFlat = over(S({ map: T.concrete(), bumpMap: T.concrete(), bumpScale: 1.5, color: 0xe6d8c2, roughness: .9 }), -4);
  const mDrain = over(S({ map: T.concrete(), color: 0x6e6a60, roughness: .95 }), -3);
  const mConcRaw = S({ map: T.concrete(), bumpMap: T.concrete(), bumpScale: 1.5, color: 0xa7a197, roughness: .95 });
  const wallCache = {};
  const wall = hex => wallCache[hex] ||= S({ map: T.stucco(), bumpMap: T.stucco(), bumpScale: 2, color: hex, roughness: .92 });
  const mRoof = S({ map: T.corrugated(), bumpMap: T.corrugated(), bumpScale: 3, roughness: .6, metalness: .35, side: THREE.DoubleSide });
  const mRoof2 = S({ map: T.corrugated(), bumpMap: T.corrugated(), bumpScale: 3, color: 0xcfc4b8, roughness: .6, metalness: .35, side: THREE.DoubleSide });
  const mShutter = S({ map: T.shutter(), roughness: .55, metalness: .5 });
  const mSteel = S({ color: 0x3b3f44, roughness: .5, metalness: .6 });
  const mGlass = S({ color: 0x1b2a38, roughness: .12, metalness: .4 });
  const mLit = S({ color: 0x1a1008, emissive: 0xff9440, emissiveIntensity: .62, roughness: .6 });
  const mWood = S({ color: 0x6d4a2e, roughness: .85 });
  const mWoodLight = S({ color: 0xa87a4a, roughness: .85 });
  const mBark = S({ color: 0x4a3626, roughness: 1 });
  const mLeafA = S({ map: T.foliage(), alphaTest: .5, color: 0xd8e8c0, roughness: .85 });
  const mLeafB = S({ map: T.foliage(), alphaTest: .5, color: 0xf0f4c8, roughness: .85 });
  const mTank = S({ color: 0x15181b, roughness: .45 });
  const mWire = S({ color: 0x0c0c0e, roughness: .6 });
  const mPole = S({ color: 0x5b5247, roughness: .95 });
  const mRebar = S({ color: 0x6a3a22, roughness: .7, metalness: .6 });
  const plastic = [0xd8352a, 0x2a62c9, 0xe8e4da, 0x2f9a58].map(c => S({ color: c, roughness: .55 }));
  const drum = [0x2a62c9, 0xc0392b, 0x2f8a52, 0xd8a31e].map(c => S({ color: c, roughness: .5, metalness: .5 }));
  const cont = (c) => S({ color: c, roughness: .5, metalness: .55, map: T.shutter() });

  // ---------- batching ----------
  function put(mat, geo, x, y, z, ry = 0, rx = 0, rz = 0, nrm = null) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()); E.set(rx, ry, rz); Q.setFromEuler(E); M4.compose(V.set(x, y, z), Q, ONE); g.applyMatrix4(M4);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (g.groups) g.clearGroups();
    if (nrm) { const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, nrm.x, nrm.y, nrm.z) }
    (batches.get(mat) || batches.set(mat, []).get(mat)).push(g);
  }
  /** solid box. y0 = bottom. */
  const bx = (mat, x, y0, z, w, h, d, o = {}) => {
    const { tile = 3, solid = true, ry = 0, rz = 0 } = o; put(mat, boxGeo(w, h, d, tile), x, y0 + h / 2, z, ry, 0, rz);
    if (solid) P.box(x, y0 + h / 2, z, w / 2, h / 2, d / 2, ry);
  };
  const cyl = (mat, x, y0, z, r, h, seg = 14, solid = true, rt = r) => { put(mat, new THREE.CylinderGeometry(rt, r, h, seg), x, y0 + h / 2, z); if (solid) P.cylinder(x, y0 + h / 2, z, h / 2, Math.max(r, rt)) };
  const plane = (mat, x, y, z, w, d, tile, ry = 0) => {
    const g = new THREE.PlaneGeometry(w, d), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tile, uv.getY(i) * d / tile);
    g.rotateX(-PI / 2); put(mat, g, x, y, z, ry);
  };
  const quad = (mat, x, y, z, w, h, ry = 0) => put(mat, new THREE.PlaneGeometry(w, h), x, y, z, ry);   // vertical, faces +z at ry=0
  const fz2ry = fz => fz > 0 ? 0 : PI;
  const addGlow = (c, size, x, y, z) => { const g = glow(c, size); g.material.opacity = .5; g.position.set(x, y, z); lights.push(g) };

  // ---------- reusable bits ----------
  function windowAt(x, y0, z, ry, w = 1.1, h = 1.2, lit = false) {
    const c = new THREE.Vector3(), f = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)), rt = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry));
    const at = (lx, ly, lz) => c.set(x, y0 + ly, z).addScaledVector(rt, lx).addScaledVector(f, lz).toArray();
    const part = (mat, lx, ly, lz, ww, hh, dd) => { const p = at(lx, ly, lz); put(mat, boxGeo(ww, hh, dd, 1), p[0], p[1], p[2], ry) };
    const gp = at(0, h / 2, .02); put(lit ? mLit : mGlass, new THREE.PlaneGeometry(w, h), gp[0], gp[1], gp[2], ry);
    part(mSteel, 0, h + .03, .03, w + .12, .06, .08); part(mSteel, 0, -.03, .06, w + .22, .06, .16);
    part(mSteel, -w / 2 - .03, h / 2, .03, .06, h + .12, .08); part(mSteel, w / 2 + .03, h / 2, .03, .06, h + .12, .08);
    const nb = Math.round(w / .14); for (let i = 1; i < nb; i++) part(mSteel, -w / 2 + i * w / nb, h / 2, .08, .016, h, .016);
    for (const k of [.25, .55, .85]) part(mSteel, 0, h * k, .08, w, .016, .016);
  }
  function doorAt(x, y0, z, ry, color = 0x3d5a80, w = 1.0, h = 2.1) {
    const f = [Math.sin(ry), Math.cos(ry)];
    const m = S({ color, roughness: .6, metalness: .3 }), p = (o) => [x + f[0] * o, z + f[1] * o];
    const a = p(.03); put(m, boxGeo(w, h, .06, 1), a[0], y0 + h / 2, a[1], ry);
    put(mSteel, boxGeo(w + .16, .08, .1, 1), p(.04)[0], y0 + h + .04, p(.04)[1], ry);
    const r = [Math.cos(ry), -Math.sin(ry)];
    for (const s of [-1, 1]) put(mSteel, boxGeo(.08, h + .08, .1, 1), x + r[0] * s * (w / 2 + .04) + f[0] * .04, y0 + h / 2, z + r[1] * s * (w / 2 + .04) + f[1] * .04, ry);
    put(mSteel, boxGeo(.04, .14, .05, 1), x + r[0] * .36 + f[0] * .08, y0 + 1.0, z + r[1] * .36 + f[1] * .08, ry);
  }
  function gableRoof(x, y, z, w, d, mat = mRoof, a = .2) {                   // ridge along x; y = top of walls
    const hd = d / 2 + .4, L = hd / Math.cos(a), rise = hd * Math.tan(a);
    for (const s of [1, -1]) put(mat, boxGeo(w + .9, .06, L, 1.5), x, y + rise / 2 + .03, z + s * hd / 2, 0, s * a);
    return rise;
  }
  function gableEnds(x, y, z, w, d, color, a = .2) {
    const hd = d / 2, rise = hd * Math.tan(a), sh = new THREE.Shape([new THREE.Vector2(-hd, 0), new THREE.Vector2(hd, 0), new THREE.Vector2(0, rise)]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: .24, bevelEnabled: false });
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 3, uv.getY(i) / 3);
    for (const s of [-1, 1]) put(wall(color), g, x + s * (w / 2 - (s > 0 ? .24 : 0)), y, z, PI / 2);
  }
  function chair(x, z, ry, mat) {
    put(mat, boxGeo(.42, .04, .42, 1), x, .45, z, ry);
    const c = Math.cos(ry), s = Math.sin(ry); put(mat, boxGeo(.42, .4, .04, 1), x - s * .2, .68, z - c * .2, ry);
    for (const [lx, lz] of [[-.18, -.18], [.18, -.18], [-.18, .18], [.18, .18]]) put(mat, boxGeo(.035, .45, .035, 1), x + lx * c + lz * s, .225, z - lx * s + lz * c, ry);
    P.box(x, .45, z, .22, .45, .22);
  }
  function table(x, z) { put(mWoodLight, boxGeo(.9, .04, .9, 1), x, .74, z); for (const [lx, lz] of [[-.4, -.4], [.4, -.4], [-.4, .4], [.4, .4]]) put(mSteel, boxGeo(.04, .72, .04, 1), x + lx, .36, z + lz); P.box(x, .4, z, .46, .4, .46) }
  function crate(x, z, n = 1) { for (let i = 0; i < n; i++) bx(mWood, x + (i % 2) * .05, i * .42, z + (i % 2) * .04, .62, .42, .46, { tile: .6 }) }
  function tree(x, z, s = 1, cards = 34) {
    cyl(mBark, x, 0, z, .26 * s, 3.2 * s, 8, true, .15 * s);
    for (let b = 0; b < 3; b++) { const a = b * 2.1 + R(); put(mBark, new THREE.CylinderGeometry(.06 * s, .1 * s, 1.9 * s, 6), x + Math.cos(a) * .55 * s, 3.6 * s, z + Math.sin(a) * .55 * s, 0, Math.sin(a) * .7, -Math.cos(a) * .7) }
    const cy = 4.6 * s, rr = 2.0 * s;
    for (let i = 0; i < cards; i++) {
      const u = R() * 2 - 1, th = R() * PI * 2, rad = Math.sqrt(1 - u * u), d = new THREE.Vector3(rad * Math.cos(th), u * .75, rad * Math.sin(th)), k = (.55 + R() * .45) * rr;
      const px = x + d.x * k, py = cy + d.y * k, pz = z + d.z * k, sz = (1.5 + R() * 1.0) * s, ry = R() * PI, rx = (R() - .5) * 1.1, rz = (R() - .5) * 1.1, nrm = d.clone().normalize(), mat = i % 2 ? mLeafA : mLeafB, g = new THREE.PlaneGeometry(sz, sz);
      put(mat, g, px, py, pz, ry, rx, rz, nrm); put(mat, g, px, py, pz, ry + PI, -rx, -rz, nrm);
    }
  }
  function tank(x, y0, z, s = 1) {
    put(mTank, new THREE.CylinderGeometry(.55 * s, .6 * s, 1.0 * s, 20), x, y0 + .5 * s, z);
    put(mTank, new THREE.SphereGeometry(.55 * s, 20, 8, 0, PI * 2, 0, PI / 2), x, y0 + 1.0 * s, z);
  }
  function signBoard(text, bg, fg, sub, w, h, x, y, z, ry) {
    const m = S({ map: T.sign(text, bg, fg, sub), roughness: .7 }); put(m, new THREE.PlaneGeometry(w, h), x, y, z, ry);
  }
  /** compound wall around a rectangle, with an optional gate gap on the z0 or z1 side */
  function compound(x0, x1, z0, z1, color, gate = null, h = 1.9) {
    const wm = wall(color), t = .24, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const seg = (xa, xb, z) => { if (xb - xa > .05) bx(wm, (xa + xb) / 2, 0, z, xb - xa, h, t, { tile: 2 }) };
    for (const side of [z0, z1]) {
      if (gate && gate.z === side) { seg(x0, gate.x - gate.w / 2, side); seg(gate.x + gate.w / 2, x1, side) } else seg(x0, x1, side);
    }
    bx(wm, x0, 0, cz, t, h, z1 - z0, { tile: 2 }); bx(wm, x1, 0, cz, t, h, z1 - z0, { tile: 2 });
    for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) bx(wm, px, 0, pz, .45, h + .25, .45, { tile: 1 });
    if (gate) {                                                              // two steel gate leaves swung half-open
      const s = gate.z === z1 ? 1 : -1;
      const gm = S({ color: 0x356b8f, roughness: .5, metalness: .4 }); bx(gm, gate.x - gate.w / 2 + .05, .05, gate.z + s * .5, .06, 1.7, 1.0, { tile: 1 }); bx(gm, gate.x + gate.w / 2 - .05, .05, gate.z + s * .5, .06, 1.7, 1.0, { tile: 1 });
    }
  }
  function house({ x, z, w = 9, d = 6, floors = 1, color = '#f1e2c0', fz = 1, roof = 'gable', door = 0x3d5a80, lit = [] }) {
    const wm = wall(color), H = floors * 3, ry = fz2ry(fz);
    bx(mConc, x, 0, z, w + .5, .2, d + .5, { tile: 2 });
    bx(wm, x, .2, z, w, H, d, { tile: 3 });
    const front = z + fz * d / 2;
    doorAt(x - w * .28, .2, front, ry, door);
    for (let f = 0; f < floors; f++) {
      const y = .2 + f * 3 + 1.0;
      if (f) windowAt(x - w * .28, y, front, ry, 1.0, 1.3, lit.includes(f * 10 + 0));
      windowAt(x + w * .06, y, front, ry, 1.1, 1.2, lit.includes(f * 10 + 1)); windowAt(x + w * .34, y, front, ry, 1.1, 1.2, lit.includes(f * 10 + 2));
      for (const s of [-1, 1]) { windowAt(x + s * (w / 2), y, z + d * .15, s > 0 ? PI / 2 : -PI / 2, 1.0, 1.2); windowAt(x + s * (w / 2), y, z - d * .25, s > 0 ? PI / 2 : -PI / 2, 1.0, 1.2) }
    }
    if (floors > 1) {                                                         // balcony with railing
      bx(mConc, x - w * .1, 2.95 + .2, front + fz * .75, w * .62, .16, 1.5, { tile: 2 });
      const bw = w * .62; for (let i = 0; i <= bw / .16; i++) put(mSteel, boxGeo(.025, .95, .025, 1), x - w * .1 - bw / 2 + i * .16, 3.2 + .45, front + fz * 1.5, 0);
      put(mSteel, boxGeo(bw, .05, .05, 1), x - w * .1, 3.2 + .95, front + fz * 1.5);
    }
    if (roof === 'gable') { gableRoof(x, .2 + H, z, w, d, mRoof); gableEnds(x, .2 + H, z, w, d, color) }
    else {
      bx(mConc, x, .2 + H, z, w + .1, .18, d + .1, { tile: 2 }); for (const s of [-1, 1]) { bx(wm, x, .2 + H + .18, z + s * d / 2, w + .1, .55, .18, { tile: 2, solid: false }); bx(wm, x + s * w / 2, .2 + H + .18, z, .18, .55, d, { tile: 2, solid: false }) }
    }
    return { front };
  }
  function kiosk(x, z, fz, body, text, sub, awn = 0xd23a2a) {
    const ry = fz2ry(fz), bm = S({ color: body, roughness: .55, metalness: .25, map: T.corrugated(), bumpMap: T.corrugated(), bumpScale: 2 });
    bx(bm, x, 0, z, 2.6, 2.3, 2.1, { tile: 1.6 });
    const f = z + fz * 1.05;
    quad(mGlass, x, 1.45, f + fz * .02, 1.6, .85, ry); put(mLit, new THREE.PlaneGeometry(1.5, .75), x, 1.45, f + fz * .03, ry);
    put(mWood, boxGeo(1.9, .07, .35, 1), x, 1.0, f + fz * .17, ry);
    signBoard(text, '#1c3f7a', '#ffe14d', sub, 2.4, .62, x, 2.66, f + fz * .02, ry);
    const am = S({ color: awn, roughness: .7, side: THREE.DoubleSide }); put(am, boxGeo(2.9, .05, 1.1, 1), x, 2.05, f + fz * .55, 0, fz * .2);
    for (const s of [-1, 1]) cyl(mSteel, x + s * 1.35, 0, f + fz * 1.05, .03, 2.1, 6, false);
    addGlow(0xffb060, 2.2, x, 1.6, f + fz * .5);
    crate(x + 1.9, z + fz * .2, 2); crate(x - 1.8, z + fz * .1, 1);
  }

  // ===================== ground, roads, drains =====================
  plane(mLat, 0, 0, 0, 114, 80, 4);
  plane(mAsph, 0, .012, 0, 114, 8, 8);
  plane(mAsph2, 20, .016, 21.5, 35, 8, 8, PI / 2);
  plane(mDrain, 0, .02, -4.9, 114, .9, 2);
  plane(mDrain, -19.5, .02, 4.9, 71, .9, 2); plane(mDrain, 39.5, .02, 4.9, 31, .9, 2);
  plane(mConcFlat, -17, .022, -6.5, 22, 3.4, 2);                              // apron in front of the shops
  plane(mConcFlat, -45, .022, 6.4, 16, 2.0, 2);

  // boundary: a painted block wall all round
  const BW = wall('#d9ccb0'); for (const [bx_, bz_, w, d] of [[0, -39.5, 116, .5], [0, 39.5, 116, .5], [-57.5, 0, .5, 80], [57.5, 0, .5, 80]]) bx(BW, bx_, 0, bz_, w, 2.7, d, { tile: 3 });
  P.box(0, -.5, 0, 70, .5, 50);                                               // the ground

  // ===================== north side (z < 0, fronts face the road at +z) =====================
  // A: compound house with a gate
  compound(-52, -34, -26, -8, '#e9d9b4', { z: -8, x: -42.5, w: 3.4 });
  house({ x: -43, z: -18, w: 10, d: 6, color: '#f1c9a0', fz: 1, door: 0x2f6f5a, lit: [1] });
  tree(-37.5, -22, 1.1); chair(-48, -12, .4, plastic[0]); chair(-47.2, -11.6, -.3, plastic[0]); table(-47.6, -12.6);
  tank(-49.5, 0, -23, 1);
  // B: shop row (4 shops, shutters + signs + awning)
  const shopX0 = -28, shopW = 5.2, names = [['PROVISIONS', '#1e5a3a', '#fff3c4', 'ALL KINDS OF GOODS'], ['CHOP BAR', '#7a1f1f', '#ffe9a8', 'FUFU · BANKU · RICE'], ['PHONE REPAIRS', '#173a63', '#ffe14d', 'SCREENS · BATTERIES'], ['SALON', '#5d2a6b', '#ffe9f3', 'BRAIDS · BARBER']];
  bx(wall('#e8dcc0'), shopX0 + shopW * 2, 0, -10, shopW * 4, 3.6, 5.5, { tile: 3 });
  bx(mConc, shopX0 + shopW * 2, 3.6, -10, shopW * 4 + .2, .2, 5.7, { tile: 2 });
  for (let i = 0; i < 4; i++) {
    const cx = shopX0 + shopW * (i + .5), openShop = i % 2 === 1;
    if (openShop) { quad(mLit, cx, 1.2, -7.22, shopW - 1.4, 2.0, 0); quad(S({ color: 0x120a06 }), cx, 1.2, -7.24, shopW - 1.3, 2.1, 0) }
    else bx(mShutter, cx, .05, -7.18, shopW - 1.2, 2.3, .08, { tile: 1.2, solid: false });
    signBoard(...names[i], shopW - .7, .95, cx, 3.0, -7.15, 0);
    bx(mSteel, cx - shopW / 2, 0, -7.0, .14, 3.0, .14, { tile: 1 });
    addGlow(openShop ? 0xffb060 : 0xffd89a, 2.6, cx, 1.5, -6.5);
  }
  bx(mSteel, shopX0 + shopW * 4, 0, -7.0, .14, 3.0, .14, { tile: 1 });
  put(S({ color: 0xc23b2b, roughness: .7, side: THREE.DoubleSide }), boxGeo(shopW * 4 + .6, .06, 2.1, 1), shopX0 + shopW * 2, 3.05, -6.2, 0, .18);
  for (let i = 0; i < 3; i++) windowAt(shopX0 + shopW * (i + .5) + shopW * .6, 3.9, -7.22, 0, .9, .0001, false);
  tank(-17, 3.8, -10.5, 1.15); tank(-14, 3.8, -10.5, 1.15);
  crate(-9, -6.2, 3); crate(-27.4, -6.0, 2);
  for (const [dx, dz, a] of [[-20, -5.6, 0], [-19, -5.4, .6], [-21.4, -5.5, -.4]]) chair(dx, dz, a, plastic[(dx | 0) & 3]);
  table(-20.1, -5.9);
  // C: unfinished two-storey concrete frame (rebar on top)
  { const ux = 6, uz = -15, w = 12, d = 8;
    bx(mConcRaw, ux, 0, uz, w + .6, .22, d + .6, { tile: 2 });
    for (const lvl of [0, 1]) {
      const y0 = .22 + lvl * 3.1;
      for (const cxo of [-w / 2, -w / 6, w / 6, w / 2]) for (const czo of [-d / 2, d / 2]) bx(mConcRaw, ux + cxo, y0, uz + czo, .34, 3.0, .34, { tile: 1 });
      bx(mConcRaw, ux, y0 + 3.0, uz, w + .5, .22, d + .5, { tile: 2 });
    }
    for (const cxo of [-w / 2, -w / 6, w / 6, w / 2]) for (const czo of [-d / 2, d / 2]) for (let k = 0; k < 4; k++) put(mRebar, new THREE.CylinderGeometry(.012, .012, 1.4, 5), ux + cxo + (k % 2 - .5) * .16, .22 + 6.2 + .22 + .7, uz + czo + (k > 1 ? .08 : -.08), 0, (R() - .5) * .12, (R() - .5) * .12);
    const bm = S({ map: T.concrete(), color: 0xb0a99d, roughness: .95 });
    bx(bm, ux, .22, uz - d / 2, w, 3.0, .22, { tile: 1.2 });                      // block back wall (ground floor)
    bx(bm, ux - w / 2, .22, uz, .22, 3.0, d, { tile: 1.2 });
    bx(bm, ux + w / 2, .22, uz + d / 4, .22, 3.0, d / 2 - 1.8, { tile: 1.2 });
    bx(bm, ux, 3.32, uz - d / 2, w * .55, 1.4, .22, { tile: 1.2 });
    for (let k = 0; k < 6; k++) cyl(mWood, ux - w / 2 - .7 + (k % 2) * .1, 0, uz + d / 2 + 1.2 - k * .9, .05, 6.0 - (k % 3) * .8, 6, false);
    bx(mWood, ux - w / 2 - .7, 3.0, uz + 1.2, .08, .08, 4.2, { tile: 1, solid: false });
    for (let k = 0; k < 5; k++) bx(bm, ux + 7.2 + (k % 3) * .45, (k > 2 ? .2 : 0), uz + 1 + (k % 2) * .3, .4, .2, .2, { tile: .5 });
  }
  // D: east compound with a two-storey house
  compound(28, 52, -30, -9, '#cfe2d0', { z: -9, x: 40, w: 3.6 });
  house({ x: 40, z: -20, w: 11, d: 7.5, floors: 2, color: '#e6c76a', fz: 1, roof: 'flat', door: 0xa83a2c, lit: [1, 12] });
  tree(31.5, -13, 1.2); tree(48.5, -26, 1); tank(32, 0, -27, 1);
  // kiosks along the drain
  kiosk(-34.2, -7.0, 1, 0xc9372c, 'RECHARGE CARDS', 'AIRTIME · DATA');
  kiosk(14.6, -7.0, 1, 0x2d7d46, 'COLD DRINKS', 'WATER · MALT · SOBOLO', 0x1d4c9a);
  kiosk(25.8, -7.0, 1, 0xe39a22, 'PROVISION', 'BREAD · EGGS · TOM BROWN', 0xc23b2b);

  // ===================== south side (z > 0, fronts face the road at -z) =====================
  compound(-52, -30, 9, 30, '#bcd8e6', { z: 9, x: -41, w: 3.4 });
  house({ x: -41, z: 19, w: 10, d: 7, floors: 2, color: '#f4efe2', fz: -1, roof: 'flat', door: 0x2e4a7d, lit: [2, 11] });
  tree(-33.5, 25, 1.2); tree(-48, 13, .9); chair(-46, 12, 3.5, plastic[1]); table(-45.2, 12.4);
  // chop bar: open shed on posts, plastic chairs and tables
  { const cx = -13, cz = 13.5, w = 13, d = 6.5;
    for (const [px, pz] of [[-w / 2, -d / 2], [0, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [0, d / 2], [w / 2, d / 2]]) cyl(mWood, cx + px, 0, cz + pz, .09, 2.9, 8);
    put(mRoof2, boxGeo(w + 1.4, .06, d / 2 + .9, 1.5), cx, 3.25, cz - d / 4 - .2, 0, -.17); put(mRoof2, boxGeo(w + 1.4, .06, d / 2 + .9, 1.5), cx, 3.25, cz + d / 4 + .2, 0, .17);
    bx(wall('#8a5a3a'), cx, 0, cz + d / 2 - .4, w - .4, 1.0, .6, { tile: 2 });  // serving counter
    bx(mConc, cx, 0, cz, w + 1.4, .08, d + 1.4, { tile: 2, solid: false });
    signBoard('MAMA ESI CHOP BAR', '#b8321f', '#fff1b8', 'WAAKYE · JOLLOF · KENKEY', 5.2, 1.0, cx, 2.45, cz - d / 2 - .12, PI);
    let k = 0; for (const tx of [-4.5, -.5, 3.5]) { table(cx + tx, cz - 1.2); for (const [dx, dz, a] of [[-.7, -1.2, .3], [.7, -1.3, -.4], [0, -2.1, PI]]) chair(cx + tx + dx, cz + dz + .2, a + (k++) * .1, plastic[k & 3]) }
    addGlow(0xffb060, 3, cx, 2.3, cz - 1);
  }
  // container shop
  bx(cont(0x1f7f8a), 6, 0, 11.5, 6.1, 2.6, 2.44, { tile: 1.5 });
  signBoard('PHONE ACCESSORIES', '#0f2d3a', '#ffe14d', 'CASES · CHARGERS · SIM', 3.8, .9, 6, 2.9, 10.27, PI);
  quad(mLit, 6, 1.35, 10.27, 2.4, 1.0, PI); put(mWood, boxGeo(2.6, .07, .4, 1), 6, 1.0, 10.1);
  crate(9.5, 10.3, 2); crate(2.4, 10.4, 1);
  // east compound (south)
  compound(28, 52, 9, 30, '#efd3d0', { z: 9, x: 40, w: 3.6 });
  house({ x: 40, z: 19, w: 10, d: 6.5, color: '#bfe0c8', fz: -1, door: 0x7a3a2a, lit: [0] });
  tree(46, 25, 1.1); tree(31, 27, 1); tank(48.5, 0, 12, 1); crate(33, 10.6, 2);
  kiosk(14.4, 8.3, -1, 0x2a5fb0, 'MOBILE MONEY', 'SEND · RECEIVE · PAY BILLS', 0xe39a22);
  for (let i = 0; i < 4; i++) { const a = R() * 6; cyl(drum[i], 17.5 + i * .55, 0, 6.5 + (i % 2) * .6, .29, .88, 12) }

  // street trees on the open ground, electricity poles with wires
  tree(-26, 6.5, 1.2); tree(52, -5.5, 1.1); tree(-54.5, 4, 1); tree(12.5, 7.2, 1.1);
  const poleX = [-50, -32, -14, 4, 22, 40, 54];
  for (const px of poleX) {
    cyl(mPole, px, 0, -6.1, .13, 9.4, 8, true, .1);
    bx(mWood, px, 8.4, -6.1, .12, .12, 2.4, { tile: 1, solid: false });
    for (const o of [-1, 0, 1]) cyl(mSteel, px, 8.52, -6.1 + o * 1.0, .03, .22, 6, false);
  }
  for (let i = 0; i < poleX.length - 1; i++) for (const o of [-1, 0, 1]) {
    const a = new THREE.Vector3(poleX[i], 8.7, -6.1 + o), b = new THREE.Vector3(poleX[i + 1], 8.7, -6.1 + o), m = a.clone().lerp(b, .5); m.y -= .55 + (o === 0 ? .1 : 0);
    put(mWire, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, m, b]), 14, .014, 4), 0, 0, 0);
  }

  // beyond the wall: a treeline and a few hazy blocks so the yard does not read as a box in a void
  for (let i = -60; i <= 60; i += 7) { tree(i + R() * 3, -43 - R() * 4, .9 + R() * .5, 22); tree(i + R() * 3, 43 + R() * 4, .9 + R() * .5, 22) }
  for (let i = -36; i <= 36; i += 8) { tree(-62 - R() * 4, i + R() * 3, .9 + R() * .5, 22); tree(62 + R() * 4, i + R() * 3, .9 + R() * .5, 22) }
  for (const [bx_, bz_, w, d, h, c] of [[-30, -52, 14, 9, 7, '#d8b890'], [10, -55, 18, 9, 9, '#c9d3c4'], [44, -53, 12, 8, 6, '#e3c9a8'], [-48, 54, 16, 9, 8, '#cdb8a4'], [8, 56, 14, 8, 10, '#d9d0b8'], [-72, 10, 9, 16, 7, '#d8c4a4'], [74, -14, 9, 14, 8, '#c8d0c0']]) bx(wall(c), bx_, 0, bz_, w, h, d, { tile: 4, solid: false });

  // ---------- flush batches into meshes ----------
  let tris = 0;
  for (const [mat, list] of batches) {
    const g = mergeGeometries(list, false); if (!g) { console.warn('merge failed for a material batch', list.length); continue }
    const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; group.add(mesh); tris += g.attributes.position.count / 3;
    list.forEach(x => x.dispose());
  }
  lights.forEach(l => group.add(l));
  group.userData.tris = tris;
  return { group, spawn: { x: -46, y: 0, z: 1.5 }, heading: PI / 2, bounds: { x0: -56.9, x1: 56.9, z0: -38.9, z1: 38.9 } };
}
