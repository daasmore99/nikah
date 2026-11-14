import type { Metadata } from "next";
import { requireRepo } from "@/lib/repo";
import { totalPerkiraanTamu } from "@/lib/calc";
import { angka } from "@/lib/format";
import { KONFIRMASI } from "@/lib/fields";
import { Ledger, PageHead, Section } from "@/components/ui";
import { EntityList } from "@/components/entity-list";

export const metadata: Metadata = { title: "Tamu" };

export default async function Tamu() {
  const repo = await requireRepo();
  const [tamu, kelompok, profil] = await Promise.all([repo.list("tamu"), repo.list("tamu_kelompok"), repo.profil()]);
  const total = totalPerkiraanTamu(kelompok);
  const n = (k: string) => tamu.filter((t) => (t.konfirmasi ?? "Belum konfirmasi") === k).length;
  const diundang = tamu.filter((t) => t.status_undangan === "Sudah diundang").length;
  const orang = tamu.reduce((a, t) => a + (t.jumlah_orang ?? 1), 0);

  return (
    <div>
      <PageHead eyebrow="Tamu & RSVP" title={`${angka(total)} perkiraan tamu`}>
        Perkiraan diambil dari tab Tamu di sheet. Angka per kelompok bisa diubah di bawah; daftar nama diisi pelan-pelan.
      </PageHead>

      <div className="grid gap-10 md:grid-cols-2">
        <Section title="Per kelompok" aside={<span className="num">{angka(total)} orang</span>}>
          <EntityList profil={profil} rows={kelompok as never}
            config={{ table: "tamu_kelompok", noun: "kelompok", primary: "relasi", amount: "perkiraan",
              csv: "perkiraan-tamu", empty: "Belum ada perkiraan." }} />
        </Section>
        <Section title="RSVP">
          <Ledger rows={[
            { label: "Nama tercatat", value: angka(tamu.length) },
            { label: "Undangan terkirim", value: angka(diundang) },
            { label: "Hadir", value: angka(n("Hadir")), tone: "emerald" },
            { label: "Tidak hadir", value: angka(n("Tidak Hadir")) },
            { label: "Belum konfirmasi", value: angka(n("Belum konfirmasi")), tone: "muted" },
            { label: "Perkiraan orang dari daftar nama", value: angka(orang), tone: "muted" },
          ]} />
          <p className="mt-3 text-[12.5px] text-ink-3">Jumlah orang kosong dihitung 1.</p>
        </Section>
      </div>

      <Section title="Daftar nama" aside={<span className="num">{tamu.length} nama</span>}>
        <EntityList profil={profil} rows={tamu as never}
          config={{
            table: "tamu", noun: "tamu", primary: "nama", secondary: ["relasi", "status_undangan", "jumlah_orang", "catatan"],
            badge: "konfirmasi", filter: { key: "konfirmasi", options: [...KONFIRMASI] }, search: true,
            defaults: { status_undangan: "Belum diundang", konfirmasi: "Belum konfirmasi" }, csv: "tamu", empty: "Belum ada nama tamu.",
          }} />
      </Section>
    </div>
  );
}
