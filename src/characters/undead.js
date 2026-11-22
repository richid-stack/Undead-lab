/**
 * undead.js
 * Undead collection: infected trooper, zombie, zombie bust.
 */
import * as THREE from 'three';
import { pm, key, gtex, glow, glbOf } from '../core/engine.js';
import { pedestal, attachAt, bindPos, bioBody, retargetClip, skinMaskFrom, clothStrip, sporeCluster, tendril, boneSpike, bandage, zombiePose } from './gear/common.js';
import { play, findClip, makeBody } from './factory.js';
import { buildBust } from './bust.js';
// =====================================================================================
//  UNDEAD
// =====================================================================================
export const midp = (c, a, b) => { const A = bindPos(c, a), B = bindPos(c, b); return [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2] };
export function motes(n, color, h = 2.2, w = 1.0) {
  const g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), s = new Float32Array(n);
  for (let i = 0; i < n; i++) { p[i * 3] = (Math.random() - .5) * w; p[i * 3 + 1] = Math.random() * h; p[i * 3 + 2] = (Math.random() - .5) * w; s[i] = .2 + Math.random() * .8 }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ color, size: .03, map: gtex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); m.userData = { s, h }; m.frustumCulled = false; return m;
}
export function stepMotes(m, dt, t) { const p = m.geometry.attributes.position, s = m.userData.s; for (let i = 0; i < p.count; i++) { let y = p.getY(i) + dt * s[i] * .18; if (y > m.userData.h) y = 0; p.setY(i, y); p.setX(i, p.getX(i) + Math.sin(t * 1.3 + i) * dt * .03) } p.needsUpdate = true }

