/**
 * models.js
 * Detailed, multi-part weapon models built from bevelled side-profile extrusions, lathes and rounded boxes.
 * Shared by the weapons lab page and by play mode. Conventions:
 *   - metres; +z is forward (the muzzle), +y up, +x is the gun's right side
 *   - the origin is the middle of the grip, where the shooting hand sits
 *   - every builder returns { group, muzzle, parts, pose(state), rest } where
 *       muzzle = Object3D at the end of the barrel (world position = where tracers start)
 *       pose({ fire, reload, empty }) moves the working parts. fire = seconds-normalised 0..1 since the shot (or -1),
 *       reload = 0..1 progress (0 = not reloading), empty = the magazine is empty (slide stays back / hammer down)
 *       rest = [{ z, y, w }] points on the underside where a stand can support the gun (lab only)
 * Real-world proportions, but the designs are generic: no brand markings.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { steel, polymer, wood, brass, cloth, matte, paint, boxUV } from './materials.js';

const sm = t => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t) };
/** slide / bolt travel over one shot: snaps back, returns more slowly */
const pulse = k => k < 0 || k >= 1 ? 0 : k < .16 ? sm(k / .16) : Math.max(0, 1 - sm((k - .16) / .6));
/** magazine out and back in over one reload */
const magCurve = r => r <= 0 ? 0 : r < .28 ? sm(r / .28) : r < .5 ? 1 : r < .8 ? 1 - sm((r - .5) / .3) : 0;

// ---------- geometry helpers ----------
function roundedPath(path, pts, r) {
  const n = pts.length, rad = i => Array.isArray(r) ? r[i] : r, P = i => new THREE.Vector2(...pts[(i + n) % n]);
  for (let i = 0; i < n; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), a = p0.clone().sub(p1), b = p2.clone().sub(p1), la = a.length(), lb = b.length(); a.divideScalar(la); b.divideScalar(lb);
    const ang = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)); let d = rad(i) / Math.tan(ang / 2); d = Math.min(d, la * .5, lb * .5); if (!isFinite(d) || d < 0) d = 0;
    const s = p1.clone().addScaledVector(a, d), e = p1.clone().addScaledVector(b, d);
    if (i === 0) path.moveTo(s.x, s.y); else path.lineTo(s.x, s.y);
    path.quadraticCurveTo(p1.x, p1.y, e.x, e.y);
  }
  path.closePath();
}
/** side profile ([z, y] points) extruded to width w along x, with bevelled edges and rounded corners */
function slab(pts, r, w, m, { bevel = .0012, holes = [], hr = .003, uv = false, uvScale = .3 } = {}) {
  const sh = new THREE.Shape(); roundedPath(sh, pts, r);
  for (const h of holes) { const p = new THREE.Path(); roundedPath(p, h, hr); sh.holes.push(p) }
  const depth = Math.max(.0004, w - 2 * bevel);
  let geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * .85, bevelSegments: 2, curveSegments: 5 });
  geo.translate(0, 0, -depth / 2); geo.rotateY(-Math.PI / 2); geo = toCreasedNormals(geo, .75); if (uv) boxUV(geo, uvScale);
  return new THREE.Mesh(geo, m);
}
const at = (o, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); return o };
const box = (w, h, d, x, y, z, m, r = .001) => { const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * .98); return at(new THREE.Mesh(g, m), x, y, z) };
const rod = (r, len, z0, y, x, m, seg = 20) => { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateX(Math.PI / 2); g.translate(x, y, z0 + len / 2); return new THREE.Mesh(g, m) };
/** profile = [[radius, z], ...] revolved around the z axis, centred at (x, y) */
const lathe = (profile, x, y, m, seg = 24) => { const g = new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(r, z)), seg); g.rotateX(Math.PI / 2); g.translate(x, y, 0); return new THREE.Mesh(g, m) };
const cylX = (r, len, x, y, z, m, seg = 14) => { const g = new THREE.CylinderGeometry(r, r, len, seg); g.rotateZ(Math.PI / 2); return at(new THREE.Mesh(g, m), x, y, z) };
const ball = (r, x, y, z, m) => at(new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), m), x, y, z);
/** a curved band ([z, y] centre line, thickness t) as a closed polygon, for curved magazines */
function ribbon(center, t) {
  const L = [], R = [];
  center.forEach((p, i) => {
    const a = center[Math.max(0, i - 1)], b = center[Math.min(center.length - 1, i + 1)]; let tz = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tz, ty); tz /= l; ty /= l;
    L.push([p[0] - ty * t / 2, p[1] + tz * t / 2]); R.push([p[0] + ty * t / 2, p[1] - tz * t / 2]);
  });
  return L.concat(R.reverse());
}
const finish = g => { g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } }); return g };

