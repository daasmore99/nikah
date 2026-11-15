import type { Metadata } from "next";
import { requireRepo } from "@/lib/repo";
import { PENGATURAN_FIELDS } from "@/lib/fields";
import { rp, tgl } from "@/lib/format";
import { PageHead, Section } from "@/components/ui";
import { SettingsForm } from "@/components/settings-form";
import { ResetDemo } from "@/components/reset-demo";
import { signOut } from "../../actions";

export const metadata: Metadata = { title: "Pengaturan" };

const pick = (keys: string[]) => PENGATURAN_FIELDS.filter((f) => keys.includes(f.key));

export default async function Pengaturan() {
  const repo = await requireRepo();
  const p = await repo.pengaturan();
  const init = p as unknown as Record<string, unknown>;

  return (
    <div>
      <PageHead eyebrow="Pengaturan" title="Angka dasar">
        Tanggal nikah dan target dana dipakai untuk hitung mundur dan target setoran bulanan.
      </PageHead>

      <Section title="Acara & target">
        <SettingsForm fields={pick(["nama_pria", "nama_wanita", "tanggal_nikah", "target_dana"])} initial={init} />
      </Section>

      <Section title="Harga emas manual">
        <p className="-mt-1 mb-4 max-w-[38rem] text-[14px] text-ink-2">
          Harga otomatis diambil dari harga spot dunia dan disimpan di server 6 jam. Kalau sumbernya gagal, harga di sini yang dipakai.
          {p.harga_emas_terakhir && <> Harga otomatis terakhir: <span className="num">{rp(p.harga_emas_terakhir)}</span>/g ({tgl(p.harga_emas_terakhir_at?.slice(0, 10))}).</>}
        </p>
        <SettingsForm fields={pick(["harga_emas_manual", "harga_emas_manual_tgl"])} initial={init} />
      </Section>

      <Section title="Souvenir">
        <SettingsForm fields={pick(["souvenir_harga_satuan", "souvenir_jumlah", "souvenir_budget", "souvenir_blindbox", "souvenir_sisa_umma", "souvenir_kurang"])} initial={init} />
      </Section>

      {repo.mode === "demo" && (
        <Section title="Data demo" id="reset-demo">
          <p className="-mt-1 mb-4 max-w-[38rem] text-[14px] text-ink-2">
            Isi apa saja untuk mencoba fitur, lalu kosongkan lagi di sini.
          </p>
          <ResetDemo />
        </Section>
      )}

      <Section title="Akun">
        <p className="text-[14px] text-ink-2">Masuk sebagai <strong className="font-medium text-ink">{repo.user.nama}</strong>{repo.user.email && ` (${repo.user.email})`}.</p>
        <p className="mt-1 text-[13px] text-ink-3">Cadangan data: tiap daftar punya tombol Ekspor CSV.</p>
        <form action={signOut} className="mt-4"><button className="btn">Keluar</button></form>
      </Section>
    </div>
  );
}
