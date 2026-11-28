# Undead Lab

A browser game in the making: realistic-leaning characters (zombies, humans, heroes) rendered in
[three.js](https://threejs.org), with a procedural "bio" shader layer (skin, rot, wounds, grime, armour wear)
on top of rigged models and a real photo-scanned head.

Right now this repo has two parts: the **character lab** (six collections you can orbit, zoom and animate, including **Weapons** and **Choose hero**) and a first
**playable test street**: press **▶ Play** (it first takes you to **Choose hero**: click a man or a woman, choose what they wear, then *Play as …*) and run your hero around a small West-African-style street with real physics.
It is the foundation for the game itself (see [docs/ROADMAP.md](docs/ROADMAP.md)).

**Controls:** WASD / arrows move · Shift run · Space jump · mouse to look (click to capture, Esc to release) · wheel zoom.
Shooting: **Q** or right-click aim · **F** or left-click fire · **R** reload · **1 2 3** pistol / rifle / Dane gun. The **Range** button teleports you to a firing range
(plates, drums, crates, mannequins). Design and limits: [docs/COMBAT.md](docs/COMBAT.md).
On a phone: left thumb moves, right thumb looks, JUMP / RUN / FIRE / AIM / R / ⇄ buttons.

| Collection | What's in it |
| --- | --- |
| Oni Night | The original three characters with procedural gear |
| Undead | The Walker (infected trooper), Patient Zero, The Turned (scanned-head bust) |
| Heroes | Vanguard Prime and Aegis: plate armour, energy blade, cape, circuitry |
| Weapons | Pistol, assault rifle and Dane gun: bevelled multi-part models with working slide / bolt / magazine / hammer, steel with edge wear, wood, brass. Fire, Slow-mo and Reload animations |
| Humans | Scanned-head busts (full-body humans are the next character task) |

## Run it

Needs Node 20+ (22 recommended) and an internet connection the first time.

```bash
npm install
npm run dev          # http://localhost:5173  (also reachable from your phone on the same Wi-Fi)
npm run build        # production build in dist/
npm run preview      # serve dist/ on :4173
npm run lint         # catches undefined names and other slips
npm run test:screens # headless smoke tests (lab, play, shooting, weapons) + screenshots into docs/screens/ (needs `npm i --no-save playwright`)
npm run inspect -- public/models/soldier.glb   # dump a model's rig, meshes, materials, textures
```

The character models (about 9 MB) are **not stored in this repo**. `npm run dev` and `npm run build` download them
automatically into `public/models/` from the three.js examples (pinned tag, SHA-256 verified). Run `npm run assets` to do it by hand.

URL options: `?play=1` starts the game directly, `?c=oni|undead|heroes|weapons|humans` picks the collection, `&q=low|med|high` picks the quality tier
(default: `high` on desktop, `med` on phones).

## Layout

```
src/core/engine.js        renderer, camera, lights, stages, post-processing, asset loading
src/shaders/bio.js        the procedural skin / rot / wound / armour shader (injected into three's PBR materials)
src/characters/           one file per collection + factory.js (rig loading, retargeting) + gear/
src/game/                 play mode: physics.js (Rapier), world.js (the street), player.js, camera.js, input.js, textures.js, game.js,
                          weapons.js (guns, aiming, recoil, effects), range.js (firing range targets), audio.js (procedural sound)
src/weapons/               detailed gun models (models.js), their procedural materials (materials.js) and the lab page (lab.js)
src/main.js               collection registry, UI, main loop
public/models/            downloaded GLB rigs and head scan (git-ignored)
tools/                    fetch-assets.mjs (model download + checksums), inspect-glb.mjs
tests/screenshots.cjs     loads every collection, fails on errors, saves screenshots
tests/play.cjs            drives the hero with real key events (walk, run, jump, wall collision) and screenshots the street
tests/shoot.cjs           drives the weapons at the firing range (aim, recoil, reload, auto fire, headshots, Dane gun)
tests/weapons.cjs         checks the weapon models build, their working parts move, and every Weapons-page view renders
.github/workflows/        CI (lint, build, screenshots) and GitHub Pages deploy
docs/                     ARCHITECTURE, ASSETS (licences), ROADMAP, STORY, REALISM, COMBAT
```

## Deploy

Push to `main`; the **Deploy to GitHub Pages** workflow builds and publishes. One-time setup:
repo **Settings → Pages → Source: GitHub Actions**. Pages is free for public repos only.
**Read [docs/ASSETS.md](docs/ASSETS.md) before shipping**: the character rigs have their own terms.

## Credits

- Head scan: Infinite, 3D Head Scan by Lee Perry-Smith, CC-BY 3.0, <https://www.triplegangers.com>. Credit is required and shown in the app.
- three.js (MIT). Character rigs: see [docs/ASSETS.md](docs/ASSETS.md).
