// Render arbitrary inspection views in one browser session:
//   node tools/views.mjs views.json outDir [w] [h]
// views.json: [{ "name": "megablock", "p": [x,y,z], "t": [x,y,z], "fov": 50, "wt": 20 }, ...]
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [list, outDir = 'shots/views', W = '1600', H = '900'] = process.argv.slice(2);
const views = JSON.parse(readFileSync(list, 'utf8'));
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('file://' + resolve(process.env.PAGE || 'docs/index.html') + '?record=1&hud=0&q=high');
await page.waitForFunction(() => window.__captureReady === true && window.__film, null, { timeout: 600000, polling: 500 });
for (const v of views) {
  const t0 = Date.now();
  await page.evaluate((view) => window.__film.shoot(view), v);          // warm (shader compile, AO history)
  const url = await page.evaluate((view) => window.__film.shoot(view), v);
  writeFileSync(`${outDir}/${v.name}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
  console.log(v.name, ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
await browser.close();
