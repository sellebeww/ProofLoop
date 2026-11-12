# Rencana Perbaikan ProofLoop

Dokumen ini ditulis sebelum pengerjaan dimulai (branch `improve/product`). Isinya: audit keadaan awal, model data, keputusan stack beserta alasannya, dan urutan kerja. Bagian "Status" di akhir diperbarui seiring pengerjaan.

## 1. Audit keadaan awal

Keadaan awal (commit `4ee220e`): SPA vanilla JS tanpa build step, ±220 KB JS, data fiktif di `localStorage` (`proofloop.v1`), tanpa test, tanpa linter, tanpa CI.

### Alur produk

Siklus: Pemegang pengetahuan menulis panduan → Penerus mempraktikkan → Reviewer mengevaluasi → panduan diperbaiki → ulangi sampai penerus terbukti mandiri.

Status proses (`process.stage`) yang ada di kode:

| stage | Arti | Istilah di brief |
| --- | --- | --- |
| `draft` | Panduan belum terbit | draf |
| `ready` | Panduan terbit, menunggu penerus mulai | dipraktikkan (siap) |
| `progress` | Penerus sedang praktik | dipraktikkan |
| `submitted` | Hasil dikirim, menunggu reviewer | direview |
| `improve` | Hasil belum mandiri, panduan diperbaiki | direvisi |
| `done` | Terverifikasi mandiri | disetujui |

### Temuan

1. **Mesin status tersebar dan tidak dijaga.** Transisi terjadi di `store.js` (`publishGuide`, `startAttempt`, `submitAttempt`, `completeReview`) tanpa tabel transisi. `submitAttempt` dan `completeReview` tidak memeriksa status saat ini: memanggilnya dua kali (misalnya dua tab, atau klik ganda) menggandakan celah (`gaps`), notifikasi, dan menimpa hasil review.
2. **Aturan bisnis hanya hidup di UI.** Aturan "tidak boleh Mandiri bila ada bantuan tervalidasi atau kriteria wajib gagal", "semua kriteria harus dinilai", dan "semua langkah harus selesai sebelum kirim" ada di handler `rv-done` dan `ex-submit` (`pages2.js`). Siapa pun yang memanggil `PL.completeReview` langsung melewati aturan itu.
3. **Peran hanya informatif.** Tidak ada pemeriksaan bahwa yang menerbitkan adalah pemilik, yang praktik adalah penerus, atau yang menilai adalah reviewer. README sudah mengakui ini; setelah refaktor pemeriksaan berada di modul inti (tetap bukan keamanan, karena data ada di peramban).
4. **Laporan dan metrik** (`PL.report`, `PL.metrics`) bercampur dengan state global `PL.S`, sehingga tidak bisa diuji terpisah.
5. **Data terkunci di satu peramban.** Tidak ada ekspor/impor. Menghapus data situs atau berpindah perangkat berarti kehilangan semuanya. `PL.load` juga tidak memvalidasi isi `localStorage`.
6. **Lampiran hanya nama berkas.** Bukti praktik berupa foto/teks per langkah belum ada. Bantuan punya kolom `evidence` yang tidak pernah terisi dari UI.
7. **Riwayat versi tanpa diff.** Versi panduan tersimpan penuh (`versions[].steps`) tetapi tidak bisa dibandingkan.
8. **Autentikasi.** Akun demo memakai kata sandi tetap di klien. Akun baru menyimpan SHA-256 tanpa salt di `localStorage`. Ini bukan autentikasi nyata dan tidak boleh disebut begitu.
9. **Ketergantungan CDN.** `lucide` dimuat dari `unpkg.com`; font dari Google Fonts. Ikon gagal tampil offline, dan alamat IP pengguna terkirim ke pihak ketiga.
10. **Tidak ada**: test, lint, typecheck, CI, PWA, konfigurasi deploy.
11. Kode UI padat (banyak template satu baris panjang). Tidak ditulis ulang di sini: risiko menghilangkan fitur lebih besar daripada manfaatnya. Perbaikan UI dilakukan bertahap di area yang disentuh.

