// Play-mode smoke test: loads ?play=1 in headless Chromium (software GL), drives the hero with real key events and checks
// that physics behaves: it walks, runs, jumps and lands, is stopped by walls, and the camera follows. Writes screenshots
// to docs/screens/play_*.png.
//
//   npm run build && npm run preview &     then     node tests/play.cjs
// Env: BASE (default http://127.0.0.1:4173/), Q (low|med|high, default low), W/H, SHOTS=0 to skip screenshots.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:4173/';
const Q = process.env.Q || 'low';
const W = +(process.env.W || 1280), H = +(process.env.H || 720);
const SHOTS = process.env.SHOTS !== '0';
const OUT = path.resolve(__dirname, '..', 'docs', 'screens');
const IGNORE = /GPU stall|ReadPixels|Automatic fallback|WebGL: INVALID|favicon|deprecated/;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-vsync'] });
  const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
  const errors = [], fails = [];
  page.on('console', m => { const t = m.text(); if (IGNORE.test(t)) return; if (m.type() === 'error' || /Shader Error|WebGLProgram|GAME FAIL|BUILD FAIL/.test(t)) errors.push(t.slice(0, 1200)) });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message.slice(0, 500)));
  page.on('requestfailed', r => errors.push('REQUEST FAILED: ' + r.url()));
  const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? '  ' + info : ''}`); if (!ok) fails.push(name) };
  const st = () => page.evaluate(() => { const g = window.__game, p = g.player; return { x: p.pos.x, y: p.pos.y - 0.9, z: p.pos.z, speed: p.speed, state: p.state, grounded: p.grounded, yaw: g.cam.yaw, frames: window.__frames } });
  const shot = async (name) => { if (!SHOTS) return; await page.waitForTimeout(1500); await page.screenshot({ path: path.join(OUT, `play_${name}.png`) }); console.log('  saved play_' + name + '.png') };
  const until = (fn, arg, ms = 60000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true).catch(() => false);

  const t0 = Date.now();
  await page.goto(`${BASE}?play=1&q=${Q}`, { waitUntil: 'load', timeout: 120000 });
  const loaded = await page.waitForFunction(() => window.__playing && window.__game && !document.getElementById('load'), null, { timeout: 280000 }).then(() => true).catch(() => false);
  check('game loads', loaded, `${((Date.now() - t0) / 1000).toFixed(0)}s`);
  if (!loaded) { console.log(errors.join('\n')); await browser.close(); process.exit(1) }
  await page.evaluate(() => { document.getElementById('hint') && 0 });
  const tris = await page.evaluate(() => window.__game.level.group.userData.tris | 0); console.log('  level triangles', tris);

  const sim = (sec) => page.evaluate(s => window.__game.simulate(s), sec);      // physics only, independent of the (slow, software) frame rate
  const cams = (o) => page.evaluate(o => { const g = window.__game; g.cam.yaw = o.yaw; g.cam.pitch = o.pitch ?? g.cam.pitch }, o);

  // 1. settles on the ground
  await sim(1.5);
  let s = await st(); check('lands on the ground', s.grounded && Math.abs(s.y) < .1, `y=${s.y.toFixed(2)}`);
  await shot('01_start');

  // 2. walks forward (W) along the camera heading (+x)
  const x0 = s.x; await page.keyboard.down('KeyW'); await sim(2.5);
  s = await st(); check('walks forward', s.x - x0 > 3 && s.state === 'Walk' && s.speed > 1.5 && s.speed < 2.3, `dx=${(s.x - x0).toFixed(1)} speed=${s.speed.toFixed(2)} state=${s.state}`);
  // 3. runs (Shift)
  await page.keyboard.down('ShiftLeft'); await sim(2.5);
  s = await st(); check('runs with Shift', s.speed > 4.5 && s.state === 'Run', `speed=${s.speed.toFixed(1)} state=${s.state}`);
  await shot('02_running');
  await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW'); await sim(1.2);
  s = await st(); check('stops when keys are released', s.speed < .2 && s.state === 'Idle', `speed=${s.speed.toFixed(2)}`);

  // 4. jump and land
  const gy = s.y; await page.keyboard.down('Space'); await page.keyboard.up('Space'); await sim(.3);
  s = await st(); const peakUp = s.y - gy > .4 && !s.grounded; await sim(1.5); s = await st();
  check('jumps and lands', peakUp && s.grounded && Math.abs(s.y - gy) < .05, `peakUp=${peakUp} landed y=${s.y.toFixed(2)}`);

  // 5. walls stop the hero: stand 4.7 m south of the shop row (front face z=-7.25) and walk into it for 6 s
  await page.evaluate(() => { const g = window.__game; g.player.teleport(-25.4, 0.05, -2.5); g.cam.yaw = Math.PI }); await sim(.5);
  await page.keyboard.down('KeyW'); await sim(6); await page.keyboard.up('KeyW');
  s = await st(); check('wall blocks the hero', s.z < -6.8 && s.z > -7.05, `z=${s.z.toFixed(2)} (wall face -7.25 + radius 0.3)`);
  await shot('03_shops');

  // 5b. the plinth step (0.2 m) is climbed, and the hero can walk right through an open doorway-sized gap (gate gap is 3.4 m)
  await page.evaluate(() => { const g = window.__game; g.player.teleport(-42.5, 0.05, -4.0); g.cam.yaw = Math.PI }); await sim(.5);
  await page.keyboard.down('KeyW'); await sim(4.8); await page.keyboard.up('KeyW');
  s = await st(); check('walks through the compound gate', s.z < -11 && Math.abs(s.x + 42.5) < .3, `x=${s.x.toFixed(1)} z=${s.z.toFixed(1)}`);

  // 5c. the perimeter wall holds the hero in
  await page.evaluate(() => { const g = window.__game; g.player.teleport(50, 0.05, 0); g.cam.yaw = Math.PI / 2 }); await sim(.3);
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft'); await sim(5); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  s = await st(); check('perimeter wall holds', s.x < 57.1 && s.x > 56.5, `x=${s.x.toFixed(2)}`);

  // 6. camera views for the record
  const views = [
    ['04_kiosk', -33, 0.05, -3.0, Math.PI * 1.0 + .5, .16, 4.2], ['05_unfinished', 6, 0.05, -2.5, Math.PI + .5, .2, 5.6],
    ['06_chopbar', -13, 0.05, 6.5, -.3, .22, 4.6], ['07_road', -30, 0.05, 0.5, Math.PI / 2, .14, 3.6],
  ];
  for (const [n, x, y, z, yaw, pitch, d] of views) {
    await page.evaluate(([x, y, z, yaw, pitch, d]) => { const g = window.__game; g.player.teleport(x, y, z); g.cam.yaw = yaw; g.cam.pitch = pitch; g.cam.want = g.cam.dist = d }, [x, y, z, yaw, pitch, d]);
    await shot(n);
  }
  const frames = await page.evaluate(() => window.__frames); check('render loop running', frames > 10, `frames=${frames}`);

  // 7. back to the lab and make sure it comes back cleanly
  await page.click('#back'); const back = await until(() => !window.__playing && window.__ready && !document.getElementById('load'), null, 120000);
  check('returns to the lab', back);
  check('no console / shader errors', errors.length === 0, errors.length ? '\n' + errors.join('\n') : '');
  await browser.close();
  console.log(fails.length ? `FAILED: ${fails.join(', ')}` : 'play tests passed'); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1) });
