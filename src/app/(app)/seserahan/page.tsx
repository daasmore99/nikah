import type { Metadata } from "next";
import Link from "next/link";
import { requireRepo } from "@/lib/repo";
import { hitungBiaya } from "@/lib/calc";
import { rp } from "@/lib/format";
import { PageHead, Section } from "@/components/ui";
import { EntityList } from "@/components/entity-list";

export const metadata: Metadata = { title: "Seserahan" };

export default async function Seserahan() {
  const repo = await requireRepo();
  const [rekom, biaya, profil] = await Promise.all([repo.list("seserahan_rekom"), repo.list("biaya_item"), repo.profil()]);
  const tiers = [...new Set(rekom.map((r) => r.budget_tier))];
  const ses = hitungBiaya(biaya).perGrup.find((g) => g.grup === "Seserahan")!;

  return (
    <div>
      <PageHead eyebrow="Seserahan" title="Rekomendasi per budget">
        Centang yang sudah dibeli. Belanja seserahan yang sebenarnya tercatat di{" "}
        <Link href="/biaya" className="link">Biaya</Link>: <span className="num">{rp(ses.realisasi)}</span> dari estimasi{" "}
        <span className="num">{rp(ses.estimasi)}</span>.
      </PageHead>

      <div className="grid gap-10 lg:grid-cols-2">
        {tiers.map((tier) => {
          const xs = rekom.filter((r) => r.budget_tier === tier);
          const beli = xs.filter((r) => r.dibeli);
          const sum = (a: typeof xs) => a.reduce((s, r) => s + (r.harga ?? 0), 0);
          return (
            <Section key={tier} title={`Budget ${tier}`}
              aside={<span><span className="num">{beli.length}/{xs.length}</span> dibeli</span>}>
              <p className="-mt-1 mb-4 text-[14px] text-ink-2">
                Sudah dibeli <span className="num text-ink">{rp(sum(beli))}</span> · semua item <span className="num">{rp(sum(xs))}</span>
              </p>
              <EntityList profil={profil} rows={xs as never}
                config={{
                  table: "seserahan_rekom", noun: "barang", primary: "nama", toggle: "dibeli", amount: "harga", link: "link",
                  groupBy: "kategori", defaults: { budget_tier: tier, dibeli: false }, csv: `seserahan-${tier}`, empty: "Belum ada barang.",
                  bulk: { edit: ["dibeli"], add: { shared: ["kategori"], perRow: ["nama", "harga"], dupScope: ["budget_tier", "kategori"] } },
                }} />
            </Section>
          );
        })}
      </div>
      {tiers.length === 0 && (
        <EntityList profil={profil} rows={[]}
          config={{ table: "seserahan_rekom", noun: "barang", primary: "nama", csv: "seserahan", empty: "Belum ada rekomendasi seserahan." }} />
      )}
    </div>
  );
}
