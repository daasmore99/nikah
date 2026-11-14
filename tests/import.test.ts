/**
 * Tes impor: angka hasil hitung ulang harus cocok dengan sheet, kecuali selisih
 * yang sudah diketahui dan dijelaskan (nilainya harus persis sama).
 * Butuh CSV di data/csv/ (jalankan `npm run import` dulu).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseAll, TABS, type Csvs, type TabName } from "../src/lib/import/sheet";
import { compareTotals } from "../src/lib/import/verify";
import { parseCsv, parseRupiah, parseTanggal } from "../src/lib/import/csv";
import { daysBetween, targetBulanan } from "../src/lib/calc";

const dir = join(__dirname, "..", "data", "csv");
const ada = Object.keys(TABS).every((n) => existsSync(join(dir, `${n}.csv`)));

test("parseRupiah format Indonesia", () => {
  assert.equal(parseRupiah(" Rp 2.631.000 "), 2631000);
  assert.equal(parseRupiah("Rp70.000.000"), 70000000);
  assert.equal(parseRupiah(" Rp -   "), null);
  assert.equal(parseRupiah("4.000.000"), 4000000);
  assert.equal(parseRupiah(""), null);
});

test("parseTanggal", () => {
  assert.equal(parseTanggal("26 Februari 2026"), "2026-02-26");
  assert.equal(parseTanggal("18/05/2026"), "2026-05-18");
  assert.equal(parseTanggal("10-04-2027"), "2027-04-10");
  assert.equal(parseTanggal("10 April 2027"), "2027-04-10");
  assert.equal(parseTanggal("9.43g"), null);
});

test("parseCsv menangani kutip multi-baris", () => {
  assert.deepEqual(parseCsv('a,"b\nc",d\n1,2,3'), [["a", "b\nc", "d"], ["1", "2", "3"]]);
});

test("countdown & target bulanan", () => {
  assert.equal(daysBetween("2026-11-14", "2027-04-10"), 147); // sama dengan Summary sheet
  assert.deepEqual(targetBulanan(35_314_241, "2026-11-14", "2027-04-10"), { bulan: 5, perBulan: 7_062_849 });
});

test("impor sheet: total cocok / selisih sesuai penjelasan", { skip: !ada && "data/csv belum ada" }, () => {
  const csvs = Object.fromEntries(
    Object.keys(TABS).map((n) => [n, readFileSync(join(dir, `${n}.csv`), "utf8")]),
  ) as Record<TabName, string> as Csvs;
  const { data, totals } = parseAll(csvs);

  assert.equal(data.pengaturan.tanggal_nikah, "2027-04-10");
  assert.equal(data.pengaturan.target_dana, 70_000_000);
  assert.equal(data.pengaturan.harga_emas_manual, null); // #VALUE! di sheet

  const known: Record<string, number> = {
    "Saldo CPW": 500_000,
    "Dana terkumpul (CPP + CPW - gether)": 500_000,
    "Sisa dana dibutuhkan": -500_000,
    "Realisasi biaya (ringkasan atas)": 18_758_000,
    "Rangkuman estimasi (semua kategori)": 1_720_000,
    "Rangkuman realisasi (semua kategori)": 1_720_000,
    "Status LUNAS": 17,
    "Checklist total": -3,
  };
  for (const c of compareTotals(data, totals)) {
    const diff = c.hitung - c.sheet;
    assert.equal(diff, known[c.label] ?? 0, `${c.label}: sheet=${c.sheet} hitung=${c.hitung}`);
  }

  // Angka kunci yang disebut di brief
  assert.equal(totals.danaTerkumpul, 34_185_759);
  assert.equal(totals.realisasiRingkasan, 2_178_310);
  assert.equal(totals.budget, 70_000_000);

  const perhiasan = data.tables.biaya_item.find((b) => b.nama === "Perhiasan");
  assert.equal(perhiasan?.gram_emas, 9.43);
  assert.equal(perhiasan?.realisasi, 17_038_000);
  assert.equal(data.tables.tamu.length, 3);
  assert.equal(data.tables.lagu_rekom.length, 104);
  // import_key unik -> seed idempoten
  for (const [t, rows] of Object.entries(data.tables)) {
    const keys = rows.map((r) => r.import_key);
    assert.equal(new Set(keys).size, keys.length, `import_key duplikat di ${t}`);
  }
});
