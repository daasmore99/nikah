/**
 * Isi panduan pemakaian, KHUSUS akun demo (lihat showGuide di demo.ts).
 * Data murni supaya bisa dites: tidak boleh memuat nama, tanggal, atau angka pasangan sungguhan.
 * Setiap kalimat harus cocok dengan fitur yang benar-benar ada di komponen.
 */
export interface BagianPanduan {
  id: string;
  judul: string;
  /** halaman yang dibahas, untuk tautan "Buka ..." */
  href: string;
  /** nama halaman tujuan tautan */
  halaman: string;
  isi: string[];
  /** langkah "coba ini", ditampilkan bernomor */
  coba: string[];
}

export const PANDUAN: BagianPanduan[] = [
  {
    id: "ringkasan", judul: "Ringkasan", href: "/", halaman: "Ringkasan",
    isi: [
      "Angka besar di atas adalah hitung mundur hari menuju tanggal nikah; angkanya muncul setelah tanggal diisi di Pengaturan.",
      "Tabungan bersama membandingkan dana terkumpul dengan target dana.",
      "Tagihan berikutnya mengambil item Biaya yang belum lunas dan masih ada sisanya, yang tanggal bayarnya paling dekat di atas.",
      "Berikutnya menampilkan satu persiapan yang belum beres dengan tenggat terdekat, dan bisa langsung dicentang dari sini.",
    ],
    coba: [
      "Buka Persiapan, tambah satu persiapan dan isi tenggatnya.",
      "Kembali ke Ringkasan: persiapan tadi muncul di bagian Berikutnya.",
      "Centang kotaknya, lalu cek di Persiapan bahwa statusnya sudah beres.",
    ],
  },
  {
    id: "pengaturan", judul: "Pengaturan (isi ini dulu)", href: "/pengaturan", halaman: "Pengaturan",
    isi: [
      "Mulai dari sini: isi nama calon pengantin pria dan wanita, tanggal nikah, dan target dana.",
      "Hitung mundur, target tabungan per bulan, dan batang budget di Biaya memakai angka-angka ini.",
      "Harga emas manual hanya dipakai kalau harga otomatis gagal diambil, dan angka souvenir juga diubah di sini.",
      "Kolom uang cukup diisi angka; titik ribuan muncul sendiri.",
    ],
    coba: [
      "Buka Pengaturan.",
      "Isi dua nama, tanggal nikah, dan target dana, misalnya 50000000.",
      "Tekan Simpan, lalu lihat judul dan hitung mundur di Ringkasan berubah.",
    ],
  },
  {
    id: "tabungan", judul: "Tabungan", href: "/uang", halaman: "Tabungan",
    isi: [
      "Tabungan dicatat per pihak: CPP (calon pengantin pria) dan CPW (calon pengantin wanita).",
      "Pengeluaran bareng mengurangi dana terkumpul selama opsi Diambil dari dana bersama menyala; belanja seserahan punya bagian sendiri.",
      "Kotak Supaya sampai target menghitung tabungan per bulan sampai tanggal nikah, termasuk kalau dibagi dua.",
      "Bagian Emas menaksir nilai item Biaya yang diisi berat emas, memakai harga emas per gram.",
    ],
    coba: [
      "Di bagian tabungan pihak pria, tekan Tambah tabungan.",
      "Isi jumlah 500000 dan tanggal hari ini, lalu Simpan.",
      "Lihat angka terkumpul dan persentase target di atas ikut naik.",
    ],
  },
  {
    id: "biaya", judul: "Biaya", href: "/biaya", halaman: "Biaya",
    isi: [
      "Item dikelompokkan per kategori (Administrasi & MCU, Lamaran, Mahar, Resepsi, Seserahan) lalu per sub-kategori bebas, misalnya Makeup; ketuk kategori untuk membukanya.",
      "Status bayar ada empat: Belum bayar, Sudah DP, Belum lunas, Lunas, dan tombol di atas daftar menyaring per status.",
      "Pilih beberapa mencentang banyak item sekaligus, lalu Isi cepat mengisi realisasi, status, dan tanggal bayar (atau sekaligus Semua LUNAS); perubahan massal bisa diurungkan lewat tombol Urungkan selama pesannya masih tampil.",
      "Tambah banyak membuat beberapa item dengan kategori dan status yang sama, dan daftar bisa ditempel satu item per baris dengan format Nama, estimasi, realisasi (angka boleh 150rb atau 1,5jt).",
    ],
    coba: [
      "Tekan Tambah banyak, pilih kategori Seserahan, isi sub-kategori Parfum.",
      "Tekan Tempel daftar dari catatan / chat, tempel baris: Parfum, 150rb, 140.000",
      "Tekan Masukkan ke baris, periksa isinya, lalu tekan Simpan.",
      "Tekan Pilih beberapa, centang item tadi, pilih Isi cepat, tekan Semua LUNAS, lalu simpan.",
    ],
  },
  {
    id: "persiapan", judul: "Persiapan", href: "/persiapan", halaman: "Persiapan",
    isi: [
      "Persiapan dikelompokkan per tahap; saat menambah, pilih tahap yang ada atau ketik nama tahap baru.",
      "Centang kotak di depan persiapan kalau sudah beres, dan progres tiap tahap terlihat di bagian atas.",
      "Tenggat mengurutkan bagian Berikutnya di Ringkasan, sedangkan PIC mencatat siapa penanggung jawabnya.",
    ],
    coba: [
      "Tekan Tambah persiapan.",
      "Isi Sewa mobil pengantin, ketik tahap baru Hari H, dan pilih tenggat.",
      "Simpan, lalu centang persiapan itu.",
    ],
  },
  {
    id: "tamu", judul: "Tamu & RSVP", href: "/tamu", halaman: "Tamu & RSVP",
    isi: [
      "Per kelompok untuk perkiraan kasar, misalnya Saudara CPP 80 orang; totalnya jadi perkiraan tamu dan saran jumlah souvenir.",
      "Daftar nama untuk tamu satu per satu, lengkap dengan status undangan dan konfirmasi hadir.",
      "Tombol Belum konfirmasi, Hadir, dan Tidak Hadir menyaring daftar nama.",
    ],
    coba: [
      "Tekan Tambah kelompok, pilih Saudara CPP, isi perkiraan 80.",
      "Tekan Tambah tamu, isi satu nama, lalu ubah konfirmasinya menjadi Hadir.",
    ],
  },
  {
    id: "seserahan", judul: "Seserahan", href: "/seserahan", halaman: "Seserahan",
    isi: [
      "Barang seserahan dikelompokkan per paket budget dan kategori.",
      "Centang barang yang sudah dibeli.",
      "Uang yang benar-benar keluar untuk seserahan tetap dicatat di Biaya (kategori Seserahan), dan ringkasannya tampil di atas halaman ini.",
    ],
    coba: [
      "Tekan Tambah barang, isi paket budget 2–3 Juta, kategori Skincare, nama barang, dan harga.",
      "Simpan, lalu centang barang itu sebagai sudah dibeli.",
    ],
  },
  {
    id: "vendor", judul: "Vendor", href: "/vendor", halaman: "Vendor",
    isi: [
      "Simpan nama vendor, kategori, harga, kontak, telepon, dan Instagram atau web di satu tempat.",
      "Status Kandidat, Dipilih, atau Ditolak membantu membandingkan pilihan, dan judul halaman menghitung vendor yang sudah dipilih.",
    ],
    coba: [
      "Tekan Tambah vendor, isi kategori MUA dan satu nama vendor.",
      "Buka vendor itu lagi dan ubah statusnya menjadi Dipilih.",
    ],
  },
  {
    id: "undangan", judul: "Undangan & souvenir", href: "/undangan", halaman: "Undangan & souvenir",
    isi: [
      "Kalkulator souvenir mengalikan harga per pcs dengan jumlah lalu membandingkannya dengan budget.",
      "Kalau perkiraan tamu sudah diisi, ada tombol untuk memakai jumlah itu.",
      "Di bawahnya ada daftar Pilihan souvenir, Undangan cetak, dan Undangan digital; centang Dipilih pada yang akan dipakai.",
    ],
    coba: [
      "Ubah harga dan jumlah di kalkulator, lihat totalnya berubah.",
      "Tekan Simpan angka ini supaya tersimpan di Pengaturan.",
    ],
  },
  {
    id: "lagu", judul: "Lagu", href: "/lagu", halaman: "Lagu",
    isi: [
      "Daftar putar acara berisi lagu dan kapan diputar, misalnya Saat pengantin datang, untuk diserahkan ke band atau operator musik.",
      "Daftar Rekomendasi bisa dicari, dan tombol Pakai menyalin lagu ke daftar putar acara.",
    ],
    coba: [
      "Tekan Tambah lagu, isi judul - penyanyi, dan pilih Diputar saat.",
      "Kalau ada lagu di Rekomendasi, tekan Pakai pada salah satunya.",
    ],
  },
  {
    id: "ekspor", judul: "Ekspor CSV", href: "/biaya", halaman: "Biaya",
    isi: [
      "Setiap daftar punya tombol Ekspor CSV di kanan atas daftar.",
      "File CSV bisa dibuka di Excel atau Google Sheets.",
    ],
    coba: [
      "Buka Biaya, tekan Ekspor CSV, lalu buka file yang terunduh.",
    ],
  },
  {
    id: "reset", judul: "Reset data demo", href: "/pengaturan#reset-demo", halaman: "Pengaturan",
    isi: [
      "Untuk mulai lagi, buka Pengaturan bagian Data demo: semua isian dihapus dan setiap menu diisi lagi dengan contoh awal.",
      "Reset tidak bisa dibatalkan, jadi ada konfirmasi dengan mengetik RESET.",
    ],
    coba: [
      "Buka Pengaturan, tekan Reset data demo.",
      "Ketik RESET, lalu tekan Ya, kembalikan ke contoh awal.",
    ],
  },
];

/** Tiga langkah pertama di kartu sambutan Ringkasan. */
export const LANGKAH_AWAL = [
  { href: "/pengaturan", halaman: "Pengaturan", teks: "Isi nama & tanggal di Pengaturan" },
  { href: "/uang", halaman: "Tabungan", teks: "Tambah satu tabungan di halaman Tabungan" },
  { href: "/biaya", halaman: "Biaya", teks: "Coba Pilih beberapa di Biaya" },
] as const;
