/**
 * main.js
 * Entry point: collections registry, UI, camera, main loop.
 */
import * as THREE from 'three';
import { $, URLQ, renderer, QL, scene, camera, controls, ring, setStage, composer, setQuality, P } from './core/engine.js';
import { BIO_T } from './shaders/bio.js';
import { buildOni } from './characters/oni.js';
import { buildHumans } from './characters/humans.js';
import { buildUndead } from './characters/undead.js';
import { buildHeroes } from './characters/heroes.js';
import { buildWeapons } from './weapons/lab.js';
import './style.css';

// =====================================================================================
//  Collections registry, UI, camera, main loop
// =====================================================================================
export const COLS = {
  oni: { label: 'Oni Night', stage: 'oni', build: buildOni, credit: '' },
  undead: { label: 'Undead', stage: 'undead', build: buildUndead, credit: 'Head scan: Infinite / Lee Perry-Smith (CC-BY 3.0, triplegangers.com)' },
  heroes: { label: 'Heroes', stage: 'heroes', build: buildHeroes, credit: '' },
  weapons: { label: 'Weapons', stage: 'weapons', build: buildWeapons, credit: '' },
  humans: { label: 'Humans', stage: 'humans', build: buildHumans, credit: 'Head scan: Infinite / Lee Perry-Smith (CC-BY 3.0, triplegangers.com)' },
};
export let cur = null, curView = 'lineup', tween = null, animSel = 'Idle';
export const flat = v => new THREE.Vector3(...v);
export function setView(n, instant) {
  const C = COLS[cur], v = C.inst.views[n]; if (!v) return; curView = n;
  const tp = flat(v.p), tt = flat(v.t);
  if (instant) { camera.position.copy(tp); controls.target.copy(tt); controls.update(); tween = null } else tween = { p: tp, t: tt };
  document.querySelector('#name b').textContent = v.n[0]; document.querySelector('#name span').textContent = v.n[1];
  document.querySelectorAll('#views button').forEach(b => b.classList.toggle('on', b.dataset.v === n));
}
export function setAnim(w) {
  animSel = w; const C = COLS[cur]; C.inst.setAnim(w);
  document.querySelectorAll('#anims button').forEach(b => b.classList.toggle('on', b.dataset.a === w));
}
export const busy = m => { const l = $('load') || (() => { const d = document.createElement('div'); d.id = 'load'; d.innerHTML = '<span></span><small id="loadmsg"></small>'; document.body.appendChild(d); return d })(); l.style.opacity = 1; l.firstChild.textContent = m; return l };
export async function selectCollection(id, view = 'lineup') {
  const C = COLS[id]; if (!C) return;
  if (!C.inst) { const l = busy('Loading ' + C.label + '…'); try { C.inst = await C.build(); C.inst.group.visible = false; scene.add(C.inst.group) } catch (e) { console.error('BUILD FAIL', e); l.firstChild.textContent = 'Failed: ' + e.message; return } }
  for (const [k, o] of Object.entries(COLS)) if (o.inst) o.inst.group.visible = k === id;
  cur = id; setStage(C.stage); ring.visible = id === 'oni' || id === 'undead';
  document.querySelectorAll('#cols button').forEach(b => b.classList.toggle('on', b.dataset.c === id));
  const vb = $('views'); vb.innerHTML = '';
  for (const n of C.inst.buttons) { const b = document.createElement('button'); b.textContent = (C.inst.labels && C.inst.labels[n]) || n[0].toUpperCase() + n.slice(1); b.dataset.v = n; b.onclick = () => setView(n); vb.appendChild(b) }
  const ab = $('anims'); ab.innerHTML = '';
  for (const n of C.inst.anims) { const b = document.createElement('button'); b.textContent = n; b.dataset.a = n; b.onclick = () => setAnim(n); ab.appendChild(b) }
  if (C.inst.anims.length) setAnim(C.inst.anims.includes(animSel) ? animSel : C.inst.anims[0]);
  $('credit').textContent = C.credit; setView(view, true);
  const l = $('load'); if (l) { l.style.opacity = 0; setTimeout(() => l.remove(), 380) }
  window.__ready = id;
}
for (const [id, C] of Object.entries(COLS)) { const b = document.createElement('button'); b.textContent = C.label; b.dataset.c = id; b.onclick = () => selectCollection(id); $('cols').appendChild(b) }
const playBtn = document.createElement('button'); playBtn.textContent = '▶ Play'; playBtn.className = 'play'; playBtn.onclick = () => enterPlay(); $('cols').appendChild(playBtn);
$('q').onclick = () => setQuality({ low: 'med', med: 'high', high: 'low' }[QL]);
Object.assign(window, { __view: n => setView(n, true), __col: (id, v) => selectCollection(id, v), __stop: () => { controls.autoRotate = false }, __setAnim: setAnim, __q: setQuality, __cols: COLS });

// ---- play mode (lazy: Rapier + the street are only fetched when Play is pressed) ----
export let game = null; let playing = false;
export async function enterPlay() {
  if (playing) return; playing = true;
  const l = busy('Loading game…');
  try {
    const { createGame } = await import('./game/game.js');
    for (const o of Object.values(COLS)) if (o.inst) o.inst.group.visible = false;
    game = await createGame({ onExit: exitPlay, say: m => { const e = $('loadmsg'); if (e) e.textContent = m } });
  } catch (e) {
    console.error('GAME FAIL', e); l.firstChild.textContent = 'Failed: ' + e.message; game = null; playing = false;
    await new Promise(r => setTimeout(r, 1800)); await selectCollection(cur, curView); return;
  }
  document.body.classList.add('playing');
  document.querySelector('#name b').textContent = 'Test street'; document.querySelector('#name span').textContent = 'Placeholder yard · real Ghana streets come next';
  window.__game = game; window.__playing = true;
  const ld = $('load'); if (ld) { ld.style.opacity = 0; setTimeout(() => ld.remove(), 380) }
}
export async function exitPlay() {
  if (!game) return; game.dispose(); game = null; playing = false; window.__game = null; window.__playing = false;
  document.body.classList.remove('playing'); await selectCollection(cur, curView);
}
window.__enterPlay = enterPlay;

setQuality(QL);
await selectCollection(URLQ.get('c') in COLS ? URLQ.get('c') : 'oni', URLQ.get('v') || 'lineup');

if (URLQ.get('play')) await enterPlay();

export const clock = new THREE.Clock(); let fcount = 0;
(function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime; BIO_T.value = t;
  if (game) game.update(dt, t);
  else {
    const C = COLS[cur]; if (C && C.inst) C.inst.update(dt, t);
    if (tween) { camera.position.lerp(tween.p, .08); controls.target.lerp(tween.t, .08); if (camera.position.distanceTo(tween.p) < .01) tween = null }
    controls.update();
  }
  if (composer) { P.grade.uniforms.uTime.value = t; P.grade.uniforms.uRes.value.set(innerWidth, innerHeight); composer.render(dt) } else renderer.render(scene, camera);
  window.__frames = ++fcount;
})();
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); if (composer) composer.setSize(innerWidth, innerHeight) });
