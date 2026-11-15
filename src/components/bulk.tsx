"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import type { Field } from "@/lib/fields";
import { rp } from "@/lib/format";
import { canonSub, cleanText, diffDrafts, findDuplicates, MAX_CREATE, mergeChanges, parsePasted, type RowChange } from "@/lib/bulk";
import type { BatchResult, RowError } from "@/app/actions";

type R = Record<string, unknown> & { id: string };

export interface BulkConfig {
  /** kolom yang bisa diubah massal (select/date/bool/text) */
  edit: string[];
  /** tabel "Isi cepat": angka, status, tanggal per item */
  quick?: { amount: string; status: string; date: string; estimate?: string; done: string };
  /** "Tambah banyak": kolom bersama di atas, kolom per baris di bawah (kolom pertama = nama) */
  add?: { shared: string[]; perRow: string[]; dupScope: string[]; paste?: boolean };
}

/* ---------- kecil-kecil ---------- */

export const digits = (s: string) => s.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
export const groupDigits = (s: string) => {
  const d = digits(s);
  return d ? Number(d).toLocaleString("id-ID") : "";
};
const toMoneyInput = (v: unknown) => (v === null || v === undefined || v === "" ? "" : Number(v).toLocaleString("id-ID"));
const fromMoneyInput = (s: string) => (digits(s) ? Number(digits(s)) : null);

function MoneyInput({ value, onChange, label, id, invalid, className = "" }: {
  value: string; onChange: (v: string) => void; label: string; id?: string; invalid?: boolean; className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <span aria-hidden className="num pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-ink-3">Rp</span>
      <input id={id} className="input num pl-9" inputMode="numeric" autoComplete="off" aria-label={label} aria-invalid={invalid || undefined}
        value={value} onChange={(e) => onChange(groupDigits(e.target.value))} />
    </div>
  );
}

/** Lembar dialog: lembar bawah di HP, panel di desktop. Escape menutup (bawaan <dialog>). */
function Sheet({ title, sub, onClose, children, footer, wide }: {
  title: string; sub?: ReactNode; onClose: () => void; children: ReactNode; footer: ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId();
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} className={`sheet ${wide ? "sheet-wide" : ""}`} onClose={onClose} onCancel={onClose} aria-labelledby={`${uid}-t`}>
      <div className="flex max-h-[92dvh] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 pb-3 pt-5">
          <div className="min-w-0">
            <h2 id={`${uid}-t`} className="display text-[1.6rem]">{title}</h2>
            {sub && <p className="mt-1.5 text-[13px] text-ink-2">{sub}</p>}
          </div>
          <button type="button" className="btn btn-ghost h-8 flex-none" onClick={onClose}>Tutup</button>
        </header>
        <div className="overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        <footer className="border-t border-line px-5 py-3.5">{footer}</footer>
      </div>
    </dialog>
  );
}

function BoolSelect({ id, value, onChange, unchanged }: { id: string; value: string; onChange: (v: string) => void; unchanged?: boolean }) {
  return (
    <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      {unchanged && <option value="">— tidak diubah —</option>}
      <option value="true">Ya</option>
      <option value="false">Belum</option>
    </select>
  );
}

const asBool = (v: string) => (v === "true" ? true : v === "false" ? false : v);

/* ---------- bilah aksi ---------- */

