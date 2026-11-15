import type { Metadata } from "next";
import { requireRepo } from "@/lib/repo";
import { hitungTodo } from "@/lib/calc";
import { MiniBar, PageHead, Progress } from "@/components/ui";
import { EntityList } from "@/components/entity-list";
import { CountUp } from "@/components/motion";

export const metadata: Metadata = { title: "Persiapan" };

export default async function Persiapan() {
  const repo = await requireRepo();
  const [todo, profil] = await Promise.all([repo.list("todo"), repo.profil()]);
  const td = hitungTodo(todo);
  const bagian = [...new Map(todo.map((t) => [t.bagian, t.bagian_no])).entries()].sort((a, b) => a[1] - b[1]);
  const perBagian = bagian.map(([nama]) => {
    const xs = todo.filter((t) => t.bagian === nama);
    return { nama, sudah: xs.filter((t) => t.selesai).length, total: xs.length };
  });
  const admin = todo.filter((t) => t.cpp_selesai !== null || t.cpw_selesai !== null);

  // berkas administrasi punya centang CPP/CPW sendiri: tampilkan terpisah
  const umum = todo.filter((t) => !admin.includes(t));

  return (
    <div className="stagger">
      <PageHead eyebrow="Persiapan" title={<><CountUp value={td.sudah} format="plain" /> dari {td.total} beres</>} />

      {/* satu bar total yang langsung terbaca, lalu rincian per tahap yang semuanya berlabel */}
      <Progress value={td.sudah} max={td.total} label={`Persiapan beres ${td.sudah} dari ${td.total}`} />
      <p className="mt-2 text-[13px] text-ink-2">
        <span className="num">{td.sudah}</span> dari <span className="num">{td.total}</span> persiapan beres
        (<span className="num">{td.total ? Math.round((td.sudah / td.total) * 100) : 0}%</span>) ·{" "}
        <span className="num">{perBagian.filter((b) => b.sudah === b.total).length}</span> dari <span className="num">{perBagian.length}</span> tahap selesai
      </p>
      <ul aria-label="Progres per tahap" className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {perBagian.map((b) => (
          <li key={b.nama} className="min-w-0">
            <span className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="truncate text-ink-2" title={b.nama}>{b.nama}</span>
              <span className={`num flex-none text-[12px] ${b.sudah === b.total ? "text-emerald" : "text-ink-3"}`}>
                {b.sudah === b.total ? "✓ " : ""}{b.sudah}/{b.total}
              </span>
            </span>
            <span className="mt-1 block"><MiniBar value={b.sudah} max={b.total} /></span>
          </li>
        ))}
      </ul>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <EntityList profil={profil} rows={umum as never}
          config={{
            table: "todo", noun: "persiapan", primary: "judul", secondary: ["progres", "detail", "pic", "tenggat"],
            toggle: "selesai", strikeDone: true, groupBy: "bagian", collapse: "progress", search: true, hide: ["cpp_selesai", "cpw_selesai"],
            defaults: { bagian: "Persiapan lainnya", selesai: false, cpp_selesai: null, cpw_selesai: null }, csv: "persiapan", empty: "Belum ada persiapan.",
            bulk: { edit: ["selesai", "pic", "bagian"], add: { shared: ["bagian", "pic"], perRow: ["judul", "tenggat"], dupScope: ["bagian"] } },
            fieldOptions: { bagian: perBagian.map((b) => b.nama) },
          }} />
        {admin.length > 0 && (
          <div>
            <p className="eyebrow mb-1">Berkas nikah</p>
            <p className="mb-4 text-[13.5px] text-ink-2">Kiri: semua beres. Kanan: per calon pengantin.</p>
            <EntityList profil={profil} rows={admin as never}
              config={{
                table: "todo", noun: "berkas", primary: "judul", secondary: ["detail"], toggle: "selesai", strikeDone: true,
                toggles: [{ key: "cpp_selesai", label: "CPP" }, { key: "cpw_selesai", label: "CPW" }],
                defaults: { bagian: admin[0].bagian, selesai: false, cpp_selesai: false, cpw_selesai: false }, hide: ["bagian", "cpp_selesai", "cpw_selesai"], csv: "berkas-nikah", empty: "",
              }} />
          </div>
        )}
      </div>
    </div>
  );
}
