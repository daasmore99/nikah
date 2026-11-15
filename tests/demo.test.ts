/**
 * Akun demo: resolusi penyimpanan per jenis pengguna dan isolasi data lokal.
 * Tes ini harus gagal kalau akun demo bisa melihat atau mengubah data asli.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DATA_TABLES, DEMO_BELUM_SIAP, emptyPengaturan, isMissingRelation, judulPasangan, localDemoFlag, localFileFor, resolveStore, tableFor } from "../src/lib/demo";
import { localRepo } from "../src/lib/local-store";
import { TABLE_NAMES } from "../src/lib/types";

test("resolveStore: anggota -> asli, penonton -> demo, tak dikenal -> ditolak", () => {
  assert.equal(resolveStore({ anggota: true, penonton: false }), "asli");
  assert.equal(resolveStore({ anggota: false, penonton: true }), "demo");
  assert.equal(resolveStore({ anggota: false, penonton: false }), "ditolak");
  assert.equal(resolveStore({ anggota: null, penonton: undefined }), "ditolak");
  // email demo yang tidak sengaja juga ada di anggota tetap tidak pernah membuka data asli
  assert.equal(resolveStore({ anggota: true, penonton: true }), "demo");
});

test("tableFor: demo -> demo_<tabel>, asli -> <tabel>, semua 12 tabel terpetakan", () => {
  assert.equal(DATA_TABLES.length, 12);
  assert.equal(new Set(DATA_TABLES).size, 12);
  assert.deepEqual([...DATA_TABLES].sort(), ["pengaturan", ...TABLE_NAMES].sort());
  const asli = new Set(DATA_TABLES.map((t) => tableFor("asli", t)));
  for (const t of DATA_TABLES) {
    assert.equal(tableFor("asli", t), t);
    assert.equal(tableFor("demo", t), `demo_${t}`);
    // tabel demo tidak pernah sama dengan tabel asli mana pun
    assert.ok(!asli.has(tableFor("demo", t)), `${t}: tabel demo bentrok dengan tabel asli`);
    assert.notEqual(tableFor("demo", t), tableFor("asli", t));
  }
  // nama yang dipakai migrasi 20261115010000_demo_public.sql
  const sql = readFileSync(join(__dirname, "..", "supabase", "migrations", "20261115010000_demo_public.sql"), "utf8");
  const kode = sql.replace(/--.*$/gm, ""); // tanpa komentar
  const truncate = /truncate([^;]*);/.exec(kode)?.[1] ?? "";
  for (const t of DATA_TABLES) {
    assert.ok(kode.includes(`create table if not exists public.demo_${t} `), `migrasi: demo_${t}`);
    assert.match(kode, new RegExp(`public\\.demo_${t}\\s+\\(like public\\.${t}\\s+including all\\)`), `migrasi: like ${t}`);
    if (t !== "pengaturan") assert.match(truncate, new RegExp(`public\\.demo_${t}\\b`), `reset: demo_${t}`);
  }
  // reset hanya menyentuh demo_*, dan migrasi tidak pernah drop skema/tabel otomatis
  for (const m of truncate.matchAll(/public\.(\w+)/g)) assert.ok(m[1].startsWith("demo_"), `reset menyentuh ${m[1]}`);
  assert.doesNotMatch(kode, /drop\s+(schema|table)/i);
});

test("migrasi demo_public = gabungan 3 bagian di scratchpad (kalau ada)", () => {
  const dir = process.env.DEMO_PARTS_DIR;
  if (!dir) return;
  const gabung = ["demo2_part1.sql", "demo2_part2.sql", "demo2_part3.sql"].map((f) => readFileSync(join(dir, f), "utf8")).join("");
  assert.equal(gabung, readFileSync(join(__dirname, "..", "supabase", "migrations", "20261115010000_demo_public.sql"), "utf8"));
});

test("isMissingRelation: tabel/fungsi belum ada dikenali, error lain tidak", () => {
  assert.equal(isMissingRelation({ code: "PGRST205", message: "Could not find the table 'public.demo_tamu' in the schema cache" }), true);
  assert.equal(isMissingRelation({ code: "42P01", message: 'relation "public.demo_tamu" does not exist' }), true);
  assert.equal(isMissingRelation({ code: "PGRST202", message: "Could not find the function public.reset_demo" }), true);
  assert.equal(isMissingRelation({ code: "42501", message: "permission denied" }), false);
  assert.equal(isMissingRelation(null), false);
  assert.match(DEMO_BELUM_SIAP, /^Penyimpanan demo belum disiapkan/);
});

test("file per penyimpanan", () => {
  assert.equal(localFileFor("asli"), "db.json");
  assert.equal(localFileFor("demo"), "demo.json");
});

test("LOCAL_DEMO hanya aktif di mode lokal; LOCAL_VIEWER alias", () => {
  assert.equal(localDemoFlag({ LOCAL_DEMO: "1" }, true), true);
  assert.equal(localDemoFlag({ LOCAL_VIEWER: "1" }, true), true);
  assert.equal(localDemoFlag({ LOCAL_DEMO: "1" }, false), false);
  assert.equal(localDemoFlag({}, true), false);
});

test("pengaturan demo kosong dan judul netral", () => {
  const p = emptyPengaturan();
  assert.equal(p.nama_pria, "");
  assert.equal(p.nama_wanita, "");
  assert.equal(p.tanggal_nikah, null);
  assert.equal(p.target_dana, 0);
  for (const [k, v] of Object.entries(p)) if (k !== "id") assert.ok(v === "" || v === null || v === 0, `${k} harus kosong`);
  assert.equal(judulPasangan(p), "Tracker Pernikahan");
  assert.equal(judulPasangan({ nama_pria: "Budi", nama_wanita: "Sari" }), "Budi & Sari");
});

function sandbox() {
  const root = mkdtempSync(join(tmpdir(), "wt-demo-"));
  mkdirSync(join(root, ".local-data"));
  const asli = {
    pengaturan: { ...emptyPengaturan(), nama_pria: "Ananda", nama_wanita: "Zalfa", tanggal_nikah: "2027-04-10", target_dana: 70000000 },
    tables: Object.fromEntries(TABLE_NAMES.map((t) => [t, []])),
  };
  asli.tables.tamu = [{ id: "11111111-1111-1111-1111-111111111111", nama: "Tamu Asli", urutan: 1 }] as never;
  const dbPath = join(root, ".local-data", "db.json");
  writeFileSync(dbPath, JSON.stringify(asli));
  return { root, dbPath, before: readFileSync(dbPath, "utf8") };
}

test("repo demo lokal: mulai kosong, tulis berfungsi, db.json asli tidak tersentuh", async () => {
  const { root, dbPath, before } = sandbox();
  try {
    const repo = localRepo({ root, mode: "demo" });
    assert.equal(repo.mode, "demo");
    for (const t of TABLE_NAMES) assert.deepEqual(await repo.list(t), [], `${t} harus kosong`);
    const p = await repo.pengaturan();
    assert.equal(p.nama_pria, "");
    assert.equal(p.tanggal_nikah, null);
    assert.ok(!JSON.stringify(p).includes("Ananda"));

    await repo.insert("tamu", { nama: "Tamu Demo", urutan: 1 });
    await repo.insertMany("tamu", [{ nama: "A", urutan: 2 }, { nama: "B", urutan: 3 }]);
    let rows = await repo.list("tamu");
    assert.deepEqual(rows.map((r) => r.nama), ["Tamu Demo", "A", "B"]);
    await repo.update("tamu", rows[0].id, { nama: "Diubah" });
    const out = await repo.updateMany("tamu", [{ id: rows[1].id, values: { konfirmasi: "Hadir" } }]);
    assert.deepEqual(out.failed, []);
    assert.equal(await repo.removeMany("tamu", [rows[2].id]), 1);
    await repo.remove("tamu", rows[1].id);
    rows = await repo.list("tamu");
    assert.deepEqual(rows.map((r) => r.nama), ["Diubah"]);
    await repo.updatePengaturan({ nama_pria: "Budi", tanggal_nikah: "2028-01-01" });
    assert.equal((await repo.pengaturan()).nama_pria, "Budi");

    // tidak bisa menyentuh baris asli lewat id-nya
    await assert.rejects(repo.update("tamu", "11111111-1111-1111-1111-111111111111", { nama: "x" }));

    assert.equal(readFileSync(dbPath, "utf8"), before, "db.json asli berubah");
    assert.ok(existsSync(join(root, ".local-data", "demo.json")));

    await repo.resetDemo();
    assert.deepEqual(await repo.list("tamu"), []);
    assert.equal((await repo.pengaturan()).nama_pria, "");
    assert.equal(readFileSync(dbPath, "utf8"), before, "db.json asli berubah setelah reset");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("repo asli lokal menolak reset demo", async () => {
  const { root, dbPath, before } = sandbox();
  try {
    const repo = localRepo({ root, mode: "asli" });
    assert.equal((await repo.list("tamu")).length, 1);
    await assert.rejects(repo.resetDemo(), /akun demo/);
    assert.equal(readFileSync(dbPath, "utf8"), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("repo Supabase: semua tabel data lewat tableFor(mode, ...), tanpa skema demo dan tanpa fallback", () => {
  const src = readFileSync(join(__dirname, "..", "src", "lib", "repo.ts"), "utf8");
  const froms = [...src.matchAll(/\.from\(([^)]*\)?)\)/g)].map((m) => m[1]);
  assert.ok(froms.length >= 10);
  // satu-satunya pengecualian: profil (tabel identitas anggota, hanya di cabang asli)
  const langsung = froms.filter((f) => !/^tableFor\(mode, (table|"pengaturan")\)$/.test(f));
  assert.deepEqual(langsung, ['"profil"']);
  assert.match(src, /if \(mode === "demo"\) return \{ \[repo\.user\.id\]: repo\.user\.nama \};\s*const \{ data \} = await sb\.from\("profil"\)/);
  assert.doesNotMatch(src, /\.schema\(/);
  assert.doesNotMatch(src, /schemaFor/);
  // rpc hanya fungsi identifikasi + reset_demo (yang sendiri mengecek is_penonton)
  assert.deepEqual([...src.matchAll(/\.rpc\("([^"]+)"\)/g)].map((m) => m[1]).sort(), ["is_anggota", "is_penonton", "reset_demo"]);
  // tabel demo belum ada -> pesan jelas untuk akun demo, bukan jatuh ke tabel asli
  assert.match(src, /mode === "demo" && isMissingRelation\(e\)\) throw new RepoError\(DEMO_BELUM_SIAP\)/);
});

test("tidak ada kode yang memakai skema demo lama", () => {
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  for (const f of walk(join(__dirname, "..", "src")).filter((f) => /\.(ts|tsx)$/.test(f)))
    assert.doesNotMatch(readFileSync(f, "utf8"), /\.schema\(/, f);
});
