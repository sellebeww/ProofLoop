<div align="center">

# ProofLoop

### Kerja tetap berjalan, meski orang berganti.

<p>Platform keberlanjutan organisasi: bukan sekadar menyimpan dokumen, tetapi membuktikan bahwa penerus benar-benar bisa mengulang pekerjaannya.</p>

<p><img src="https://img.shields.io/badge/stack-JS%20%2B%20TypeScript%20(inti)-1B66F0?labelColor=3a3f47" alt="JS dan TypeScript"> <img src="https://img.shields.io/badge/server-tidak%20wajib-23845B?labelColor=3a3f47" alt="Tanpa server wajib"> <img src="https://img.shields.io/badge/mode-demo%20%28data%20fiktif%29-d4a017?labelColor=3a3f47" alt="mode demo (data fiktif)"> <img src="https://img.shields.io/badge/license-All%20rights%20reserved-1e3a8a?labelColor=3a3f47" alt="license All rights reserved"></p>
</div>

Pengetahuan yang tertulis belum tentu pengetahuan yang bisa dipakai. ProofLoop mengubah serah terima menjadi proses yang bisa diuji: pemilik menulis panduan, penerus mempraktikkannya, reviewer mengevaluasi, lalu panduan diperbaiki sampai penerus terbukti mandiri.

Aplikasi tanpa server. Semua data demo fiktif dan tersimpan di peramban. Logika alur kini berupa modul TypeScript yang diuji; UI tetap vanilla JS.

## Tampilan

| | |
| --- | --- |
| **Halaman publik**: pengantar produk dan profil perusahaan.<br>![Halaman publik](docs/screenshots/1-beranda-publik.png) | **Masuk**: akun demo siap pakai untuk tiga peran.<br>![Masuk](docs/screenshots/2-masuk.png) |
| **Beranda**: status keberlanjutan semua proses dan tugas yang perlu tindakan.<br>![Beranda](docs/screenshots/3-dasbor.png) | **Proses kerja**: daftar proses beserta pemilik, penerus, versi, dan status.<br>![Proses kerja](docs/screenshots/4-proses-kerja.png) |
| **Transfer pengetahuan**: progres serah terima per siklus.<br>![Transfer](docs/screenshots/5-transfer.png) | **Laporan keberlanjutan**: tingkat kemandirian, frekuensi bantuan, dan langkah kritis.<br>![Laporan](docs/screenshots/6-laporan.png) |

**Ponsel**:

<img src="docs/screenshots/7-mobile.png" alt="Tampilan mobile" width="220">

## Fitur

- **Dokumentasi proses**: panduan terstruktur berisi tujuan, persiapan, langkah, hasil yang berhasil, risiko, dan penanganan.
- **Serah terima terpandu**: siklus praktik dengan peran jelas untuk pemilik, penerus, dan reviewer.
- **Uji keterulangan**: penerus menjalankan pekerjaan nyata, bukan hanya membaca dokumen.
- **Pelacakan bantuan**: membedakan kerja mandiri dari kerja yang butuh bantuan langsung. Membaca panduan tidak dihitung sebagai bantuan.
- **Pemetaan celah pengetahuan**: setiap kendala dipetakan ke penyebabnya, sehingga yang diperbaiki adalah panduan, bukan penerusnya yang disalahkan.
- **Laporan berbasis bukti**: tingkat kemandirian, frekuensi bantuan, dan keberhasilan langkah kritis, bisa diunduh sebagai CSV atau dicetak.

Ditambahkan pada rilis ini:

- **Mesin status yang dijaga**: transisi terlarang ditolak dan state tidak berubah (lihat Alur).
- **Ekspor/impor**: panduan sebagai JSON atau Markdown berfrontmatter; cadangan seluruh workspace sebagai JSON. Data tidak terkunci di satu peramban.
- **Skor keterpakaian** per proses dengan rumus yang ditampilkan di UI.
- **Riwayat revisi dengan diff** tingkat kata antarversi, termasuk draf yang belum terbit.
- **Bukti per langkah** (teks dan foto) dan **komentar reviewer** per langkah. Langkah dapat ditandai "wajib bukti".
- **Asisten AI opsional** yang menandai langkah ambigu atau sulit diuji, hanya sebagai saran. Mati secara default.
- **PWA** (cangkang aplikasi offline), tampilan 360 px, audit aksesibilitas otomatis.

## Alur dan status

