# Tugas 06: langkah manual untuk user (tanpa kode)

Hanya daftar centang. Tandai selesai di sini setiap kali dikerjakan. (G) gratis, (B) berbayar, (?) posisi menu perlu dicek.

## Prioritas tinggi
- [ ] Google Sheet sumber data lama: ubah sharing ke Restricted (isinya data keuangan asli; ID-nya ada di `src/lib/import/sheet.ts`). (G)
- [ ] Ganti password akun demo (sudah pernah tertulis di chat). (G)
- [ ] Aktifkan 2FA di akun Supabase, Vercel, GitHub. (G)
- [ ] Supabase Auth: syarat password minimal 12 karakter + huruf, angka, simbol; turunkan batas sign-in per IP (mis. 10-15 per 5 menit). (G, ?)
- [ ] Matikan proses `next start` lama di laptop: PowerShell `Stop-Process -Id 2928` atau tutup terminalnya. (G)

## Pemeliharaan
- [ ] Aktifkan pg_cron (Database, Extensions) lalu jadwalkan pembersihan demo dan rate limit (perintahnya ada di komentar `20261117000000_ratelimit.sql` bagian 3). (G)
- [ ] Cadangan data: ekspor CSV tiap halaman sebulan sekali, simpan di luar repo (paket gratis Supabase tidak punya backup yang bisa diunduh). (G)
- [ ] Vercel: Deployment Protection untuk preview; Firewall, Attack Challenge Mode saat diserang. (G, ?)
- [ ] GitHub: repo tetap private, Dependabot alerts dan security updates aktif. (G)
- [ ] Vercel Analytics: Enable di tab Analytics. (G)
- [ ] Setelah yakin: `drop schema if exists demo cascade;` untuk skema demo lama.
- [ ] Opsional: leaked password protection Supabase (B, Pro). Secret scanning GitHub untuk repo private (B).

## Kalau ada kebocoran
Ikuti `SECURITY.md`: ganti password semua akun, revoke sesi, cek Logs Auth/API dan tabel `anggota`/`penonton`, pulihkan dari cadangan. Rotasi anon key saja tidak cukup.
