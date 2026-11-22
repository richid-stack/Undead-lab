/**
 * factory.js
 * Skinned-body factory: load a rigged GLB, scale to height, bind gear to bones.
 */
import * as THREE from 'three';
import { glbOf } from '../core/engine.js';

// =====================================================================================
//  Collections. Each build() returns { group, views, buttons, update(dt,t), setAnim(name) }
// =====================================================================================
export const P_ = new THREE.Vector3(), Q_ = new THREE.Quaternion(), Sc_ = new THREE.Vector3();
export function play(c, name) { const a = c.acts[name]; if (!a) return; Object.values(c.acts).forEach(o => { if (o !== a) o.fadeOut(.3) }); a.reset().fadeIn(.3).play() }
export const findClip = (c, w) => Object.keys(c.acts).find(n => n.toLowerCase().includes(w)) || Object.keys(c.acts)[0];

// ---------- generic skinned-character factory used by every new body ----------
// opts: id (glb data id), x, height, turn, parse hook
export async function makeBody(id, { x = 0, z = 0, height = 1.8, turn = 0 } = {}) {
  const gltf = await glbOf(id), m = gltf.scene, root = new THREE.Group(); root.add(m); root.position.set(x, 0, z); m.rotation.y = turn;
  m.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; o.frustumCulled = false; if (o.material && o.material.map) o.material.map.anisotropy = 8 } });
  const bones = {}; m.traverse(o => { if (o.isBone) bones[o.name.replace('mixamorig', '')] = o });
  root.updateMatrixWorld(true);
  const wy = b => { b.updateWorldMatrix(true, false); return b.getWorldPosition(new THREE.Vector3()).y };
  const raw = (wy(bones.Head) - Math.min(wy(bones.LeftToeBase), wy(bones.RightToeBase))) / .9;
  m.scale.setScalar(height / raw); m.updateMatrixWorld(true);
  m.position.y = -(Math.min(wy(bones.LeftToeBase), wy(bones.RightToeBase)) - .025); m.updateMatrixWorld(true);
  const mixer = new THREE.AnimationMixer(m), acts = {}; gltf.animations.forEach(a => acts[a.name] = mixer.clipAction(a));
  const meshes = []; m.traverse(o => { if (o.isMesh) meshes.push(o) });
  return { m, root, bones, mixer, acts, meshes, extras: [], pose: null, height, x, rest: {} };
}
// attach a gear group to a bone in world space each frame (orientation relative to bone's bind orientation)
export function bindGear(c, boneName, obj, { local = new THREE.Vector3(), follow = 'full' } = {}) {
  const b = c.bones[boneName]; c.m.updateMatrixWorld(true);
  const rq = b.getWorldQuaternion(new THREE.Quaternion()).invert();
  const e = { b, obj, rq, local: local.clone(), follow }; c.extras.push(e); c.root.add(obj); return e;
}
export function updateExtras(c) {
  for (const e of c.extras) {
    e.b.matrixWorld.decompose(P_, Q_, Sc_);
    e.obj.parent.worldToLocal(P_);
    const pw = new THREE.Quaternion(); e.obj.parent.getWorldQuaternion(pw);
    e.obj.position.copy(P_);
    const qq = new THREE.Quaternion(); e.b.getWorldQuaternion(qq); qq.multiply(e.rq);
    e.obj.quaternion.copy(pw.invert().multiply(qq));
    if (e.local.lengthSq()) e.obj.position.add(e.local.clone().applyQuaternion(e.obj.quaternion));
  }
}

