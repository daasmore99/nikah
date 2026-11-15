# Keamanan

Aplikasi pribadi (tracker pernikahan) dengan data keuangan dan daftar tamu. Repo ini private.

## Melapor celah

Jangan membuka issue. Kirim laporan secara pribadi ke `[EMAIL-KEAMANAN]` (placeholder: ganti sendiri
dengan alamat khusus laporan, bukan email pribadi utama). Sertakan langkah reproduksi dan dampaknya.
Jangan menguji terhadap data asli atau mencoba mengakses akun orang lain.

## Ringkasan perlindungan

- Data asli hanya untuk email di `public.anggota` (RLS Postgres di semua tabel); signup publik dimatikan.
- Akun demo (`public.penonton`) hanya menyentuh tabel `demo_*`, per ruang browser (cookie `demo_ws` httpOnly),
  dengan batas di database (500 baris per tabel per ruang, 8000 per tabel, 400 ruang, 3 KB per baris).
- Login: rate limit per IP, per email+IP, per email (jeda sementara yang membesar, tanpa kunci permanen),
  field jebakan bot, pesan gagal generik, waktu respons gagal diseragamkan.
- Header: CSP dengan nonce per request (`src/proxy.ts`), HSTS 2 tahun, nosniff, X-Frame-Options DENY,
  frame-ancestors 'none', Permissions-Policy, COOP; tanpa X-Powered-By.
- Link dari isian user hanya http/https (validasi + saat render); ekspor CSV aman dari formula injection.
- Cookie sesi Supabase httpOnly + secure + SameSite=Lax. Tidak ada `service_role` key di repo atau Vercel.

## Saklar darurat

`SECURITY_RELAXED=1` (env Vercel, lalu redeploy) mematikan CSP dan rate limit aplikasi kalau keduanya
ternyata memutus fungsi. Default mati. Hapus lagi setelah penyebabnya diperbaiki.

## Kalau ada dugaan kebocoran

1. Ganti kata sandi kedua akun anggota dan akun demo (Supabase → Authentication → Users).
2. Cabut semua sesi: Supabase → Authentication → Users → pilih user → *Sign out user* / revoke sessions.
   Untuk semua sesi sekaligus, rotasi JWT signing key (Project Settings → JWT Keys) memaksa semua login ulang.
3. Rotasi anon/publishable key saja **tidak cukup** (key itu memang publik); yang melindungi data adalah RLS
   dan sesi.
4. Periksa Supabase → Logs (Auth & API) untuk IP/aktivitas aneh; periksa tabel `anggota`/`penonton` tidak berubah.
5. Pulihkan dari cadangan bila data diubah.
