// Smoke test ekspor/impor di peramban. Butuh Playwright. © 2026 Vassel Goleyu.
const { chromium } = require('playwright'); const fs = require('fs'); const os = require('os'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:5173';
const must = (c, m) => { if (!c) { console.error('GAGAL:', m); process.exitCode = 1; throw new Error(m); } console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1200, height: 900 } }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pl-')); let dialogs = 0; page.on('dialog', d => { dialogs++; d.dismiss(); });
  await page.goto(BASE + '/#/masuk'); await page.click('[data-act=demo-as][data-email="nadia@ruangaksi.id"]'); await page.waitForURL(/#\/beranda/);

  // ekspor Markdown panduan p1
  await page.goto(BASE + '/#/proses/p1/panduan'); await page.click('[data-act=gx-open]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=gx-dl][data-fmt=md]')]);
  const mdPath = path.join(dir, dl.suggestedFilename()); await dl.saveAs(mdPath); const md = fs.readFileSync(mdPath, 'utf8');
  must(md.startsWith('---\nproofloop: guide') && md.includes('## Langkah 4: Terbitkan Publikasi'), 'ekspor .md berisi frontmatter dan 4 langkah');
  await page.keyboard.press('Escape');

  // ubah draf lalu impor ulang dari .md -> pulih
  await page.evaluate(() => { PL.G('p1').draft.length = 1; PL.save(); });
  await page.goto(BASE + '/#/proses/p2/panduan'); await page.goto(BASE + '/#/proses/p1/panduan'); await page.click('[data-act=gx-open]');
  await page.setInputFiles('[data-in=gx-file]', mdPath); await page.click('.modal-f .btn.primary >> nth=-1');
  await page.waitForFunction(() => PL.G('p1').draft.length === 4); must(true, 'impor .md memulihkan 4 langkah');

  // impor proses baru dari JSON
  await page.goto(BASE + '/#/proses/p1/panduan'); await page.click('[data-act=gx-open]');
  const [dj] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=gx-dl][data-fmt=json]')]);
  const jp = path.join(dir, dj.suggestedFilename()); await dj.saveAs(jp); await page.keyboard.press('Escape');
  await page.goto(BASE + '/#/proses'); await page.click('[data-act=gx-new]'); await page.setInputFiles('[data-in=gx-new-file]', jp);
  await page.waitForFunction(() => PL.S.processes.length === 9); const n = await page.evaluate(() => PL.S.processes.length); must(n === 9, 'proses baru dari JSON dibuat (9 proses)');

  // berkas berbahaya/rusak ditolak tanpa mengubah data
  const bad = path.join(dir, 'rusak.json'); fs.writeFileSync(bad, '{"format":"proofloop.guide","formatVersion":1,"steps":"x"}');
  await page.goto(BASE + '/#/proses'); await page.click('[data-act=gx-new]'); await page.setInputFiles('[data-in=gx-new-file]', bad);
  await page.waitForSelector('#gxn-err:not(.hide)'); const cnt = await page.evaluate(() => PL.S.processes.length); must(cnt === 9, 'berkas rusak ditolak, data tidak berubah (jumlah=' + cnt + ')');

  // cadangan workspace: ekspor, ubah, impor
  await page.goto(BASE + '/#/pengaturan?tab=privacy');
  const [dw] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=export-data]')]);
  const wp = path.join(dir, dw.suggestedFilename()); await dw.saveAs(wp);
  const wj = JSON.parse(fs.readFileSync(wp, 'utf8')); must(wj.format === 'proofloop.workspace' && !JSON.stringify(wj).includes('pwHash'), 'cadangan memakai format baru, tanpa hash kata sandi');
  await page.evaluate(() => { PL.S.processes.pop(); PL.save(); });
  await page.setInputFiles('[data-in=import-data]', wp); await page.click('.modal-f .btn.danger');
  await page.waitForFunction(() => PL.S.processes.length === 9); must(true, 'impor cadangan memulihkan 9 proses');
  must((await page.evaluate(() => PL.S.session.user)) === 'm1', 'sesi tetap sebagai pengguna yang sama setelah impor');

  // XSS lewat impor: teks berbahaya harus tampil sebagai teks
  const evil = path.join(dir, 'evil.md'); fs.writeFileSync(evil, '---\nproofloop: guide\nformat: 1\nprocess: "<img src=x onerror=window.__xss=1>"\ncategory: "Operasional"\n---\n## Langkah 1: <script>window.__xss=1</script>\n\n### Cara melakukan\n\n<img src=x onerror=window.__xss=1>\n\n### Hasil yang berhasil\n\nok\n');
  await page.goto(BASE + '/#/proses'); await page.click('[data-act=gx-new]'); await page.setInputFiles('[data-in=gx-new-file]', evil);
  await page.waitForFunction(() => PL.S.processes.length === 10); await page.goto(BASE + '/#/proses'); await page.waitForTimeout(300);
  must(!(await page.evaluate(() => window.__xss)), 'teks berbahaya dari berkas tidak dieksekusi'); must(dialogs === 0, 'tidak ada dialog');
  must(errs.length === 0, 'tidak ada error konsol: ' + errs.join('|'));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
