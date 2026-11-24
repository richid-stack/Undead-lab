/**
 * game.js
 * Play mode: owns the physics world, level, player, camera and HUD. main.js lazy-loads this file, so the character
 * lab does not pay for Rapier until someone presses Play.
 */
import * as THREE from 'three';
import { scene, camera, controls, floor, ring, key, rim, fill, renderer, setStage, glow, COARSE } from '../core/engine.js';
import { createPhysics, STEP } from './physics.js';
import { buildStreet } from './world.js';
import { createPlayer } from './player.js';
import { FollowCam } from './camera.js';
import { Input } from './input.js';
import { sky } from './textures.js';
import { buildRange } from './range.js';
import { createWeapons } from './weapons.js';
import { createAudio } from './audio.js';

export async function createGame({ onExit, say = () => {} }) {
  say('Starting physics…');
  const P = await createPhysics();
  say('Building the street…');
  const level = buildStreet(P);
  say('Loading the hero…');
  const player = await createPlayer(P, level.spawn, level.heading);

  // ---- take over the shared stage (and remember what to put back) ----
  const saved = { far: camera.far, near: camera.near, fov: camera.fov };
  const sc = key.shadow.camera, savedBox = { l: sc.left, r: sc.right, t: sc.top, b: sc.bottom, n: sc.near, f: sc.far };
  setStage('game');
  scene.background = sky(); floor.visible = false; ring.visible = false; controls.enabled = false;
  camera.near = .1; camera.far = 400; camera.fov = 52; camera.updateProjectionMatrix();
  Object.assign(sc, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 }); sc.updateProjectionMatrix();
  key.shadow.bias = -.0004; key.shadow.normalBias = .035; scene.add(key.target);
  const sunDir = new THREE.Vector3(18, 15, -22).normalize(), sunOff = new THREE.Vector3(18, 15, -22).multiplyScalar(1.6);
  const sun = glow(0xffd29a, 70), sunCore = glow(0xfff0d0, 22); sun.material.opacity = .85;
  const range = buildRange(P);
  scene.add(level.group, range.group, player.body.root, sun, sunCore);

  const hud = document.createElement('div'); hud.id = 'hud';
  hud.innerHTML = `<button id="back">← Lab</button><div id="hint">${COARSE ? 'Left thumb: move · Right thumb: look' : 'WASD move · Shift run · Space jump · Mouse look (click to capture) · Right-click / Q aim · Click / F fire · R reload · 1 2 3 weapons · Range button: firing range'}</div>`;
  document.body.appendChild(hud);
  hud.querySelector('#back').onclick = () => onExit();
  const input = new Input(renderer.domElement, hud, { touch: COARSE || navigator.maxTouchPoints > 0 });
  if (input.touch) document.body.classList.add('touch');
  const cam = new FollowCam(camera, P, level.heading);
  const audio = createAudio(), weapons = createWeapons({ P, scene, camera, cam, player, hud, range, audio, input });
  const wake = () => audio.resume(); addEventListener('pointerdown', wake); addEventListener('keydown', wake);

  const g = {
    P, level, player, cam, input, hud, range, weapons, audio,
    update(dt) {
      const l = input.takeLook(); if (l.x || l.y) cam.look(l.x, l.y);
      const z = input.takeZoom(); if (z) cam.zoom(z);
      const alpha = P.advance(dt, h => { weapons.step(h); range.tick(h); player.step(h, input, cam.yaw) });
      // keep the player inside the walls (belt and braces: the colliders already do this)
      const b = level.bounds; player.pos.x = THREE.MathUtils.clamp(player.pos.x, b.x0, b.x1); player.pos.z = THREE.MathUtils.clamp(player.pos.z, b.z0, b.z1);
      weapons.update(dt); range.update();
      player.render(alpha, dt);
      cam.update(dt, player.view, player.col);
      const p = player.view;
      key.target.position.set(p.x, 0, p.z); key.position.set(p.x + sunOff.x, sunOff.y, p.z + sunOff.z); key.target.updateMatrixWorld(); sc.updateMatrixWorld();
      sun.position.copy(camera.position).addScaledVector(sunDir, 300); sunCore.position.copy(sun.position);
    },
    /** advance the simulation by `sec` seconds without rendering (used by the tests; frame-rate independent) */
    simulate(sec) {
      for (let i = 0, n = Math.round(sec / STEP); i < n; i++) { weapons.step(STEP); range.tick(STEP); player.step(STEP, input, cam.yaw); P.world.step(); cam.update(STEP, player.pos, player.col) }
      weapons.update(0); range.update(); player.render(1, 0);
    },
    dispose() {
      removeEventListener('pointerdown', wake); removeEventListener('keydown', wake); weapons.dispose(); audio.dispose(); range.dispose(); scene.remove(range.group);
      document.body.classList.remove('touch'); input.dispose(); hud.remove(); player.dispose(); scene.remove(level.group, player.body.root, sun, sunCore, key.target);
      level.group.traverse(o => { if (o.isMesh) { o.geometry.dispose() } });
      P.dispose();
      Object.assign(sc, { left: savedBox.l, right: savedBox.r, top: savedBox.t, bottom: savedBox.b, near: savedBox.n, far: savedBox.f }); sc.updateProjectionMatrix();
      key.target.position.set(0, 0, 0); key.shadow.bias = -.0005; key.shadow.normalBias = .02;
      camera.near = saved.near; camera.far = saved.far; camera.fov = saved.fov; camera.updateProjectionMatrix();
      floor.visible = true; controls.enabled = true;
    },
  };
  return g;
}
