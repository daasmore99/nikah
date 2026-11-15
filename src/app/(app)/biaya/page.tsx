import type { Metadata } from "next";
import { requireRepo } from "@/lib/repo";
import { hitungBiaya } from "@/lib/calc";
import { persen, rp, rpSingkat } from "@/lib/format";
import { STATUS_BAYAR } from "@/lib/types";
import { PageHead, Section } from "@/components/ui";
import { EntityList } from "@/components/entity-list";
import { CountUp } from "@/components/motion";

export const metadata: Metadata = { title: "Biaya" };

export default async function Biaya() {
  const repo = await requireRepo();
  const [p, items, profil] = await Promise.all([repo.pengaturan(), repo.list("biaya_item"), repo.profil()]);
  const b = hitungBiaya(items);
  const budget = p.target_dana;
  const sisaBudget = budget - b.realisasi;

  return (
    <div className="stagger">
      <PageHead eyebrow="Biaya" title={<><CountUp value={b.realisasi} format="rp" /> sudah keluar</>}>
        Estimasi tercatat <span className="num">{rp(b.estimasi)}</span>. Sisa budget{" "}
        <span className="num">{rp(sisaBudget)}</span>.
      </PageHead>

      {/* satu batang: realisasi di dalam estimasi di dalam budget */}
      <figure className="mb-8">
        <div className="relative h-7 border border-ink/70" aria-hidden>
          <div className="bar-fill absolute inset-y-0 left-0 bg-emerald-tint" style={{ width: `${Math.min(100, persen(b.estimasi, budget))}%` }} />
          <div className="bar-fill absolute inset-y-0 left-0 bg-emerald" style={{ width: `${Math.min(100, persen(b.realisasi, budget))}%`, animationDelay: "0.3s" }} />
        </div>
        <figcaption className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
          <span><span className="mr-1.5 inline-block h-2.5 w-2.5 bg-emerald align-middle" />dibayar {persen(b.realisasi, budget)}%</span>
          <span><span className="mr-1.5 inline-block h-2.5 w-2.5 bg-emerald-tint align-middle" />estimasi {persen(b.estimasi, budget)}%</span>
          <span className="num">budget {rpSingkat(budget)}</span>
        </figcaption>
      </figure>

      <Section title="Per kategori" aside={<span className="num">{items.length} item</span>}>
        <EntityList profil={profil} rows={items as never}
          config={{
            table: "biaya_item", noun: "item", primary: "nama", secondary: ["dp", "tanggal_bayar", "catatan"],
            badge: "status", quietBadge: ["BELUM BAYAR"], amount: "realisasi", amountNote: { key: "estimasi", label: "est." }, link: "link",
            groupBy: "grup", subGroupBy: "sub", collapse: "money", search: true,
            filter: { key: "status", options: STATUS_BAYAR, nullAs: "BELUM BAYAR",
              labels: { "BELUM BAYAR": "Belum bayar", "SUDAH DP": "Sudah DP", "BELUM LUNAS": "Belum lunas", LUNAS: "Lunas" } },
            defaults: { grup: "Resepsi", status: "BELUM BAYAR" }, csv: "biaya", empty: "Belum ada item biaya.", total: true,
            bulk: {
              edit: ["status", "tanggal_bayar"],
              quick: { amount: "realisasi", status: "status", date: "tanggal_bayar", estimate: "estimasi", done: "LUNAS" },
              add: { shared: ["grup", "sub", "status"], perRow: ["nama", "estimasi", "realisasi"], dupScope: ["grup", "sub"], paste: true },
            },
          }} />
        <p className="mt-3 text-[12.5px] text-ink-3">Angka di kanan: dibayar / estimasi. Ketuk kategori untuk membuka.</p>
      </Section>
    </div>
  );
}
