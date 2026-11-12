// ProofLoop build: bundel inti TypeScript + salin aset statis ke dist/. © 2026 Vassel Goleyu.
import { build, context } from 'esbuild';
import { cpSync, rmSync, mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
const watch = process.argv.includes('--watch');

const bundleOpts = {
  entryPoints: [join(root, 'src/browser.ts')],
  outfile: join(out, 'js/domain.js'),
  bundle: true,
  format: 'iife',
  globalName: 'PLCore',
  target: 'es2020',
  sourcemap: true,
  minify: !watch,
  logLevel: 'info',
};

function copyStatic() {
  for (const d of ['css', 'js', 'icons']) if (existsSync(join(root, d))) cpSync(join(root, d), join(out, d), { recursive: true });
  for (const f of ['index.html', 'manifest.webmanifest', 'sw.js', 'offline.html']) if (existsSync(join(root, f))) copyFileSync(join(root, f), join(out, f));
  mkdirSync(join(out, 'vendor'), { recursive: true });
  copyFileSync(join(root, 'node_modules/lucide/dist/umd/lucide.min.js'), join(out, 'vendor/lucide.min.js'));
}

// Versi cache service worker diturunkan dari isi berkas, agar cache lama dibuang tiap rilis.
function stampServiceWorker() {
  const sw = join(out, 'sw.js');
  if (!existsSync(sw)) return;
  const h = createHash('sha256');
  for (const f of ['index.html', 'js/domain.js', 'css/app.css', 'css/public.css']) if (existsSync(join(out, f))) h.update(readFileSync(join(out, f)));
  writeFileSync(sw, readFileSync(sw, 'utf8').replace('__BUILD_ID__', h.digest('hex').slice(0, 12)));
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
copyStatic();

if (watch) {
  const ctx = await context(bundleOpts);
  await ctx.watch();
  console.log('esbuild: mengamati src/ (statis disalin sekali; jalankan ulang untuk js/css baru).');
} else {
  await build(bundleOpts);
  stampServiceWorker();
}
