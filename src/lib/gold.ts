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
/** Hanya dua URL tetap ini yang pernah diambil (tidak ada URL dari input user). */
const SUMBER = {
  xau: "https://api.gold-api.com/price/XAU",
  fx: "https://open.er-api.com/v6/latest/USD",
} as const;
const MAKS_BYTE = 64 * 1024; // respons JSON kecil; lebih dari ini = tolak

/** fetch JSON dengan timeout 5 dtk, redirect hanya ke host sama, ukuran respons dibatasi. Gagal apa pun -> null. */
async function ambilJson(url: string): Promise<{ [k: string]: unknown } | null> {
  const r = await fetch(url, {
    next: { revalidate: CACHE_DETIK },
    signal: AbortSignal.timeout(5000),
    headers: { accept: "application/json" },
  });
  // redirect hanya diterima kalau tetap di host yang sama (https)
  if (r.url && new URL(r.url).origin !== new URL(url).origin) return null;
  if (!r.ok || !r.body) return null;
  if (Number(r.headers.get("content-length") ?? 0) > MAKS_BYTE) return null;
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAKS_BYTE) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  const json: unknown = JSON.parse(new TextDecoder().decode(buf));
  return json && typeof json === "object" ? (json as { [k: string]: unknown }) : null;
}

export async function ambilHargaOtomatis(): Promise<{ perGram: number; waktu: string } | null> {
  try {
    const [xau, fx] = (await Promise.all([ambilJson(SUMBER.xau), ambilJson(SUMBER.fx)])) as [
      { price?: unknown; updatedAt?: unknown } | null,
      { rates?: { IDR?: unknown } } | null,
    ];
    const usdOz = Number(xau?.price);
    const idr = Number(fx?.rates?.IDR);
    if (!(usdOz > 100 && usdOz < 100_000) || !(idr > 1000 && idr < 100_000)) return null;
    return { perGram: Math.round((usdOz * idr) / TROY_OZ_GRAM), waktu: String(xau?.updatedAt ?? new Date().toISOString()).slice(0, 40) };
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
