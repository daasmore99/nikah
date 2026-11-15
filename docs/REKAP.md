# Rekap pekerjaan

Diperbarui: 15 Nov 2026. Kode terakhir di GitHub: commit `8b65be7`. Satu pekerjaan = satu chat; brief-nya di `docs/tugas/`.

## Sudah selesai dan live
- Web dengan 10 halaman (Ringkasan, Tabungan, Biaya, Persiapan, Tamu & RSVP, Seserahan, Vendor, Undangan & souvenir, Lagu, Pengaturan), data asli diimpor dari Google Sheet ke Supabase.
- Domain `zalfananda.my.id` (DNS di Sumopod) ke Vercel; login 2 akun anggota.
- Desain krem/emerald, animasi, foto pasangan, grafik tabungan dengan arsir "terpakai".
- CRUD lengkap, aksi massal (pilih beberapa, ubah massal, isi cepat, tambah banyak), saran sub-kategori tanpa beda huruf/spasi.
- Akun demo: tabel `demo_*`, satu ruang per pengunjung, isi contoh awal, panduan khusus demo, tombol kembalikan ke contoh.
- Vercel Analytics terpasang di kode (perlu diaktifkan di dashboard Vercel, belum dikonfirmasi).
- Istilah diganti: "setoran" jadi "tabungan"; "(gether)" dihapus dari label.
- Keamanan (kode, commit `8b65be7`): CSP nonce + header, pembatas login, kuota demo, validasi URL, CSV aman, CI GitHub, Dependabot.

## SQL di Supabase
Sudah dijalankan: `20261114000000_init.sql`, `20261115000000_demo.sql` (skema `demo` lama, sudah tidak dipakai), `20261115010000_demo_public.sql`, `20261116000000_demo_workspace.sql` (3 bagian).
BELUM dijalankan: `20261117000000_ratelimit.sql` (bagian 1, 3, 2, 4; lihat tugas 01).

## Belum / menunggu
1. Verifikasi web live setelah deploy keamanan, lalu SQL keamanan (tugas 01, interaktif dengan user).
2. Tes dua browser untuk demo terpisah: user belum mengabari hasilnya.
3. MFA untuk akun anggota (tugas 02).
4. Pembersihan kecil: label pribadi di akun demo, placeholder SECURITY.md (tugas 03).
5. Foto ke penyimpanan privat (tugas 04).
6. Cek grup ganda di Persiapan/Vendor (tugas 05).
7. Langkah manual user di dashboard (tugas 06).
8. Opsional: chat AI di web (tugas 07), hanya kalau user mau mengeluarkan biaya API.

## Hal yang diketahui belum terbukti
- CSP belum pernah jalan di Vercel sungguhan; SQL keamanan belum pernah jalan di Postgres.
- Aksi massal "Isi cepat" di Supabase bisa berhasil sebagian (pesan "N tersimpan, M gagal").
- Tampilan di HP fisik (kelancaran animasi, baterai) belum dicek.
- Proses `next start` lama mungkin masih hidup di laptop user (port 3219, pid 2928); user yang mematikan.

## Keputusan penting
- Data demo terpisah per browser (kapabilitas lewat header, bukan identitas): cukup untuk data demo, bukan rahasia.
- Pembatas login punya jeda sementara, tidak pernah kunci permanen; akibatnya pihak lain bisa mengunci login 5-30 menit.
- Skema `demo` lama dibiarkan; hapus dengan `drop schema demo cascade` hanya setelah yakin.
