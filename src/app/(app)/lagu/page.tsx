import type { Metadata } from "next";
import { requireRepo } from "@/lib/repo";
import { PageHead, Section } from "@/components/ui";
import { EntityList } from "@/components/entity-list";

export const metadata: Metadata = { title: "Lagu" };

export default async function Lagu() {
  const repo = await requireRepo();
  const [lagu, rekom, profil] = await Promise.all([repo.list("lagu"), repo.list("lagu_rekom"), repo.profil()]);
  const dipakai = lagu.map((l) => (l.judul ?? "").toLowerCase()).filter(Boolean);
  const kategori = [...new Set(rekom.map((r) => r.kategori).filter((k): k is string => Boolean(k)))];

  return (
    <div>
      <PageHead eyebrow="Lagu" title={`${dipakai.length} lagu dipilih`}>
        Daftar untuk band atau operator musik. Ambil dari rekomendasi di bawah, atau tulis sendiri.
      </PageHead>

      <Section title="Daftar putar acara">
        <EntityList profil={profil} rows={lagu as never}
          config={{ table: "lagu", noun: "lagu", primary: "judul", secondary: ["keterangan"], csv: "lagu-acara",
            empty: "Belum ada lagu." }} />
      </Section>

      <Section title="Rekomendasi" aside={<span className="num">{rekom.length} lagu</span>}>
        <EntityList profil={profil} rows={rekom as never}
          config={{
            table: "lagu_rekom", noun: "rekomendasi", primary: "judul", link: "link", search: true,
            filter: kategori.length ? { key: "kategori", options: kategori } : undefined,
            copy: { label: "Pakai", done: "dipakai", table: "lagu", map: { judul: "judul" }, existing: dipakai },
            csv: "lagu-rekomendasi", empty: "Belum ada rekomendasi.",
          }} />
      </Section>
    </div>
  );
}
