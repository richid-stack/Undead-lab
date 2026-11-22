/**
 * heroes.js
 * Heroes collection: armoured trooper and android knight.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { $, rng, clamp, cvs, glow } from '../core/engine.js';
import { BIO_T } from '../shaders/bio.js';
import { attachAt, bindPos, bioBody } from './gear/common.js';
import { play, findClip, makeBody } from './factory.js';

// =====================================================================================
//  HEROES
// =====================================================================================
export function capeMesh(w = .5, h = .95, color = '#7a1620', trim = '#d9a93a', seed = 2) {
  const [c, g] = cvs(256, 512), R = rng(seed); const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, color); gr.addColorStop(1, '#2a070c'); g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(0,0,0,${.06 + R() * .1})`; g.lineWidth = 2 + R() * 6; g.beginPath(); const x = R() * 256; g.moveTo(x, 0); g.bezierCurveTo(x + 20, 170, x - 25, 340, x + R() * 30, 512); g.stroke() }
  g.fillStyle = trim; g.fillRect(0, 488, 256, 24); g.fillRect(0, 0, 256, 16); g.fillRect(0, 0, 10, 512); g.fillRect(246, 0, 10, 512);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const geo = new THREE.PlaneGeometry(w, h, 10, 16); geo.translate(0, -h / 2, 0);
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 + (-y / h) * .35)) } geo.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: .7, sheen: .4, sheenColor: new THREE.Color(0x7aa8ff), sheenRoughness: .5, side: THREE.DoubleSide });
  mat.onBeforeCompile = sh => {
    sh.uniforms.uT = BIO_T;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat hg=clamp(-transformed.y*1.4,0.,1.);transformed.z-=hg*hg*.16+sin(uT*1.4+transformed.y*4.+transformed.x*6.)*.035*hg;transformed.x+=sin(uT*.9+transformed.y*3.)*.02*hg;');
  };
  mat.customProgramCacheKey = () => 'cape';
  const m = new THREE.Mesh(geo, mat); m.castShadow = true; return m;
}
export function metalMat(color, o = {}) { return new THREE.MeshPhysicalMaterial({ color, metalness: .92, roughness: .28, clearcoat: .6, clearcoatRoughness: .2, envMapIntensity: 1.3, ...o }) }
// brushed/scratched metal texture helper for plates
export function plateTex(base, seed = 1, line = '#00000040') {
  const R = rng(seed), [c, g] = cvs(512, 512); g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) { g.strokeStyle = `rgba(${R() < .5 ? 255 : 0},${R() < .5 ? 255 : 0},${R() < .5 ? 255 : 0},${.02 + R() * .07})`; g.lineWidth = .5 + R(); const y = R() * 512, x = R() * 512; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 + R() * 120, y + (R() - .5) * 4); g.stroke() }
  g.strokeStyle = line; g.lineWidth = 3; g.strokeRect(14, 14, 484, 484); g.beginPath(); g.moveTo(14, 256); g.lineTo(498, 256); g.stroke();
  g.fillStyle = 'rgba(0,0,0,.35)'; for (const [x, y] of [[34, 34], [478, 34], [34, 478], [478, 478]]) { g.beginPath(); g.arc(x, y, 7, 0, 6.283); g.fill() }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
export function plate(w, h, d, color, seed, rad = .012) { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 5, rad), metalMat(0xffffff, { map: plateTex(color, seed), color: 0xffffff })); m.castShadow = true; return m }
export function energyCore(r = .035, col = 0x5fd0ff) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.TorusGeometry(r * 1.5, r * .22, 12, 40), metalMat(0xb9c4cf, { roughness: .2 })));
  const core = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2.2) })); g.add(core);
  const gl = glow(col, r * 9); gl.material.opacity = .9; g.add(gl); g.add(new THREE.PointLight(col, .6, 1.6, 2)); return g;
}
export function energyBlade(len = .85, col = 0x5fd0ff) {
  const g = new THREE.Group();
  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(.016, .018, .2, 16), metalMat(0x2a2f36, { roughness: .35 })); g.add(hilt);
  const guard = new THREE.Mesh(new RoundedBoxGeometry(.1, .014, .03, 3, .005), metalMat(0xd9a93a, { roughness: .25 })); guard.position.y = .105; g.add(guard);
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(.011, .013, len, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2.5) })); blade.position.y = .11 + len / 2; g.add(blade);
  const halo = new THREE.Mesh(new THREE.CylinderGeometry(.028, .03, len, 14, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false })); halo.position.copy(blade.position); g.add(halo);
  const tip = glow(col, .25); tip.position.y = .11 + len; g.add(tip); const pl = new THREE.PointLight(col, .9, 2.5, 2); pl.position.set(0, .5, 0); g.add(pl); return g;
}

export async function buildHeroes() {
  const group = new THREE.Group(), bodies = [], fx = [];
  // ---------------- VANGUARD PRIME ----------------
  const vx = -1.3, v = await makeBody('d_soldier', { x: vx, height: 1.85, turn: Math.PI });
  bioBody(v, {
    bio: { rec: .92, recA: [.98, .8, .42], recB: [.05, .07, .11], circ: 1.1, glowCol: 0x59c7ff, wear: .85, grime: .12, blood: 0, seed: 12, pores: 0, bump: 1, skin: 0 },
    perMat: (m, n) => /visor/i.test(n) ? { rec: 0, circ: 0, wear: 0, grime: 0 } : {},
    wounds: [],
  });
  v.meshes.forEach(m => [].concat(m.material).forEach(mm => { if (/visor/i.test(mm.name)) { mm.emissive = new THREE.Color(0x2fa8e8); mm.emissiveIntensity = .22; mm.roughness = .08; mm.metalness = .2; mm.color.set(0x050b14) } else { mm.metalness = .8; mm.roughness = .34 } }));
  { const core = energyCore(.03); attachAt(v, 'Spine2', core, [0, 1.42, .16]); }
  { const cape = capeMesh(.52, 1.0, '#1b4fa0', '#d9a93a', 4); attachAt(v, 'Spine2', cape, [0, 1.62, -.19]) }
  { const blade = energyBlade(.8, 0x5fd0ff); attachAt(v, 'RightHand', blade, [-.76, 1.594, -.06], [0, 0, -Math.PI / 2]) }
  v.pose = null; bodies.push(v); group.add(v.root);
  // ---------------- AEGIS: ceramic android knight (X Bot) ----------------
  const ax = 1.3, a = await makeBody('d_xbot', { x: ax, height: 1.78, turn: 0 });
  bioBody(a, {
    bio: { rec: .85, recA: [.78, .76, .72], recB: [.1, .11, .13], circ: 1.5, glowCol: 0xffc24a, wear: .6, grime: .1, seed: 31, pores: 0, skin: 0 },
    perMat: (m, n) => /joint/i.test(n) ? { rec: .9, recA: [.2, .21, .24], recB: [.03, .03, .04], circ: 0, wear: .2 } : {},
    wounds: [],
  });
  a.meshes.forEach(m => [].concat(m.material).forEach(mm => { if (/joint/i.test(mm.name)) { mm.metalness = .6; mm.roughness = .45 } else { mm.metalness = .35; mm.roughness = .2 } }));
  console.log('AEGIS BONES', JSON.stringify({ hips: bindPos(a, 'Hips'), spine2: bindPos(a, 'Spine2'), neck: bindPos(a, 'Neck'), head: bindPos(a, 'Head'), lsh: bindPos(a, 'LeftShoulder'), lfa: bindPos(a, 'LeftForeArm'), lh: bindPos(a, 'LeftHand'), lul: bindPos(a, 'LeftUpLeg'), ll: bindPos(a, 'LeftLeg'), lf: bindPos(a, 'LeftFoot') }));
  // armour kit (bind-pose coordinates, root-local metres)
  const pearl = (o = {}) => metalMat(0xd9d4c8, { roughness: .3, metalness: .5, clearcoat: 1, clearcoatRoughness: .1, envMapIntensity: .7, ...o }), gold = () => metalMat(0xd9a93a, { roughness: .22 });
  const add = (bone, obj, pos, rot) => { obj.traverse(o => { if (o.isMesh) o.castShadow = true }); return attachAt(a, bone, obj, pos, rot) };
  add('Spine2', Object.assign(new THREE.Mesh(new RoundedBoxGeometry(.31, .25, .17, 6, .05), pearl()), {}), [0, 1.41, .03]);
  { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new RoundedBoxGeometry(.24 - i * .02, .055, .13, 4, .02), pearl()); m.position.y = -i * .06; g.add(m) } add('Spine1', g, [0, 1.25, .045]) }
  add('Spine2', energyCore(.028, 0xffc24a), [0, 1.43, .125]);
  add('Hips', new THREE.Mesh(new THREE.TorusGeometry(.125, .014, 12, 48), gold()), [0, 1.09, 0], [Math.PI / 2, 0, 0]);
  { const h = new THREE.Group(); const dome = new THREE.Mesh(new THREE.SphereGeometry(.122, 40, 28), pearl({ roughness: .18 })); dome.scale.set(.92, 1.08, 1.04); h.add(dome);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(.118, 32, 20, -.7, 1.4, 1.25, .55), new THREE.MeshPhysicalMaterial({ color: 0x03070d, emissive: 0xffc24a, emissiveIntensity: .3, roughness: .05, metalness: .3, clearcoat: 1 })); visor.rotation.y = Math.PI / 2 - .03; visor.scale.set(1.04, 1.04, 1.04); h.add(visor);
    const crest = new THREE.Mesh(new RoundedBoxGeometry(.014, .08, .2, 3, .006), gold()); crest.position.set(0, .12, -.01); h.add(crest);
    add('Head', h, [0, 1.665, -.005]) }
  for (const s of [-1, 1]) {
    const nm = s < 0 ? 'Right' : 'Left';
    add(nm + 'Arm', new THREE.Mesh(new THREE.SphereGeometry(.088, 28, 18, 0, 6.283, 0, 1.45), pearl()), [s * .2, 1.5, -.012]);
    add(nm + 'ForeArm', new THREE.Mesh(new THREE.CylinderGeometry(.052, .044, .21, 24), pearl()), [s * .56, 1.468, -.05], [0, 0, Math.PI / 2]);
    add(nm + 'ForeArm', new THREE.Mesh(new THREE.TorusGeometry(.05, .008, 10, 28), gold()), [s * .46, 1.468, -.05], [0, Math.PI / 2, 0]);
    add(nm + 'Leg', new THREE.Mesh(new THREE.CylinderGeometry(.066, .052, .31, 24), pearl()), [s * .082, .34, .004]);
    add(nm + 'UpLeg', new THREE.Mesh(new RoundedBoxGeometry(.1, .22, .12, 4, .03), pearl()), [s * .09, .86, .035]);
    add(nm + 'Leg', new THREE.Mesh(new THREE.SphereGeometry(.052, 20, 14), gold()), [s * .082, .56, .06]);
  }
  add('Spine2', capeMesh(.46, 1.05, '#16336e', '#d9a93a', 6), [0, 1.52, -.115]);
  bodies.push(a); group.add(a.root);
  return {
    group, bodies,
    views: {
      lineup: { p: [0, 1.5, 5.8], t: [0, 1.0, 0], n: ['Heroes', 'Drag to orbit · pinch to zoom'] },
      vanguard: { p: [vx, 1.4, 2.8], t: [vx, 1.0, 0], n: ['Vanguard Prime', 'Recoloured armour, energy circuitry, plasma blade, cape'] },
      aegis: { p: [ax, 1.35, 2.7], t: [ax, 1.0, 0], n: ['Aegis', 'Ceramic android knight'] },
    },
    buttons: ['lineup', 'vanguard', 'aegis'], anims: ['Idle', 'Walk', 'Run'],
    update(dt, t) { bodies.forEach(c => c.mixer.update(dt)) },
    setAnim(n) { bodies.forEach(c => { const nm = findClip(c, n.toLowerCase()); play(c, nm) }) },
  };
}
