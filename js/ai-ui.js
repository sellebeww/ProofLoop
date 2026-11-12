/* ProofLoop — asisten AI opsional (saran, bukan keputusan). Hanya tampil bila server melaporkan AI aktif lewat .env.
   Teks panduan dikirim ke server lokal/deploy Anda, lalu ke Anthropic, hanya saat tombol ditekan. © 2026 Vassel Goleyu. */
(function (PL) {
  const { html, ic } = PL;
  const AI = PL.ai = { enabled: null, running: false, results: null, dismissed: {} };
  const KIND = { ambigu: 'Ambigu', tidak_bisa_diuji: 'Sulit diuji' };

  const box = () => {
    if (!AI.enabled) return '';
    const r = AI.results;
    return html`<section class="card" aria-labelledby="ai-h" style="border-style:dashed"><div class="card-h"><h3 id="ai-h">${ic('sparkles')} Asisten AI <span class="chip">Opsional</span></h3>
      <button class="btn sm" data-act="ai-run" ${AI.running ? PL.raw('disabled') : ''}>${AI.running ? 'Meninjau…' : 'Tinjau langkah ambigu atau sulit diuji'}</button></div>
      <p class="small muted">Menandai langkah yang bisa ditafsirkan berbeda atau tidak punya hasil yang bisa diperiksa. Semua keluaran adalah <b>saran AI</b>, bisa keliru, dan tidak mengubah panduan. Anda yang memutuskan.</p>
      ${r ? (r.error ? html`<div class="err-msg mt" role="alert">${ic('alert-circle')} ${r.error}</div>` : r.items.length ? html`<div class="col mt" style="gap:8px" aria-live="polite">${r.items.map((s, i) => AI.dismissed[i] ? '' : html`<div class="card flat" style="padding:10px 14px"><div class="row" style="gap:8px"><span class="chip warn">${ic('sparkles')} Saran AI</span><span class="chip">${KIND[s.kind]}</span><b class="small">Langkah ${s.step}</b></div>
          <p class="small mt">${s.reason}</p>${s.quote ? html`<p class="tiny muted">Kutipan: “${s.quote}”</p>` : ''}${s.proposal ? html`<p class="small"><b>Usulan:</b> ${s.proposal}</p>` : ''}
          <div class="row mt"><button class="btn sm" data-act="ai-goto" data-step="${s.step}">Ke langkah ${s.step}</button><button class="btn sm ghost" data-act="ai-dismiss" data-i="${i}">Abaikan saran</button></div></div>`)}</div>` : html`<p class="small mt">${ic('check')} AI tidak menandai langkah mana pun. Ini bukan jaminan panduan sudah jelas.</p>`) : ''}</section>`;
  };
  const paint = () => { const el = PL.$('#aibox'); if (el) { el.innerHTML = box().toString(); PL.icons(); } };
  PL.aiInit = async () => {
    if (AI.enabled === null) { try { const r = await fetch('/api/ai/status', { cache: 'no-store' }); AI.enabled = r.ok ? !!(await r.json()).enabled : false; } catch (e) { AI.enabled = false; } }
    paint();
  };
  PL.A['ai-run'] = () => {
    const pid = PL.bs && PL.bs.pid, p = PL.P(pid), steps = PL.G(pid).draft;
    if (!steps.length) return PL.toast('Tambahkan langkah dulu.', 'err');
    PL.confirm('Kirim draf ke layanan AI?', `Teks ${steps.length} langkah draf “${p.name}” akan dikirim lewat server Anda ke Anthropic untuk ditinjau. Data anggota dan hasil praktik tidak dikirim. Lanjutkan hanya bila isi panduan boleh dikirim ke pihak ketiga.`, async () => {
      AI.running = true; AI.results = null; AI.dismissed = {}; paint();
      try {
        const r = await fetch('/api/ai/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: p.name, steps: steps.map(s => ({ title: s.title, what: s.what, how: s.how, success: s.success, prepare: s.prepare, decision: s.decision, warning: s.warning })) }) });
        const j = await r.json().catch(() => ({}));
        AI.results = r.ok ? { items: j.suggestions || [] } : { error: j.error || 'Tinjauan AI gagal.' };
      } catch (e) { AI.results = { error: 'Tidak dapat menghubungi server AI.' }; }
      AI.running = false; paint();
    }, { ok: 'Kirim dan tinjau' });
  };
  PL.A['ai-goto'] = b => { PL.bs.idx = Math.max(0, +b.dataset.step - 1); PL.rerender(); };
  PL.A['ai-dismiss'] = b => { AI.dismissed[+b.dataset.i] = true; paint(); };
})(window.PL);
