# Tugas 07 (opsional): chat AI di dalam web

Status: ditunda. Kerjakan hanya kalau user setuju mengeluarkan biaya API. Baca `CLAUDE.md` dulu.

## Latar
Langganan Claude Pro tidak termasuk API untuk web buatan sendiri. Chat di dalam web butuh akun API Anthropic terpisah (bayar per pemakaian) dengan batas pengeluaran bulanan. Form tambah/ubah massal sudah ada, jadi nilai tambahnya hanya kenyamanan input dari HP.

## Rancangan kalau jadi
- Key API hanya di env Vercel (server), tidak pernah ke browser. Endpoint hanya untuk sesi anggota, dengan pembatas laju.
- AI mengubah kalimat menjadi aksi terstruktur (tambah tabungan, tandai lunas, dll.), ditampilkan sebagai kartu Konfirmasi/Batal; perubahan baru dijalankan setelah konfirmasi. Penghapusan dan nominal besar selalu minta konfirmasi. Semua lewat server action dan RLS yang sama.
- Model murah (Haiku). Tidak untuk akun demo.

## Selesai bila
Tes unit untuk parser aksi, uji lokal dengan model palsu, batas biaya terdokumentasi. Tanya user sebelum commit/push.
