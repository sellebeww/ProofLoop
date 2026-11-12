/* ProofLoop — state, seed data & domain logic. © 2026 Vassel Goleyu. */
window.PL = window.PL || {};
(function (PL) {
  const KEY = 'proofloop.v1';
  const uid = p => p + Math.random().toString(36).slice(2, 9);
  const iso = (d = 0, h = 9, m = 0) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return x.toISOString(); };
  PL.uid = uid; PL.iso = iso;

  PL.CATS = ['Komunikasi', 'Human Resources', 'Operasional', 'Administrasi', 'Keuangan'];
  PL.ROLES = ['Administrator', 'Pemegang Pengetahuan', 'Penerus', 'Reviewer'];
  PL.CAUSES = ['Instruksi tidak jelas', 'Langkah belum ada', 'File atau sumber daya belum tersedia', 'Aturan keputusan belum didokumentasikan', 'Penerus kurang konteks', 'Butuh pengetahuan praktik tambahan', 'Situasi tak terduga'];
  PL.ISSUE_KINDS = PLCore.ISSUE_KINDS;
  PL.ASSIST_TYPES = PLCore.ASSIST_TYPES;
  PL.STATUS = {
    mandiri: { t: 'Mandiri', cls: 'ok', ic: 'check-circle-2' },
    test: { t: 'Dalam Pengujian', cls: 'info', ic: 'loader' },
    fix: { t: 'Perlu Perbaikan', cls: 'warn', ic: 'alert-triangle' },
    none: { t: 'Belum Ditransfer', cls: '', ic: 'circle-dashed' }
  };
  PL.OUTCOME = {
    mandiri: { t: 'Mandiri', cls: 'ok', ic: 'check-circle-2', d: 'Memenuhi seluruh kriteria wajib dan selesai tanpa intervensi manusia secara langsung.' },
    dengan_bantuan: { t: 'Dengan Bantuan', cls: 'warn', ic: 'life-buoy', d: 'Berhasil diselesaikan, tetapi memerlukan bantuan manusia secara langsung.' },
    belum: { t: 'Belum Berhasil', cls: 'err', ic: 'x-circle', d: 'Hasil belum memenuhi output atau standar kualitas kritis.' }
  };

  const step = (title, o = {}) => ({ id: uid('st'), title, what: '', why: '', prepare: '', how: '', success: '', risk: '', fallback: '', critical: false, warning: '', example: '', checklist: '', decision: '', files: [], needsEvidence: false, ...o });
  PL.newStep = step;
  const qc = list => list.map(t => ({ id: uid('q'), text: t.replace(/^\(opsional\)\s*/, ''), mandatory: !/^\(opsional\)/.test(t) }));

  function guide1_0() {
    return [
      step('Verifikasi Informasi Kegiatan', { critical: true, what: 'Pastikan semua informasi kegiatan telah dikonfirmasi sebelum materi publikasi dibuat.', why: 'Informasi yang salah dan sudah terbit sulit ditarik kembali dan membingungkan peserta.', prepare: 'Nama kegiatan\nTanggal dan waktu\nLokasi\nTautan pendaftaran\nNarahubung', how: 'Buka lembar rencana kegiatan, lalu cocokkan kelima data di atas dengan koordinator program.', success: 'Seluruh informasi wajib terkonfirmasi dan tidak ada kolom penting yang kosong.', risk: 'Detail kegiatan masih menunggu konfirmasi.', fallback: 'Jangan terbitkan sebelum koordinator program mengonfirmasi informasi yang kurang.', warning: 'Jangan menebak jadwal atau lokasi.' }),
      step('Buat Materi Visual', { critical: true, what: 'Buat poster kegiatan menggunakan template resmi organisasi.', why: 'Materi visual yang konsisten menjaga identitas organisasi.', prepare: 'Template poster (Canva)\nLogo organisasi\nPedoman identitas visual', how: 'Duplikat template, ganti judul, tanggal, lokasi, dan logo mitra bila ada. Ekspor sebagai PNG 1080×1350.', success: 'Poster memuat nama kegiatan, tanggal, lokasi, dan logo sesuai pedoman.', risk: 'Font atau warna berbeda dari pedoman.', fallback: 'Gunakan ulang poster kegiatan sebelumnya sebagai acuan.' }),
      step('Tulis Caption', { critical: true, what: 'Tulis caption publikasi yang lengkap dan mudah dipahami.', why: 'Caption adalah sumber informasi utama bagi calon peserta.', prepare: 'Data kegiatan terverifikasi', how: 'Gunakan format: judul, ringkasan satu kalimat, jadwal, lokasi, cara mendaftar.', success: 'Caption memuat semua informasi wajib tanpa salah ketik.', risk: 'Informasi tertinggal.', fallback: 'Bandingkan dengan caption publikasi minggu lalu.' }),
      step('Terbitkan Publikasi', { critical: true, what: 'Unggah publikasi ke kanal resmi.', why: 'Publikasi tepat waktu menjaga jumlah pendaftar.', prepare: 'Poster akhir\nCaption akhir', how: 'Unggah ke Instagram organisasi dan bagikan ke grup WhatsApp pada hari Senin.', success: 'Publikasi tampil di kanal resmi dengan konten yang benar.', risk: 'Salah unggah materi.', fallback: 'Hapus dan unggah ulang bila ada kesalahan.' })
    ];
  }

  function seed() {
    const members = [
      { id: 'm1', name: 'Nadia Putri', email: 'nadia@ruangaksi.id', roles: ['Administrator', 'Pemegang Pengetahuan'], status: 'Aktif', last: iso(0, 8, 40), title: 'Koordinator Komunikasi' },
      { id: 'm2', name: 'Raka Pratama', email: 'raka@ruangaksi.id', roles: ['Penerus'], status: 'Aktif', last: iso(-1, 16, 5), title: 'Relawan Komunikasi' },
      { id: 'm3', name: 'Dimas Mahendra', email: 'dimas@ruangaksi.id', roles: ['Reviewer', 'Pemegang Pengetahuan'], status: 'Aktif', last: iso(0, 7, 55), title: 'Koordinator SDM' },
      { id: 'm4', name: 'Alya Putri', email: 'alya@ruangaksi.id', roles: ['Penerus'], status: 'Aktif', last: iso(-2, 13, 20), title: 'Relawan SDM' },
      { id: 'm5', name: 'Rina Amelia', email: 'rina@ruangaksi.id', roles: ['Pemegang Pengetahuan'], status: 'Aktif', last: iso(-3, 10, 0), title: 'Koordinator Operasional' },
      { id: 'm6', name: 'Fajar Aditya', email: 'fajar@ruangaksi.id', roles: ['Penerus'], status: 'Aktif', last: iso(-1, 9, 30), title: 'Relawan Operasional' }
    ];
    const mk = (id, name, desc, cat, o, s, c, stage, cycle, extra = {}) => ({
      id, name, description: desc, category: cat, purpose: '', frequency: extra.frequency || 'Mingguan', duration: extra.duration || 45, importance: extra.importance || 'High',
      ownerId: o, successorId: s, reviewerId: c, expected: extra.expected || '', deliverables: '', quality: extra.quality || [], resources: extra.resources || { files: '', equipment: '', software: '', access: '', refs: '' },
      stage, cycle, deadline: extra.deadline || iso(14), createdAt: iso(-(extra.age || 40)), updatedAt: extra.upd || iso(-2), draft: false, seed: true
    });
    const P = [];
    const qA = qc(['Seluruh informasi kegiatan benar', 'Visual mengikuti pedoman organisasi', 'Caption memuat informasi lengkap', 'Tautan pendaftaran berfungsi', 'Persetujuan publikasi telah diperoleh', '(opsional) Publikasi dijadwalkan pada jam aktif audiens']);
    P.push(mk('p1', 'Publikasi Kegiatan Mingguan', 'Proses menyiapkan dan menerbitkan informasi kegiatan organisasi melalui kanal komunikasi resmi.', 'Komunikasi', 'm1', 'm2', 'm3', 'draft', 1, {
      expected: 'Informasi kegiatan berhasil dipublikasikan dengan jadwal, lokasi, deskripsi, dan tautan pendaftaran yang benar.', quality: qA, duration: 45, deadline: iso(6), upd: iso(-1, 15, 0), age: 30,
      resources: { files: 'Template poster (Canva); Lembar rencana kegiatan', equipment: 'Laptop atau ponsel', software: 'Canva, Instagram, WhatsApp', access: 'Akun Instagram organisasi', refs: 'Pedoman identitas visual' }
    }));
    P[0].seed = false;
    P.push(mk('p2', 'Onboarding Relawan Baru', 'Menyambut relawan baru: pengenalan organisasi, pembagian tugas, dan penambahan ke kanal komunikasi.', 'Human Resources', 'm3', 'm4', 'm1', 'improve', 1, { quality: qc(['Data relawan tercatat lengkap', 'Relawan masuk ke grup yang benar', 'Panduan orientasi terkirim']), upd: iso(-2), deadline: iso(9), frequency: 'Bulanan', duration: 60 }));
    P.push(mk('p3', 'Pengelolaan Inventaris Acara', 'Mencatat, memeriksa, dan mengembalikan perlengkapan acara.', 'Operasional', 'm5', 'm6', 'm3', 'draft', 1, { quality: [], upd: iso(-5), deadline: iso(12), frequency: 'Per acara', duration: 90, importance: 'Medium' }));
    P.push(mk('p4', 'Administrasi Kegiatan', 'Menyusun surat izin, daftar hadir, dan arsip administrasi kegiatan.', 'Administrasi', 'm5', 'm4', 'm3', 'progress', 1, { quality: qc(['Surat izin lengkap dan benar', 'Daftar hadir siap dipakai', 'Arsip tersimpan di folder yang tepat']), upd: iso(0, 8, 0), deadline: iso(5), frequency: 'Per kegiatan', duration: 75 }));
    P.push(mk('p5', 'Pendaftaran Peserta Kegiatan', 'Membuat formulir pendaftaran dan merekap peserta.', 'Operasional', 'm5', 'm2', 'm3', 'done', 2, { quality: qc(['Formulir sesuai kebutuhan kegiatan', 'Rekap peserta akurat', 'Konfirmasi terkirim ke peserta']), upd: iso(-6), deadline: iso(-6) }));
    P.push(mk('p6', 'Laporan Mingguan Pengurus', 'Menyusun ringkasan kegiatan mingguan untuk pengurus.', 'Administrasi', 'm3', 'm6', 'm1', 'done', 2, { quality: qc(['Ringkasan mencakup semua kegiatan', 'Data angka sesuai sumber']), upd: iso(-9), deadline: iso(-9) }));
    P.push(mk('p7', 'Pengarsipan Dokumen Kegiatan', 'Mengarsipkan dokumen kegiatan ke penyimpanan bersama.', 'Administrasi', 'm5', 'm4', 'm1', 'done', 1, { quality: qc(['Dokumen dinamai sesuai aturan', 'Dokumen berada di folder yang benar']), upd: iso(-12), deadline: iso(-12), frequency: 'Bulanan' }));
    P.push(mk('p8', 'Rekap Kehadiran Rapat', 'Merekap kehadiran dan tindak lanjut rapat pengurus.', 'Administrasi', 'm1', 'm6', 'm3', 'submitted', 2, { quality: qc(['Daftar hadir tercatat benar', 'Tindak lanjut tercantum dengan penanggung jawab']), upd: iso(0, 7, 30), deadline: iso(3), duration: 40 }));

    const guides = {};
    const mkG = (pid, stepsDef) => {
      const steps = stepsDef.map(t => step(t[0], { what: t[1], how: t[2], success: t[3], critical: true, why: 'Langkah ini menjaga kualitas hasil akhir.', risk: 'Informasi tertinggal.', fallback: 'Hubungi pemegang proses melalui kanal resmi setelah mencoba mengikuti panduan.' }));
      guides[pid] = { draft: JSON.parse(JSON.stringify(steps)), versions: [{ v: '1.0', at: iso(-30), editor: P.find(x => x.id === pid).ownerId, summary: 'Panduan awal.', gapIds: [], steps }] };
      return steps;
    };
    guides.p1 = { draft: guide1_0(), versions: [] };
    const s2 = mkG('p2', [['Catat Data Relawan', 'Catat data relawan baru ke lembar relawan.', 'Isi nama, kontak, dan bidang minat pada lembar relawan.', 'Data relawan tercatat lengkap.'], ['Tambahkan ke Grup Komunikasi', 'Masukkan relawan ke grup WhatsApp yang sesuai.', 'Tambahkan relawan ke grup umum dan grup bidang.', 'Relawan muncul di grup yang benar.'], ['Kirim Panduan Orientasi', 'Kirim dokumen orientasi ke relawan.', 'Kirim tautan panduan orientasi lewat pesan pribadi.', 'Relawan menerima panduan.']]);
    guides.p3 = { draft: [step('Daftar Perlengkapan', { what: 'Susun daftar perlengkapan yang dibutuhkan acara.' }), step('Periksa Kondisi', { what: 'Periksa kondisi tiap barang sebelum dibawa.' })], versions: [] };
    const s4 = mkG('p4', [['Siapkan Surat Izin', 'Susun surat izin kegiatan.', 'Gunakan template surat dan isi data kegiatan.', 'Surat lengkap dan benar.'], ['Siapkan Daftar Hadir', 'Buat daftar hadir kegiatan.', 'Salin template daftar hadir dan isi nama kegiatan.', 'Daftar hadir siap dipakai.'], ['Arsipkan Dokumen', 'Simpan semua dokumen ke folder arsip.', 'Unggah ke folder kegiatan di penyimpanan bersama.', 'Dokumen tersimpan di folder yang tepat.']]);
    const s5a = mkG('p5', [['Buat Formulir', 'Buat formulir pendaftaran.', 'Duplikat template formulir dan sesuaikan pertanyaan.', 'Formulir siap dibagikan.'], ['Rekap Peserta', 'Rekap data peserta dari formulir.', 'Ekspor tanggapan ke lembar rekap.', 'Rekap akurat.']]);
    const s5b = [...s5a.map(x => ({ ...x, id: uid('st') })), step('Kirim Konfirmasi', { what: 'Kirim konfirmasi pendaftaran ke peserta.', how: 'Gunakan template pesan konfirmasi dan kirim ke semua peserta.', success: 'Semua peserta menerima konfirmasi.', critical: true })];
    guides.p5.versions.push({ v: '1.1', at: iso(-14), editor: 'm5', summary: 'Menambahkan langkah konfirmasi ke peserta berdasarkan hasil Cycle 1.', gapIds: ['g_p5_1'], steps: s5b }); guides.p5.draft = JSON.parse(JSON.stringify(s5b));
    const s6a = mkG('p6', [['Kumpulkan Data Kegiatan', 'Kumpulkan data kegiatan minggu ini.', 'Salin data dari lembar kegiatan.', 'Data lengkap.'], ['Susun Ringkasan', 'Tulis ringkasan satu halaman.', 'Gunakan template laporan mingguan.', 'Ringkasan mencakup semua kegiatan.']]);
    guides.p6.versions.push({ v: '1.1', at: iso(-16), editor: 'm3', summary: 'Menambahkan contoh ringkasan yang baik.', gapIds: ['g_p6_1'], steps: s6a.map(x => ({ ...x, id: uid('st'), example: 'Contoh: 3 kegiatan, 42 peserta, 1 tindak lanjut.' })) });
    guides.p6.draft = JSON.parse(JSON.stringify(guides.p6.versions[1].steps));
    mkG('p7', [['Beri Nama Dokumen', 'Beri nama dokumen sesuai aturan.', 'Format: TAHUN-BULAN_Kegiatan_Jenis.', 'Dokumen dinamai sesuai aturan.'], ['Unggah ke Folder', 'Unggah ke folder arsip.', 'Pilih folder tahun dan kegiatan.', 'Dokumen berada di folder yang benar.']]);
    const s8a = mkG('p8', [['Catat Kehadiran', 'Catat daftar hadir rapat.', 'Isi lembar kehadiran saat rapat.', 'Daftar hadir tercatat benar.'], ['Catat Tindak Lanjut', 'Catat tindak lanjut rapat.', 'Tuliskan tindak lanjut beserta penanggung jawab.', 'Tindak lanjut lengkap.']]);
    guides.p8.versions.push({ v: '1.1', at: iso(-4), editor: 'm1', summary: 'Menambahkan kolom penanggung jawab pada tindak lanjut.', gapIds: ['g_p8_1'], steps: s8a.map(x => ({ ...x, id: uid('st') })) });
    guides.p8.draft = JSON.parse(JSON.stringify(guides.p8.versions[1].steps));

    const attempts = [], gaps = [];
    const att = (pid, cycle, ver, o) => {
      const p = P.find(x => x.id === pid), g = guides[pid].versions.find(v => v.v === ver), steps = g ? g.steps : [];
      const a = {
        id: uid('at'), pid, cycle, guideVersion: ver, startedAt: iso(o.days, 9, 0), submittedAt: o.status === 'progress' ? null : iso(o.days, 10, 0), doneSteps: o.done || steps.map(s => s.id), cursor: o.cursor || 0,
        assist: (o.assist || []).map(([si, type, text, prov], k) => ({ id: uid('as'), step: steps[si] ? steps[si].id : '', type, text, provider: prov, at: iso(o.days, 9, 15 + k * 17), evidence: '', verified: true })),
        issues: (o.issues || []).map(([si, kind, text]) => ({ id: uid('is'), step: steps[si] ? steps[si].id : '', kind, text, at: iso(o.days, 9, 40) })),
        submission: o.status === 'progress' ? { files: [], link: '', text: '' } : { files: ['hasil-praktik.png'], link: '', text: 'Hasil praktik terlampir.' }, self: {}, minutes: o.minutes || 0, status: o.status || 'reviewed', outcome: o.outcome || null, review: null, notes: []
      };
      if (a.status === 'reviewed') {
        const results = {}; p.quality.forEach(q => results[q.id] = 'pass');
        a.review = { id: uid('rv'), reviewerId: p.reviewerId, results, notes: { well: 'Hasil sesuai harapan.', unclear: o.unclear || '', steps: '', next: o.next || '' }, reason: o.reason || 'Seluruh kriteria wajib terpenuhi.', at: iso(o.days, 14, 0) };
      }
      attempts.push(a); return a;
    };
    const a2 = att('p2', 1, '1.0', { days: -3, minutes: 68, outcome: 'dengan_bantuan', assist: [[1, 'Klarifikasi diminta', 'Tidak jelas grup WhatsApp mana yang dipakai untuk relawan bidang.', 'm3'], [2, 'Demonstrasi diperlukan', 'Perlu contoh pesan orientasi yang benar.', 'm3']], issues: [[0, 'Informasi belum tersedia', 'Lembar relawan tidak dapat diakses dari akun saya.']], unclear: 'Langkah grup WhatsApp belum menjelaskan pembagian grup.', next: 'Tambahkan daftar grup dan contoh pesan.', reason: 'Selesai, tetapi dua langkah memerlukan bantuan langsung.' });
    [[1, 'assist', 'Tidak jelas grup WhatsApp mana yang dipakai untuk relawan bidang.', 'Klarifikasi diminta', 0], [2, 'assist', 'Perlu contoh pesan orientasi yang benar.', 'Demonstrasi diperlukan', 5], [0, 'issue', 'Lembar relawan tidak dapat diakses dari akun saya.', 'Informasi belum tersedia', 2]].forEach(([si, src, d, k, cause], i) => gaps.push({
      id: uid('g'), pid: 'p2', attemptId: a2.id, stepId: s2[si].id, source: src, desc: d, evidence: src === 'assist' ? 'Dicatat saat praktik: ' + k : 'Laporan kendala penerus', cause, suggestion: src === 'assist' ? 'Dokumentasikan jawaban yang diberikan pemegang proses sebagai instruksi tertulis.' : 'Pastikan hak akses dicantumkan di sumber daya langkah.', status: i === 0 ? 'Dikerjakan' : 'Baru', resolvedIn: null
    }));
    att('p4', 1, '1.0', { days: 0, status: 'progress', done: [s4[0].id], cursor: 1 });
    const a5 = att('p5', 1, '1.0', { days: -22, minutes: 52, outcome: 'dengan_bantuan', assist: [[1, 'Klarifikasi diminta', 'Menanyakan format rekap peserta.', 'm5'], [1, 'Demonstrasi diperlukan', 'Meminta contoh pengiriman konfirmasi.', 'm5']], reason: 'Berhasil dengan dua bantuan langsung.' });
    gaps.push({ id: 'g_p5_1', pid: 'p5', attemptId: a5.id, stepId: s5a[1].id, source: 'assist', desc: 'Penerus perlu bantuan soal konfirmasi peserta.', evidence: 'Dicatat saat praktik', cause: 1, suggestion: 'Tambahkan langkah pengiriman konfirmasi.', status: 'Selesai', resolvedIn: '1.1' });
    att('p5', 2, '1.1', { days: -8, minutes: 41, outcome: 'mandiri', reason: 'Seluruh kriteria wajib terpenuhi tanpa bantuan langsung.' });
    const a6 = att('p6', 1, '1.0', { days: -26, minutes: 35, outcome: 'dengan_bantuan', assist: [[1, 'Klarifikasi diminta', 'Menanyakan tingkat detail ringkasan.', 'm3']] });
    gaps.push({ id: 'g_p6_1', pid: 'p6', attemptId: a6.id, stepId: s6a[1].id, source: 'assist', desc: 'Tingkat detail ringkasan tidak jelas.', evidence: 'Dicatat saat praktik', cause: 0, suggestion: 'Tambahkan contoh ringkasan.', status: 'Selesai', resolvedIn: '1.1' });
    att('p6', 2, '1.1', { days: -11, minutes: 28, outcome: 'mandiri' });
    att('p7', 1, '1.0', { days: -13, minutes: 24, outcome: 'mandiri' });
    const a8 = att('p8', 1, '1.0', { days: -10, minutes: 40, outcome: 'dengan_bantuan', assist: [[1, 'Klarifikasi diminta', 'Siapa penanggung jawab tindak lanjut?', 'm1']] });
    gaps.push({ id: 'g_p8_1', pid: 'p8', attemptId: a8.id, stepId: s8a[1].id, source: 'assist', desc: 'Penanggung jawab tindak lanjut tidak dijelaskan.', evidence: 'Dicatat saat praktik', cause: 0, suggestion: 'Tambahkan kolom penanggung jawab.', status: 'Selesai', resolvedIn: '1.1' });
    const a8b = att('p8', 2, '1.1', { days: 0, minutes: 33, status: 'submitted' });
    a8b.submittedAt = iso(0, 7, 30);

    const n = (to, type, title, body, route, d, h, read) => ({ id: uid('n'), to, type, title, body, route, read: !!read, at: iso(d, h, 0) });
    const notifications = [
      n('m1', 'deadline', 'Panduan mendekati batas waktu', 'Panduan Publikasi Kegiatan Mingguan masih draf. Batas waktu 6 hari lagi.', '#/proses/p1/panduan', 0, 8),
      n('m1', 'review', 'Evaluasi dikirim', 'Dimas menyelesaikan evaluasi Cycle 2 untuk Pendaftaran Peserta Kegiatan.', '#/hasil/p5', -8, 15, true),
      n('m1', 'assign', 'Hasil Cycle 2 menunggu tinjauan', 'Fajar telah mengirim hasil praktik Rekap Kehadiran Rapat.', '#/transfer/p8', 0, 7),
      n('m2', 'assign', 'Penugasan baru', 'Anda ditetapkan sebagai penerus untuk Publikasi Kegiatan Mingguan. Panduan sedang disiapkan.', '#/proses/p1', -1, 11),
      n('m3', 'review', 'Menunggu peninjauan', 'Cycle 2 Rekap Kehadiran Rapat menunggu evaluasi Anda.', '#/review/' + a8b.id, 0, 7),
      n('m3', 'guide', 'Evaluasi Cycle 1 selesai', 'Ada 3 celah panduan pada Onboarding Relawan Baru yang perlu diperbaiki.', '#/perbaikan/p2', -2, 14),
      n('m4', 'guide', 'Panduan diperbarui', 'Panduan Administrasi Kegiatan versi 1.0 siap digunakan.', '#/transfer/p4', -3, 9, true),
      n('m6', 'ready', 'Hasil Cycle 2 sedang ditinjau', 'Hasil praktik Rekap Kehadiran Rapat sedang ditinjau reviewer.', '#/transfer/p8', 0, 7)
    ];
    const activity = [
      { id: uid('ac'), who: 'm6', text: 'mengirim hasil Cycle 2 untuk Rekap Kehadiran Rapat', route: '#/transfer/p8', at: iso(0, 7, 30) },
      { id: uid('ac'), who: 'm4', text: 'mulai praktik Cycle 1 untuk Administrasi Kegiatan', route: '#/transfer/p4', at: iso(0, 8, 0) },
      { id: uid('ac'), who: 'm1', text: 'meninjau hasil transfer Onboarding Relawan Baru', route: '#/perbaikan/p2', at: iso(-2, 14, 0) },
      { id: uid('ac'), who: 'm1', text: 'memperbarui draf panduan Publikasi Kegiatan Mingguan', route: '#/proses/p1/panduan', at: iso(-1, 15, 0) },
      { id: uid('ac'), who: 'm2', text: 'menerima penugasan Publikasi Kegiatan Mingguan', route: '#/proses/p1', at: iso(-1, 11, 0) },
      { id: uid('ac'), who: 'm3', text: 'memverifikasi Pendaftaran Peserta Kegiatan sebagai Mandiri', route: '#/hasil/p5', at: iso(-8, 15, 0) }
    ];
    return {
      ver: 1, session: { user: null }, ui: { view: 'table' },
      org: { id: 'o1', name: 'Ruang Aksi Kampus', type: 'Organisasi Kampus', size: '11–30 anggota', description: 'Organisasi mahasiswa fiktif yang mengelola program komunitas dan kegiatan kampus (data demonstrasi).', objective: 'Memperbaiki proses serah terima', createdAt: iso(-90) },
      members, invites: [{ id: uid('iv'), email: 'bima@ruangaksi.id', role: 'Penerus', status: 'Menunggu', at: iso(-2) }],
      processes: P, guides, attempts, gaps, notifications, activity,
      settings: { notif: { email: true, inapp: true, assign: true, review: true }, lang: 'id', privacy: { visibility: 'Hanya anggota terkait', access: 'Pemilik, penerus, dan reviewer' } }
    };
  }
  function blank(name, email, org) {
    const id = uid('m');
    return {
      ver: 1, session: { user: id }, ui: { view: 'table' }, onboarding: true,
      org: { id: uid('o'), name: org || 'Organisasi Saya', type: '', size: '', description: '', objective: '', createdAt: iso(0) },
      members: [{ id, name, email, roles: ['Administrator', 'Pemegang Pengetahuan', 'Reviewer'], status: 'Aktif', last: new Date().toISOString(), title: 'Administrator' }],
      invites: [], processes: [], guides: {}, attempts: [], gaps: [], notifications: [], activity: [],
      settings: { notif: { email: true, inapp: true, assign: true, review: true }, lang: 'id', privacy: { visibility: 'Hanya anggota terkait', access: 'Pemilik, penerus, dan reviewer' } }
    };
  }
  PL.blank = blank;
  PL.load = function () { try { const j = localStorage.getItem(KEY); if (j) { const s = JSON.parse(j); if (s && s.ver === 1) return s; } } catch (e) {} return seed(); };
  PL.S = PL.load();
  PL.save = function () { try { localStorage.setItem(KEY, JSON.stringify(PL.S)); } catch (e) {} };
  // Buang state UI sementara (wizard, editor, review) agar tidak bocor antar akun/workspace.
  PL.resetUi = function () { PL.wz = PL.pw = PL.bs = PL.rv = null; };
  PL.reset = function () { PL.S = seed(); PL.resetUi(); PL.save(); };
  PL.replace = function (s) { PL.S = s; PL.resetUi(); PL.save(); };

  /* selectors */
  PL.M = id => PL.S.members.find(m => m.id === id);
  PL.P = id => PL.S.processes.find(p => p.id === id);
  PL.name = id => (PL.M(id) || { name: '—' }).name;
  PL.me = () => PL.M(PL.S.session.user);
  PL.G = pid => PL.S.guides[pid] || (PL.S.guides[pid] = { draft: [], versions: [] });
  PL.curVer = pid => { const v = PL.G(pid).versions; return v.length ? v[v.length - 1] : null; };
  PL.statusKey = PLCore.statusKey;
  PL.attemptsOf = pid => PL.S.attempts.filter(a => a.pid === pid).sort((a, b) => a.cycle - b.cycle);
  PL.activeAttempt = p => PL.S.attempts.find(a => a.pid === p.id && a.cycle === p.cycle && a.status !== 'reviewed');
  PL.assistN = a => PLCore.countedAssist(a).length;
  PL.gapsOf = pid => PL.S.gaps.filter(g => g.pid === pid);
  PL.openGaps = pid => PL.gapsOf(pid).filter(g => g.status !== 'Selesai' && !g.resolvedIn);
  PL.isActive = PLCore.isActive;
  PL.tpos = p => p.stage === 'draft' ? 0 : p.stage === 'done' ? 8 : p.cycle === 1 ? ({ ready: 1, progress: 2, submitted: 4, improve: 6 })[p.stage] : 7;
  PL.TSTEPS = ['Panduan Terbit', 'Penerus Mengakses Panduan', 'Praktik Tugas', 'Hasil Terkirim', 'Review Selesai', 'Celah Teridentifikasi', 'Panduan Direvisi', 'Uji Keterulangan'];
  PL.stageLabel = p => ({ draft: 'Panduan belum terbit', ready: 'Siap dipraktikkan', progress: 'Praktik sedang berjalan', submitted: 'Menunggu review', improve: 'Perbaikan panduan', done: 'Terverifikasi' })[p.stage];
  PL.nextVer = pid => PLCore.nextVersion(PL.S, pid);
  PL.metrics = () => PLCore.portfolioMetrics(PL.S);
  PL.usability = pid => PLCore.usabilityOf(PL.S, pid);

  /* side effects */
  PL.notify = (to, type, title, body, route) => { if (!to) return; PL.S.notifications.unshift({ id: uid('n'), to, type, title, body, route, read: false, at: new Date().toISOString() }); };
  PL.log = (text, route) => { PL.S.activity.unshift({ id: uid('ac'), who: PL.S.session.user, text, route, at: new Date().toISOString() }); PL.S.activity = PL.S.activity.slice(0, 60); };
  const clone = o => JSON.parse(JSON.stringify(o));
  PL.clone = clone;

  /* Logika alur ada di modul inti TypeScript (src/domain/workflow.ts, dibundel sebagai PLCore).
     Fungsi di bawah hanyalah adaptor: memasok pengguna sesi + waktu, lalu menyimpan. */
  const ctx = { now: () => new Date().toISOString(), uid };
  const actor = () => PL.S.session.user;
  PL.validateSteps = PLCore.validateSteps;
  PL.validateSubmission = (a, sub, minutes) => PLCore.validateSubmission(PL.S, a, sub, minutes);
  PL.validateReview = PLCore.validateReview;
  PL.suggestOutcome = PLCore.suggestOutcome;
  PL.publishGuide = (pid, summary) => {
    const r = PLCore.publishGuide(PL.S, ctx, actor(), pid, summary);
    if (!r.ok) return { err: r.errors };
    PL.save(); return { ok: true, v: r.version };
  };
  PL.startAttempt = pid => {
    const r = PLCore.startAttempt(PL.S, ctx, actor(), pid);
    if (!r.ok) { PL.lastErr = r.errors; return null; }
    PL.save(); return r.attempt;
  };
  /* submitAttempt dan completeReview mengembalikan { ok } atau { err: [...] } agar UI bisa menampilkan penolakan. */
  PL.submitAttempt = (aid, sub) => {
    const r = PLCore.submitAttempt(PL.S, ctx, actor(), aid, sub);
    if (!r.ok) return { err: r.errors };
    PL.save(); return { ok: true };
  };
  PL.completeReview = (aid, d) => {
    const r = PLCore.completeReview(PL.S, ctx, actor(), aid, d);
    if (!r.ok) return { err: r.errors };
    PL.save(); return { ok: true };
  };

  /* laporan: dihitung di inti (src/domain/metrics.ts) */
  PL.report = f => PLCore.report(PL.S, f);
  window.addEventListener('beforeunload', PL.save);
})(window.PL);