## 2. Model data

Ditambah tanpa memutus `ver: 1`: semua kolom baru opsional dan dinormalisasi saat impor/muat.

```
State { ver:1, session, ui, org, members[], invites[], processes[], guides{}, attempts[], gaps[], notifications[], activity[], settings }
Process { id, name, category, ownerId, successorId, reviewerId, stage, cycle, quality[{id,text,mandatory}], ... }
Guide { draft: Step[], versions: GuideVersion[] }
Step { id, title, what, why, prepare, how, success, risk, fallback, critical, warning, example, checklist, decision, files[], needsEvidence? }   // needsEvidence baru
GuideVersion { v, at, editor, summary, gapIds[], steps[] }
Attempt { id, pid, cycle, guideVersion, status, doneSteps[], assist[], issues[], submission, self, minutes, outcome, review,
          stepEvidence? { [stepId]: { text, photo? } },   // baru
          comments?    [{ id, stepId, authorId, text, at }] }   // baru: komentar reviewer
Gap { id, pid, attemptId, stepId, source, desc, evidence, cause, suggestion, status, resolvedIn }
```

Skor keterpakaian dan diff dihitung dari data di atas (tidak disimpan), sehingga tidak ada data turunan yang bisa basi.

### Skor keterpakaian (transparan)

Dihitung per proses dari praktik terakhir yang sudah direview (skala 0 sampai 100):

- 40% **hasil**: Mandiri = 100, Dengan Bantuan = 60, Belum Berhasil = 0.
- 35% **langkah tanpa bantuan**: persentase langkah yang tidak punya catatan bantuan tervalidasi maupun laporan kendala.
- 25% **kriteria wajib**: persentase kriteria wajib berstatus lulus (N/A tidak dihitung).

Bobot adalah pilihan desain, bukan hasil kalibrasi statistik; UI menampilkan rumus, angka tiap komponen, dan jumlah praktik yang mendasarinya. Tanpa praktik yang direview, skor tidak ditampilkan (bukan 0).

## 3. Keputusan stack

### Dipilih: tetap SPA statis, logika dipindah ke TypeScript murni, dibundel esbuild

- **Modul inti** `src/` (TypeScript, tanpa DOM, tanpa `localStorage`): mesin status, validasi, metrik, skor, diff, ekspor/impor, prompt AI. Diuji dengan Vitest.
- **UI lama dipertahankan** (`js/*.js`) dan memanggil inti lewat jembatan `window.PLCore` (bundel IIFE). Tidak ada fitur yang ditulis ulang tanpa alasan.
- **Build**: `esbuild` membundel inti, menyalin aset statis ke `dist/`. `lucide` di-vendor ke `dist/` (menghapus ketergantungan CDN untuk ikon).
- **Tooling**: TypeScript (`strict`), ESLint (flat config + typescript-eslint), Vitest, GitHub Actions.

Alasan tidak memakai Next.js: UI saat ini ±200 KB template string yang terikat ke `window.PL` dan router hash. Memindahkannya ke React/Next berarti menulis ulang semuanya; hasil akhirnya produk yang sama dengan risiko regresi tinggi. Nilai bisnis ada di logika alur, dan itu yang diekstrak.

### Backend: ditunda, rekomendasi Supabase

Brief meminta memilih Next.js + Drizzle (SQLite/Postgres) atau Supabase berdasarkan keadaan kode. Keadaan kode: klien statis tanpa server, sudah punya model peran dan data relasional. Rekomendasi: **Supabase** (Postgres + Auth + Row Level Security), karena:

- tidak butuh menulis dan menjalankan server aplikasi; klien statis ini bisa langsung memakai SDK;
- peran (`Administrator`, `Pemegang Pengetahuan`, `Penerus`, `Reviewer`) cocok dengan RLS per organisasi;
- Next.js + Drizzle mengharuskan rewrite UI (lihat di atas) dan server yang harus di-host.

