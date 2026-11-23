# Realism plan: how far "photoreal" can go in a browser

Short answer: **much further than the current build, but not Unreal/MetaHuman level.** The current street uses procedural textures and simple props. A browser game on a good PC (and a lower tier for phones) can look
like a good PC game from a few years ago, **if** the world is built from real photographic materials, baked lighting and carefully made assets. It will not look like a film.
The biggest gains come from a few specific things, listed here by impact per effort.

## The levers (highest impact first)

| # | Lever | What changes | Cost / catch |
| --- | --- | --- | --- |
| 1 | **Real PBR materials** (photographed albedo/normal/roughness: laterite, tarmac, concrete, plaster, rust, corrugated zinc) | Replaces my drawn canvas textures; surfaces stop looking like CG | Free CC0 libraries (ambientCG, Poly Haven). The sandbox can't reach them, so a GitHub Action or your PC downloads them. |
| 2 | **Real lighting**: HDRI sky, baked ambient occlusion and light maps on static world, SSAO/GTAO, soft shadows, harmattan haze | The single biggest "photo" cue; golden-hour dust light, soft bounce, dark corners | Baking needs Blender (headless). It is not installed in the sandbox; install from the Action or on your PC. |
| 3 | **Photogrammetry of real corners** from your phone photos (Polycam / RealityScan) | Real walls, gates, kiosks and landmarks with true wear | Needs **your photos**; processed offline, simplified, compressed. This is how the campus becomes *Legon* instead of "a campus". |
| 4 | **Hand-made Ghana props** (trotro, kiosks, chop bars, poles, drains, billboards) with normal maps and decals (stickers, paint, rust, dirt) | Local detail no library has | Slow but steady; I model these procedurally/in Blender. |
| 5 | **Dense set-dressing** with instancing (litter, plants, cables, signs, cars, laundry, plastic chairs) | Scenes look lived-in | Cheap on GPU with instancing; takes content work. |
| 6 | **Detailed characters** (below) | Faces and clothes | The hardest area; see next section. |
| 7 | **Newer three.js / WebGPU** | Better post-processing and performance | A deliberate upgrade from the pinned r160 (later). |

## Characters and NPCs

- **Hero**: ~40–60k triangles, 2K textures, proper eyes with lids, hair cards, cloth with normal maps, facial rig. Realistic target: "good game quality".
- **NPCs**: three levels of detail per person: close ~15k triangles, mid ~5k, far ~1.2k, with shared texture atlases. Count limits: ~25 on phones, ~100 on desktop. "Extremely detailed" holds for the people near you.
- **A real problem to solve honestly:** the head scan we use (CC-BY, Lee Perry-Smith) is one face, and not a Ghanaian one. A Ghana-set game needs **Ghanaian faces and skin tones**. Options:
  1. **Consented phone scans** of volunteers (students, staff) with signed release forms, cleaned into game-ready heads. Best quality and authenticity.
  2. **Licensed scan packs** (check that licences allow games, and that the set is diverse).
  3. **Morphable base head** with sculpted variations and a skin shader. Lower fidelity, no legal issue, quickest start.
  Starting with option 3 and adding option 1 for the main cast is realistic.
- **Bodies**: the Mixamo-derived rigs are stand-ins. We will build or license proper dressed bodies (MakeHuman output is CC0 and is a good start).
- **Clothing**: wax-print cloth, school and campus wear, trader aprons, kente stoles for ceremonies, with real fabric normal maps.

## Performance budgets (targets, not promises)

| | Phone (mid-range) | Desktop |
| --- | --- | --- |
| Visible triangles | ~300k | ~1.5M |
| Draw calls | < 150 | < 500 |
| Textures | 1K, KTX2-compressed | 2K, KTX2-compressed |
| Download | < 60 MB first load, then streamed | < 200 MB, streamed |
| Shadows / AO | one cascade, baked AO | cascades + GTAO |

World is streamed in ~100 m chunks. Harmattan haze is both a look and a cheap way to hide the far distance.

## The Legon pipeline (what is built next)

1. `tools/fetch-osm.mjs` pulls OpenStreetMap data for the campus area (the sandbox can't reach the OSM servers, so it runs in a GitHub Action or on your PC and commits the result).
2. A builder turns footprints, roads, rails, drains, fences, power lines and landmarks into the game world, in local metres, with chunking.
3. Landmarks get **hand-dressed** with your reference photos.
4. Materials swap to real PBR sets; lighting is baked.

OpenStreetMap gives layout, not looks. A flat footprint does not know that a building has a green roof or a pink gate. That detail comes from your photos and from us.
OSM data must be credited ("© OpenStreetMap contributors", ODbL).

## What would help most from you

1. **Photo pack** (phone is fine, daylight): for each landmark, 4 wide shots (each side), 10 close-ups of materials (walls, doors, floors, signs, roofs, rust, paint), and the street in front.
   Start with: Balme Library, the Great Hall, one hall of residence, the Night Market, the bush canteen, a trotro stop, a kiosk, a footbridge or gate, a drain.
2. **Faces**: if you know volunteers willing to be scanned for a game (consent in writing), tell me; I will write the capture guide.
3. **Sounds**: 30-second phone recordings of campus at dusk, a trotro mate shouting, a generator, a market. (Ambience is half of presence.)