// =====================================================================================
//  PISTOL: generic 9 mm, polymer frame, steel slide
// =====================================================================================
export function buildPistol() {
  const root = new THREE.Group(), body = new THREE.Group(); body.position.z = .035; root.add(body);
  const slideM = steel({ color: 0x575c64, rough: .46, wear: .6, grime: .18, seed: 1 }), partM = steel({ color: 0x666a72, rough: .5, wear: .5, grime: .3, seed: 2 });
  const pol = polymer({ color: 0x26272a }), black = matte(0x040405, .8), white = paint(0xf0efe8, .45);

  body.add(slab([[-.076, .021], [.100, .021], [.100, .002], [.076, .002], [.075, -.016], [.067, -.037], [.052, -.046], [.026, -.046], [.019, -.040], [.019, -.012], [-.076, -.012]], [.003, .003, .002, .003, .004, .006, .005, .003, .002, .002, .003], .023, pol,
    { holes: [[[.027, -.005], [.066, -.005], [.062, -.021], [.053, -.035], [.028, -.036]]], hr: .003, uv: true, uvScale: .08 }));
  body.add(slab([[-.068, .019], [.020, .019], [.017, -.015], [-.015, -.108], [-.101, -.108], [-.080, -.050]], [.003, .004, .004, .004, .006, .004], .031, pol, { uv: true, uvScale: .08, bevel: .0016 }));
  // grip finger grooves on the front strap
  for (let i = 0; i < 3; i++) body.add(box(.0325, .0032, .0022, 0, -.03 - i * .017, .0128 - i * .0048, black, .0008));
  const slide = new THREE.Group(); body.add(slide);
  slide.add(slab([[-.076, .018], [-.076, .051], [.095, .051], [.118, .046], [.120, .030], [.116, .018]], [.003, .003, .004, .006, .004, .003], .0265, slideM));
  for (let i = 0; i < 7; i++) slide.add(box(.0279, .025, .0013, 0, .0335, -.067 + i * .0058, black, .0004));     // rear serrations
  slide.add(box(.0012, .015, .05, .0133, .0385, .02, black, .0004));                                             // ejection port
  slide.add(box(.0012, .0028, .028, .0133, .0185, .002, partM, .0004));
  slide.add(rod(.0058, .021, .108, .034, 0, partM)); slide.add(rod(.0034, .0006, .1288, .034, 0, black));            // barrel crown + bore
  slide.add(box(.0035, .0075, .007, 0, .0545, .104, partM, .0006)); slide.add(rod(.0013, .0008, .0997, .0556, 0, white, 10));
  for (const s of [-1, 1]) { slide.add(box(.0035, .006, .008, s * .0042, .0545, -.065, partM, .0006)); slide.add(rod(.0012, .0008, -.0610, .0548, s * .0042, white, 10)) }
  body.add(at(slab([[-.010, .012], [.030, .012], [.033, .019], [-.012, .019]], .002, .0035, partM, { bevel: .0006 }), -.0132));       // slide lock lever
  body.add(box(.004, .007, .007, -.0165, -.017, .016, partM, .0015));                                                            // magazine release
  body.add(slab([[.033, .004], [.040, .004], [.047, -.026], [.039, -.031], [.034, -.012]], .0012, .0068, partM, { bevel: .0007 })); // trigger
  const mag = new THREE.Group(); body.add(mag);
  mag.add(box(.0225, .106, .060, 0, -.057, -.054, partM, .001));
  mag.add(slab([[-.101, -.108], [-.014, -.108], [-.0135, -.117], [-.103, -.117]], .0014, .027, pol, { bevel: .0008 }));
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, .034, .131); body.add(muzzle);
  const slideRest = slide.position.z;
  return {
    group: finish(root), muzzle, parts: { slide, mag }, rest: [{ z: -.024, y: -.117, w: .03 }, { z: .087, y: -.046, w: .02 }],
    pose({ fire = -1, reload = 0, empty = false } = {}) {
      const lock = empty && reload < .55 ? .96 : 0; slide.position.z = slideRest - .034 * Math.max(pulse(fire), lock);
      const m = magCurve(reload); mag.position.y = -.105 * m; mag.position.z = -.012 * m;
    },
  };
}

