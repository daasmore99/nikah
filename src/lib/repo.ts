import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { localMode, supabaseConfigured } from "./env";
import { createClient } from "./supabase/server";
import type { ImportData, Pengaturan, Row, TableName } from "./types";

export interface User {
  id: string;
  email: string;
  nama: string;
}

export interface Repo {
  user: User;
  list<T extends TableName>(table: T): Promise<Row<T>[]>;
  insert(table: TableName, values: Record<string, unknown>): Promise<void>;
  update(table: TableName, id: string, values: Record<string, unknown>): Promise<void>;
  remove(table: TableName, id: string): Promise<void>;
  pengaturan(): Promise<Pengaturan>;
  updatePengaturan(values: Record<string, unknown>): Promise<void>;
  /** id user -> nama, untuk "dicatat oleh" */
  profil(): Promise<Record<string, string>>;
}

export class RepoError extends Error {}

/* ---------------- Supabase ---------------- */

async function supabaseRepo(): Promise<Repo | null> {
  const sb = await createClient();
  const { data } = await sb.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const email = String(claims.email ?? "");
  const fail = (op: string, e: { message: string } | null) => {
    if (e) throw new RepoError(`${op} gagal: ${e.message}`);
  };
  const repo: Repo = {
    user: { id: claims.sub, email, nama: email.split("@")[0] },
    async list(table) {
      const { data, error } = await sb.from(table).select("*").order("urutan").order("created_at");
      fail("Memuat data", error);
      return (data ?? []) as never;
    },
    async insert(table, values) {
      const { error } = await sb.from(table).insert(values);
      fail("Menyimpan", error);
    },
    async update(table, id, values) {
      const { error, count } = await sb.from(table).update(values, { count: "exact" }).eq("id", id);
      fail("Mengubah", error);
      if (count === 0) throw new RepoError("Data tidak ditemukan atau tidak ada akses");
    },
    async remove(table, id) {
      const { error } = await sb.from(table).delete().eq("id", id);
      fail("Menghapus", error);
    },
    async pengaturan() {
      const { data, error } = await sb.from("pengaturan").select("*").eq("id", 1).maybeSingle();
      fail("Memuat pengaturan", error);
      if (!data) throw new RepoError("Akun ini belum terdaftar di tabel anggota, atau migrasi belum dijalankan.");
      return data as Pengaturan;
    },
    async updatePengaturan(values) {
      const { error } = await sb.from("pengaturan").update(values).eq("id", 1);
      fail("Menyimpan pengaturan", error);
    },
    async profil() {
      const { data } = await sb.from("profil").select("id, nama");
      const map = Object.fromEntries((data ?? []).map((p) => [p.id as string, p.nama as string]));
      const me = map[repo.user.id];
      if (me) repo.user.nama = me;
      return map;
    },
  };
  await repo.profil();
  return repo;
}

/* ---------------- Lokal (dev saja) ---------------- */

type LocalDb = { pengaturan: Pengaturan; tables: Record<TableName, Record<string, unknown>[]> };
const dbFile = join(process.cwd(), ".local-data", "db.json");

function loadLocal(): LocalDb {
  if (existsSync(dbFile)) return JSON.parse(readFileSync(dbFile, "utf8"));
  const src = join(process.cwd(), "data", "import.json");
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
  saveLocal(db);
  return db;
}
function saveLocal(db: LocalDb) {
  mkdirSync(join(process.cwd(), ".local-data"), { recursive: true });
  writeFileSync(dbFile, JSON.stringify(db, null, 1));
}

function localRepo(): Repo {
  const user = { id: "lokal", email: "lokal@localhost", nama: "Lokal" };
  return {
    user,
    async list(table) {
      const rows = loadLocal().tables[table] ?? [];
      return [...rows].sort((a, b) => (a.urutan as number) - (b.urutan as number)) as never;
    },
    async insert(table, values) {
      const db = loadLocal();
      const now = new Date().toISOString();
      (db.tables[table] ??= []).push({ id: randomUUID(), created_by: user.id, created_at: now, updated_at: now, ...values });
      saveLocal(db);
    },
    async update(table, id, values) {
      const db = loadLocal();
      const row = db.tables[table]?.find((r) => r.id === id);
      if (!row) throw new RepoError("Data tidak ditemukan");
      Object.assign(row, values, { updated_at: new Date().toISOString(), updated_by: user.id });
      saveLocal(db);
    },
    async remove(table, id) {
      const db = loadLocal();
      db.tables[table] = (db.tables[table] ?? []).filter((r) => r.id !== id);
      saveLocal(db);
    },
    async pengaturan() {
      return loadLocal().pengaturan;
    },
    async updatePengaturan(values) {
      const db = loadLocal();
      Object.assign(db.pengaturan, values);
      saveLocal(db);
    },
    async profil() {
      return { lokal: "Lokal" };
    },
  };
}

/* ---------------- akses ---------------- */

/** Repo untuk user yang login. Redirect ke /login kalau belum. */
export const requireRepo = cache(async (): Promise<Repo> => {
  await connection(); // selalu render per request, jangan pernah prerender data
  if (supabaseConfigured) {
    const repo = await supabaseRepo();
    if (!repo) redirect("/login");
    return repo;
  }
  if (localMode) return localRepo();
  redirect("/setup");
});
