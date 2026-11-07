// Render the cinematic frame-by-frame: node tools/film.mjs <outDir> <start> <end> [w] [h] [fps]
// RESUME=1 skips frames already on disk (the simulation is still stepped through them, so a
// shard restarted mid-shot continues seamlessly). Start shards on shot boundaries.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const [outDir = 'film', s0 = '0', s1 = '-1', W = '1280', H = '544', FPS = '24'] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +W, height: +H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('file://' + resolve(process.env.PAGE || 'docs/index.html') + `?record=1&hud=0&q=high&fps=${FPS}${process.env.FILMQ || ''}`);
await page.waitForFunction(() => window.__captureReady === true && window.__film, null, { timeout: 600000, polling: 500 });
const total = await page.evaluate(() => window.__film.frames);
const a = +s0, b = +s1 < 0 ? total - 1 : Math.min(+s1, total - 1);
console.log(`frames ${a}..${b} of ${total}`);
await page.evaluate((i) => { window.__film.render(i); window.__film.render(i); }, process.env.FRAMES ? +process.env.FRAMES.split(',')[0] : a);   // compile + warm
const t0 = Date.now();
const list = process.env.FRAMES ? process.env.FRAMES.split(',').map(Number) : null;
const resume = !!process.env.RESUME;
for (let i = a; i <= b; i++) {
  if (list && !list.includes(i)) continue;
  const file = `${outDir}/f${String(i).padStart(5, '0')}.jpg`;
  if (resume && existsSync(file)) { await page.evaluate((k) => window.__film.step(k), i); continue; }
  const url = await page.evaluate((k) => window.__film.render(k), i);
  writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  if ((i - a) % 12 === 0) console.log(`frame ${i}  ${((Date.now() - t0) / 1000 / (i - a + 1)).toFixed(2)} s/frame`);
}
console.log('done', ((Date.now() - t0) / 1000).toFixed(0), 's');
await browser.close();
