import type { Field } from "@/lib/fields";

const esc = (v: unknown) => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Unduh baris sebagai CSV (UTF-8 + BOM agar Excel membaca huruf dengan benar). */
export function downloadCsv(name: string, fields: Field[], rows: Record<string, unknown>[]) {
  const cols = [...fields.map((f) => f.key), "created_at", "updated_at"];
  const head = [...fields.map((f) => f.label), "Dibuat", "Diubah"];
  const lines = [head.map(esc).join(","), ...rows.map((r) => cols.map((k) => esc(r[k])).join(","))];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
