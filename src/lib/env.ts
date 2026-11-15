import { localDemoFlag } from "./demo";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * Mode lokal: hanya untuk mencoba UI di laptop sendiri tanpa Supabase.
 * Data dibaca/ditulis ke .local-data/db.json (di-.gitignore). Tidak pernah aktif
 * di production, dan tidak aktif kalau Supabase sudah dikonfigurasi.
 */
export const localMode =
  !supabaseConfigured && process.env.NODE_ENV !== "production" && process.env.LOCAL_MODE === "1";

/**
 * Mode lokal sebagai akun demo: LOCAL_DEMO=1 (alias lama: LOCAL_VIEWER=1).
 * Pakai .local-data/demo.json yang mulai kosong; db.json tidak disentuh.
 * Ikut mati bersama mode lokal (production / Supabase terisi).
 */
export const localDemo = localDemoFlag(process.env, localMode);
