# Tugas 01: verifikasi web live dan SQL keamanan

Jenis: interaktif dengan user (agent tidak bisa login ke situs live). Baca `CLAUDE.md` dan `docs/REKAP.md` dulu.

## Tujuan
Pastikan rilis keamanan (commit `8b65be7`) sehat di `www.zalfananda.my.id`, lalu pasang SQL pembatas login dan pengunci hak akses.

## Langkah (satu per satu, tunggu jawaban user di tiap langkah)
1. Minta user cek deployment Vercel berstatus Ready, lalu Ctrl+Shift+R. Periksa: login anggota, Ringkasan, grafik Tabungan, foto, akun demo di incognito. Kalau halaman kosong/rusak (kemungkinan CSP): rollback lewat Vercel (Deployments, deployment `87cfd0b`, Promote to Production), lalu telusuri `src/proxy.ts` dan `src/lib/security/csp.ts`.
2. Tes isolasi demo: user mengganti nama mempelai di akun demo (browser biasa), lalu membuka akun demo di incognito; nama harus kosong.
3. Cek Vercel Analytics sudah di-Enable (tab Analytics) dan data muncul.
4. SQL keamanan, urutan: bagian 1, bagian 3, lalu bagian 2 (SEGERA login ulang sebagai anggota setelahnya untuk memastikan data asli terbuka), bagian 4 (pemeriksaan: query 4a dan 4b harus kosong). Isi bagian ada di `supabase/migrations/20261117000000_ratelimit.sql` (bagian ditandai `BAGIAN 1..4`). Beri SQL di chat dan `Set-Clipboard`, satu bagian per pesan. Siapkan perintah pemulihan hak akses untuk bagian 2 sebelum user menjalankannya.
5. Update `docs/REKAP.md` (pindahkan ke "sudah").

## Selesai bila
Web live normal, bagian 1-4 sukses, pemeriksaan 4a/4b kosong, login anggota normal setelah bagian 2.

## Batasan
Jangan menjalankan SQL ke database nyata; jangan mengetik password ke situs live.
