# Tugas 02: MFA (kode autentikator) untuk akun anggota

Baca `CLAUDE.md` dulu. Kerjakan setelah tugas 01 selesai.

## Tujuan
Akun anggota (Ananda, Zalfa) wajib kode TOTP dari aplikasi autentikator saat login. Supabase menyediakan MFA TOTP gratis, tapi aplikasi belum punya layar pendaftaran dan verifikasi.

## Lingkup
- Layar pendaftaran di Pengaturan (QR + kunci manual, verifikasi kode pertama), dengan pesan Indonesia singkat.
- Langkah verifikasi setelah login password (AAL1 ke AAL2) sebelum halaman data dibuka; `src/proxy.ts` dan `requireRepo` harus menolak sesi yang belum AAL2 untuk anggota yang sudah mendaftar MFA.
- Opsi darurat: kode cadangan atau cara reset lewat dashboard Supabase (jelaskan di README).
- Akun demo tidak memakai MFA dan alurnya tidak berubah.
- Hormati pembatas login yang ada (`src/lib/security/`), dan jangan membuat kunci permanen.

## Selesai bila
Tes unit untuk logika AAL; uji lokal untuk alur UI (LOCAL_MODE tidak punya MFA: sediakan mode uji palsu yang jelas dibatasi, bukan production). `npm run check` hijau. Catat hal yang tidak bisa diuji tanpa Supabase asli.

## Batasan
Jangan menyentuh data asli. Tanya user sebelum commit/push. Gunakan agent Opus.
