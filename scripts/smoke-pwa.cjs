// Smoke test PWA: manifest valid, SW terdaftar, aplikasi tetap terbuka saat offline. Butuh Playwright. © 2026 Vassel Goleyu.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:5173';
const must = (c, m) => { if (!c) { console.error('GAGAL:', m); process.exitCode = 1; throw new Error(m); } console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 360, height: 740 } }); const p = await ctx.newPage();
  await p.goto(BASE + '/'); await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(800);
  const man = await p.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
  must(man.display === 'standalone' && man.icons.length >= 3 && man.icons.some(i => i.purpose === 'maskable'), 'manifest valid dengan ikon maskable');
  for (const i of man.icons) { const r = await p.request.get(BASE + '/' + i.src); must(r.ok(), 'ikon ' + i.src + ' dapat diunduh'); }
  must(await p.evaluate(() => !!navigator.serviceWorker.controller || navigator.serviceWorker.getRegistration().then(r => !!r)), 'service worker terdaftar');
  await p.reload(); await ctx.setOffline(true); await p.reload(); await p.waitForSelector('#root *');
  must((await p.textContent('body')).includes('ProofLoop'), 'halaman termuat saat offline'); must(await p.evaluate(() => typeof PL === 'object' && typeof PLCore === 'object'), 'skrip aplikasi termuat dari cache saat offline');
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
