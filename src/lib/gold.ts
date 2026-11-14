import "server-only";
import type { Pengaturan } from "./types";

const TROY_OZ_GRAM = 31.1034768;
const CACHE_DETIK = 6 * 60 * 60; // 6 jam, di-cache server oleh Next

export interface HargaEmas {
  perGram: number;
  sumber: "otomatis" | "manual" | "terakhir";
  keterangan: string;
  waktu: string | null;
}

/**
 * Harga emas 24K per gram dalam rupiah dari harga spot dunia:
 *   XAU/USD (api.gold-api.com) x USD/IDR (open.er-api.com) / 31,1035.
 * Keduanya publik tanpa API key; tidak ada data pribadi yang dikirim.
 */
export async function ambilHargaOtomatis(): Promise<{ perGram: number; waktu: string } | null> {
  try {
    const opt = { next: { revalidate: CACHE_DETIK }, signal: AbortSignal.timeout(5000) };
    const [xau, fx] = await Promise.all([
      fetch("https://api.gold-api.com/price/XAU", opt).then((r) => (r.ok ? r.json() : null)),
      fetch("https://open.er-api.com/v6/latest/USD", opt).then((r) => (r.ok ? r.json() : null)),
    ]);
    const usdOz = Number(xau?.price);
    const idr = Number(fx?.rates?.IDR);
    if (!(usdOz > 100 && usdOz < 100_000) || !(idr > 1000 && idr < 100_000)) return null;
    return { perGram: Math.round((usdOz * idr) / TROY_OZ_GRAM), waktu: String(xau.updatedAt ?? new Date().toISOString()) };
  } catch {
    return null;
  }
}

/** Urutan: otomatis -> manual (Pengaturan) -> harga otomatis terakhir yang tersimpan -> null. */
export function pilihHarga(auto: { perGram: number; waktu: string } | null, p: Pengaturan): HargaEmas | null {
  if (auto) return { perGram: auto.perGram, sumber: "otomatis", keterangan: "Spot emas dunia 24K", waktu: auto.waktu };
  if (p.harga_emas_manual)
    return { perGram: p.harga_emas_manual, sumber: "manual", keterangan: "Harga manual dari Pengaturan", waktu: p.harga_emas_manual_tgl };
  if (p.harga_emas_terakhir)
    return { perGram: p.harga_emas_terakhir, sumber: "terakhir", keterangan: "Harga otomatis terakhir yang berhasil diambil", waktu: p.harga_emas_terakhir_at };
  return null;
}

/** Simpan harga otomatis terakhir ke Pengaturan sebagai cadangan, paling sering tiap 6 jam. */
export async function simpanCadangan(
  auto: { perGram: number } | null,
  p: Pengaturan,
  save: (v: Record<string, unknown>) => Promise<void>,
) {
  if (!auto) return;
  const umur = p.harga_emas_terakhir_at ? Date.now() - Date.parse(p.harga_emas_terakhir_at) : Infinity;
  if (umur < CACHE_DETIK * 1000) return;
  try {
    await save({ harga_emas_terakhir: auto.perGram, harga_emas_terakhir_at: new Date().toISOString() });
  } catch {
    // cadangan saja; gagal simpan tidak boleh mengganggu halaman
  }
}
