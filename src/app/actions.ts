"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FIELDS, PENGATURAN_FIELDS } from "@/lib/fields";
import { requireRepo, RepoError } from "@/lib/repo";
import { supabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { TABLE_NAMES, type TableName } from "@/lib/types";
import { validate, type Values } from "@/lib/validate";
import { MAX_CREATE, MAX_IDS, type RowChange } from "@/lib/bulk";

export type ActionResult = { ok: true } | { ok: false; message: string; errors?: Record<string, string> };

function assertTable(t: string): asserts t is TableName {
  if (!TABLE_NAMES.includes(t as TableName)) throw new RepoError("Tabel tidak dikenal");
}
const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

async function run(fn: () => Promise<void>): Promise<ActionResult> {
  try {
    await fn();
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    if (e instanceof RepoError) return { ok: false, message: e.message };
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect()
    console.error(e);
    return { ok: false, message: "Ada masalah di server. Coba lagi sebentar." };
  }
}

export async function createRow(table: string, input: Values): Promise<ActionResult> {
  assertTable(table);
  const v = validate(FIELDS[table], input);
  if (!v.ok) return { ok: false, message: "Cek lagi isian yang ditandai.", errors: v.errors };
  return run(async () => {
    const repo = await requireRepo();
    await repo.insert(table, { ...v.data, urutan: Math.floor(Date.now() / 1000) });
  });
}

export async function updateRow(table: string, id: string, input: Values, partial = false): Promise<ActionResult> {
  assertTable(table);
  if (!isUuid(id)) return { ok: false, message: "ID tidak valid" };
  const v = validate(FIELDS[table], input, partial);
  if (!v.ok) return { ok: false, message: "Cek lagi isian yang ditandai.", errors: v.errors };
  return run(async () => {
    const repo = await requireRepo();
    await repo.update(table, id, v.data);
  });
}

export async function deleteRow(table: string, id: string): Promise<ActionResult> {
  assertTable(table);
  if (!isUuid(id)) return { ok: false, message: "ID tidak valid" };
  return run(async () => {
    const repo = await requireRepo();
    await repo.remove(table, id);
  });
}

/* ---------- massal ---------- */

export type RowError = { index: number; id?: string; message: string; errors?: Record<string, string> };
export type BatchResult =
  | { ok: true; count: number }
  | { ok: false; message: string; rowErrors?: RowError[]; doneIds?: string[] };

async function runBatch(fn: () => Promise<BatchResult>): Promise<BatchResult> {
  try {
    const r = await fn();
    // juga saat sebagian gagal: yang sudah tersimpan harus tampil
    if (r.ok || r.doneIds?.length) revalidatePath("/", "layout");
    return r;
  } catch (e) {
    if (e instanceof RepoError) return { ok: false, message: e.message };
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect()
    console.error(e);
    return { ok: false, message: "Ada masalah di server. Coba lagi sebentar." };
  }
}

const firstError = (errors: Record<string, string>) => Object.values(errors)[0] ?? "Isian tidak valid";

/** Tambah banyak baris sekaligus (maks. 50). Semua divalidasi dulu; satu yang salah = tidak ada yang disimpan. */
export async function createRows(table: string, inputs: Values[]): Promise<BatchResult> {
  assertTable(table);
  if (!Array.isArray(inputs) || inputs.length === 0) return { ok: false, message: "Tidak ada baris untuk disimpan." };
  if (inputs.length > MAX_CREATE) return { ok: false, message: `Maksimal ${MAX_CREATE} baris sekali simpan.` };
  const rows: Values[] = [];
  const rowErrors: RowError[] = [];
  const base = Math.floor(Date.now() / 1000);
  inputs.forEach((input, index) => {
    const v = validate(FIELDS[table], input);
    if (!v.ok) rowErrors.push({ index, message: firstError(v.errors), errors: v.errors });
    else rows.push({ ...v.data, urutan: base + index });
  });
  if (rowErrors.length) return { ok: false, message: `${rowErrors.length} baris perlu dicek. Belum ada yang disimpan.`, rowErrors };
  return runBatch(async () => {
    const repo = await requireRepo();
    await repo.insertMany(table, rows);
    return { ok: true, count: rows.length };
  });
}

/**
 * Ubah banyak baris (maks. 200), tiap baris boleh beda nilai. Validasi sama dengan ubah satu (partial).
 * Satu yang tidak valid = tidak ada yang dikirim. Kalau database menolak sebagian
 * (mis. baris sudah dihapus orang lain), yang berhasil tetap tersimpan dan sisanya dilaporkan per baris.
 */
export async function updateRows(table: string, changes: { id: string; values: Values }[]): Promise<BatchResult> {
  assertTable(table);
  if (!Array.isArray(changes) || changes.length === 0) return { ok: true, count: 0 };
  if (changes.length > MAX_IDS) return { ok: false, message: `Maksimal ${MAX_IDS} item sekali ubah.` };
  const clean: RowChange[] = [];
  const rowErrors: RowError[] = [];
  const seen = new Set<string>();
  changes.forEach((c, index) => {
    if (typeof c?.id !== "string" || !isUuid(c.id)) return rowErrors.push({ index, message: "ID tidak valid" });
    if (seen.has(c.id)) return rowErrors.push({ index, id: c.id, message: "ID ganda" });
    seen.add(c.id);
    const v = validate(FIELDS[table], c.values ?? {}, true);
    if (!v.ok) return rowErrors.push({ index, id: c.id, message: firstError(v.errors), errors: v.errors });
    if (Object.keys(v.data).length) clean.push({ id: c.id, values: v.data });
  });
  if (rowErrors.length) return { ok: false, message: `${rowErrors.length} baris perlu dicek. Belum ada yang diubah.`, rowErrors };
  if (!clean.length) return { ok: true, count: 0 };
  return runBatch(async () => {
    const repo = await requireRepo();
    const out = await repo.updateMany(table, clean);
    if (!out.failed.length) return { ok: true, count: out.done.length };
    const index = new Map(changes.map((c, i) => [c.id, i]));
    return {
      ok: false,
      message: out.done.length
        ? `${out.done.length} item tersimpan, ${out.failed.length} gagal.`
        : `Tidak ada yang tersimpan: ${out.failed[0].message}`,
      doneIds: out.done,
      rowErrors: out.failed.map((f) => ({ index: index.get(f.id) ?? -1, id: f.id, message: f.message })),
    };
  });
}

/** Hapus banyak baris (maks. 200) dalam satu perintah. */
export async function deleteRows(table: string, ids: string[]): Promise<BatchResult> {
  assertTable(table);
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, message: "Tidak ada item terpilih." };
  if (ids.length > MAX_IDS) return { ok: false, message: `Maksimal ${MAX_IDS} item sekali hapus.` };
  if (!ids.every((id) => typeof id === "string" && isUuid(id))) return { ok: false, message: "ID tidak valid" };
  const unique = [...new Set(ids)];
  return runBatch(async () => {
    const repo = await requireRepo();
    const n = await repo.removeMany(table, unique);
    return { ok: true, count: n };
  });
}

