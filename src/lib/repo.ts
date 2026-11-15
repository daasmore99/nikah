import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { localDemo, localMode, supabaseConfigured } from "./env";
import { createClient } from "./supabase/server";
import { groupSameValues } from "./bulk";
import { DEMO_BELUM_SIAP, demoHeaders, demoLimitMessage, isDemoLimit, isDemoSchemaOld, resolveStore, tableFor } from "./demo";
import { demoNewWsWait } from "./security/limiter";
import { pesanTunggu } from "./security/ratelimit";
import { demoTemplateRows } from "./demo-template";
import { demoWs } from "./demo-ws";
import { todayJakarta } from "./calc";
import { localRepo } from "./local-store";
import { RepoError, type BatchOutcome, type Repo, type StoreMode } from "./repo-types";
import type { Pengaturan } from "./types";

export { RepoError };
export type { BatchOutcome, Repo, User, StoreMode } from "./repo-types";

/** Pesan aman untuk error database: tanpa nama tabel/kolom/constraint. */
function pesanDb(op: string, e: { code?: string }): string {
  if (e.code === "42501" || e.code === "PGRST301") return `${op} gagal: tidak ada akses.`;
  if (e.code === "23505") return `${op} gagal: data yang sama sudah ada.`;
  if (e.code === "23514" || e.code === "23502" || e.code === "22P02" || e.code === "22001") return `${op} gagal: isian tidak memenuhi aturan.`;
  if (e.code === "23503") return `${op} gagal: data terkait tidak ditemukan.`;
  return `${op} gagal. Coba lagi sebentar.`;
}

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
  // Akun demo: klien BARU (per request) yang mengirim header x-demo-ws = ruang browser ini (cookie demo_ws).
  // RLS demo_* hanya membuka baris ruang itu. Akun asli memakai klien biasa, tanpa header & tanpa cookie demo.
  const db = mode === "demo" ? await createClient(demoHeaders(mode, await demoWs())) : sb;
  // SEMUA akses tabel data lewat tableFor(mode, ...): akun demo hanya pernah menyentuh public.demo_*.
  // Tidak ada fallback ke tabel asli: kalau demo_* belum ada, akun demo mendapat error yang jelas.
  const fail = (op: string, e: { code?: string; message: string } | null) => {
    if (!e) return;
    if (mode === "demo" && isDemoLimit(e)) throw new RepoError(demoLimitMessage(e));
    if (mode === "demo" && isDemoSchemaOld(e)) throw new RepoError(DEMO_BELUM_SIAP);
    // detail Postgres (nama tabel/constraint) hanya ke log server, klien mendapat pesan ramah
    console.error(`[repo] ${op} gagal`, e.code, e.message);
    throw new RepoError(pesanDb(op, e));
  };
  const repo: Repo = {
    user: { id: claims.sub, email, nama: email.split("@")[0] },
    mode,
    async list(table) {
      const { data, error } = await db.from(tableFor(mode, table)).select("*").order("urutan").order("created_at");
      fail("Memuat data", error);
      return (data ?? []) as never;
    },
    async insert(table, values) {
      const { error } = await db.from(tableFor(mode, table)).insert(values);
      fail("Menyimpan", error);
    },
    async update(table, id, values) {
      const { error, count } = await db.from(tableFor(mode, table)).update(values, { count: "exact" }).eq("id", id);
      fail("Mengubah", error);
      if (count === 0) throw new RepoError("Data tidak ditemukan atau tidak ada akses");
    },
    async remove(table, id) {
      const { error } = await db.from(tableFor(mode, table)).delete().eq("id", id);
      fail("Menghapus", error);
    },
    async insertMany(table, rows) {
      const { error } = await db.from(tableFor(mode, table)).insert(rows);
      fail("Menyimpan", error);
    },
    async updateMany(table, changes) {
      const out: BatchOutcome = { done: [], failed: [] };
      for (const g of groupSameValues(changes)) {
        const { data, error } = await db.from(tableFor(mode, table)).update(g.values).in("id", g.ids).select("id");
        if (error) {
          console.error("[repo] Mengubah gagal", error.code, error.message);
          const msg = mode === "demo" && isDemoLimit(error) ? demoLimitMessage(error) : pesanDb("Mengubah", error);
          for (const id of g.ids) out.failed.push({ id, message: msg });
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
      const { error, count } = await db.from(tableFor(mode, table)).delete({ count: "exact" }).in("id", ids);
      fail("Menghapus", error);
      return count ?? ids.length;
    },
    async pengaturan() {
      const { data, error } = await db.from(tableFor(mode, "pengaturan")).select("*").eq("id", 1).maybeSingle();
      fail("Memuat pengaturan", error);
      if (!data)
        throw new RepoError(mode === "demo" ? DEMO_BELUM_SIAP : "Akun ini belum terdaftar di tabel anggota, atau migrasi belum dijalankan.");
      return data as Pengaturan;
    },
    async updatePengaturan(values) {
      const { error } = await db.from(tableFor(mode, "pengaturan")).update(values).eq("id", 1);
      fail("Menyimpan pengaturan", error);
    },
    async profil() {
      // profil (tabel identitas, bukan data) hanya terbaca anggota; demo cukup nama dirinya sendiri
      if (mode === "demo") return { [repo.user.id]: repo.user.nama };
      const { data } = await sb.from("profil").select("id, nama");
      const map = Object.fromEntries((data ?? []).map((p) => [p.id as string, p.nama as string]));
      const me = map[repo.user.id];
      if (me) repo.user.nama = me;
      return map;
    },
    async resetDemo() {
      if (mode !== "demo") throw new RepoError("Reset hanya untuk akun demo.");
      // reset_demo hanya menghapus ruang pemanggil (ws dari header), lalu isi lagi kerangka contoh
      const { error } = await db.rpc("reset_demo");
      fail("Reset demo", error);
      await isiContoh();
    },
  };

  /** Kerangka contoh lewat jalur repo yang sama (insertMany). Gagal = dicatat, ruang tetap bisa dipakai. */
  async function isiContoh() {
    for (const { table, rows } of demoTemplateRows(todayJakarta())) {
      try {
        await repo.insertMany(table, rows);
      } catch (e) {
        console.error("[demo] isi contoh gagal", table, e instanceof Error ? e.message : e);
      }
    }
  }

  /**
   * Ruang demo baru: buat baris pengaturan kosong untuk ws ini (insert ... on conflict (ws) do nothing).
   * Hanya request yang BENAR-BENAR menyisipkan baris itu yang mengisi kerangka contoh, jadi dua request
   * bersamaan tidak menggandakan isi. Dijalankan sekali per request (requireRepo di-cache), sebelum
   * halaman membaca daftar apa pun.
   */
  async function siapkanRuang() {
    const ada = await db.from(tableFor(mode, "pengaturan")).select("id").limit(1);
    fail("Memuat pengaturan", ada.error);
    if (ada.data?.length) return;
    // ruang baru dibatasi per IP (cegah pembuatan ruang massal yang menghabiskan kuota database)
    const tunggu = await demoNewWsWait();
    if (tunggu > 0) throw new RepoError(pesanTunggu(tunggu, "ruang demo baru dari jaringan ini"));
    const baru = await db
      .from(tableFor(mode, "pengaturan"))
      .upsert({ nama_pria: "", nama_wanita: "", tanggal_nikah: null, target_dana: 0 }, { onConflict: "ws", ignoreDuplicates: true })
      .select("id");
    fail("Menyiapkan ruang demo", baru.error);
    if (baru.data?.length) await isiContoh();
  }

  if (mode === "demo") await siapkanRuang();
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
  if (localMode) return localDemo ? localRepo({ mode: "demo", ws: await demoWs() }) : localRepo({ mode: "asli" });
  redirect("/setup");
});
