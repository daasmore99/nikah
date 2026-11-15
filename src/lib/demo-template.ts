/**
 * Isi awal ruang demo: KERANGKA CONTOH di setiap menu (kategori, tahap, beberapa item generik),
 * supaya pengunjung tinggal menambah atau mengubah. Ditulis sendiri dengan kata-kata netral:
 * tidak ada nama orang/vendor/tempat sungguhan, tidak ada link, tanggal nikah, atau nominal dari
 * data pasangan. Hampir semua nominal dikosongkan; beberapa angka bulat hanya sebagai contoh.
 * Pengaturan (nama, tanggal, target) tetap kosong. Data murni, tanpa server-only, supaya bisa dites.
 */
import type { NewRow, TableName } from "./types";

export type DemoTemplate = { [K in TableName]: Omit<NewRow<K>, "urutan" | "import_key">[] };

/** Tanggal YYYY-MM-DD, `hari` hari sebelum `today` (YYYY-MM-DD). */
function mundur(today: string, hari: number) {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - hari);
  return d.toISOString().slice(0, 10);
}

const BIAYA: [grup: NewRow<"biaya_item">["grup"], sub: string | null, nama: string[]][] = [
  ["Administrasi & MCU", null, ["Pendaftaran nikah di KUA", "Tes kesehatan pranikah", "Fotokopi & pas foto berkas"]],
  ["Lamaran", null, ["Hantaran lamaran", "Konsumsi acara lamaran", "Dekorasi sederhana lamaran"]],
  ["Mahar", null, ["Perhiasan atau logam mulia", "Kotak mahar"]],
  ["Resepsi", "Venue", ["Sewa gedung", "Biaya kebersihan & keamanan"]],
  ["Resepsi", "Dekorasi", ["Dekorasi pelaminan", "Bunga meja tamu"]],
  ["Resepsi", "Catering", ["Paket katering prasmanan", "Gubukan / stall makanan"]],
  ["Resepsi", "Dokumentasi", ["Foto & video hari H", "Album cetak"]],
  ["Resepsi", "MUA & Busana", ["Rias pengantin", "Sewa busana pengantin", "Seragam keluarga"]],
  ["Resepsi", "Hiburan", ["Organ tunggal / band akustik", "Sound system"]],
  ["Seserahan", "Alat sholat", ["Mukena", "Sajadah", "Al-Qur'an"]],
  ["Seserahan", "Pakaian", ["Gamis", "Kerudung", "Sandal"]],
  ["Seserahan", "Skincare", ["Paket perawatan wajah"]],
  ["Seserahan", "Makeup", ["Paket alat rias"]],
  ["Seserahan", "Toiletries", ["Paket perlengkapan mandi"]],
  ["Seserahan", "Lain-lain", ["Kotak hantaran"]],
];

const TAHAP: [nama: string, item: [judul: string, selesai: boolean][]][] = [
  ["Persiapan awal", [["Sepakati konsep acara", true], ["Tentukan perkiraan budget", true], ["Tentukan perkiraan jumlah tamu", false]]],
  ["Administrasi", [["Surat pengantar RT/RW", false], ["Surat keterangan dari kelurahan (N1–N4)", false], ["Pas foto latar biru", false]]],
  ["Pendaftaran & bimbingan", [["Daftar nikah di KUA", false], ["Ikut bimbingan perkawinan", false]]],
  ["Vendor", [["Survei dan booking venue", false], ["Pilih katering & jadwalkan tes rasa", false], ["Pilih fotografer & videografer", false], ["Pilih MUA", false]]],
  ["Busana & seserahan", [["Fitting busana pengantin", false], ["Belanja isi seserahan", false]]],
  ["Undangan", [["Susun daftar tamu", false], ["Desain dan cetak undangan", false], ["Kirim undangan digital", false]]],
  ["Hari H", [["Susun rundown acara", false], ["Briefing panitia & keluarga", false], ["Siapkan amplop & kotak angpao", false]]],
];

/** item administrasi yang punya centang terpisah untuk masing-masing calon */
const PER_ORANG = new Set(["Surat pengantar RT/RW", "Surat keterangan dari kelurahan (N1–N4)", "Pas foto latar biru"]);

const VENDOR = ["Venue", "Dekorasi", "MUA", "Fotografer & Videografer", "MC", "Prewedding", "Catering", "Hiburan", "Undangan", "Souvenir"];

const SESERAHAN: [kategori: string, nama: string[]][] = [
  ["Alat sholat", ["Mukena", "Sajadah"]],
  ["Pakaian", ["Gamis", "Kerudung"]],
  ["Skin care", ["Pembersih wajah", "Pelembap"]],
  ["Make up", ["Lipstik", "Bedak"]],
  ["Toiletries", ["Sabun & sampo", "Handuk"]],
];