export function SelectionBar({ count, total, visibleCount, allVisibleSelected, onSelectVisible, actions, onDelete, onCancel, pending }: {
  count: number; total: number; visibleCount: number; allVisibleSelected: boolean; onSelectVisible: () => void;
  actions: { label: string; onClick: () => void; primary?: boolean }[];
  onDelete: () => Promise<void>; onCancel: () => void; pending: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 5000);
    return () => clearTimeout(t);
  }, [confirm]);
  const none = count === 0;
  return (
    <div role="toolbar" aria-label="Aksi untuk item terpilih"
      className="bulk-bar fixed inset-x-3 bottom-[calc(3.75rem+env(safe-area-inset-bottom)+0.5rem)] z-40 mx-auto max-w-2xl md:bottom-5">
      <div className="flex items-center gap-2 border-b border-line-2 px-3 py-2">
        <p className="min-w-0 flex-1 text-[14px]" aria-live="polite">
          <span className="num font-medium">{count}</span> <span className="text-ink-2">dari {total} dipilih</span>
        </p>
        {visibleCount > 0 && (
          <button type="button" className="btn btn-ghost h-9 text-[13px]" onClick={onSelectVisible}>
            {allVisibleSelected ? "Kosongkan" : `Pilih semua (${visibleCount})`}
          </button>
        )}
        <button type="button" className="btn btn-ghost h-9 text-[13px]" onClick={onCancel}>Batal</button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
        {actions.map((a) => (
          <button key={a.label} type="button" className={`btn h-10 px-3 text-[13.5px] ${a.primary ? "btn-primary" : ""}`} disabled={none || pending} onClick={a.onClick}>
            {a.label}
          </button>
        ))}
        <button type="button" className={`btn ml-auto h-10 px-3 text-[13.5px] ${confirm ? "btn-danger-solid" : "btn-danger"}`}
          disabled={none || pending}
          onClick={async () => {
            if (!confirm) return setConfirm(true);
            await onDelete();
            setConfirm(false);
          }}>
          {confirm ? `Ya, hapus ${count} item` : "Hapus"}
        </button>
      </div>
    </div>
  );
}

/* ---------- toast ---------- */

export type ToastState = { text: string; tone: "ok" | "error"; details?: string[]; undo?: () => void } | null;

export function BulkToast({ toast, onClose, lifted }: { toast: NonNullable<ToastState>; onClose: () => void; lifted: boolean }) {
  useEffect(() => {
    const t = setTimeout(onClose, toast.tone === "error" ? 12000 : 8000);
    return () => clearTimeout(t);
  }, [toast, onClose]);
  return (
    <div role={toast.tone === "error" ? "alert" : "status"}
      className={`bulk-toast fixed inset-x-3 z-50 mx-auto max-w-md border bg-sheet px-4 py-3 text-[14px] ${
        toast.tone === "error" ? "border-alert text-alert" : "border-emerald/50 text-ink"
      } ${lifted ? "bottom-[calc(3.75rem+env(safe-area-inset-bottom)+7.5rem)] md:bottom-36" : "bottom-[calc(3.75rem+env(safe-area-inset-bottom)+0.75rem)] md:bottom-6"}`}>
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1">{toast.text}</span>
        {toast.undo && (
          <button type="button" className="btn h-9 px-3 text-[13px]" onClick={toast.undo}>Urungkan</button>
        )}
        <button type="button" className="btn btn-ghost h-9 px-2 text-[13px]" onClick={onClose} aria-label="Tutup pesan">tutup</button>
      </div>
      {toast.details && toast.details.length > 0 && (
        <ul className="mt-2 max-h-32 list-disc overflow-y-auto pl-5 text-[13px]">
          {toast.details.map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      )}
    </div>
  );
}

/** Ringkas hasil batch jadi teks per baris, mis. "Maskara: Data tidak ditemukan". */
export function describeErrors(res: Extract<BatchResult, { ok: false }>, nameOf: (e: RowError) => string): string[] {
  return (res.rowErrors ?? []).slice(0, 8).map((e) => `${nameOf(e)}: ${e.message}`);
}

/* ---------- ubah massal ---------- */

export function BulkEditSheet({ fields, rows, focusKey, quickHint, onClose, onApply }: {
  fields: Field[]; rows: R[]; focusKey?: string; quickHint?: boolean; onClose: () => void;
  onApply: (changes: RowChange[], undo: RowChange[]) => Promise<BatchResult>;
}) {
  const uid = useId();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (focusKey) document.getElementById(`${uid}-${focusKey}`)?.focus();
  }, [focusKey, uid]);

  const patch = Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, asBool(typeof v === "string" ? v.trim() : v)]));
  const { changes, undo } = mergeChanges(rows, patch);
  const filled = Object.values(vals).filter((v) => v !== "").length;

  return (
    <Sheet title="Ubah massal" onClose={onClose}
      sub={<>Untuk <span className="num">{rows.length}</span> item terpilih. Kolom yang dibiarkan kosong tidak diubah.</>}
      footer={
        <>
          {msg && <p role="alert" className="mb-2 text-[14px] text-alert">{msg}</p>}
          <div className="flex items-center gap-3">
            <span className="flex-1 text-[13px] text-ink-3" aria-live="polite">
              {filled === 0 ? "Belum ada kolom yang diisi" : changes.length === 0 ? "Semua sudah bernilai sama" : `${changes.length} item akan berubah`}
            </span>
            <button type="button" className="btn btn-primary" disabled={pending || changes.length === 0}
              onClick={() => start(async () => {
                const r = await onApply(changes, undo);
                if (r.ok) onClose();
                else setMsg(r.message);
              })}>
              {pending ? "Menyimpan…" : `Terapkan ke ${changes.length || rows.length}`}
            </button>
          </div>
        </>
      }>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => {
          const id = `${uid}-${f.key}`;
          const v = vals[f.key] ?? "";
          const set = (x: string) => setVals((s) => ({ ...s, [f.key]: x }));
          let control: ReactNode;
          if (f.type === "bool") control = <BoolSelect id={id} value={v} onChange={set} unchanged />;
          else if (f.type === "select")
            control = (
              <select id={id} className="input" value={v} onChange={(e) => set(e.target.value)}>
                <option value="">— tidak diubah —</option>
                {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            );
          else if (f.type === "date")
            control = <input id={id} type="date" className="input" value={v} onChange={(e) => set(e.target.value)} />;
          else
            control = (
              <>
                <input id={id} className="input" value={v} placeholder="tidak diubah" list={f.options ? `${id}-l` : undefined}
                  autoComplete="off" onChange={(e) => set(e.target.value)} />
                {f.options && <datalist id={`${id}-l`}>{f.options.map((o) => <option key={o} value={o} />)}</datalist>}
              </>
            );
          return (
            <div key={f.key}>
              <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between text-[13px] font-medium text-ink-2">
                {f.label}
                {v !== "" && <button type="button" className="text-[12px] font-normal text-ink-3 underline" onClick={() => set("")}>kosongkan</button>}
              </label>
              {control}
            </div>
          );
        })}
      </div>
      {quickHint && <p className="mt-4 text-[12.5px] text-ink-3">
        Nominal (realisasi, DP) tidak diisi di sini karena beda tiap barang. Pakai <b className="font-medium text-ink-2">Isi cepat</b> untuk itu.
      </p>}
    </Sheet>
  );
}

