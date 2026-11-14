"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { FIELDS, type Field } from "@/lib/fields";
import { angka, rp, tgl } from "@/lib/format";
import type { TableName } from "@/lib/types";
import { createRow, deleteRow, updateRow } from "@/app/actions";
import { FormSheet } from "./form-sheet";
import { downloadCsv } from "./csv";

type R = Record<string, unknown> & { id: string };

export interface ListConfig {
  table: TableName;
  noun: string;
  primary: string;
  /** dipakai kalau kolom primary kosong */
  primaryFallback?: string;
  secondary?: string[];
  amount?: string;
  amountNote?: { key: string; label: string };
  badge?: string;
  toggle?: string;
  toggles?: { key: string; label: string }[];
  link?: string;
  groupBy?: string;
  subGroupBy?: string;
  filter?: { key: string; label?: string; options: string[] };
  search?: boolean;
  defaults?: Record<string, unknown>;
  hide?: string[];
  csv: string;
  empty: string;
  total?: boolean;
  strikeDone?: boolean;
  /** tombol salin baris ke tabel lain, mis. lagu rekomendasi -> daftar lagu */
  copy?: { label: string; done: string; table: TableName; map: Record<string, string>; existing?: string[] };
}

const BADGE: Record<string, string> = {
  LUNAS: "text-emerald",
  "SUDAH DP": "text-brass",
  "BELUM LUNAS": "text-alert",
  "BELUM BAYAR": "text-ink-3",
  Dipilih: "text-emerald",
  Hadir: "text-emerald",
  "Tidak Hadir": "text-alert",
  "Belum konfirmasi": "text-ink-3",
};

function fmt(f: Field | undefined, v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (!f) return String(v);
  if (f.type === "money") return rp(Number(v));
  if (f.type === "int") return angka(Number(v));
  if (f.type === "date") return tgl(String(v));
  if (f.type === "decimal") return `${String(v).replace(".", ",")} g`;
  if (f.type === "url") return "";
  return String(v);
}

