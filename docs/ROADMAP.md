# Roadmap

Target: a browser game (phones and desktops), third-person, set in a real-layout Ghanaian neighbourhood, with survivors, zombies and everyday NPCs.
Order matters: each milestone is playable or visible on its own.

## Honest quality ceiling

- Browser + phone GPUs mean "photoreal" is achieved with **good source assets plus shaders**, not with raw geometry counts.
  Real OpenStreetMap footprints give real layouts; they do not give detailed buildings. Detail comes from procedural architecture rules and texture sets.
- Unreal-class fidelity is not a realistic target in a browser. Convincing, dense, atmospheric, and a believable Ghana is.

## M1: Character lab (done)
Four collections, bio shader, scanned head, gear, retargeted animation, quality tiers, CI, Pages deploy.

**Humans collection is still scanned-head busts on pedestals, not full bodies.** Putting the scanned head on a rigged, dressed body is the next character task, and it comes before NPCs because NPCs reuse it.

Known rough spots: the eyes on the scanned-head busts protrude and have no eyelids, the Walker's visor is a flat green shape, Vanguard visor reads flat, Aegis cape reads as a flat panel, Survivor grime/wounds are subtle, cracks look like a regular Voronoi pattern, portrait/mobile layout is not checked.

## M2: Playable character in an empty street
- Third-person controller (Rapier kinematic character controller), camera collision, jump/crouch, sprint.
- Input: keyboard + mouse, gamepad, touch (virtual stick + buttons).
- A test street: flat ground, kerb, walls, a few props, day/night light.

## M3: NPCs
- **Pedestrians and survivors**: the existing rigs, re-skinned per NPC by the bio shader (skin tone, clothing colours, wear), so one skeleton gives a varied crowd.
  Add Ghana-appropriate clothing sets (wax-print cloth, school uniforms, work wear, market-trader aprons).
- **Zombies**: shamble, run, lunge, attack, ragdoll on death.
- **Movement**: recast-navigation navmesh baked from the world geometry; crowd agents avoid each other and obstacles.
- **Behaviour**: state machines (idle, wander on pavements, flee, hide, trade, chase, attack); hearing/sight perception for zombies.
- **Budget**: an NPC limit per quality tier (for example ~25 on phones, ~100 on desktop), distance LOD, and far NPCs updated at a lower rate.
- Vendors and shopkeepers as stationary NPCs with dialogue.

## M4: Real-place world from OpenStreetMap
Pipeline (all scripted, repeatable for any neighbourhood):
1. **Fetch** buildings, roads, footpaths, water/drains, landmarks, shops for a chosen area via the Overpass API.
   The AI workspace cannot reach Overpass, so this runs on your machine or in a GitHub Action, which commits the result to `data/osm/`.
2. **Build**: project lat/lon to local metres; extrude building footprints (height from `height` / `building:levels`, else a style default);
   roads as ribbons by road class; kerbs, open drains, pavements, shoulders of red laterite; terrain from a public elevation model.
3. **Dress** with Ghanaian detail by rule: compound houses with walls, gates and courtyards; corrugated-zinc and pitched roofs; shopfronts and kiosks;
   unfinished buildings with rebar and block; billboards; electricity poles and cables; street vendors and market stalls; trotros, taxis and okada.
4. **Stream** the world in ~100 m chunks with instanced props, building LODs and a baked navmesh per chunk.
5. **Attribution**: "© OpenStreetMap contributors" in-game.

Start with one small area (a few hundred metres) as a vertical slice, then widen to a district, then more of Accra.
Design the data format so it scales to the wider country, but do not build all of it up front.

## M5: Gameplay
Missions, interiors (hand-built or templated rooms), vehicles, hiding places, interactions, dynamic events (zombie surges, power cuts), day/night and weather, audio (Howler), save games.

## M6: Quality and scale
- Better character sources (licensed or commissioned), replacing the Mixamo-derived rigs.
- Texture baking via Blender (`bpy`, headless) if assets must also go to another engine.
- Mesh and texture compression (meshopt, KTX2), loading screens, performance budgets on mid-range phones.
- Decide the three.js upgrade path from 0.160.

## Needs your input
- One sentence on the game: who you play, what the goal is, tone (survival horror, action, story).
- Which part of Ghana to start with (a neighbourhood you know well works best).
- Public or private repo (see `docs/ASSETS.md`).
