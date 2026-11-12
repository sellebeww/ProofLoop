// Smoke test asisten AI: (1) mati secara default, (2) saat aktif (server dimock) saran berlabel dan tidak mengubah panduan. Butuh Playwright. © 2026 Vassel Goleyu.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:5173';
const must = (c, m) => { if (!c) { console.error('GAGAL:', m); process.exitCode = 1; throw new Error(m); } console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const mk = async mock => { const page = await (await b.newContext({ viewport: { width: 1200, height: 900 } })).newPage(); page.on('pageerror', e => errs.push(e.message)); if (mock) await mock(page);
    await page.goto(BASE + '/#/masuk'); await page.click('[data-act=demo-as][data-email="nadia@ruangaksi.id"]'); await page.waitForURL(/beranda/); await page.goto(BASE + '/#/proses/p1/panduan'); await page.waitForSelector('.builder'); return page; };
  let p = await mk(); await p.waitForTimeout(300);
  must(!(await p.isVisible('text=Asisten AI')), 'AI tidak tampil bila server melaporkan mati (default)');
  p = await mk(async page => {
    await page.route('**/api/ai/status', r => r.fulfill({ json: { enabled: true } }));
    await page.route('**/api/ai/review', r => r.fulfill({ json: { suggestions: [{ step: 1, kind: 'ambigu', reason: 'Kata “sesuai” tidak terukur', quote: 'cocokkan', proposal: 'Sebutkan siapa dan kapan', label: 'Saran AI' }], dropped: 0 } }));
  });
  await p.waitForSelector('text=Asisten AI'); const before = await p.evaluate(() => JSON.stringify(PL.G('p1').draft));
  await p.click('[data-act=ai-run]'); must(await p.isVisible('.modal >> text=dikirim lewat server Anda ke Anthropic'), 'ada pemberitahuan privasi sebelum mengirim');
  await p.click('.modal-f .btn.primary'); await p.waitForSelector('.chip:has-text("Saran AI")');
  must(await p.isVisible('.chip:has-text("Saran AI")'), 'saran berlabel "Saran AI"');
  must((await p.evaluate(() => JSON.stringify(PL.G('p1').draft))) === before, 'panduan tidak berubah otomatis');
  await p.click('[data-act=ai-dismiss]'); must(!(await p.isVisible('.chip:has-text("Saran AI")')), 'saran dapat diabaikan');
  must(errs.length === 0, 'tidak ada error halaman: ' + errs.join('|')); await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
