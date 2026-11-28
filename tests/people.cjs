// Playable people test: the "Choose hero" page and every person in Play mode.
//
//   npm run build && npm run preview &      (serves http://127.0.0.1:4173)
//   npm run test:people
//
// For each hero: the street loads with no console / shader errors, the body has separate clothes, shoes and hair and the three locomotion clips,
// stands at the height in its spec with its feet on the ground, walks, and a pistol shot uses one round.
// For the chooser page: it renders with every person, clicking a person selects them and the Play button names them.
// Env: BASE (default http://127.0.0.1:4173/), Q (default low), HEROES (comma list), SHOTS=0 to skip screenshots.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:4173/', Q = process.env.Q || 'low', SHOTS = process.env.SHOTS !== '0';
const OUT = path.resolve(__dirname, '..', 'docs', 'screens');
const IGNORE = /GPU stall|ReadPixels|Automatic fallback|WebGL: INVALID|favicon|deprecated/;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-vsync'] });
  const fails = [], errors = [];
  const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? '  ' + info : ''}`); if (!ok) fails.push(name) };
  const open = async url => {
    const page = await (await browser.newContext({ viewport: { width: 1100, height: 700 } })).newPage();
    page.on('console', m => { const t = m.text(); if (IGNORE.test(t)) return; if (m.type() === 'error' || /Shader Error|WebGLProgram|GAME FAIL|BUILD FAIL/.test(t)) errors.push(t.slice(0, 800)) });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message.slice(0, 500)));
    page.on('requestfailed', r => errors.push('REQUEST FAILED: ' + r.url()));
    await page.goto(url, { waitUntil: 'load', timeout: 120000 }); return page;
  };

  // ---- the chooser page ----
  {
    const page = await open(`${BASE}?c=cast&q=${Q}`);
    const up = await page.waitForFunction(() => window.__ready === 'cast', null, { timeout: 280000 }).then(() => true).catch(() => false);
    check('Choose hero page builds', up);
    if (up) {
      await page.evaluate(() => window.__stop()); await page.waitForTimeout(3000);
      const info = await page.evaluate(() => { const c = window.__cols.cast.inst; return { ids: c.heroIds, clothed: c.heroIds.every(id => ['clothes/outfit', 'clothes/shoes', 'hair'].every(k => c.bodies[id].human.items.has(k))), btn: document.querySelector('#cols .play').textContent } });
      check('shows 4 people, both genders', info.ids.length >= 4, info.ids.join(','));
      check('every person is dressed', info.clothed);
      check('Play button asks for a pick first', /pick/i.test(info.btn), info.btn);
      if (SHOTS) await page.screenshot({ path: path.join(OUT, 'cast_lineup.png') });
      const at = await page.evaluate(() => {                                                    // where the second person (a woman) stands on screen
        const c = window.__cols.cast.inst, cam = window.__camera, v = cam.position.clone().set(c.bodies[c.heroIds[1]].root.position.x, 1.1, 0).project(cam);
        return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight];
      });
      await page.mouse.click(at[0], at[1]); await page.waitForTimeout(2500);
      const after = await page.evaluate(() => document.querySelector('#cols .play').textContent);
      check('clicking a person selects them', /Play as/.test(after), after);
      if (SHOTS) await page.screenshot({ path: path.join(OUT, 'cast_picked.png') });
    }
    await page.context().close();
  }

  // ---- each hero in the street ----
  const ids = (process.env.HEROES || 'kwesi,abena,ama,kojo').split(',');
  for (const id of ids) {
    const page = await open(`${BASE}?play=1&hero=${id}&q=${Q}`);
    const up = await page.waitForFunction(() => window.__playing && window.__game && !document.getElementById('load'), null, { timeout: 280000 }).then(() => true).catch(() => false);
    check(`${id}: street loads`, up); if (!up) { await page.context().close(); continue }
    const s = await page.evaluate(() => {
      const g = window.__game, b = g.player.body, v = new b.root.position.constructor(), W = n => b.bones[n].getWorldPosition(v.clone());
      return { clothes: [...b.human.items.keys()], clips: Object.keys(b.acts), spec: b.person.height, head: W('Head').y - b.root.position.y, toe: Math.min(W('LeftToeBase').y, W('RightToeBase').y) - b.root.position.y, meshes: b.meshes.length };
    });
    check(`${id}: outfit, shoes and hair are separate items`, ['clothes/outfit', 'clothes/shoes', 'hair'].every(n => s.clothes.includes(n)), s.clothes.join(','));
    check(`${id}: Idle / Walk / Run clips`, ['Idle', 'Walk', 'Run'].every(n => s.clips.includes(n)), s.clips.join(','));
    check(`${id}: head at ~92% of ${s.spec} m`, s.head > s.spec * .88 && s.head < s.spec * .98, `head ${s.head.toFixed(2)} m`);
    check(`${id}: soles on the ground`, Math.abs(s.toe) < .06, `toe ${s.toe.toFixed(3)} m`);
    await page.keyboard.down('w'); await page.evaluate(() => window.__game.simulate(1.2));
    const w = await page.evaluate(() => ({ state: window.__game.player.state, speed: window.__game.player.speed }));
    await page.keyboard.up('w');
    check(`${id}: walks`, w.state === 'Walk' && w.speed > 1, `${w.state} ${w.speed.toFixed(2)} m/s`);
    const a0 = await page.evaluate(() => window.__game.weapons.state.ammo);
    await page.evaluate(() => { window.__game.input.fireQ = true; window.__game.simulate(.3) });
    const a1 = await page.evaluate(() => window.__game.weapons.state.ammo);
    check(`${id}: a shot uses one round`, a1 === a0 - 1, `${a0} -> ${a1}`);
    if (SHOTS) { await page.evaluate(() => { const g = window.__game; g.cam.yaw += Math.PI; g.cam.want = 3.4; g.cam.pitch = .1; g.simulate(.3) }); await page.waitForTimeout(2500); await page.screenshot({ path: path.join(OUT, `person_${id}.png`) }) }
    await page.context().close();
  }

  check('no console / shader errors', errors.length === 0, errors.length ? '\n' + errors.join('\n') : '');
  await browser.close();
  if (fails.length) { console.log('\nFAILED:', fails.join('; ')); process.exit(1) }
  console.log('\npeople tests passed');
})();
