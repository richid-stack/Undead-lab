/**
 * common.js
 * Shared gear + tooling: eyes, pedestal, bone attach, wound raycasts, clip retargeting, undead props.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { $, rng, clamp, cvs, canvasTex, glow, M, MP } from '../../core/engine.js';
import { BIO_T, injectBio, restFrame } from '../../shaders/bio.js';

// =====================================================================================
//  New gear: eyes, pedestal, attach helpers
// =====================================================================================

// ---- eye texture (equirect; iris centred on u=.25,v=.5 which faces +z on a three.js sphere) ----
export function eyeTexture(kind, seed = 3) {
  const R = rng(seed), W = 1024, H = 512, [c, g] = cvs(W, H);
  const dead = kind === 'dead', cx = W * .25, cy = H * .5;
  // sclera
  g.fillStyle = dead ? '#cfc9a8' : '#eeece6'; g.fillRect(0, 0, W, H);
  const sg = g.createRadialGradient(cx, cy, 70, cx, cy, 300); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, dead ? 'rgba(90,60,30,.35)' : 'rgba(150,110,100,.28)');
  g.fillStyle = sg; g.fillRect(0, 0, W, H);
  // blood vessels
  g.lineCap = 'round';
  for (let i = 0; i < (dead ? 110 : 34); i++) {
    const a = R() * 6.283, r0 = 95 + R() * 60; let x = cx + Math.cos(a) * r0, y = cy + Math.sin(a) * r0 * .95;
    g.beginPath(); g.moveTo(x, y); g.strokeStyle = `rgba(${dead ? 120 : 175},${dead ? 25 : 50},${dead ? 25 : 50},${dead ? .5 : .22})`; g.lineWidth = .8 + R() * 1.6;
    for (let k = 0; k < 7; k++) { const aa = a + (R() - .5) * .7; x += Math.cos(aa) * (22 + R() * 22); y += Math.sin(aa) * (22 + R() * 22); g.lineTo(x, y) } g.stroke();
  }
  // iris
  const ir = 92;
  const base = dead ? ['#b9c4c2', '#8f9c9c', '#5c6767'] : ['#9a6b3f', '#6a4424', '#2c1a0c'];
  let gr = g.createRadialGradient(cx, cy, 8, cx, cy, ir); gr.addColorStop(0, base[0]); gr.addColorStop(.55, base[1]); gr.addColorStop(1, base[2]);
  g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, ir, 0, 6.283); g.fill();
  for (let i = 0; i < 360; i++) {                                    // radial fibres
    const a = i / 360 * 6.283 + R() * .02, r1 = 16 + R() * 14, r2 = ir * (.8 + R() * .2);
    g.strokeStyle = `rgba(${dead ? '230,240,240' : '255,210,150'},${.05 + R() * .16})`; g.lineWidth = 1 + R();
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2); g.stroke();
    if (i % 3 === 0) { g.strokeStyle = 'rgba(20,10,5,.22)'; g.beginPath(); g.moveTo(cx + Math.cos(a) * 24, cy + Math.sin(a) * 24); g.lineTo(cx + Math.cos(a) * ir * .95, cy + Math.sin(a) * ir * .95); g.stroke(); }
  }
  gr = g.createRadialGradient(cx, cy, ir - 14, cx, cy, ir + 5); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(10,6,4,.85)'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, ir + 5, 0, 6.283); g.fill();
  // collarette + pupil
  g.strokeStyle = dead ? 'rgba(255,255,255,.25)' : 'rgba(255,220,160,.35)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 34, 0, 6.283); g.stroke();
  g.fillStyle = '#050304'; g.beginPath(); g.arc(cx, cy, dead ? 20 : 30, 0, 6.283); g.fill();
  if (dead) {                                                        // milky cataract haze + opaque flecks
    gr = g.createRadialGradient(cx - 10, cy - 8, 6, cx, cy, ir + 8); gr.addColorStop(0, 'rgba(235,240,235,.78)'); gr.addColorStop(.7, 'rgba(210,222,222,.55)'); gr.addColorStop(1, 'rgba(210,222,222,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, ir + 8, 0, 6.283); g.fill();
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(250,250,245,${.12 + R() * .25})`; g.beginPath(); g.arc(cx + (R() - .5) * 150, cy + (R() - .5) * 150, 2 + R() * 7, 0, 6.283); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
export function eyeball(kind = 'live', r = .25, seed = 3) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 56, 40), new THREE.MeshPhysicalMaterial({ map: eyeTexture(kind, seed), roughness: kind === 'dead' ? .22 : .12, clearcoat: 1, clearcoatRoughness: .03, ior: 1.38, specularIntensity: 1, envMapIntensity: 1.2 }));
  m.castShadow = false; g.add(m);
  // cornea dome (thin clear shell) – adds a second specular highlight layer & depth
  const co = new THREE.Mesh(new THREE.SphereGeometry(r * 1.012, 48, 24, Math.PI * .5 - .62, 1.24, Math.PI * .5 - .62, 1.24), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, metalness: 0, transparent: true, opacity: .09, clearcoat: 1, clearcoatRoughness: 0, depthWrite: false }));
  g.add(co); g.userData.ball = m; return g;
}

// ---- marble / stone pedestal ----
export function pedestal(h = 1.22, rad = .21, tint = '#cfc9c0') {
  const g = new THREE.Group(), [c, x] = cvs(512, 1024), R = rng(7);
  x.fillStyle = tint; x.fillRect(0, 0, 512, 1024);
  for (let i = 0; i < 26; i++) { x.strokeStyle = `rgba(${60 + R() * 40},${60 + R() * 40},${70 + R() * 40},${.04 + R() * .14})`; x.lineWidth = .6 + R() * 2.4; x.beginPath(); let px = R() * 512, py = 0; x.moveTo(px, py); while (py < 1024) { px += (R() - .5) * 60; py += 40 + R() * 70; x.lineTo(px, py) } x.stroke() }
  for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(${R() < .5 ? 255 : 0},${R() < .5 ? 255 : 0},${R() < .5 ? 255 : 0},${R() * .05})`; x.fillRect(R() * 512, R() * 1024, 1 + R() * 2, 1 + R() * 2) }
  const map = canvasTex(c, true);
  const mat = MP(0xffffff, { map, roughness: .32, metalness: 0, clearcoat: .55, clearcoatRoughness: .12 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.04, h, 48, 1), mat); shaft.position.y = h / 2; shaft.castShadow = shaft.receiveShadow = true; g.add(shaft);
  const cap = new THREE.Mesh(new RoundedBoxGeometry(rad * 2.5, .05, rad * 2.5, 4, .012), mat); cap.position.y = h + .025; cap.castShadow = cap.receiveShadow = true; g.add(cap);
  const base = new THREE.Mesh(new RoundedBoxGeometry(rad * 2.7, .07, rad * 2.7, 4, .015), mat); base.position.y = .035; base.receiveShadow = true; g.add(base);
  g.userData.top = h + .05; return g;
}

// ---- bone helpers (poses are authored in the character's own frame: x right, y up, z forward) ----
export const _rq = new THREE.Quaternion(), _ax = new THREE.Vector3(), _dq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _wq = new THREE.Quaternion();
// rotate a bone by `ang` about an axis given in the character frame (re-expressed in world via the root's orientation)
export function rotBone(c, name, axis, ang) {
  const b = c.bones[name]; if (!b || !b.parent) return;
  c.root.getWorldQuaternion(_rq);
  _ax.set(axis[0], axis[1], axis[2]).applyQuaternion(_rq).normalize();
  _dq.setFromAxisAngle(_ax, ang);
  b.parent.getWorldQuaternion(_pq);
  b.getWorldQuaternion(_wq).premultiply(_dq);                        // new world = delta * old world
  b.quaternion.copy(_pq.invert().multiply(_wq));                     // back into parent space
  b.updateMatrixWorld(true);
}

// =====================================================================================
//  Body tooling: attach gear to bones in bind-pose world coordinates, wound raycasts, retargeting
// =====================================================================================
// Place `obj` on a bone so that in the bind pose it sits at `worldPoint` (metres, relative to c.root) with world-aligned axes
export function attachAt(c, boneName, obj, worldPoint, rot = [0, 0, 0]) {
  const b = c.bones[boneName]; c.m.updateMatrixWorld(true);
  const wq = b.getWorldQuaternion(new THREE.Quaternion()), ws = b.getWorldScale(new THREE.Vector3()).x, inv = wq.clone().invert();
  const bp = b.getWorldPosition(new THREE.Vector3()); c.root.worldToLocal(bp);
  obj.scale.multiplyScalar(1 / ws);
  obj.quaternion.copy(inv).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])));
  obj.position.copy(new THREE.Vector3(worldPoint[0] - bp.x, worldPoint[1] - bp.y, worldPoint[2] - bp.z).applyQuaternion(inv).multiplyScalar(1 / ws));
  b.add(obj); return obj;
}
export function bindPos(c, name) { c.m.updateMatrixWorld(true); const p = c.bones[name].getWorldPosition(new THREE.Vector3()); return c.root.worldToLocal(p).toArray().map(v => +v.toFixed(3)) }

// run BIO shader on every material of a body. cfg: { bio:{...}, wounds:[{o:[x,y,z], d:[dx,dy,dz], r, t}] , perMat(mat, name) }
export function bioBody(c, cfg) {
  const main = c.meshes.reduce((a, b) => b.geometry.attributes.position.count > a.geometry.attributes.position.count ? b : a);
  const fr = restFrame(main.geometry, c.height); c.frame = fr;
  c.root.updateMatrixWorld(true); const rc = new THREE.Raycaster(), W = [];
  for (const w of cfg.wounds || []) {
    rc.set(new THREE.Vector3(...w.o), new THREE.Vector3(...w.d).normalize());
    const hit = rc.intersectObjects(c.meshes, false)[0]; if (!hit) { console.warn('wound ray missed', w); continue }
    const l = hit.object.worldToLocal(hit.point.clone());
    W.push([(l.x - fr.origin.x) * fr.scale, (l.y - fr.origin.y) * fr.scale, (l.z - fr.origin.z) * fr.scale, w.r, w.t || 0]);
  }
  c.woundsP = W;
  const seen = new Set();
  for (const m of c.meshes) for (const mat of [].concat(m.material)) {
    if (seen.has(mat)) continue; seen.add(mat);
    const o = { origin: fr.origin, scale: fr.scale, wounds: W, ...(cfg.bio || {}), ...(cfg.perMat ? cfg.perMat(mat, mat.name) : {}) };
    c.bio = c.bio || []; c.bio.push(injectBio(mat, o)); mat.needsUpdate = true;
  }
}
// retarget a Mixamo clip from another Mixamo rig: delta against each rig's bind pose so differing rest poses (A vs T) don't splay limbs
export function retargetClip(clip, c, srcRoot, srcHipsY, dstHipsY) {
  const tracks = [], qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion();
  for (const tr of clip.tracks) {
    const node = tr.name.split('.')[0], prop = tr.name.split('.')[1], d = c.m.getObjectByName(node), s = srcRoot.getObjectByName(node);
    if (!d || !s) continue;
    if (prop === 'quaternion') {
      const v = tr.values.slice(), sInv = s.quaternion.clone().invert();
      for (let i = 0; i < v.length; i += 4) { qa.set(v[i], v[i + 1], v[i + 2], v[i + 3]); qc.copy(d.quaternion).multiply(sInv).multiply(qa); v[i] = qc.x; v[i + 1] = qc.y; v[i + 2] = qc.z; v[i + 3] = qc.w }
      tracks.push(new THREE.QuaternionKeyframeTrack(tr.name, tr.times, v)); continue;
    }
    if (/Hips$/.test(node) && prop === 'position') {
      const hp = d.position, v = tr.values.slice();
      for (let i = 0; i < v.length; i += 3) { v[i] = hp.x; v[i + 1] = v[i + 1] * (dstHipsY / srcHipsY); v[i + 2] = hp.z }
      tracks.push(new THREE.VectorKeyframeTrack(tr.name, tr.times, v));
    }
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

// ---------- stylised classification of a skin mask from a diffuse map (runs once at load) ----------
export function skinMaskFrom(map, { hue = [5, 42], sat = [.22, .85], val = [.12, .75] } = {}) {
  const img = map.image, [c, g] = cvs(img.width, img.height); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    const r = a[i] / 255, gg = a[i + 1] / 255, b = a[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), dl = mx - mn;
    let h = 0; if (dl > 0) { h = mx === r ? ((gg - b) / dl) % 6 : mx === gg ? (b - r) / dl + 2 : (r - gg) / dl + 4; h *= 60; if (h < 0) h += 360 }
    const s = mx ? dl / mx : 0, k = (h >= hue[0] && h <= hue[1] && s >= sat[0] && s <= sat[1] && mx >= val[0] && mx <= val[1]) ? 255 : 0;
    a[i] = a[i + 1] = a[i + 2] = k; a[i + 3] = 255;
  }
  g.putImageData(d, 0, 0); const t = new THREE.CanvasTexture(c); t.flipY = false; t.anisotropy = 4; t.userData = { canvas: c }; return t;
}

// =====================================================================================
//  Undead gear
// =====================================================================================
export const BIO_SWAY = { value: 0 };
export function swayMat(mat, amp = .014, freq = 1.7, phase = 0) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uT = BIO_T; sh.uniforms.uAmp = { value: amp }; sh.uniforms.uFreq = { value: freq }; sh.uniforms.uPh = { value: phase };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT,uAmp,uFreq,uPh;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat hang=clamp(-transformed.y*5.,0.,1.);transformed.x+=sin(uT*uFreq+transformed.y*9.+uPh)*uAmp*hang;transformed.z+=cos(uT*uFreq*.8+transformed.y*7.+uPh)*uAmp*hang*.8;');
  };
  mat.customProgramCacheKey = () => 'sway' + amp + freq + phase; return mat;
}
export function clothTex(base, seed, blood = .5) {
  const R = rng(seed), [c, g] = cvs(256, 512); g.fillStyle = base; g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${R() < .5 ? 0 : 255},${R() < .5 ? 0 : 255},${R() < .5 ? 0 : 255},${.02 + R() * .06})`; g.fillRect(R() * 256, R() * 512, 1 + R() * 3, 1 + R() * 3) }
  g.strokeStyle = 'rgba(0,0,0,.12)'; for (let y = 0; y < 512; y += 4) { g.beginPath(); g.moveTo(0, y + R() * 1.5); g.lineTo(256, y + R() * 1.5); g.stroke() }
  for (let i = 0; i < 18 * blood; i++) { const x = R() * 256, y = R() * 300, r = 6 + R() * 28; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(70,6,8,${.55 + R() * .3})`); gr.addColorStop(1, 'rgba(70,6,8,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); if (R() < .6) { g.fillStyle = 'rgba(60,5,7,.7)'; g.fillRect(x - 2, y, 3 + R() * 3, 40 + R() * 150) } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// torn hanging strip, pivot at top, hangs along -y
export function clothStrip(w, h, color = '#3b4034', seed = 1, blood = .6) {
  const R = rng(seed), geo = new THREE.PlaneGeometry(w, h, 4, 12); geo.translate(0, -h / 2, 0);
  const p = geo.attributes.position, cols = 5;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), v = -y / h, col = Math.round((x / w + .5) * (cols - 1));
    const rag = (rng(seed * 31 + col * 7)() * .35 + (col % 2 ? .06 : 0)) * h * smooth01((v - .6) / .4);
    p.setY(i, y + rag * smooth01(v * 1.2) + (R() - .5) * .004); p.setX(i, x + (R() - .5) * w * .06 * v + Math.sin(v * 5 + seed) * w * .1 * v);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, swayMat(new THREE.MeshStandardMaterial({ map: clothTex(color, seed, blood), roughness: .92, side: THREE.DoubleSide }), .016, 1.6 + R() * .6, R() * 6));
  m.castShadow = true; return m;
}
export const smooth01 = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x) };

// glowing infection pods + tendrils. returns Group in metres (origin at cluster centre)
export function sporeCluster(seed = 1, n = 6, spread = .06, hue = 'green', light = false) {
  const R = rng(seed), g = new THREE.Group();
  const col = hue === 'green' ? [0x8fe070, 0x2cff7a] : [0xffc860, 0xff8a1e];
  for (let i = 0; i < n; i++) {
    const r = .008 + R() * .026 * (i ? 1 : 1.4), a = R() * 6.283, d = i ? spread * (.4 + R()) : 0;
    const pod = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), new THREE.MeshPhysicalMaterial({ color: col[0], emissive: col[1], emissiveIntensity: .55 + R() * .6, roughness: .22, clearcoat: 1, clearcoatRoughness: .1, transmission: 0 }));
    pod.position.set(Math.cos(a) * d, (R() - .3) * spread * .8, Math.sin(a) * d * .8); pod.scale.set(1, .85 + R() * .5, 1); g.add(pod);
    const nuc = new THREE.Mesh(new THREE.SphereGeometry(r * .45, 10, 8), new THREE.MeshBasicMaterial({ color: 0xeaffd0 })); nuc.position.copy(pod.position); g.add(nuc);
    const gl = glow(col[1], r * 4.2); gl.position.copy(pod.position); gl.material.opacity = .5; g.add(gl);
    // base stalk
    const st = new THREE.Mesh(new THREE.CylinderGeometry(r * .35, r * .6, r * 1.6, 8), M(0x3a1410, { roughness: .35 })); st.position.copy(pod.position).y -= r * .9; g.add(st);
  }
  if (light) g.add(new THREE.PointLight(col[1], .5, 1.1, 2));
  return g;
}
export function tendril(from, to, sag = .06, thick = .004, seed = 1, color = 0x4a0f12) {
  const R = rng(seed), a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), mid = a.clone().lerp(b, .5); mid.y -= sag; mid.x += (R() - .5) * sag; mid.z += (R() - .5) * sag;
  const cv = new THREE.CatmullRomCurve3([a, a.clone().lerp(mid, .6), mid, mid.clone().lerp(b, .6), b]);
  const m = new THREE.Mesh(new THREE.TubeGeometry(cv, 24, thick, 7, false), MP(color, { roughness: .25, clearcoat: 1, clearcoatRoughness: .2 })); m.castShadow = true; return m;
}
// broken bone spike (compound fracture)
export function boneSpike(len = .11, seed = 1) {
  const R = rng(seed), g = new THREE.Group(), pts = [];
  for (let i = 0; i <= 8; i++) { const v = i / 8; pts.push(new THREE.Vector2(.011 * (1 - v * .72) + (R() - .5) * .0022 + .003 * Math.sin(v * 7), v * len)) }
  pts.push(new THREE.Vector2(.0, len * 1.03));
  const geo = new THREE.LatheGeometry(pts, 14), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > len * .8) p.setX(i, p.getX(i) * (.7 + R() * .6)) } geo.computeVertexNormals();
  const bone = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xd8c9a2, roughness: .62 })); bone.castShadow = true; g.add(bone);
  const base = new THREE.Mesh(new THREE.TorusGeometry(.013, .0065, 8, 18), MP(0x5a0a0c, { roughness: .2, clearcoat: 1 })); base.rotation.x = Math.PI / 2; base.position.y = .003; g.add(base);
  const blood = new THREE.Mesh(new THREE.CylinderGeometry(.0125, .0135, .028, 14, 1, true), MP(0x4a0608, { roughness: .2, clearcoat: 1, side: 2 })); blood.position.y = .02; g.add(blood);
  return g;
}
// bandage wrap (torus-like cloth band) around a limb along its local +y
export function bandage(r = .04, len = .09, seed = 1, color = '#cfc6ae') {
  const R = rng(seed), [c, x] = cvs(256, 128); x.fillStyle = color; x.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(${R() < .5 ? 0 : 255},${R() < .5 ? 0 : 255},${R() < .5 ? 0 : 255},${.02 + R() * .07})`; x.fillRect(R() * 256, R() * 128, 1 + R() * 2, 1 + R() * 2) }
  for (let i = 0; i < 7; i++) { const px = R() * 256, py = R() * 128, rr = 12 + R() * 35, gr = x.createRadialGradient(px, py, 0, px, py, rr); gr.addColorStop(0, 'rgba(88,12,10,.85)'); gr.addColorStop(1, 'rgba(88,12,10,0)'); x.fillStyle = gr; x.fillRect(px - rr, py - rr, rr * 2, rr * 2) }
  x.fillStyle = 'rgba(60,40,20,.3)'; for (let i = 0; i < 10; i++) x.fillRect(R() * 256, R() * 128, 30 + R() * 50, 1);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const geo = new THREE.CylinderGeometry(r * 1.02, r, len, 28, 6, true), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), y = p.getY(i); const k = 1 + Math.sin(y * 90 + a * 2) * .035 + (R() - .5) * .01; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k) }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, roughness: .95, side: THREE.DoubleSide })); m.castShadow = true;
  const g = new THREE.Group(); g.add(m);
  // loose trailing end
  const tail = clothStrip(r * .55, len * 1.8, color, seed + 9, .8); tail.position.set(r * .9, -len * .2, 0); g.add(tail); return g;
}
// zombie stagger pose (character frame: x right-ish, y up, z forward)
export function zombiePose(c, t, p) {
  const s = Math.sin, ph = p.ph || 0;
  rotBone(c, 'Hips', [0, 0, 1], s(t * 1.1 + ph) * .05 * (p.sway ?? 1));
  rotBone(c, 'Spine', [1, 0, 0], p.lean * .36); rotBone(c, 'Spine1', [1, 0, 0], p.lean * .36); rotBone(c, 'Spine2', [1, 0, 0], p.lean * .28);
  rotBone(c, 'Neck', [1, 0, 0], p.head * .5 + s(t * 1.7 + ph) * .03); rotBone(c, 'Head', [1, 0, 0], p.head * .5);
  rotBone(c, 'Head', [0, 0, 1], p.roll + s(t * 2.3 + ph) * .04); rotBone(c, 'Head', [0, 1, 0], p.yaw + s(t * .7 + ph) * .1);
  rotBone(c, 'LeftArm', [1, 0, 0], -p.reachL); rotBone(c, 'RightArm', [1, 0, 0], -p.reachR);
  rotBone(c, 'LeftForeArm', [1, 0, 0], -p.bendL); rotBone(c, 'RightForeArm', [1, 0, 0], -p.bendR);
  rotBone(c, 'LeftHand', [0, 0, 1], s(t * 15 + ph) * .1); rotBone(c, 'RightHand', [0, 0, 1], s(t * 13 + ph) * .1);
}
