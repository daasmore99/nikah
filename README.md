# Ananda & Zalfa · catatan pernikahan

Web pribadi untuk persiapan dan uang pernikahan (10 April 2027).
Next.js 16 (App Router, TypeScript) + Supabase (Postgres + Auth), deploy di Vercel. Semua tier gratis.

Data awal diimpor sekali dari Google Sheet, setelah itu semua input lewat web.

## Struktur

```
src/app/(app)/        halaman setelah login: ringkasan, uang, biaya, persiapan, tamu,
                      seserahan, vendor, undangan, lagu, pengaturan
src/app/login/        halaman masuk (email + kata sandi)
src/app/actions.ts    server actions: tambah/ubah/hapus + validasi + login/keluar
src/proxy.ts          refresh sesi Supabase, arahkan tamu ke /login
src/lib/repo.ts       akses data (Supabase, atau file lokal untuk mencoba)
src/lib/fields.ts     definisi kolom tiap tabel (form + validasi server)
src/lib/calc.ts       hitungan: dana terkumpul, target bulanan, biaya, countdown
src/lib/gold.ts       harga emas otomatis + cadangan
src/lib/import/       parser CSV sheet + pembanding total
scripts/import-sheet.ts  impor sheet -> data/import.json + supabase/seed.local.sql
supabase/migrations/  skema SQL + RLS
tests/import.test.ts  tes impor: angka hasil impor vs total di sheet
```

`data/`, `.local-data/`, `supabase/seed.local.sql` dan `.env*` ada di `.gitignore` karena berisi data pribadi.
Jangan di-commit.

## Jalankan di laptop (tanpa Supabase)

```bash
npm install
npm run import          # unduh sheet, tulis data/import.json + supabase/seed.local.sql
echo LOCAL_MODE=1 > .env.local
npm run dev             # http://localhost:3000
```

Mode lokal tidak pakai login dan menyimpan perubahan di `.local-data/db.json`. Hapus file itu untuk mulai ulang dari data sheet.
Mode ini mati otomatis di production dan kalau env Supabase terisi.

Cek semuanya sekaligus: `npm run check` (typecheck, lint, tes impor, build).

## Pasang sungguhan (dikerjakan sendiri)

### 1. Supabase

1. Buat project di <https://supabase.com> (region Singapore paling dekat).
2. **SQL Editor** → tempel isi `supabase/migrations/20261114000000_init.sql` → Run.
3. Daftarkan dua email yang boleh masuk (SQL Editor):
   ```sql
   insert into public.anggota (email, nama) values
     ('email-ananda@contoh.com', 'Ananda'),
     ('email-zalfa@contoh.com', 'Zalfa');
   ```
4. **Authentication → Users → Add user → Create new user**: buat dua user dengan email di atas,
   centang *Auto Confirm User*, isi kata sandi masing-masing.
5. **Authentication → Sign In / Providers → Email**: matikan **Allow new users to sign up**.
   (Kalaupun ada yang berhasil daftar, RLS tetap menolak karena emailnya tidak ada di `anggota`.)
6. **Authentication → URL Configuration**: Site URL `https://zalfananda.my.id`.
7. Impor data sheet: jalankan `npm run import` di laptop, lalu buka `supabase/seed.local.sql`,
   tempel ke SQL Editor → Run. Aman diulang: baris yang sudah ada tidak diduplikasi dan perubahan dari web tidak ditimpa.

Semua tabel memakai Row Level Security: hanya user ter-login yang emailnya ada di `anggota` yang bisa baca/tulis.
Kolom `created_by` / `updated_by` terisi otomatis dari akun yang menginput.

### 2. Vercel

1. Push folder ini ke repo GitHub **private**.
2. Vercel → Add New Project → import repo. Framework terdeteksi Next.js.
3. Environment Variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL (Supabase → Project Settings → API)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon / publishable key
4. Deploy. Kalau env diubah belakangan, **Redeploy** (nilai `NEXT_PUBLIC_*` dibaca saat build).

Jangan pernah memasang `service_role` key di Vercel atau di repo. Web ini tidak membutuhkannya.

