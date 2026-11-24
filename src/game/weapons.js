/**
 * weapons.js
 * Shooting for the hero: three weapons (pistol, assault rifle, Dane gun), over-the-shoulder aiming, spread that grows while
 * you move or fire in bursts, recoil that kicks the camera, magazines and reloads, hit-scan bullets cast from the crosshair
 * against the Rapier world, tracers, muzzle flash, sparks / dust / decals, hit markers, and noise events for later enemies.
 * The weapon models are procedural placeholders; real models come from asset downloads (docs/REALISM.md).
 */
import * as THREE from 'three';
import { glow, rng, clamp } from '../core/engine.js';
import { RANGE_LINE } from './range.js';

export const WEAPONS = [
  { id: 'pistol', name: 'Pistol', auto: false, rpm: 380, mag: 12, reserve: 48, dmg: 30, pellets: 1, spread: .3, bloom: .5, bloomMax: 2.2, kick: .018, kickYaw: .004, reload: 1.6, range: 150, sound: 'pistol', noise: .7 },
  { id: 'rifle', name: 'Assault rifle', auto: true, rpm: 600, mag: 30, reserve: 120, dmg: 24, pellets: 1, spread: .22, bloom: .3, bloomMax: 3.2, kick: .012, kickYaw: .006, reload: 2.4, range: 220, sound: 'rifle', noise: 1 },
  { id: 'dane', name: 'Dane gun', auto: false, rpm: 45, mag: 1, reserve: 16, dmg: 14, pellets: 9, spread: 2.4, bloom: 0, bloomMax: 0, kick: .075, kickYaw: .012, reload: 3.4, range: 45, sound: 'dane', noise: 1 },
];

// ---- placeholder gun models: +z is forward, the origin is the grip ----
function gunModel(id) {
  const g = new THREE.Group(), steel = new THREE.MeshStandardMaterial({ color: 0x25282b, roughness: .4, metalness: .85 }), wood = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: .7 });
  const box = (w, h, d, x, y, z, m = steel, rx = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.x = rx; o.castShadow = true; g.add(o); return o };
  const cyl = (r, len, x, y, z, m = steel) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), m); o.rotation.x = Math.PI / 2; o.position.set(x, y, z); o.castShadow = true; g.add(o); return o };
  const muzzle = new THREE.Object3D(); g.add(muzzle);
  if (id === 'pistol') {
    box(.032, .045, .2, 0, .055, .07); box(.03, .1, .045, 0, -.03, -.01, steel, .22); box(.012, .02, .05, 0, .085, .17, steel); cyl(.008, .03, 0, .05, .185); muzzle.position.set(0, .055, .21);
  } else if (id === 'rifle') {
    box(.05, .075, .32, 0, .03, .12); cyl(.011, .42, 0, .05, .47); box(.045, .05, .26, 0, .045, .35, wood); box(.04, .1, .045, 0, -.05, -.01, steel, .15);
    box(.036, .15, .06, 0, -.1, .15, steel, .18); box(.05, .1, .3, 0, .0, -.22, wood); box(.012, .03, .012, 0, .095, .55); box(.02, .024, .05, 0, .085, .0); muzzle.position.set(0, .05, .69);
  } else {
    cyl(.017, .9, 0, .05, .5); cyl(.012, .7, 0, .02, .45); box(.05, .1, .34, 0, 0, -.12, wood); box(.04, .06, .26, 0, .02, .1, wood); box(.03, .08, .045, 0, -.07, -.05, wood, .18); muzzle.position.set(0, .05, .96);
  }
  g.userData.muzzle = muzzle; return g;
}

const _d = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _o = new THREE.Vector3(), _p = new THREE.Vector3(), _n = new THREE.Vector3(), _m = new THREE.Vector3(), _l = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), YAXIS = new THREE.Vector3(0, 1, 0);

