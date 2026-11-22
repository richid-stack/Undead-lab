/**
 * oni.js
 * Oni Night collection (original three characters).
 */
import * as THREE from 'three';
import { key, gtex, glbOf } from '../core/engine.js';
import { oniGear, guardGear, keeperGear, lantern } from './gear/oni.js';
import { P_, Q_, Sc_, play, findClip } from './factory.js';
// ====================================== ONI NIGHT (original three) ======================================
export async function buildOni() {
  const group = new THREE.Group(), chars = {};
  async function make(key, id, x, height, info, gear, handLantern) {
    const gltf = await glbOf(id), m = gltf.scene; group.add(m); m.position.set(x, 0, 0); m.rotation.y = info.turn || 0;
    m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material && o.material.map) o.material.map.anisotropy = 8 } });
    const bones = {}; m.traverse(o => { if (o.isBone) bones[o.name.replace('mixamorig', '')] = o });
    const wy = b => { b.updateWorldMatrix(true, false); return b.getWorldPosition(new THREE.Vector3()).y };
    m.updateMatrixWorld(true); const raw = (wy(bones.Head) - Math.min(wy(bones.LeftToeBase), wy(bones.RightToeBase))) / .9;
    m.scale.setScalar(height / raw); m.updateMatrixWorld(true);
    m.position.y = -(Math.min(wy(bones.LeftToeBase), wy(bones.RightToeBase)) - .025); m.updateMatrixWorld(true);
    const head = bones.Head, hq = new THREE.Quaternion(); head.getWorldQuaternion(hq); const rest = hq.clone().invert();
    const acc = gear ? gear() : null; if (acc) { group.add(acc); if (info.gs) acc.scale.setScalar(info.gs) }
    const mixer = new THREE.AnimationMixer(m), acts = {}; gltf.animations.forEach(a => acts[a.name] = mixer.clipAction(a));
    const c = { key, m, mixer, acts, bones, acc, rest, info, lant: handLantern ? lantern(handLantern.color) : null, hand: handLantern ? bones[handLantern.hand] : null, x };
    if (c.lant) group.add(c.lant); chars[key] = c; return c;
  }
  const [g, o, k] = await Promise.all([
    make('guard', 'd_michelle', -1.9, 1.68, '', guardGear, { hand: 'LeftHand', color: 0xff9a4a }),
    make('oni', 'd_soldier', 0, 1.85, { turn: Math.PI, gs: 1.55 }, oniGear),
    make('keeper', 'd_xbot', 1.9, 1.78, '', keeperGear, { hand: 'RightHand', color: 0xffc060 })]);
  k.m.traverse(x => { if (x.isMesh && x.material) { const n = x.material.name || ''; x.material = x.material.clone(); if (/surface/i.test(n)) { x.material.color.set(0xe8cf9a); x.material.emissive = new THREE.Color(0x7a4210); x.material.emissiveIntensity = .7 } else x.material.color.set(0x3a2a1c) } });
  o.m.traverse(x => { if (x.isMesh && x.material) { x.material = x.material.clone(); x.material.color.set(0x8a5254); x.material.roughness = .7 } });
  // embers
  const ember = (() => { const n = 60, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), s = new Float32Array(n); for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - .5) * .9; p[i * 3 + 1] = Math.random() * 2.2; p[i * 3 + 2] = (Math.random() - .5) * .9; s[i] = .2 + Math.random() * .8 }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3)); const m = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xff7a30, size: .035, map: gtex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.userData.s = s; return m })();
  group.add(ember);
  Object.assign(window, { __chars: chars });
  const follow = (c, t) => {
    if (c.acc) { const h = c.bones.Head; h.matrixWorld.decompose(P_, Q_, Sc_); c.acc.position.copy(P_); c.acc.quaternion.copy(Q_).multiply(c.rest) }
    if (c.lant) { c.hand.getWorldPosition(P_); c.lant.position.set(P_.x, P_.y - .3, P_.z + .02); c.lant.rotation.z = Math.sin(t * 2 + c.x) * .06 }
  };
  return {
    group, chars,
    views: {
      lineup: { p: [0, 1.5, 6.2], t: [0, .95, 0], n: ['Character lab', 'Drag to orbit, pinch or scroll to zoom'] },
      guard: { p: [-1.9, 1.35, 2.6], t: [-1.9, 1.0, 0], n: ['The Lantern Guard', 'Hero: headband, lantern, sneakers'] },
      oni: { p: [0, 1.35, 2.6], t: [0, 1.0, 0], n: ['The Oni', 'Horned mask, spiked mane, red armour'] },
      keeper: { p: [1.9, 1.35, 2.6], t: [1.9, 1.0, 0], n: ['The Keeper', 'Straw hat, lantern, quiet watcher'] },
    },
    buttons: ['lineup', 'guard', 'oni', 'keeper'], anims: ['Idle', 'Walk', 'Run'],
    update(dt, t) {
      Object.values(chars).forEach(c => c.mixer.update(dt)); group.updateMatrixWorld(true); Object.values(chars).forEach(c => follow(c, t));
      const p = ember.geometry.attributes.position, s = ember.userData.s; for (let i = 0; i < p.count; i++) { let y = p.getY(i) + dt * s[i] * .5; if (y > 2.4) y = 0; p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(t * 2 + i) * dt * .04) } p.needsUpdate = true;
    },
    setAnim(w) { for (const c of Object.values(chars)) play(c, findClip(c, w.toLowerCase())) },
  };
}

