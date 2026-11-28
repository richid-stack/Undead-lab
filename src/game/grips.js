/**
 * grips.js
 * Authored hand poses for holding a gun, for the realistic bodies (people.js). Each hand has
 *   pos    where the wrist joint goes, in gun space (metres; +z muzzle, +y up, +x the shooter's left; origin at the middle of the grip)
 *   F, N   the hand's direction in gun space: F = the way the fingers point when straight, N = the way the palm faces
 *   curl   bend of each finger joint in radians (positive = towards the palm); spread rotates a finger sideways in the palm plane
 *   thumb  { curl: [3 joints], spread } the same for the thumb (spread swings the whole thumb across the palm)
 * The solver (`poseHand`) puts the wrist there with the arm IK, turns the hand with the twist shared between forearm and wrist
 * (so the skin does not wring), and sets every finger joint exactly, so a grip looks the same every frame instead of "curling a bit".
 * Nothing here assumes how a rig's bones are oriented: finger directions, the palm's normal and the forearm's length axis are all read from
 * the rig's own bind pose (bone positions), so the same grips work on any skeleton that has the Mixamo bone names.
 */
import * as THREE from 'three';

const FINGERS = ['Index', 'Middle', 'Ring', 'Pinky'];
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _a = new THREE.Vector3(), _b = new THREE.Vector3();

/** the grips: edit these numbers (the tests can change `GRIPS` live and take close-ups) */
const NOSPREAD = { Index: 0, Middle: 0, Ring: 0, Pinky: 0 };
export const GRIPS = {
  pistol: {
    R: { pos: [-.004, .03, -.075], F: [0, -.35, 1], N: [1, .15, .1], curl: { Index: [.25, .4, .3], Middle: [1.1, 1.3, .9], Ring: [1.1, 1.3, .9], Pinky: [1.0, 1.2, .8] }, spread: NOSPREAD, thumb: { curl: [.1, .1, 0], spread: 0 } },
    L: { pos: [.02, .01, -.06], F: [0, -.35, 1], N: [-1, .15, .1], curl: { Index: [1.0, 1.3, .9], Middle: [1.1, 1.3, .9], Ring: [1.1, 1.3, .9], Pinky: [1.0, 1.2, .8] }, spread: NOSPREAD, thumb: { curl: [.1, .1, 0], spread: 0 } },
  },
  rifle: {
    R: { pos: [-.004, .035, -.07], F: [0, -.35, 1], N: [1, .15, .1], curl: { Index: [.35, .45, .25], Middle: [1.1, 1.3, .9], Ring: [1.1, 1.3, .9], Pinky: [1.0, 1.2, .8] }, spread: NOSPREAD, thumb: { curl: [.1, .1, 0], spread: 0 } },
    L: { pos: [.055, 0, .27], F: [-.5, 0, .87], N: [0, 1, 0], curl: { Index: [.9, 1.0, .7], Middle: [.9, 1.0, .7], Ring: [.9, 1.0, .7], Pinky: [.9, 1.0, .7] }, spread: NOSPREAD, thumb: { curl: [.1, .1, 0], spread: 0 } },
  },
  dane: {
    R: { pos: [-.004, -.035, -.185], F: [0, -.3, 1], N: [1, .15, .1], curl: { Index: [.4, .5, .3], Middle: [1.1, 1.3, .9], Ring: [1.1, 1.3, .9], Pinky: [1.0, 1.2, .8] }, spread: NOSPREAD, thumb: { curl: [.1, .1, 0], spread: 0 } },
    L: { pos: [.055, -.04, .33], F: [-.5, 0, .87], N: [0, 1, 0], curl: { Index: [.9, 1.0, .7], Middle: [.9, 1.0, .7], Ring: [.9, 1.0, .7], Pinky: [.9, 1.0, .7] }, spread: NOSPREAD, thumb: { curl: [.1, .1, 0], spread: 0 } },
  },
};