/* ---------- isi cepat (biaya) ---------- */

type Draft = { amount: string; status: string; date: string };

export function QuickFillSheet({ rows, cfg, statusOptions, nameKey, onClose, onApply }: {
  rows: R[]; cfg: NonNullable<BulkConfig["quick"]>; statusOptions: readonly string[]; nameKey: string;
  onClose: () => void; onApply: (changes: RowChange[], undo: RowChange[]) => Promise<BatchResult>;
}) {
  const uid = useId();
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, {
      amount: toMoneyInput(r[cfg.amount]), status: String(r[cfg.status] ?? ""), date: String(r[cfg.date] ?? ""),
    }])),
  );
  const [allDate, setAllDate] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [rowErr, setRowErr] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const set = (id: string, p: Partial<Draft>) => setDrafts((s) => ({ ...s, [id]: { ...s[id], ...p } }));
  const asValues = useMemo(
    () => Object.fromEntries(Object.entries(drafts).map(([id, d]) => [id, {
      [cfg.amount]: fromMoneyInput(d.amount), [cfg.status]: d.status, [cfg.date]: d.date,
    }])),
    [drafts, cfg],
  );
  const { changes, undo } = diffDrafts(rows, asValues);
  const allDone = rows.every((r) => drafts[r.id].status === cfg.done);

  return (
    <Sheet wide title="Isi cepat" onClose={onClose}
      sub={<>Ketik nominal tiap barang, lalu simpan sekaligus. Tidak ada yang tersimpan sebelum tombol simpan ditekan.</>}
      footer={
        <>
          {msg && <p role="alert" className="mb-2 text-[14px] text-alert">{msg}</p>}
          <div className="flex items-center gap-3">
            <span className="flex-1 text-[13px] text-ink-3" aria-live="polite">
              {changes.length === 0 ? "Belum ada perubahan" : `${changes.length} dari ${rows.length} item berubah`}
            </span>
            <button type="button" className="btn btn-primary" disabled={pending || changes.length === 0}
              onClick={() => start(async () => {
                setRowErr({});
                const r = await onApply(changes, undo);
                if (r.ok) return onClose();
                setMsg(r.message);
                setRowErr(Object.fromEntries((r.rowErrors ?? []).map((e) => [e.id ?? changes[e.index]?.id ?? "", e.message])));
              })}>
              {pending ? "Menyimpan…" : `Simpan ${changes.length} perubahan`}
            </button>
          </div>
        </>
      }>
      <div className="mb-3 flex flex-wrap items-end gap-2 border-b border-line-2 pb-3">
        <button type="button" className="chip" aria-pressed={allDone}
          onClick={() => setDrafts((s) => Object.fromEntries(Object.entries(s).map(([id, d]) => [id, { ...d, status: allDone ? String(rows.find((r) => r.id === id)?.[cfg.status] ?? "") : cfg.done }])))}>
          Semua {cfg.done}
        </button>
        <span className="ml-auto flex items-center gap-1.5">
          <label htmlFor={`${uid}-all`} className="text-[12.5px] text-ink-2">Tanggal semua</label>
          <input id={`${uid}-all`} type="date" className="input h-9 w-[9.5rem] text-[14px]" value={allDate} onChange={(e) => setAllDate(e.target.value)} />
          <button type="button" className="btn h-9 px-3 text-[13px]" disabled={!allDate}
            onClick={() => setDrafts((s) => Object.fromEntries(Object.entries(s).map(([id, d]) => [id, { ...d, date: allDate }])))}>
            Isi
          </button>
        </span>
      </div>

      <div role="table" aria-label="Isi cepat item terpilih" className="text-[14px]">
        <div role="row" className="hidden gap-3 pb-1.5 md:grid md:grid-cols-[minmax(0,1fr)_9.5rem_13.5rem_9.5rem]">
          {["Nama", "Realisasi", "Status", "Tanggal bayar"].map((h) => (
            <span key={h} role="columnheader" className="eyebrow">{h}</span>
          ))}
        </div>
        {rows.map((r) => {
          const d = drafts[r.id];
          const est = cfg.estimate ? (r[cfg.estimate] as number | null) : null;
          const name = String(r[nameKey] ?? "");
          const changed = changes.some((c) => c.id === r.id);
          const err = rowErr[r.id];
          return (
            <div key={r.id} role="row" data-changed={changed || undefined}
              className="quick-row grid grid-cols-2 gap-x-2 gap-y-2 border-t border-line-2 py-3 md:grid-cols-[minmax(0,1fr)_9.5rem_13.5rem_9.5rem] md:items-center md:gap-3">
              <div role="cell" className="col-span-2 min-w-0 md:col-span-1">
                <p className="truncate font-medium">{name}</p>
                <p className="num text-[12px] text-ink-3">
                  {est != null ? `est. ${rp(est)}` : "tanpa estimasi"}
                  {changed && <span className="ml-2 text-emerald">● diubah</span>}
                </p>
                {err && <p className="mt-0.5 text-[12.5px] text-alert">{err}</p>}
              </div>
              <div role="cell" className="col-span-2 md:col-span-1">
                <MoneyInput label={`Realisasi ${name}`} value={d.amount} onChange={(v) => set(r.id, { amount: v })} />
                {d.status === cfg.done && !digits(d.amount) && est != null && est > 0 && (
                  <button type="button" className="mt-1 text-[12.5px] text-emerald underline underline-offset-2"
                    onClick={() => set(r.id, { amount: toMoneyInput(est) })}>
                    pakai estimasi {rp(est)}
                  </button>
                )}
              </div>
              <div role="cell" className="flex gap-1.5">
                <button type="button" className="btn h-11 flex-none px-2.5 text-[12px]" aria-pressed={d.status === cfg.done}
                  data-on={d.status === cfg.done || undefined} aria-label={`Tandai ${name} ${cfg.done}`}
                  onClick={() => set(r.id, { status: d.status === cfg.done ? String(r[cfg.status] === cfg.done ? "" : r[cfg.status] ?? "") : cfg.done })}>
                  {cfg.done}
                </button>
                <select className="input min-w-0 text-[14px]" aria-label={`Status ${name}`} value={d.status} onChange={(e) => set(r.id, { status: e.target.value })}>
                  <option value="">—</option>
                  {statusOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div role="cell">
                <input type="date" className="input text-[14px]" aria-label={`Tanggal bayar ${name}`} value={d.date}
                  onChange={(e) => set(r.id, { date: e.target.value })} />
              </div>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

/* ---------- tambah banyak ---------- */

type NewRow = { key: number; vals: Record<string, string> };

export function AddManySheet({ cfg, fields, defaults, existing, subKey, subOptions, noun, onClose, onCreate }: {
  cfg: NonNullable<BulkConfig["add"]>; fields: Field[]; defaults: Record<string, unknown>; existing: R[];
  subKey?: string; subOptions: string[]; noun: string;
  onClose: () => void; onCreate: (inputs: Record<string, unknown>[]) => Promise<BatchResult>;
}) {
  const uid = useId();
  const byKey = Object.fromEntries(fields.map((f) => [f.key, f]));
  const shared = cfg.shared.map((k) => byKey[k]).filter(Boolean);
  const perRow = cfg.perRow.map((k) => byKey[k]).filter(Boolean);
  const nameKey = cfg.perRow[0];
  const [common, setCommon] = useState<Record<string, string>>(() =>
    Object.fromEntries(shared.map((f) => [f.key, defaults[f.key] == null ? "" : String(defaults[f.key])])),
  );
  const nextKey = useRef(3);
  const blank = (key: number): NewRow => ({ key, vals: Object.fromEntries(perRow.map((f) => [f.key, ""])) });
  const [rows, setRows] = useState<NewRow[]>(() => [blank(0), blank(1), blank(2)]);
  const [paste, setPaste] = useState<string | null>(null);
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [rowErr, setRowErr] = useState<Record<number, string>>({});
  const [pending, start] = useTransition();
  const lastName = useRef<HTMLInputElement | null>(null);
  const wantFocus = useRef(false);
  useEffect(() => {
    if (wantFocus.current) {
      wantFocus.current = false;
      lastName.current?.focus();
    }
  }, [rows.length]);

  const sharedClean = { ...common };
  if (subKey && typeof sharedClean[subKey] === "string" && sharedClean[subKey]) sharedClean[subKey] = canonSub(sharedClean[subKey], subOptions);

  const filled = rows.filter((r) => cleanText(r.vals[nameKey] ?? ""));
  const asRecords = filled.map((r) => ({ ...defaults, ...sharedClean, ...r.vals }));
  const dups = findDuplicates(asRecords, existing, nameKey, cfg.dupScope);
  const dupByKey = new Map([...dups].map(([i, m]) => [filled[i].key, m]));

  const subTyped = subKey ? cleanText(common[subKey] ?? "") : "";
  const subNote = !subKey || !subTyped ? null
    : subOptions.some((o) => o === subTyped) ? null
    : subOptions.some((o) => o.toLowerCase() === subTyped.toLowerCase()) ? `Disimpan sebagai “${canonSub(subTyped, subOptions)}” (sudah ada)`
    : "Sub-kategori baru";

  const add = () => {
    if (rows.length >= MAX_CREATE) return;
    wantFocus.current = true;
    setRows((s) => [...s, blank(nextKey.current++)]);
  };
  const applyPaste = () => {
    const { rows: parsed, extra } = parsePasted(paste ?? "", MAX_CREATE);
    const moneyKeys = perRow.filter((f) => f.type === "money" || f.type === "int").map((f) => f.key);
    const kept = rows.filter((r) => cleanText(r.vals[nameKey] ?? ""));
    const room = MAX_CREATE - kept.length;
    const incoming = parsed.filter((p) => p.nama).slice(0, Math.max(0, room)).map((p) => {
      const r = blank(nextKey.current++);
      r.vals[nameKey] = p.nama;
      if (moneyKeys[0] && p.estimasi != null && !Number.isNaN(p.estimasi)) r.vals[moneyKeys[0]] = toMoneyInput(p.estimasi);
      if (moneyKeys[1] && p.realisasi != null && !Number.isNaN(p.realisasi)) r.vals[moneyKeys[1]] = toMoneyInput(p.realisasi);
      return r;
    });
    const dropped = parsed.filter((p) => p.nama).length - incoming.length + extra;
    setRows([...kept, ...incoming].length ? [...kept, ...incoming] : [blank(nextKey.current++)]);
    setPasteNote(`${incoming.length} baris dikenali${dropped > 0 ? `, ${dropped} dilewati (maks. ${MAX_CREATE})` : ""}. Periksa di bawah sebelum menyimpan.`);
    setPaste(null);
  };

  const submit = () =>
    start(async () => {
      setMsg(null);
      setRowErr({});
      const inputs = filled.map((r) => {
        const out: Record<string, unknown> = { ...defaults, ...sharedClean };
        for (const f of perRow) out[f.key] = f.type === "money" || f.type === "int" ? digits(r.vals[f.key] ?? "") : r.vals[f.key];
        out[nameKey] = cleanText(String(out[nameKey] ?? ""));
        return out;
      });
      const res = await onCreate(inputs);
      if (res.ok) return onClose();
      setMsg(res.message);
      setRowErr(Object.fromEntries((res.rowErrors ?? []).map((e) => [filled[e.index]?.key ?? -1, e.message])));
    });

  const scopeLabel = cfg.dupScope.map((k) => cleanText(String(sharedClean[k] ?? ""))).filter(Boolean).join(" › ");

  return (
    <Sheet wide title={`Tambah banyak ${noun}`} onClose={onClose}
      sub={<>Isi kolom bersama sekali, lalu satu baris per {noun}. Maks. {MAX_CREATE} baris.</>}
      footer={
        <>
          {msg && <p role="alert" className="mb-2 text-[14px] text-alert">{msg}</p>}
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1 text-[13px] text-ink-2" aria-live="polite">
              {filled.length === 0 ? "Belum ada baris yang diisi" : (
                <>Akan dibuat <b className="num font-medium text-ink">{filled.length}</b> {noun}{scopeLabel && <> di {scopeLabel}</>}
                  {dups.size > 0 && <span className="text-brass-ink"> · {dups.size} mungkin duplikat</span>}</>
              )}
            </span>
            <button type="button" className="btn btn-primary" disabled={pending || filled.length === 0} onClick={submit}>
              {pending ? "Menyimpan…" : `Simpan ${filled.length || ""} ${noun}`.replace(/\s+/g, " ")}
            </button>
          </div>
        </>
      }>
      <fieldset className="grid gap-3 border-b border-line-2 pb-4 sm:grid-cols-3">
        <legend className="eyebrow mb-2">Berlaku untuk semua baris</legend>
        {shared.map((f) => {
          const id = `${uid}-${f.key}`;
          const v = common[f.key] ?? "";
          const set = (x: string) => setCommon((s) => ({ ...s, [f.key]: x }));
          const opts = f.key === subKey ? subOptions : f.options;
          return (
            <div key={f.key}>
              <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-2">
                {f.label}{f.required && <span className="text-alert"> *</span>}
              </label>
              {f.type === "select" ? (
                <select id={id} className="input" value={v} onChange={(e) => set(e.target.value)}>
                  {!f.required && <option value="">—</option>}
                  {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === "bool" ? (
                <BoolSelect id={id} value={v} onChange={set} />
              ) : f.type === "date" ? (
                <input id={id} type="date" className="input" value={v} onChange={(e) => set(e.target.value)} />
              ) : (
                <>
                  <input id={id} className="input" value={v} list={opts?.length ? `${id}-l` : undefined} autoComplete="off"
                    aria-describedby={f.key === subKey && subNote ? `${id}-n` : undefined} onChange={(e) => set(e.target.value)} />
                  {opts?.length ? <datalist id={`${id}-l`}>{opts.map((o) => <option key={o} value={o} />)}</datalist> : null}
                </>
              )}
              {f.key === subKey && subNote && <p id={`${id}-n`} className="mt-1 text-[12.5px] text-ink-3">{subNote}</p>}
            </div>
          );
        })}
      </fieldset>

      {cfg.paste && (
        <div className="border-b border-line-2 py-3">
          {paste === null ? (
            <button type="button" className="text-[13.5px] text-emerald underline underline-offset-2" onClick={() => setPaste("")}>
              Tempel daftar dari catatan / chat
            </button>
          ) : (
            <div>
              <label htmlFor={`${uid}-paste`} className="mb-1.5 block text-[13px] font-medium text-ink-2">
                Satu {noun} per baris. Format: <span className="num">Nama, estimasi, realisasi</span> (angka boleh dikosongkan, mis. 150rb atau 1,5jt)
              </label>
              <textarea id={`${uid}-paste`} className="input min-h-28 text-[15px]" value={paste} onChange={(e) => setPaste(e.target.value)}
                placeholder={"Cushion, 200000, 152000\nBlush on, 150rb\nConcealer"} />
              <div className="mt-2 flex gap-2">
                <button type="button" className="btn h-9 px-3 text-[13px]" disabled={!paste.trim()} onClick={applyPaste}>Masukkan ke baris</button>
                <button type="button" className="btn btn-ghost h-9 text-[13px]" onClick={() => setPaste(null)}>Batal</button>
              </div>
            </div>
          )}
          {pasteNote && <p role="status" className="mt-2 text-[12.5px] text-ink-2">{pasteNote}</p>}
        </div>
      )}

      <ol className="mt-1">
        {rows.map((r, i) => {
          const dup = dupByKey.get(r.key);
          const err = rowErr[r.key];
          return (
            <li key={r.key} className="add-row border-b border-line-2 py-2.5">
              <div className="flex items-start gap-2">
                <span aria-hidden className="num w-5 flex-none pt-3 text-right text-[11px] text-ink-3">{i + 1}</span>
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 md:grid-cols-[minmax(0,1.6fr)_repeat(2,minmax(0,1fr))]">
                  {perRow.map((f, fi) => {
                    const v = r.vals[f.key] ?? "";
                    const set = (x: string) => setRows((s) => s.map((x0) => (x0.key === r.key ? { ...x0, vals: { ...x0.vals, [f.key]: x } } : x0)));
                    const label = `${f.label} baris ${i + 1}`;
                    if (f.type === "money")
                      return <MoneyInput key={f.key} label={label} value={v} onChange={set} className={fi === 0 ? "col-span-2 md:col-span-1" : ""} />;
                    return (
                      <input key={f.key} ref={fi === 0 && i === rows.length - 1 ? lastName : undefined}
                        className={`input ${fi === 0 ? "col-span-2 md:col-span-1" : ""} ${f.type === "int" ? "num" : ""}`}
                        aria-label={label} placeholder={fi === 0 ? f.label : f.type === "int" ? f.label : `${f.label} (opsional)`}
                        type={f.type === "date" ? "date" : "text"} inputMode={f.type === "int" ? "numeric" : undefined}
                        aria-invalid={fi === 0 && err ? true : undefined} autoComplete="off" value={v}
                        onChange={(e) => set(f.type === "int" ? digits(e.target.value) : e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && fi === 0 && i === rows.length - 1) {
                            e.preventDefault();
                            add();
                          }
                        }} />
                    );
                  })}
                </div>
                <button type="button" className="btn btn-ghost size-11 flex-none justify-center p-0 text-[18px]" aria-label={`Hapus baris ${i + 1}`}
                  onClick={() => setRows((s) => (s.length > 1 ? s.filter((x) => x.key !== r.key) : [blank(nextKey.current++)]))}>
                  ×
                </button>
              </div>
              {(dup || err) && (
                <p className={`ml-7 mt-1 text-[12.5px] ${err ? "text-alert" : "text-brass-ink"}`}>{err ?? `${dup} (tetap boleh disimpan)`}</p>
              )}
            </li>
          );
        })}
      </ol>
      <button type="button" className="btn mt-3 h-10" onClick={add} disabled={rows.length >= MAX_CREATE}>
        + baris
      </button>
      {rows.length >= MAX_CREATE && <span className="ml-3 text-[12.5px] text-ink-3">Sudah {MAX_CREATE} baris (maksimal)</span>}
    </Sheet>
  );
}
