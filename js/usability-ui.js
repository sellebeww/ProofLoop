/* ProofLoop — kartu skor keterpakaian dengan rumus transparan. Perhitungan ada di PLCore.usabilityOf. © 2026 Vassel Goleyu. */
(function (PL) {
  const { html, ic } = PL;
  const W = PLCore.WEIGHTS;
  PL.usabilityCard = pid => {
    const u = PL.usability(pid);
    const formula = html`<details class="mt"><summary class="small b">Bagaimana skor ini dihitung?</summary>
      <div class="small muted" style="margin-top:8px;display:grid;gap:6px">
        <p>Skor memakai <b>praktik terakhir yang sudah direview</b>, skala 0 sampai 100:</p>
        <ul style="margin:0;padding-left:18px"><li><b>${W.outcome}%</b> hasil: Mandiri = 100, Dengan Bantuan = 60, Belum Berhasil = 0.</li>
          <li><b>${W.steps}%</b> langkah tanpa bantuan: persentase langkah tanpa bantuan tervalidasi dan tanpa laporan kendala.</li>
          <li><b>${W.criteria}%</b> kriteria wajib: persentase kriteria wajib yang lulus (N/A tidak dihitung).</li></ul>
        <p>Komponen yang tidak bisa dihitung dibuang dan bobot sisanya dinormalkan. Bobot adalah pilihan desain, bukan hasil kalibrasi statistik. Skor mengukur satu praktik oleh satu penerus; ini bukan bukti bahwa orang lain juga bisa melakukannya.</p></div></details>`;
    if (u.score === null) return html`<div class="card"><div class="card-h"><h3>Keterpakaian panduan</h3></div><p class="small muted">Belum ada praktik yang direview, jadi skor belum tersedia (bukan 0).</p>${formula}</div>`;
    return html`<div class="card" data-testid="usability"><div class="card-h"><h3>Keterpakaian panduan</h3><span class="chip info">Siklus ${u.cycle} · v${u.guideVersion}</span></div>
      <div class="row" style="align-items:baseline;gap:8px"><span class="n" style="font-size:40px;font-weight:800" aria-label="Skor ${u.score} dari 100">${u.score}</span><span class="muted">/ 100</span></div>
      <p class="tiny muted">Berdasarkan ${u.reviewedCount} praktik yang direview${u.reviewedCount < 3 ? '. Sampel kecil: baca sebagai indikasi, bukan kesimpulan.' : '.'}</p>
      <div class="col mt" style="gap:8px">${u.components.map(c => html`<div><div class="row between small"><span>${c.label}</span><b>${c.value === null ? 'tidak dihitung' : Math.round(c.value)}</b></div>${c.value === null ? '' : html`<div class="bar" role="img" aria-label="${c.label}: ${Math.round(c.value)} dari 100"><i style="width:${Math.round(c.value)}%"></i></div>`}<div class="tiny muted">${c.detail}${u.effectiveWeights[c.key] != null ? ' · bobot ' + u.effectiveWeights[c.key] + '%' : ''}</div></div>`)}</div>
      ${u.trend.length > 1 ? html`<p class="small mt">${ic('trending-up')} Tren: ${u.trend.map(t => `Siklus ${t.cycle} (v${t.version}): ${t.score}`).join(' → ')}</p>` : ''}
      ${u.evidence ? html`<p class="tiny muted mt">Kelengkapan bukti langkah wajib-bukti: ${u.evidence.withEvidence}/${u.evidence.total} (tidak memengaruhi skor).</p>` : ''}${formula}</div>`;
  };
})(window.PL);
