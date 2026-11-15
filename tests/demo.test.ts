/**
 * Akun demo: resolusi penyimpanan per jenis pengguna dan isolasi data lokal.
 * Tes ini harus gagal kalau akun demo bisa melihat atau mengubah data asli.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { emptyPengaturan, judulPasangan, localDemoFlag, localFileFor, resolveStore, schemaFor } from "../src/lib/demo";
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

test("skema dan file per penyimpanan", () => {
  assert.equal(schemaFor("asli"), "public");
  assert.equal(schemaFor("demo"), "demo");
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

test("repo Supabase: semua tabel data lewat klien per-skema (db), bukan langsung sb", () => {
  const src = readFileSync(join(__dirname, "..", "src", "lib", "repo.ts"), "utf8");
  const langsung = [...src.matchAll(/\bsb\.from\("([^"]+)"\)/g)].map((m) => m[1]);
  // hanya profil (tabel public, dibaca di cabang anggota saja) yang boleh langsung
  assert.deepEqual(langsung, ["profil"]);
  assert.match(src, /if \(mode === "demo"\) return \{ \[repo\.user\.id\]: repo\.user\.nama \};\s*const \{ data \} = await sb\.from\("profil"\)/);
  assert.match(src, /mode === "demo" \? sb\.schema\(schemaFor\("demo"\)\) : sb/);
});
