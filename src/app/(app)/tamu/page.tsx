import type { Metadata } from "next";
import { requireRepo } from "@/lib/repo";
import { totalPerkiraanTamu } from "@/lib/calc";
import { angka } from "@/lib/format";
import { KONFIRMASI } from "@/lib/fields";
import { PageHead, Section } from "@/components/ui";
import { CountUp } from "@/components/motion";
import { GuestWaffle } from "@/components/guest-waffle";
import { EntityList } from "@/components/entity-list";

export const metadata: Metadata = { title: "Tamu" };

export default async function Tamu() {
  const repo = await requireRepo();
  const [tamu, kelompok, profil] = await Promise.all([repo.list("tamu"), repo.list("tamu_kelompok"), repo.profil()]);
  const total = totalPerkiraanTamu(kelompok);
  const diundang = tamu.filter((t) => t.status_undangan === "Sudah diundang").length;
  const orang = tamu.reduce((a, t) => a + (t.jumlah_orang ?? 1), 0);

  // proporsi dalam orang (jumlah_orang kosong = 1), dibandingkan dengan perkiraan
  const org = (f: (t: (typeof tamu)[number]) => boolean) => tamu.filter(f).reduce((a, t) => a + (t.jumlah_orang ?? 1), 0);
  const hadir = org((t) => t.konfirmasi === "Hadir");
  const tidak = org((t) => t.konfirmasi === "Tidak Hadir");
  const menunggu = org((t) => t.status_undangan === "Sudah diundang" && (t.konfirmasi ?? "Belum konfirmasi") === "Belum konfirmasi");
  const dasar = Math.max(total, orang);
  const belumDiundang = Math.max(0, dasar - hadir - tidak - menunggu);

  return (
    <div className="stagger">
      <PageHead eyebrow="Tamu & RSVP" title={<><CountUp value={total} /> perkiraan tamu</>} />

      <section className="mb-12">
        <GuestWaffle total={dasar} segs={[
          { label: "hadir", value: hadir, cell: "bg-emerald", text: "text-emerald" },
          { label: "belum konfirmasi", value: menunggu, cell: "bg-brass" },
          { label: "tidak hadir", value: tidak, cell: "bg-ink-3" },
          { label: "belum diundang", value: belumDiundang, cell: "bg-line-2 outline outline-1 -outline-offset-1 outline-line", text: "text-ink-2" },
        ]} />
        <p className="mt-4 text-[12.5px] text-ink-3">
          <span className="num">{angka(tamu.length)}</span> nama dicatat · <span className="num">{angka(diundang)}</span> undangan terkirim · 1 kotak ≈ <span className="num">{angka(Math.max(1, Math.round(dasar / 100)))}</span> orang
        </p>
      </section>

      <Section title="Per kelompok" aside={<span className="num">{angka(total)} orang</span>}>
        <EntityList profil={profil} rows={kelompok as never}
          config={{ table: "tamu_kelompok", noun: "kelompok", primary: "relasi", amount: "perkiraan",
            csv: "perkiraan-tamu", empty: "Belum ada perkiraan." }} />
      </Section>

      <Section title="Daftar nama" aside={<span className="num">{tamu.length} nama</span>}>
        <EntityList profil={profil} rows={tamu as never}
          config={{
            table: "tamu", noun: "tamu", primary: "nama", secondary: ["relasi", "status_undangan", "jumlah_orang", "catatan"],
            badge: "konfirmasi", quietBadge: ["Belum konfirmasi"], filter: { key: "konfirmasi", options: [...KONFIRMASI] }, search: true,
            defaults: { status_undangan: "Belum diundang", konfirmasi: "Belum konfirmasi" }, csv: "tamu", empty: "Belum ada nama tamu.",
            bulk: { edit: ["status_undangan", "konfirmasi", "relasi"], add: { shared: ["relasi", "status_undangan", "konfirmasi"], perRow: ["nama", "jumlah_orang"], dupScope: [] } },
          }} />
      </Section>
    </div>
  );
}
