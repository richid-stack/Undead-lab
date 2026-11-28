// Smoke test + screenshot harness.
//
//   npm run build && npm run preview &      (serves http://127.0.0.1:4173)
//   npm run test:screens
//
// Loads every collection in headless Chromium (software GL, so it also runs in CI),
// fails on any console error / page error / shader compile error, and writes one PNG
// per view to docs/screens/.
//
// Env: BASE (default http://127.0.0.1:4173/), COLS (comma list), VIEWS (max views per
//      collection, default all), Q (quality tier low|med|high, default med),
//      W/H (viewport, default 1280x800)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:4173/';
const Q = process.env.Q || 'med';
const W = +(process.env.W || 1280), H = +(process.env.H || 800);
const OUT = path.resolve(__dirname, '..', 'docs', 'screens');
const IGNORE = /GPU stall|ReadPixels|Automatic fallback|WebGL: INVALID|favicon/;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-vsync'],
  });
  let failed = 0;
  const ids = (process.env.COLS || 'oni,undead,heroes,humans,cast').split(',');
  for (const id of ids) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => {
      const t = m.text();
      if (IGNORE.test(t)) return;
      if (m.type() === 'error' || /Shader Error|WebGLProgram|BUILD FAIL/.test(t)) errors.push(t.slice(0, 1500));
    });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message.slice(0, 500)));
    page.on('requestfailed', r => errors.push('REQUEST FAILED: ' + r.url()));
    const t0 = Date.now();
    await page.goto(`${BASE}?c=${id}&q=${Q}`, { waitUntil: 'load', timeout: 120000 });
    const ok = await page.waitForFunction(() => window.__ready && !document.getElementById('load'), null, { timeout: 240000 })
      .then(() => true).catch(() => false);
    if (!ok) { errors.push('LOAD TIMEOUT'); }
    else {
      await page.evaluate(() => window.__stop && window.__stop());
      let views = await page.evaluate(i => window.__cols[i].inst.buttons.slice(), id);
      if (process.env.VIEWS) views = views.slice(0, +process.env.VIEWS);
      for (const v of views) {
        await page.evaluate(n => window.__view(n), v);
        await page.waitForTimeout(2500);
        const file = path.join(OUT, `${id}_${v}.png`);
        await page.screenshot({ path: file });
        console.log('  saved', path.relative(process.cwd(), file));
      }
      const frames = await page.evaluate(() => window.__frames);
      if (!(frames > 5)) errors.push('render loop is not running (frames=' + frames + ')');
    }
    console.log(`${errors.length ? 'FAIL' : 'ok  '} ${id}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    for (const e of errors.slice(0, 10)) console.log('   ' + e);
    if (errors.length) failed++;
    await ctx.close();
  }
  await browser.close();
  if (failed) { console.error(`${failed} collection(s) failed`); process.exit(1); }
  console.log('all collections rendered with no errors');
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
