/* ProofLoop — bukti per langkah (teks/foto) dan komentar reviewer. Aturan ada di PLCore (src/domain/evidence.ts). © 2026 Vassel Goleyu. */
(function (PL) {
  const { html, ic, raw } = PL;
  const ctx = () => ({ now: () => new Date().toISOString(), uid: PL.uid });
  const att = id => PL.S.attempts.find(x => x.id === id);
  const verSteps = a => { const v = PL.G(a.pid).versions.find(x => x.v === a.guideVersion); return v ? v.steps : []; };
  const stepLabel = (a, sid) => { const st = verSteps(a), i = st.findIndex(x => x.id === sid); return i >= 0 ? `Langkah ${i + 1}: ${st[i].title}` : 'Umum'; };

  /* ---- penerus: bukti pada langkah yang sedang dipraktikkan ---- */
  PL.evidenceBox = (a, s) => {
    const ev = (a.stepEvidence || {})[s.id], need = !!s.needsEvidence;
    return html`<div class="card flat mt" style="padding:14px"><div class="row between"><b>Bukti langkah</b><span class="chip ${need ? 'warn' : ''}">${need ? 'Wajib' : 'Opsional'}</span></div>
      <label class="f mt">Catatan bukti (mis. apa yang terlihat setelah langkah selesai)<textarea rows="2" maxlength="5000" data-in="ev-text" data-ev="input" data-aid="${a.id}" data-sid="${s.id}">${ev ? ev.text : ''}</textarea></label>
      ${ev && ev.photo ? html`<figure style="margin:10px 0 0"><img src="${ev.photo.dataUrl}" alt="Foto bukti: ${ev.photo.name}" style="max-width:100%;max-height:220px;border-radius:8px;border:1px solid var(--border)"><figcaption class="tiny muted">${ev.photo.name} <button type="button" class="btn ghost sm" data-act="ev-rmphoto" data-aid="${a.id}" data-sid="${s.id}">${ic('x')} Hapus foto</button></figcaption></figure>`
        : html`<label class="btn sm mt" tabindex="0">${ic('camera')} Tambah foto<input type="file" accept="image/png,image/jpeg,image/webp" class="sr" data-in="ev-photo" data-ev="change" data-aid="${a.id}" data-sid="${s.id}"></label>`}
      <p class="tiny muted mt">Foto diperkecil dan disimpan hanya di peramban ini (bukan di server).</p></div>`;
  };
  const save = (el, photo) => {
    const a = att(el.dataset.aid), cur = (a.stepEvidence || {})[el.dataset.sid];
    const text = photo === undefined && el.tagName === 'TEXTAREA' ? el.value : (cur ? cur.text : '');
    const r = PLCore.setStepEvidence(PL.S, ctx(), PL.S.session.user, a.id, el.dataset.sid, { text, photo: photo === undefined ? (cur && cur.photo) : photo });
    if (!r.ok) { PL.toast(r.errors.join(' '), 'err'); return false; }
    PL.save(); return true;
  };
  PL.I['ev-text'] = e => save(e);
  PL.A['ev-rmphoto'] = b => { if (save(b, null)) PL.rerender(); };
  // Perkecil gambar di kanvas: maks 800 px, JPEG. Menjaga kuota localStorage.
  const shrink = file => new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); let w = img.width, h = img.height; const k = Math.min(1, 800 / Math.max(w, h)); w = Math.round(w * k); h = Math.round(h * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
      for (const q of [0.7, 0.5, 0.35]) { const d = c.toDataURL('image/jpeg', q); if (d.length <= PLCore.MAX_PHOTO_CHARS) return res(d); }
      rej(new Error('Foto terlalu besar bahkan setelah diperkecil.')); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Berkas bukan gambar yang dapat dibaca.')); }; img.src = url;
  });
  PL.I['ev-photo'] = async e => {
    const f = e.files[0]; if (!f) return;
    try { const d = await shrink(f); if (save(e, { name: f.name.replace(/\.[^.]+$/, '') + '.jpg', dataUrl: d })) PL.rerender(); }
    catch (err) { PL.toast(err.message, 'err'); }
  };

  /* ---- reviewer: bukti per langkah + komentar ---- */
  PL.commentItem = (a, c, canDel) => html`<div class="card flat" style="padding:8px 12px"><div class="tiny muted">${PL.name(c.authorId)} · ${PL.fmtDT(c.at)} · ${stepLabel(a, c.stepId)}</div><p class="small" style="white-space:pre-wrap">${c.text}</p>${canDel ? html`<button class="btn ghost sm" data-act="cm-del" data-aid="${a.id}" data-id="${c.id}">${ic('trash-2')} Hapus</button>` : ''}</div>`;
  PL.reviewSteps = (a, p) => {
    const steps = verSteps(a), me = PL.S.session.user, isRev = me === p.reviewerId, cms = a.comments || [], editable = a.status === 'submitted';
    return html`<div class="card mt"><div class="card-h"><h3>${ic('message-square-text')} Bukti dan komentar per langkah</h3></div>
      <p class="small muted mb">Komentar tampil bagi penerus dan pemegang pengetahuan, dan masuk ke bahan perbaikan panduan. Komentar bukan bagian dari klasifikasi hasil.</p>
      <div class="col" style="gap:14px">${steps.map((s, i) => { const ev = (a.stepEvidence || {})[s.id], mine = cms.filter(c => c.stepId === s.id);
        return html`<div class="card flat" style="padding:12px 14px"><div class="row between"><b>${i + 1}. ${s.title}</b>${s.needsEvidence ? html`<span class="chip ${ev ? 'ok' : 'err'}">${ev ? 'Bukti ada' : 'Bukti wajib belum ada'}</span>` : ev ? html`<span class="chip ok">Bukti ada</span>` : ''}</div>
          ${ev ? html`${ev.text ? html`<p class="small mt" style="white-space:pre-wrap">${ev.text}</p>` : ''}${ev.photo ? html`<img src="${ev.photo.dataUrl}" alt="Foto bukti langkah ${i + 1}" style="max-width:100%;max-height:240px;border-radius:8px;border:1px solid var(--border);margin-top:8px">` : ''}` : html`<p class="tiny muted mt">Tidak ada bukti dilampirkan.</p>`}
          <div class="col mt" style="gap:6px">${mine.map(c => PL.commentItem(a, c, isRev && c.authorId === me && editable))}</div>
          ${isRev ? html`<div class="row mt" style="flex-wrap:nowrap;align-items:flex-end"><label class="f grow">Komentar untuk langkah ini<textarea rows="2" id="cm-${s.id}" maxlength="3000"></textarea></label><button class="btn" data-act="cm-add" data-aid="${a.id}" data-sid="${s.id}">${ic('send')} Kirim</button></div>` : ''}</div>`; })}
        ${cms.filter(c => !c.stepId).map(c => PL.commentItem(a, c, isRev && c.authorId === me && editable))}
        ${isRev ? html`<div class="row" style="flex-wrap:nowrap;align-items:flex-end"><label class="f grow">Komentar umum<textarea rows="2" id="cm-general" maxlength="3000"></textarea></label><button class="btn" data-act="cm-add" data-aid="${a.id}" data-sid="">${ic('send')} Kirim</button></div>` : ''}</div></div>`;
  };
  PL.A['cm-add'] = b => {
    const box = PL.$('#cm-' + (b.dataset.sid || 'general')), r = PLCore.addComment(PL.S, ctx(), PL.S.session.user, b.dataset.aid, b.dataset.sid, box ? box.value : '');
    if (!r.ok) return PL.toast(r.errors.join(' '), 'err');
    PL.save(); PL.toast('Komentar disimpan.'); PL.rerender();
  };
  PL.A['cm-del'] = b => { const r = PLCore.deleteComment(PL.S, PL.S.session.user, b.dataset.aid, b.dataset.id); if (!r.ok) return PL.toast(r.errors.join(' '), 'err'); PL.save(); PL.rerender(); };

  /* ---- pemegang pengetahuan dan penerus: komentar terbaru ---- */
  PL.commentsCard = pid => {
    const a = PL.attemptsOf(pid).filter(x => x.status !== 'progress' && (x.comments || []).length).pop();
    if (!a) return '';
    return html`<div class="card"><div class="card-h"><h3>${ic('message-square-text')} Komentar reviewer</h3><span class="chip">Siklus ${a.cycle} · v${a.guideVersion}</span></div><div class="col" style="gap:8px">${a.comments.map(c => PL.commentItem(a, c, false))}</div></div>`;
  };
})(window.PL);
