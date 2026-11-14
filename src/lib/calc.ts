import type { BiayaItem, Pengeluaran, Setoran, StatusBayar, TamuKelompok, Todo } from "./types";
import { GRUP_BIAYA, STATUS_BAYAR } from "./types";

type S = Pick<Setoran, "pihak" | "jumlah">;
type P = Pick<Pengeluaran, "jenis" | "jumlah" | "potong_dana">;
type B = Pick<BiayaItem, "grup" | "estimasi" | "realisasi" | "status">;

const sum = (xs: (number | null | undefined)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);

/** Dana terkumpul = semua setoran (CPP + CPW) dikurangi pengeluaran yang memotong dana bersama. */
export function hitungDana(setoran: S[], pengeluaran: P[]) {
  const cpp = sum(setoran.filter((s) => s.pihak === "CPP").map((s) => s.jumlah));
  const cpw = sum(setoran.filter((s) => s.pihak === "CPW").map((s) => s.jumlah));
  const keluarPotong = sum(pengeluaran.filter((p) => p.potong_dana).map((p) => p.jumlah));
  const gether = sum(pengeluaran.filter((p) => p.jenis === "gether").map((p) => p.jumlah));
  const seserahan = sum(pengeluaran.filter((p) => p.jenis === "seserahan").map((p) => p.jumlah));
  return { cpp, cpw, gether, seserahan, keluarPotong, terkumpul: cpp + cpw - keluarPotong };
}

export function hitungBiaya(items: B[]) {
  const perGrup = GRUP_BIAYA.map((grup) => {
    const xs = items.filter((i) => i.grup === grup);
    const estimasi = sum(xs.map((i) => i.estimasi));
    const realisasi = sum(xs.map((i) => i.realisasi));
    return { grup, estimasi, realisasi, selisih: estimasi - realisasi, jumlah: xs.length };
  });
  const status = Object.fromEntries(
    STATUS_BAYAR.map((s) => [s, items.filter((i) => i.status === s).length]),
  ) as Record<StatusBayar, number>;
  const estimasi = sum(perGrup.map((g) => g.estimasi));
  const realisasi = sum(perGrup.map((g) => g.realisasi));
  return { perGrup, status, estimasi, realisasi, selisih: estimasi - realisasi };
}

export function hitungTodo(items: Pick<Todo, "selesai">[]) {
  const sudah = items.filter((i) => i.selesai).length;
  return { sudah, belum: items.length - sudah, total: items.length };
}

export const totalPerkiraanTamu = (k: Pick<TamuKelompok, "perkiraan">[]) => sum(k.map((x) => x.perkiraan));

/** Tanggal "hari ini" di zona Asia/Jakarta sebagai YYYY-MM-DD. */
export function todayJakarta(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(now);
}

export function daysBetween(fromIso: string, toIso: string) {
  const a = Date.UTC(+fromIso.slice(0, 4), +fromIso.slice(5, 7) - 1, +fromIso.slice(8, 10));
  const b = Date.UTC(+toIso.slice(0, 4), +toIso.slice(5, 7) - 1, +toIso.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/**
 * Target setoran per bulan: sisa dana dibagi jumlah bulan gajian yang tersisa
 * (bulan kalender dari bulan ini sampai bulan sebelum bulan nikah, minimal 1).
 * 14 Nov 2026 -> 10 Apr 2027: Nov, Des, Jan, Feb, Mar = 5 bulan.
 */
export function targetBulanan(sisa: number, todayIso: string, nikahIso: string) {
  const y0 = +todayIso.slice(0, 4), m0 = +todayIso.slice(5, 7);
  const y1 = +nikahIso.slice(0, 4), m1 = +nikahIso.slice(5, 7);
  const bulan = Math.max(1, (y1 - y0) * 12 + (m1 - m0));
  return { bulan, perBulan: sisa > 0 ? Math.ceil(sisa / bulan) : 0 };
}

/** Saldo berjalan untuk grafik: urut tanggal, setoran null-tanggal (saldo awal) di depan. */
export function saldoBerjalan(
  setoran: Pick<Setoran, "tanggal" | "jumlah" | "pihak">[],
  pengeluaran: Pick<Pengeluaran, "tanggal" | "jumlah" | "potong_dana">[],
) {
  type Ev = { tanggal: string | null; delta: number };
  const ev: Ev[] = [
    ...setoran.map((s) => ({ tanggal: s.tanggal, delta: s.jumlah })),
    ...pengeluaran.filter((p) => p.potong_dana).map((p) => ({ tanggal: p.tanggal, delta: -p.jumlah })),
  ];
  const awal = ev.filter((e) => !e.tanggal);
  const dated = ev.filter((e) => e.tanggal).sort((a, b) => a.tanggal!.localeCompare(b.tanggal!));
  let saldo = sum(awal.map((e) => e.delta));
  const out: { tanggal: string; saldo: number }[] = [];
  for (const e of dated) {
    saldo += e.delta;
    const last = out[out.length - 1];
    if (last && last.tanggal === e.tanggal) last.saldo = saldo;
    else out.push({ tanggal: e.tanggal!, saldo });
  }
  return { awal: sum(awal.map((e) => e.delta)), titik: out };
}
