/**
 * lab.js
 * "Weapons" collection for the lab page: the three guns on a display table, close-up views, and Fire / Slow-mo / Reload
 * animations that move the real working parts (slide, bolt carrier, magazine, hammer) with a muzzle flash.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { glow, rng, clamp } from '../core/engine.js';
import { BUILDERS } from './models.js';
import { wood, brass, matte, steel } from './materials.js';

const TOP = .06;                                           // table top height
const LAYOUT = { pistol: { x: .22, z: .55, name: 'Pistol' }, rifle: { x: .17, z: 0, name: 'Assault rifle' }, dane: { x: 0, z: -.6, name: 'Dane gun' } };

function cartridge(L, r, bl, jacket) {
  const g = new THREE.Group();
  const caseG = new THREE.LatheGeometry([[0, 0], [r * 1.1, 0], [r * 1.1, .0012], [r, .0013], [r, L * .72], [r * .8, L * .8], [r * .7, L]].map(([a, b]) => new THREE.Vector2(a, b)), 14);
  g.add(new THREE.Mesh(caseG, brass(.28)));
  const bu = new THREE.LatheGeometry([[r * .7, L - .002], [r * .7, L + bl * .55], [r * .45, L + bl * .88], [0, L + bl]].map(([a, b]) => new THREE.Vector2(a, b)), 14);
  g.add(new THREE.Mesh(bu, jacket)); g.rotation.z = -Math.PI / 2; const o = new THREE.Group(); o.add(g); return o;
}

export async function buildWeapons() {
  const group = new THREE.Group(), R = rng(9), guns = {};
  // ---- display table: dark leather top in a wooden frame ----
  const frameM = wood({ tone: '#5a3a20', dark: '#1d0f05', seed: 31, figure: .5, rough: .5, varnish: .45 });
  const leather = new THREE.MeshStandardMaterial({ color: 0x2c2823, roughness: .9, metalness: 0 });
  const top = new THREE.Mesh(new RoundedBoxGeometry(1.9, TOP, 2.0, 3, .012), frameM); top.position.set(.25, TOP / 2, 0); top.receiveShadow = true; top.castShadow = true; group.add(top);
  const pad = new THREE.Mesh(new RoundedBoxGeometry(1.74, .006, 1.84, 2, .002), leather); pad.position.set(.25, TOP + .001, 0); pad.receiveShadow = true; group.add(pad);

  const flashes = [];
  for (const [id, L] of Object.entries(LAYOUT)) {
    const m = BUILDERS[id](), low = Math.max(...m.rest.map(p => -p.y)), y0 = TOP + .03 + low;
    const holder = new THREE.Group(); holder.position.set(L.x, y0, L.z); holder.rotation.y = Math.PI / 2; holder.add(m.group); group.add(holder);
    for (const p of m.rest) {                                // cradle blocks under the gun
      const h = y0 + p.y - TOP - .004, blk = new THREE.Mesh(new RoundedBoxGeometry(.05, Math.max(.01, h), p.w, 2, .004), frameM);
      blk.position.set(L.x + p.z, TOP + .006 + Math.max(.01, h) / 2, L.z); blk.castShadow = true; blk.receiveShadow = true; group.add(blk);
      const cap = new THREE.Mesh(new RoundedBoxGeometry(.052, .006, p.w + .004, 2, .002), matte(0x080808, .95)); cap.position.set(L.x + p.z, TOP + .006 + Math.max(.01, h) + .0005, L.z); group.add(cap);
    }
    const fl = glow(0xffd9a0, .2); fl.visible = false; group.add(fl);
    guns[id] = { ...m, holder, flash: fl, y0, L };
    flashes.push(fl);
  }

  // ---- a few cartridges and caps lying on the table ----
  const copper = steel({ color: 0xa8683a, rough: .35, wear: 0, grime: 0, metal: 1, seed: 2, bare: 0xa8683a }), lead = steel({ color: 0x78787c, rough: .4, wear: 0, grime: 0, metal: 1, seed: 3, bare: 0x78787c });
  for (let i = 0; i < 6; i++) { const c = cartridge(.019, .0049, .0145, copper); c.position.set(.52 + R() * .22, TOP + .0075, .72 + R() * .22); c.rotation.y = R() * 6.28; group.add(c); c.traverse(o => { if (o.isMesh) o.castShadow = true }) }
  for (let i = 0; i < 6; i++) { const c = cartridge(.039, .0056, .0225, copper); c.position.set(.55 + R() * .3, TOP + .0085, .0 + .55 + R() * .25 - .75 + 0); c.position.z = -.25 - R() * .25; c.rotation.y = R() * 6.28; group.add(c); c.traverse(o => { if (o.isMesh) o.castShadow = true }) }
  { const tin = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .014, 20), steel({ color: 0x6b6256, rough: .5, wear: .8, grime: .4, metal: .8, seed: 4 })); tin.position.set(.62, TOP + .0075, -.8); tin.castShadow = true; group.add(tin); }
  for (let i = 0; i < 5; i++) { const ball = new THREE.Mesh(new THREE.SphereGeometry(.0042, 10, 8), lead); ball.position.set(.5 + R() * .08, TOP + .0045, -.95 + R() * .08); ball.castShadow = true; group.add(ball) }

  // ---- animation ----
  let mode = 'Display', hold = null;
  const ids = Object.keys(guns), cfg = { pistol: .26, rifle: .2, dane: .3 };
  const setPose = (g, st) => { g.pose(st); g.group.updateMatrixWorld(true) };
  function update(dt, t) {
    ids.forEach((id, i) => {
      const g = guns[id]; let st = { fire: -1, reload: 0, empty: false }, flash = false;
      if (hold && hold[id]) { setPose(g, hold[id]); g.flash.visible = !!hold[id].flash; if (hold[id].flash) { g.muzzle.getWorldPosition(g.flash.position); g.flash.scale.setScalar(.2) } return }
      if (mode === 'Fire') { const per = id === 'dane' ? 2.2 : 1.3, ph = (t + i * .45) % per, w = cfg[id]; st.fire = ph < w ? ph / w : -1; flash = ph < .05 }
      else if (mode === 'Slow-mo') { const per = 4.6, ph = (t * 1 + i * 1.1) % per, w = 1.6; st.fire = ph < w ? ph / w : -1; flash = ph < .09 }
      else if (mode === 'Reload') { const per = 4.6, ph = (t + i * .9) % per; st.empty = ph < 3.0; st.reload = clamp((ph - .6) / 2.3, 0, 1); if (st.reload >= 1) st.reload = 0 }
      setPose(g, st);
      g.flash.visible = flash; if (flash) { g.muzzle.getWorldPosition(g.flash.position); g.flash.scale.setScalar(.14 + R() * .1) }
    });
  }
  const labels = { lineup: 'All three', pistol: 'Pistol', rifle: 'Rifle', rifleR: 'Rifle (right)', dane: 'Dane gun', lock: 'Dane lock' };
  return {
    group, labels,
    views: {
      lineup: { p: [.3, 1.3, 2.0], t: [.25, .17, 0], n: ['Weapons', 'Pistol · assault rifle · Dane gun. Drag to orbit, pinch to zoom'] },
      pistol: { p: [.3, .42, 1.12], t: [.27, .2, .55], n: ['Pistol', 'Polymer frame, steel slide with edge wear, working slide and magazine'] },
      rifle: { p: [.2, .52, 1.45], t: [.18, .25, 0], n: ['Assault rifle', 'Stamped receiver, wood furniture, curved magazine, bolt carrier'] },
      rifleR: { p: [.15, .5, -1.4], t: [.18, .25, 0], n: ['Assault rifle, right side', 'Ejection port, charging handle, selector'] },
      dane: { p: [.0, .55, -2.0], t: [.05, .25, -.6], n: ['Dane gun', 'Long-barrelled percussion muzzle-loader: iron barrel, raw stock, brass fittings, cord wraps'] },
      lock: { p: [-.14, .31, -1.05], t: [-.03, .22, -.62], n: ['Dane gun lock', 'Hammer, nipple and lock plate'] },
    },
    buttons: ['lineup', 'pistol', 'rifle', 'rifleR', 'dane', 'lock'], anims: ['Display', 'Fire', 'Slow-mo', 'Reload'],
    guns, update, setAnim(n) { mode = n }, setHold(h) { hold = h },
  };
}