```
draft ──terbitkan──▶ ready ──mulai──▶ progress ──kirim──▶ submitted ──setujui (Mandiri)──▶ done
                      ▲  │                                    │
                      │  └─ terbitkan lagi (versi baru)        └─ revisi (Dengan Bantuan / Belum)
                      └────── terbitkan (siklus + 1) ◀──── improve ◀┘
```

| Status | Arti | Siapa yang boleh bertindak |
| --- | --- | --- |
| `draft` | Panduan belum terbit | Pemilik / administrator menerbitkan |
| `ready` | Terbit, menunggu penerus | Penerus memulai praktik |
| `progress` | Penerus sedang praktik | Penerus mengirim hasil |
| `submitted` | Menunggu review | Reviewer menilai |
| `improve` | Perlu perbaikan panduan | Pemilik / administrator menerbitkan versi baru |
| `done` | Terverifikasi Mandiri | Status akhir |

Aturan penilaian yang dijaga di inti: semua kriteria dinilai; alasan wajib; "Mandiri" ditolak bila ada kriteria wajib gagal atau bantuan langsung yang masih tervalidasi; "Dengan Bantuan" ditolak bila ada kriteria wajib gagal. Pengiriman hasil ditolak bila ada langkah belum selesai, langkah "wajib bukti" tanpa bukti, atau tanpa bukti hasil.

## Skor keterpakaian

Dari praktik terakhir yang sudah direview, skala 0 sampai 100:

- **40%** hasil (Mandiri 100, Dengan Bantuan 60, Belum Berhasil 0)
- **35%** langkah tanpa bantuan tervalidasi dan tanpa laporan kendala
- **25%** kriteria wajib yang lulus (N/A tidak dihitung)

Komponen yang tidak bisa dihitung dibuang dan sisanya dinormalkan. Tanpa praktik yang direview, skor tidak ditampilkan (bukan 0). **Bobot adalah pilihan desain, bukan hasil kalibrasi statistik.** Skor menggambarkan satu praktik oleh satu penerus, bukan kemampuan orang lain. Rumus dan angka tiap komponen tampil di kartu "Keterpakaian panduan".

## Menjalankan

Prasyarat: Node.js 22 atau lebih baru.

```sh
npm install
npm start          # build, lalu server di http://localhost:5173
```

Skrip lain:

| Perintah | Fungsi |
| --- | --- |
| `npm run lint` | ESLint (TypeScript ketat; UI lama hanya aturan yang menangkap bug nyata) |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | Vitest: mesin status, metrik, skor, diff, ekspor/impor, bukti/komentar, AI |
| `npm run build` | Bundel inti dengan esbuild dan salin aset ke `dist/` |
| `npm run check` | Keempatnya berurutan |

Uji peramban (butuh Playwright terpasang; bukan dependensi proyek): `scripts/smoke*.cjs` (alur demo, ekspor/impor, bukti/komentar, AI dengan server dimock, PWA) dan `scripts/a11y.cjs` (axe-core pada 360 px dan 1280 px, tema terang dan gelap). Jalankan server lalu `BASE=http://localhost:5173 node scripts/smoke.cjs`.

## Akun demo

Kata sandi semua akun: `demo1234`.

| Akun | Peran |
| --- | --- |
| `nadia@ruangaksi.id` | Pemegang pengetahuan · Admin |
| `raka@ruangaksi.id` | Penerus |
| `dimas@ruangaksi.id` | Reviewer |

Ganti peran lewat menu avatar. **Reset data demo** di menu yang sama memulihkan data awal. Karena peran dijaga di inti, ganti ke peran yang tepat sebelum bertindak (mis. hanya reviewer yang ditetapkan yang dapat menilai).

## Alur demo

1. Nadia menerbitkan panduan *Publikasi Kegiatan Mingguan*.
2. Raka berlatih di Cycle 1, melampirkan bukti, dan mencatat bantuan serta kendala.
3. Dimas mengevaluasi dan memberi komentar per langkah.
4. Nadia memperbaiki panduan, melihat diff, dan menerbitkan v1.1.
5. Raka mengulang di Cycle 2, Dimas mengevaluasi lagi.
6. Hasil, skor keterpakaian, dan laporan ikut diperbarui.

## Asisten AI (opsional)

Mati secara default; aplikasi berfungsi penuh tanpanya. Untuk mengaktifkan, salin `.env.example` menjadi `.env` dan isi **kunci milik Anda sendiri**:

```
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=...   # nama model dari akun Anda; tidak ada model bawaan
```

