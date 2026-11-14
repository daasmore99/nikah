import { angka } from "@/lib/format";

interface Seg {
  label: string;
  value: number;
  cell: string;
  text?: string;
}

/**
 * Proporsi tamu dalam 100 kotak (1 kotak ≈ 1% dari perkiraan).
 * Kategori yang ada isinya selalu dapat minimal satu kotak supaya terlihat.
 */
export function GuestWaffle({ segs, total }: { segs: Seg[]; total: number }) {
  const N = 100;
  const counts = segs.map((s) => (s.value > 0 ? Math.max(1, Math.round((s.value / Math.max(total, 1)) * N)) : 0));
  // kotak sisa diserap kategori terakhir (belum diundang)
  const used = counts.slice(0, -1).reduce((a, b) => a + b, 0);
  counts[counts.length - 1] = Math.max(0, N - used);
  const cells = segs.flatMap((s, i) => Array.from({ length: counts[i] }, () => s.cell)).slice(0, N);

  return (
    <figure>
      <div aria-hidden className="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-[3px]">
        {cells.map((c, i) => (
          <span key={i} className={`fade-in aspect-square ${c}`} style={{ animationDelay: `${Math.min(300, i * 3)}ms` }} />
        ))}
      </div>
      <figcaption className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[13.5px] sm:grid-cols-4">
        {segs.map((s) => (
          <span key={s.label} className="flex items-baseline gap-2">
            <span aria-hidden className={`inline-block size-2.5 flex-none translate-y-[1px] ${s.cell}`} />
            <span className="min-w-0">
              <span className={`num block text-[1.15rem] leading-tight ${s.text ?? ""}`}>{angka(s.value)}</span>
              <span className="text-ink-2">{s.label}</span>
            </span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
