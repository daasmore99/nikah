/**
 * Sel CSV aman untuk Excel/Sheets (logika murni).
 * Formula injection: teks yang diawali = + - @ (atau tab / CR) akan dieksekusi sebagai rumus saat
 * file dibuka. Teks seperti itu diberi awalan petik satu ' sehingga tampil sebagai teks biasa.
 * Angka asli (typeof number) tidak diubah.
 */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (typeof v !== "number" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
