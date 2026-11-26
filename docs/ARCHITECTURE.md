# Architecture

## Stack

| Piece | Choice | Why |
| --- | --- | --- |
| Renderer | three.js **0.160.0** (pinned) | Runs on phones and desktops with no install. The shaders patch three's built-in shader text and use the r160 `GTAOPass` API, so upgrade deliberately, not by accident. |
| Build | Vite 7 | Fast dev server, ES modules, one-command production build. |
| Physics | Rapier 0.21 (WASM, pinned) | Character controller today; ragdolls and vehicles next. |
| Pathfinding (planned) | recast-navigation (WASM) | Navmesh generation and crowd agents for NPCs and zombies. |
| Hosting | GitHub Pages (or any static host) | The game is static files. |
| Asset tooling | gltf-transform, meshoptimizer, sharp; Blender via `bpy` (planned) | Compress models, bake textures, export. |

## Rendering quality tiers

`low` direct render, `med` MSAA 2x + bloom + colour grade (pixel ratio ≤ 1.5, default on touch devices),
`high` MSAA 4x + ambient occlusion (GTAO) + bloom + grade (pixel ratio ≤ 2).
Switch with the Quality button or `?q=`.

## The bio shader (`src/shaders/bio.js`)

`injectBio(material, opts)` patches a `MeshStandardMaterial` / `MeshPhysicalMaterial` through `onBeforeCompile`:

- A rest-pose position varying (`vRest`, in metres) feeds 3D noise, so detail **sticks to the body while it animates** instead of swimming.
- Detail is a procedural height field turned into bump via screen-space derivatives.
- Layers, each switchable per material: human skin (pores, richness), zombie rot (pallor, bruises, glowing veins, cracks),
  grime, armour wear and chipped paint, two-tone hero recolour, energy circuitry, wounds (up to 8, with flesh/bone and blood run-off),
  blood spatter, wrapped red-shifted subsurface scattering, and an eye-hole discard for the scanned head.
- Scanned head: albedo, normal and specular maps come from the CC-BY head scan; a skin mask classified from the albedo at load time keeps the shader off eyes, lips and hair.

Everything procedural lives in shaders and JS. Nothing is baked into the GLB files, so another engine would need a texture-baking step (see ROADMAP).

## Characters

- Rigs share Mixamo bone names, so animation clips retarget between them with delta quaternions against each rig's bind pose (`gear/common.js: retargetClip`).
- `factory.js: makeBody` loads a rig, applies the bio shader, binds gear, and returns a controllable character.
- Gear (armour plates, bandages, spores, cape, blade) attaches to bones with `attachAt(character, bone, object, worldPointRelativeToRoot)`; offsets are in the character's root space, in metres, in the bind pose.
- Zombie posture is layered over animation after `mixer.update` with `rotBone` (rotation about a world axis re-expressed in the parent bone's space).

## Play mode (`src/game/`)

- Lazy-loaded from `main.js` (`import('./game/game.js')`), so the lab does not download Rapier's WASM until Play is pressed.
- `physics.js`: Rapier world, one fixed body carrying every static collider, fixed 60 Hz stepping with an interpolation alpha for rendering.
- `world.js`: builds the street. Geometry is collected per material and merged (a few dozen draw calls); every solid piece also adds a collider. World-metre UVs so procedural textures tile evenly on any size.
- `player.js`: kinematic character controller (capsule 0.3 m radius, 1.8 m tall), steps, slopes, jump; animation state follows ground speed, clip playback speed follows ground speed (less foot-sliding).
- `camera.js`: yaw/pitch orbit with a Rapier ray so the camera stops in front of walls. `input.js`: keyboard, mouse (drag or pointer lock), touch stick/look/jump/run.
- `game.js` takes over the shared stage (`STAGES.game`, sky, sun sprite, shadow frustum following the player) and puts everything back on exit.
- `weapons.js`: weapon data (`WEAPONS`), hit-scan from the crosshair (`castRayAndGetNormal`, random cone from spread) against the Rapier world, recoil, magazines, effect pools (tracers, sparks, dust, decals), HUD, and the arm pose: two-bone IK after `mixer.update` plus a world-space gun. Shots push noise events into `weapons.noises` for future enemies.
- `range.js`: firing range. Every shootable collider is registered in `tags` (collider handle → `{ kind, hit(info) }`), so the weapon code needs no knowledge of what it hit. Drums / crates / cans are dynamic Rapier bodies (impulse capped by mass); mannequins are static colliders that are disabled while down. Timers run in the fixed tick (`range.tick(h)`), mesh sync per frame (`range.update()`).
- `audio.js`: procedural Web Audio (shots with an echo, clicks, impacts); starts on the first key press or click.
- Fixed tick order: `weapons.step → range.tick → player.step → world.step`; per frame: `weapons.update → range.update → player.render → cam.update`.

## Weapons (`src/weapons/`)

- `models.js`: `buildPistol / buildRifle / buildDane`, each returning `{ group, muzzle, parts, rest, pose({ fire, reload, empty }) }`. Parts are bevelled side-profile extrusions (`slab`, with rounded corners, holes and creased normals), lathes, rods and rounded boxes. Metres, +z forward, origin at the middle of the grip. `pose` moves the working parts: slide (locks back when empty), bolt carrier, magazine out and in, hammer (falls on firing, stays down while reloading). 8 to 11k triangles per gun.
- `materials.js`: `steel()` patches a physical material so that edges (found from how fast the normal turns per metre of surface) wear through to bare metal, with patchy wear, grime and micro-grain roughness; `polymer()` (stipple bump), `wood()` (canvas grain), `brass()`, `cloth()`. No image files.
- `lab.js`: the Weapons collection (display table, cradles, cartridges, views, Fire / Slow-mo / Reload animations). Test hook: `__cols.weapons.inst.setHold({ pistol: { fire: .2 } })` freezes a pose.
- Play mode uses the same models. `weapons.js` poses the arms with two-bone IK to the grip (wrist pulled back so the palm lands on it), curls the fingers (about local z, same sign on both hands), and calls `pose()` from the shot timer and the reload progress.
- The stage `weapons` uses a `bench` environment (overhead softbox and long strip lights) so the metal has something to reflect.

## Debug hooks (used by the tests)

`window.__game` (while playing: `player`, `cam`, `input`, `P`, `level`, `range`, `weapons`, `audio`, `simulate(sec)` to step physics without rendering), `__enterPlay()`, `__playing`.

`window.__col(id, view)`, `__view(name)`, `__setAnim(name)`, `__q(tier)`, `__stop()`, `__cols`, `__ready`, `__frames`.
