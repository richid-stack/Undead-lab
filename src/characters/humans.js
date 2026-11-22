/**
 * humans.js
 * Humans collection: photoscanned busts.
 */
import * as THREE from 'three';
import { pedestal } from './gear/common.js';
import { buildBust } from './bust.js';

// =====================================================================================
//  HUMANS — photoscanned head busts (real person) + weathered variant
// =====================================================================================
export async function buildHumans() {
  const group = new THREE.Group(), items = [];
  const mk = async (x, opts) => {
    const b = await buildBust(opts), ped = pedestal(1.2, .2, '#8f8a84'); ped.position.set(x, 0, 0);
    b.root.position.set(x, ped.userData.top + .2, 0); group.add(ped, b.root); items.push(b); return b;
  };
  await mk(-.62, { human: 1, sss: 1, eyes: 'live', seed: 3, tint: 0xf3e0d2 });
  await mk(.62, { human: 1, sss: 1, eyes: 'live', seed: 11, grime: .55, blood: .22, pores: 1.5, wounds: [[.9, 3.0, .011, 0], [-1.3, .9, .008, 0]], tint: 0xfff0e6 });
  const eyeY = 1.53;
  return {
    group, items,
    views: {
      lineup: { p: [0, 1.62, 3.0], t: [0, 1.38, 0], n: ['Real humans', 'Photoscanned head (Lee Perry-Smith) — skin shader, subsurface wrap, open eyes that follow you'] },
      lee: { p: [-.62, eyeY + .02, .95], t: [-.62, eyeY - .03, 0], n: ['Lee — studio portrait', 'Real 3D head scan · pores, peach-fuzz sheen, red-shifted subsurface light'] },
      lee_close: { p: [-.62, eyeY, .45], t: [-.62, eyeY - .01, 0], n: ['Lee — macro', 'Scan normal map + procedural pore relief layered on top'] },
      survivor: { p: [.62, eyeY + .02, .95], t: [.62, eyeY - .03, 0], n: ['The Survivor', 'Same scan, weathered: grime, spatter, fresh cuts'] },
      survivor_close: { p: [.62, eyeY, .45], t: [.62, eyeY - .01, 0], n: ['The Survivor — macro', 'Procedural dirt, blood spatter and wound relief'] },
    },
    buttons: ['lineup', 'lee', 'survivor', 'lee_close', 'survivor_close'], labels: { lee_close: 'Lee ×', survivor_close: 'Survivor ×' }, anims: [],
    update(dt, t) { items.forEach(b => b.update(dt, t)) }, setAnim() { },
  };
}

