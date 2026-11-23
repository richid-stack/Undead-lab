/**
 * camera.js
 * Third-person follow camera: yaw/pitch orbit around the player's shoulder, zoom, and a Rapier ray that pulls the
 * camera in front of walls instead of letting it clip through them.
 */
import * as THREE from 'three';
import { clamp } from '../core/engine.js';

const V = new THREE.Vector3();

export class FollowCam {
  constructor(camera, P, yaw = Math.PI / 2) {
    this.camera = camera; this.P = P; this.yaw = yaw; this.pitch = .22; this.want = 3.8; this.dist = 3.8;
    this.target = new THREE.Vector3(); this.dir = new THREE.Vector3(); this.ray = null;
  }
  /** forward on the ground plane for the current heading */
  forward(out = new THREE.Vector3()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)) }
  look(dx, dy) { this.yaw -= dx * .0042; this.pitch = clamp(this.pitch + dy * .0036, -.3, 1.25) }
  zoom(d) { this.want = clamp(this.want + d * .45, 1.6, 8) }
  update(dt, p, ignore) {
    const { RAPIER, world } = this.P, cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    this.target.set(p.x - fz * .45, p.y + .62, p.z + fx * .45);                 // head height, nudged to the right shoulder... (right = (-cos, 0, sin))
    this.dir.set(-fx * cp, sp, -fz * cp);                                        // from the target out to the camera
    this.ray ||= new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    Object.assign(this.ray.origin, { x: this.target.x, y: this.target.y, z: this.target.z });
    Object.assign(this.ray.dir, { x: this.dir.x, y: this.dir.y, z: this.dir.z });
    const hit = world.castRay(this.ray, this.want + .3, true, undefined, undefined, ignore);
    const free = hit ? Math.max(.55, hit.timeOfImpact - .3) : this.want;
    this.dist = free < this.dist ? free : this.dist + (free - this.dist) * (1 - Math.exp(-dt * 3));
    V.copy(this.target).addScaledVector(this.dir, this.dist);
    V.y = Math.max(V.y, .25);
    this.camera.position.copy(V); this.camera.lookAt(this.target);
  }
}
