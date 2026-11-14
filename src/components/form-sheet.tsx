"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { Field } from "@/lib/fields";
import type { ActionResult } from "@/app/actions";

type Values = Record<string, unknown>;

const groupDigits = (s: string) => {
  const d = s.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return d ? Number(d).toLocaleString("id-ID") : "";
};

function toInput(f: Field, v: unknown): string | boolean {
  if (f.type === "bool") return Boolean(v);
  if (v === null || v === undefined) return "";
  if (f.type === "money") return Number(v).toLocaleString("id-ID");
  if (f.type === "decimal") return String(v).replace(".", ",");
  return String(v);
}

export function FormSheet({
  onClose, title, fields, initial, onSubmit, onDelete, meta,
}: {
  onClose: () => void;
  title: string;
  fields: Field[];
  initial: Values;
  onSubmit: (v: Values) => Promise<ActionResult>;
  onDelete?: () => Promise<ActionResult>;
  meta?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const [vals, setVals] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, toInput(f, initial[f.key])])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [pending, start] = useTransition();

  // Dipasang hanya saat dibuka (lihat pemanggil), jadi cukup showModal sekali.
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const out: Values = {};
    for (const f of fields) {
      const v = vals[f.key];
      out[f.key] = f.type === "money" && typeof v === "string" ? v.replace(/\D/g, "") : v;
    }
    start(async () => {
      const r = await onSubmit(out);
      if (r.ok) onClose();
      else {
        setErrors(r.errors ?? {});
        setMsg(r.message);
      }
    });
  };

  const del = () => {
    if (!onDelete) return;
    if (!confirmDel) return setConfirmDel(true);
    start(async () => {
      const r = await onDelete();
      if (r.ok) onClose();
      else setMsg(r.message);
    });
  };

  return (
    <dialog ref={ref} className="sheet" onClose={onClose} onCancel={onClose} aria-labelledby={`${uid}-t`}>
      <form onSubmit={submit} className="flex max-h-[92dvh] flex-col">
        <header className="flex items-baseline justify-between gap-4 border-b border-line px-5 pb-3 pt-5">
          <h2 id={`${uid}-t`} className="display text-[1.7rem]">{title}</h2>
          <button type="button" className="btn btn-ghost h-8" onClick={onClose}>Tutup</button>
        </header>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 overflow-y-auto px-5 py-5">
          {fields.map((f) => {
            const id = `${uid}-${f.key}`;
            const err = errors[f.key];
            const v = vals[f.key];
            const span = f.wide || f.type === "textarea" || f.type === "bool" ? "col-span-2" : "col-span-2 sm:col-span-1";
            if (f.type === "bool")
              return (
                <label key={f.key} htmlFor={id} className={`${span} flex items-start gap-3 py-1`}>
                  <input id={id} type="checkbox" className="check mt-0.5" checked={Boolean(v)}
                    onChange={(e) => setVals((s) => ({ ...s, [f.key]: e.target.checked }))} />
                  <span>
                    <span className="text-[15px]">{f.label}</span>
                    {f.hint && <span className="block text-[13px] text-ink-3">{f.hint}</span>}
                  </span>
                </label>
              );
            const common = {
              id, name: f.key, "aria-invalid": err ? true : undefined,
              "aria-describedby": err ? `${id}-e` : f.hint ? `${id}-h` : undefined,
              className: "input", required: f.required,
            };
            const strV = typeof v === "string" ? v : "";
            const set = (x: string) => setVals((s) => ({ ...s, [f.key]: x }));
            let control: React.ReactNode;
            if (f.type === "textarea") control = <textarea {...common} value={strV} onChange={(e) => set(e.target.value)} />;
            else if (f.type === "select")
              control = (
                <select {...common} value={strV} onChange={(e) => set(e.target.value)}>
                  {!f.required && <option value="">—</option>}
                  {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              );
            else
              control = (
                <>
                  <div className="relative">
                    {f.type === "money" && <span className="num pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3">Rp</span>}
                    <input
                      {...common}
                      className={`input ${f.type === "money" ? "num pl-10" : ""} ${f.type === "int" || f.type === "decimal" ? "num" : ""}`}
                      type={f.type === "date" ? "date" : f.type === "url" ? "url" : "text"}
                      inputMode={f.type === "money" || f.type === "int" ? "numeric" : f.type === "decimal" ? "decimal" : undefined}
                      list={f.options ? `${id}-l` : undefined}
                      value={strV}
                      onChange={(e) => set(f.type === "money" ? groupDigits(e.target.value) : e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  {f.options && (
                    <datalist id={`${id}-l`}>{f.options.map((o) => <option key={o} value={o} />)}</datalist>
                  )}
                </>
              );
            return (
              <div key={f.key} className={span}>
                <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-2">
                  {f.label}{f.required && <span className="text-alert"> *</span>}
                </label>
                {control}
                {err ? (
                  <p id={`${id}-e`} className="mt-1 text-[13px] text-alert">{err}</p>
                ) : f.hint ? (
                  <p id={`${id}-h`} className="mt-1 text-[13px] text-ink-3">{f.hint}</p>
                ) : null}
              </div>
            );
          })}
        </div>
        <footer className="border-t border-line px-5 py-4">
          {msg && <p role="alert" className="mb-3 text-[14px] text-alert">{msg}</p>}
          <div className="flex items-center gap-2">
            {onDelete && (
              <button type="button" className={`btn ${confirmDel ? "btn-danger" : "btn-ghost text-alert"}`} onClick={del} disabled={pending}>
                {confirmDel ? "Ya, hapus" : "Hapus"}
              </button>
            )}
            <span className="flex-1 truncate text-[12px] text-ink-3">{meta}</span>
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </button>
          </div>
        </footer>
      </form>
    </dialog>
  );
}
