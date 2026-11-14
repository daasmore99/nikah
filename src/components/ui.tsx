import type { ReactNode } from "react";

export function PageHead({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-6">
      {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
      <h1 className="display text-[2.6rem] md:text-[3.4rem]">{title}</h1>
      {children && <div className="mt-2 max-w-[38rem] text-[15px] text-ink-2">{children}</div>}
    </header>
  );
}

export function Section({ title, aside, children, id }: { title: string; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="mt-12 first:mt-0">
      <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-ink pb-2">
        <h2 className="display text-[1.75rem]">{title}</h2>
        {aside && <div className="text-[13px] text-ink-2">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

/** Baris buku besar: label kiri, angka kanan, garis putus di tengah. */
export function Ledger({ rows }: { rows: { label: ReactNode; value: ReactNode; strong?: boolean; tone?: "alert" | "emerald" | "muted" }[] }) {
  return (
    <dl className="text-[14.5px]">
      {rows.map((r, i) => (
        <div key={i} className={`flex items-baseline gap-2 py-1.5 ${r.strong ? "font-medium" : ""}`}>
          <dt className={r.tone === "muted" ? "text-ink-3" : "text-ink-2"}>{r.label}</dt>
          <span aria-hidden className="mx-1 flex-1 translate-y-[-3px] border-b border-dotted border-line" />
          <dd className={`num ${r.tone === "alert" ? "text-alert" : r.tone === "emerald" ? "text-emerald" : ""}`}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Garis progres tipis dengan penanda opsional. */
export function Progress({ value, max, label, marker }: { value: number; max: number; label: string; marker?: { at: number; label: string } }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const m = marker && max > 0 ? Math.min(100, (marker.at / max) * 100) : null;
  return (
    <div className="relative pt-1" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="h-[6px] w-full bg-line-2">
        <div className="h-full bg-emerald" style={{ width: `${pct}%` }} />
      </div>
      {m !== null && (
        <div className="absolute top-0 h-[14px] border-l border-dashed border-brass" style={{ left: `${m}%` }} title={marker!.label} />
      )}
    </div>
  );
}
