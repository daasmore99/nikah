import { test } from "node:test";
import assert from "node:assert/strict";
import { penandaTerlewati, segmenTabungan, tagihanBerikutnya, todoBerikutnya } from "../src/lib/ringkasan";

const td = (id: string, o: Partial<{ bagian: string; bagian_no: number; urutan: number; selesai: boolean; tenggat: string | null }>) => ({
  id, judul: id, bagian: "A", bagian_no: 1, urutan: 1, selesai: false, tenggat: null, ...o,
});

test("todo berikutnya: tenggat terdekat menang, lalu urutan tahap", () => {
  const xs = [
    td("a", { selesai: true }),
    td("b", { bagian: "B", bagian_no: 2, urutan: 1 }),
    td("c", { bagian: "B", bagian_no: 2, urutan: 2 }),
    td("d", { bagian: "C", bagian_no: 3 }),
  ];
  assert.equal(todoBerikutnya(xs).item?.id, "b");
  assert.equal(todoBerikutnya(xs).sisaDiTahap, 1);
  assert.equal(todoBerikutnya([...xs, td("e", { bagian_no: 9, tenggat: "2027-01-01" })]).item?.id, "e");
  assert.equal(todoBerikutnya([td("x", { selesai: true })]).item, null);
});

const bi = (id: string, o: Record<string, unknown>) => ({
  id, nama: id, grup: "Resepsi" as const, sub: null, estimasi: null, realisasi: null, dp: null, status: null, tanggal_bayar: null, ...o,
}) as Parameters<typeof tagihanBerikutnya>[0][number];

test("tagihan berikutnya: jatuh tempo, lalu sisa terbesar, lalu tanpa nominal", () => {
  const xs = [
    bi("lunas", { status: "LUNAS", estimasi: 100, realisasi: 100 }),
    bi("kosong", { status: "BELUM BAYAR" }),
    bi("kecil", { status: "BELUM BAYAR", estimasi: 200 }),
    bi("besar", { status: null, estimasi: 900 }),
    bi("dp", { status: "SUDAH DP", estimasi: 1000, dp: 300 }),
    bi("dp-tanpa-angka", { status: "SUDAH DP" }),
    bi("tempo", { status: "BELUM LUNAS", estimasi: 50, tanggal_bayar: "2026-12-01" }),
    bi("lewat", { status: "BELUM LUNAS", estimasi: 60, tanggal_bayar: "2026-01-01" }),
  ];
  const r = tagihanBerikutnya(xs, "2026-11-14");
  assert.deepEqual(r.map((t) => t.item.id), ["tempo", "besar", "dp", "kecil", "lewat", "dp-tanpa-angka"]);
  assert.equal(r.find((t) => t.item.id === "dp")?.sisa, 700);
  assert.equal(r.find((t) => t.item.id === "dp-tanpa-angka")?.sisa, null);
});

test("segmen tabungan: hijau = saldo, putus-putus = terpakai, jumlahnya = total disetor", () => {
  const s = segmenTabungan({ cpp: 30, cpw: 20, keluarPotong: 10, terkumpul: 40 }, 100);
  assert.equal(s.disetor, 50);
  assert.equal(s.tersimpan, 40);
  assert.equal(s.terpakai, 10);
  assert.equal(s.tersimpan + s.terpakai, s.disetor);
  assert.equal(s.pctTersimpan, 40);
  assert.equal(s.pctTerpakai, 10);
  // melebihi target: total lebar tetap maksimal 100%
  const o = segmenTabungan({ cpp: 100, cpw: 20, keluarPotong: 30, terkumpul: 90 }, 100);
  assert.equal(o.pctTersimpan, 90);
  assert.equal(o.pctTerpakai, 10);
  // saldo negatif: hijau 0, terpakai dibatasi total disetor
  const n = segmenTabungan({ cpp: 10, cpw: 0, keluarPotong: 15, terkumpul: -5 }, 100);
  assert.equal(n.tersimpan, 0);
  assert.equal(n.terpakai, 10);
});

test("penanda terlewati: pernah tercapai tapi saldo sekarang di bawahnya", () => {
  const titik = [
    { tanggal: "2026-03-10", saldo: 30 },
    { tanggal: "2026-09-02", saldo: 55 },
    { tanggal: "2026-10-01", saldo: 45 },
  ];
  assert.deepEqual(penandaTerlewati(titik, 100, 45), [{ pct: 50, at: "2026-09-02" }]);
  assert.deepEqual(penandaTerlewati(titik, 100, 60), []);
});
