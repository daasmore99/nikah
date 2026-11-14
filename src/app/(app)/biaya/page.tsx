import type { Metadata } from "next";
import { requireRepo } from "@/lib/repo";
import { hitungBiaya } from "@/lib/calc";
import { persen, rp, rpSingkat } from "@/lib/format";
import { STATUS_BAYAR } from "@/lib/types";
import { PageHead, Section } from "@/components/ui";
import { EntityList } from "@/components/entity-list";

export const metadata: Metadata = { title: "Biaya" };

export default async function Biaya() {
  const repo = await requireRepo();
  const [p, items, profil] = await Promise.all([repo.pengaturan(), repo.list("biaya_item"), repo.profil()]);
  const b = hitungBiaya(items);
  const budget = p.target_dana;
  const maxBar = Math.max(...b.perGrup.map((g) => Math.max(g.estimasi, g.realisasi)), 1);
  const sisaBudget = budget - b.realisasi;

  return (
    <div>
      <PageHead eyebrow="Biaya" title={`${rp(b.realisasi)} sudah keluar`}>
        Dari estimasi <span className="num">{rp(b.estimasi)}</span> yang sudah tercatat. Sisa budget{" "}
        <span className="num">{rp(sisaBudget)}</span> dari <span className="num">{rp(budget)}</span>.
      </PageHead>

      {/* satu batang: realisasi di dalam estimasi di dalam budget */}
      <figure className="mb-10">
        <div className="relative h-9 border border-ink/70" aria-hidden>
          <div className="absolute inset-y-0 left-0 bg-emerald-tint" style={{ width: `${Math.min(100, persen(b.estimasi, budget))}%` }} />
          <div className="absolute inset-y-0 left-0 bg-emerald" style={{ width: `${Math.min(100, persen(b.realisasi, budget))}%` }} />
        </div>
        <figcaption className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
          <span><span className="mr-1.5 inline-block h-2.5 w-2.5 bg-emerald align-middle" />dibayar {persen(b.realisasi, budget)}%</span>
          <span><span className="mr-1.5 inline-block h-2.5 w-2.5 bg-emerald-tint align-middle" />estimasi {persen(b.estimasi, budget)}%</span>
          <span className="num">budget {rpSingkat(budget)}</span>
        </figcaption>
      </figure>

      <Section title="Per kategori">
        <table className="w-full text-[14px]">
          <thead>
            <tr className="eyebrow text-left">
              <th className="pb-2 font-normal">Kategori</th>
              <th className="hidden pb-2 font-normal sm:table-cell">Dibayar / estimasi</th>
              <th className="pb-2 text-right font-normal">Dibayar</th>
              <th className="pb-2 text-right font-normal">Selisih</th>
            </tr>
          </thead>
          <tbody>
            {b.perGrup.map((g) => (
              <tr key={g.grup} className="border-t border-line-2 align-top">
                <td className="py-2.5 pr-2">
                  {g.grup}
                  <span className="block text-[12px] text-ink-3"><span className="num">{g.jumlah}</span> item · est. <span className="num">{rpSingkat(g.estimasi)}</span></span>
                  <div className="mt-1.5 h-1.5 w-full max-w-[10rem] bg-line-2 sm:hidden">
                    <div className="h-full bg-emerald" style={{ width: `${persen(g.realisasi, Math.max(g.estimasi, g.realisasi))}%` }} />
                  </div>
                </td>
                <td className="hidden w-[38%] py-3.5 pr-6 sm:table-cell">
                  <div className="relative h-2.5 bg-transparent">
                    <div className="absolute inset-y-0 left-0 bg-emerald-tint" style={{ width: `${(g.estimasi / maxBar) * 100}%` }} />
                    <div className="absolute inset-y-0 left-0 bg-emerald" style={{ width: `${(g.realisasi / maxBar) * 100}%` }} />
                  </div>
                </td>
                <td className="num py-2.5 text-right">{rp(g.realisasi)}</td>
                <td className={`num py-2.5 pl-3 text-right ${g.selisih < 0 ? "text-alert" : "text-ink-2"}`}>{rp(g.selisih)}</td>
              </tr>
            ))}
            <tr className="border-t-[3px] border-double border-line font-medium">
              <td className="py-2.5">Total</td>
              <td className="hidden sm:table-cell" />
              <td className="num py-2.5 text-right">{rp(b.realisasi)}</td>
              <td className="num py-2.5 pl-3 text-right">{rp(b.selisih)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-[12.5px] text-ink-3">Selisih = estimasi dikurangi yang sudah dibayar. Merah berarti lewat estimasi.</p>
      </Section>

      <Section title="Semua item" aside={<span className="num">{items.length} item</span>}>
        <EntityList profil={profil} rows={items as never}
          config={{
            table: "biaya_item", noun: "item", primary: "nama", secondary: ["dp", "tanggal_bayar", "catatan"],
            badge: "status", amount: "realisasi", amountNote: { key: "estimasi", label: "est." }, link: "link",
            groupBy: "grup", subGroupBy: "sub", filter: { key: "status", options: STATUS_BAYAR }, search: true,
            defaults: { grup: "Resepsi", status: "BELUM BAYAR" }, csv: "biaya", empty: "Belum ada item biaya.", total: true,
          }} />
      </Section>
    </div>
  );
}
