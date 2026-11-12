// Smoke test bukti per langkah + komentar reviewer. Butuh Playwright. © 2026 Vassel Goleyu.
const { chromium } = require('playwright'); const fs = require('fs'); const os = require('os'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:5173';
const must = (c, m) => { if (!c) { console.error('GAGAL:', m); process.exitCode = 1; throw new Error(m); } console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch(); const page = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  const as = id => page.evaluate(i => { PL.A['switch-user']({ dataset: { id: i } }); }, id);
  await page.goto(BASE + '/#/masuk'); await page.click('[data-act=demo-as][data-email="nadia@ruangaksi.id"]'); await page.waitForURL(/beranda/);
  await page.evaluate(() => { PL.G('p1').draft[0].needsEvidence = true; PL.save(); });
  await page.goto(BASE + '/#/proses/p1/panduan'); await page.click('[data-act=b-publish]'); await page.fill('.modal [name=summary]', 'v1'); await page.click('.modal-f .btn.primary');
  await page.waitForFunction(() => PL.P('p1').stage === 'ready');
  await as('m2'); await page.goto(BASE + '/#/praktik/p1'); await page.click('[data-act=start-attempt]'); await page.waitForFunction(() => PL.P('p1').stage === 'progress');
  must(await page.isVisible('text=Wajib'), 'langkah wajib bukti ditandai');
  await page.check('[data-in=ex-done]'); await page.click('[data-act=ex-nav][data-d="1"]');
  for (let i = 1; i < 4; i++) { await page.check('[data-in=ex-done]'); await page.click('[data-act=ex-nav][data-d="1"]'); }
  await page.fill('textarea[name=text]', 'hasil'); await page.click('[data-act=ex-submit]');
  must(await page.isVisible('#xerr:not(.hide)'), 'kirim ditolak: bukti wajib belum ada');
  // kembali ke langkah 1 dan lampirkan teks + foto
  for (let i = 0; i < 4; i++) await page.click('[data-act=ex-nav][data-d="-1"]');
  await page.fill('[data-in=ev-text]', 'Poster terverifikasi koordinator');
  const png = path.join(os.tmpdir(), 'b.png'); fs.writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64'));
  await page.setInputFiles('[data-in=ev-photo]', png); await page.waitForSelector('img[alt^="Foto bukti"]'); must(true, 'foto bukti tampil (diperkecil)');
  const kb = await page.evaluate(() => PL.S.attempts.find(a => a.pid === 'p1').stepEvidence[PL.G('p1').versions[0].steps[0].id].photo.dataUrl.length); must(kb < 600000 && kb > 100, 'foto tersimpan sebagai data URL kecil (' + kb + ' karakter)');
  for (let i = 0; i < 4; i++) await page.click('[data-act=ex-nav][data-d="1"]');
  await page.click('[data-act=ex-submit]'); await page.click('.modal-f .btn.primary'); await page.waitForFunction(() => PL.P('p1').stage === 'submitted'); must(true, 'kirim berhasil setelah bukti ada');
  const aid = await page.evaluate(() => PL.S.attempts.find(a => a.pid === 'p1').id);
  await as('m3'); await page.goto(BASE + '/#/review/' + aid);
  must(await page.isVisible('text=Poster terverifikasi koordinator') && await page.isVisible('img[alt^="Foto bukti"]'), 'reviewer melihat bukti teks dan foto');
  await page.fill('#cm-general', 'Tolong perjelas langkah 1'); await page.click('[data-act=cm-add][data-sid=""]');
  await page.waitForFunction(() => PL.S.attempts.find(a => a.pid === 'p1').comments.length === 1); must(true, 'komentar reviewer tersimpan');
  await as('m1'); await page.goto(BASE + '/#/review/' + aid); must(!(await page.isVisible('[data-act=cm-add]')), 'non-reviewer tidak melihat form komentar');
  const bad = await page.evaluate(aid => PLCore.addComment(PL.S, { now: () => 'x', uid: PL.uid }, 'm1', aid, '', 'x'), aid); must(!bad.ok, 'non-reviewer ditolak di inti');
  must(errs.length === 0, 'tidak ada error konsol: ' + errs.join('|'));
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
