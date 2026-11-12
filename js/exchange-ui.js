/* ProofLoop — UI ekspor/impor panduan dan cadangan data. Logika ada di PLCore (src/io). © 2026 Vassel Goleyu. */
(function (PL) {
  const { html, ic, raw } = PL;
  const slug = s => String(s || 'panduan').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'panduan';
  const ACCEPT = '.json,.md,.markdown,application/json,text/markdown,text/plain';
  const readFile = f => new Promise((res, rej) => { if (f.size > 8 * 1024 * 1024) return rej(new Error('Berkas terlalu besar (maksimum 8 MB).')); const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('Berkas tidak dapat dibaca.')); r.readAsText(f); });
  const showErr = (id, list) => { const e = PL.$('#' + id); if (!e) return PL.toast([].concat(list).join(' '), 'err'); e.classList.remove('hide'); e.innerHTML = PL.ic('alert-circle').s + ' ' + [].concat(list).map(PL.esc).join(' '); PL.icons(); };
  const warn = w => w && w.length ? PL.toast('Impor selesai dengan catatan: ' + w.slice(0, 2).join(' ') + (w.length > 2 ? ` (+${w.length - 2} lagi)` : ''), 'ok') : null;

  /* ---- panduan: ekspor dan impor ke draf ---- */
  PL.A['gx-open'] = () => {
    const pid = PL.bs && PL.bs.pid, p = PL.P(pid); if (!p) return;
    const g = PL.G(pid), editable = PLCore.isGuideEditable(p.stage);
    PL.modal({
      title: 'Ekspor dan impor panduan', wide: true,
      body: html`<div class="col" style="gap:18px">
        <section aria-labelledby="gx-h1"><h3 id="gx-h1" class="mb">${ic('download')} Ekspor</h3>
          <p class="small muted mb">Berkas panduan hanya berisi isi langkah. Tidak ada data anggota atau hasil praktik.</p>
          <label class="f mb">Versi<select id="gx-ver"><option value="draf">Draf saat ini</option>${[...g.versions].reverse().map(v => html`<option value="${v.v}">Versi ${v.v}</option>`)}</select></label>
          <div class="row"><button class="btn" data-act="gx-dl" data-fmt="md">${ic('file-text')} Markdown (.md)</button><button class="btn" data-act="gx-dl" data-fmt="json">${ic('braces')} JSON (.json)</button></div></section>
        <section aria-labelledby="gx-h2"><h3 id="gx-h2" class="mb">${ic('upload')} Impor ke draf</h3>
          <p class="small muted mb">${editable ? 'Isi draf saat ini akan diganti. Versi yang sudah terbit tidak berubah.' : 'Panduan terkunci selama praktik atau peninjauan berlangsung.'}</p>
          <label class="f">Berkas .md atau .json<input type="file" accept="${ACCEPT}" data-in="gx-file" data-ev="change" ${editable ? '' : raw('disabled')}></label>
          <div class="err-msg hide mt" id="gx-err" role="alert"></div></section></div>`,
      actions: [{ label: 'Tutup', cls: 'primary' }],
    });
  };
  PL.A['gx-dl'] = b => {
    const pid = PL.bs.pid, ver = PL.$('#gx-ver').value, doc = PLCore.guideDocOf(PL.S, pid, ver); if (!doc) return PL.toast('Versi tidak ditemukan.', 'err');
    const at = new Date().toISOString(), md = b.dataset.fmt === 'md', name = `${slug(doc.name)}-${ver === 'draf' ? 'draf' : 'v' + ver}.${md ? 'md' : 'json'}`;
    PL.download(name, md ? PLCore.guideToMarkdown(doc, at) : PLCore.guideToJson(doc, at), md ? 'text/markdown;charset=utf-8' : 'application/json');
    PL.toast('Panduan diekspor: ' + name);
  };
  PL.I['gx-file'] = async e => {
    const f = e.files[0]; if (!f) return;
    let text; try { text = await readFile(f); } catch (err) { return showErr('gx-err', err.message); }
    const pid = PL.bs.pid, probe = PLCore.parseGuideFile(text, () => 'x'); if (!probe.ok) return showErr('gx-err', probe.errors);
    PL.confirm('Ganti draf panduan?', `Draf saat ini diganti dengan ${probe.value.steps.length} langkah dari “${probe.value.name || f.name}”. Catatan isu yang menunjuk langkah lama tidak lagi tertaut ke langkah.`, () => {
      const r = PLCore.importGuideIntoDraft(PL.S, { now: () => new Date().toISOString(), uid: PL.uid }, PL.S.session.user, pid, text);
      if (!r.ok) { PL.toast(r.errors.join(' '), 'err'); return; }
      PL.bs.idx = 0; PL.save(); PL.toast(`Draf diganti (${probe.value.steps.length} langkah).`); warn(r.warnings); PL.rerender();
    }, { ok: 'Ganti draf' });
  };

  /* ---- proses baru dari berkas ---- */
  PL.A['gx-new'] = () => PL.modal({
    title: 'Impor panduan sebagai proses baru',
    body: html`<p class="small muted mb">Pilih berkas .md atau .json hasil ekspor ProofLoop. Proses baru dibuat sebagai draf; Anda menetapkan penerus dan reviewer sebelum menerbitkan.</p>
      <label class="f">Berkas<input type="file" accept="${ACCEPT}" data-in="gx-new-file" data-ev="change"></label><div class="err-msg hide mt" id="gxn-err" role="alert"></div>`,
    actions: [{ label: 'Batal' }],
  });
  PL.I['gx-new-file'] = async e => {
    const f = e.files[0]; if (!f) return;
    let text; try { text = await readFile(f); } catch (err) { return showErr('gxn-err', err.message); }
    const r = PLCore.createProcessFromGuideFile(PL.S, { now: () => new Date().toISOString(), uid: PL.uid }, PL.S.session.user, text);
    if (!r.ok) return showErr('gxn-err', r.errors);
    PL.log('mengimpor panduan ' + PL.P(r.pid).name, '#/proses/' + r.pid); PL.save(); PL.closeModal(); PL.toast('Proses dibuat dari berkas (draf).'); warn(r.warnings); PL.go('#/proses/' + r.pid + '/panduan');
  };

  /* ---- cadangan workspace ---- */
  PL.A['export-data'] = () => {
    const withHash = !!(PL.$('#exp-hash') && PL.$('#exp-hash').checked);
    PL.download('proofloop-cadangan.json', PLCore.workspaceToJson(PL.S, new Date().toISOString(), { includeHashes: withHash }), 'application/json');
    PL.toast(withHash ? 'Cadangan lengkap diekspor (termasuk hash kata sandi).' : 'Cadangan diekspor.');
  };
  PL.I['import-data'] = async e => {
    const f = e.files[0]; if (!f) return;
    let text; try { text = await readFile(f); } catch (err) { return showErr('imp-err', err.message); }
    const r = PLCore.parseWorkspaceJson(text); if (!r.ok) return showErr('imp-err', r.errors);
    const n = r.state;
    PL.confirm('Ganti seluruh data workspace?', `Semua data di peramban ini diganti dengan isi berkas: ${n.processes.length} proses, ${n.members.length} anggota, ${n.attempts.length} praktik. Tindakan ini tidak dapat dibatalkan; ekspor dulu bila perlu.`, () => {
      const a = PLCore.adoptImport(PL.S, n); PL.replace(a.state);
      PL.toast('Data diimpor.' + (a.lockedEmails.length ? ` ${a.lockedEmails.length} akun terkunci karena kata sandi tidak ikut diekspor.` : ''), 'ok'); warn(r.warnings);
      PL.go(PL.S.session.user ? '#/beranda' : '#/masuk');
    }, { ok: 'Ganti data', danger: true });
  };
})(window.PL);
