import type { Metadata } from "next";
import { requireRepo } from "@/lib/repo";
import { hitungDana, saldoBerjalan, targetBulanan, todayJakarta } from "@/lib/calc";
import { ambilHargaOtomatis, pilihHarga, simpanCadangan } from "@/lib/gold";
import { bulanPanjang, persen1, rp, tgl } from "@/lib/format";
import { Ledger, PageHead, SavingsBar, Section } from "@/components/ui";
import { segmenTabungan } from "@/lib/ringkasan";
import { SavingsChart } from "@/components/savings-chart";
import { EntityList } from "@/components/entity-list";
import { CountUp } from "@/components/motion";

export const metadata: Metadata = { title: "Tabungan" };

export default async function Uang() {
  const repo = await requireRepo();
  const [p, setoran, keluar, biaya, auto] = await Promise.all([
    repo.pengaturan(), repo.list("setoran"), repo.list("pengeluaran"), repo.list("biaya_item"), ambilHargaOtomatis(),
  ]);
  const profil = await repo.profil();
  const today = todayJakarta();
  const dana = hitungDana(setoran, keluar);
  const sisa = Math.max(0, p.target_dana - dana.terkumpul);
  const tb = targetBulanan(sisa, today, p.tanggal_nikah);
  const grafik = saldoBerjalan(setoran, keluar);
  const seg = segmenTabungan(dana, p.target_dana);

  await simpanCadangan(auto, p, (v) => repo.updatePengaturan(v));
  const emas = pilihHarga(auto, p);
  const itemEmas = biaya.filter((b) => b.gram_emas && b.gram_emas > 0);
  const gram = itemEmas.reduce((a, b) => a + Number(b.gram_emas), 0);
  const nm = { CPP: p.nama_pria, CPW: p.nama_wanita };
  const mAkhir = +p.tanggal_nikah.slice(5, 7) - 1;
  // penanda berikutnya (25/50/75/100%) yang belum tercapai
  const milestone = [25, 50, 75, 100]
    .map((pct) => ({ pct, kurang: Math.ceil((p.target_dana * pct) / 100) - dana.terkumpul }))
    .find((m) => m.kurang > 0);

  return (
    <div className="stagger">
      <PageHead eyebrow="Tabungan bersama" title={<CountUp value={dana.terkumpul} format="rp" />}>
        <span className="num">{persen1(dana.terkumpul, p.target_dana)}%</span> dari target <span className="num">{rp(p.target_dana)}</span>.
        {milestone && (
          <> Kurang <span className="num text-emerald">{rp(milestone.kurang)}</span> lagi untuk {milestone.pct}%.</>
        )}
      </PageHead>

      <SavingsBar {...seg} target={p.target_dana} />

      <div className="mt-8 grid gap-10 md:grid-cols-[1.6fr_1fr]">
        <div>
          <SavingsChart titik={grafik.titik} target={p.target_dana} today={today} nikah={p.tanggal_nikah} />
        </div>
        <div>
          <p className="eyebrow mb-2">Supaya sampai target</p>
          {sisa > 0 ? (
            <>
              <p className="num text-[2rem] leading-none text-emerald">{rp(tb.perBulan)}</p>
              <p className="mt-2 text-[14px] text-ink-2">
                per bulan, {tb.bulan} bulan sampai {bulanPanjang(mAkhir === 0 ? 12 : mAkhir)}. Kalau dibagi dua, masing-masing{" "}
                <span className="num">{rp(Math.ceil(tb.perBulan / 2))}</span>.
              </p>
            </>
          ) : (
            <p className="text-emerald">Target sudah tercapai.</p>
          )}
          <div className="mt-5">
            <Ledger rows={[
              { label: `Setoran ${nm.CPP}`, value: rp(dana.cpp) },
              { label: `Setoran ${nm.CPW}`, value: rp(dana.cpw) },
              { label: "Dipakai (gether)", value: `−${rp(dana.keluarPotong)}`, tone: "alert" },
              { label: "Terkumpul", value: rp(dana.terkumpul), strong: true },
              { label: "Kurang", value: rp(sisa), tone: "muted" },
            ]} />
          </div>
        </div>
      </div>

      <Section title="Emas" aside={emas?.sumber === "otomatis" ? "harga otomatis" : emas ? "harga cadangan" : undefined}>
        <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
          <div>
            {emas ? (
              <>
                <p className="num text-[1.6rem] leading-none">{rp(emas.perGram)}<span className="text-[14px] text-ink-3"> /gram</span></p>
                <p className="mt-2 text-[13px] text-ink-3">
                  {emas.keterangan}{emas.waktu ? `, ${tgl(emas.waktu.slice(0, 10))}` : ""}.
                  {emas.sumber !== "otomatis" && " Sumber otomatis sedang tidak bisa diambil."}
                </p>
              </>
            ) : (
              <p className="text-[14px] text-ink-2">
                Harga otomatis belum bisa diambil dan harga manual belum diisi. Isi di <a className="link" href="/pengaturan">Pengaturan</a>.
              </p>
            )}
          </div>
          <div>
            {itemEmas.length ? (
              <Ledger rows={[
                ...itemEmas.map((b) => ({
                  label: `${b.nama.trim()} (${String(b.gram_emas).replace(".", ",")} g)`,
                  value: emas ? rp(Math.round(Number(b.gram_emas) * emas.perGram)) : "—",
                })),
                ...(itemEmas.length > 1 ? [{ label: `Total ${String(gram).replace(".", ",")} g`, value: emas ? rp(Math.round(gram * emas.perGram)) : "—", strong: true }] : []),
              ]} />
            ) : (
              <p className="text-[14px] text-ink-2">Belum ada item dengan berat emas. Isi kolom berat di item Biaya.</p>
            )}
            <p className="mt-2 text-[12.5px] text-ink-3">
              Estimasi pakai harga emas murni. Harga jual perhiasan biasanya lebih rendah tergantung kadar dan potongan toko.
            </p>
          </div>
        </div>
      </Section>

      <Section title={`Setoran ${nm.CPP}`} aside={<span className="num">{rp(dana.cpp)}</span>}>
        <EntityList profil={profil} rows={setoran.filter((s) => s.pihak === "CPP") as never}
          config={{ table: "setoran", noun: "setoran", primary: "tanggal", primaryFallback: "catatan", secondary: ["lokasi", "catatan"], amount: "jumlah",
            defaults: { pihak: "CPP", lokasi: "Rekening Bersama" }, hide: ["pihak"], csv: "setoran-cpp", empty: "Belum ada setoran." }} />
      </Section>

      <Section title={`Setoran ${nm.CPW}`} aside={<span className="num">{rp(dana.cpw)}</span>}>
        <EntityList profil={profil} rows={setoran.filter((s) => s.pihak === "CPW") as never}
          config={{ table: "setoran", noun: "setoran", primary: "tanggal", primaryFallback: "catatan", secondary: ["lokasi", "catatan"], amount: "jumlah",
            defaults: { pihak: "CPW", lokasi: "Rekening Bersama" }, hide: ["pihak"], csv: "setoran-cpw", empty: "Belum ada setoran." }} />
      </Section>

      <Section title="Pengeluaran bareng" aside={<span className="num">{rp(dana.gether)}</span>}>
        <p className="-mt-2 mb-4 text-[13.5px] text-ink-2">Dipotong dari dana bersama.</p>
        <EntityList profil={profil} rows={keluar.filter((k) => k.jenis === "gether") as never}
          config={{ table: "pengeluaran", noun: "pengeluaran", primary: "keterangan", secondary: ["tanggal"], amount: "jumlah",
            defaults: { jenis: "gether", potong_dana: true }, hide: ["jenis"], csv: "outcome-gether", empty: "Belum ada pengeluaran." }} />
      </Section>

      <Section title="Belanja seserahan" aside={<span className="num">{rp(dana.seserahan)}</span>}>
        <p className="-mt-2 mb-4 text-[13.5px] text-ink-2">Pakai uang pribadi, tidak memotong dana bersama.</p>
        <EntityList profil={profil} rows={keluar.filter((k) => k.jenis === "seserahan") as never}
          config={{ table: "pengeluaran", noun: "belanja", primary: "keterangan", secondary: ["tanggal"], amount: "jumlah",
            defaults: { jenis: "seserahan", potong_dana: false }, hide: ["jenis"], csv: "outcome-seserahan", empty: "Belum ada belanja." }} />
      </Section>
    </div>
  );
}
