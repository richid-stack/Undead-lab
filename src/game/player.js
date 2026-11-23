/**
 * player.js
 * The playable hero: Rapier kinematic character controller (capsule, steps, slopes, gravity, jump) driving the
 * armoured Soldier rig, with idle/walk/run crossfades whose playback speed follows the real ground speed.
 */
import * as THREE from 'three';
import { clamp } from '../core/engine.js';
import { makeBody, play } from '../characters/factory.js';
import { bioBody, attachAt } from '../characters/gear/common.js';
import { capeMesh, energyCore } from '../characters/heroes.js';

export const WALK = 1.9, RUN = 5.0, JUMP_V = 5.6, GRAV = 17;
const HALF = .6, RAD = .3, FOOT = HALF + RAD;              // capsule centre sits 0.9 m above the soles
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export async function createPlayer(P, spawn, heading = Math.PI / 2) {
  const { RAPIER, world } = P;
  const body = await makeBody('d_soldier', { height: 1.8, turn: Math.PI });
  bioBody(body, {
    bio: { rec: .92, recA: [.98, .8, .42], recB: [.05, .07, .11], circ: 1.1, glowCol: 0x59c7ff, wear: .85, grime: .12, blood: 0, seed: 12, pores: 0, bump: 1, skin: 0 },
    perMat: (m, n) => /visor/i.test(n) ? { rec: 0, circ: 0, wear: 0, grime: 0 } : {},
    wounds: [],
  });
  body.meshes.forEach(m => [].concat(m.material).forEach(mm => {
    if (/visor/i.test(mm.name)) { mm.emissive = new THREE.Color(0x2fa8e8); mm.emissiveIntensity = .22; mm.roughness = .08; mm.metalness = .2; mm.color.set(0x050b14) } else { mm.metalness = .8; mm.roughness = .34 }
  }));
  attachAt(body, 'Spine2', energyCore(.03), [0, 1.42, .16]);
  attachAt(body, 'Spine2', capeMesh(.52, 1.0, '#1b4fa0', '#d9a93a', 4), [0, 1.62, -.19]);

  const rb = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y + FOOT + .02, spawn.z));
  const col = world.createCollider(RAPIER.ColliderDesc.capsule(HALF, RAD), rb);
  const ctrl = world.createCharacterController(.02);
  ctrl.setUp({ x: 0, y: 1, z: 0 }); ctrl.setSlideEnabled(true); ctrl.enableAutostep(.36, .2, false); ctrl.enableSnapToGround(.3);
  ctrl.setMaxSlopeClimbAngle(48 * Math.PI / 180); ctrl.setMinSlopeSlideAngle(55 * Math.PI / 180);

  const pl = {
    body, rb, col, ctrl,
    pos: new THREE.Vector3(spawn.x, spawn.y + FOOT + .02, spawn.z), prev: new THREE.Vector3(), vel: new THREE.Vector3(), vy: 0,
    heading, grounded: false, speed: 0, state: 'Idle', moveDir: new THREE.Vector3(),
    /** feet position (for gameplay), centre = pos */
    get feet() { return new THREE.Vector3(this.pos.x, this.pos.y - FOOT, this.pos.z) },
    teleport(x, y, z) { this.pos.set(x, y + FOOT + .02, z); this.prev.copy(this.pos); this.vel.set(0, 0, 0); this.vy = 0; rb.setTranslation({ x, y: y + FOOT + .02, z }, true); rb.setNextKinematicTranslation({ x, y: y + FOOT + .02, z }) },
    /** one fixed tick. input = Input; camYaw = heading the camera looks along */
    step(h, input, camYaw) {
      this.prev.copy(this.pos);
      const m = input.move(), cf = Math.sin(camYaw), cg = Math.cos(camYaw);
      const wx = cf * m.z - cg * m.x, wz = cg * m.z + cf * m.x;                  // world move direction (forward = (sin,cos), right = (-cos,sin))
      const sp = m.mag * (m.run ? RUN : WALK) * (m.mag < 1 && !m.run ? Math.max(.5, m.mag) : 1);
      const k = 1 - Math.exp(-h * (sp > this.speed ? 9 : 14));
      this.vel.x += (wx * sp - this.vel.x) * k; this.vel.z += (wz * sp - this.vel.z) * k;
      this.speed = Math.hypot(this.vel.x, this.vel.z);
      if (this.speed > .25) { this.heading += angDiff(this.heading, Math.atan2(this.vel.x, this.vel.z)) * (1 - Math.exp(-h * 12)) }
      if (this.grounded && this.vy <= 0) { this.vy = 0; if (input.takeJump()) { this.vy = JUMP_V; this.grounded = false } } else input.takeJump();
      this.vy -= GRAV * h; if (this.vy < -30) this.vy = -30;
      if (this.vy > 0) ctrl.disableSnapToGround(); else ctrl.enableSnapToGround(.3);
      ctrl.computeColliderMovement(col, { x: this.vel.x * h, y: this.vy * h, z: this.vel.z * h });
      const mv = ctrl.computedMovement(); this.grounded = ctrl.computedGrounded();
      if (this.grounded && this.vy < 0) this.vy = 0;
      if (this.vy > 0 && mv.y < this.vy * h * .5) this.vy = 0;                       // bumped our head
      this.pos.x += mv.x; this.pos.y += mv.y; this.pos.z += mv.z;
      rb.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y, z: this.pos.z });
    },
    /** per rendered frame: interpolate between ticks and drive the rig */
    render(alpha, dt) {
      const x = this.prev.x + (this.pos.x - this.prev.x) * alpha, y = this.prev.y + (this.pos.y - this.prev.y) * alpha, z = this.prev.z + (this.pos.z - this.prev.z) * alpha;
      this.view = this.view || new THREE.Vector3(); this.view.set(x, y, z);
      body.root.position.set(x, y - FOOT, z); body.root.rotation.y = this.heading;
      const want = this.speed < .35 ? 'Idle' : this.speed < (WALK + RUN) / 2 + .2 ? 'Walk' : 'Run';
      if (want !== this.state) { this.state = want; play(body, want) }
      const a = body.acts[this.state]; if (a) a.timeScale = this.state === 'Idle' ? 1 : clamp(this.speed / (this.state === 'Walk' ? 1.5 : 4.1), .6, 1.5);
      body.mixer.update(dt);
    },
    dispose() { body.root.removeFromParent(); body.mixer.stopAllAction() },
  };
  pl.prev.copy(pl.pos); pl.view = pl.pos.clone();
  play(body, 'Idle'); body.root.position.set(spawn.x, spawn.y, spawn.z); body.root.rotation.y = heading;
  return pl;
}
