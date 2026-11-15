import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRepo } from "@/lib/repo";
import { showGuide } from "@/lib/demo";
import { PANDUAN } from "@/lib/panduan";
import { PageHead } from "@/components/ui";

export const metadata: Metadata = { title: "Panduan" };

/** Panduan pemakaian: hanya akun demo. Akun asli mendapat 404 (tidak ada tautan ke sini di UI-nya). */
export default async function Panduan() {
  const repo = await requireRepo();
  if (!showGuide(repo.mode)) notFound();

  return (
    <div>
      <PageHead eyebrow="Panduan" title="Cara memakai tracker ini">
        Buka bagian yang ingin dipelajari. Tiap bagian punya langkah singkat yang bisa langsung dicoba di akun ini.
      </PageHead>
      <ol className="border-t border-line">
        {PANDUAN.map((b, i) => (
          <li key={b.id} id={b.id} className="border-b border-line">
            <details className="guide group" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-baseline gap-3 py-4 hover:bg-[var(--hover)]">
                <span className="num w-6 flex-none text-[11px] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                <span className="display flex-1 text-[1.5rem]">{b.judul}</span>
                <span aria-hidden className="num flex-none pr-1 text-[13px] text-emerald transition-transform group-open:rotate-90">›</span>
              </summary>
              <div className="pb-6 pl-9 pr-1">
                {b.isi.map((t) => (
                  <p key={t} className="mb-2 max-w-[40rem] text-[14.5px] leading-relaxed text-ink-2">{t}</p>
                ))}
                <div className="mt-4 max-w-[40rem] border-l-2 border-emerald bg-sheet px-4 py-3">
                  <p className="eyebrow mb-2">Coba ini</p>
                  <ol className="space-y-1.5">
                    {b.coba.map((t, n) => (
                      <li key={t} className="flex gap-3 text-[14px] text-ink">
                        <span className="num flex-none text-[12px] leading-[1.6] text-emerald">{n + 1}.</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ol>
                  <Link href={b.href} className="link mt-3 inline-block text-[13.5px]">Buka {b.halaman}</Link>
                </div>
              </div>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}
