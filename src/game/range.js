/**
 * range.js
 * A firing range laid on the east end of the road: steel plates, oil drums, crates and cans that react to bullets
 * (Rapier dynamic bodies), and two mannequins that fall when shot and stand up again. Every shootable collider is
 * registered in `tags` (collider handle -> { kind, hit(info) }) so the weapon code knows what it hit.
 * Stand-in content for the prototype; real enemies (handlers, ledger-men) replace the mannequins later.
 */
import * as THREE from 'three';
import * as T from './textures.js';

export const RANGE_LINE = { x: 27.2, z: 0 };                    // stand here and face +x

function woodTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#8f6a3f'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#9b7448' : '#86613a'; g.fillRect(0, i * 32, 128, 31) }
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(40,25,10,${Math.random() * .25})`; g.fillRect(Math.random() * 128, Math.random() * 128, 6 + Math.random() * 20, 1) }
  g.strokeStyle = '#4b3418'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildRange(P) {
  const { RAPIER, world, statics } = P;
  const group = new THREE.Group(), tags = new Map(), bodies = [], anims = [], stats = { plates: 0, drums: 0, crates: 0, cans: 0, dummyHits: 0, headshots: 0, dummyDown: 0 };
  const mat = (color, rough = .6, metal = .2) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  const mSteel = mat(0x3a3d40, .45, .8), mRed = mat(0xb23a2a, .55, .3), mWhite = mat(0xe6e1d3, .7, .1), mWood = new THREE.MeshStandardMaterial({ map: woodTex(), roughness: .85 });
  const add = (o, x, y, z) => { o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; group.add(o); return o };

  // ---- the firing line, a sign and a few markers on the road ----
  const line = new THREE.Mesh(new THREE.PlaneGeometry(.22, 7.6), new THREE.MeshBasicMaterial({ color: 0xe9e4d2, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
  line.rotation.x = -Math.PI / 2; line.position.set(RANGE_LINE.x + .5, .03, 0); group.add(line);
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(2.4, .6), new THREE.MeshStandardMaterial({ map: T.sign('FIRING RANGE', '#1f3b2c', '#f1e8cb', 'stay behind the line'), roughness: .7 }));
  sg.rotation.y = -Math.PI / 2; add(sg, 28.8, 2.15, -4.7);
  for (const dz of [-1.1, 1.1]) add(new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 2.4, 8), mSteel), 28.8, 1.2, -4.7 + dz * .9);

  // ---- steel plates on posts (static; they wobble when hit) ----
  function plate(x, y, z, r = .27) {
    const g = new THREE.Group(); g.position.set(x, y, z); group.add(g);
    const wob = new THREE.Group(); g.add(wob);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .03, 28), mRed); disc.rotation.z = Math.PI / 2; disc.castShadow = true; wob.add(disc);
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(r * .5, r * .5, .034, 24), mWhite); dot.rotation.z = Math.PI / 2; dot.position.x = -.004; wob.add(dot);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, y + .1, 8), mSteel); post.position.set(.05, -(y + .1) / 2 + .1, 0); post.castShadow = true; g.add(post);
    const col = world.createCollider(RAPIER.ColliderDesc.cuboid(.02, r, r).setTranslation(x, y, z), statics);
    const st = { vel: 0, ang: 0 };
    anims.push(dt => { st.ang += st.vel * dt; st.vel += (-st.ang * 70 - st.vel * 2.4) * dt; wob.rotation.z = st.ang; wob.rotation.y = st.ang * .5 });
    tags.set(col.handle, { kind: 'plate', hit: i => { stats.plates++; st.vel += (Math.random() > .5 ? 1 : -1) * (3 + Math.min(i.dmg, 40) * .06); return 'hit' } });
  }
  plate(34, 1.35, -2.4); plate(38, 1.1, 2.2); plate(42, 1.5, -1.6); plate(46, 1.25, 2.5); plate(30.5, 1.05, 2.6, .2);

  // ---- dynamic props: drums, crates, cans ----
  function dyn(mesh, desc, kind, x, y, z, ry = 0) {
    const rb = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y, z).setRotation({ x: 0, y: Math.sin(ry / 2), z: 0, w: Math.cos(ry / 2) }).setLinearDamping(.15).setAngularDamping(.35).setCanSleep(true));
    const col = world.createCollider(desc, rb); group.add(mesh); mesh.castShadow = true; mesh.receiveShadow = true;
    const b = { rb, mesh, home: { x, y, z, ry } }; bodies.push(b);
    tags.set(col.handle, { kind, rb, hit: i => { const j = Math.min(i.dmg * .2, rb.mass() * 9); rb.applyImpulseAtPoint({ x: i.dir.x * j, y: i.dir.y * j + j * .1, z: i.dir.z * j }, i.point, true); stats[kind === 'drum' ? 'drums' : kind === 'crate' ? 'crates' : 'cans']++; return 'hit' } });
    mesh.position.set(x, y, z); return b;
  }
  const drumCol = [0xb23a2a, 0x2f5f9d, 0x3f7440, 0xd2a233, 0x6b6e72];
  function drum(x, y, z, c) {
    const m = mat(drumCol[c % drumCol.length], .55, .55), g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(.29, .29, .9, 18), m));
    for (const yy of [-.28, .28]) { const t = new THREE.Mesh(new THREE.TorusGeometry(.292, .014, 6, 20), m); t.rotation.x = Math.PI / 2; t.position.y = yy; g.add(t) }
    g.children.forEach(o => { o.castShadow = true });
    dyn(g, RAPIER.ColliderDesc.cylinder(.45, .29).setDensity(34).setFriction(.8).setRestitution(.2), 'drum', x, y + .46, z);
  }
  function crate(x, y, z, ry = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(.55, .55, .55), mWood);
    dyn(m, RAPIER.ColliderDesc.cuboid(.275, .275, .275).setDensity(60).setFriction(.7).setRestitution(.1), 'crate', x, y + .28, z, ry);
  }
  function can(x, y, z, c) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(.034, .034, .12, 10), mat(c, .4, .6));
    dyn(m, RAPIER.ColliderDesc.cylinder(.06, .034).setDensity(150).setFriction(.5), 'can', x, y + .062, z);
  }
  drum(44.4, 0, 3.0, 0); drum(45.1, 0, 3.0, 1); drum(44.75, .93, 3.0, 2); drum(40, 0, -3.0, 3); drum(40.7, 0, -3.0, 4); drum(36.5, 0, 3.1, 1);
  for (const [i, [x, y, z]] of [[52, 0, -2.6], [52, 0, -3.25], [52, 0, -1.95], [52, .56, -2.28], [52, .56, -2.93], [52, 1.12, -2.6]].entries()) crate(x, y, z, i % 2 ? .1 : -.08);
  // can table (static) and a pyramid of cans
  const table = new THREE.Mesh(new THREE.BoxGeometry(1.5, .05, .55), mWood); add(table, 32.2, .82, -3.0);
  world.createCollider(RAPIER.ColliderDesc.cuboid(.75, .025, .275).setTranslation(32.2, .82, -3.0), statics);
  for (const [sx, sz] of [[-.65, -.22], [.65, -.22], [-.65, .22], [.65, .22]]) { add(new THREE.Mesh(new THREE.BoxGeometry(.06, .8, .06), mWood), 32.2 + sx, .4, -3.0 + sz); world.createCollider(RAPIER.ColliderDesc.cuboid(.03, .4, .03).setTranslation(32.2 + sx, .4, -3.0 + sz), statics) }
  const canCol = [0xc94a35, 0x3f7cc4, 0xe0b53a, 0x58a35c];
  let ci = 0; for (let row = 0; row < 3; row++) for (let k = 0; k < 4 - row; k++) { can(32.2 + (k - (3 - row) / 2) * .1, .845 + row * .124, -3.0 + ((row + k) % 2 ? .04 : -.04), canCol[ci++ % 4]) }

  // ---- mannequins (fall back when their hit points run out, stand up after a few seconds) ----
  const dummies = [];
  function dummy(x, z) {
    const body = new THREE.Group(), tilt = new THREE.Group(), fall = new THREE.Group(), m = mat(0x5d6558, .8, .05), mh = mat(0x7a8372, .8, .05);
    fall.position.set(x, 0, z); fall.rotation.y = -Math.PI / 2; fall.add(tilt); tilt.add(body); group.add(fall);
    const part = (geo, mm, px, py, pz) => { const o = new THREE.Mesh(geo, mm); o.position.set(px, py, pz); o.castShadow = true; body.add(o); return o };
    part(new THREE.CylinderGeometry(.06, .07, 1.2, 8), mSteel, 0, .6, -.06);
    part(new THREE.CapsuleGeometry(.2, .5, 6, 14), m, 0, 1.2, 0);
    part(new THREE.SphereGeometry(.125, 16, 12), mh, 0, 1.76, 0);
    part(new THREE.BoxGeometry(.55, .12, .22), m, 0, 1.45, 0);
    part(new THREE.BoxGeometry(.34, .3, .18), m, 0, .85, 0);
    const d = { x, z, hp: 100, down: false, t: 0, fall, tilt, cols: [] };
    const mk = (desc, kind, head) => { const c = world.createCollider(desc, statics); d.cols.push(c); tags.set(c.handle, { kind, hit: i => hitDummy(d, i, head) }) };
    mk(RAPIER.ColliderDesc.capsule(.25, .22).setTranslation(x, 1.15, z), 'dummy', false);
    mk(RAPIER.ColliderDesc.ball(.13).setTranslation(x, 1.76, z), 'dummy', true);
    mk(RAPIER.ColliderDesc.cuboid(.2, .35, .18).setTranslation(x, .5, z), 'dummy', false);
    dummies.push(d); return d;
  }
  function hitDummy(d, i, head) {
    if (d.down) return null;
    stats.dummyHits++; if (head) stats.headshots++;
    d.hp -= i.dmg * (head ? 2.5 : 1);
    d.flinch = .12;
    if (d.hp <= 0) { d.down = true; d.t = 0; stats.dummyDown++; d.cols.forEach(c => c.setEnabled(false)); return 'kill' }
    return head ? 'head' : 'hit';
  }
  const dummyA = dummy(48.5, -.4), dummyB = dummy(50.6, 1.9);
  anims.push(dt => {
    for (const d of dummies) {
      if (d.down) { d.t += dt; const k = Math.min(1, d.t / .45); d.tilt.rotation.x = -Math.PI / 2 * (k * k * (3 - 2 * k)) * .97; if (d.t > 3.4) { d.down = false; d.hp = 100; d.cols.forEach(c => c.setEnabled(true)) } }
      else { d.tilt.rotation.x -= d.tilt.rotation.x * Math.min(1, dt * 8); if (d.flinch > 0) { d.flinch -= dt; d.tilt.rotation.x = -.09 } }
    }
  });

  return {
    group, tags, stats, bodies, dummies, dummyA, dummyB,
    /** per frame: copy the physics bodies onto their meshes */
    update() {
      for (const { rb, mesh } of bodies) { const p = rb.translation(), q = rb.rotation(); mesh.position.set(p.x, p.y, p.z); mesh.quaternion.set(q.x, q.y, q.z, q.w) }
    },
    /** fixed tick: wobbling plates, falling and rising mannequins */
    tick(h) { for (const a of anims) a(h) },
    dispose() { group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); [].concat(o.material).forEach(m => m.dispose?.()) } }) },
  };
}