**Tidak diimplementasikan di PR ini**: tanpa kredensial dan proyek Supabase nyata, kode backend tidak bisa diuji, dan brief melarang meminta kredensial. Yang disiapkan: antarmuka `Storage` di inti (mode lokal sebagai implementasi pertama), ekspor/impor JSON dan Markdown agar data tidak terkunci, dan catatan skema di `docs/BACKEND.md`. Mode lokal tanpa server tetap jalan penuh.

### Asisten AI (opsional)

- Berjalan di **server** (fungsi `api/` untuk Vercel, handler yang sama di dev server), bukan di peramban, supaya kunci API tidak pernah masuk klien.
- Aktif hanya bila `.env` berisi `ANTHROPIC_API_KEY` **dan** `ANTHROPIC_MODEL` (model dari env, tidak di-hardcode). Tanpa itu, endpoint mengembalikan `enabled:false` dan UI menyembunyikan fitur.
- Dipanggil hanya saat pengguna menekan tombol. UI memberi tahu bahwa teks panduan akan dikirim ke Anthropic. Hasil selalu berlabel "Saran AI", tidak mengubah panduan otomatis; pengguna menerima atau menolak tiap saran.
- Tidak diuji terhadap API sungguhan (tidak ada kunci). Diuji dengan klien tiruan: pembentukan prompt, validasi respons, penolakan keluaran cacat.

## 4. Urutan kerja (satu commit per perubahan logis)

1. Dokumen ini.
2. Toolchain: tsconfig, ESLint, Vitest, build esbuild, `.gitignore`, dev server melayani `dist/`.
3. Inti: tipe + mesin status + test transisi sah dan terlarang.
4. Refaktor `store.js` agar mendelegasikan ke inti; UI menampilkan penolakan transisi.
5. Inti: laporan/metrik dipindah + test.
6. Ekspor/impor JSON dan Markdown (frontmatter) + UI + test (termasuk round-trip dan input berbahaya).
7. Skor keterpakaian + UI dengan rumus.
8. Riwayat revisi dengan diff.
9. Bukti per langkah (teks/foto) + komentar reviewer.
10. Asisten AI opsional.
11. Aksesibilitas, tampilan 360 px, PWA, `vercel.json`, `ci.yml`.
12. README lengkap, PR draft.

## 5. Batas yang tetap berlaku

- Semua data tetap **data demo fiktif**; label dan batasan di README dipertahankan.
- Tidak ada autentikasi sungguhan. Peran dijaga oleh modul inti, tetapi karena data di peramban, ini bukan kontrol keamanan.
- Foto bukti disimpan di `localStorage` (diperkecil). Kuota peramban kecil; ekspor berkala dianjurkan.

## Status (akhir pengerjaan)

| Item | Status |
| --- | --- |
| A. Audit, rapikan, test mesin status | Selesai. 66 kasus pada tabel transisi, transisi terlarang, penjagaan peran, validasi. |
| B. Logika alur ke modul TS murni | Selesai (`src/domain`). `store.js` kini adaptor. Paritas laporan lama vs baru diperiksa pada data demo. |
| C. Ekspor/impor JSON dan Markdown | Selesai, dengan validasi ketat dan test round-trip. Backend: **tidak diimplementasikan**; rekomendasi Supabase dan rancangan di `docs/BACKEND.md`. |
| D. Skor keterpakaian, diff, bukti, komentar | Selesai. |
| E. Asisten AI opsional | Selesai, diuji dengan klien tiruan saja. Belum pernah memanggil API sungguhan. |
| F. A11y, 360 px, PWA, Vercel, CI, README | Selesai, kecuali deploy Vercel yang tidak dilakukan (tanpa akses akun). `vercel.json` dan fungsi `api/` belum terverifikasi di Vercel. |

Penyimpangan dari rencana awal: bobot penilaian dan batas ukuran (foto, teks, berkas) adalah pilihan desain; font masih dari Google Fonts (ikon sudah lokal); `lucide` di-vendor dari npm sehingga versinya dipin oleh `package-lock.json`.
