/**
 * retarget.js
 * Plays the game's existing animations (Mixamo "Soldier" and "X Bot" clips) on a MakeHuman skeleton.
 *  - BONEMAP renames the MakeHuman "game_engine" bones to the Mixamo names the rest of the game looks up
 *  - retargetWorld() bakes new clips for the new skeleton, working in world space so that different bone axes and a different rest pose do not matter
 */
import * as THREE from 'three';

export const BONEMAP = (() => {
  const m = { pelvis: 'Hips', spine_01: 'Spine', spine_02: 'Spine1', spine_03: 'Spine2', neck_01: 'Neck', head: 'Head' };
  for (const [s, S] of [['l', 'Left'], ['r', 'Right']]) {
    Object.assign(m, {
      [`clavicle_${s}`]: `${S}Shoulder`, [`upperarm_${s}`]: `${S}Arm`, [`lowerarm_${s}`]: `${S}ForeArm`, [`hand_${s}`]: `${S}Hand`,
      [`thigh_${s}`]: `${S}UpLeg`, [`calf_${s}`]: `${S}Leg`, [`foot_${s}`]: `${S}Foot`, [`ball_${s}`]: `${S}ToeBase`,
    });
    for (const f of ['index', 'middle', 'ring', 'pinky', 'thumb']) for (let i = 1; i <= 3; i++) m[`${f}_0${i}_${s}`] = `${S}Hand${f[0].toUpperCase()}${f.slice(1)}${i}`;
  }
  return m;
})();

/** the bone each bone points at (its "child" along the limb), by Mixamo name: used to line the rest poses up */
const CHILD = (() => {
  const c = { Hips: 'Spine', Spine: 'Spine1', Spine1: 'Spine2', Spine2: 'Neck', Neck: 'Head' };
  for (const S of ['Left', 'Right']) {
    Object.assign(c, { [`${S}Shoulder`]: `${S}Arm`, [`${S}Arm`]: `${S}ForeArm`, [`${S}ForeArm`]: `${S}Hand`, [`${S}Hand`]: `${S}HandMiddle1`, [`${S}UpLeg`]: `${S}Leg`, [`${S}Leg`]: `${S}Foot`, [`${S}Foot`]: `${S}ToeBase` });
    for (const f of ['Index', 'Middle', 'Ring', 'Pinky', 'Thumb']) for (let i = 1; i < 3; i++) c[`${S}Hand${f}${i}`] = `${S}Hand${f}${i + 1}`;
  }
  return c;
})();

const _p = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const wq = o => o.getWorldQuaternion(new THREE.Quaternion());

/**
 * Retarget clips of a Mixamo-rigged `src` onto `dst` (a { scene } whose bones have userData.mx = Mixamo name).
 * `clipNames`: names, or [sourceName, newName] pairs; `srcTurn`: rotation that makes the source face +z.
 * Target world rotation = (source animated world rotation x inverse source bind world rotation) x (rest alignment) x target bind world rotation,
 * where the rest alignment turns each target bone to point the way the same source bone points at rest. That way a target that stands in an
 * A-pose (arms down a little) and a source in a T-pose end up moving the same way instead of every arm being off by the difference.
 * Hips only move up and down, scaled by leg length.
 */
