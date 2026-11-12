// Audit aksesibilitas (axe-core) dan overflow horizontal pada 360 px dan 1280 px. Butuh Playwright. © 2026 Vassel Goleyu.
const { chromium } = require('playwright'); const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:5173';
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const PUBLIC = ['#/', '#/profil', '#/masuk', '#/daftar'];
const APP = ['#/beranda', '#/proses', '#/proses/baru', '#/proses/p1', '#/proses/p1?tab=history', '#/proses/p5?tab=history', '#/proses/p1/panduan', '#/transfer', '#/transfer/p5', '#/praktik/p4', '#/perbaikan/p2', '#/hasil/p5', '#/tim', '#/laporan', '#/notifikasi', '#/pengaturan', '#/pengaturan?tab=privacy', '#/pengaturan?tab=roles'];
const LEVEL = process.env.LEVEL || 'serious';
(async () => {
  const b = await chromium.launch(); let bad = 0;
  for (const w of [360, 1280]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 800 } }); const p = await ctx.newPage(); if (process.env.THEME) await p.addInitScript(t => localStorage.setItem('pl.theme', t), process.env.THEME);
    const check = async r => {
      await p.goto(BASE + '/' + r); await p.waitForTimeout(250);
      const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      await p.evaluate(src => { if (!window.axe) (0, eval)(src); }, axeSrc);
      const res = await p.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }));
      const v = res.violations.filter(x => LEVEL === 'all' || x.impact === 'serious' || x.impact === 'critical');
      if (over > 1 || v.length) { bad++; console.log(`[${w}px] ${r}: overflow=${over}px`, v.map(x => `${x.id}(${x.nodes.length}; ${x.impact})`).join(', ')); if (process.env.VERBOSE) v.forEach(x => console.log('   ', x.id, x.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | '))); }
    };
    for (const r of PUBLIC) await check(r);
    await p.goto(BASE + '/#/masuk'); await p.click('[data-act=demo-as][data-email="nadia@ruangaksi.id"]'); await p.waitForURL(/beranda/);
    for (const r of APP) await check(r);
    await ctx.close();
  }
  console.log(bad ? `${bad} halaman bermasalah` : 'Semua halaman lolos (axe serious/critical + tanpa overflow)'); await b.close(); process.exit(bad ? 1 : 0);
})();
