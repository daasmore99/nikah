/**
 * Bantuan form login (logika murni, dipakai server action dan form).
 */

/** Nama field jebakan: tersembunyi dari manusia, sering diisi bot pengisi form otomatis. */
export const HONEYPOT_FIELD = "situs_web";

/** Durasi minimum respons login GAGAL (ms) supaya waktu tidak membedakan sebab kegagalan. */
export const MIN_GAGAL_MS = 900;

/** Sisa waktu tunggu (ms) agar total = MIN_GAGAL_MS + jitter acak 0-250 ms. */
export function sisaJeda(mulai: number, sekarang: number, jitter: number): number {
  return Math.max(0, MIN_GAGAL_MS + Math.min(250, Math.max(0, jitter)) - (sekarang - mulai));
}

export async function seragamkanWaktu(mulai: number): Promise<void> {
  const jitter = globalThis.crypto.getRandomValues(new Uint16Array(1))[0] % 251;
  const ms = sisaJeda(mulai, Date.now(), jitter);
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}
