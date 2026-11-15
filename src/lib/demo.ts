/**
 * Akun demo: logika murni (tanpa server-only) supaya bisa dites.
 *
 * Sumber kebenaran siapa akun demo: tabel public.penonton di database (dicek lewat
 * rpc is_penonton di server). Tidak ada env daftar email: satu sumber saja.
 */
import { TABLE_NAMES, type Pengaturan, type TableName } from "./types";
import type { StoreMode } from "./repo-types";

export type StoreAccess = StoreMode | "ditolak";

/**
 * Penyimpanan mana yang boleh dipakai user ini.
 * Terdaftar di penonton -> demo, MESKIPUN juga anggota: kalau email demo tidak sengaja
 * masuk ke anggota, aplikasi tetap tidak pernah membuka data asli untuk akun itu.
 * Anggota saja -> asli. Bukan keduanya (atau pengecekan gagal) -> ditolak.
 */
export function resolveStore(flags: { anggota: boolean | null | undefined; penonton: boolean | null | undefined }): StoreAccess {
  if (flags.penonton === true) return "demo";
  if (flags.anggota === true) return "asli";
  return "ditolak";
}

/** Semua tabel data yang punya salinan demo (12 tabel). */
export type DataTable = TableName | "pengaturan";
export const DATA_TABLES: readonly DataTable[] = ["pengaturan", ...TABLE_NAMES];

/**
 * Nama tabel Postgres (skema public) untuk tiap penyimpanan.
 * demo -> demo_<tabel> (salinan terpisah, RLS hanya untuk penonton); asli -> <tabel>.
 * Skema `demo` lama tidak dipakai: skema tambahan butuh "Exposed schemas" di Data API.
 */
export function tableFor<T extends DataTable>(mode: StoreMode, table: T): T | `demo_${T}` {
  return mode === "demo" ? `demo_${table}` : table;
}

/** Pesan untuk akun demo kalau tabel demo_* belum dibuat (migrasi demo_public belum dijalankan). */
export const DEMO_BELUM_SIAP =
  "Penyimpanan demo belum disiapkan. Jalankan migrasi supabase/migrations/20261115010000_demo_public.sql (3 bagian) di SQL Editor Supabase.";

/**
 * Error PostgREST/Postgres yang berarti tabel atau fungsi belum ada:
 * PGRST205 (tabel tidak ada di schema cache), PGRST202 (fungsi tidak ada), 42P01 (relasi tidak ada).
 */
export function isMissingRelation(e: { code?: string | null; message?: string | null } | null | undefined) {
  if (!e) return false;
  if (e.code === "PGRST205" || e.code === "PGRST202" || e.code === "42P01") return true;
  return /schema cache|does not exist/i.test(e.message ?? "");
}

/** Panduan pemakaian (/panduan, kartu sambutan) hanya untuk akun demo. */
export const showGuide = (mode: StoreMode) => mode === "demo";

/** File mode lokal untuk tiap penyimpanan. */
export const localFileFor = (mode: StoreMode) => (mode === "demo" ? "demo.json" : "db.json");

/** Mode lokal demo: LOCAL_DEMO=1 (atau alias lama LOCAL_VIEWER=1), hanya kalau mode lokal aktif. */
export function localDemoFlag(env: Record<string, string | undefined>, localMode: boolean) {
  return localMode && (env.LOCAL_DEMO === "1" || env.LOCAL_VIEWER === "1");
}

/** Pengaturan awal akun demo: semua kosong, tidak ada sisa data asli. */
export function emptyPengaturan(): Pengaturan {
  return {
    id: 1,
    nama_pria: "",
    nama_wanita: "",
    tanggal_nikah: null,
    target_dana: 0,
    harga_emas_manual: null,
    harga_emas_manual_tgl: null,
    harga_emas_terakhir: null,
    harga_emas_terakhir_at: null,
    souvenir_harga_satuan: null,
    souvenir_jumlah: null,
    souvenir_budget: null,
    souvenir_blindbox: null,
    souvenir_sisa_umma: null,
    souvenir_kurang: null,
  };
}

/** Judul tampilan: "A & B", atau judul netral kalau nama belum diisi. */
export function judulPasangan(p: Pick<Pengaturan, "nama_pria" | "nama_wanita">) {
  const a = p.nama_pria?.trim();
  const b = p.nama_wanita?.trim();
  if (a && b) return `${a} & ${b}`;
  return a || b || "Tracker Pernikahan";
}
