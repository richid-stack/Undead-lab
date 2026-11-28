/**
 * people.js
 * The playable heroes, built from the MakeHuman base (mh.js): a bare body of the right build and face, plus a wardrobe the player chooses from
 * (wardrobe.js). The Soldier's walk / run and the X Bot's idle are retargeted onto the new skeleton (retarget.js), so every feature that already
 * works for the other bodies (aiming, guns, camera, footsteps) works for these too.
 */
import * as THREE from 'three';
import { glbOf } from '../core/engine.js';
import { makeBody } from './factory.js';
import { makeHuman } from './mh.js';
import { BONEMAP, retargetWorld } from './retarget.js';

// ---------- the heroes (names are placeholders until the story is final) ----------
// `details` shape the face and body: -1..1 per modifier (see data/targets.json). Wardrobe values: ids from wardrobe.js.
export const PEOPLE = {
  kwesi: { name: 'Kwesi', sex: 'm', height: 1.78, skin: 'young_african_male', skinTint: 0xffffff, eyes: 'darkbrown', hair: 'short02', hairColor: 0x0d0907, outfit: 'male_casualsuit06', shoes: 'shoes05', hat: null,
    macro: { muscle: .55 }, details: { 'nose-width1-decr-incr': .3, 'chin-prominent-decr-incr': .2, 'cheek-bones-decr-incr': .2, 'mouth-upperlip-volume-decr-incr': .15, 'head-oval': .4 } },
  abena: { name: 'Abena', sex: 'f', height: 1.67, skin: 'young_african_female', skinTint: 0xffffff, eyes: 'darkbrown', hair: 'braid01', hairColor: 0x0c0806, outfit: 'female_casualsuit02', shoes: 'shoes06', hat: null,
    macro: {}, details: { 'nose-width1-decr-incr': .35, 'mouth-lowerlip-volume-decr-incr': .4, 'cheek-volume-decr-incr': .3, 'eye-scale-decr-incr': .2, 'head-round': .4 } },
  ama: { name: 'Ama', sex: 'f', height: 1.70, skin: 'young_african_female', skinTint: 0xe8d6cc, eyes: 'darkbrown', hair: 'long01', hairColor: 0x120b07, outfit: 'female_elegantsuit01', shoes: 'shoes03', hat: null,
    macro: { weight: .45 }, details: { 'head-oval': .5, 'mouth-upperlip-volume-decr-incr': .3, 'eye-height1-decr-incr': .2, 'chin-height-decr-incr': -.2, 'nose-scale-vert-decr-incr': -.2 } },
  kojo: { name: 'Kojo', sex: 'm', height: 1.82, skin: 'young_african_male', skinTint: 0xd8c4b8, eyes: 'darkbrown', hair: 'afro01', hairColor: 0x0d0907, outfit: 'male_casualsuit03', shoes: 'shoes01', hat: null,
    macro: { muscle: .62, weight: .55 }, details: { 'head-rectangular': .4, 'nose-width1-decr-incr': .3, 'chin-bones-decr-incr': .3, 'measure-neck-circ-decr-incr': .25 } },
};

/** the clothes slots of a person, as the names of the items to wear (null = nothing) */
export const wearOf = spec => ({ hair: spec.hair, outfit: spec.outfit, shoes: spec.shoes, hat: spec.hat });

/** a controllable body with the same shape makeBody returns (bones named like Mixamo, Idle / Walk / Run clips), plus body.wear(slot, id) to change what they wear */
export async function makePerson(spec) {
  const [human, soldier, xbot] = await Promise.all([
    makeHuman({ sex: spec.sex, macro: spec.macro, details: spec.details, skin: spec.skin, skinTint: spec.skinTint, eyes: spec.eyes, hairColor: spec.hairColor }),
    glbOf('d_soldier'), glbOf('d_xbot')]);
  human.group.traverse(o => { if (o.isBone && BONEMAP[o.name]) { o.userData.mx = BONEMAP[o.name]; o.name = 'mixamorig' + o.userData.mx } });
  const gltf = { scene: human.group, animations: [] };
  // a relaxed stand from the X Bot (the Soldier's idle is a rifle-ready crouch); walk and run from the Soldier, whose stride the player's playback speed is tuned for
  gltf.animations = [...retargetWorld(xbot, 0, gltf, [['idle', 'Idle']]), ...retargetWorld(soldier, Math.PI, gltf, ['Walk', 'Run'])];
  human.group.updateMatrixWorld(true);
  const bone = n => human.group.getObjectByName('mixamorig' + n), y = n => bone(n).getWorldPosition(new THREE.Vector3()).y;
  const toe = Math.min(y('LeftToeBase'), y('RightToeBase'));
  // makeBody scales so that (head bone - toe bone) / ratio = height: with ratio = that distance / the real standing height, the person is exactly `height` tall from sole to crown
  const body = await makeBody(null, { gltf, height: spec.height || 1.72, ratio: (y('Head') - toe) / human.height, lift: toe - human.ground });
  body.person = spec; body.human = human; body.main = human.body; body.curlAxis = new THREE.Vector3(0, 0, 1); body.curlSign = 1;
  body.meshes = []; body.m.traverse(o => { if (o.isMesh) body.meshes.push(o) });
  const slotName = { hair: 'hair', outfit: 'clothes/outfit', shoes: 'clothes/shoes', hat: 'clothes/hat' };
  const fix = m => { if (m) { m.castShadow = true; m.frustumCulled = false } return m };
  /** put something on this person (id from wardrobe.js; null takes it off) */
  body.wear = async (slot, id) => {
    const opts = slot === 'hair' ? { color: spec.hairColor, roughness: .9 } : slot === 'hat' ? { alpha: true } : {};
    const m = fix(await human.set(slotName[slot], id, opts)); if (slot === 'hair' || slot === 'outfit' || slot === 'shoes' || slot === 'hat') spec = body.person = { ...body.person, [slot]: id };
    const hair = human.items.get('hair'), hat = human.items.get('clothes/hat');          // short hair and afros would poke through a hat, so they are not drawn under one
    if (hair) hair.visible = !(hat && /^(short|afro)/.test(hair.userData.name));
    body.meshes = []; body.m.traverse(o => { if (o.isMesh) body.meshes.push(o) }); return m;
  };
  for (const [slot, id] of Object.entries(wearOf(spec))) if (id) await body.wear(slot, id);
  return body;
}