// =====================================================================================
//  RIFLE: generic 7.62 assault rifle, stamped receiver, wood furniture, banana magazine
// =====================================================================================
export function buildRifle() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const recM = steel({ color: 0x585c61, rough: .5, wear: .6, grime: .3, seed: 3 }), partM = steel({ color: 0x666a6f, rough: .5, wear: .6, grime: .3, seed: 4 }), magM = steel({ color: 0x60646a, rough: .52, wear: .55, grime: .35, seed: 5 });
  const bake = polymer({ color: 0x3a2116, rough: .5, bump: 1.1 }), black = matte(0x040405, .8);
  const hg = wood({ tone: '#8a4a22', dark: '#3a1a08', seed: 11, figure: .5, rough: .42, varnish: .65 }), stockW = wood({ tone: '#86471f', dark: '#341606', seed: 12, figure: .6, rough: .42, varnish: .65 });

  body.add(slab([[-.118, .030], [-.118, .095], [.205, .095], [.205, .030]], .004, .034, recM));                                   // receiver
  body.add(slab([[-.118, .092], [-.106, .108], [.150, .108], [.205, .098], [.205, .090]], [.003, .008, .006, .004, .003], .036, recM));  // dust cover
  for (const z of [-.05, .0, .05, .10]) body.add(box(.0362, .0022, .0035, 0, .1095, z, black, .0005));
  body.add(box(.0016, .030, .150, .0172, .062, .055, black, .0004));                                                              // ejection port (right side)
  const bolt = new THREE.Group(); body.add(bolt);
  bolt.add(box(.0016, .026, .058, .0172, .062, .060, steel({ color: 0x8a8d92, rough: .35, wear: .7, grime: .2, seed: 6 }), .0005));
  bolt.add(box(.012, .007, .010, .0245, .082, .045, partM, .002)); bolt.add(box(.007, .013, .016, .0325, .082, .045, partM, .003));    // charging handle
  body.add(box(.003, .007, .100, .0185, .050, -.005, partM, .0012)); body.add(box(.005, .013, .014, .0195, .054, -.045, partM, .002));   // selector
  body.add(rod(.0105, .21, .20, .098, 0, partM));                                                                              // gas tube
  body.add(slab([[.222, .098], [.222, .126], [.395, .126], [.395, .098]], .006, .040, hg, { uv: true }));                            // upper handguard
  body.add(slab([[.205, .032], [.205, .098], [.345, .098], [.352, .092], [.352, .036], [.345, .032]], .005, .045, hg, { uv: true })); // lower handguard
  body.add(rod(.0085, .335, .19, .070, 0, partM));                                                                             // barrel
  body.add(box(.028, .034, .030, 0, .082, .41, partM, .003)); body.add(box(.020, .030, .020, 0, .090, .47, partM, .002));         // gas block, front sight base
  body.add(box(.0036, .030, .0036, 0, .118, .47, partM, .0008));
  body.add(rod(.0035, .13, .345, .040, 0, partM, 10));                                                                        // cleaning rod
  body.add(lathe([[.0086, .49], [.0106, .495], [.0106, .540], [.0092, .546]], 0, .070, partM)); body.add(rod(.0092, .0008, .5452, .070, 0, partM, 20)); body.add(rod(.0036, .0006, .5459, .070, 0, black, 10));
  body.add(box(.016, .016, .050, 0, .112, .23, partM, .002)); body.add(box(.0034, .010, .006, -.0045, .124, .245, partM, .0008)); body.add(box(.0034, .010, .006, .0045, .124, .245, partM, .0008)); // rear sight
  body.add(slab([[-.015, .040], [.035, .040], [.037, -.010], [.027, -.105], [-.035, -.105], [-.037, -.030]], [.004, .004, .004, .004, .008, .004], .034, bake, { uv: true, uvScale: .08 }));   // pistol grip
  body.add(slab([[-.004, .034], [.080, .034], [.078, .000], [.066, -.022], [.010, -.022], [-.004, -.010]], [.003, .003, .004, .005, .004, .003], .022, partM, { holes: [[[.012, .026], [.070, .026], [.068, .002], [.060, -.014], [.016, -.014]]], hr: .003 })); // trigger guard
  body.add(slab([[.040, .030], [.046, .030], [.050, .001], [.043, -.004]], .0015, .0065, partM, { bevel: .0007 }));
  body.add(slab([[-.118, .098], [-.380, .068], [-.385, -.060], [-.355, -.074], [-.118, .030]], [.002, .012, .005, .006, .002], .036, stockW, { uv: true }));   // stock
  body.add(slab([[-.378, .069], [-.390, .066], [-.395, -.062], [-.384, -.074], [-.371, -.070]], .002, .040, partM, { bevel: .0012 })); // butt plate
  const mag = new THREE.Group(); body.add(mag);
  const mc = [[.095, .034], [.100, .000], [.113, -.040], [.136, -.082], [.165, -.118], [.200, -.148]];
  mag.add(slab(ribbon(mc, .040), .004, .033, magM, { bevel: .0012 }));
  for (let i = 1; i < mc.length - 1; i++) { const a = mc[i - 1], b = mc[i + 1], rib = box(.0346, .0032, .042, 0, mc[i][1], mc[i][0], black, .0008); rib.rotation.x = Math.atan2(b[0] - a[0], b[1] - a[1]); mag.add(rib) }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, .070, .548); body.add(muzzle);
  return {
    group: finish(root), muzzle, parts: { bolt, mag }, rest: [{ z: -.37, y: -.074, w: .04 }, { z: .19, y: -.148, w: .03 }],
    pose({ fire = -1, reload = 0, empty = false } = {}) {
      bolt.position.z = -.032 * (empty && reload < .5 ? .85 : pulse(fire));
      const m = magCurve(reload); mag.position.y = -.14 * m; mag.position.z = .03 * m;
    },
  };
}

