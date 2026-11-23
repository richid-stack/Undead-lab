/**
 * physics.js
 * Rapier (WASM) world + a fixed-timestep driver. One static body carries every level collider.
 */
import RAPIER from '@dimforge/rapier3d-compat';

let ready = null;
export const initRapier = () => (ready ||= RAPIER.init().then(() => RAPIER));

export const STEP = 1 / 60;

export async function createPhysics() {
  await initRapier();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = STEP;
  const statics = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const P = {
    RAPIER, world, statics, acc: 0,
    /** axis-aligned (or Y-rotated) static box. centre + half extents, metres */
    box(x, y, z, hx, hy, hz, ry = 0) {
      const d = RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z);
      if (ry) d.setRotation({ x: 0, y: Math.sin(ry / 2), z: 0, w: Math.cos(ry / 2) });
      return world.createCollider(d, statics);
    },
    cylinder(x, y, z, hh, r) { return world.createCollider(RAPIER.ColliderDesc.cylinder(hh, r).setTranslation(x, y, z), statics) },
    /** run `fn(STEP)` once per fixed tick, then step the world; returns interpolation alpha for rendering */
    advance(dt, fn) {
      P.acc = Math.min(P.acc + dt, STEP * 5);
      while (P.acc >= STEP) { fn(STEP); world.step(); P.acc -= STEP }
      return P.acc / STEP;
    },
    dispose() { world.free() },
  };
  return P;
}