export function createWeapons({ P, scene, camera, cam, player, hud, range, audio, input }) {
  const { RAPIER, world } = P, rnd = rng(77), R = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  const st = WEAPONS.map(w => ({ ammo: w.mag, reserve: w.reserve }));
  const w = {
    cfg: { fwd: .36, drop: .1, side: .1, lfwd: .27, readyFwd: .3, readyDrop: .42, readyPitch: .6 },
    cur: 0, cool: 0, reload: 0, bloom: 0, sinceShot: 9, recoil: 0, armK: 0, flash: 0, fxSpeed: 1, hitT: 0, dt: .016, noises: [], stats: { shots: 0, hits: 0 }, last: null,
    get weapon() { return WEAPONS[this.cur] }, get state() { return st[this.cur] },
  };

  // ---- models ----
  const guns = WEAPONS.map(x => { const g = gunModel(x.id); g.visible = false; scene.add(g); return g });
  guns[0].visible = true;
  const muzzleP = new THREE.Vector3();

  // ---- effects pools ----
  const tracers = [], tmat = new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  for (let i = 0; i < 28; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.007, .007, 1, 4, 1, true), tmat.clone()); m.visible = false; m.frustumCulled = false; scene.add(m); tracers.push({ m, life: 0 }) }
  let ti = 0;
  const flashS = glow(0xffd9a0, .6), flashS2 = glow(0xffffff, .22); flashS.visible = flashS2.visible = false; scene.add(flashS, flashS2);
  const parts = [], gt = glow(0, 1).material.map;
  for (let i = 0; i < 56; i++) {
    const spark = i < 28, s = new THREE.Sprite(new THREE.SpriteMaterial(spark ? { map: gt, color: 0xffc060, blending: THREE.AdditiveBlending, depthWrite: false, fog: false } : { map: gt, color: 0x8d7456, transparent: true, depthWrite: false, opacity: 0 }));
    s.visible = false; scene.add(s); parts.push({ s, spark, life: 0, max: 1, v: new THREE.Vector3(), size: .1 });
  }
  const decals = [], dmat = new THREE.MeshBasicMaterial({ color: 0x15120f, transparent: true, opacity: .82, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -7, polygonOffsetUnits: -7 }), dgeo = new THREE.CircleGeometry(.04, 10);
  for (let i = 0; i < 48; i++) { const m = new THREE.Mesh(dgeo, dmat); m.visible = false; scene.add(m); decals.push(m) }
  let di = 0;
  const burst = (p, n, normal, spark, v0, size, life) => {
    let k = 0; for (const q of parts) {
      if (k >= n) break; if (q.life > 0 || q.spark !== spark) continue; k++;
      q.s.visible = true; q.s.position.copy(p); q.life = q.max = life * (.6 + rnd() * .6); q.size = size * (.7 + rnd() * .6);
      q.v.set(rnd() - .5, rnd() - .1, rnd() - .5).multiplyScalar(spark ? v0 : v0 * .4).addScaledVector(normal, v0 * (spark ? .6 : .25)); if (!spark) q.v.y += .5;
    }
  };
  const tracer = (a, b) => {
    const t = tracers[ti++ % tracers.length]; _d.subVectors(b, a); const len = _d.length(); if (len < .05) return; _d.divideScalar(len);
    t.m.position.copy(a).addScaledVector(_d, len / 2); t.m.quaternion.setFromUnitVectors(YAXIS, _d); t.m.scale.set(1, len, 1); t.m.visible = true; t.life = .09; t.m.material.opacity = .9;
  };

  // ---- HUD ----
  const el = document.createElement('div');
  el.innerHTML = `<div id="cross"><i></i><i></i><i></i><i></i><b></b></div><div id="hitm"><i></i><i></i><i></i><i></i></div><div id="ammo"><span id="wn"></span><strong id="am"></strong><div id="rb"><i></i></div></div><button id="rangebtn">Range</button>`;
  hud.append(...el.children);
  const $ = id => hud.querySelector('#' + id), cross = $('cross'), hitm = $('hitm'), am = $('am'), wn = $('wn'), rb = $('rb').firstChild;
  $('rangebtn').onclick = () => w.toRange(); $('rangebtn').addEventListener('pointerdown', e => e.stopPropagation());
  let lastTxt = '';
  const hudUpdate = () => {
    const W = w.weapon, s = w.state, txt = `${W.name}|${s.ammo}|${s.reserve}|${w.reload > 0}`;
    if (txt !== lastTxt) { lastTxt = txt; wn.textContent = W.name; am.textContent = `${s.ammo} / ${s.reserve}`; am.classList.toggle('low', s.ammo === 0 || (W.mag > 1 && s.ammo <= W.mag * .25)) }
    rb.style.width = w.reload > 0 ? (clamp(w.reload / W.reload, 0, 1) * 100) + '%' : '0%'; rb.parentElement.style.opacity = w.reload > 0 ? 1 : 0;
  };

  // ---- firing ----
  const aimDir = out => cam.aimDir(out);
  function spreadNow() { return w.weapon.spread + w.bloom + player.speed * .22 + (player.aimMode ? 0 : .9) }
  function selectWeapon(i) {
    if (i === w.cur || i < 0 || i >= WEAPONS.length) return; w.cur = i; w.reload = 0; w.cool = .2; w.bloom = 0; guns.forEach((g, k) => { g.visible = k === i }); audio.click('slide');
  }
  function startReload() {
    const W = w.weapon, s = w.state; if (w.reload > 0 || s.ammo >= W.mag || s.reserve <= 0) return false; w.reload = 1e-4; audio.click('mag'); w._reloadSound = false; return true;
  }
  function castPellet(spreadDeg) {
    const W = w.weapon; aimDir(_d);
    const a = Math.atan(Math.tan(spreadDeg * Math.PI / 180) * Math.sqrt(rnd())), phi = rnd() * Math.PI * 2;
    _r.crossVectors(_d, UP).normalize(); _u.crossVectors(_r, _d);
    _d.addScaledVector(_r, Math.tan(a) * Math.cos(phi)).addScaledVector(_u, Math.tan(a) * Math.sin(phi)).normalize();
    _o.copy(cam.target);
    R.origin.x = _o.x; R.origin.y = _o.y; R.origin.z = _o.z; R.dir.x = _d.x; R.dir.y = _d.y; R.dir.z = _d.z;
    const hit = world.castRayAndGetNormal(R, W.range, true, undefined, undefined, player.col);
    if (!hit) { _p.copy(_o).addScaledVector(_d, Math.min(W.range, 90)); tracer(muzzleP, _p); return null }
    _p.copy(_o).addScaledVector(_d, hit.timeOfImpact); _n.set(hit.normal.x, hit.normal.y, hit.normal.z);
    tracer(muzzleP, _p);
    const tag = range.tags.get(hit.collider.handle), kind = tag ? tag.kind : 'world', dist = hit.timeOfImpact;
    let mark = null; if (tag && tag.hit) mark = tag.hit({ point: { x: _p.x, y: _p.y, z: _p.z }, dir: { x: _d.x, y: _d.y, z: _d.z }, dmg: W.dmg, dist });
    if (kind === 'plate' || kind === 'drum' || kind === 'can') burst(_p, 5, _n, true, 4, .07, .4);
    else if (kind === 'crate') burst(_p, 4, _n, false, 2.5, .14, .5);
    else if (kind === 'world') { burst(_p, 3, _n, false, 2.2, .2, .7); burst(_p, 2, _n, true, 2.5, .05, .25) }
    else burst(_p, 3, _n, false, 1.8, .16, .5);
    if (kind === 'world') { const dm = decals[di++ % decals.length]; dm.position.copy(_p).addScaledVector(_n, .012); dm.lookAt(_l.copy(_p).add(_n)); dm.rotateZ(rnd() * 6); dm.visible = true }
    audio.impact(kind === 'crate' ? 'wood' : kind === 'can' ? 'plate' : kind, dist);
    return { mark, kind };
  }
  function fire() {
    const W = w.weapon, s = w.state; s.ammo--; w.cool = 60 / W.rpm; w.stats.shots++; w.sinceShot = 0;
    const sp = spreadNow(); let best = null;
    for (let i = 0; i < W.pellets; i++) { const r = castPellet(sp); if (r) { w.stats.hits++; if (r.mark && (!best || r.mark === 'kill' || (r.mark === 'head' && best !== 'kill'))) best = r.mark } }
    w.bloom = Math.min(W.bloomMax, w.bloom + W.bloom);
    const k = W.kick * (.85 + rnd() * .3); cam.kick(k, (rnd() - .5) * 2 * W.kickYaw); w.recoil += k;
    audio.shot(W.sound); w.flash = .07; w.last = { t: performance.now(), pos: player.feet.toArray(), level: W.noise };
    w.noises.push({ x: player.pos.x, z: player.pos.z, level: W.noise, age: 0 }); if (w.noises.length > 16) w.noises.shift();
    if (best) { w.hitT = best === 'kill' ? .3 : .16; hitm.className = best; void hitm.offsetWidth; hitm.classList.add('on') }
    if (s.ammo === 0 && s.reserve > 0) { w.autoReload = .35 }
  }

  /** fixed tick (60 Hz): reads input, sets the aim mode, handles weapon switching, reloading, cooldown and firing */
  w.step = function (h) {
    const W = w.weapon, s = w.state, aiming = input.aiming();
    w.sinceShot += h; player.aimMode = aiming || w.sinceShot < 1.1; cam.setAim(aiming);
    for (const n of w.noises) n.age += h;
    const sw = input.takeWeapon(); if (sw === -2) selectWeapon((w.cur + 1) % WEAPONS.length); else if (sw >= 0) selectWeapon(sw);
    if (input.takeReload()) startReload();
    if (w.autoReload > 0) { w.autoReload -= h; if (w.autoReload <= 0) startReload() }
    if (w.reload > 0) {
      w.reload += h; if (!w._reloadSound && w.reload > W.reload * .6) { w._reloadSound = true; audio.click('slide') }
      if (w.reload >= W.reload) { const take = Math.min(W.mag - s.ammo, s.reserve); s.ammo += take; s.reserve -= take; w.reload = 0; audio.click('mag') }
    }
    w.cool = Math.max(0, w.cool - h); w.bloom = Math.max(0, w.bloom - h * 3.5);
    const press = input.takeFire(), want = W.auto ? (input.firing() || press) : press;
    if (want && w.reload <= 0 && w.cool <= 0) { if (s.ammo > 0) fire(); else { audio.click('empty'); w.cool = .28; if (s.reserve > 0) startReload() } }
  };

  /** per frame: effects, recoil recovery, crosshair, HUD (before the player's pose is applied) */
  w.update = function (dt) {
    w.dt = dt; const fx = dt * w.fxSpeed;
    // camera recoil recovers a little after the burst
    if (w.sinceShot > .12 && w.recoil > 0) { const r = w.recoil * (1 - Math.exp(-dt * 5)); cam.pitch += r; w.recoil -= r }
    if (w.flash > 0) w.flash -= fx;
    for (const t of tracers) if (t.life > 0) { t.life -= fx; t.m.material.opacity = Math.max(0, t.life / .09) * .9; if (t.life <= 0) t.m.visible = false }
    for (const q of parts) if (q.life > 0) {
      q.life -= fx; const k = 1 - q.life / q.max;
      if (q.life <= 0) { q.s.visible = false; continue }
      q.v.y -= (q.spark ? 9 : -.4) * fx; q.s.position.addScaledVector(q.v, fx);
      if (q.spark) { q.s.scale.setScalar(q.size * (1 - k * .7)); q.s.material.opacity = 1 - k } else { q.s.scale.setScalar(q.size * (1 + k * 3.2)); q.s.material.opacity = .5 * (1 - k) }
    }
    // HUD
    const px = spreadNow() * (innerHeight / camera.fov) * 1.0 + 4; cross.style.setProperty('--sp', px.toFixed(1) + 'px'); cross.classList.toggle('aim', cam.aimK > .5);
    if (w.hitT > 0) { w.hitT -= dt; if (w.hitT <= 0) hitm.classList.remove('on') }
    hudUpdate();
  };

  // ---- pose: two-bone arm IK to the gun, then the gun itself (called by the player right after the animation mixer) ----
  const _pw = new THREE.Quaternion(), _wq = new THREE.Quaternion(), _dq = new THREE.Quaternion(), _bv = new THREE.Vector3(), _S = new THREE.Vector3(), _E = new THREE.Vector3(), _H = new THREE.Vector3(), _T = new THREE.Vector3(), _ST = new THREE.Vector3(), _PD = new THREE.Vector3(), _E2 = new THREE.Vector3();
  const aimBone = (b, child, dir) => {                                   // rotate bone b (in world space) so that the bone->child direction becomes `dir`
    b.getWorldPosition(_S); child.getWorldPosition(_bv); _bv.sub(_S).normalize();
    _dq.setFromUnitVectors(_bv, dir); b.parent.getWorldQuaternion(_pw); b.getWorldQuaternion(_wq).premultiply(_dq);
    b.quaternion.copy(_pw.invert().multiply(_wq)); b.updateMatrixWorld(true);
  };
  const armIK = (body, side, T, pole) => {
    const up = body.bones[side + 'Arm'], fo = body.bones[side + 'ForeArm'], ha = body.bones[side + 'Hand']; if (!up || !fo || !ha) return;
    up.getWorldPosition(_S); fo.getWorldPosition(_E); ha.getWorldPosition(_H);
    const l1 = _S.distanceTo(_E), l2 = _E.distanceTo(_H);
    _ST.subVectors(T, _S); const dist = clamp(_ST.length(), .05, l1 + l2 - .005); _ST.normalize();
    const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    _PD.copy(pole).addScaledVector(_ST, -pole.dot(_ST)).normalize();
    _E2.copy(_S).addScaledVector(_ST, a).addScaledVector(_PD, h);
    aimBone(up, fo, _bv.subVectors(_E2, _S).normalize().clone());
    fo.getWorldPosition(_E); aimBone(fo, ha, _bv.subVectors(T, _E).normalize().clone());
  };
  const gunPos = new THREE.Vector3(), aimD = new THREE.Vector3(), fwd = new THREE.Vector3(), rgt = new THREE.Vector3(), mid = new THREE.Vector3(), dirNow = new THREE.Vector3(), hl = new THREE.Vector3(), poleR = new THREE.Vector3(), poleL = new THREE.Vector3();
  player.post = function (pl) {
    const body = pl.body, aim = pl.aimMode, dt = w.dt || .016, c = w.cfg, W = w.weapon;
    w.armK += ((aim ? 1 : 0) - w.armK) * (1 - Math.exp(-Math.max(dt, .016) * 9));
    if (pl.cape) pl.cape.visible = w.armK < .3;                                  // the cape would hang in front of the camera while aiming
    const k = w.armK, dip = w.reload > 0 ? Math.sin(Math.min(1, w.reload / W.reload) * Math.PI) : 0;
    cam.aimDir(aimD); fwd.set(Math.sin(pl.heading), 0, Math.cos(pl.heading)); rgt.set(-fwd.z, 0, fwd.x);
    dirNow.copy(fwd).multiplyScalar(Math.cos(c.readyPitch)).addScaledVector(UP, -Math.sin(c.readyPitch)).lerp(aimD, k).normalize();     // gun direction: low ready -> crosshair
    body.root.updateMatrixWorld(true);
    body.bones.RightArm.getWorldPosition(_T); body.bones.LeftArm.getWorldPosition(mid); mid.add(_T).multiplyScalar(.5);                       // shoulder midpoint
    gunPos.copy(mid).addScaledVector(fwd, c.readyFwd * (1 - k) + c.fwd * k).addScaledVector(rgt, c.side).addScaledVector(UP, -(c.readyDrop * (1 - k) + c.drop * k) - dip * .12);
    if (k > .02) gunPos.addScaledVector(aimD, 0).y += aimD.y * c.fwd * k * .6;
    hl.copy(gunPos).addScaledVector(dirNow, W.id === 'pistol' ? .05 : c.lfwd).addScaledVector(rgt, W.id === 'pistol' ? -.07 : -.01).addScaledVector(UP, -.03);
    poleR.copy(rgt).multiplyScalar(.8).addScaledVector(UP, -.8); poleL.copy(rgt).multiplyScalar(-.8).addScaledVector(UP, -.8);
    armIK(body, 'Right', gunPos, poleR); armIK(body, 'Left', hl, poleL);
    const gun = guns[w.cur]; gun.position.copy(gunPos); gun.lookAt(_T.copy(gunPos).addScaledVector(dirNow, 10)); gun.updateMatrixWorld(true);
    gun.userData.muzzle.getWorldPosition(muzzleP);
    if (w.flash > 0) { flashS.visible = flashS2.visible = true; flashS.position.copy(muzzleP); flashS2.position.copy(muzzleP); flashS.scale.setScalar(.45 + rnd() * .4); flashS2.scale.setScalar(.2 + rnd() * .1) } else flashS.visible = flashS2.visible = false;
  };

  // ---- helpers for the range and the tests ----
  w.toRange = function () {
    player.teleport(RANGE_LINE.x - .6, .05, 0); cam.yaw = Math.PI / 2; cam.pitch = .16; cam.update(0, player.pos, player.col);
  };
  /** point the camera at a world position (used by tests) */
  w.aimAt = function (x, y, z) {
    cam.update(0, player.pos, player.col); _d.set(x - cam.target.x, y - cam.target.y, z - cam.target.z); const len = _d.length();
    cam.yaw = Math.atan2(_d.x, _d.z); cam.pitch = -Math.asin(_d.y / len); cam.update(0, player.pos, player.col);
  };
  w.select = selectWeapon; w.startReload = startReload;
  w.dispose = function () {
    guns.forEach(g => { scene.remove(g); g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose() } }) });
    tracers.forEach(t => { scene.remove(t.m); t.m.geometry.dispose(); t.m.material.dispose() }); tmat.dispose();
    parts.forEach(q => { scene.remove(q.s); q.s.material.dispose() }); decals.forEach(m => scene.remove(m)); dmat.dispose(); dgeo.dispose();
    scene.remove(flashS, flashS2); flashS.material.dispose(); flashS2.material.dispose(); player.post = null;
    [...hud.querySelectorAll('#cross,#hitm,#ammo,#rangebtn')].forEach(e => e.remove());
  };
  hudUpdate();
  return w;
}