// =====================================================================================
//  DANE GUN: long-barrelled percussion muzzle-loader as made by Ghanaian blacksmiths and used by hunters
// =====================================================================================
export function buildDane() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const iron = steel({ color: 0x625c55, rough: .58, wear: .75, grime: .6, seed: 7, bare: 0xa8957d, env: 1.1 }), lockM = steel({ color: 0x716b63, rough: .5, wear: .7, grime: .45, seed: 8, bare: 0xb09f88 });
  const raw = wood({ tone: '#826036', dark: '#34200e', seed: 21, figure: .7, rough: .72, varnish: .05, wearTint: 1.2 }), rod2 = wood({ tone: '#8b6a3e', dark: '#3a220e', seed: 22, figure: .3, rough: .7, varnish: 0 });
  const br = brass(.34), red = cloth(0x9a1b1b), black = matte(0x040405, .8);
  body.add(slab([[-.445, .012], [-.30, .040], [-.12, .040], [-.03, .036], [.56, .034], [.56, .004], [.12, .000], [.03, -.040], [.00, -.075], [-.07, -.088], [-.11, -.060], [-.19, -.040], [-.28, -.045], [-.40, -.100], [-.445, -.115]],
    [.006, .02, .01, .01, .005, .005, .01, .012, .012, .012, .015, .02, .03, .01, .005], .036, raw, { uv: true, uvScale: .3 }));                          // stock
  body.add(rod(.0125, .20, -.04, .045, 0, iron, 8)); body.add(rod(.0106, .78, .16, .045, 0, iron, 22)); body.add(rod(.0118, .035, .905, .045, 0, iron, 22)); body.add(rod(.0132, .008, .152, .045, 0, iron, 22)); // barrel
  body.add(rod(.0072, .0006, .9396, .045, 0, black, 12)); body.add(ball(.0028, 0, .0585, .915, br));                           // bore + brass bead
  body.add(at(slab([[-.095, .018], [-.010, .018], [.000, .030], [-.010, .048], [-.095, .044], [-.100, .030]], .004, .004, lockM, { bevel: .0009 }), .0195));   // lock plate
  for (const z of [-.078, -.018]) body.add(cylX(.0034, .0022, .0215, .033, z, br, 12));
  const nip = new THREE.Mesh(new THREE.CylinderGeometry(.0034, .0046, .015, 12), iron); nip.position.set(.0125, .0635, .0); body.add(nip);
  const hammer = new THREE.Group(); hammer.position.set(.0217, .030, -.062); body.add(hammer);
  hammer.add(slab([[-.006, -.006], [.007, -.006], [.008, .030], [.030, .042], [.058, .046], [.060, .036], [.036, .026], [.020, .012], [.018, -.004]], [.002, .002, .008, .008, .004, .004, .006, .004, .002], .0062, lockM, { bevel: .0009 }));
  const gd = slab([[-.135, -.045], [-.030, -.045], [-.033, -.095], [-.070, -.125], [-.110, -.120], [-.135, -.090]], [.004, .004, .008, .012, .01, .008], .007, br, { holes: [[[-.122, -.054], [-.045, -.054], [-.048, -.090], [-.072, -.113], [-.105, -.108], [-.123, -.084]]], hr: .006, bevel: .0009 });
  body.add(gd); body.add(slab([[-.085, -.048], [-.078, -.048], [-.072, -.078], [-.080, -.080]], .0012, .0045, iron, { bevel: .0007 }));
  body.add(slab([[-.443, .014], [-.452, .008], [-.456, -.114], [-.446, -.118]], .002, .038, br, { bevel: .001 }));                  // butt plate
  body.add(slab([[.545, .036], [.567, .036], [.567, .002], [.545, .002]], .003, .038, br, { bevel: .001 }));                      // nose cap
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) body.add(ball(.0029, s * .0184, .026 + i * .0016, -.30 + i * .03, br));    // tacks along the stock
  for (const z of [.16, .29, .42]) { const t = new THREE.Mesh(new THREE.TorusGeometry(.03, .0056, 8, 28), red); t.scale.set(.74, 1.2, 1); t.position.set(0, .022, z); body.add(t) }     // cord wraps
  for (const z of [.064, .074, .084]) { const t = new THREE.Mesh(new THREE.TorusGeometry(.0295, .0024, 6, 28), br); t.scale.set(.76, 1.2, 1); t.position.set(0, .022, z); body.add(t) }   // brass wire round the wrist
  body.add(rod(.0045, .30, .56, .0285, 0, rod2, 10)); body.add(rod(.0085, .014, .80, .0315, 0, br, 12));                         // ramrod tip + pipe
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, .045, .94); body.add(muzzle);
  return {
    group: finish(root), muzzle, parts: { hammer }, rest: [{ z: -.40, y: -.11, w: .04 }, { z: .45, y: .004, w: .04 }],
    pose({ fire = -1, reload = 0, empty = false } = {}) {
      let c = 1; if (empty) c = 0; if (fire >= 0 && fire < 1) c = fire < .03 ? 1 - fire / .03 : 0; if (reload > 0) c = reload < .6 ? 0 : sm((reload - .6) / .3);
      hammer.rotation.x = -.95 * c;
    },
  };
}

export const BUILDERS = { pistol: buildPistol, rifle: buildRifle, dane: buildDane };