Keduanya wajib terisi. Kunci hanya dibaca server (dev server atau fungsi `api/`), tidak pernah dikirim ke peramban. Tombol muncul di Penyusun Panduan; teks langkah draf dikirim ke Anthropic **hanya setelah Anda mengonfirmasi**. Data anggota dan hasil praktik tidak dikirim. Keluaran berlabel "Saran AI", bisa keliru, tidak mengubah panduan, dan dapat diabaikan. Hanya biaya penggunaan API Anda sendiri yang berlaku. Fitur ini diuji dengan klien tiruan; belum diuji terhadap API sungguhan.

## Arsitektur

```
src/domain/   inti murni (tanpa DOM/localStorage): workflow, metrics, usability, diff, evidence
src/io/       ekspor/impor (JSON, Markdown berfrontmatter), validasi impor
src/ai/       prompt, parser, dan tinjauan AI (klien diinjeksi)
src/browser.ts  bundel IIFE -> window.PLCore
server/       handler AI tanpa framework (dev server dan Vercel)
api/ai/       fungsi Vercel tipis di atas server/
js/           UI vanilla JS (window.PL); store.js hanyalah adaptor ke PLCore + localStorage
tests/        Vitest
scripts/      build.mjs, smoke/a11y (Playwright)
```

Keputusan stack dan alasannya ada di [`docs/IMPROVEMENT-PLAN.md`](docs/IMPROVEMENT-PLAN.md); rancangan backend di [`docs/BACKEND.md`](docs/BACKEND.md).

## Deploy (Vercel)

`vercel.json` mengatur build (`npm run build`), direktori keluaran `dist`, fungsi `api/`, dan header keamanan (termasuk CSP). Untuk AI di Vercel, isi `ANTHROPIC_API_KEY` dan `ANTHROPIC_MODEL` di Environment Variables proyek Anda sendiri. Konfigurasi ini belum pernah dideploy dari repo ini (tidak ada akses akun); verifikasi pada deploy pertama, terutama fungsi `api/`.

## Privasi

- Semua data workspace tersimpan di `localStorage` peramban Anda (`proofloop.v1`). Tidak ada telemetri dan tidak ada server yang menerima data Anda.
- Foto bukti diperkecil dan disimpan di peramban yang sama. Kuota peramban kecil: ekspor cadangan berkala.
- Ikon dimuat dari berkas lokal (tidak lagi dari CDN). **Font masih dari Google Fonts**, sehingga alamat IP Anda terlihat oleh Google saat halaman dimuat.
- Ekspor panduan hanya berisi isi langkah. Cadangan workspace memuat seluruh isi workspace; hash kata sandi hanya ikut bila Anda mencentangnya.
- Fitur AI mengirim teks langkah ke Anthropic hanya atas konfirmasi Anda dan memakai kunci Anda sendiri.

## Struktur berkas format

- Panduan JSON: `{ "format": "proofloop.guide", "formatVersion": 1, ... }`
- Panduan Markdown: frontmatter (`proofloop: guide`, `format: 1`, `process`, `category`, `version`, ...), lalu `## Langkah N: Judul` dengan bagian `### Penjelasan`, `### Cara melakukan`, dan seterusnya.
- Cadangan workspace JSON: `{ "format": "proofloop.workspace", "formatVersion": 1, "state": { ... } }`. Impor menolak berkas yang melanggar invarian status, id ganda, atau rujukan yatim.

## Batasan

- Tidak ada server wajib: email, unggah berkas (lampiran hasil hanya nama berkas; foto bukti disimpan diperkecil di peramban), dan autentikasi nyata belum ada.
- **Autentikasi hanya kosmetik.** Kata sandi akun demo tetap (`demo1234`); akun baru menyimpan hash SHA-256 tanpa salt di `localStorage`. Siapa pun yang memegang peramban dapat membaca semua data. Penjagaan peran di inti mencegah kesalahan alur, bukan serangan.
- Data tersimpan di satu peramban. Berpindah perangkat memerlukan ekspor/impor manual. Backend belum ada (lihat `docs/BACKEND.md`).
- Skor keterpakaian bukan alat ukur yang tervalidasi secara statistik; sampel biasanya kecil.
- Membuat akun baru akan membuat workspace kosong dan menggantikan data demo di peramban itu.
- Cakupan uji: logika inti diuji unit; UI lama hanya diuji lewat smoke test peramban manual (tidak ada di CI). Audit aksesibilitas otomatis tidak menggantikan uji dengan pembaca layar.

---

© 2026 Vassel Goleyu. All rights reserved.
