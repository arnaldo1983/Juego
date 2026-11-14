// Captura de pantalla del juego con Playwright.
// Uso: node tools/shot.mjs "<query>" salida.png [--w 1280 --h 720 --wait 2500 --keys "ArrowRight:1500,Space:300" --mobile --eval "js"]
// Ej:  node tools/shot.mjs "auto=1&x=20&fixed=1" /tmp/a.png --wait 3000
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const [query = 'auto=1', out = 'shot.png', ...rest] = process.argv.slice(2);
const opt = {}; for (let i = 0; i < rest.length; i++) if (rest[i].startsWith('--')) { const k = rest[i].slice(2); const v = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true; opt[k] = v; }
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctxOpts = opt.mobile ? { ...devices['iPhone 13 landscape'] } : { viewport: { width: +(opt.w || 1280), height: +(opt.h || 720) }, deviceScaleFactor: 1 };
const ctx = await browser.newContext(ctxOpts);
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
await page.goto(`http://localhost:${opt.port || 8080}/index.html?${query}`);
await page.waitForTimeout(+(opt.wait || 2500));
if (opt.keys) for (const seg of String(opt.keys).split(',')) {
  const [k, ms] = seg.split(':'); const keys = k.split('+');
  for (const kk of keys) await page.keyboard.down(kk);
  await page.waitForTimeout(+(ms || 200));
  for (const kk of keys) await page.keyboard.up(kk);
}
if (opt.eval) console.log('eval:', await page.evaluate(String(opt.eval)));
if (opt.after) await page.waitForTimeout(+opt.after);
await page.screenshot({ path: out });
const fps = await page.evaluate(() => new Promise((r) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); }));
console.log('fps(swiftshader):', fps);
if (errors.length) console.log('ERRORES:\n' + errors.slice(0, 20).join('\n')); else console.log('sin errores');
await browser.close();
