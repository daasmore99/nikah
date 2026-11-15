# Tugas 03: pembersihan kecil

Baca `CLAUDE.md` dulu. Pekerjaan kecil, bisa dikerjakan langsung tanpa agent.

## Daftar
1. Akun demo masih menampilkan label pribadi: "Sisa souvenir Umma" dan "Masih kurang (catatan sheet)" di `pengaturan` dan `undangan`. Netralkan labelnya untuk SEMUA akun atau hanya demo (tanya user), tanpa mengubah angka atau kolom database.
2. `SECURITY.md` berisi placeholder `[EMAIL-KEAMANAN]`: tanya user mau diisi apa, atau hapus bagian itu.
3. Cari sisa teks yang menyiratkan "sheet" atau data pemilik di tampilan demo (`grep -ri "sheet\|umma" src`), dan teks yang terasa AI-generik di kartu sambutan dan `src/lib/panduan.ts`; tulis ulang lebih singkat.
4. Hapus komentar kode yang mengacu ke fitur yang sudah dibuang (mis. DemoIntro) kalau masih ada.

## Selesai bila
`npm run check` hijau; tanya user sebelum commit/push.