export function retargetWorld(src, srcTurn, dst, clipNames = ['Idle', 'Walk', 'Run']) {
  const sw = new THREE.Group(), dw = new THREE.Group(); sw.add(src.scene); dw.add(dst.scene); sw.rotation.y = srcTurn;
  sw.updateMatrixWorld(true); dw.updateMatrixWorld(true);
  const short = n => n.replace('mixamorig', ''), sB = {}, dB = {};
  src.scene.traverse(o => { if (o.isBone) sB[short(o.name)] = o });
  dst.scene.traverse(o => { if (o.isBone && o.userData.mx) dB[o.userData.mx] = o });
  const depth = o => { let d = 0; for (let p = o.parent; p; p = p.parent) d++; return d };
  const order = Object.keys(dB).filter(n => sB[n]).sort((a, b) => depth(dB[a]) - depth(dB[b]));
  const pos = (set, n) => set[n].getWorldPosition(new THREE.Vector3());
  const ws0 = {}, wd0 = {}, wdp = {}, fix = {};                            // inverse source bind world rotation, target bind world rotation, static world rotation of each unmapped parent, rest alignment
  for (const n of order) {
    ws0[n] = wq(sB[n]).invert(); wd0[n] = wq(dB[n]); const p = dB[n].parent; wdp[n] = p && !p.userData.mx ? wq(p) : null;
    const c = CHILD[n];
    if (c && sB[c] && dB[c]) { _a.subVectors(pos(sB, c), pos(sB, n)).normalize(); _b.subVectors(pos(dB, c), pos(dB, n)).normalize(); fix[n] = new THREE.Quaternion().setFromUnitVectors(_b, _a) }
    else { const par = dB[n].parent; fix[n] = par && par.userData.mx && fix[par.userData.mx] ? fix[par.userData.mx].clone() : new THREE.Quaternion() }   // leaves (head, fingertips, toes) follow their parent
  }
  const gy = o => o.getWorldPosition(_p.set(0, 0, 0)).y;
  const sGround = Math.min(gy(sB.LeftToeBase), gy(sB.RightToeBase)), dGround = Math.min(gy(dB.LeftToeBase), gy(dB.RightToeBase));
  const sHip0 = gy(sB.Hips), legScale = (gy(dB.Hips) - dGround) / (sHip0 - sGround);
  const dHipRest = dB.Hips.getWorldPosition(new THREE.Vector3());

  const mixer = new THREE.AnimationMixer(src.scene), out = [], Wt = {}, prev = {}, W0 = {};
  for (const n of order) W0[n] = fix[n].clone().multiply(wd0[n]);
  for (const entry of clipNames) {
    const [nm, outName] = Array.isArray(entry) ? entry : [entry, entry], clip = src.animations.find(c => c.name === nm); if (!clip) continue;
    mixer.stopAllAction(); mixer.clipAction(clip).play();
    const N = Math.max(8, Math.round(clip.duration * 30)), times = new Float32Array(N), vals = {}, hip = new Float32Array(N * 3);
    for (const n of order) vals[n] = new Float32Array(N * 4);
    for (const k in prev) delete prev[k];
    for (let i = 0; i < N; i++) {
      const t = clip.duration * i / N; times[i] = t; mixer.setTime(t); sw.updateMatrixWorld(true);
      for (const n of order) {
        const w = wq(sB[n]).multiply(ws0[n]).multiply(W0[n]); Wt[n] = w;                      // new world rotation of the target bone
        const par = dB[n].parent, pw = par && par.userData.mx ? Wt[par.userData.mx] : wdp[n];
        const loc = pw ? pw.clone().invert().multiply(w) : w.clone();
        const pr = prev[n]; if (pr && pr.dot(loc) < 0) { loc.x *= -1; loc.y *= -1; loc.z *= -1; loc.w *= -1 }
        prev[n] = loc; vals[n].set([loc.x, loc.y, loc.z, loc.w], i * 4);
      }
      const dy = (gy(sB.Hips) - sHip0) * legScale;                                              // vertical hip motion only
      _p.copy(dHipRest); _p.y += dy; dB.Hips.parent.worldToLocal(_p); hip.set([_p.x, _p.y, _p.z], i * 3);
    }
    const tracks = order.map(n => new THREE.QuaternionKeyframeTrack(`${dB[n].name}.quaternion`, times, vals[n]));
    tracks.push(new THREE.VectorKeyframeTrack(`${dB.Hips.name}.position`, times, hip));
    out.push(new THREE.AnimationClip(outName, clip.duration, tracks));
  }
  mixer.stopAllAction(); mixer.uncacheRoot(src.scene);
  return out;
}
