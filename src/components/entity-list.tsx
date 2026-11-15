"use client";

import { useCallback, useEffect, useId, useMemo, useOptimistic, useState, useTransition, type ReactNode } from "react";
import { FIELDS, type Field } from "@/lib/fields";
import { angka, rp, rpSingkat, tgl } from "@/lib/format";
import type { TableName } from "@/lib/types";
import { createRow, createRows, deleteRow, deleteRows, updateRow, updateRows, type BatchResult } from "@/app/actions";
import { canonSub as canonSubValue, subOptionsOf, type RowChange } from "@/lib/bulk";
import { AddManySheet, BulkEditSheet, BulkToast, QuickFillSheet, SelectionBar, describeErrors, type BulkConfig, type ToastState } from "./bulk";
import { FormSheet } from "./form-sheet";
import { downloadCsv } from "./csv";
import { safeHref } from "@/lib/security/url";
import { MiniBar } from "./ui";

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
  /** nullAs: baris dengan nilai kosong dihitung sebagai opsi ini; labels: teks chip */
  filter?: { key: string; label?: string; options: string[]; nullAs?: string; labels?: Record<string, string> };
  /** grup bisa dilipat. money: ringkasan dibayar/estimasi; progress: jumlah yang dicentang */
  collapse?: "money" | "progress";
  /** nilai badge yang tidak perlu ditampilkan (mis. BELUM BAYAR) */
  quietBadge?: string[];
  search?: boolean;
  defaults?: Record<string, unknown>;
  /** pilihan datalist tambahan per kolom, mis. nama tahap yang sudah ada */
  fieldOptions?: Record<string, string[]>;
  hide?: string[];
  csv: string;
  empty: string;
  total?: boolean;
  strikeDone?: boolean;
  /** tombol salin baris ke tabel lain, mis. lagu rekomendasi -> daftar lagu */
  copy?: { label: string; done: string; table: TableName; map: Record<string, string>; existing?: string[] };
  /** pilih beberapa, ubah/hapus massal, isi cepat, tambah banyak */
  bulk?: BulkConfig;
}

type Opt =
  | { type: "patch"; id: string; key: string; value: unknown }
  | { type: "many"; changes: RowChange[] }
  | { type: "remove"; ids: string[] };