export function demoTemplate(today: string): DemoTemplate {
  return {
    setoran: [
      { pihak: "CPP", tanggal: mundur(today, 56), jumlah: 2_000_000, lokasi: "Rekening Bersama", catatan: "Contoh setoran", saldo_awal: false },
      { pihak: "CPW", tanggal: mundur(today, 35), jumlah: 1_500_000, lokasi: "Rekening Bersama", catatan: "Contoh setoran", saldo_awal: false },
      { pihak: "CPP", tanggal: mundur(today, 14), jumlah: 1_000_000, lokasi: "Rekening Bersama", catatan: "Contoh setoran", saldo_awal: false },
    ],
    pengeluaran: [
      { jenis: "gether", tanggal: mundur(today, 7), jumlah: 250_000, keterangan: "Contoh: ongkos survei venue", potong_dana: true },
    ],
    biaya_item: BIAYA.flatMap(([grup, sub, nama]) =>
      nama.map((n) => ({
        grup, sub, nama: n, estimasi: null, realisasi: null, dp: null, status: "BELUM BAYAR" as const,
        tanggal_bayar: null, catatan: null, link: null, gram_emas: null,
      })),
    ),
    todo: TAHAP.flatMap(([bagian, items], i) =>
      items.map(([judul, selesai]) => ({
        bagian_no: i + 1, bagian, judul, selesai, tenggat: null, progres: null, detail: null, pic: null,
        cpp_selesai: PER_ORANG.has(judul) ? false : null,
        cpw_selesai: PER_ORANG.has(judul) ? false : null,
      })),
    ),
    vendor: VENDOR.map((k) => ({
      kategori: k, nama: `Contoh: ${k}`, kontak: null, telepon: null, instagram_web: null, alamat: null,
      harga: null, status: "Belum dipilih", catatan: null,
    })),
    seserahan_rekom: ["Paket hemat", "Paket lengkap"].flatMap((budget_tier) =>
      SESERAHAN.flatMap(([kategori, nama]) => nama.map((n) => ({ budget_tier, kategori, nama: n, harga: null, link: null, dibeli: false }))),
    ),
    katalog: [
      { jenis: "undangan_fisik", nama: "Contoh: undangan cetak lipat dua", harga: null, link: null, dipilih: false },
      { jenis: "undangan_fisik", nama: "Contoh: undangan cetak hardcover", harga: null, link: null, dipilih: false },
      { jenis: "undangan_digital", nama: "Contoh: undangan website", harga: null, link: null, dipilih: false },
      { jenis: "undangan_digital", nama: "Contoh: undangan video singkat", harga: null, link: null, dipilih: false },
      { jenis: "souvenir", nama: "Contoh: tumbler", harga: null, link: null, dipilih: false },
      { jenis: "souvenir", nama: "Contoh: kipas lipat", harga: null, link: null, dipilih: false },
      { jenis: "souvenir", nama: "Contoh: tanaman kecil dalam pot", harga: null, link: null, dipilih: false },
    ],
    tamu: [
      { nama: "Tamu contoh 1", relasi: "Saudara CPP", jumlah_orang: 2, status_undangan: "Belum diundang", konfirmasi: "Belum konfirmasi", catatan: null },
      { nama: "Tamu contoh 2", relasi: "Teman/Relasi CPW", jumlah_orang: 1, status_undangan: "Sudah diundang", konfirmasi: "Hadir", catatan: null },
      { nama: "Tamu contoh 3", relasi: "Teman/Relasi Orang Tua CPP", jumlah_orang: 2, status_undangan: "Sudah diundang", konfirmasi: "Belum konfirmasi", catatan: null },
    ],
    tamu_kelompok: [
      { relasi: "Saudara CPP", perkiraan: 50 },
      { relasi: "Saudara CPW", perkiraan: 50 },
      { relasi: "Teman/Relasi CPP", perkiraan: 40 },
      { relasi: "Teman/Relasi CPW", perkiraan: 40 },
      { relasi: "Teman/Relasi Orang Tua CPP", perkiraan: 60 },
      { relasi: "Teman/Relasi Orang Tua CPW", perkiraan: 60 },
    ],
    lagu: ["Saat pengantin datang", "Saat resepsi", "Saat makan", "Penutup"].map((keterangan) => ({ judul: null, keterangan })),
    lagu_rekom: [
      { judul: "Bahasa Kalbu - Titi DJ", kategori: "Indonesia", link: null },
      { judul: "Separuh Aku - NOAH", kategori: "Indonesia", link: null },
      { judul: "Kasih Putih - Glenn Fredly", kategori: "Indonesia", link: null },
      { judul: "Cinta Sejati - Bunga Citra Lestari", kategori: "Indonesia", link: null },
      { judul: "Lucky - Jason Mraz & Colbie Caillat", kategori: "Barat", link: null },
      { judul: "At Last - Etta James", kategori: "Barat", link: null },
      { judul: "From This Moment On - Shania Twain", kategori: "Barat", link: null },
      { judul: "I Don't Want to Miss a Thing - Aerosmith", kategori: "Barat", link: null },
    ],
  };
}

/** Baris template siap disisipkan (dengan urutan berurutan per tabel). */
export function demoTemplateRows(today: string): { table: TableName; rows: Record<string, unknown>[] }[] {
  const t = demoTemplate(today);
  return (Object.keys(t) as TableName[]).map((table) => ({
    table,
    rows: (t[table] as Record<string, unknown>[]).map((r, i) => ({ ...r, urutan: i + 1 })),
  }));
}
