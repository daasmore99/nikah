"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FIELDS, PENGATURAN_FIELDS } from "@/lib/fields";
import { requireRepo, RepoError } from "@/lib/repo";
import { supabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { TABLE_NAMES, type TableName } from "@/lib/types";
import { validate, type Values } from "@/lib/validate";

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

export async function updatePengaturan(input: Values): Promise<ActionResult> {
  const v = validate(PENGATURAN_FIELDS, input, true);
  if (!v.ok) return { ok: false, message: "Cek lagi isian yang ditandai.", errors: v.errors };
  return run(async () => {
    const repo = await requireRepo();
    await repo.updatePengaturan(v.data);
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
