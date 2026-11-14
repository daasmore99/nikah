"use client";

import { useState, useTransition } from "react";
import type { Field } from "@/lib/fields";
import { updatePengaturan } from "@/app/actions";

const fmtMoney = (v: unknown) => (v == null || v === "" ? "" : Number(String(v).replace(/\D/g, "")).toLocaleString("id-ID"));

export function SettingsForm({ fields, initial }: { fields: Field[]; initial: Record<string, unknown> }) {
  const [vals, setVals] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.key, f.type === "money" ? fmtMoney(initial[f.key]) : String(initial[f.key] ?? "")])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const out = Object.fromEntries(fields.map((f) => [f.key, f.type === "money" ? vals[f.key].replace(/\D/g, "") : vals[f.key]]));
    start(async () => {
      const r = await updatePengaturan(out);
      if (r.ok) { setErrors({}); setMsg({ ok: true, text: "Tersimpan." }); }
      else { setErrors(r.errors ?? {}); setMsg({ ok: false, text: r.message }); }
    });
  };

  return (
    <form onSubmit={submit} className="grid max-w-[40rem] grid-cols-2 gap-x-4 gap-y-4">
      {fields.map((f) => (
        <div key={f.key} className={f.wide ? "col-span-2" : "col-span-2 sm:col-span-1"}>
          <label htmlFor={`s-${f.key}`} className="mb-1.5 block text-[13px] font-medium text-ink-2">
            {f.label}{f.required && <span className="text-alert"> *</span>}
          </label>
          <div className="relative">
            {f.type === "money" && <span className="num pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3">Rp</span>}
            <input id={`s-${f.key}`} className={`input ${f.type === "money" ? "num pl-10" : f.type === "int" ? "num" : ""}`}
              type={f.type === "date" ? "date" : "text"} inputMode={f.type === "money" || f.type === "int" ? "numeric" : undefined}
              value={vals[f.key]} required={f.required} aria-invalid={errors[f.key] ? true : undefined}
              onChange={(e) => { const v = e.target.value; setVals((s) => ({ ...s, [f.key]: f.type === "money" ? fmtMoney(v) : v })); setMsg(null); }} />
          </div>
          {errors[f.key] ? <p className="mt-1 text-[13px] text-alert">{errors[f.key]}</p>
            : f.hint ? <p className="mt-1 text-[13px] text-ink-3">{f.hint}</p> : null}
        </div>
      ))}
      <div className="col-span-2 flex items-center gap-3 pt-2">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</button>
        {msg && <span role="status" className={`text-[14px] ${msg.ok ? "text-emerald" : "text-alert"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
