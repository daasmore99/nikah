@AGENTS.md

# Tracker Pernikahan (Ananda & Zalfa)

Web pencatat persiapan dan uang pernikahan. Live di `www.zalfananda.my.id`. Baca file ini dulu, lalu
`docs/REKAP.md` (status) dan satu file di `docs/tugas/` untuk pekerjaan yang diminta. Jangan membaca
ulang seluruh kode kalau tidak perlu.

## Stack dan alur
- Next.js 16 (App Router, TypeScript, React 19), Supabase (Auth + Postgres + RLS), Vercel Hobby, GitHub `daasmore99/nikah` (private).
- Push ke `main` otomatis di-deploy Vercel (1-2 menit). Tidak ada deploy manual.
- Next.js di sini berbeda dari pengetahuan umum: baca `node_modules/next/dist/docs/` sebelum memakai API Next. `src/proxy.ts` menggantikan middleware.
- Perintah: `npm run dev`, `npm run check` (typecheck + lint + tes + build), `npm run import` (impor sheet lama, hanya lokal).

## Peta kode
- `src/app/(app)/` halaman setelah login: Ringkasan, `uang` (Tabungan), `biaya`, `persiapan`, `tamu`, `seserahan`, `vendor`, `undangan`, `lagu`, `pengaturan`, `panduan` (khusus demo).
- `src/app/actions.ts` semua server action (login, CRUD, aksi massal, reset demo). `src/proxy.ts` sesi, CSP nonce, cookie demo, 404 foto.
- `src/lib/repo.ts` akses data (Supabase atau file lokal); `demo.ts`, `demo-ws.ts`, `demo-template.ts` akun demo; `calc.ts` hitungan uang (jangan diubah sembarangan); `fields.ts` + `validate.ts` definisi form; `security/` CSP, rate limit, URL aman.
- `src/components/entity-list.tsx` daftar CRUD generik; `bulk.tsx` aksi massal; `savings-chart.tsx` grafik.
- `supabase/migrations/` SQL. `tests/` 74 tes (`tsx --test`).

## Akun dan data
- Dua akun anggota (email di tabel `anggota`) melihat data asli di tabel `public.*`.
- Akun demo (email di tabel `penonton`) memakai tabel `public.demo_*`, satu ruang per browser (cookie `demo_ws`, header `x-demo-ws`, kolom `ws`). Tidak pernah menyentuh data asli.
- Mode lokal: `LOCAL_MODE=1` tanpa login, data di `.local-data/db.json` (jangan diubah, cadangkan dulu); `LOCAL_DEMO=1` untuk uji akun demo. Jangan commit `data/`, `.local-data/`, `.env*`, `supabase/seed.local.sql`.
- Darurat: `SECURITY_RELAXED=1` mematikan CSP dan pembatas login (env Vercel, butuh redeploy).

## SQL ke Supabase
- Dijalankan MANUAL oleh user di SQL Editor, dalam bagian kecil (tempelan besar sering gagal). Beri SQL di chat dan salin ke clipboard (`Set-Clipboard`). Jangan menjalankan SQL ke database nyata.
- Migrasi yang sudah dijalankan dan yang belum: lihat `docs/REKAP.md`.

## Aturan kerja (permintaan user)
- Balas dalam bahasa Indonesia, singkat, tanpa gaya AI generik (jangan "mari kita", "pada dasarnya", daftar berlebihan).
- Tanya sebelum commit dan push; user menjawab "gas". Cek `npm run check` dan pastikan tidak ada file pribadi sebelum push.
- Pekerjaan besar dikerjakan agent model Opus. Satu pekerjaan per chat.
- Teks UI: pendek, konkret, tanpa kalimat penjelasan generik. Warna krem/emerald, tidak ada putih murni, garis memakai `--line`. Istilah: "tabungan" (bukan "setoran"), tidak menampilkan kata "gether".
- Jangan mengetik password ke situs live; user yang login dan mengirim screenshot.
- Tes dua browser/HP asli tidak bisa dilakukan agent: minta user.
