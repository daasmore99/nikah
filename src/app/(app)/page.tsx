import Link from "next/link";
import { requireRepo } from "@/lib/repo";
import { daysBetween, hitungBiaya, hitungDana, hitungTodo, targetBulanan, todayJakarta, totalPerkiraanTamu } from "@/lib/calc";
import { segmenTabungan, tagihanBerikutnya, todoBerikutnya } from "@/lib/ringkasan";
import { bulanPanjang, persen1, rp, rpSingkat, tgl, tglPanjang } from "@/lib/format";
import { Progress, SavingsBar } from "@/components/ui";
import { CountUp, Reveal } from "@/components/motion";
import { CouplePhoto } from "@/components/couple-photo";
import { NextTodo } from "@/components/next-todo";
import { DemoWelcome } from "@/components/demo-welcome";
import { showGuide } from "@/lib/demo";

export default async function Ringkasan() {
  const repo = await requireRepo();
  const [p, setoran, keluar, biaya, todo, tamu, kelompok] = await Promise.all([
    repo.pengaturan(), repo.list("setoran"), repo.list("pengeluaran"), repo.list("biaya_item"),
    repo.list("todo"), repo.list("tamu"), repo.list("tamu_kelompok"),
  ]);
  const today = todayJakarta();
  const nikah = p.tanggal_nikah;
  const hari = nikah ? daysBetween(today, nikah) : null;
  const adaTarget = p.target_dana > 0;
  const dana = hitungDana(setoran, keluar);
  const sisa = Math.max(0, p.target_dana - dana.terkumpul);
  const seg = segmenTabungan(dana, p.target_dana);
  const tb = nikah ? targetBulanan(sisa, today, nikah) : null;
  const b = hitungBiaya(biaya);
  const td = hitungTodo(todo);
  const perkiraan = totalPerkiraanTamu(kelompok);
  const hadir = tamu.filter((t) => t.konfirmasi === "Hadir").length;
  const bulanAkhir = (() => {
    if (!nikah) return "";
    const m = +nikah.slice(5, 7) - 1;
    return bulanPanjang(m === 0 ? 12 : m);
  })();
  const next = todoBerikutnya(todo);
  const tagihan = tagihanBerikutnya(biaya, today);
  const tagihanAtas = tagihan.filter((t) => t.sisa != null || t.jatuhTempo).slice(0, 3);
  const tanpaNominal = tagihan.filter((t) => t.sisa == null && !t.jatuhTempo).length;
  const sisaDiketahui = tagihan.reduce((a, t) => a + (t.sisa ?? 0), 0);

  return (
    <div className="stagger">
      {showGuide(repo.mode) && <DemoWelcome />}
      {/* fokus: hitung mundur + foto */}
      <section className="flex items-start justify-between gap-5 border-b border-line pb-8">
        <div className="min-w-0">
          <p className="eyebrow">{tglPanjang(p.tanggal_nikah)}</p>
          {hari === null ? (
            <>
              <h1 className="mt-3">
                <span className="display block text-[6.2rem] leading-[0.8] tracking-[-0.03em] text-emerald/40 md:text-[10rem]">—</span>
                <span className="display mt-2 block text-[1.9rem] italic md:text-[2.6rem]">hari lagi</span>
              </h1>
              <p className="mt-4 max-w-[30rem] text-[15px] text-ink-2">
                Hitung mundur muncul setelah tanggal nikah diisi di <Link href="/pengaturan" className="link">Pengaturan</Link>.
              </p>
            </>
          ) : hari > 0 ? (
            <>
              <h1 className="mt-3">
                <span className="display block text-[6.2rem] leading-[0.8] tracking-[-0.03em] text-emerald md:text-[10rem]">
                  <CountUp value={hari} format="plain" ms={1100} />
                </span>
                <span className="display mt-2 block text-[1.9rem] italic md:text-[2.6rem]">hari lagi</span>
              </h1>
              <p className="mt-4 max-w-[30rem] text-[15px] text-ink-2">
                {hari >= 14 ? `Sekitar ${Math.round(hari / 7)} minggu. ` : ""}
                {tb && (tb.bulan > 1 ? `${tb.bulan} kali gajian lagi.` : "Ini bulan terakhir.")}
              </p>
            </>
          ) : (
            <h1 className="display mt-3 text-[4rem] text-emerald">{hari === 0 ? "Hari ini." : "Sudah sah."}</h1>
          )}
        </div>
        <CouplePhoto a={p.nama_pria} b={p.nama_wanita} tanggal={nikah} foto={repo.mode === "demo" ? null : "/foto-kami.jpg"} />
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-[1.25fr_1fr] md:gap-5">
        <section className="panel">
          <div className="flex items-baseline justify-between">
            <h2 className="eyebrow">Tabungan bersama</h2>
            <Link href="/uang" className="link -my-3 inline-flex min-h-11 items-center text-[13px]">rincian</Link>
          </div>
          <p className="display mt-3 text-[2.7rem] leading-none md:text-[3.3rem]"><CountUp value={dana.terkumpul} format="rp" delay={150} /></p>
          <p className="mt-2 text-[14px] text-ink-2">
            <span className="num">{persen1(dana.terkumpul, p.target_dana)}%</span> dari <span className="num">{rp(p.target_dana)}</span>
          </p>
          <Reveal className="mt-4" delay={150}>
            <SavingsBar {...seg} target={p.target_dana} ambient />
          </Reveal>
          {!adaTarget ? (
            <p className="mt-4 text-[14px] text-ink-2">
              Isi target dana di <Link href="/pengaturan" className="link">Pengaturan</Link>, lalu catat setoran di <Link href="/uang" className="link">Tabungan</Link>.
            </p>
          ) : sisa > 0 && !tb ? (
            <p className="mt-4 text-[14px] text-ink-2">Isi tanggal nikah untuk menghitung setoran per bulan.</p>
          ) : sisa > 0 && tb ? (
            <p className="mt-4 text-[15px]">
              Perlu <strong className="num font-medium text-emerald">{rp(tb.perBulan)}</strong> per bulan sampai {bulanAkhir}.
            </p>
          ) : (
            <p className="mt-4 text-[15px] text-emerald">Target sudah tercapai.</p>
          )}
        </section>

        <section className="panel">
          <div className="flex items-baseline justify-between">
            <h2 className="eyebrow !text-clay">Tagihan berikutnya</h2>
            <Link href="/biaya" className="link -my-3 inline-flex min-h-11 items-center text-[13px]">biaya</Link>
          </div>
          {tagihanAtas.length > 0 ? (
            <ol className="mt-2">
              {tagihanAtas.map((t) => (
                <li key={t.item.id} className="flex items-baseline gap-3 border-b border-line-2 py-2.5 last:border-0">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{t.item.nama.trim()}</span>
                    <span className="block text-[12.5px] text-ink-3">
                      {t.item.sub ?? t.item.grup}
                      {t.item.status === "SUDAH DP" || t.item.status === "BELUM LUNAS" ? " · pelunasan" : ""}
                      {t.jatuhTempo && <span className="text-clay"> · {tgl(t.jatuhTempo)}</span>}
                    </span>
                  </span>
                  <span className="num flex-none text-[14px]">{t.sisa != null ? rp(t.sisa) : ""}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-[14px] text-ink-2">
              {biaya.length ? "Belum ada tagihan dengan nominal." : "Belum ada item biaya. Tagihan yang belum lunas muncul di sini."}
            </p>
          )}
          <p className="mt-3 text-[13px] text-ink-2">
            {sisaDiketahui > 0 && <>Total sisa <span className="num">{rp(sisaDiketahui)}</span>. </>}
            {tanpaNominal > 0 && <span className="text-clay">{tanpaNominal} item sudah DP, nominal pelunasannya belum dicatat.</span>}
          </p>
          <p className="mt-2 text-[12.5px] text-ink-3">
            Dibayar <span className="num">{rpSingkat(b.realisasi)}</span> dari estimasi <span className="num">{rpSingkat(b.estimasi)}</span>
          </p>
          <Reveal className="mt-1.5" delay={230}>
            <Progress value={b.realisasi} max={b.estimasi} label="Biaya dibayar dari estimasi" thin ambient />
          </Reveal>
        </section>
      </div>

      <div className="mt-4 grid gap-4 md:mt-5 md:grid-cols-[1.25fr_1fr] md:gap-5">
        <section className="panel">
          <div className="flex items-baseline justify-between">
            <h2 className="eyebrow">Berikutnya</h2>
            <Link href="/persiapan" className="link -my-3 inline-flex min-h-11 items-center text-[13px]">persiapan</Link>
          </div>
          {next.item ? (
            <>
              <p className="mt-2 text-[12.5px] text-ink-3">{next.item.bagian}</p>
              <NextTodo key={next.item.id} id={next.item.id} judul={next.item.judul} />
              {next.item.tenggat && <p className="mt-1 text-[13px] text-clay">Tenggat {tgl(next.item.tenggat)}</p>}
              <p className="mt-3 text-[13px] text-ink-2">
                {next.sisaDiTahap > 0 && <>{next.sisaDiTahap} lagi di tahap ini · </>}
                <span className="num">{td.sudah}/{td.total}</span> beres
              </p>
              <Reveal className="mt-2" delay={310}><Progress value={td.sudah} max={td.total} label="Progres persiapan" thin ambient /></Reveal>
            </>
          ) : td.total === 0 ? (
            <p className="mt-2 text-[14px] text-ink-2">
              Belum ada daftar persiapan. Tambahkan tugas per tahap di <Link href="/persiapan" className="link">Persiapan</Link>.
            </p>
          ) : (
            <p className="mt-2 text-emerald">Semua persiapan sudah beres.</p>
          )}
        </section>
        <section className="panel">
          <div className="flex items-baseline justify-between">
            <h2 className="eyebrow">Tamu</h2>
            <Link href="/tamu" className="link -my-3 inline-flex min-h-11 items-center text-[13px]">daftar</Link>
          </div>
          <p className="mt-3 flex items-baseline gap-2">
            <span className="display text-[3rem] leading-none"><CountUp value={perkiraan} delay={390} /></span>
            <span className="text-[14px] text-ink-2">perkiraan</span>
          </p>
          <p className="mt-3 text-[14px] text-ink-2">
            <span className="num">{tamu.length}</span> nama dicatat, <span className="num">{hadir}</span> hadir.
          </p>
          <Reveal className="mt-2" delay={390}>
            <Progress value={tamu.length} max={perkiraan} label="Nama tamu dicatat dari perkiraan" thin ambient />
          </Reveal>
        </section>
      </div>
    </div>
  );
}
