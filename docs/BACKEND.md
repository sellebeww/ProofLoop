# Backend opsional: rekomendasi dan rancangan (belum diimplementasikan)

Status: **hanya rancangan**. Tidak ada kode backend di repo ini dan tidak ada yang diuji terhadap layanan nyata. Mode lokal (data di peramban, ekspor/impor JSON dan Markdown) adalah satu-satunya mode yang berfungsi.

## Rekomendasi: Supabase (Postgres + Auth + Row Level Security)

Alasan (berdasarkan keadaan kode, lihat `IMPROVEMENT-PLAN.md`):

- Klien adalah SPA statis tanpa server. Supabase dapat dipakai langsung dari klien lewat SDK, tanpa menulis dan meng-host server aplikasi.
- Model peran (Administrator, Pemegang Pengetahuan, Penerus, Reviewer) dan aturan "siapa boleh melakukan transisi apa" dapat diwujudkan sebagai kebijakan RLS per organisasi. Itu mengubah penjagaan peran yang kini hanya di klien menjadi penjagaan sungguhan.
- Next.js + Drizzle + SQLite/Postgres menuntut penulisan ulang UI (±200 KB template string yang terikat ke `window.PL`) dan server yang harus di-host. Manfaatnya tidak sebanding untuk tim kecil.

## Pemetaan data

| State lokal | Tabel |
| --- | --- |
| `org`, `members` | `organizations`, `memberships (user_id, org_id, roles[])` + `auth.users` |
| `processes` | `processes (stage, cycle, owner_id, successor_id, reviewer_id, ...)` |
| `guides[pid].draft`, `.versions` | `guide_drafts`, `guide_versions (steps jsonb)` |
| `attempts` | `attempts (status, outcome, assist jsonb, issues jsonb, step_evidence jsonb, comments jsonb)` |
| `gaps`, `notifications`, `activity` | tabel masing-masing |

Foto bukti sebaiknya pindah ke Supabase Storage (bukan kolom teks).

## Yang harus dijaga ulang di sisi server

Mesin status (`src/domain/workflow.ts`) sudah murni dan dapat dijalankan juga di fungsi server/Edge Function. Setiap transisi (`publish`, `start`, `submit`, `approve`, `revise`) harus divalidasi di server dengan aturan yang sama; kebijakan RLS saja tidak cukup untuk aturan lintas-tabel seperti "tidak boleh Mandiri bila ada bantuan tervalidasi".

## Langkah berikutnya (urutan usulan)

1. Antarmuka `Storage` (muat/simpan state) di inti, dengan implementasi lokal sebagai default.
2. Skema SQL + kebijakan RLS + uji kebijakan.
3. Adaptor Supabase di belakang antarmuka itu, dipilih lewat env (`SUPABASE_URL`, kunci anon milik pengguna sendiri).
4. Migrasi: tombol "Impor cadangan ke akun" memakai format `proofloop.workspace`.
