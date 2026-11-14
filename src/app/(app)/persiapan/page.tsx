import type { Metadata } from "next";
import { requireRepo } from "@/lib/repo";
import { hitungTodo } from "@/lib/calc";
import { PageHead, Progress } from "@/components/ui";
import { EntityList } from "@/components/entity-list";

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
    <div>
      <PageHead eyebrow="Persiapan" title={`${td.sudah} dari ${td.total} beres`}>
        Centang langsung dari daftar. Ketuk judulnya untuk ubah detail, tenggat, atau PIC.
      </PageHead>
      <Progress value={td.sudah} max={td.total} label="Progres persiapan" />

      <ol className="no-scrollbar -mx-4 mt-6 flex gap-5 overflow-x-auto px-4 pb-2 text-[13px] md:mx-0 md:flex-wrap md:px-0">
        {perBagian.map((b) => (
          <li key={b.nama} className="flex-none">
            <span className={b.sudah === b.total ? "text-emerald" : "text-ink-2"}>{b.nama}</span>{" "}
            <span className="num text-ink-3">{b.sudah}/{b.total}</span>
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <EntityList profil={profil} rows={umum as never}
          config={{
            table: "todo", noun: "tugas", primary: "judul", secondary: ["progres", "detail", "pic", "tenggat"],
            toggle: "selesai", strikeDone: true, groupBy: "bagian", search: true, hide: ["cpp_selesai", "cpw_selesai"],
            defaults: { bagian: "Persiapan lainnya", selesai: false, cpp_selesai: null, cpw_selesai: null }, csv: "persiapan", empty: "Belum ada tugas.",
          }} />
        {admin.length > 0 && (
          <div>
            <p className="eyebrow mb-1">Berkas nikah</p>
            <p className="mb-4 text-[13.5px] text-ink-2">Centang kiri kalau berkas sudah beres semua; kolom kanan untuk tiap calon pengantin.</p>
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
