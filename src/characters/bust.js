/**
 * bust.js
 * Photoscanned head bust builder (human / zombie variants).
 */
import * as THREE from 'three';
import { clamp, cvs, camera, glow, glbOf, imgTex } from '../core/engine.js';
import { injectBio } from '../shaders/bio.js';
import { eyeball } from './gear/common.js';
// ====================================== PHOTOSCAN BUSTS ======================================
export let HEAD = null;
export async function loadHeadAssets() {
  if (HEAD) return HEAD;
  const gltf = await glbOf('d_head'); let mesh; gltf.scene.traverse(o => { if (o.isMesh) mesh = o });
  const [col, nrm, spc] = await Promise.all([imgTex('d_head_col'), imgTex('d_head_nrm', { srgb: false }), imgTex('d_head_spc', { srgb: false })]);
  const img = spc.image, [c, g] = cvs(img.width, img.height); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) { const s = d.data[i] / 255, r = clamp(.9 - .6 * Math.pow(s, .8), .26, .92) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = r }
  g.putImageData(d, 0, 0); const rough = new THREE.CanvasTexture(c); rough.anisotropy = 8;
  return HEAD = { mesh, col, nrm, rough };
}
export function uvAnchor(geo, u0, v0, rad = .03) {
  const pos = geo.attributes.position, uv = geo.attributes.uv, nor = geo.attributes.normal, p = new THREE.Vector3(), n = new THREE.Vector3(), t = new THREE.Vector3(); let c = 0;
  for (let i = 0; i < pos.count; i++) { const du = uv.getX(i) - u0, dv = uv.getY(i) - v0; if (du * du + dv * dv < rad * rad) { p.add(t.fromBufferAttribute(pos, i)); n.add(t.fromBufferAttribute(nor, i)); c++ } }
  return { p: p.multiplyScalar(1 / Math.max(c, 1)), n: n.normalize(), c };
}
export const _rc = new THREE.Raycaster();
export function surf(mesh, x, y) { _rc.set(new THREE.Vector3(x, y, 20), new THREE.Vector3(0, 0, -1)); const h = _rc.intersectObject(mesh, false)[0]; return h ? h.point : null }

// opts: zombie 0..1, human 0..1, eyes 'live'|'dead', blood, grime, glow, wounds:[[ux,uy,radiusM,type]] (scan-space x,y)
export async function buildBust(o = {}) {
  const H = await loadHeadAssets(), geo = H.mesh.geometry;
  const mat = new THREE.MeshPhysicalMaterial({ map: H.col, normalMap: H.nrm, normalScale: new THREE.Vector2(1, 1), roughnessMap: H.rough, roughness: 1, metalness: 0,
    sheen: o.zombie ? 0 : .65, sheenRoughness: .42, sheenColor: new THREE.Color(0xffc4aa), clearcoat: o.zombie ? .02 : .1, clearcoatRoughness: .3, specularIntensity: 1 });
  const head = new THREE.Mesh(geo, mat); head.castShadow = head.receiveShadow = true; head.updateMatrixWorld(true);
  const wounds = (o.wounds || []).map(w => { const p = surf(head, w[0], w[1]); if (!p) { console.warn('wound ray missed', w); return null } return [p.x * .05, p.y * .05, p.z * .05, w[2], w[3] || 0] }).filter(Boolean); // scan units -> metres
  const U = injectBio(mat, { scale: .05, skin: 1, human: o.human ?? 1, zombie: o.zombie || 0, sss: o.sss ?? 1, pores: o.pores ?? 1.2, grime: o.grime || 0, blood: o.blood || 0, glow: o.glow || 0, glowCol: o.glowCol, seed: o.seed || 1, bump: 1,
    wounds: wounds.map(w => [w[0], w[1], w[2], w[3], w[4]]), tint: o.tint });
  U.uEyeHole.value = 1; U.uEyes.value[0].set(.416, .707); U.uEyes.value[1].set(.585, .707); U.uEyeR.value.set(.041, .0185);
  const bust = new THREE.Group(); bust.add(head);
  const eyes = [];
  for (const [u, s] of [[.416, 1], [.585, -1]]) {
    const a = uvAnchor(geo, u, .707, .028), r = .255, e = eyeball(o.eyes || 'live', r, 4 + (s > 0 ? 0 : 3));
    e.position.set(a.p.x, a.p.y, a.p.z - r * .72); bust.add(e); eyes.push(e);
  }
  // soft dark "socket" behind eyes so hole edges never show the void
  const sock = new THREE.Mesh(new THREE.SphereGeometry(.3, 24, 16), new THREE.MeshBasicMaterial({ color: 0x40201a }));
  eyes.forEach(e => { const s = sock.clone(); s.position.copy(e.position).add(new THREE.Vector3(0, 0, -.1)); bust.add(s) });
  bust.scale.setScalar(.05);
  const root = new THREE.Group(); root.add(bust);
  const lt = new THREE.Vector3(), dir = new THREE.Vector3(), qz = new THREE.Quaternion();
  return { root, bust, head, mat, U, eyes, wounds,
    update(dt, t) {                                                   // eyes follow the camera (clamped), subtle head sway
      bust.rotation.y = Math.sin(t * .35) * .12; bust.rotation.x = Math.sin(t * .27) * .02; bust.updateMatrixWorld(true);
      lt.copy(camera.position); bust.worldToLocal(lt);
      for (const e of eyes) { dir.copy(lt).sub(e.position).normalize(); if (dir.z < .85) { dir.z = .85; dir.normalize() } qz.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir); e.quaternion.slerp(qz, .2) }
    } };
}