// ---------- per-rig data, read once from the bind pose ----------
const cache = new WeakMap();
function bindInfo(body, side) {
  let c = cache.get(body); if (!c) cache.set(body, c = {});
  if (c[side]) return c[side];
  const sk = body.main.skeleton, idx = new Map(sk.bones.map((b, i) => [b, i]));
  const W = b => new THREE.Matrix4().copy(sk.boneInverses[idx.get(b)]).invert();                 // bind world matrix of a bone, in the mesh's bind space
  const Wq = b => new THREE.Quaternion().setFromRotationMatrix(W(b));
  const Wp = b => new THREE.Vector3().setFromMatrixPosition(W(b));
  const restLocal = b => b.parent && idx.has(b.parent) ? Wq(b.parent).invert().multiply(Wq(b)) : Wq(b);
  const hand = body.bones[side + 'Hand'], fore = body.bones[side + 'ForeArm'], mid = body.bones[side + 'HandMiddle1'];
  const sign = side === 'Left' ? 1 : -1;
  const f = Wp(mid).sub(Wp(hand)).normalize();
  // the palm's normal (the way the palm faces) from the knuckles: finger direction x across the knuckles, mirrored for the right hand
  const across = Wp(body.bones[side + 'HandIndex1']).sub(Wp(body.bones[side + 'HandPinky1'])).normalize().multiplyScalar(sign);
  const n = new THREE.Vector3().crossVectors(f, across).normalize(); n.addScaledVector(f, -n.dot(f)).normalize();
  const basis = (F, N) => { const z = _a.crossVectors(F, N).normalize(); return new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(F, N, z)) };
  const foreAxis = Wp(hand).sub(Wp(fore)).normalize().applyQuaternion(Wq(fore).invert());          // the forearm's length axis, in the forearm bone's own frame
  const info = { hand, fore, Wh: Wq(hand), Qb: basis(f, n), foreAxis, fingers: {}, thumb: [] };
  const chain = (name, i, pv0) => {
    const b = body.bones[`${side}Hand${name}${i}`], nx = body.bones[`${side}Hand${name}${i + 1}`], pv = body.bones[`${side}Hand${name}${i - 1}`] || hand;
    const d = nx ? Wp(nx).sub(Wp(b)) : Wp(b).sub(Wp(pv)); d.normalize();
    const flex = new THREE.Vector3().crossVectors(d, n).normalize();                              // bend axis: finger direction x palm normal (rotating about it moves the fingertip towards the palm)
    const inv = Wq(b).invert();
    return { b, rest: restLocal(b), axis: flex.clone().applyQuaternion(inv), palm: n.clone().applyQuaternion(inv) };
  };
  for (const name of FINGERS) info.fingers[name] = [1, 2, 3].map(i => chain(name, i));
  info.thumb = [1, 2, 3].map(i => chain('Thumb', i));
  return c[side] = info;
}

const _Qd = new THREE.Quaternion(), _Qt = new THREE.Quaternion(), _fw = new THREE.Vector3(), _nw = new THREE.Vector3(), _zw = new THREE.Vector3(), _tw = new THREE.Quaternion();
/**
 * Pose one hand on a gun. `gun` is the gun's Object3D (world matrix up to date), `armIK(body, side, target, pole)` puts the wrist at `target`.
 */
export function poseHand(body, side, gun, grip, armIK, pole) {
  const info = bindInfo(body, side), hand = info.hand, fore = info.fore;
  const T = V(...grip.pos).applyMatrix4(gun.matrixWorld);
  armIK(body, side, T, pole);
  // desired hand frame in world space
  const gq = gun.getWorldQuaternion(new THREE.Quaternion());
  _fw.set(...grip.F).normalize().applyQuaternion(gq); _nw.set(...grip.N).applyQuaternion(gq); _nw.addScaledVector(_fw, -_nw.dot(_fw)).normalize(); _zw.crossVectors(_fw, _nw).normalize();
  _Qd.setFromRotationMatrix(_m.makeBasis(_fw, _nw, _zw));
  _Qt.copy(_Qd).multiply(_q.copy(info.Qb).invert()).multiply(info.Wh);                            // the hand bone's world rotation
  // share the roll between the forearm and the wrist: the twist of (hand relative to forearm) about the forearm's own length axis
  fore.updateWorldMatrix(true, false); fore.getWorldQuaternion(_q);
  _q2.copy(_q).invert().multiply(_Qt);                                                            // hand relative to the forearm, in the forearm's frame
  const ax = info.foreAxis, tw = 2 * Math.atan2(_q2.x * ax.x + _q2.y * ax.y + _q2.z * ax.z, _q2.w), t = Math.atan2(Math.sin(tw), Math.cos(tw));
  _tw.setFromAxisAngle(ax, t * .65); fore.quaternion.multiply(_tw); fore.updateMatrixWorld(true);
  fore.getWorldQuaternion(_q); hand.quaternion.copy(_q.invert().multiply(_Qt)); hand.updateMatrixWorld(true);
  // fingers
  for (const name of FINGERS) {
    const cv = grip.curl[name] || [0, 0, 0], sp = (grip.spread && grip.spread[name]) || 0;
    info.fingers[name].forEach((j, i) => {
      j.b.quaternion.copy(j.rest);
      if (i === 0 && sp) j.b.quaternion.multiply(_q.setFromAxisAngle(j.palm, sp));                 // swing sideways in the palm plane first, then bend
      j.b.quaternion.multiply(_q.setFromAxisAngle(j.axis, cv[i]));
    });
  }
  const th = grip.thumb || { curl: [0, 0, 0], spread: 0 };
  info.thumb.forEach((j, i) => {
    j.b.quaternion.copy(j.rest);
    if (i === 0 && th.spread) j.b.quaternion.multiply(_q.setFromAxisAngle(j.palm, th.spread));
    j.b.quaternion.multiply(_q.setFromAxisAngle(j.axis, th.curl[i] || 0));
  });
}