export function EntityList({ config, rows, profil }: { config: ListConfig; rows: R[]; profil: Record<string, string> }) {
  const c = config;
  const fields = FIELDS[c.table];
  const byKey = useMemo(() => Object.fromEntries(fields.map((f) => [f.key, f])), [fields]);
  const formFields = fields.filter((f) => !c.hide?.includes(f.key));

  const [optimistic, patch] = useOptimistic(rows, (state: R[], p: { id: string; key: string; value: unknown }) =>
    state.map((r) => (r.id === p.id ? { ...r, [p.key]: p.value } : r)),
  );
  const [, start] = useTransition();
  const [editing, setEditing] = useState<R | "new" | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const visible = optimistic.filter((r) => {
    if (filter && c.filter && String(r[c.filter.key] ?? "") !== filter) return false;
    if (q) {
      const hay = [c.primary, ...(c.secondary ?? [])].map((k) => String(r[k] ?? "")).join(" ").toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const groups = useMemo(() => {
    const out: { name: string; subs: { name: string; rows: R[] }[] }[] = [];
    for (const r of visible) {
      const g = c.groupBy ? String(r[c.groupBy] ?? "Lainnya") : "";
      const s = c.subGroupBy ? String(r[c.subGroupBy] ?? "") : "";
      let G = out.find((x) => x.name === g);
      if (!G) out.push((G = { name: g, subs: [] }));
      let S = G.subs.find((x) => x.name === s);
      if (!S) G.subs.push((S = { name: s, rows: [] }));
      S.rows.push(r);
    }
    return out;
  }, [visible, c.groupBy, c.subGroupBy]);

  const toggle = (r: R, key: string, value: boolean) =>
    start(async () => {
      patch({ id: r.id, key, value });
      const res = await updateRow(c.table, r.id, { [key]: value }, true);
      if (!res.ok) setToast(res.message);
    });

  const sum = (xs: R[], key: string) => xs.reduce((a, r) => a + (Number(r[key]) || 0), 0);

  const meta = (r: R) => {
    const who = r.created_by ? profil[String(r.created_by)] ?? "akun lain" : r.import_key ? "impor dari sheet" : null;
    const when = r.updated_at ? tgl(String(r.updated_at).slice(0, 10)) : "";
    return who ? `Dicatat: ${who}${when ? ` · diubah ${when}` : ""}` : "";
  };

  const renderRow = (r: R) => {
    const done = c.toggle ? Boolean(r[c.toggle]) : false;
    const sec = (c.secondary ?? [])
      .map((k) => {
        const f = byKey[k];
        const v = fmt(f, r[k]);
        if (!v || !f) return v;
        return (f.type === "money" || f.type === "date") && f.label !== "Tanggal" ? `${f.label.toLowerCase()} ${v}` : v;
      })
      .filter(Boolean)
      .join(" · ");
    const link = c.link ? (r[c.link] as string | null) : null;
    const badge = c.badge ? (r[c.badge] as string | null) : null;
    return (
      <li key={r.id} className="group flex items-start gap-3 border-b border-line-2 py-3 last:border-b-0">
        {c.toggle && (
          <input type="checkbox" className="check mt-0.5" checked={done} aria-label={`Tandai ${String(r[c.primary] ?? "")}`}
            onChange={(e) => toggle(r, c.toggle!, e.target.checked)} />
        )}
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(r)}>
          <span className={`block leading-snug ${done && c.strikeDone ? "text-ink-3 line-through decoration-ink-3/60" : ""}`}>
            {fmt(byKey[c.primary], r[c.primary]) ||
              (c.primaryFallback && fmt(byKey[c.primaryFallback], r[c.primaryFallback])) || <em className="text-ink-3">belum diisi</em>}
          </span>
          {(sec || badge) && (
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-3">
              {badge && <span className={`tag ${BADGE[badge] ?? "text-ink-2"}`}>{badge}</span>}
              {sec && <span>{sec}</span>}
            </span>
          )}
        </button>
        {c.toggles && (
          <span className="flex gap-3 pt-0.5">
            {c.toggles.map((t) =>
              r[t.key] === null ? (
                <span key={t.key} className="w-9 text-center text-[11px] text-ink-3" title="Tidak berlaku">—</span>
              ) : (
                <label key={t.key} className="flex w-9 flex-col items-center gap-1 text-[10px] text-ink-3">
                  <input type="checkbox" className="check" checked={Boolean(r[t.key])} aria-label={`${t.label} ${String(r[c.primary])}`}
                    onChange={(e) => toggle(r, t.key, e.target.checked)} />
                  {t.label}
                </label>
              ),
            )}
          </span>
        )}
        {c.copy && (() => {
          const cp = c.copy;
          const sudah = cp.existing?.includes(String(r[c.primary] ?? "").toLowerCase());
          return sudah ? (
            <span className="pt-0.5 text-[12.5px] text-emerald">{cp.done}</span>
          ) : (
            <button type="button" className="btn h-8 px-3 text-[13px]" onClick={() => start(async () => {
              const res = await createRow(cp.table, Object.fromEntries(Object.entries(cp.map).map(([to, from]) => [to, r[from]])));
              if (!res.ok) setToast(res.message);
            })}>{cp.label}</button>
          );
        })()}
        {(c.amount || link) && (
          <span className="flex flex-none flex-col items-end gap-0.5 pt-0.5 text-right">
            {c.amount && <span className="num text-[14px]">{r[c.amount] != null ? (byKey[c.amount]?.type === "int" ? angka(Number(r[c.amount])) : rp(Number(r[c.amount]))) : <span className="text-ink-3">—</span>}</span>}
            {c.amountNote && r[c.amountNote.key] != null && (
              <span className="num text-[11.5px] text-ink-3">{c.amountNote.label} {rp(Number(r[c.amountNote.key]))}</span>
            )}
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer" className="link text-[12.5px]">buka link</a>
            )}
          </span>
        )}
      </li>
    );
  };

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>Tambah {c.noun}</button>
        {c.search && (
          <input className="input h-10 max-w-[14rem] flex-1" placeholder="Cari…" value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Cari ${c.noun}`} />
        )}
        <button type="button" className="btn btn-ghost ml-auto" onClick={() => downloadCsv(c.csv, fields, optimistic)}>
          Ekspor CSV
        </button>
      </div>
      {c.filter && (
        <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1">
          <button type="button" className="chip" aria-pressed={filter === null} onClick={() => setFilter(null)}>Semua</button>
          {c.filter.options.map((o) => (
            <button key={o} type="button" className="chip" aria-pressed={filter === o} onClick={() => setFilter(filter === o ? null : o)}>
              {o} <span className="num ml-1.5 text-[11px] opacity-70">{optimistic.filter((r) => r[c.filter!.key] === o).length}</span>
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="border-y border-line py-8 text-center text-ink-3">{rows.length === 0 ? c.empty : "Tidak ada yang cocok dengan filter ini."}</p>
      ) : (
        groups.map((G) => (
          <div key={G.name} className={G.name ? "mt-6 first:mt-2" : ""}>
            {G.name && (
              <div className="flex items-baseline justify-between border-b border-ink pb-1.5">
                <h3 className="display text-[1.35rem]">{G.name}</h3>
                {c.total && c.amount && <span className="num text-[13px] text-ink-2">{rp(sum(G.subs.flatMap((x) => x.rows), c.amount))}</span>}
              </div>
            )}
            {G.subs.map((S) => (
              <div key={S.name}>
                {S.name && <p className="eyebrow mt-4 mb-0.5">{S.name}</p>}
                <ul>{S.rows.map(renderRow)}</ul>
              </div>
            ))}
          </div>
        ))
      )}
      {c.total && c.amount && !c.groupBy && visible.length > 0 && (
        <div className="rule-double mt-1 flex justify-between pt-2 text-[14px]">
          <span className="text-ink-2">Total</span>
          <span className="num font-medium">{rp(sum(visible, c.amount))}</span>
        </div>
      )}

      {editing !== null && (
        <FormSheet
          key={editing === "new" ? "new" : editing.id}
          onClose={() => setEditing(null)}
          title={editing === "new" ? `Tambah ${c.noun}` : `Ubah ${c.noun}`}
          fields={formFields}
          initial={editing === "new" ? { ...c.defaults } : editing}
          meta={editing !== "new" ? meta(editing) : undefined}
          onSubmit={(v) =>
            editing === "new"
              ? createRow(c.table, { ...c.defaults, ...v })
              : updateRow(c.table, editing.id, { ...pickHidden(editing, c.hide), ...v })
          }
          onDelete={editing !== "new" ? () => deleteRow(c.table, editing.id) : undefined}
        />
      )}
      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-md border border-alert bg-sheet px-4 py-3 text-[14px] text-alert md:bottom-6">
          {toast}
          <button type="button" className="float-right text-ink-2 underline" onClick={() => setToast(null)}>tutup</button>
        </div>
      )}
    </section>
  );
}

function pickHidden(r: R, hide?: string[]) {
  return Object.fromEntries((hide ?? []).map((k) => [k, r[k]]));
}
