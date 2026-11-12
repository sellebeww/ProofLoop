// Smoke test alur demo di peramban headless (butuh Playwright terpasang; bukan dependensi proyek).
// Pakai: npm run build && node dev-server.js & ; lalu BASE=http://localhost:5173 node scripts/smoke.cjs
// © 2026 Vassel Goleyu.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:5173';
const must = (c, m) => { if (!c) { console.error('GAGAL:', m); process.exitCode = 1; throw new Error(m); } console.log('ok  ', m); };

(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const st = pid => page.evaluate(p => PL.P(p).stage, pid);
  const as = id => page.evaluate(i => { PL.A['switch-user']({ dataset: { id: i } }); }, id);
  await page.goto(BASE + '/#/masuk'); await page.click('[data-act=demo-as][data-email="nadia@ruangaksi.id"]'); await page.waitForURL(/#\/beranda/);
  must(await st('p1') === 'draft', 'p1 mulai sebagai draft');

  await page.goto(BASE + '/#/proses/p1/panduan'); await page.click('[data-act=b-publish]');
  await page.fill('.modal [name=summary]', 'Panduan awal untuk uji'); await page.click('.modal-f .btn.primary');
  await page.waitForFunction(() => PL.P('p1').stage === 'ready'); must(true, 'Nadia menerbitkan: draft → ready');

  await as('m2'); await page.goto(BASE + '/#/praktik/p1'); await page.click('[data-act=start-attempt]');
  await page.waitForFunction(() => PL.P('p1').stage === 'progress'); must(true, 'Raka memulai: ready → progress');
  for (let i = 0; i < 4; i++) { await page.check('[data-in=ex-done]'); await page.click('[data-act=ex-nav][data-d="1"]'); }
  await page.fill('textarea[name=text]', 'Poster dan caption sudah terbit.');
  await page.click('[data-act=ex-submit]'); await page.click('.modal-f .btn.primary');
  await page.waitForFunction(() => PL.P('p1').stage === 'submitted'); must(true, 'Raka mengirim: progress → submitted');
  const aid = await page.evaluate(() => PL.S.attempts.find(a => a.pid === 'p1').id);

  await as('m3'); await page.goto(BASE + '/#/review/' + aid);
  const nq = await page.evaluate(() => PL.P('p1').quality.length);
  for (let i = 0; i < nq; i++) { await page.click(`[data-act=rv-set][data-v=pass] >> nth=${i}`); }
  await page.click('[data-act=rv-out][data-v=mandiri]'); await page.fill('[data-f=reason]', 'Semua kriteria terpenuhi.');
  await page.click('[data-act=rv-done]'); await page.click('.modal-f .btn.primary');
  await page.waitForFunction(() => PL.P('p1').stage === 'done'); must(true, 'Dimas menyetujui: submitted → done');

  // penjagaan: Raka tidak boleh menilai; hasil tidak berubah
  const r = await page.evaluate(() => { PL.A['switch-user']({ dataset: { id: 'm2' } }); return PL.completeReview(PL.S.attempts.find(a => a.pid === 'p1').id, { results: {}, dropped: {}, outcome: 'mandiri', reason: 'x', notes: {} }); });
  must(!!r.err, 'transisi terlarang ditolak setelah done');
  must(errs.length === 0, 'tidak ada error konsol/halaman: ' + errs.join(' | '));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
