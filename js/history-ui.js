/* ProofLoop — tampilan diff antarversi panduan. Perhitungan ada di PLCore.diffSteps. © 2026 Vassel Goleyu. */
(function (PL) {
  const { html, ic } = PL;
  const parts = ps => ps.map(p => p.type === 'add' ? html`<ins>${p.text}</ins>` : p.type === 'del' ? html`<del>${p.text}</del>` : p.text);
  const kindLbl = { added: ['plus-circle', 'Ditambahkan'], removed: ['minus-circle', 'Dihapus'], changed: ['pencil', 'Diubah'], moved: ['arrow-up-down', 'Dipindah'] };
  PL.diffView = (before, after) => {
    const d = PLCore.diffSteps(before, after), s = d.stats;
    if (!d.changes.length) return html`<p class="small muted">Tidak ada perubahan isi.</p>`;
    return html`<div class="col" style="gap:10px"><p class="small muted">${s.added} ditambahkan · ${s.removed} dihapus · ${s.changed} diubah · ${s.moved} dipindah · ${s.unchanged} tetap. <span class="tiny">Teks <ins>bergaris bawah</ins> ditambahkan, <del>tercoret</del> dihapus.</span></p>
      ${d.changes.map(c => { const [i, l] = kindLbl[c.kind], title = c.step ? c.step.title : c.title;
        return html`<div class="card flat diffstep" style="padding:10px 14px"><div class="row" style="gap:8px">${ic(i)}<b>${l}:</b> <span>${title || '(tanpa judul)'}</span>${c.kind === 'moved' || (c.kind === 'changed' && c.moved) ? html`<span class="chip">posisi ${c.oldIndex + 1} → ${c.index + 1}</span>` : ''}</div>
          ${c.kind === 'changed' ? html`<dl class="kv small mt">${c.fields.map(f => html`<dt>${f.label}</dt><dd class="diffdd">${parts(f.parts)}</dd>`)}</dl>` : ''}</div>`; })}</div>`;
  };
})(window.PL);
