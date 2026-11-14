import { GRUP_BIAYA, STATUS_BAYAR, type TableName } from "./types";

export type FieldType = "text" | "textarea" | "money" | "int" | "decimal" | "date" | "bool" | "select" | "url";

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: readonly string[];
  /** boleh isi bebas selain options (datalist) */
  free?: boolean;
  hint?: string;
  /** contoh isian di dalam kolom, mis. "Contoh: Sewa mobil pengantin" */
  placeholder?: string;
  wide?: boolean;
}

export const RELASI_TAMU = [
  "Saudara CPP", "Saudara CPW", "Teman/Relasi CPP", "Teman/Relasi CPW",
  "Teman/Relasi Orang Tua CPP", "Teman/Relasi Orang Tua CPW",
] as const;
export const STATUS_UNDANGAN = ["Belum diundang", "Sudah diundang"] as const;
export const KONFIRMASI = ["Belum konfirmasi", "Hadir", "Tidak Hadir"] as const;
export const STATUS_VENDOR = ["Dipilih", "Kandidat", "Ditolak"] as const;

/** Satu sumber kebenaran untuk form (client) dan validasi (server). */
export const FIELDS: Record<TableName, Field[]> = {
  setoran: [
    { key: "pihak", label: "Dari", type: "select", options: ["CPP", "CPW"], required: true },
    { key: "tanggal", label: "Tanggal", type: "date" },
    { key: "jumlah", label: "Jumlah", type: "money", required: true },
    { key: "lokasi", label: "Disimpan di", type: "text", options: ["Rekening Bersama"], free: true },
    { key: "catatan", label: "Catatan", type: "text", wide: true },
    { key: "saldo_awal", label: "Saldo awal (bukan setoran rutin)", type: "bool" },
  ],
  pengeluaran: [
    { key: "jenis", label: "Jenis", type: "select", options: ["gether", "seserahan"], required: true },
    { key: "tanggal", label: "Tanggal", type: "date" },
    { key: "jumlah", label: "Jumlah", type: "money", required: true },
    { key: "keterangan", label: "Untuk apa", type: "text", wide: true },
    { key: "potong_dana", label: "Diambil dari dana bersama", type: "bool", hint: "Matikan kalau dibayar pakai uang pribadi." },
  ],
  biaya_item: [
    { key: "grup", label: "Kategori", type: "select", options: GRUP_BIAYA, required: true },
    { key: "sub", label: "Sub-kategori", type: "text", free: true },
    { key: "nama", label: "Nama item", type: "text", required: true, wide: true },
    { key: "estimasi", label: "Estimasi", type: "money" },
    { key: "realisasi", label: "Realisasi", type: "money" },
    { key: "dp", label: "DP", type: "money" },
    { key: "status", label: "Status", type: "select", options: STATUS_BAYAR },
    { key: "tanggal_bayar", label: "Tanggal bayar", type: "date" },
    { key: "gram_emas", label: "Berat emas (gram)", type: "decimal", hint: "Isi kalau item ini emas, untuk estimasi nilai." },
    { key: "link", label: "Link", type: "url", wide: true },
    { key: "catatan", label: "Catatan", type: "textarea", wide: true },
  ],
  todo: [
    { key: "judul", label: "Nama persiapan", type: "text", required: true, wide: true, placeholder: "Contoh: Sewa mobil pengantin" },
    { key: "bagian", label: "Tahap", type: "text", required: true, free: true, hint: "Pilih tahap yang sudah ada, atau ketik nama tahap baru." },
    { key: "tenggat", label: "Tenggat (paling lambat)", type: "date" },
    { key: "pic", label: "Penanggung jawab (PIC)", type: "text", placeholder: "Contoh: CPP, CPW, atau Ibu" },
    { key: "progres", label: "Keterangan progres", type: "text", options: ["Belum", "Sudah DP", "Sudah", "Lunas", "Sudah ada"], free: true, placeholder: "Contoh: Sudah DP" },
    { key: "detail", label: "Catatan / detail", type: "textarea", wide: true, placeholder: "Contoh: Tanya 3 rental dulu, budget maksimal Rp1,5 jt" },
    { key: "selesai", label: "Sudah beres", type: "bool" },
    { key: "cpp_selesai", label: "Beres untuk CPP", type: "bool" },
    { key: "cpw_selesai", label: "Beres untuk CPW", type: "bool" },
  ],
  vendor: [
    { key: "kategori", label: "Kategori", type: "text", required: true, free: true,
      options: ["Venue", "Dekorasi", "MUA", "Fotografer & Videografer", "MC", "Prewedding", "Catering", "Hiburan", "Undangan", "Souvenir"] },
    { key: "nama", label: "Nama vendor", type: "text", required: true },
    { key: "status", label: "Status", type: "text", options: STATUS_VENDOR, free: true },
    { key: "harga", label: "Harga", type: "money" },
    { key: "kontak", label: "Kontak person", type: "text" },
    { key: "telepon", label: "Telepon / WA", type: "text" },
    { key: "instagram_web", label: "Instagram / web", type: "url", wide: true },
    { key: "alamat", label: "Alamat / area", type: "text", wide: true },
    { key: "catatan", label: "Catatan", type: "textarea", wide: true },
  ],
  seserahan_rekom: [
    { key: "budget_tier", label: "Paket budget", type: "text", required: true, free: true, options: ["2–3 Juta", "3–4 Juta"] },
    { key: "kategori", label: "Kategori", type: "text", required: true, free: true },
    { key: "nama", label: "Barang", type: "text", required: true, wide: true },
    { key: "harga", label: "Harga", type: "money" },
    { key: "dibeli", label: "Sudah dibeli", type: "bool" },
    { key: "link", label: "Link", type: "url", wide: true },
  ],
  katalog: [
    { key: "jenis", label: "Jenis", type: "select", options: ["souvenir", "undangan_fisik", "undangan_digital"], required: true },
    { key: "nama", label: "Nama", type: "text", required: true, wide: true },
    { key: "harga", label: "Harga / pcs", type: "money" },
    { key: "dipilih", label: "Dipilih", type: "bool" },
    { key: "link", label: "Link", type: "url", wide: true },
  ],
  tamu: [
    { key: "nama", label: "Nama", type: "text", required: true },
    { key: "relasi", label: "Relasi", type: "text", options: RELASI_TAMU, free: true },
    { key: "jumlah_orang", label: "Jumlah orang", type: "int" },
    { key: "status_undangan", label: "Undangan", type: "select", options: STATUS_UNDANGAN },
    { key: "konfirmasi", label: "Konfirmasi", type: "select", options: KONFIRMASI },
    { key: "catatan", label: "Catatan", type: "textarea", wide: true },
  ],
  tamu_kelompok: [
    { key: "relasi", label: "Kelompok", type: "text", required: true, options: RELASI_TAMU, free: true, wide: true },
    { key: "perkiraan", label: "Perkiraan jumlah", type: "int", required: true },
  ],
  lagu: [
    { key: "judul", label: "Judul - penyanyi", type: "text", wide: true },
    { key: "keterangan", label: "Diputar saat", type: "text", options: ["Saat pengantin datang", "Saat resepsi", "Saat makan", "Penutup"], free: true, wide: true },
  ],
  lagu_rekom: [
    { key: "judul", label: "Judul - penyanyi", type: "text", required: true, wide: true },
    { key: "kategori", label: "Kategori", type: "text", options: ["Indonesia", "Barat"], free: true },
    { key: "link", label: "Link", type: "url", wide: true },
  ],
};

export const PENGATURAN_FIELDS: Field[] = [
  { key: "nama_pria", label: "Nama calon pengantin pria", type: "text", required: true },
  { key: "nama_wanita", label: "Nama calon pengantin wanita", type: "text", required: true },
  { key: "tanggal_nikah", label: "Tanggal nikah", type: "date", required: true },
  { key: "target_dana", label: "Target dana", type: "money", required: true },
  { key: "harga_emas_manual", label: "Harga emas manual (per gram)", type: "money", hint: "Dipakai kalau harga otomatis gagal diambil." },
  { key: "harga_emas_manual_tgl", label: "Tanggal harga manual", type: "date" },
  { key: "souvenir_harga_satuan", label: "Harga souvenir / pcs", type: "money" },
  { key: "souvenir_jumlah", label: "Jumlah souvenir", type: "int" },
  { key: "souvenir_budget", label: "Budget souvenir", type: "money" },
  { key: "souvenir_blindbox", label: "Souvenir blindbox", type: "int" },
  { key: "souvenir_sisa_umma", label: "Sisa souvenir Umma", type: "int" },
  { key: "souvenir_kurang", label: "Souvenir kurang", type: "int" },
];
