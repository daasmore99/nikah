import type { Metadata } from "next";
import { requireRepo } from "@/lib/repo";
import { totalPerkiraanTamu } from "@/lib/calc";
import { angka } from "@/lib/format";
import { Ledger, PageHead, Section } from "@/components/ui";
import { EntityList } from "@/components/entity-list";
import { SouvenirCalc } from "@/components/souvenir-calc";

export const metadata: Metadata = { title: "Undangan & souvenir" };

export default async function Undangan() {
  const repo = await requireRepo();
  const [p, katalog, kelompok, profil] = await Promise.all([
    repo.pengaturan(), repo.list("katalog"), repo.list("tamu_kelompok"), repo.profil(),
  ]);
  const souvenir = katalog.filter((k) => k.jenis === "souvenir");
  const fisik = katalog.filter((k) => k.jenis === "undangan_fisik");
  const digital = katalog.filter((k) => k.jenis === "undangan_digital");
  const stok = (p.souvenir_blindbox ?? 0) + (p.souvenir_sisa_umma ?? 0);

  return (
    <div>
      <PageHead eyebrow="Undangan & souvenir" title="Hitung souvenir">
        Ganti harga atau jumlah, totalnya langsung berubah. Simpan kalau sudah pas.
      </PageHead>

      <div className="grid gap-10 md:grid-cols-[1.2fr_1fr]">
        <SouvenirCalc
          harga0={p.souvenir_harga_satuan ?? 0}
          jumlah0={p.souvenir_jumlah ?? 0}
          budget={p.souvenir_budget}
          opsi={souvenir.map((s) => ({ id: s.id, nama: s.nama, harga: s.harga }))}
          saranJumlah={totalPerkiraanTamu(kelompok)}
        />
        <div>
          <p className="eyebrow mb-2">Stok souvenir (dari tab Tamu)</p>
          <Ledger rows={[
            { label: "Blindbox", value: angka(p.souvenir_blindbox) },
            { label: "Sisa souvenir Umma", value: angka(p.souvenir_sisa_umma) },
            { label: "Sudah ada", value: angka(stok), strong: true },
            { label: "Masih kurang (catatan sheet)", value: angka(p.souvenir_kurang), tone: "alert" },
          ]} />
          <p className="mt-3 text-[12.5px] text-ink-3">Angka stok dan budget diubah di Pengaturan.</p>
        </div>
      </div>

      <Section title="Pilihan souvenir" aside={<span className="num">{souvenir.length} pilihan</span>}>
        <EntityList profil={profil} rows={souvenir as never}
          config={{ table: "katalog", noun: "souvenir", primary: "nama", toggle: "dipilih", amount: "harga", link: "link",
            defaults: { jenis: "souvenir" }, hide: ["jenis"], csv: "katalog-souvenir", empty: "Belum ada pilihan souvenir." }} />
      </Section>

      <div className="grid gap-x-10 md:grid-cols-2">
        <Section title="Undangan cetak">
          <EntityList profil={profil} rows={fisik as never}
            config={{ table: "katalog", noun: "undangan", primary: "nama", toggle: "dipilih", amount: "harga", link: "link",
              defaults: { jenis: "undangan_fisik" }, hide: ["jenis"], csv: "katalog-undangan-cetak", empty: "Belum ada pilihan." }} />
        </Section>
        <Section title="Undangan digital">
          <EntityList profil={profil} rows={digital as never}
            config={{ table: "katalog", noun: "undangan digital", primary: "nama", toggle: "dipilih", amount: "harga", link: "link",
              defaults: { jenis: "undangan_digital" }, hide: ["jenis"], csv: "katalog-undangan-digital",
              empty: "Di sheet hanya ada tombol “Order disini” tanpa link. Tambahkan pilihan di sini." }} />
        </Section>
      </div>
    </div>
  );
}
