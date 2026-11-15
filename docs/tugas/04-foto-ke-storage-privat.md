# Tugas 04: pindahkan foto pasangan ke penyimpanan privat

Baca `CLAUDE.md` dulu.

## Masalah
`public/foto-kami.jpg` ikut di-commit ke GitHub (repo private) dan di-deploy. `src/proxy.ts` sudah membatasi foto hanya untuk anggota (404 untuk demo), tapi file tetap ada di repo dan riwayat git.

## Tujuan
Simpan foto di Supabase Storage bucket privat; tampilkan lewat URL bertanda tangan atau route server yang hanya melayani anggota. Hapus file dari `public/` dan dari repo (riwayat git lama tetap berisi; jelaskan ke user bahwa repo harus tetap private).

## Catatan
- `src/components/couple-photo.tsx` punya fallback monogram; pertahankan.
- Langkah di Supabase (membuat bucket + policy) dilakukan manual oleh user: beri SQL/langkah per bagian kecil.
- Foto asli ada di luar repo: `C:\Users\SoftNet\Documents\Claude\foto-asli\fotokami.JPG`.

## Selesai bila
Foto tampil untuk anggota, tidak untuk demo, tidak ada lagi di `public/`; `npm run check` hijau; tanya user sebelum commit/push.