### 3. Domain zalfananda.my.id

1. Vercel → Project → Settings → Domains → tambah `zalfananda.my.id` dan `www.zalfananda.my.id`
   (pilih redirect `www` ke apex).
2. Buka panel DNS di tempat domain .my.id dibeli (menu *DNS Management / Kelola DNS*). Hapus record A/CNAME bawaan
   parkir untuk `@` dan `www`, lalu tambah:

   | Tipe  | Nama / Host | Nilai                  |
   |-------|-------------|------------------------|
   | A     | `@`         | `76.76.21.21`          |
   | CNAME | `www`       | `cname.vercel-dns.com` |

   Kalau Vercel menampilkan nilai lain di halaman Domains, pakai yang ditampilkan Vercel.
   Kalau panel tidak menerima `@`, kosongkan kolom host atau isi `zalfananda.my.id.`
3. Tunggu propagasi (biasanya menit–jam). Vercel memasang HTTPS otomatis.

Mau pakai subdomain saja (mis. `catatan.zalfananda.my.id`)? Tambahkan domain itu di Vercel dan cukup satu
`CNAME catatan → cname.vercel-dns.com`. Ganti juga Site URL di Supabase.

## Catatan data hasil impor

Hasil `npm run import` (13–14 Nov 2026) dibanding angka yang tertulis di sheet:

| Angka | Sheet | Hitung ulang dari baris | Sebab |
|---|---|---|---|
| Dana terkumpul | Rp34.185.759 | Rp34.685.759 | Setoran Zalfa 1 Nov 2026 Rp500.000 tidak punya nilai Saldo, jadi saldo sheet berhenti di 30 Sep |
| Sisa dana | Rp35.814.241 | Rp35.314.241 | akibat baris di atas |
| Realisasi biaya (ringkasan atas) | Rp2.178.310 | Rp20.936.310 | rumus sheet hanya menjumlah Seserahan; Lamaran 1.720.000 dan Mahar 17.038.000 tidak ikut |
| Rangkuman total estimasi / realisasi | 26.376.600 / 19.216.310 | 28.096.600 / 20.936.310 | tabel RANGKUMAN tidak memuat Lamaran |
| Jumlah status LUNAS | 2 | 19 | sheet hanya hitung Mahar+Resepsi; di web status "SUDAH BAYAR" Seserahan = LUNAS, cincin Lamaran ikut |
| Total checklist | 75 | 72 | 3 baris centang kosong tanpa judul tidak diimpor |

Angka lain cocok persis (target 70 jt, setoran CPP 10,5 jt, setoran CPW 15,6 jt, outcome gether 6.508.000,
outcome seserahan 1.937.774, tiap kategori biaya, status BELUM BAYAR 23 / SUDAH DP 10, checklist sudah 14,
perkiraan tamu 1.300, seserahan dibeli 1.770.400 dan 1.333.000, kalkulator souvenir 600.000).

Lain-lain:
- Saldo awal Zalfa Rp15.093.759 tidak tertulis sebagai setoran; disimpulkan dari kolom Saldo baris pertama (15.593.759 − 500.000) dan disimpan sebagai baris "saldo awal".
- Tanggal nikah dipakai 10 April 2027 (Summary). Detail To-Do masih menulis "10 April 2026", dibiarkan apa adanya.
- Perkiraan tamu pakai tabel kedua di tab Tamu (1.300). Summary (100) dan To-Do (1000) diabaikan.
- 3 baris tamu tanpa nama tidak diimpor. Sel harga emas di sheet `#VALUE!`, jadi harga emas manual kosong.
- Tanggal bayar cincin ada di kolom Detail sheet, dipindah ke kolom tanggal bayar.

## Harga emas

Diambil di server dari harga spot dunia: XAU/USD (`api.gold-api.com`) × USD/IDR (`open.er-api.com`) ÷ 31,1035 g,
di-cache 6 jam. Tidak ada data pribadi yang dikirim. Kalau gagal: harga manual di Pengaturan, lalu harga otomatis
terakhir yang tersimpan. Ini harga emas murni 24K; nilai jual perhiasan biasanya lebih rendah.
