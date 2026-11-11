/* ProofLoop — auth, onboarding & shell actions. © 2026 Vassel Goleyu. */
(function (PL) {
  const { html, ic, raw, esc } = PL;
  const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('proofloop:' + s)))].map(b => b.toString(16).padStart(2, '0')).join('');
  const authWrap = (inner) => html`<div class="auth"><div class="auth-l"><div class="auth-top"><a class="logo" href="#/">${PL.logo(30)}<span>Proof<b>Loop</b></span></a><button class="icon-btn themebtn" data-act="theme" aria-label="Ganti tema terang atau gelap" title="Tema">${ic(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')}</button></div><div class="auth-form">${inner}</div><p class="tiny muted">© 2026 ProofLoop · Vassel Goleyu</p></div>
    <aside class="auth-r" aria-hidden="true"><div class="auth-copy"><h2>Kerja tetap berjalan, meski orang berganti.</h2><p>Bukan sekadar dokumen yang tersimpan, tetapi bukti bahwa penerus benar-benar bisa melanjutkan pekerjaannya.</p></div>
      <div class="proof"><div class="row between"><b>Publikasi Kegiatan Mingguan</b><span class="chip ok">${ic('check-circle-2')} Mandiri</span></div>
        <div class="proof-cmp"><div><span class="tiny muted">Cycle 1 · panduan v1.0</span><div class="pn">2</div><span class="small">kejadian bantuan</span></div><span class="proof-arrow">${ic('arrow-right')}</span><div><span class="tiny muted">Cycle 2 · panduan v1.1</span><div class="pn ok">0</div><span class="small">kejadian bantuan</span></div></div>
        <ul class="proof-list"><li>${ic('check')} Panduan kerja terdokumentasi</li><li>${ic('check')} Kriteria wajib terpenuhi</li><li>${ic('check')} Tanpa intervensi langsung</li><li>${ic('check')} Diverifikasi reviewer</li></ul><p class="tiny muted" style="margin-top:12px">Contoh tampilan · data demonstrasi</p></div></aside></div>`;
  const err = (id) => html`<div class="err-msg hide" id="${id}" role="alert"></div>`;
  const showErr = (id, m) => { const e = PL.$('#' + id); if (e) { e.classList.toggle('hide', !m); e.innerHTML = m ? PL.ic('alert-circle').s + ' ' + esc(m) : ''; PL.icons(); } };
  const busy = (b, on) => { b.disabled = on; b.dataset.l = b.dataset.l || b.innerHTML; b.innerHTML = on ? '<span class="spin"></span> Memproses…' : b.dataset.l; };
  const pw = (name, label, extra = '') => html`<label class="f">${label}<span style="position:relative;display:block"><input type="password" name="${name}" autocomplete="${name === 'password' ? 'current-password' : 'new-password'}" required style="padding-right:44px" ${raw(extra)}><button type="button" class="icon-btn" data-act="toggle-pw" aria-label="Tampilkan atau sembunyikan kata sandi" style="position:absolute;right:2px;top:1px">${ic('eye')}</button></span></label>`;
  const bad = (f, n) => f.querySelector(`[name=${n}]`).classList.add('invalid');
  const clr = f => f.querySelectorAll('.invalid').forEach(x => x.classList.remove('invalid'));
  PL.A['toggle-pw'] = b => { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; };

  PL.route('/masuk', () => ({ layout: 'auth', guest: 'redirect', title: 'Masuk', body: authWrap(html`<h1>Selamat datang kembali.</h1><p class="muted" style="margin:6px 0 24px">Masuk ke workspace organisasi Anda.</p>
    <form class="col" data-form="login" novalidate style="gap:14px"><label class="f">Email<input type="email" name="email" autocomplete="email" required placeholder="nama@organisasi.id"></label>${pw('password', 'Kata sandi')}
    <div class="row between"><label class="check small"><input type="checkbox" name="remember" checked> Ingat saya</label><a href="#/lupa-sandi" class="small">Lupa kata sandi?</a></div>${err('lerr')}
    <button class="btn primary lg" type="submit">Masuk</button></form>
<div class="divider"><span>atau masuk dengan akun demo</span></div><div class="col" style="gap:8px">${[['nadia@ruangaksi.id', 'Nadia Putri', 'Pemegang pengetahuan · Admin'], ['raka@ruangaksi.id', 'Raka Pratama', 'Penerus'], ['dimas@ruangaksi.id', 'Dimas Mahendra', 'Reviewer']].map(([e, n, r]) => html`<button type="button" class="demo-acc" data-act="demo-as" data-email="${e}"><span class="avatar">${PL.initials(n)}</span><span class="grow"><b style="display:block">${n}</b><span class="small muted">${r}</span></span>${ic('arrow-right', 'muted')}</button>`)}</div><p class="tiny muted mt">Akun demo memakai kata sandi <code>demo1234</code> dan data fiktif.</p>
    <p class="small muted center mt2">Belum punya akun? <a href="#/daftar">Buat akun</a></p>` ) }));
  // Workspace hasil daftar tidak punya akun demo (m1); minta persetujuan sebelum menimpanya dengan data demo.
  const withDemo = fn => PL.M('m1') ? fn() : PL.confirm('Ganti dengan data demo?', 'Workspace yang Anda buat di peramban ini akan diganti dengan data demo Ruang Aksi Kampus.', () => { PL.reset(); fn(); }, { ok: 'Ganti dengan data demo', danger: true });
  PL.A['demo-as'] = b => { const f = PL.$('[data-form=login]'); withDemo(() => { f.email.value = b.dataset.email; f.password.value = 'demo1234'; PL.F.login(f); }); };
  PL.A['demo-login'] = () => withDemo(() => { if (!PL.S.session.user) PL.S.session.user = 'm1'; PL.save(); PL.go('#/beranda'); });
  PL.F.login = async f => {
    clr(f); showErr('lerr', ''); const d = PL.fd(f), b = f.querySelector('[type=submit]');
    if (!/^\S+@\S+\.\S+$/.test(d.email)) { bad(f, 'email'); return showErr('lerr', 'Masukkan alamat email yang valid, misalnya nama@organisasi.id.'); }
    if (!d.password) { bad(f, 'password'); return showErr('lerr', 'Kata sandi wajib diisi.'); }
    busy(b, true); await new Promise(r => setTimeout(r, 600));
    const m = PL.S.members.find(x => x.email.toLowerCase() === d.email.toLowerCase());
    const ok = m && (m.pwHash ? m.pwHash === await sha(d.password) : d.password === 'demo1234');
    if (!ok) { busy(b, false); bad(f, 'email'); bad(f, 'password'); return showErr('lerr', 'Email atau kata sandi tidak cocok. Periksa kembali atau gunakan akun demo di bawah.'); }
    PL.S.session.user = m.id; m.last = new Date().toISOString(); PL.save();
    const nx = sessionStorage.getItem('pl.next'); sessionStorage.removeItem('pl.next');
    PL.toast('Selamat datang, ' + m.name.split(' ')[0] + '.'); PL.go(PL.S.onboarding ? '#/onboarding' : nx || '#/beranda');
  };
  PL.route('/daftar', () => ({ layout: 'auth', guest: 'redirect', title: 'Buat Akun', body: authWrap(html`<h1>Buat akun ProofLoop</h1><p class="muted" style="margin:8px 0 18px">Mulai membangun sistem kerja yang bisa diteruskan.</p>
    <form class="col" data-form="register" novalidate style="gap:13px"><label class="f">Nama lengkap<input type="text" name="name" autocomplete="name" required></label><label class="f">Email organisasi<input type="email" name="email" autocomplete="email" required></label>
    ${pw('password', 'Kata sandi', 'minlength="6"')}${pw('confirm', 'Konfirmasi kata sandi')}<label class="f">Nama organisasi<input type="text" name="org" required></label>
    <label class="check small"><input type="checkbox" name="agree"> <span>Saya menyetujui <button type="button" class="btn ghost sm" style="padding:0;min-height:0;display:inline" data-act="legal" data-k="terms">Syarat Layanan</button> dan <button type="button" class="btn ghost sm" style="padding:0;min-height:0;display:inline" data-act="legal" data-k="privacy">Kebijakan Privasi</button>.</span></label>${err('rerr')}
    <div class="banner warn small">${ic('alert-triangle')}<span>Prototipe tanpa server: membuat akun akan membuat workspace baru yang kosong di peramban ini dan menggantikan data demo. Data demo dapat dipulihkan dari menu akun.</span></div>
    <button class="btn primary lg" type="submit">Buat Akun</button></form><p class="small muted center mt">Sudah punya akun? <a href="#/masuk">Masuk</a></p>`) }));
  PL.F.register = async f => {
    clr(f); showErr('rerr', ''); const d = PL.fd(f), b = f.querySelector('[type=submit]');
    const E = (n, m) => { bad(f, n); showErr('rerr', m); };
    if (d.name.trim().length < 2) return E('name', 'Nama lengkap wajib diisi.');
    if (!/^\S+@\S+\.\S+$/.test(d.email)) return E('email', 'Masukkan email organisasi yang valid.');
    if (d.password.length < 6) return E('password', 'Kata sandi minimal 6 karakter.');
    if (d.password !== d.confirm) return E('confirm', 'Konfirmasi kata sandi tidak sama.');
    if (!d.org.trim()) return E('org', 'Nama organisasi wajib diisi.');
    if (!d.agree) return showErr('rerr', 'Anda perlu menyetujui Syarat Layanan dan Kebijakan Privasi.');
    busy(b, true); const h = await sha(d.password); await new Promise(r => setTimeout(r, 600));
    PL.replace(PL.blank(d.name.trim(), d.email.trim(), d.org.trim())); PL.S.members[0].pwHash = h; PL.save();
    PL.wz = null; PL.toast('Akun dibuat. Mari siapkan workspace Anda.'); PL.go('#/onboarding');
  };
  PL.route('/lupa-sandi', () => ({ layout: 'auth', title: 'Lupa Kata Sandi', body: authWrap(html`<div id="fp"><h1>Atur ulang kata sandi</h1><p class="muted" style="margin:8px 0 22px">Masukkan email akun Anda untuk menerima tautan pengaturan ulang.</p>
    <form class="col" data-form="forgot" novalidate><label class="f">Email<input type="email" name="email" required></label>${err('ferr')}<button class="btn primary lg" type="submit">Kirim Tautan Reset</button></form></div><p class="small center mt2"><a href="#/masuk">${ic('arrow-left')} Kembali ke halaman masuk</a></p>`) }));
  PL.F.forgot = async f => {
    clr(f); showErr('ferr', ''); const d = PL.fd(f), b = f.querySelector('[type=submit]');
    if (!/^\S+@\S+\.\S+$/.test(d.email)) { bad(f, 'email'); return showErr('ferr', 'Masukkan alamat email yang valid.'); }
    busy(b, true); await new Promise(r => setTimeout(r, 900));
    PL.$('#fp').innerHTML = html`<div class="banner ok" style="margin-bottom:16px">${ic('check-circle-2')}<div><b>Permintaan diterima</b><p class="small">Jika <b>${d.email}</b> terdaftar, tautan pengaturan ulang akan dikirim. <i>Catatan prototipe: tidak ada email yang benar-benar dikirim karena belum ada server.</i></p></div></div><a class="btn primary" href="#/masuk">Kembali ke Masuk</a>`.s; PL.icons();
  };

  /* onboarding */
  PL.TEMPLATES = {
    'Publikasi Kegiatan': { cat: 'Komunikasi', desc: 'Menyiapkan dan menerbitkan informasi kegiatan melalui kanal resmi.', steps: [['Verifikasi informasi kegiatan', 'Pastikan nama, jadwal, lokasi, dan tautan pendaftaran terkonfirmasi.'], ['Buat materi visual', 'Gunakan template resmi organisasi.'], ['Tulis caption dan terbitkan', 'Tulis caption lengkap lalu terbitkan di kanal resmi.']] },
    'Onboarding Relawan': { cat: 'Human Resources', desc: 'Menyambut relawan baru dan menyiapkan mereka bekerja.', steps: [['Catat data relawan', 'Simpan data kontak dan minat relawan.'], ['Tambahkan ke kanal komunikasi', 'Masukkan relawan ke grup yang sesuai.'], ['Kirim panduan orientasi', 'Kirim dokumen orientasi dan jadwal pengenalan.']] },
    'Pengelolaan Inventaris Acara': { cat: 'Operasional', desc: 'Mencatat, memeriksa, dan mengembalikan perlengkapan acara.', steps: [['Susun daftar perlengkapan', 'Daftar semua barang yang dibutuhkan acara.'], ['Periksa kondisi barang', 'Cek kondisi sebelum dan sesudah acara.'], ['Kembalikan dan catat', 'Kembalikan ke tempat penyimpanan dan perbarui catatan.']] },
    'Administrasi Kegiatan': { cat: 'Administrasi', desc: 'Menyusun surat izin, daftar hadir, dan arsip kegiatan.', steps: [['Siapkan surat izin', 'Isi template surat izin kegiatan.'], ['Siapkan daftar hadir', 'Salin template dan isi data kegiatan.'], ['Arsipkan dokumen', 'Simpan semua dokumen ke folder arsip.']] }
  };
  PL.createFromTemplate = (key, ownerId) => {
    const t = PL.TEMPLATES[key], id = PL.uid('p');
    PL.S.processes.push({ id, name: key, description: t.desc, category: t.cat, purpose: '', frequency: 'Mingguan', duration: 45, importance: 'Medium', ownerId, successorId: '', reviewerId: '', expected: '', deliverables: '', quality: [{ id: PL.uid('q'), text: 'Hasil sesuai deskripsi proses', mandatory: true }], resources: { files: '', equipment: '', software: '', access: '', refs: '' }, stage: 'draft', cycle: 1, deadline: PL.iso(14), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), draft: true, seed: false });
    PL.S.guides[id] = { draft: t.steps.map(([a, b]) => PL.newStep(a, { what: b })), versions: [] }; return id;
  };
  const wz = () => PL.wz || (PL.wz = { step: 1, name: PL.S.org.name, type: 'Organisasi Kampus', size: '1–10 anggota', desc: '', logo: '', obj: '', invites: [], tpl: 'Publikasi Kegiatan' });
  const OBJ = ['Mengurangi ketergantungan pada anggota tertentu', 'Memperbaiki proses serah terima', 'Menjaga pengetahuan operasional', 'Mempermudah pergantian relawan', 'Memastikan anggota baru mampu menjalankan pekerjaan'];
  PL.route('/onboarding', () => {
    const w = wz(), titles = ['Informasi Organisasi', 'Tujuan Utama', 'Undang Anggota', 'Proses Pertama'];
    const body = [
      html`<div class="grid g2">${PL.field('Nama organisasi', 'name', { v: w.name, req: 1 })}<label class="f">Jenis organisasi<select name="type" data-in="ob">${['Komunitas', 'Organisasi Kampus', 'NGO / Organisasi Sosial', 'Yayasan', 'Program Relawan', 'Lainnya'].map(o => html`<option ${o === w.type ? raw('selected') : ''}>${o}</option>`)}</select></label></div><div class="grid g2 mt"><label class="f">Ukuran organisasi<select name="size" data-in="ob">${['1–10 anggota', '11–30 anggota', '31–100 anggota', 'Lebih dari 100 anggota'].map(o => html`<option ${o === w.size ? raw('selected') : ''}>${o}</option>`)}</select></label>
        <label class="f">Logo (opsional)<input type="file" accept="image/*" data-in="ob-logo" aria-label="Unggah logo"><span class="hint">${w.logo ? 'Dipilih: ' + w.logo : 'Hanya nama berkas yang disimpan pada prototipe ini.'}</span></label></div><div class="mt">${PL.field('Deskripsi', 'desc', { type: 'textarea', v: w.desc, ph: 'Apa yang dilakukan organisasi Anda?' })}</div>`,
      html`<p class="b">Apa yang paling ingin dijaga oleh organisasi Anda?</p><div class="col mt" role="radiogroup">${OBJ.map(o => html`<button type="button" class="choice ${w.obj === o ? 'on' : ''}" role="radio" aria-checked="${w.obj === o}" data-act="ob-obj" data-v="${o}">${ic(w.obj === o ? 'check-circle-2' : 'circle')}<span class="b">${o}</span></button>`)}</div>`,
      html`<p class="muted small">Undang pemegang pengetahuan, penerus, atau reviewer melalui email. Prototipe: undangan disimulasikan dan tidak dikirim lewat email.</p><div class="row mt" style="align-items:flex-end;gap:10px"><label class="f grow">Email<input type="email" id="ie" placeholder="nama@organisasi.id"></label><label class="f">Peran<select id="ir">${['Pemegang Pengetahuan', 'Penerus', 'Reviewer'].map(r => html`<option>${r}</option>`)}</select></label><button class="btn primary" type="button" data-act="ob-invite">${ic('user-plus')} Tambah</button></div><div class="err-msg hide" id="ierr"></div>
        <div class="col mt">${w.invites.length ? w.invites.map((v, i) => html`<div class="card flat row between" style="padding:10px 14px"><span>${v.email} <span class="chip info">${v.role}</span> <span class="chip warn">Menunggu</span></span><button class="btn sm ghost" data-act="ob-uninvite" data-i="${i}" aria-label="Batalkan undangan ${v.email}">${ic('x')}</button></div>`) : html`<p class="muted small">Belum ada undangan. Anda dapat melewati langkah ini.</p>`}</div>`,
      html`<p class="b">Mulai dengan template proses</p><div class="grid g2 mt">${Object.keys(PL.TEMPLATES).map(k => html`<button type="button" class="choice ${w.tpl === k ? 'on' : ''}" data-act="ob-tpl" data-v="${k}">${ic('file-text')}<span><b>${k}</b><span class="small muted" style="display:block">${PL.TEMPLATES[k].desc}</span></span></button>`)}</div><button class="btn ghost sm mt" data-act="ob-tpl" data-v="">Lewati, saya akan membuat sendiri</button>`
    ][w.step - 1];
    return { layout: 'wiz', title: 'Onboarding', body: html`<div class="wiz"><a class="logo" href="#/beranda">${PL.logo(32)}<span>Proof<b>Loop</b></span></a><div class="wiz-steps" aria-label="Langkah ${w.step} dari 4">${[1, 2, 3, 4].map(i => html`<i class="${i <= w.step ? 'on' : ''}"></i>`)}</div><span class="chip info">Langkah ${w.step} dari 4</span><h1 style="margin:10px 0 18px">${titles[w.step - 1]}</h1><div class="card">${body}${err('oerr')}</div>
      <div class="row between mt2"><button class="btn" data-act="ob-back" ${w.step === 1 ? raw('disabled') : ''}>${ic('arrow-left')} Kembali</button><button class="btn primary" data-act="ob-next">${w.step === 4 ? 'Mulai Workspace' : 'Lanjut'} ${ic(w.step === 4 ? 'rocket' : 'arrow-right')}</button></div></div>` };
  }, { auth: true });
  const sync = () => { const w = wz(); PL.$$('.card [name]').forEach(e => { if (e.type !== 'file') w[e.name] = e.value; }); };
  PL.I.ob = sync; PL.I['ob-logo'] = e => { wz().logo = e.files[0] ? e.files[0].name : ''; PL.rerender(); };
  PL.A['ob-obj'] = b => { sync(); wz().obj = b.dataset.v; PL.rerender(); };
  PL.A['ob-tpl'] = b => { wz().tpl = b.dataset.v; PL.rerender(); };
  PL.A['ob-invite'] = () => { const e = PL.$('#ie').value.trim(), r = PL.$('#ir').value, w = wz(); sync(); if (!/^\S+@\S+\.\S+$/.test(e)) return showErr('ierr', 'Masukkan email yang valid.'); if (w.invites.some(v => v.email === e)) return showErr('ierr', 'Email ini sudah diundang.'); w.invites.push({ email: e, role: r }); PL.rerender(); };
  PL.A['ob-uninvite'] = b => { wz().invites.splice(+b.dataset.i, 1); PL.rerender(); };
  PL.A['ob-back'] = () => { sync(); wz().step--; PL.rerender(); };
  PL.A['ob-next'] = () => {
    const w = wz(); sync();
    if (w.step === 1 && !w.name.trim()) return showErr('oerr', 'Nama organisasi wajib diisi.');
    if (w.step === 2 && !w.obj) return showErr('oerr', 'Pilih satu tujuan utama untuk melanjutkan.');
    if (w.step < 4) { w.step++; return PL.rerender(); }
    Object.assign(PL.S.org, { name: w.name.trim(), type: w.type, size: w.size, description: w.desc, objective: w.obj });
    w.invites.forEach(v => PL.S.invites.push({ id: PL.uid('iv'), email: v.email, role: v.role, status: 'Menunggu', at: new Date().toISOString() }));
    let pid = null; if (w.tpl) pid = PL.createFromTemplate(w.tpl, PL.S.session.user);
    PL.S.onboarding = false; PL.log('menyiapkan workspace ' + PL.S.org.name, '#/beranda'); PL.save(); PL.wz = null;
    PL.toast('Workspace siap!'); PL.go(pid ? '#/proses/' + pid : '#/beranda');
  };

  /* shell actions */
  PL.A['nav-open'] = () => { PL.ui.nav = true; PL.$('#sb').classList.add('open'); if (!PL.$('.scrim')) { const s = document.createElement('div'); s.className = 'scrim'; s.dataset.act = 'nav-close'; PL.$('.shell').appendChild(s); } };
  PL.A['nav-close'] = () => { PL.ui.nav = false; const s = PL.$('#sb'); s && s.classList.remove('open'); const c = PL.$('.scrim'); c && c.remove(); };
  PL.A['pop-notif'] = () => PL.pop('notif'); PL.A['pop-me'] = () => PL.pop('me');
  PL.A['notif-open'] = b => { const n = PL.S.notifications.find(x => x.id === b.dataset.id); if (n) { n.read = true; PL.save(); } PL.ui.pop = null; const h = PL.$('#pop'); h && (h.innerHTML = ''); if (location.hash === b.getAttribute('href')) PL.rerender(); };
  PL.A['search-toggle'] = () => { const s = PL.$('#search'); s.classList.toggle('show'); s.querySelector('input').focus(); };
  PL.A['switch-user'] = b => { PL.S.session.user = b.dataset.id; PL.ui.pop = null; PL.resetUi(); PL.save(); PL.toast('Masuk sebagai ' + PL.name(b.dataset.id)); PL.rerender(); };
  PL.A.logout = () => { PL.S.session.user = null; PL.ui.pop = null; PL.resetUi(); PL.save(); PL.toast('Anda telah keluar.'); PL.go('#/'); };
  PL.A['reset-demo'] = () => PL.confirm('Reset data demo?', 'Seluruh perubahan di peramban ini akan diganti dengan data demo Ruang Aksi Kampus.', () => { const u = 'm1'; PL.reset(); PL.S.session.user = u; PL.save(); PL.toast('Data demo dipulihkan.'); PL.go('#/beranda'); PL.render(); }, { ok: 'Reset', danger: true });
  PL.A['org-info'] = () => PL.modal({ title: PL.S.org.name, body: html`<dl class="kv"><dt>Jenis</dt><dd>${PL.S.org.type || '—'}</dd><dt>Ukuran</dt><dd>${PL.S.org.size || '—'}</dd><dt>Anggota</dt><dd>${PL.S.members.length}</dd><dt>Deskripsi</dt><dd>${PL.S.org.description || '—'}</dd></dl><p class="small muted mt">Prototipe ini mendukung satu workspace per peramban.</p>`, actions: [{ label: 'Tutup' }, { label: 'Pengaturan organisasi', cls: 'primary', fn: () => PL.go('#/pengaturan') }] });
  PL.A.help = () => PL.modal({ title: 'Pusat Bantuan', body: html`<div class="col"><div><b>Bagaimana alur ProofLoop?</b><p class="small muted">Dokumentasi → Cycle 1 → Perbaikan → Cycle 2 → Verifikasi.</p></div><div><b>Apa itu "bantuan"?</b><p class="small muted">Coaching langsung atau demonstrasi dari orang lain. Membaca panduan dan memakai alat biasa bukan bantuan.</p></div><div><b>Mencoba alur lengkap</b><p class="small muted">Gunakan menu akun untuk berganti peran demo: Nadia (pemilik), Raka (penerus), Dimas (reviewer).</p></div></div>`, actions: [{ label: 'Mengerti', cls: 'primary' }] });
  PL.I.search = e => {
    const q = e.value.trim().toLowerCase(); PL.ui.q = e.value; let box = PL.$('#sres'); if (!box) { box = document.createElement('div'); box.id = 'sres'; box.className = 'pop'; PL.$('#search').appendChild(box); }
    if (!q) { box.remove(); return; }
    const r = [...PL.S.processes.filter(p => (p.name + p.description + p.category).toLowerCase().includes(q)).map(p => [`#/proses/${p.id}`, 'workflow', p.name, p.category]), ...PL.S.members.filter(m => (m.name + m.email).toLowerCase().includes(q)).map(m => [`#/tim/${m.id}`, 'user', m.name, m.email]), ...PL.S.notifications.filter(n => n.to === PL.S.session.user && (n.title + n.body).toLowerCase().includes(q)).map(n => [n.route, 'bell', n.title, 'Notifikasi'])].slice(0, 8);
    box.innerHTML = r.length ? r.map(([h, i, t, s]) => `<a href="${esc(h)}" data-act="search-pick">${ic(i).s}<span><b class="small" style="display:block">${esc(t)}</b><span class="tiny muted">${esc(s)}</span></span></a>`).join('') : `<div class="empty" style="padding:18px">Tidak ada hasil untuk “${esc(e.value)}”.</div>`; PL.icons();
  };
  PL.A['search-pick'] = () => { PL.ui.q = ''; const b = PL.$('#sres'); b && b.remove(); const i = PL.$('#q'); i && (i.value = ''); };
})(window.PL);