const BADGE: Record<string, string> = {
  LUNAS: "text-emerald",
  "SUDAH DP": "text-brass-ink",
  "BELUM LUNAS": "text-clay",
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
  const [optimistic, applyOpt] = useOptimistic(rows, (state: R[], p: Opt) => {
    if (p.type === "patch") return state.map((r) => (r.id === p.id ? { ...r, [p.key]: p.value } : r));
    if (p.type === "remove") {
      const gone = new Set(p.ids);
      return state.filter((r) => !gone.has(r.id));
    }
    const m = new Map(p.changes.map((c) => [c.id, c.values]));
    return state.map((r) => (m.has(r.id) ? { ...r, ...m.get(r.id) } : r));
  });

  // Sub-kategori: pilihan di form diambil dari yang sudah ada, dan ejaan yang beda
  // huruf besar/kecil atau spasi dianggap sama (mengikuti ejaan pertama yang tercatat).
  const subKey = c.subGroupBy;
  const subOptions = useMemo(() => (subKey ? subOptionsOf(optimistic, subKey) : []), [optimistic, subKey]);
  const canonSub = (v: Record<string, unknown>) => {
    if (!subKey || typeof v[subKey] !== "string") return v;
    return { ...v, [subKey]: canonSubValue(v[subKey] as string, subOptions) };
  };

  const formFields = fields
    .filter((f) => !c.hide?.includes(f.key))
    .map((f) => {
      if (f.key === subKey && subOptions.length) return { ...f, options: subOptions };
      return c.fieldOptions?.[f.key] ? { ...f, options: c.fieldOptions[f.key] } : f;
    });
  const [, start] = useTransition();
  const [editing, setEditing] = useState<R | "new" | null>(null);
  const [filter, setFilter] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [toast, setToastState] = useState<ToastState>(null);
  const setToast = (text: string) => setToastState({ text, tone: "error" });
  const closeToast = useCallback(() => setToastState(null), []);
  const uid = useId();

  /* ---- pilih beberapa ---- */
  const bulk = c.bulk;
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkSheet, setBulkSheet] = useState<null | { kind: "edit"; focus?: string } | { kind: "quick" } | { kind: "add" }>(null);
  const [bulkPending, startBulk] = useTransition();
  const stopSelecting = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);
  // Escape keluar dari mode pilih (kalau tidak ada lembar yang terbuka; lembar menutup dirinya sendiri)
  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) stopSelecting();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selecting, stopSelecting]);
  // item yang sudah hilang (dihapus) tidak ikut terhitung
  const selectedRows = optimistic.filter((r) => selected.has(r.id));
  const flipOne = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const setMany = (ids: string[], on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      for (const id of ids) {
        if (on) n.add(id);
        else n.delete(id);
      }
      return n;
    });
  const nameOf = (id?: string) => {
    const r = optimistic.find((x) => x.id === id);
    return r ? String(r[c.primary] ?? (c.primaryFallback ? r[c.primaryFallback] : "") ?? "item") : "item";
  };

  /** Jalankan aksi server di dalam transisi (supaya pembaruan optimistis bertahan) dan tunggu hasilnya. */
  const inTransition = <T,>(fn: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => startBulk(async () => {
      try {
        resolve(await fn());
      } catch (e) {
        reject(e);
      }
    }));

  /** Kirim perubahan massal (optimistis) + toast dengan Urungkan selama 8 detik. */
  const applyChanges = async (changes: RowChange[], undo: RowChange[]): Promise<BatchResult> => {
    const res = await inTransition(async () => {
      applyOpt({ type: "many", changes });
      return updateRows(c.table, changes);
    });
    const revert = (back: RowChange[]) => () => {
      setToastState(null);
      startBulk(async () => {
        applyOpt({ type: "many", changes: back });
        const r = await updateRows(c.table, back);
        setToastState(r.ok
          ? { text: `${r.count} item dikembalikan`, tone: "ok" }
          : { text: r.message, tone: "error", details: describeErrors(r, (e) => nameOf(e.id)) });
      });
    };
    if (res.ok) setToastState({ text: `${res.count} item diperbarui`, tone: "ok", undo: revert(undo) });
    else if (res.doneIds?.length) {
      const doneSet = new Set(res.doneIds);
      setToastState({
        text: res.message, tone: "error", details: describeErrors(res, (e) => nameOf(e.id)),
        undo: revert(undo.filter((u) => doneSet.has(u.id))),
      });
    }
    return res;
  };

  const removeSelected = async () => {
    const ids = selectedRows.map((r) => r.id);
    const res = await inTransition(async () => {
      applyOpt({ type: "remove", ids });
      return deleteRows(c.table, ids);
    });
    if (res.ok) {
      setToastState({ text: `${res.count} item dihapus`, tone: "ok" });
      stopSelecting();
    } else setToastState({ text: res.message, tone: "error" });
  };

  const createMany = async (inputs: Record<string, unknown>[]): Promise<BatchResult> => {
    const res = await inTransition(() => createRows(c.table, inputs));
    if (res.ok) setToastState({ text: `${res.count} ${c.noun} ditambahkan`, tone: "ok" });
    return res;
  };

  const filterVal = (r: R) => {
    const v = r[c.filter!.key];
    return v === null || v === undefined || v === "" ? c.filter!.nullAs ?? "" : String(v);
  };
  const visible = optimistic.filter((r) => {
    if (filter && c.filter && filterVal(r) !== filter) return false;
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
      const s = c.subGroupBy ? String(r[c.subGroupBy] ?? "").trim().replace(/\s+/g, " ") : "";
      let G = out.find((x) => x.name === g);
      if (!G) out.push((G = { name: g, subs: [] }));
      let S = G.subs.find((x) => x.name.toLowerCase() === s.toLowerCase());
      if (!S) G.subs.push((S = { name: s, rows: [] }));
      S.rows.push(r);
    }
    return out;
  }, [visible, c.groupBy, c.subGroupBy]);

  const groupOf = (r: R) => (c.groupBy ? String(r[c.groupBy] ?? "Lainnya") : "");
  // lipat: default semua tertutup; mode progres membuka tahap pertama yang belum beres
  const [open, setOpen] = useState<Set<string>>(() => {
    if (c.collapse !== "progress" || !c.toggle) return new Set();
    const first = rows.find((r) => !r[c.toggle!]);
    return new Set(first ? [groupOf(first)] : []);
  });
  const forcedOpen = Boolean(filter || q);
  const flip = (name: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(name)) n.delete(name);
      else n.add(name);
      return n;
    });

  const toggle = (r: R, key: string, value: boolean) =>
    start(async () => {
      applyOpt({ type: "patch", id: r.id, key, value });
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
    // hanya http/https yang menjadi href (data lama/impor dengan javascript:, data:, dll. tidak ditampilkan)
    const link = c.link ? safeHref(r[c.link]) : null;
    const rawBadge = c.badge ? (r[c.badge] as string | null) : null;
    const badge = rawBadge && !c.quietBadge?.includes(rawBadge) ? rawBadge : null;
    const isSel = selecting && selected.has(r.id);
    const label = String(r[c.primary] ?? (c.primaryFallback ? r[c.primaryFallback] : "") ?? "");
    return (
      <li key={r.id} className="sel-row flex items-start gap-1 border-b border-line-2 py-0.5 last:border-b-0" data-selected={isSel || undefined}>
        {selecting && (
          <label className="-ml-3 grid size-11 flex-none cursor-pointer place-items-center">
            <input type="checkbox" className="check" checked={isSel} aria-label={`Pilih ${label}`} onChange={() => flipOne(r.id)} />
          </label>
        )}
        {c.toggle && !selecting && (
          <label className="-ml-3 grid size-11 flex-none cursor-pointer place-items-center">
            <input type="checkbox" className="check" checked={done} aria-label={`Tandai ${String(r[c.primary] ?? "")}`}
              onChange={(e) => toggle(r, c.toggle!, e.target.checked)} />
          </label>
        )}
        <button type="button" className={`row-btn min-w-0 flex-1 py-2.5 text-left ${c.toggle ? "pr-1" : "-ml-1.5 px-1.5"}`} onClick={() => (selecting ? flipOne(r.id) : setEditing(r))}
          aria-pressed={selecting ? isSel : undefined}>
          <span className={`block leading-snug transition-colors duration-300 ${done && c.strikeDone ? "text-ink-3 line-through decoration-ink-3/60" : ""}`}>
            {fmt(byKey[c.primary], r[c.primary]) ||
              (c.primaryFallback && fmt(byKey[c.primaryFallback], r[c.primaryFallback])) || <em className="text-ink-3">belum diisi</em>}
          </span>
          {(sec || badge) && (
            <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-ink-3">
              {badge && <span className={`status ${BADGE[badge] ?? "text-ink-2"}`}>{badge}</span>}
              {sec && <span>{sec}</span>}
            </span>
          )}
        </button>
        {c.toggles && !selecting && (
          <span className="flex gap-1 pt-0.5">
            {c.toggles.map((t) =>
              r[t.key] === null ? (
                <span key={t.key} className="w-11 pt-3 text-center text-[11px] text-ink-3" title="Tidak berlaku">—</span>
              ) : (
                <label key={t.key} className="flex min-h-11 w-11 cursor-pointer flex-col items-center justify-center gap-1 text-[10px] text-ink-3">
                  <input type="checkbox" className="check" checked={Boolean(r[t.key])} aria-label={`${t.label} ${String(r[c.primary])}`}
                    onChange={(e) => toggle(r, t.key, e.target.checked)} />
                  {t.label}
                </label>
              ),
            )}
          </span>
        )}
        {c.copy && !selecting && (() => {
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
          <span className="flex flex-none flex-col items-end gap-0.5 pt-3 text-right">
            {c.amount && r[c.amount] != null && (
              <span className="num text-[14px]">{byKey[c.amount]?.type === "int" ? angka(Number(r[c.amount])) : rp(Number(r[c.amount]))}</span>
            )}
            {c.amount && r[c.amount] == null && !(c.amountNote && r[c.amountNote.key] != null) && !c.collapse && (
              <span className="num text-[14px] text-ink-3">—</span>
            )}
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
        {bulk?.add && (
          <button type="button" className="btn" onClick={() => setBulkSheet({ kind: "add" })}>Tambah banyak</button>
        )}
        {bulk && optimistic.length > 0 && (
          <button type="button" className="btn" aria-pressed={selecting} data-on={selecting || undefined}
            onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>
            {selecting ? "Selesai memilih" : "Pilih beberapa"}
          </button>
        )}
        {c.search && (
          <input className="input h-10 max-w-[14rem] flex-1" placeholder="Cari…" value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Cari ${c.noun}`} />
        )}
        <button type="button" className="btn btn-ghost ml-auto" onClick={() => downloadCsv(c.csv, fields, optimistic)}>
          Ekspor CSV
        </button>
      </div>
      {c.filter && (
        <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4 py-1.5">
          <button type="button" className="chip" aria-pressed={filter === null} onClick={() => setFilter(null)}>Semua</button>
          {c.filter.options.map((o) => (
            <button key={o} type="button" className="chip" aria-pressed={filter === o} onClick={() => setFilter(filter === o ? null : o)}>
              {c.filter!.labels?.[o] ?? o} <span className="num ml-1.5 text-[11px] opacity-70">{optimistic.filter((r) => filterVal(r) === o).length}</span>
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        rows.length === 0 ? (
          <div className="border border-dashed border-emerald/35 bg-emerald-tint/40 px-5 py-7 text-center">
            <p className="text-[15px] text-ink-2">{c.empty || `Belum ada ${c.noun}.`}</p>
            <p className="mt-1 text-[13px] text-ink-3">
              Pakai <strong className="font-medium text-emerald">Tambah {c.noun}</strong>
              {bulk?.add ? <> atau <strong className="font-medium text-emerald">Tambah banyak</strong></> : null} di atas untuk mengisi.
            </p>
          </div>
        ) : (
          <p className="border-y border-line py-8 text-center text-ink-3">Tidak ada yang cocok dengan filter ini.</p>
        )
      ) : c.collapse ? (
        <div className="border-t border-ink">
          {groups.map((G) => {
            const all = optimistic.filter((r) => groupOf(r) === G.name);
            const isOpen = forcedOpen || open.has(G.name);
            const panel = `${uid}-${G.name.replace(/\W+/g, "-")}`;
            let summary: ReactNode;
            let bar: ReactNode;
            if (c.collapse === "money" && c.amount) {
              const paid = sum(all, c.amount);
              const est = c.amountNote ? sum(all, c.amountNote.key) : 0;
              summary = paid === 0 && est === 0 ? (
                <span className="text-[12.5px] text-ink-3">belum ada angka</span>
              ) : (
                <span className="num text-[12.5px] text-ink-2">
                  {rpSingkat(paid)}{est > 0 && <span className="text-ink-3"> / {rpSingkat(est)}</span>}
                </span>
              );
              bar = <MiniBar value={paid} max={Math.max(est, paid)} over={est > 0 && paid > est} />;
            } else {
              const done = c.toggle ? all.filter((r) => r[c.toggle!]).length : 0;
              summary = done === all.length ? (
                <span className="text-[12.5px] text-emerald">✓ beres</span>
              ) : (
                <span className="num text-[12.5px] text-ink-2">{done}/{all.length}</span>
              );
              bar = <MiniBar value={done} max={all.length} />;
            }
            return (
              <div key={G.name} className="border-b border-line">
                <h3 className="flex items-center">
                  {selecting && <GroupCheck ids={G.subs.flatMap((x) => x.rows.map((r) => r.id))} selected={selected} onSet={setMany} label={`Pilih semua di ${G.name}`} />}
                  <button type="button" className="fold-head flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left"
                    aria-expanded={isOpen} aria-controls={panel} onClick={() => flip(G.name)} disabled={forcedOpen}>
                    <svg aria-hidden viewBox="0 0 12 12" className="caret size-3 flex-none text-ink-2"><path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="display truncate text-[1.3rem] leading-tight">{G.name}</span>
                        {summary}
                      </span>
                      <span className="mt-1.5 flex items-center gap-3">
                        <span className="flex-1">{bar}</span>
                        <span className="num w-14 flex-none text-right text-[11px] text-ink-3">{all.length} item</span>
                      </span>
                    </span>
                  </button>
                </h3>
                <div id={panel} className="fold" data-open={isOpen} inert={!isOpen}>
                  <div>
                    <div className="pb-3 pl-6">
                      {G.subs.map((S) => (
                        <div key={S.name}>
                          {S.name && (selecting ? (
                            <div className="mt-2 flex items-center">
                              <GroupCheck ids={S.rows.map((r) => r.id)} selected={selected} onSet={setMany} label={`Pilih semua di ${S.name}`} />
                              <p className="eyebrow">{S.name}</p>
                            </div>
                          ) : <p className="eyebrow mt-3 mb-0.5">{S.name}</p>)}
                          <ul>{S.rows.map(renderRow)}</ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        groups.map((G) => (
          <div key={G.name} className={G.name ? "mt-6 first:mt-2" : ""}>
            {G.name && (
              <div className="flex items-baseline justify-between border-b border-ink pb-1.5">
                <h3 className="display flex items-center text-[1.35rem]">
                  {selecting && <GroupCheck ids={G.subs.flatMap((x) => x.rows.map((r) => r.id))} selected={selected} onSet={setMany} label={`Pilih semua di ${G.name}`} />}
                  {G.name}
                </h3>
                {c.total && c.amount && <span className="num text-[13px] text-ink-2">{rp(sum(G.subs.flatMap((x) => x.rows), c.amount))}</span>}
              </div>
            )}
            {G.subs.map((S) => (
              <div key={S.name}>
                {S.name && (selecting ? (
                  <div className="mt-3 flex items-center">
                    <GroupCheck ids={S.rows.map((r) => r.id)} selected={selected} onSet={setMany} label={`Pilih semua di ${S.name}`} />
                    <p className="eyebrow">{S.name}</p>
                  </div>
                ) : <p className="eyebrow mt-4 mb-0.5">{S.name}</p>)}
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
              ? createRow(c.table, { ...c.defaults, ...canonSub(v) })
              : updateRow(c.table, editing.id, { ...pickHidden(editing, c.hide), ...canonSub(v) })
          }
          onDelete={editing !== "new" ? () => deleteRow(c.table, editing.id) : undefined}
        />
      )}
      {selecting && <div aria-hidden className="h-32" />}
      {selecting && bulk && (() => {
        const visIds = visible.map((r) => r.id);
        const allVis = visIds.length > 0 && visIds.every((id) => selected.has(id));
        const editFields = bulk.edit.map((k) => byKey[k]).filter(Boolean);
        const actions: { label: string; onClick: () => void; primary?: boolean }[] = [];
        if (bulk.quick) actions.push({ label: "Isi cepat", onClick: () => setBulkSheet({ kind: "quick" }), primary: true });
        for (const f of editFields.slice(0, 2))
          actions.push({ label: `${f.type === "date" ? "Isi" : "Ubah"} ${f.label.toLowerCase()}…`, onClick: () => setBulkSheet({ kind: "edit", focus: f.key }) });
        if (editFields.length > 2) actions.push({ label: "Ubah lainnya…", onClick: () => setBulkSheet({ kind: "edit" }) });
        return (
          <SelectionBar count={selectedRows.length} total={optimistic.length} visibleCount={visIds.length} allVisibleSelected={allVis}
            onSelectVisible={() => setMany(visIds, !allVis)} actions={actions} onDelete={removeSelected} onCancel={stopSelecting} pending={bulkPending} />
        );
      })()}
      {bulk && bulkSheet?.kind === "edit" && (
        <BulkEditSheet fields={bulk.edit.map((k) => formFields.find((f) => f.key === k) ?? byKey[k]).filter(Boolean)} rows={selectedRows}
          focusKey={bulkSheet.focus} quickHint={Boolean(bulk.quick)} onClose={() => setBulkSheet(null)} onApply={applyChanges} />
      )}
      {bulk?.quick && bulkSheet?.kind === "quick" && (
        <QuickFillSheet rows={[...visible.filter((r) => selected.has(r.id)), ...selectedRows.filter((r) => !visible.includes(r))]}
          cfg={bulk.quick} statusOptions={byKey[bulk.quick.status]?.options ?? []} nameKey={c.primary}
          onClose={() => setBulkSheet(null)} onApply={applyChanges} />
      )}
      {bulk?.add && bulkSheet?.kind === "add" && (
        <AddManySheet cfg={bulk.add} fields={formFields} defaults={c.defaults ?? {}} existing={optimistic} subKey={subKey}
          subOptions={subOptions} noun={c.noun} onClose={() => setBulkSheet(null)} onCreate={createMany} />
      )}
      {toast && <BulkToast toast={toast} onClose={closeToast} lifted={selecting} />}
    </section>
  );
}

function pickHidden(r: R, hide?: string[]) {
  return Object.fromEntries((hide ?? []).map((k) => [k, r[k]]));
}

/** Kotak centang "pilih semua" untuk grup/sub-grup; setengah tercentang kalau baru sebagian. */
function GroupCheck({ ids, selected, onSet, label }: { ids: string[]; selected: Set<string>; onSet: (ids: string[], on: boolean) => void; label: string }) {
  const n = ids.filter((id) => selected.has(id)).length;
  const all = n > 0 && n === ids.length;
  return (
    <label className="-ml-3 grid size-11 flex-none cursor-pointer place-items-center" title={label}>
      <input type="checkbox" className="check" checked={all} aria-label={label}
        ref={(el) => {
          if (el) el.indeterminate = n > 0 && !all;
        }}
        onChange={() => onSet(ids, !all)} />
    </label>
  );
}
