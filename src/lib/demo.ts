/**
 * Akun demo: logika murni (tanpa server-only) supaya bisa dites.
 *
 * Sumber kebenaran siapa akun demo: tabel public.penonton di database (dicek lewat
 * rpc is_penonton di server). Tidak ada env daftar email: satu sumber saja.
 */
import type { Pengaturan } from "./types";
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

/** Skema Postgres untuk tiap penyimpanan. */
export const schemaFor = (mode: StoreMode) => (mode === "demo" ? "demo" : "public");

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
