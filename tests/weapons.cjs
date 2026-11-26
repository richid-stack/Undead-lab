// Weapons lab smoke test: loads ?c=weapons, checks the models build and their working parts move, and saves screenshots
// to docs/screens/weapons_*.png.
//
//   npm run build && npm run preview &     then     node tests/weapons.cjs
// Env: BASE (default http://127.0.0.1:4173/), Q (low|med|high), SHOTS=0 to skip screenshots.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:4173/', Q = process.env.Q || 'med', SHOTS = process.env.SHOTS !== '0';
const OUT = path.resolve(__dirname, '..', 'docs', 'screens');
const IGNORE = /GPU stall|ReadPixels|Automatic fallback|WebGL: INVALID|favicon|deprecated|AudioContext/;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [], fails = [];
  page.on('console', m => { const t = m.text(); if (IGNORE.test(t)) return; if (m.type() === 'error' || /Shader Error|WebGLProgram|BUILD FAIL/.test(t)) errors.push(t.slice(0, 1200)) });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message.slice(0, 500)));
  page.on('requestfailed', r => errors.push('REQUEST FAILED: ' + r.url()));
  const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? '  ' + info : ''}`); if (!ok) fails.push(name) };

  await page.goto(`${BASE}?c=weapons&q=${Q}`, { waitUntil: 'load', timeout: 120000 });
  const loaded = await page.waitForFunction(() => window.__ready === 'weapons' && !document.getElementById('load'), null, { timeout: 200000 }).then(() => true).catch(() => false);
  check('weapons page loads', loaded);
  if (!loaded) { console.log(errors.join('\n')); await browser.close(); process.exit(1) }
  await page.evaluate(() => window.__stop());

  // ---- the models and their working parts (all inside one evaluate, so the page's own animation cannot interfere) ----
  const r = await page.evaluate(() => {
    const G = window.__cols.weapons.inst.guns, out = {};
    const tris = o => { let n = 0; o.traverse(m => { if (m.isMesh) n += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3 }); return Math.round(n) };
    for (const id of ['pistol', 'rifle', 'dane']) { const g = G[id]; g.pose({}); out[id] = { tris: tris(g.group), muzzleZ: +g.muzzle.position.z.toFixed(3) } }
    const z0 = G.pistol.parts.slide.position.z; G.pistol.pose({ fire: .2 }); out.slideBack = +(z0 - G.pistol.parts.slide.position.z).toFixed(4);
    G.pistol.pose({ empty: true }); out.slideLock = +(z0 - G.pistol.parts.slide.position.z).toFixed(4);
    G.pistol.pose({}); const m0 = G.pistol.parts.mag.position.y; G.pistol.pose({ reload: .4, empty: true }); out.pistolMagDrop = +(m0 - G.pistol.parts.mag.position.y).toFixed(4);
    G.rifle.pose({}); const b0 = G.rifle.parts.bolt.position.z; G.rifle.pose({ fire: .2 }); out.boltBack = +(b0 - G.rifle.parts.bolt.position.z).toFixed(4);
    G.rifle.pose({}); const rm0 = G.rifle.parts.mag.position.y; G.rifle.pose({ reload: .4 }); out.rifleMagDrop = +(rm0 - G.rifle.parts.mag.position.y).toFixed(4);
    G.dane.pose({}); const h0 = G.dane.parts.hammer.rotation.x; G.dane.pose({ fire: .5 }); out.hammerFall = +(G.dane.parts.hammer.rotation.x - h0).toFixed(3);
    G.dane.pose({ reload: .3 }); out.hammerDownInReload = G.dane.parts.hammer.rotation.x === 0;
    for (const id of ['pistol', 'rifle', 'dane']) G[id].pose({});
    out.buttons = [...document.querySelectorAll('#views button')].map(b => b.dataset.v); out.anims = [...document.querySelectorAll('#anims button')].map(b => b.dataset.a);
    return out;
  });
  check('pistol has real detail (>2k triangles)', r.pistol.tris > 2000, `${r.pistol.tris} tris`);
  check('rifle has real detail (>6k triangles)', r.rifle.tris > 6000, `${r.rifle.tris} tris`);
  check('Dane gun has real detail (>5k triangles)', r.dane.tris > 5000, `${r.dane.tris} tris`);
  check('muzzles point forward', r.pistol.muzzleZ > .1 && r.rifle.muzzleZ > .4 && r.dane.muzzleZ > .8, `${r.pistol.muzzleZ} / ${r.rifle.muzzleZ} / ${r.dane.muzzleZ} m`);
  check('pistol slide recoils', r.slideBack > .02, `${r.slideBack} m`);
  check('pistol slide locks back when empty', r.slideLock > .025, `${r.slideLock} m`);
  check('pistol magazine drops out on reload', r.pistolMagDrop > .08, `${r.pistolMagDrop} m`);
  check('rifle bolt carrier recoils', r.boltBack > .02, `${r.boltBack} m`);
  check('rifle magazine drops out on reload', r.rifleMagDrop > .1, `${r.rifleMagDrop} m`);
  check('Dane gun hammer falls when fired', r.hammerFall > .5, `${r.hammerFall} rad`);
  check('Dane gun hammer stays down while reloading', r.hammerDownInReload);
  check('all views and animations are offered', r.buttons.length === 6 && r.anims.join() === 'Display,Fire,Slow-mo,Reload', `${r.buttons.join(',')} | ${r.anims.join(',')}`);

  // ---- every view and every animation renders without errors ----
  for (const v of r.buttons) {
    await page.evaluate(v => window.__view(v), v); await page.waitForTimeout(1500);
    if (SHOTS) { await page.screenshot({ path: path.join(OUT, `weapons_${v}.png`) }); console.log('  saved weapons_' + v + '.png') }
  }
  for (const a of ['Fire', 'Slow-mo', 'Reload']) { await page.evaluate(a => window.__setAnim(a), a); await page.evaluate(() => window.__view('lineup')); await page.waitForTimeout(1800) }

  // ---- other collections still load after the weapons page ----
  await page.evaluate(() => window.__col('heroes', 'lineup')); const heroes = await page.waitForFunction(() => window.__ready === 'heroes' && !document.getElementById('load'), null, { timeout: 200000 }).then(() => true).catch(() => false);
  check('switching to another collection works', heroes);
  check('no console / shader errors', errors.length === 0, errors.length ? '\n' + errors.join('\n') : '');
  await browser.close();
  console.log(fails.length ? `FAILED: ${fails.join(', ')}` : 'weapons tests passed'); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1) });
