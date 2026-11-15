export type StatusBayar = "BELUM BAYAR" | "SUDAH DP" | "BELUM LUNAS" | "LUNAS";
export const STATUS_BAYAR: StatusBayar[] = ["BELUM BAYAR", "SUDAH DP", "BELUM LUNAS", "LUNAS"];

export const GRUP_BIAYA = ["Administrasi & MCU", "Lamaran", "Mahar", "Resepsi", "Seserahan"] as const;
export type GrupBiaya = (typeof GRUP_BIAYA)[number];

interface Base {
  id: string;
  urutan: number;
  import_key?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Pengaturan {
  id: number;
  nama_pria: string;
  nama_wanita: string;
  /** null hanya di akun demo yang belum mengisi tanggal */
  tanggal_nikah: string | null;
  target_dana: number;
  harga_emas_manual: number | null;
  harga_emas_manual_tgl: string | null;
  harga_emas_terakhir: number | null;
  harga_emas_terakhir_at: string | null;
  souvenir_harga_satuan: number | null;
  souvenir_jumlah: number | null;
  souvenir_budget: number | null;
  souvenir_blindbox: number | null;
  souvenir_sisa_umma: number | null;
  souvenir_kurang: number | null;
  updated_at?: string;
}

export interface Setoran extends Base {
  pihak: "CPP" | "CPW";
  tanggal: string | null;
  jumlah: number;
  lokasi: string | null;
  catatan: string | null;
  saldo_awal: boolean;
}

export interface Pengeluaran extends Base {
  jenis: "gether" | "seserahan";
  tanggal: string | null;
  jumlah: number;
  keterangan: string | null;
  potong_dana: boolean;
}

export interface BiayaItem extends Base {
  grup: GrupBiaya;
  sub: string | null;
  nama: string;
  estimasi: number | null;
  realisasi: number | null;
  dp: number | null;
  status: StatusBayar | null;
  tanggal_bayar: string | null;
  catatan: string | null;
  link: string | null;
  gram_emas: number | null;
}

export interface Todo extends Base {
  bagian_no: number;
  bagian: string;
  judul: string;
  selesai: boolean;
  tenggat: string | null;
  progres: string | null;
  cpp_selesai: boolean | null;
  cpw_selesai: boolean | null;
  detail: string | null;
  pic: string | null;
}

export interface Vendor extends Base {
  kategori: string;
  nama: string;
  kontak: string | null;
  telepon: string | null;
  instagram_web: string | null;
  alamat: string | null;
  harga: number | null;
  status: string | null;
  catatan: string | null;
}

export interface SeserahanRekom extends Base {
  budget_tier: string;
  kategori: string;
  nama: string;
  harga: number | null;
  link: string | null;
  dibeli: boolean;
}

export interface Katalog extends Base {
  jenis: "souvenir" | "undangan_fisik" | "undangan_digital";
  nama: string;
  harga: number | null;
  link: string | null;
  dipilih: boolean;
}

export interface Tamu extends Base {
  nama: string;
  relasi: string | null;
  jumlah_orang: number | null;
  status_undangan: string | null;
  konfirmasi: string | null;
  catatan: string | null;
}

export interface TamuKelompok extends Base {
  relasi: string;
  perkiraan: number;
}

export interface Lagu extends Base {
  judul: string | null;
  keterangan: string | null;
}

export interface LaguRekom extends Base {
  judul: string;
  kategori: string | null;
  link: string | null;
}

export interface Tables {
  setoran: Setoran;
  pengeluaran: Pengeluaran;
  biaya_item: BiayaItem;
  todo: Todo;
  vendor: Vendor;
  seserahan_rekom: SeserahanRekom;
  katalog: Katalog;
  tamu: Tamu;
  tamu_kelompok: TamuKelompok;
  lagu: Lagu;
  lagu_rekom: LaguRekom;
}
export type TableName = keyof Tables;
export const TABLE_NAMES: TableName[] = [
  "setoran", "pengeluaran", "biaya_item", "todo", "vendor", "seserahan_rekom",
  "katalog", "tamu", "tamu_kelompok", "lagu", "lagu_rekom",
];

export type Row<T extends TableName> = Tables[T];
export type NewRow<T extends TableName> = Omit<Tables[T], "id" | "created_by" | "created_at" | "updated_at">;

export interface ImportData {
  pengaturan: Omit<Pengaturan, "id">;
  tables: { [K in TableName]: NewRow<K>[] };
}
