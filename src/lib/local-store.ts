/**
 * Mode lokal (dev saja): data di file JSON. Tanpa server-only supaya bisa dites.
 * Data asli: .local-data/db.json (awalnya dari data/import.json).
 * Demo:      .local-data/demo.json (awalnya KOSONG; tidak pernah membaca db.json atau import.json).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ImportData, Pengaturan, TableName } from "./types";
import { TABLE_NAMES } from "./types";
import { BatchOutcome, RepoError, type Repo, type StoreMode } from "./repo-types";
import { emptyPengaturan, localFileFor } from "./demo";

type LocalDb = { pengaturan: Pengaturan; tables: Record<TableName, Record<string, unknown>[]> };

export function emptyLocalDb(): LocalDb {
  return {
    pengaturan: emptyPengaturan(),
    tables: Object.fromEntries(TABLE_NAMES.map((t) => [t, []])) as unknown as LocalDb["tables"],
  };
}

export function localRepo({ root = process.cwd(), mode }: { root?: string; mode: StoreMode }): Repo {
  const dir = join(root, ".local-data");
  const file = join(dir, localFileFor(mode));

  function save(db: LocalDb) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, JSON.stringify(db, null, 1));
  }
  function load(): LocalDb {
    if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
    if (mode === "demo") {
      const db = emptyLocalDb();
      save(db);
      return db;
    }
    const src = join(root, "data", "import.json");
    if (!existsSync(src)) throw new RepoError("Mode lokal butuh data/import.json. Jalankan `npm run import` dulu.");
    const { data } = JSON.parse(readFileSync(src, "utf8")) as { data: ImportData };
    const now = new Date().toISOString();
    const db: LocalDb = {
      pengaturan: { id: 1, ...data.pengaturan },
      tables: Object.fromEntries(
        Object.entries(data.tables).map(([t, rows]) => [
          t,
          rows.map((r) => ({ id: randomUUID(), created_by: null, created_at: now, updated_at: now, ...r })),
        ]),
      ) as unknown as LocalDb["tables"],
    };
    save(db);
    return db;
  }

  const user =
    mode === "demo"
      ? { id: "lokal-demo", email: "demo@localhost", nama: "Demo" }
      : { id: "lokal", email: "lokal@localhost", nama: "Lokal" };
  return {
    user,
    mode,
    async list(table) {
      const rows = load().tables[table] ?? [];
      return [...rows].sort((a, b) => (a.urutan as number) - (b.urutan as number)) as never;
    },
    async insert(table, values) {
      const db = load();
      const now = new Date().toISOString();
      (db.tables[table] ??= []).push({ id: randomUUID(), created_by: user.id, created_at: now, updated_at: now, ...values });
      save(db);
    },
    async update(table, id, values) {
      const db = load();
      const row = db.tables[table]?.find((r) => r.id === id);
      if (!row) throw new RepoError("Data tidak ditemukan");
      Object.assign(row, values, { updated_at: new Date().toISOString(), updated_by: user.id });
      save(db);
    },
    async remove(table, id) {
      const db = load();
      db.tables[table] = (db.tables[table] ?? []).filter((r) => r.id !== id);
      save(db);
    },
    async insertMany(table, rows) {
      const db = load();
      const now = new Date().toISOString();
      (db.tables[table] ??= []).push(
        ...rows.map((values) => ({ id: randomUUID(), created_by: user.id, created_at: now, updated_at: now, ...values })),
      );
      save(db);
    },
    async updateMany(table, changes) {
      // satu kali baca + satu kali tulis: atomik di mode lokal
      const db = load();
      const now = new Date().toISOString();
      const out: BatchOutcome = { done: [], failed: [] };
      for (const c of changes) {
        const row = db.tables[table]?.find((r) => r.id === c.id);
        if (!row) out.failed.push({ id: c.id, message: "Data tidak ditemukan" });
        else out.done.push(c.id);
      }
      if (out.failed.length)
        return { done: [], failed: [...out.failed, ...out.done.map((id) => ({ id, message: "Dibatalkan (ada baris lain yang gagal)" }))] };
      for (const c of changes) {
        const row = db.tables[table]!.find((r) => r.id === c.id)!;
        Object.assign(row, c.values, { updated_at: now, updated_by: user.id });
      }
      save(db);
      return out;
    },
    async removeMany(table, ids) {
      const db = load();
      const set = new Set(ids);
      const before = (db.tables[table] ?? []).length;
      db.tables[table] = (db.tables[table] ?? []).filter((r) => !set.has(r.id as string));
      save(db);
      return before - db.tables[table].length;
    },
    async pengaturan() {
      return load().pengaturan;
    },
    async updatePengaturan(values) {
      const db = load();
      Object.assign(db.pengaturan, values);
      save(db);
    },
    async profil() {
      return { [user.id]: user.nama };
    },
    async resetDemo() {
      if (mode !== "demo") throw new RepoError("Reset hanya untuk akun demo.");
      save(emptyLocalDb());
    },
  };
}
