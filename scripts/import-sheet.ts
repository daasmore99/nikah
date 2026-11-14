/**
 * Impor sekali dari Google Sheet publik.
 *
 *   npm run import            -> unduh CSV tiap tab ke data/csv/, lalu tulis
 *                                data/import.json dan supabase/seed.local.sql
 *   npm run import -- --offline  -> pakai CSV yang sudah ada di data/csv/
 *
 * Semua output berisi data pribadi dan ada di .gitignore. Jangan di-commit.
 * seed.local.sql idempoten: tiap baris punya import_key unik + "on conflict do nothing",
 * jadi aman dijalankan ulang dan tidak menimpa perubahan yang dibuat di web.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseAll, SHEET_ID, TABS, type Csvs, type TabName } from "../src/lib/import/sheet";
import { compareTotals } from "../src/lib/import/verify";
import type { ImportData } from "../src/lib/types";

const root = join(__dirname, "..");
const csvDir = join(root, "data", "csv");
const offline = process.argv.includes("--offline");

async function loadCsvs(): Promise<Csvs> {
  mkdirSync(csvDir, { recursive: true });
  const out = {} as Csvs;
  for (const [name, gid] of Object.entries(TABS) as [TabName, number][]) {
    const file = join(csvDir, `${name}.csv`);
    if (offline) {
      if (!existsSync(file)) throw new Error(`CSV ${file} belum ada; jalankan tanpa --offline`);
    } else {
      const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) throw new Error(`Gagal unduh tab ${name}: HTTP ${res.status}`);
      writeFileSync(file, await res.text(), "utf8");
    }
    out[name] = readFileSync(file, "utf8");
  }
  return out;
}

const q = (v: unknown): string => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
  return `'${String(v).replace(/'/g, "''")}'`;
};

export function toSql(data: ImportData): string {
  const lines: string[] = [
    "-- DIHASILKAN OTOMATIS oleh scripts/import-sheet.ts. Berisi data pribadi: JANGAN di-commit.",
    "-- Jalankan sekali di Supabase SQL Editor setelah migrasi. Aman diulang (idempoten).",
    "begin;",
  ];
  const p = data.pengaturan;
  const pk = Object.keys(p);
  lines.push(
    `insert into public.pengaturan (id, ${pk.join(", ")}) values (1, ${pk.map((k) => q(p[k as keyof typeof p])).join(", ")})`,
    `  on conflict (id) do update set ${pk.map((k) => `${k} = coalesce(public.pengaturan.${k}, excluded.${k})`).join(", ")};`,
  );
  for (const [table, rows] of Object.entries(data.tables)) {
    if (!rows.length) continue;
    const cols = Object.keys(rows[0]);
    lines.push(`\n-- ${table}: ${rows.length} baris`);
    lines.push(`insert into public.${table} (${cols.join(", ")}) values`);
    lines.push(
      rows.map((r) => `  (${cols.map((c) => q((r as Record<string, unknown>)[c])).join(", ")})`).join(",\n") +
        "\non conflict (import_key) do nothing;",
    );
  }
  lines.push("commit;");
  return lines.join("\n") + "\n";
}

async function main() {
  const csvs = await loadCsvs();
  const { data, totals, notes } = parseAll(csvs);
  mkdirSync(join(root, "data"), { recursive: true });
  writeFileSync(join(root, "data", "import.json"), JSON.stringify({ data, totals, notes }, null, 2));
  writeFileSync(join(root, "supabase", "seed.local.sql"), toSql(data));

  console.log("Baris per tabel:");
  for (const [k, v] of Object.entries(data.tables)) console.log(`  ${k.padEnd(16)} ${v.length}`);
  console.log("\nCek angka hasil impor vs sheet:");
  const rows = compareTotals(data, totals);
  for (const r of rows) {
    const mark = r.cocok ? "OK   " : "BEDA ";
    console.log(`  ${mark}${r.label.padEnd(46)} sheet=${String(r.sheet).padStart(12)}  hitung=${String(r.hitung).padStart(12)}${r.cocok ? "" : `  selisih=${r.hitung - r.sheet}  (${r.penjelasan})`}`);
  }
  console.log("\nCatatan pemetaan:");
  for (const n of notes.mapped) console.log("  - " + n);
  console.log("\nDilewati:");
  for (const n of notes.skipped) console.log("  - " + n);
  console.log("\nOutput: data/import.json, supabase/seed.local.sql");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
