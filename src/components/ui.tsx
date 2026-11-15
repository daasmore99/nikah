import type { ReactNode } from "react";
import { rp } from "@/lib/format";

export function PageHead({ eyebrow, title, children }: { eyebrow?: string; title: ReactNode; children?: ReactNode }) {
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
      <div className="sec-head mb-4 flex items-baseline justify-between gap-4 border-b border-ink">
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
export function Progress({ value, max, label, marker, ticks, thin, ambient }: {
  value: number; max: number; label: string; marker?: { at: number; label: string };
  /** penanda persentase, mis. [25, 50, 75] */
  ticks?: number[]; thin?: boolean;
  /** kilau pelan yang mengalir di bagian terisi (jalan hanya di dalam <Reveal>) */
  ambient?: boolean;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const m = marker && max > 0 ? Math.min(100, (marker.at / max) * 100) : null;
  return (
    <div className="relative pt-1" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className={`${thin ? "h-[3px]" : "h-[6px]"} w-full bg-line-2`}>
        <div className={`bar-fill h-full bg-emerald ${ambient ? "sheen" : ""}`} style={{ width: `${pct}%` }} />
      </div>
      {ticks?.map((t) => (
        <span key={t} aria-hidden className={`absolute top-1 h-[6px] w-px ${pct >= t ? "bg-paper" : "bg-ink-3/50"}`} style={{ left: `${t}%` }} />
      ))}
      {m !== null && (
        <div className="absolute top-0 h-[14px] border-l border-dashed border-brass" style={{ left: `${m}%` }} title={marker!.label} />
      )}
    </div>
  );
}

/**
 * Bar tabungan menuju target: hijau = saldo tersimpan sekarang, arsir terakota = dana yang
 * sudah terpakai. Hijau + arsir = total yang pernah disetor. Penanda 25/50/75% mengikuti saldo sekarang.
 */
export function SavingsBar({ tersimpan, terpakai, pctTersimpan, pctTerpakai, target, ticks = [25, 50, 75], ambient }: {
  tersimpan: number; terpakai: number; pctTersimpan: number; pctTerpakai: number; target: number;
  ticks?: number[]; ambient?: boolean;
}) {
  const label = `Tersimpan ${rp(tersimpan)}, sudah terpakai ${rp(terpakai)}, dari target ${rp(target)}`;
  return (
    <div>
      <div className="relative pt-1" role="img" aria-label={label}>
        <div className="h-[6px] w-full bg-line-2">
          <div className="bar-clip flex h-full">
            <span className={`block h-full bg-emerald ${ambient ? "sheen" : ""}`} style={{ width: `${pctTersimpan}%` }} title={`Tersimpan sekarang ${rp(tersimpan)}`} />
            {pctTerpakai > 0 && (
              <span className={`hatch block h-full ${ambient ? "hatch-run" : ""}`} style={{ width: `${pctTerpakai}%` }} title={`Sudah terpakai ${rp(terpakai)}`} />
            )}
          </div>
        </div>
        {ticks.map((t) => (
          <span key={t} aria-hidden className={`absolute top-1 h-[6px] w-px ${pctTersimpan >= t ? "bg-paper" : "bg-ink-3/50"}`} style={{ left: `${t}%` }} />
        ))}
      </div>
      <p aria-hidden className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-3 bg-emerald" />tersimpan <span className="num">{rp(tersimpan)}</span>
        </span>
        {terpakai > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="hatch inline-block h-2.5 w-3" />sudah terpakai <span className="num">{rp(terpakai)}</span>
          </span>
        )}
        {terpakai > 0 && (
          <span className="text-ink-3">= total ditabung <span className="num">{rp(tersimpan + terpakai)}</span></span>
        )}
      </p>
    </div>
  );
}

/** Garis kecil dibayar/estimasi untuk header kategori. */
export function MiniBar({ value, max, over }: { value: number; max: number; over?: boolean }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <span aria-hidden className="block h-[3px] w-full bg-line-2">
      <span className={`bar-fill block h-full ${over ? "bg-clay" : "bg-emerald"}`} style={{ width: `${pct}%` }} />
    </span>
  );
}
