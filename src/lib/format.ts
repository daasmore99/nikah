const rpFmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** 34685759 -> "Rp34.685.759" */
export const rp = (n: number | null | undefined) => (n == null ? "—" : `Rp${rpFmt.format(n)}`);
/** 34685759 -> "34.685.759" */
export const angka = (n: number | null | undefined) => (n == null ? "—" : rpFmt.format(n));

/** 34685759 -> "34,7 jt" (ringkas untuk label grafik) */
export function rpSingkat(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
  if (abs >= 1_000_000) return `${(n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  if (abs >= 1_000) return `${(n / 1e3).toLocaleString("id-ID", { maximumFractionDigits: 0 })} rb`;
  return String(n);
}

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const BULAN_PANJANG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

/** "2026-11-03" -> "3 Nov 2026" */
export function tgl(iso: string | null | undefined, opts: { tahun?: boolean } = {}) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${BULAN[m - 1]}${opts.tahun === false ? "" : ` ${y}`}`;
}

/** "2027-04-10" -> "Sabtu, 10 April 2027" */
export function tglPanjang(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const hari = HARI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${hari}, ${d} ${BULAN_PANJANG[m - 1]} ${y}`;
}

export const bulanPanjang = (m: number) => BULAN_PANJANG[m - 1];
export const bulanPendek = (m: number) => BULAN[m - 1];

export const persen = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

/** persen satu desimal, dibulatkan ke bawah supaya 49,96% tidak tampil "50%": 0.4955 -> "49,5" */
export const persen1 = (a: number, b: number) =>
  (b > 0 ? Math.floor((a / b) * 1000) / 10 : 0).toLocaleString("id-ID", { maximumFractionDigits: 1 });
