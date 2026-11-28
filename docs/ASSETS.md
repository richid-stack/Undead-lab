# Assets and licences

Know this before the game is shared or sold. This is a summary, not legal advice.

## How the models get into the project

The binary models are **not committed to this repo**. `tools/fetch-assets.mjs` downloads them from the three.js examples
(tag `r160`) and, for the playable people, from one pinned commit of the open `NastyFFM/HumanGenWeb` repository (a web-ready copy of the CC0 MakeHuman community assets), into `public/models/` and checks each file against a SHA-256, so you always get exactly the files the game was built with.
It runs automatically before `npm run dev` and `npm run build`, including in the GitHub workflows.

| Asset | Where from | Terms | Action |
| --- | --- | --- | --- |
| Head scan (`head/*`) | Infinite / Lee Perry-Smith, triplegangers.com, via three.js examples | CC-BY 3.0: free use **with credit**. Credit is shown in the app and in `assets-licenses/head-scan-LeePerrySmith.txt`. | Keep the credit. |
| Soldier, Xbot, Michelle | three.js examples; the rigs and animations originate from Mixamo | Adobe Mixamo terms: usable inside projects, but **not redistributable as standalone files**. | Fine for prototyping. The repo does not contain the files, but a deployed game still serves them to players. Before a commercial release, confirm the terms for your use, or replace them with licensed or self-made characters. |
| People: body mesh, 700+ shape modifiers, skins, hair, clothes, shoes, hats, eyes, skeleton (`mh/*`, 115 files, 24 MB; list and hashes in `tools/mh-manifest.json`) | The MakeHuman community's system assets (makehumancommunity.org), CC0, as converted for the web by `NastyFFM/HumanGenWeb` (app code MIT, data CC0), pinned to commit `a8ee33f9…` | CC0 public domain: no credit required, credit is given anyway. The tees' MakeHuman logo is painted out at load time (`LOGO_PATCHES` in `mh.js`). | If that repo is ever deleted the build fails loudly (the SHA check): fork it into your own GitHub account and change `repo` in `tools/mh-manifest.json`. To add more items (the library has more CC0 packs: shirts, trousers, dresses, hats, glasses, gloves, underwear) record the new file list and run `node tools/mh-manifest.mjs`. |
| three.js | MIT | Keep the licence notice (Vite does this in the build). | - |
| Everything in `src/` | Written for this project | You own it; no licence file chosen yet. | Add a `LICENSE` when you decide. |

## Hosting

GitHub Pages is free only for **public** repos. Cloudflare Pages and Netlify have free tiers that can deploy from private repos.

## Where better character assets come from

The photo-scanned head is the only truly photoreal asset today. The bodies are stylised rigs made more convincing by shaders and gear.
The biggest quality jump is better source assets:

- Commission or buy character meshes with proper scans/textures, and check the licence allows web distribution.
- CC0 texture libraries (Poly Haven, ambientCG) are good for environments. They are not reachable from the AI workspace's network, so
  add them to the repo yourself or fetch them in a GitHub Action.
- Do not use ripped game assets or Google 3D map tiles; their terms forbid it.

## Map data (when the Ghana world is added)

OpenStreetMap data is ODbL: show "© OpenStreetMap contributors" in the game, and if you publish a derived map database, that database stays open under ODbL.
Renders and gameplay built from it are fine.
