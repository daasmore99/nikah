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
  "Penyimpanan demo belum disiapkan. Jalankan migrasi supabase/migrations/20261115010000_demo_public.sql lalu 20261116000000_demo_workspace.sql (masing-masing 3 bagian) di SQL Editor Supabase.";

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

/* ---------------- ruang demo per pengunjung (workspace) ---------------- */

/**
 * Tiap browser yang memakai akun demo punya ruang data sendiri: uuid v4 acak di cookie httpOnly
 * `demo_ws`. Di Supabase uuid ini dikirim sebagai header `x-demo-ws`; RLS hanya membuka baris
 * dengan ws = header (isolasi berbasis kapabilitas: cukup untuk data demo, bukan untuk rahasia).
 * Akun asli tidak pernah mendapat cookie ini dan tidak pernah mengirim header ini.
 */
export const DEMO_WS_COOKIE = "demo_ws";
export const DEMO_WS_HEADER = "x-demo-ws";
const WS_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** uuid v4 huruf kecil, persis 36 karakter: satu-satunya bentuk ws yang diterima (juga mencegah path traversal). */
export function isDemoWs(v: unknown): v is string {
  return typeof v === "string" && WS_RE.test(v);
}

export function newDemoWs(): string {
  return globalThis.crypto.randomUUID();
}

export const DEMO_WS_MAX_AGE = 60 * 60 * 24 * 30; // 30 hari

export function demoWsCookieOptions(production: boolean) {
  return { httpOnly: true, secure: production, sameSite: "lax" as const, path: "/", maxAge: DEMO_WS_MAX_AGE };
}

/**
 * Apa yang dilakukan proxy terhadap cookie demo_ws.
 * demo + cookie valid -> keep; demo + tidak ada/rusak -> set (uuid baru);
 * bukan demo + ada cookie -> delete; bukan demo tanpa cookie -> none.
 */
export function wsCookieAction(demo: boolean, current: string | undefined): "keep" | "set" | "delete" | "none" {
  if (demo) return isDemoWs(current) ? "keep" : "set";
  return current === undefined ? "none" : "delete";
}

/** Header tambahan untuk klien Supabase: hanya mode demo dengan ws valid. Akun asli: selalu kosong. */
export function demoHeaders(mode: StoreMode, ws: string | null | undefined): Record<string, string> {
  if (mode !== "demo") return {};
  if (!isDemoWs(ws)) throw new Error("Ruang demo tidak valid");
  return { [DEMO_WS_HEADER]: ws };
}

/** Pesan kalau request demo tidak membawa cookie ruang (mis. sebelum proxy sempat memasangnya). */
export const DEMO_WS_HILANG = "Ruang demo untuk browser ini belum siap. Muat ulang halaman (atau keluar lalu masuk lagi).";

/** Batas baris per tabel per ruang (sama dengan trigger demo_batas_ws di migrasi). */
export const DEMO_BATAS_BARIS = 500;

/** Pesan ramah untuk batas ukuran data demo (trigger demo_batas_ws, errcode 54000). */
export const DEMO_BATAS =
  "Batas data demo tercapai (maksimal 500 baris per tabel). Hapus sebagian data atau pakai Reset data demo di Pengaturan.";

export function isDemoLimit(e: { code?: string | null; message?: string | null } | null | undefined) {
  if (!e) return false;
  return e.code === "54000" || /Batas data demo tercapai|Kuota demo penuh|Isian demo terlalu panjang/.test(e.message ?? "");
}

/** Kuota global akun demo penuh (trigger demo_batas_ws, migrasi 20261117000000). */
export const DEMO_PENUH = "Kuota akun demo sedang penuh. Coba lagi nanti.";
export const DEMO_TERLALU_PANJANG = "Isian terlalu panjang untuk akun demo. Persingkat teksnya.";

/** Pesan ramah yang cocok untuk tiap jenis batas demo (semua errcode 54000). */
export function demoLimitMessage(e: { message?: string | null } | null | undefined): string {
  const m = e?.message ?? "";
  if (/Kuota demo penuh/.test(m)) return DEMO_PENUH;
  if (/terlalu panjang/.test(m)) return DEMO_TERLALU_PANJANG;
  return DEMO_BATAS;
}

/** Kolom ws / PK pengaturan per ruang belum ada = migrasi demo_workspace belum dijalankan. */
export function isDemoSchemaOld(e: { code?: string | null; message?: string | null } | null | undefined) {
  if (!e) return false;
  return isMissingRelation(e) || e.code === "42703" || e.code === "42P10" || e.code === "PGRST204";
}

/**
 * File mode lokal untuk tiap penyimpanan. Demo: satu file per ruang, `demo-<uuid>.json`.
 * ws divalidasi ketat (uuid v4) supaya tidak pernah bisa keluar dari .local-data.
 */
export function localFileFor(mode: StoreMode, ws?: string | null): string {
  if (mode !== "demo") return "db.json";
  if (!isDemoWs(ws)) throw new Error("Ruang demo tidak valid");
  return `demo-${ws}.json`;
}

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
