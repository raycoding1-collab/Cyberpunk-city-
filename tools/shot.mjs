// Headless render check: node tools/shot.mjs [shot] [outfile] [width] [height] [extraQuery]
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const shot = process.argv[2] || 'street';
const out = process.argv[3] || `shots/${shot}.png`;
const W = +(process.argv[4] || 1600), H = +(process.argv[5] || 900);
const extra = process.argv[6] || '';
mkdirSync('shots', { recursive: true });

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
const url = 'file://' + resolve('docs/index.html') + `?shot=${shot}&capture=1${extra}`;
const t0 = Date.now();
await page.goto(url);
try {
  await page.waitForFunction(() => window.__captureReady === true, null, { timeout: 600000, polling: 500 });
} catch (e) { logs.push('[timeout] ' + e.message); }
const stats = await page.evaluate(() => window.__stats || null);
console.log('ready after', ((Date.now() - t0) / 1000).toFixed(1), 's');
await page.screenshot({ path: out, timeout: 600000 });
console.log(`saved ${out} in ${((Date.now() - t0) / 1000).toFixed(1)}s`, stats ? JSON.stringify(stats) : '');
for (const l of [...new Set(logs)].slice(0, 40)) console.log(l.slice(0, 1500));
await browser.close();
