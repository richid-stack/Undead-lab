/**
 * cast.js
 * "Choose hero" collection for the lab page: every playable person standing in a row on the portrait stage, idle / walk / run, a close-up
 * view per person. Click a person (or their name) to pick them; the Play button then starts the street as that hero.
 */
import * as THREE from 'three';
import { play, findClip } from './factory.js';
import { PEOPLE, makePerson } from './people.js';
import { specOf, remember } from './choice.js';

const GAP = 1.45;

export async function buildCast() {
  const group = new THREE.Group(), ids = Object.keys(PEOPLE), bodies = {}, X = {};
  const floorDisc = new THREE.Mesh(new THREE.CylinderGeometry(GAP * ids.length / 2 + .5, GAP * ids.length / 2 + .5, .02, 64), new THREE.MeshStandardMaterial({ color: 0x24211f, roughness: .85, metalness: 0 }));
  floorDisc.position.y = -.011; floorDisc.receiveShadow = true; group.add(floorDisc);
  for (const [i, id] of ids.entries()) {
    const b = await makePerson(specOf(id)); X[id] = (i - (ids.length - 1) / 2) * GAP; b.root.position.x = X[id]; b.root.rotation.y = (i - (ids.length - 1) / 2) * -.08;   // fan out slightly towards the camera
    bodies[id] = b; group.add(b.root);
  }
  const all = Object.values(bodies), views = {
    lineup: { p: [0, 1.45, 6.6], t: [0, .95, 0], n: ['Choose your hero', 'Click a person, then press Play · drag to orbit'] },
  };
  for (const id of ids) { const P = PEOPLE[id]; views[id] = { p: [X[id] * .8, 1.35, 3.0], t: [X[id], 1.0, 0], n: [P.name, `${P.sex === 'f' ? 'Woman' : 'Man'}, ${P.height.toFixed(2)} m · placeholder name · choose what to wear on the right`] } }
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
  return {
    group, bodies, views, buttons: ['lineup', ...ids], labels: { lineup: 'Everyone', ...Object.fromEntries(ids.map(id => [id, PEOPLE[id].name])) },
    anims: ['Idle', 'Walk', 'Run'], heroIds: ids,
    /** the wardrobe: what this person wears now, and put something else on (item = an id from wardrobe.js, or null for nothing); remembered for Play */
    wearing: id => ({ ...bodies[id].person }),
    async dress(id, slot, item) { await bodies[id].wear(slot, item); remember(id, slot, item) },
    update(dt) { all.forEach(c => c.mixer.update(dt)) },
    setAnim(n) { all.forEach(c => play(c, findClip(c, n.toLowerCase()))) },
    /** which person does this ray pass closest to (within 0.45 m of their standing axis)? */
    pick(ray) {
      let best = null, bd = .45 * .45;
      for (const id of ids) { _a.set(X[id], 0, 0); _b.set(X[id], 1.8, 0); const d = ray.distanceSqToSegment(_a, _b, _c, _d); if (d < bd) { bd = d; best = id } }
      return best;
    },
  };
}
