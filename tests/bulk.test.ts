import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canonSub, diffDrafts, findDuplicates, groupSameValues, mergeChanges, parsePasted, parseRupiah, subOptionsOf,
} from "../src/lib/bulk";

test("parseRupiah: format umum", () => {
  assert.equal(parseRupiah(""), null);
  assert.equal(parseRupiah("150000"), 150000);
  assert.equal(parseRupiah("150.000"), 150000);
  assert.equal(parseRupiah("Rp 1.250.000"), 1250000);
  assert.equal(parseRupiah("150rb"), 150000);
  assert.equal(parseRupiah("75k"), 75000);
  assert.equal(parseRupiah("1,5jt"), 1500000);
  assert.equal(parseRupiah("1.5 juta"), 1500000);
  assert.ok(Number.isNaN(parseRupiah("seratus")));
});

test("parsePasted: nama saja, nama+estimasi, nama+estimasi+realisasi", () => {
  const { rows, extra } = parsePasted("Cushion, 200000, 152000\nBlush on, 150rb\n\n- Concealer\n2. Maskara; 100.000; 65.000");
  assert.equal(extra, 0);
  assert.deepEqual(rows.map((r) => [r.nama, r.estimasi, r.realisasi]), [
    ["Cushion", 200000, 152000],
    ["Blush on", 150000, null],
    ["Concealer", null, null],
    ["Maskara", 100000, 65000],
  ]);
  assert.equal(rows[3].line, 5);
});

test("parsePasted: koma di dalam nama dan di dalam angka aman", () => {
  const { rows } = parsePasted("Bundle (Body wash, lotion, scrub), 250000\nSetting spray, 1,5jt\nToner, , 50.000\nParfum,150,000");
  assert.deepEqual(rows.map((r) => [r.nama, r.estimasi, r.realisasi]), [
    ["Bundle (Body wash, lotion, scrub)", 250000, null],
    ["Setting spray", 1500000, null],
    ["Toner", null, 50000],
    ["Parfum", 150000, null],
  ]);
});

test("parsePasted: batas maksimal dan baris tanpa nama", () => {
  const text = Array.from({ length: 55 }, (_, i) => `Item ${i + 1}`).join("\n");
  const { rows, extra } = parsePasted(text, 50);
  assert.equal(rows.length, 50);
  assert.equal(extra, 5);
  assert.equal(parsePasted(", 1000").rows[0].error, "Nama kosong");
});

test("subOptionsOf + canonSub: beda huruf/spasi ikut ejaan pertama", () => {
  const opts = subOptionsOf([{ sub: "Makeup" }, { sub: " makeup " }, { sub: "Skin  care" }, { sub: null }], "sub");
  assert.deepEqual(opts, ["Makeup", "Skin care"]);
  assert.equal(canonSub("makeup", opts), "Makeup");
  assert.equal(canonSub("  MAKEUP ", opts), "Makeup");
  assert.equal(canonSub("skin care", opts), "Skin care");
  assert.equal(canonSub("  Parfum   baru ", opts), "Parfum baru");
});

test("findDuplicates: terhadap data lama dan sesama baris baru, per lingkup", () => {
  const existing = [
    { grup: "Seserahan", sub: "Makeup", nama: "Maskara" },
    { grup: "Resepsi", sub: "", nama: "Cushion" },
  ];
  const baru = [
    { grup: "Seserahan", sub: "makeup", nama: " maskara " },
    { grup: "Seserahan", sub: "Makeup", nama: "Cushion" },
    { grup: "Seserahan", sub: "Makeup", nama: "cushion" },
    { grup: "Seserahan", sub: "Makeup", nama: "" },
  ];
  const d = findDuplicates(baru, existing, "nama", ["grup", "sub"]);
  assert.equal(d.get(0), "Sudah ada item dengan nama ini");
  assert.equal(d.has(1), false);
  assert.equal(d.get(2), "Sama dengan baris 2");
  assert.equal(d.has(3), false);
});

test("mergeChanges: kolom kosong tidak diubah, yang sudah sama dilewati, simpan nilai lama", () => {
  const rows = [
    { id: "a", status: "BELUM BAYAR", tanggal_bayar: null },
    { id: "b", status: "LUNAS", tanggal_bayar: "2026-11-15" },
    { id: "c", status: null, tanggal_bayar: "2026-01-01" },
  ];
  const { changes, undo } = mergeChanges(rows, { status: "LUNAS", tanggal_bayar: "2026-11-15", dp: "" });
  assert.deepEqual(changes, [
    { id: "a", values: { status: "LUNAS", tanggal_bayar: "2026-11-15" } },
    { id: "c", values: { status: "LUNAS", tanggal_bayar: "2026-11-15" } },
  ]);
  assert.deepEqual(undo, [
    { id: "a", values: { status: "BELUM BAYAR", tanggal_bayar: null } },
    { id: "c", values: { status: null, tanggal_bayar: "2026-01-01" } },
  ]);
  assert.equal(mergeChanges(rows, {}).changes.length, 0);
  // boolean vs teks setara
  assert.equal(mergeChanges([{ id: "x", selesai: true }], { selesai: true }).changes.length, 0);
});

test("diffDrafts: hanya kolom yang berubah, kosong = dikosongkan", () => {
  const rows = [
    { id: "a", realisasi: 65000, status: "LUNAS", tanggal_bayar: null },
    { id: "b", realisasi: null, status: "BELUM BAYAR", tanggal_bayar: null },
  ];
  const { changes, undo } = diffDrafts(rows, {
    a: { realisasi: 65000, status: "LUNAS", tanggal_bayar: "" },
    b: { realisasi: 80000, status: "LUNAS", tanggal_bayar: "2026-11-15" },
  });
  assert.deepEqual(changes, [{ id: "b", values: { realisasi: 80000, status: "LUNAS", tanggal_bayar: "2026-11-15" } }]);
  assert.deepEqual(undo, [{ id: "b", values: { realisasi: null, status: "BELUM BAYAR", tanggal_bayar: null } }]);
  const cleared = diffDrafts(rows, { a: { realisasi: null } });
  assert.deepEqual(cleared.changes, [{ id: "a", values: { realisasi: null } }]);
});

test("groupSameValues: nilai identik digabung jadi satu update", () => {
  const g = groupSameValues([
    { id: "a", values: { status: "LUNAS", tanggal_bayar: "2026-11-15" } },
    { id: "b", values: { tanggal_bayar: "2026-11-15", status: "LUNAS" } },
    { id: "c", values: { realisasi: 1 } },
  ]);
  assert.equal(g.length, 2);
  assert.deepEqual(g[0].ids, ["a", "b"]);
});
