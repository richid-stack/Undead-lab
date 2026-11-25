# Combat design

Short answer to "will there be real guns, real shooting and real fighting?": **yes, and it is playable now at the firing range.**
Press **▶ Play**, then the **Range** button at the top of the screen. The rules below are what the story needs (see [STORY.md](STORY.md)); what is built today is marked **[built]**.

## Principles

1. **Shooting is real.** You aim with a crosshair, bullets are cast through the physics world and hit what they hit. Spread grows when you move or fire fast, recoil kicks the camera, magazines run dry, reloads take time. No auto-aim.
2. **Guns are scarce.** This is Ghana, not an arsenal. Ammunition is a resource you have to find, and the loudest weapon in the game is a decision, not a default.
3. **The Carried are victims, not monsters.** They were recruited, not bitten (see the story). Bullets do not kill them: they stagger them and buy you seconds. What brings a Carried person home is finding and saying their name. Guns are for the people who did this to them.
4. **Noise is the cost.** Every shot makes a noise event (position, loudness). Callers and handlers react to noise. A quiet fight with a plank is slower and safer than a rifle burst. **[built: events are recorded; enemies that react arrive with M3]**
5. **No gore on the Carried.** Hits show impact and stagger, not wounds. Fighting people who need rescuing should feel wrong in the right way. Handlers and ledger-men can be harder-edged, still not gratuitous.

## Who you fight

| Who | What they are | What works against them |
| --- | --- | --- |
| **The Carried** | Recruited victims, driven by the Callers. Fast in groups, fragile. | Do not kill. Stagger, evade, hold the line (Dwennimmen), say their name to bring them home. |
| **Callers** | The ones whose voice drives a crowd. | Noise draws them. Break line of sight, silence them, or out-sing them (Akoma). |
| **Halcyon handlers** | Armed people of the fictional Halcyon Passage Group. Human, organised, shoot back. | Cover, flanking, guns, melee from behind. These are the real gunfights. |
| **Ledger-men** | Uniformed shadows of earlier eras on the sealed Hill Line, with period rifles. | Light, sound, the Stationmaster's rules; ordinary bullets stagger them. |
| **The Stationmaster** | The boss. | A set-piece, not a damage race. |

## Weapons

**[built]** placeholder models and procedural sound, real behaviour:

| Weapon | Fire | Magazine / reserve | Notes |
| --- | --- | --- | --- |
| Pistol | semi-auto, 380 rpm | 12 / 48 | accurate when aimed, loose from the hip |
| Assault rifle | full-auto, 600 rpm | 30 / 120 | big recoil climb, bloom while sustained |
| Dane gun | single shot, 9 pellets | 1 / 16 | the traditional long gun: slow reload, huge noise, wide spread, short range |

Planned finds: police post, army checkpoint, a handler's stash, a hunter's Dane gun at a village.
Planned melee and improvised: cutlass, iron pipe, plank, fire extinguisher (spray to blind or to push), thrown bottles to make noise elsewhere.
Planned powers (Adinkra): Sankofa = Echo, Akoma = Call, Dwennimmen = Hold the line, Nkyinkyim = Slip, Aya = Endure, Funtunfunefu-Denkyemfunefu = Link.

## How shooting works now

- **Hit-scan from the crosshair.** The ray starts at the hero's head-height shoulder point and follows the camera's aim direction inside a random cone. No bullet drop or travel time yet.
- **Spread** = weapon base + bloom from recent shots + movement speed × 0.22° + a hip-fire penalty. The crosshair on screen widens to match.
- **Aiming:** right-click or **Q** (hold). The camera moves over the shoulder and narrows the field of view; the hero strafes facing the crosshair and walks slower.
- **Recoil** lifts the muzzle (camera pitch) with a little sideways drift, then partly recovers after a pause.
- **Reloading:** manual (**R**) or automatic after the magazine empties; there is a progress bar and the gun dips.
- **Physics reactions:** drums, crates and cans are real rigid bodies and get an impulse capped by their mass; steel plates ring and wobble; mannequins take 2.5× on a headshot, fall back and stand up again.
- **Feedback:** tracers, muzzle flash, sparks, dust, bullet-hole decals, hit marker (red for headshots), procedural sound with an echo off the buildings.

Controls: **Q** or right-click aim · **F** or left-click fire (pointer must be captured) · **R** reload · **1 2 3** weapons. Phones: FIRE, AIM, R and ⇄ buttons.

## Honest limits of the prototype

- Gun models are small procedural placeholders, barely readable at aim distance. Proper models and recorded sounds come from downloads (see [REALISM.md](REALISM.md)).
- Hit-scan only. Strafing while aiming plays the forward walk animation (no strafe/back clips yet). The cape looks like a flat slab when not aiming.
- Mannequins are static targets. Real enemies (hit reactions, ragdolls, cover, perception) arrive with M3 and the navmesh.
- The touch layout has not been tested on a real phone.
- Graphics are "good browser game", not console-grade.

## Next steps

1. Enemies with perception that reacts to noise events (M3), hit reactions and ragdolls (Rapier).
2. Melee: swing arcs, stagger, stealth takedowns from behind.
3. Cover and a basic handler AI that flanks.
4. Real gun models, animations and recorded audio; bullet travel time for long shots.
5. Adinkra powers wired to the combat loop (Echo first: replays the last noise to draw enemies away).
