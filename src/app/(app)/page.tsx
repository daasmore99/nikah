import Link from "next/link";
import { requireRepo } from "@/lib/repo";
import { daysBetween, hitungBiaya, hitungDana, hitungTodo, targetBulanan, todayJakarta, totalPerkiraanTamu } from "@/lib/calc";
import { angka, bulanPanjang, persen, rp, tglPanjang } from "@/lib/format";
import { Ledger, Progress } from "@/components/ui";

export default async function Ringkasan() {
  const repo = await requireRepo();
  const [p, setoran, keluar, biaya, todo, tamu, kelompok] = await Promise.all([
    repo.pengaturan(), repo.list("setoran"), repo.list("pengeluaran"), repo.list("biaya_item"),
    repo.list("todo"), repo.list("tamu"), repo.list("tamu_kelompok"),
  ]);
  const today = todayJakarta();
  const hari = daysBetween(today, p.tanggal_nikah);
  const dana = hitungDana(setoran, keluar);
  const sisa = Math.max(0, p.target_dana - dana.terkumpul);
  const tb = targetBulanan(sisa, today, p.tanggal_nikah);
  const b = hitungBiaya(biaya);
  const td = hitungTodo(todo);
  const perkiraan = totalPerkiraanTamu(kelompok);
  const hadir = tamu.filter((t) => t.konfirmasi === "Hadir").length;
  const bulanAkhir = (() => {
    const m = +p.tanggal_nikah.slice(5, 7) - 1;
    return bulanPanjang(m === 0 ? 12 : m);
  })();
  const berikut = todo.filter((t) => !t.selesai).slice(0, 5);

  return (
    <div>
      {/* fokus: hitung mundur */}
      <section className="border-b border-line pb-8">
        <p className="eyebrow">{tglPanjang(p.tanggal_nikah)}</p>
        {hari > 0 ? (
          <>
            <h1 className="mt-3 flex items-end gap-3">
              <span className="display text-[7.5rem] leading-[0.8] tracking-[-0.03em] text-emerald md:text-[10rem]">{hari}</span>
              <span className="display pb-2 text-[2rem] italic md:text-[2.6rem]">hari lagi</span>
            </h1>
            <p className="mt-4 max-w-[34rem] text-[16px] text-ink-2">
              {hari >= 14 ? `Sekitar ${Math.round(hari / 7)} minggu. ` : ""}
              {tb.bulan > 1 ? `Tinggal ${tb.bulan} kali gajian sebelum hari H.` : "Ini bulan terakhir sebelum hari H."}
            </p>
          </>
        ) : (
          <h1 className="display mt-3 text-[4rem] text-emerald">{hari === 0 ? "Hari ini." : "Sudah sah."}</h1>
        )}
      </section>

      <div className="grid gap-x-12 md:grid-cols-[1.25fr_1fr]">
        <section className="border-b border-line py-7 md:border-b-0">
          <div className="flex items-baseline justify-between">
            <h2 className="eyebrow">Tabungan bersama</h2>
            <Link href="/uang" className="link text-[13px]">rincian</Link>
          </div>
          <p className="display mt-3 text-[2.9rem] leading-none md:text-[3.3rem]">{rp(dana.terkumpul)}</p>
          <p className="mt-2 text-[14px] text-ink-2">
            dari target <span className="num">{rp(p.target_dana)}</span> · {persen(dana.terkumpul, p.target_dana)}%
          </p>
          <div className="mt-4"><Progress value={dana.terkumpul} max={p.target_dana} label="Progres tabungan" /></div>
          {sisa > 0 ? (
            <p className="mt-4 text-[15px]">
              Kurang <span className="num">{rp(sisa)}</span>. Kalau dibagi rata sampai {bulanAkhir}, perlu{" "}
              <strong className="num font-medium text-emerald">{rp(tb.perBulan)}</strong> per bulan.
            </p>
          ) : (
            <p className="mt-4 text-[15px] text-emerald">Target sudah tercapai.</p>
          )}
        </section>

        <section className="border-b border-line py-7 md:border-b-0">
          <div className="flex items-baseline justify-between">
            <h2 className="eyebrow">Biaya</h2>
            <Link href="/biaya" className="link text-[13px]">rincian</Link>
          </div>
          <Ledger rows={[
            { label: "Sudah dibayar", value: rp(b.realisasi), strong: true },
            { label: "Estimasi tercatat", value: rp(b.estimasi) },
            { label: "Budget", value: rp(p.target_dana), tone: "muted" },
          ]} />
          <p className="mt-3 text-[13.5px] text-ink-2">
            <span className="num">{b.status["BELUM BAYAR"]}</span> belum dibayar ·{" "}
            <span className="num">{b.status["SUDAH DP"]}</span> sudah DP ·{" "}
            <span className="num">{b.status.LUNAS}</span> lunas
          </p>
        </section>
      </div>

      <div className="grid gap-x-12 md:mt-2 md:grid-cols-[1.25fr_1fr] md:border-t md:border-line">
        <section className="border-b border-line py-7 md:border-b-0">
          <div className="flex items-baseline justify-between">
            <h2 className="eyebrow">Persiapan · {td.sudah} dari {td.total} beres</h2>
            <Link href="/persiapan" className="link text-[13px]">semua</Link>
          </div>
          <div className="mt-3"><Progress value={td.sudah} max={td.total} label="Progres persiapan" /></div>
          {berikut.length > 0 && (
            <ul className="mt-4">
              {berikut.map((t) => (
                <li key={t.id} className="flex gap-3 border-b border-line-2 py-2 text-[14.5px] last:border-0">
                  <span className="num w-6 flex-none text-[11px] leading-6 text-ink-3">{String(t.bagian_no).padStart(2, "0")}</span>
                  <span>{t.judul}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="py-7">
          <div className="flex items-baseline justify-between">
            <h2 className="eyebrow">Tamu</h2>
            <Link href="/tamu" className="link text-[13px]">daftar</Link>
          </div>
          <p className="mt-3 flex items-baseline gap-2">
            <span className="display text-[3rem] leading-none">{angka(perkiraan)}</span>
            <span className="text-[14px] text-ink-2">perkiraan undangan</span>
          </p>
          <p className="mt-3 text-[14px] text-ink-2">
            <span className="num">{tamu.length}</span> nama sudah dicatat, <span className="num">{hadir}</span> konfirmasi hadir.
          </p>
        </section>
      </div>
    </div>
  );
}
