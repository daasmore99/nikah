import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { localDemo, localMode, supabaseConfigured } from "./env";
import { createClient } from "./supabase/server";
import { groupSameValues } from "./bulk";
import { resolveStore, schemaFor } from "./demo";
import { localRepo } from "./local-store";
import { RepoError, type BatchOutcome, type Repo, type StoreMode } from "./repo-types";
import type { Pengaturan } from "./types";

export { RepoError };
export type { BatchOutcome, Repo, User, StoreMode } from "./repo-types";

/* ---------------- Supabase ---------------- */

type Sb = Awaited<ReturnType<typeof createClient>>;

/**
 * Tentukan penyimpanan dari database (satu sumber kebenaran: tabel anggota & penonton).
 * Gagal memanggil fungsi (mis. migrasi demo belum dijalankan) dianggap "tidak" = fail closed.
 */
async function storeOf(sb: Sb) {
  const [a, p] = await Promise.all([sb.rpc("is_anggota"), sb.rpc("is_penonton")]);
  return resolveStore({ anggota: a.error ? false : a.data === true, penonton: p.error ? false : p.data === true });
}

async function supabaseRepo(): Promise<Repo | null> {
  const sb = await createClient();
  const { data } = await sb.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const email = String(claims.email ?? "");
  const access = await storeOf(sb);
  if (access === "ditolak") throw new RepoError("Akun ini belum terdaftar di tabel anggota atau penonton, atau migrasi belum dijalankan.");
  const mode: StoreMode = access;
  // SEMUA akses tabel data lewat `db`. Akun demo hanya pernah menyentuh skema demo.
  const db = mode === "demo" ? sb.schema(schemaFor("demo")) : sb;
  const fail = (op: string, e: { message: string } | null) => {
    if (e) throw new RepoError(`${op} gagal: ${e.message}`);
  };
  const repo: Repo = {
    user: { id: claims.sub, email, nama: email.split("@")[0] },
    mode,
    async list(table) {
      const { data, error } = await db.from(table).select("*").order("urutan").order("created_at");
      fail("Memuat data", error);
      return (data ?? []) as never;
    },
    async insert(table, values) {
      const { error } = await db.from(table).insert(values);
      fail("Menyimpan", error);
    },
    async update(table, id, values) {
      const { error, count } = await db.from(table).update(values, { count: "exact" }).eq("id", id);
      fail("Mengubah", error);
      if (count === 0) throw new RepoError("Data tidak ditemukan atau tidak ada akses");
    },
    async remove(table, id) {
      const { error } = await db.from(table).delete().eq("id", id);
      fail("Menghapus", error);
    },
    async insertMany(table, rows) {
      const { error } = await db.from(table).insert(rows);
      fail("Menyimpan", error);
    },
    async updateMany(table, changes) {
      const out: BatchOutcome = { done: [], failed: [] };
      for (const g of groupSameValues(changes)) {
        const { data, error } = await db.from(table).update(g.values).in("id", g.ids).select("id");
        if (error) {
          for (const id of g.ids) out.failed.push({ id, message: `Mengubah gagal: ${error.message}` });
          continue;
        }
        const ok = new Set((data ?? []).map((r: { id: string }) => r.id));
        for (const id of g.ids) {
          if (ok.has(id)) out.done.push(id);
          else out.failed.push({ id, message: "Data tidak ditemukan atau tidak ada akses" });
        }
      }
      return out;
    },
    async removeMany(table, ids) {
      const { error, count } = await db.from(table).delete({ count: "exact" }).in("id", ids);
      fail("Menghapus", error);
      return count ?? ids.length;
    },
    async pengaturan() {
      const { data, error } = await db.from("pengaturan").select("*").eq("id", 1).maybeSingle();
      fail("Memuat pengaturan", error);
      if (!data)
        throw new RepoError(mode === "demo" ? "Pengaturan demo belum ada. Jalankan migrasi demo." : "Akun ini belum terdaftar di tabel anggota, atau migrasi belum dijalankan.");
      return data as Pengaturan;
    },
    async updatePengaturan(values) {
      const { error } = await db.from("pengaturan").update(values).eq("id", 1);
      fail("Menyimpan pengaturan", error);
    },
    async profil() {
      // profil ada di public dan hanya terbaca anggota; demo cukup nama dirinya sendiri
      if (mode === "demo") return { [repo.user.id]: repo.user.nama };
      const { data } = await sb.from("profil").select("id, nama");
      const map = Object.fromEntries((data ?? []).map((p) => [p.id as string, p.nama as string]));
      const me = map[repo.user.id];
      if (me) repo.user.nama = me;
      return map;
    },
    async resetDemo() {
      if (mode !== "demo") throw new RepoError("Reset hanya untuk akun demo.");
      const { error } = await sb.rpc("reset_demo");
      fail("Reset demo", error);
    },
  };
  await repo.profil();
  return repo;
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
  if (localMode) return localRepo({ mode: localDemo ? "demo" : "asli" });
  redirect("/setup");
});
