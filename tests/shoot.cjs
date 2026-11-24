// Shooting smoke test: loads ?play=1, goes to the firing range and drives the weapons with real key events.
// Checks aiming, semi/auto fire, spread/recoil, reload, weapon switching, hit reactions (plates, drums, mannequins) and
// writes screenshots to docs/screens/shoot_*.png.
//
//   npm run build && npm run preview &     then     node tests/shoot.cjs
// Env: BASE (default http://127.0.0.1:4173/), Q (low|med|high), SHOTS=0 to skip screenshots.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:4173/', Q = process.env.Q || 'low', SHOTS = process.env.SHOTS !== '0';
const OUT = path.resolve(__dirname, '..', 'docs', 'screens');
const IGNORE = /GPU stall|ReadPixels|Automatic fallback|WebGL: INVALID|favicon|deprecated|AudioContext/;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-vsync', '--autoplay-policy=no-user-gesture-required'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [], fails = [];
  page.on('console', m => { const t = m.text(); if (IGNORE.test(t)) return; if (m.type() === 'error' || /Shader Error|WebGLProgram|GAME FAIL|BUILD FAIL/.test(t)) errors.push(t.slice(0, 1200)) });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message.slice(0, 500)));
  page.on('requestfailed', r => errors.push('REQUEST FAILED: ' + r.url()));
  const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? '  ' + info : ''}`); if (!ok) fails.push(name) };
  const sim = s => page.evaluate(s => window.__game.simulate(s), s);
  const ev = (fn, a) => page.evaluate(fn, a);
  const wp = () => ev(() => { const w = window.__game.weapons, s = w.state; return { name: w.weapon.name, ammo: s.ammo, reserve: s.reserve, reload: w.reload, shots: w.stats.shots, hits: w.stats.hits, pitch: window.__game.cam.pitch, aimK: window.__game.cam.aimK, aimMode: window.__game.player.aimMode, noises: w.noises.length } });
  const stats = () => ev(() => ({ ...window.__game.range.stats }));
  const aimAt = (x, y, z) => ev(([x, y, z]) => window.__game.weapons.aimAt(x, y, z), [x, y, z]);
  const tap = async (key = 'KeyF', wait = .12) => { await page.keyboard.down(key); await sim(.02); await page.keyboard.up(key); await sim(wait) };
  const shot = async name => { if (!SHOTS) return; await page.waitForTimeout(1500); await page.screenshot({ path: path.join(OUT, `shoot_${name}.png`) }); console.log('  saved shoot_' + name + '.png') };

  const t0 = Date.now();
  await page.goto(`${BASE}?play=1&q=${Q}`, { waitUntil: 'load', timeout: 120000 });
  const loaded = await page.waitForFunction(() => window.__playing && window.__game && !document.getElementById('load'), null, { timeout: 280000 }).then(() => true).catch(() => false);
  check('game loads', loaded, `${((Date.now() - t0) / 1000).toFixed(0)}s`);
  if (!loaded) { console.log(errors.join('\n')); await browser.close(); process.exit(1) }

  await ev(() => window.__game.weapons.toRange()); await sim(2);
  let s, w = await wp(); check('starts with a full pistol', w.name === 'Pistol' && w.ammo === 12 && w.reserve === 48, `${w.name} ${w.ammo}/${w.reserve}`);
  await shot('01_ready');

  // aiming
  await page.keyboard.down('KeyQ'); await sim(.8); w = await wp();
  check('aiming zooms the camera in and faces forward', w.aimK > .9 && w.aimMode, `aimK=${w.aimK.toFixed(2)}`);

  // first shot at a plate 7 m away
  await aimAt(33.97, 1.35, -2.4); let s0 = await stats(), p0 = (await wp()).pitch; await tap('KeyF', .15);
  w = await wp(); s = await stats();
  check('pistol hits the plate', s.plates === s0.plates + 1, `plates=${s.plates}`);
  check('shot uses one round and kicks the camera', w.ammo === 11 && w.pitch < p0 - .005, `ammo=${w.ammo} pitch ${p0.toFixed(3)} -> ${w.pitch.toFixed(3)}`);
  check('shot makes noise for enemies to hear', w.noises === 1);
  await shot('02_aim_plate');

  // semi-auto: holding the key fires once
  await aimAt(33.97, 1.35, -2.4); await page.keyboard.down('KeyF'); await sim(.6); await page.keyboard.up('KeyF'); w = await wp();
  check('pistol is semi-automatic (hold = 1 shot)', w.ammo === 10, `ammo=${w.ammo}`);

  // reload
  await page.keyboard.press('KeyR'); await sim(.1); w = await wp(); const reloading = w.reload > 0;
  await sim(2); w = await wp();
  check('reload refills the magazine from the reserve', reloading && w.ammo === 12 && w.reserve === 46, `${w.ammo}/${w.reserve}`);

  // rifle: full auto
  await page.keyboard.press('Digit2'); await sim(.3); w = await wp(); check('switch to the rifle', w.name === 'Assault rifle' && w.ammo === 30);
  await aimAt(41.97, 1.5, -1.6); s0 = await stats(); await page.keyboard.down('KeyF'); await sim(1); await page.keyboard.up('KeyF'); w = await wp(); const s2 = await stats();
  check('rifle is full-auto (~10 rounds per second)', w.ammo >= 18 && w.ammo <= 22, `ammo=${w.ammo}`);
  check('burst mostly lands near the target (spread + recoil)', s2.plates - s0.plates >= 2, `plate hits=${s2.plates - s0.plates} of ${30 - w.ammo}`);
  await ev(() => { window.__game.weapons.fxSpeed = 0 }); await aimAt(41.97, 1.5, -1.6); await sim(1); await page.keyboard.down('KeyF'); await sim(.25); await page.keyboard.up('KeyF');
  await shot('03_rifle_fire'); await ev(() => { window.__game.weapons.fxSpeed = 1 }); await sim(1);

  // mannequin: headshots
  await ev(() => window.__game.weapons.select(1)); await ev(() => { window.__game.weapons.state.ammo = 30 });
  let hs0 = (await stats()).headshots, d0 = (await stats()).dummyDown;
  for (let i = 0; i < 4 && (await stats()).dummyDown === d0; i++) { await aimAt(48.5, 1.76, -.4); await sim(.6); await tap('KeyF', .2) }
  s = await stats(); check('headshot registers and drops the mannequin', s.headshots > hs0 && s.dummyDown === d0 + 1, `headshots=${s.headshots} down=${s.dummyDown}`);
  await sim(.7); await shot('04_mannequin_down');
  await sim(4); const up = await ev(() => !window.__game.range.dummyA.down); check('mannequin stands up again', up);

  // Dane gun: pellets knock the drums
  await page.keyboard.press('Digit3'); await sim(.3); w = await wp(); check('switch to the Dane gun', w.name === 'Dane gun' && w.ammo === 1);
  const dr = await ev(() => { const b = window.__game.range.bodies.find(b => Math.abs(b.home.x - 36.5) < .01); const p = b.rb.translation(); return [p.x, p.y, p.z] });
  await ev(() => window.__game.player.teleport(33.4, .05, 3.1)); await sim(.6);
  await aimAt(36.5, .55, 3.1); await sim(.3); await tap('KeyF', .15); w = await wp(); await sim(1.2);
  const dr2 = await ev(() => { const b = window.__game.range.bodies.find(b => Math.abs(b.home.x - 36.5) < .01); const p = b.rb.translation(); return [p.x, p.y, p.z] });
  const moved = Math.hypot(dr2[0] - dr[0], dr2[2] - dr[2]); s = await stats();
  check('Dane gun fires 9 pellets and moves the drum', w.ammo === 0 && s.drums >= 2 && moved > .15, `drum hits=${s.drums} moved=${moved.toFixed(2)} m`);
  check('empty gun starts reloading by itself', await ev(() => window.__game.weapons.autoReload > 0 || window.__game.weapons.reload > 0));
  await shot('05_drums');
  await sim(4); w = await wp(); check('Dane gun reloads a shell', w.ammo === 1 && w.reserve === 15, `${w.ammo}/${w.reserve}`);

  await page.keyboard.up('KeyQ'); await ev(() => { window.__game.cam.pitch = .2; window.__game.cam.want = window.__game.cam.dist = 3.4 }); await sim(1.2);
  await shot('06_hip_view');

  // back to the lab, clean exit
  await page.click('#back'); const back = await page.waitForFunction(() => !window.__playing && window.__ready && !document.getElementById('load'), null, { timeout: 120000 }).then(() => true).catch(() => false);
  check('returns to the lab', back);
  check('no console / shader errors', errors.length === 0, errors.length ? '\n' + errors.join('\n') : '');
  await browser.close();
  console.log(fails.length ? `FAILED: ${fails.join(', ')}` : 'shoot tests passed'); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1) });
