/**
 * Ruang demo per pengunjung (cookie demo_ws / header x-demo-ws) + kerangka contoh awal.
 * Tes ini harus gagal kalau dua browser dengan akun demo yang sama bisa saling melihat data,
 * kalau akun asli pernah mengirim header/cookie demo, atau kalau contoh awal memuat data pribadi.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DATA_TABLES, DEMO_BATAS, DEMO_BATAS_BARIS, DEMO_WS_COOKIE, DEMO_WS_HEADER, demoHeaders, demoWsCookieOptions,
  isDemoLimit, isDemoSchemaOld, isDemoWs, localFileFor, newDemoWs, wsCookieAction,
  demoLimitMessage, DEMO_PENUH, DEMO_TERLALU_PANJANG,
} from "../src/lib/demo";
import { localRepo } from "../src/lib/local-store";
import { demoTemplate, demoTemplateRows } from "../src/lib/demo-template";
import { FIELDS } from "../src/lib/fields";
import { validate } from "../src/lib/validate";
import { TABLE_NAMES, type TableName } from "../src/lib/types";

const WS_A = "0b8f3a52-6c1d-4e2f-9a7b-1c2d3e4f5a6b";
const WS_B = "9d4e5f60-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const TODAY = "2026-11-15";
const root = (...p: string[]) => join(__dirname, "..", ...p);

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), "wt-ws-"));
  mkdirSync(join(dir, ".local-data"));
  const dbPath = join(dir, ".local-data", "db.json");
  writeFileSync(dbPath, JSON.stringify({ pengaturan: { nama_pria: "Asli" }, tables: {} }));
  return { dir, dbPath, before: readFileSync(dbPath, "utf8") };
}
const repoFor = (dir: string, ws: string) => localRepo({ root: dir, mode: "demo", ws, today: () => TODAY });

/* ---------------- validasi uuid & file ---------------- */

test("isDemoWs: hanya uuid v4 huruf kecil", () => {
  assert.equal(isDemoWs(WS_A), true);
  for (let i = 0; i < 50; i++) assert.equal(isDemoWs(newDemoWs()), true);
  assert.notEqual(newDemoWs(), newDemoWs());
  for (const bad of [
    undefined, null, "", 123, WS_A.toUpperCase(), `${WS_A} `, ` ${WS_A}`, WS_A.slice(0, 35),
    "0b8f3a52-6c1d-1e2f-9a7b-1c2d3e4f5a6b", // versi 1
    "0b8f3a52-6c1d-4e2f-7a7b-1c2d3e4f5a6b", // varian salah
    "../../etc/passwd", "..\\..\\x", `${WS_A}/../db`, "00000000-0000-0000-0000-000000000000",
  ])
    assert.equal(isDemoWs(bad), false, String(bad));
});

test("localFileFor: satu file per ruang, path berbahaya ditolak", () => {
  assert.equal(localFileFor("demo", WS_A), `demo-${WS_A}.json`);
  assert.equal(localFileFor("asli", WS_A), "db.json");
  for (const bad of ["../db", "..\\db", "../../secret", "db", "", null, undefined, `${WS_A}/x`, "a/b"]) {
    assert.throws(() => localFileFor("demo", bad as string), /Ruang demo tidak valid/, String(bad));
    assert.throws(() => localRepo({ root: tmpdir(), mode: "demo", ws: bad as string }), String(bad));
  }
});

test("cookie demo_ws: dipasang/dipertahankan hanya untuk demo, dihapus untuk bukan demo", () => {
  assert.equal(wsCookieAction(true, WS_A), "keep");
  assert.equal(wsCookieAction(true, undefined), "set");
  assert.equal(wsCookieAction(true, "rusak"), "set");
  assert.equal(wsCookieAction(true, "../db"), "set");
  assert.equal(wsCookieAction(false, undefined), "none");
  assert.equal(wsCookieAction(false, WS_A), "delete");
  assert.equal(wsCookieAction(false, "rusak"), "delete");
  assert.equal(DEMO_WS_COOKIE, "demo_ws");
  assert.deepEqual(demoWsCookieOptions(true), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 2592000 });
  assert.equal(demoWsCookieOptions(false).secure, false);
});

test("mode asli tidak pernah mengirim header demo", () => {
  assert.deepEqual(demoHeaders("asli", WS_A), {});
  assert.deepEqual(demoHeaders("asli", undefined), {});
  assert.deepEqual(demoHeaders("demo", WS_A), { [DEMO_WS_HEADER]: WS_A });
  assert.equal(DEMO_WS_HEADER, "x-demo-ws");
  // demo tanpa ruang valid: gagal, tidak pernah jalan tanpa ws
  assert.throws(() => demoHeaders("demo", undefined));
  assert.throws(() => demoHeaders("demo", "rusak"));
});