export async function updatePengaturan(input: Values): Promise<ActionResult> {
  const v = validate(PENGATURAN_FIELDS, input, true);
  if (!v.ok) return { ok: false, message: "Cek lagi isian yang ditandai.", errors: v.errors };
  return run(async () => {
    const repo = await requireRepo();
    await repo.updatePengaturan(v.data);
  });
}

/** Kosongkan semua data akun demo. Ditolak untuk akun data asli (dicek lagi di repo dan di database). */
export async function resetDemo(konfirmasi: string): Promise<ActionResult> {
  if (konfirmasi !== "RESET") return { ok: false, message: "Konfirmasi tidak cocok." };
  return run(async () => {
    const repo = await requireRepo();
    if (repo.mode !== "demo") throw new RepoError("Reset hanya untuk akun demo.");
    await repo.resetDemo();
  });
}

/* ---------- auth ---------- */

export async function signIn(_: unknown, form: FormData): Promise<{ message: string } | undefined> {
  if (!supabaseConfigured) return { message: "Supabase belum dikonfigurasi." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { message: "Isi email dan kata sandi." };
  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { message: "Email atau kata sandi salah." };
  redirect("/");
}

export async function signOut() {
  if (supabaseConfigured) {
    const sb = await createClient();
    await sb.auth.signOut();
  }
  redirect("/login");
}
