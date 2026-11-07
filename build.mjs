// Bundles the scene into ONE self-contained HTML file (docs/index.html).
// No external assets, no CDN: open the file directly in any modern browser.
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const watch = process.argv.includes('--watch');
const OUT = process.env.OUT || 'docs/index.html';

async function emit(result) {
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const tpl = readFileSync('src/index.html', 'utf8');
  mkdirSync('docs', { recursive: true });
  writeFileSync(OUT, tpl.replace('<!--BUNDLE-->', () => `<script type="module">\n${js}\n</script>`));
  console.log(`[build] ${OUT}  ${(js.length / 1024).toFixed(0)} KB`);
}

const options = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'esm',
  minify: !watch,
  write: false,
  target: 'es2020',
  legalComments: 'none',
  plugins: [{
    name: 'emit-html',
    setup(build) { build.onEnd((r) => { if (!r.errors.length) emit(r); }); },
  }],
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: 'docs', port: 8080 });
  console.log(`[dev] http://localhost:${port}`);
} else {
  await esbuild.build(options);
}