export async function buildUndead() {
  const group = new THREE.Group(), bodies = [], items = [], fx = [];
  // ---------------- THE WALKER: infected Vanguard trooper ----------------
  const w = await makeBody('d_soldier', { x: -1.5, height: 1.85, turn: Math.PI });
  const wx = -1.5;
  bioBody(w, {
    bio: { grime: .95, blood: .85, wear: 1, skin: 0, zombie: 0, seed: 7, pores: 0, tint: 0x949f8c, bump: 1 },
    wounds: [
      { o: [wx + .09, 1.32, 4], d: [0, 0, -1], r: .075, t: 1 },      // chest: torn through the plate, bone showing
      { o: [wx - .1, .78, 4], d: [0, 0, -1], r: .06, t: 0 },        // thigh
      { o: [wx - .02, 1.62, 4], d: [0, 0, -1], r: .035, t: 0 },     // helmet
      { o: [wx + .2, 1.1, -4], d: [0, 0, 1], r: .08, t: 0 },        // lower back
      { o: [wx - .6, 3, -.06], d: [0, -1, 0], r: .05, t: 0 },        // forearm
    ],
    perMat: (mat, n) => /visor/i.test(n) ? { grime: .25, blood: .35, tint: 0x40604a, wear: .2 } : {},
  });
  w.meshes.forEach(m => [].concat(m.material).forEach(mm => { if (/visor/i.test(mm.name)) { mm.emissive = new THREE.Color(0x14b84a); mm.emissiveIntensity = .5; mm.roughness = .15 } else { mm.metalness = .35; mm.roughness = .62 } }));
  console.log('WALKER BONES', JSON.stringify({ hips: bindPos(w, 'Hips'), spine2: bindPos(w, 'Spine2'), neck: bindPos(w, 'Neck'), head: bindPos(w, 'Head'), lsh: bindPos(w, 'LeftShoulder'), rsh: bindPos(w, 'RightShoulder'), lfa: bindPos(w, 'LeftForeArm'), lh: bindPos(w, 'LeftHand') }));
  // gear: back pods + shoulder growths + torn straps
  const back = new THREE.Group(); back.add(sporeCluster(4, 7, .09, 'green', true)); [[-.1, -.05, .0], [.11, .02, -.01], [.0, -.12, .01]].forEach((o, i) => { const c = sporeCluster(20 + i, 4, .05); c.position.set(...o); c.scale.setScalar(.8); back.add(c) });
  back.add(tendril([0, 0, 0], [-.14, -.28, .02], .05, .005, 3), tendril([0, 0, 0], [.16, -.3, 0], .06, .004, 4), tendril([-.1, -.05, 0], [-.2, -.18, .02], .04, .003, 5));
  attachAt(w, 'Spine2', back, [0, 1.42, -.2]);
  const sh = sporeCluster(9, 5, .05, 'green'); attachAt(w, 'RightShoulder', sh, [-.25, 1.72, -.04]);
  const sh2 = sporeCluster(12, 4, .04, 'green'); attachAt(w, 'LeftShoulder', sh2, [.27, 1.7, -.03]);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283 + .3, st = clothStrip(.05 + (i % 3) * .015, .32 + (i % 4) * .08, i % 2 ? '#3d4234' : '#2f3a33', 40 + i, .7); attachAt(w, 'Hips', st, [Math.sin(a) * .2, 1.1, Math.cos(a) * .13 - .02]) }
  { const st = clothStrip(.07, .5, '#4a3c30', 55, .9); attachAt(w, 'RightForeArm', st, [-.52, 1.6, -.06], [0, 0, -Math.PI / 2]); const st2 = clothStrip(.06, .4, '#2f3a33', 56, .8); attachAt(w, 'LeftForeArm', st2, [.52, 1.6, -.06], [0, 0, Math.PI / 2]) }
  w.pose = { lean: .5, head: .15, roll: .25, yaw: .15, reachL: .85, reachR: .42, bendL: .3, bendR: .5, ph: 0, sway: 1 };
  bodies.push(w); group.add(w.root);
  const wm = motes(40, 0x4dff8a, 2.3, 1.1); wm.position.set(wx, 0, 0); group.add(wm); fx.push(wm);

  // ---------------- PATIENT ZERO: Michelle, rotted ----------------
  const px = 1.5, pz = await makeBody('d_michelle', { x: px, height: 1.68, turn: 0 });
  const baseMap = pz.meshes[0].material.map, skinMask = skinMaskFrom(baseMap);
  window.__skinMask = skinMask.userData.canvas;
  bioBody(pz, {
    bio: { skin: 1, human: 0, zombie: 1, rot: 1, grime: .85, blood: .8, seed: 3, pores: 1.2, glow: .6, glowCol: 0x59ff9a, skinMask, sss: .4, bump: 1.1 },
    wounds: [
      { o: [px - .035, 1.6, 4], d: [0, 0, -1], r: .038, t: 1 },    // cheek, bone showing
      { o: [px + .09, 1.1, 4], d: [0, 0, -1], r: .06, t: 0 },       // belly
      { o: [px + .02, 1.37, 4], d: [0, 0, -1], r: .035, t: 0 },     // collarbone / neck
      { o: [px + .52, 3, -.005], d: [0, -1, 0], r: .045, t: 0 },     // forearm
      { o: [px - .12, .7, 4], d: [0, 0, -1], r: .05, t: 0 },        // thigh
    ],
  });
  pz.meshes.forEach(m => [].concat(m.material).forEach(mm => { mm.metalnessMap = null; mm.metalness = 0; mm.roughness = 1 }));
  console.log('PATIENT BONES', JSON.stringify({ hips: bindPos(pz, 'Hips'), spine2: bindPos(pz, 'Spine2'), head: bindPos(pz, 'Head'), lfa: bindPos(pz, 'LeftForeArm'), lh: bindPos(pz, 'LeftHand'), rfa: bindPos(pz, 'RightForeArm'), rh: bindPos(pz, 'RightHand') }));
  // gear: bone spike through left forearm, bandage on right forearm, torn rags
  { const sp = boneSpike(.12, 3); const m1 = midp(pz, 'LeftForeArm', 'LeftHand'); attachAt(pz, 'LeftForeArm', sp, [m1[0], m1[1] + .02, m1[2]]) }
  { const bd = bandage(.036, .1, 5); const m2 = midp(pz, 'RightForeArm', 'RightHand'); attachAt(pz, 'RightForeArm', bd, m2, [0, 0, Math.PI / 2]) }
  for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.283 + .6, st = clothStrip(.05, .26 + (i % 3) * .07, i % 2 ? '#8a7a30' : '#6c6a3a', 70 + i, .85); attachAt(pz, 'Hips', st, [Math.sin(a) * .17, 1.12, Math.cos(a) * .1]) }
  { const g = sporeCluster(31, 5, .045, 'orange'); attachAt(pz, 'Spine2', g, [-.05, 1.3, .1]) }
  pz.pose = { lean: .4, head: .1, roll: -.3, yaw: -.18, reachL: .55, reachR: .8, bendL: .5, bendR: .3, ph: 2.1, sway: 1.3 };
  // retargeted locomotion from the Vanguard rig
  { const sg = await glbOf('d_soldier'), sy = sg.scene.getObjectByName('mixamorigHips').position.y, dy = pz.bones.Hips.position.y;
    for (const nm of ['Idle', 'Walk', 'Run']) { const src = sg.animations.find(a => a.name === nm); if (src) pz.acts[nm] = pz.mixer.clipAction(retargetClip(src, pz, sg.scene, sy, dy)) } }
  bodies.push(pz); group.add(pz.root);
  const pm = motes(30, 0xffb04a, 2.1, 1.0); pm.position.set(px, 0, 0); group.add(pm); fx.push(pm);

  // ---------------- THE TURNED: photoscan bust ----------------
  const b = await buildBust({ human: 0, zombie: 1, eyes: 'dead', sss: .5, seed: 5, grime: .6, blood: .9, glow: .6, glowCol: 0x59ff9a, pores: 1.4,
    wounds: [[-1.25, .75, .040, 1], [1.0, 3.0, .030, 0], [1.1, -.5, .045, 0], [-1.3, 2.6, .022, 0]] });
  const ped = pedestal(1.2, .2, '#6f7068'); ped.position.set(0, 0, 0); b.root.position.set(0, ped.userData.top + .2, 0); group.add(ped, b.root); items.push(b);
  const eyeY = 1.53;
  const MAP = { Shamble: ['walk', .5, 1], Idle: ['walk', .2, .85], Lunge: ['run', .55, 1.25] };
  return {
    group, items, bodies,
    views: {
      lineup: { p: [0, 1.45, 6.0], t: [0, 1.0, 0], n: ['Undead', 'Drag to orbit · pinch to zoom'] },
      walker: { p: [wx, 1.35, 3.5], t: [wx, 1.05, 0], n: ['The Walker', 'Infected Vanguard trooper — torn plate, spore growths, glowing visor'] },
      patient: { p: [px, 1.2, 2.5], t: [px, .95, 0], n: ['Patient Zero', 'Necrotic skin shader, protruding bone, bandages, rags'] },
      turned: { p: [0, eyeY + .02, .95], t: [0, eyeY - .03, 0], n: ['The Turned', 'Photoscan head, necrotic shader: veins, bruising, cracked skin, exposed bone'] },
      walker_face: { p: [wx, 1.78, 1.25], t: [wx, 1.6, 0], n: ['The Walker — visor', 'Glowing infection behind cracked glass'] },
      patient_face: { p: [px, 1.72, 1.0], t: [px, 1.5, 0], n: ['Patient Zero — face', 'Skin mask is classified from the texture at load time'] },
    },
    buttons: ['lineup', 'walker', 'patient', 'turned', 'walker_face', 'patient_face'], labels: { walker_face: 'Walker ×', patient_face: 'Patient ×' }, anims: ['Shamble', 'Idle', 'Lunge'],
    update(dt, t) {
      bodies.forEach(c => { c.mixer.update(dt); c.root.updateMatrixWorld(true); const k = c.poseK || 1, p = c.pose, q = {}; for (const key in p) q[key] = (key === 'ph' || key === 'sway') ? p[key] : p[key] * k; zombiePose(c, t, q) });
      items.forEach(b => b.update(dt, t)); fx.forEach(m => stepMotes(m, dt, t));
    },
    setAnim(n) { const [clip, ts, pk] = MAP[n]; bodies.forEach(c => { const nm = findClip(c, clip); play(c, nm); const a = c.acts[nm]; a.setEffectiveTimeScale(ts); c.poseK = pk }) },
  };
}
