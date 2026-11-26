# Roadmap

Target: a third-person browser game (phones and desktops) set in and around the University of Ghana, Legon, with survivors, the infected ("the Carried") and everyday NPCs.
Story: [STORY.md](STORY.md). Realism plan (what "photoreal" can mean in a browser, and what we need from you): [REALISM.md](REALISM.md).
Order matters: each milestone is playable or visible on its own.

## Honest quality ceiling

- Browser + phone GPUs mean "photoreal" is achieved with **good source assets plus shaders**, not with raw geometry counts.
  Real OpenStreetMap footprints give real layouts; they do not give detailed buildings. Detail comes from procedural architecture rules and texture sets.
- Unreal-class fidelity is not a realistic target in a browser. Convincing, dense, atmospheric, and a believable Ghana is.

## M1: Character lab (done)
Five collections (the fifth, Weapons, holds the gun models), bio shader, scanned head, gear, retargeted animation, quality tiers, CI, Pages deploy.

**Humans collection is still scanned-head busts on pedestals, not full bodies.** Putting the scanned head on a rigged, dressed body is the next character task, and it comes before NPCs because NPCs reuse it.

Known rough spots: the eyes on the scanned-head busts protrude and have no eyelids, the Walker's visor is a flat green shape, Vanguard visor reads flat, Aegis cape reads as a flat panel, Survivor grime/wounds are subtle, cracks look like a regular Voronoi pattern, portrait/mobile layout is not checked.

## M2: Playable character in a test street (first version done)
Done: press **Play** (or `?play=1`). Third-person hero (Rapier kinematic controller: capsule, steps up to 36 cm, slopes, gravity, jump), idle/walk/run blended by real speed,
follow camera with wall collision and zoom, keyboard + mouse (drag or pointer-lock) + touch (stick, look-drag, jump, run), and a walled test street at golden hour with
an asphalt road, drains, shops with signs, kiosks, a chop bar, a container shop, an unfinished concrete frame, compound houses, poles with wires and foliage trees.
Everything solid has a collider; `tests/play.cjs` checks walking, running, jumping, wall collision and the return to the lab.
**Shooting prototype (done):** over-the-shoulder aim, pistol / assault rifle / Dane gun, spread, recoil, magazines and reloads, hit-scan through Rapier, tracers, muzzle flash, impact effects, decals,
hit markers, noise events, procedural gun audio, detailed animated gun models (shared with the Weapons lab page; arms use IK and the fingers curl round the grips), and a firing range (steel plates, physics drums / crates / cans, mannequins with headshots). `tests/shoot.cjs` covers it. Design: [COMBAT.md](COMBAT.md).
Still to do: crouch, gamepad, interaction prompts (doors, shops), day/night cycle, footsteps/ambient audio, vehicles, interiors, recorded gun sound, shell ejection, strafe animations.

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

**First area: University of Ghana, Legon and its surroundings** (Madina, Okponglo, Haatso, East Legon), chosen by the project owner, who knows it well. Run `npm run osm` (or the "Fetch OSM" Action, template in `docs/workflows/fetch-osm.yml`) to download the data into `data/osm/legon.json`.
Start with one small area (a few hundred metres, around the Night Market and library) as a vertical slice, then widen to the whole campus, then the surroundings, then more of Accra.
Design the data format so it scales to the wider country, but do not build all of it up front.

## M5: Gameplay
Combat beyond the range ([COMBAT.md](COMBAT.md)): enemies that hear noise and shoot back, melee and stealth takedowns, cover, Adinkra powers, ragdolls. The Carried are rescued, not killed; guns are for handlers and ledger-men.
Missions, interiors (hand-built or templated rooms), vehicles, hiding places, interactions, dynamic events (zombie surges, power cuts), day/night and weather, audio (Howler), save games.

## M6: Quality and scale
- Better character sources (licensed or commissioned), replacing the Mixamo-derived rigs.
- Texture baking via Blender (`bpy`, headless) if assets must also go to another engine.
- Mesh and texture compression (meshopt, KTX2), loading screens, performance budgets on mid-range phones.
- Decide the three.js upgrade path from 0.160.

## Decided
- Story: *Sankofa Line* (docs/STORY.md). Rescue over killing: you bring the infected back by finding and saying their names. Powers come from Adinkra symbols. No real company is named; the scam in the story follows the documented pattern of fake overseas-job offers.
- First area: University of Ghana, Legon and surroundings, plus imagined additions (a sealed colonial rail spur, a night train, an abandoned suspended tram).

## Needs your input
- Correct the landmark list in docs/STORY.md and say where campus feels most alive to you.
- Reference photos of campus corners, and any recordings of campus sounds (see docs/REALISM.md).
- Hero: Kwesi, a woman, or a choice at the start?
- Whether you can scan volunteers' faces (with written consent) for the main cast.
- Public or private repo (see `docs/ASSETS.md`).
