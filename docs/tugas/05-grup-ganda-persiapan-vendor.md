# Tugas 05: grup ganda karena beda huruf (Persiapan, Vendor)

Baca `CLAUDE.md` dulu.

## Latar
Di Biaya, sub-kategori "makeup" dan "Makeup" sudah dianggap sama (`src/components/entity-list.tsx`, fungsi `canonSub` dan pengelompokan). Pola yang sama mungkin masih ada di kolom yang diketik bebas: `bagian` (Tahap) di Persiapan, `kategori` di Vendor, `relasi` di Tamu, `kategori` di Seserahan. Belum diuji.

## Langkah
1. Reproduksi di mode lokal (cadangkan `.local-data/db.json` dulu, pulihkan setelahnya): tambah item dengan tahap/kategori beda huruf, lihat apakah muncul grup baru.
2. Kalau ya, terapkan pencocokan tanpa beda huruf/spasi pada pengelompokan `groupBy` dan saran di form, dengan pola yang sama seperti `canonSub`.
3. Tambahkan tes unit untuk logika murni.

## Selesai bila
Tidak ada grup ganda untuk ejaan yang hanya beda huruf besar/kecil/spasi; data lokal pulih (md5 sama); `npm run check` hijau; tanya user sebelum commit/push.
