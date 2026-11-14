import type { BiayaItem, Todo } from "./types";

type T = Pick<Todo, "id" | "judul" | "bagian" | "bagian_no" | "urutan" | "selesai" | "tenggat">;

/**
 * To-do berikutnya: yang belum selesai dengan tenggat paling dekat;
 * kalau tidak ada tenggat, ikut urutan tahap (bagian_no) lalu urutan di sheet.
 */
export function todoBerikutnya<X extends T>(todo: X[]): { item: X | null; sisaDiTahap: number } {
  const belum = todo.filter((t) => !t.selesai);
  const urut = [...belum].sort((a, b) => {
    if (a.tenggat && b.tenggat) return a.tenggat.localeCompare(b.tenggat);
    if (a.tenggat) return -1;
    if (b.tenggat) return 1;
    return a.bagian_no - b.bagian_no || a.urutan - b.urutan;
  });
  const item = urut[0] ?? null;
  return { item, sisaDiTahap: item ? belum.filter((t) => t.bagian === item.bagian).length - 1 : 0 };
}

type B = Pick<BiayaItem, "id" | "nama" | "grup" | "sub" | "estimasi" | "realisasi" | "dp" | "status" | "tanggal_bayar">;

export interface Tagihan<X> {
  item: X;
  /** estimasi dikurangi yang sudah dibayar (realisasi, atau DP kalau realisasi kosong); null kalau estimasi belum diisi */
  sisa: number | null;
  /** tanggal bayar yang belum lewat dipakai sebagai jatuh tempo */
  jatuhTempo: string | null;
}

/**
 * Tagihan berikutnya.
 * Masuk daftar: status SUDAH DP / BELUM LUNAS (sudah terikat, tinggal pelunasan),
 * atau belum bayar (termasuk status kosong) yang punya estimasi dan belum ada realisasi.
 * Urutan: yang punya tanggal bayar >= hari ini (paling dekat dulu), lalu sisa terbesar,
 * lalu yang nominalnya belum dicatat.
 */
export function tagihanBerikutnya<X extends B>(items: X[], today: string): Tagihan<X>[] {
  const out: Tagihan<X>[] = [];
  for (const i of items) {
    const terikat = i.status === "SUDAH DP" || i.status === "BELUM LUNAS";
    const belum = (i.status === "BELUM BAYAR" || i.status == null) && (i.estimasi ?? 0) > 0 && !i.realisasi;
    if (!terikat && !belum) continue;
    const dibayar = i.realisasi ?? i.dp ?? 0;
    const sisa = i.estimasi != null ? Math.max(0, i.estimasi - dibayar) : null;
    if (sisa === 0) continue;
    const jatuhTempo = i.tanggal_bayar && i.tanggal_bayar >= today ? i.tanggal_bayar : null;
    out.push({ item: i, sisa, jatuhTempo });
  }
  return out.sort((a, b) => {
    if (a.jatuhTempo && b.jatuhTempo) return a.jatuhTempo.localeCompare(b.jatuhTempo);
    if (a.jatuhTempo) return -1;
    if (b.jatuhTempo) return 1;
    if (a.sisa != null && b.sisa != null) return b.sisa - a.sisa;
    if (a.sisa != null) return -1;
    if (b.sisa != null) return 1;
    return 0;
  });
}

/**
 * Pembagian bar tabungan terhadap target. Memakai angka dari hitungDana supaya konsisten:
 * tersimpan = terkumpul (saldo sekarang), terpakai = keluarPotong (pengeluaran yang memotong dana bersama).
 * tersimpan + terpakai = total yang pernah disetor (CPP + CPW).
 */
export function segmenTabungan(
  dana: { cpp: number; cpw: number; keluarPotong: number; terkumpul: number },
  target: number,
) {
  const disetor = dana.cpp + dana.cpw;
  const tersimpan = Math.max(0, dana.terkumpul);
  const terpakai = Math.max(0, Math.min(dana.keluarPotong, disetor - tersimpan));
  const pct = (v: number) => (target > 0 ? (v / target) * 100 : 0);
  const pctTersimpan = Math.min(100, pct(tersimpan));
  const pctTerpakai = Math.min(100 - pctTersimpan, pct(terpakai));
  return { disetor, tersimpan, terpakai, pctTersimpan, pctTerpakai };
}

/**
 * Penanda persentase yang pernah tercapai (dari saldo berjalan) tapi saldo sekarang
 * sudah di bawahnya karena dana dipakai.
 */
export function penandaTerlewati(
  titik: { tanggal: string; saldo: number }[],
  target: number,
  saldoSekarang: number,
  pcts = [25, 50, 75],
) {
  return pcts
    .map((pct) => {
      const v = (target * pct) / 100;
      return { pct, at: titik.find((p) => p.saldo >= v)?.tanggal ?? null, v };
    })
    .filter((m): m is { pct: number; at: string; v: number } => m.at !== null && saldoSekarang < m.v)
    .map(({ pct, at }) => ({ pct, at }));
}