test("kode: header & cookie demo hanya di cabang demo", () => {
  const repo = readFileSync(root("src", "lib", "repo.ts"), "utf8");
  // satu-satunya klien berheader: cabang demo, header dari demoHeaders + cookie lewat demoWs()
  assert.match(repo, /const db = mode === "demo" \? await createClient\(demoHeaders\(mode, await demoWs\(\)\)\) : sb;/);
  assert.equal([...repo.matchAll(/createClient\(/g)].length, 2);
  assert.equal([...repo.matchAll(/demoWs\(\)/g)].length, 2);
  assert.match(repo, /localDemo \? localRepo\(\{ mode: "demo", ws: await demoWs\(\) \}\) : localRepo\(\{ mode: "asli" \}\)/);
  assert.match(repo, /if \(mode === "demo"\) await siapkanRuang\(\);/);
  assert.match(repo, /onConflict: "ws", ignoreDuplicates: true/);
  // limit -> pesan ramah
  assert.match(repo, /isDemoLimit\(e\)\) throw new RepoError\(demoLimitMessage\(e\)\)/);

  const server = readFileSync(root("src", "lib", "supabase", "server.ts"), "utf8");
  assert.match(server, /export async function createClient\(headers\?: Record<string, string>\)/);
  assert.doesNotMatch(server, /cache\(/, "klien tidak boleh di-cache lintas request");

  const proxy = readFileSync(root("src", "proxy.ts"), "utf8");
  assert.match(proxy, /applyDemoWs\(request, response, !error && penonton === true\)/);
  assert.match(proxy, /applyDemoWs\(request, NextResponse\.next\(\{ request \}\), localDemo\)/);

  const actions = readFileSync(root("src", "app", "actions.ts"), "utf8");
  assert.match(actions, /await syncDemoWsCookie\(penonton === true\);/);
});

test("pesan error demo: batas & skema lama dikenali", () => {
  assert.equal(isDemoLimit({ code: "54000", message: "Batas data demo tercapai" }), true);
  assert.equal(isDemoLimit({ code: "P0001", message: "Batas data demo tercapai" }), true);
  assert.equal(isDemoLimit({ code: "42501", message: "x" }), false);
  assert.match(DEMO_BATAS, /500/);
  assert.equal(demoLimitMessage({ message: "Batas data demo tercapai" }), DEMO_BATAS);
  assert.equal(demoLimitMessage({ message: "Kuota demo penuh" }), DEMO_PENUH);
  assert.equal(demoLimitMessage({ message: "Isian demo terlalu panjang" }), DEMO_TERLALU_PANJANG);
  assert.equal(isDemoLimit({ code: "P0001", message: "Kuota demo penuh" }), true);
  assert.equal(isDemoSchemaOld({ code: "42703", message: 'column "ws" does not exist' }), true);
  assert.equal(isDemoSchemaOld({ code: "42P10", message: "no unique or exclusion constraint" }), true);
  assert.equal(isDemoSchemaOld({ code: "23505", message: "dup" }), false);
});

/* ---------------- isolasi dua ruang (mode lokal) ---------------- */

test("dua ruang lokal tidak saling melihat data; reset A tidak mengubah B; db.json tak tersentuh", async () => {
  const { dir, dbPath, before } = sandbox();
  try {
    const a = repoFor(dir, WS_A);
    const b = repoFor(dir, WS_B);
    const awalB = JSON.stringify(await Promise.all(TABLE_NAMES.map((t) => b.list(t))));

    await a.insert("tamu", { nama: "Hanya di A", urutan: 99 });
    await a.updatePengaturan({ nama_pria: "Pria A", nama_wanita: "Wanita A" });
    const idA = (await a.list("tamu"))[0].id;
    await a.update("tamu", idA, { nama: "Diubah di A" });

    assert.ok((await a.list("tamu")).some((r) => r.nama === "Hanya di A"));
    assert.ok(!(await b.list("tamu")).some((r) => r.nama === "Hanya di A" || r.nama === "Diubah di A"));
    assert.equal((await b.pengaturan()).nama_pria, "");
    assert.equal((await a.pengaturan()).nama_pria, "Pria A");
    // B tidak bisa mengubah baris A lewat id-nya
    await assert.rejects(b.update("tamu", idA, { nama: "x" }));

    // B menulis, A tidak melihat
    await b.updatePengaturan({ nama_pria: "Pria B" });
    assert.equal((await a.pengaturan()).nama_pria, "Pria A");

    // reset A -> A kembali ke contoh, B tetap
    const sebelumB = readFileSync(join(dir, ".local-data", `demo-${WS_B}.json`), "utf8");
    await a.resetDemo();
    assert.equal((await a.pengaturan()).nama_pria, "");
    assert.ok(!(await a.list("tamu")).some((r) => r.nama === "Hanya di A"));
    assert.equal(readFileSync(join(dir, ".local-data", `demo-${WS_B}.json`), "utf8"), sebelumB);
    assert.equal((await b.pengaturan()).nama_pria, "Pria B");
    assert.equal(JSON.stringify(await Promise.all(TABLE_NAMES.map((t) => b.list(t)))), awalB);

    assert.equal(readFileSync(dbPath, "utf8"), before, "db.json berubah");
    assert.deepEqual(readdirSync(join(dir, ".local-data")).sort(), ["db.json", `demo-${WS_A}.json`, `demo-${WS_B}.json`].sort());
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ---------------- kerangka contoh ---------------- */

test("template: semua tabel terisi, pengaturan tetap kosong, jumlah di bawah batas", () => {
  const t = demoTemplate(TODAY);
  for (const name of TABLE_NAMES) {
    assert.ok(t[name].length > 0, `${name} kosong`);
    assert.ok(t[name].length < DEMO_BATAS_BARIS, `${name} melewati batas`);
  }
  assert.equal(DATA_TABLES.length, TABLE_NAMES.length + 1);
  // tanggal setoran relatif terhadap hari ini, semuanya di masa lalu
  for (const s of t.setoran) assert.ok(s.tanggal! < TODAY);
  assert.equal(demoTemplate("2030-01-31").setoran[0].tanggal, "2029-12-06");
});

test("template: lolos validasi yang sama dengan form", () => {
  for (const { table, rows } of demoTemplateRows(TODAY)) {
    for (const r of rows) {
      const v = validate(FIELDS[table], r);
      assert.ok(v.ok, `${table}: ${JSON.stringify(!v.ok && v.errors)} ${JSON.stringify(r)}`);
      for (const f of FIELDS[table]) assert.deepEqual(v.data[f.key], r[f.key] ?? null, `${table}.${f.key}`);
      assert.equal(typeof r.urutan, "number");
    }
  }
});

test("template: tanpa data pribadi, link, atau angka sungguhan", () => {
  const s = JSON.stringify(demoTemplate(TODAY));
  for (const larang of [
    /Ananda/i, /Zalfa/i, /MulaKisah/i, /Azkia/i, /Elmunaz/i, /Jalpa/i, /Indah KN/i, /Fauzi/i, /Umma/i,
    /https?:/i, /www\./i, /\.com|\.id\b|shopee|tokopedia/i,
    /34685759|34\.685\.759/, /70000000|70\.000\.000/, /1300/, /2027-04-10/,
  ])
    assert.doesNotMatch(s, larang);
  // link selalu kosong
  for (const { rows } of demoTemplateRows(TODAY)) for (const r of rows) for (const k of ["link", "instagram_web"]) if (k in r) assert.equal(r[k], null);
});

test("seeding sekali per ruang; ruang baru langsung berisi contoh", async () => {
  const { dir } = sandbox();
  try {
    const a = repoFor(dir, WS_A);
    const harap = demoTemplate(TODAY);
    for (const t of TABLE_NAMES) assert.equal((await a.list(t)).length, harap[t].length, t);
    // repo baru untuk ruang yang sama (request berikutnya) tidak menyisipkan contoh lagi
    await a.removeMany("vendor", [(await a.list("vendor"))[0].id]);
    const lagi = repoFor(dir, WS_A);
    for (const t of TABLE_NAMES as TableName[])
      assert.equal((await lagi.list(t)).length, harap[t].length - (t === "vendor" ? 1 : 0), t);
    // reset mengembalikan ke template persis (nama per tabel)
    await a.insert("lagu", { judul: "Tambahan", urutan: 50 });
    await a.resetDemo();
    for (const t of TABLE_NAMES) assert.equal((await a.list(t)).length, harap[t].length, `reset ${t}`);
    assert.deepEqual((await a.list("vendor")).map((v) => v.nama), harap.vendor.map((v) => v.nama));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("batas 500 baris per tabel di mode lokal (sama dengan trigger)", async () => {
  const { dir } = sandbox();
  try {
    const a = repoFor(dir, WS_A);
    const n = (await a.list("lagu_rekom")).length;
    await a.insertMany("lagu_rekom", Array.from({ length: DEMO_BATAS_BARIS - n }, (_, i) => ({ judul: `L${i}`, urutan: i })));
    await assert.rejects(a.insert("lagu_rekom", { judul: "satu lagi", urutan: 1 }), /Batas data demo tercapai/);
    // ruang lain tidak terpengaruh
    await repoFor(dir, WS_B).insert("lagu_rekom", { judul: "B", urutan: 1 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ---------------- migrasi ---------------- */

const MIG = root("supabase", "migrations", "20261116000000_demo_workspace.sql");

test("migrasi demo_workspace: semua policy & fungsi demo memakai demo_ws()", () => {
  const sql = readFileSync(MIG, "utf8");
  const kode = sql.replace(/--.*$/gm, "");
  // fungsi demo_ws: membaca header x-demo-ws, tidak melempar, hanya untuk authenticated
  assert.match(kode, /create or replace function public\.demo_ws\(\) returns uuid/);
  assert.match(kode, /current_setting\('request\.headers', true\)/);
  assert.match(kode, /'x-demo-ws'/);
  assert.match(kode, /exception when others then\s+return null;/);
  assert.match(kode, /security invoker set search_path/);
  assert.match(kode, /grant execute on function public\.demo_ws\(\) to authenticated;/);
  assert.match(kode, /revoke all on function public\.demo_ws\(\) from anon;/);

  // kolom ws + index untuk tiap tabel (lewat loop berisi ke-12 nama)
  assert.match(kode, /add column if not exists ws uuid not null default public\.demo_ws\(\)/);
  assert.match(kode, /create index if not exists/);
  for (const t of DATA_TABLES) assert.match(kode, new RegExp(`'${t}'`), `loop: ${t}`);
  assert.match(kode, /primary key \(ws\)/);

  // policy: setiap create policy penonton_* memakai variabel cek yang berisi demo_ws
  const cek = /cek text := '([^']*(?:''[^']*)*)'/.exec(kode)?.[1] ?? "";
  assert.match(cek, /public\.is_penonton\(\)/);
  assert.match(cek, /ws = \(select public\.demo_ws\(\)\)/);
  assert.match(cek, /public\.demo_ws\(\)\) is not null/);
  const policies = [...kode.matchAll(/create policy "penonton_\w+"[^\n]*/g)].map((m) => m[0]);
  assert.equal(policies.length, 4);
  for (const p of policies) assert.match(p, /cek/, p);
  assert.doesNotMatch(kode, /using \(public\.is_penonton\(\)\)/, "policy lama tanpa ws");

  // batas ukuran
  assert.match(kode, /if n >= 500 then\s+raise exception 'Batas data demo tercapai' using errcode = '54000'/);

  // reset_demo: hanya ruang pemanggil, tanpa truncate
  const reset = /function public\.reset_demo\(\)[\s\S]*?\$\$;/.exec(kode)?.[0] ?? "";
  assert.match(reset, /v_ws uuid := public\.demo_ws\(\)/);
  assert.match(reset, /if v_ws is null then\s+raise exception/);
  assert.doesNotMatch(reset, /truncate/i);
  const deletes = [...reset.matchAll(/delete from public\.(\w+)\s+where ws = v_ws;/g)].map((m) => m[1]);
  assert.deepEqual(deletes.sort(), DATA_TABLES.map((t) => `demo_${t}`).sort());
  assert.equal([...reset.matchAll(/delete from/g)].length, 12);
  assert.match(reset, /security definer set search_path = public, pg_temp/);

  // purge_demo: tidak bisa dipanggil lewat API
  assert.match(kode, /function public\.purge_demo\(retain interval default '30 days'\)/);
  assert.match(kode, /max\(updated_at\)/);
  assert.match(kode, /revoke all on function public\.purge_demo\(interval\) from anon, authenticated;/);
  assert.doesNotMatch(kode, /create extension/i);
  assert.doesNotMatch(kode, /cron\.schedule/); // hanya di komentar

  // tidak menyentuh tabel asli: semua alter/truncate/delete hanya demo_*
  const sentuh = [...kode.matchAll(/\b(?:alter table|truncate|delete from|on) public\.(\w+)/g)];
  assert.ok(sentuh.length >= 15);
  for (const m of sentuh)
    assert.ok(m[1].startsWith("demo_") || m[1].startsWith("%"), `menyentuh ${m[1]}`);
  assert.doesNotMatch(kode, /drop\s+(schema|table)/i);
});

test("migrasi demo_workspace = gabungan 3 bagian di scratchpad (kalau ada)", () => {
  const dir = process.env.DEMO_PARTS_DIR;
  if (!dir) return;
  const gabung = ["demo3_part1.sql", "demo3_part2.sql", "demo3_part3.sql"].map((f) => readFileSync(join(dir, f), "utf8")).join("");
  assert.equal(gabung, readFileSync(MIG, "utf8"));
});

test(".local-data tetap di .gitignore", () => {
  assert.match(readFileSync(root(".gitignore"), "utf8"), /^\/\.local-data\/$/m);
});
