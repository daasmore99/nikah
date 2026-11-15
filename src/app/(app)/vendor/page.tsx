import type { Metadata } from "next";
import { requireRepo } from "@/lib/repo";
import { PageHead } from "@/components/ui";
import { EntityList } from "@/components/entity-list";

export const metadata: Metadata = { title: "Vendor" };

export default async function Vendor() {
  const repo = await requireRepo();
  const [vendor, profil] = await Promise.all([repo.list("vendor"), repo.profil()]);
  const dipilih = vendor.filter((v) => v.status === "Dipilih").length;
  return (
    <div>
      <PageHead eyebrow="Vendor" title={`${dipilih} vendor sudah dipilih`}>
        Simpan kontak dan harga di sini supaya tidak tercecer di chat.
      </PageHead>
      <EntityList profil={profil} rows={vendor as never}
        config={{
          table: "vendor", noun: "vendor", primary: "nama", secondary: ["kategori", "kontak", "telepon", "alamat", "catatan"],
          badge: "status", amount: "harga", link: "instagram_web", search: true,
          defaults: { status: "Kandidat" }, csv: "vendor", empty: "Belum ada vendor.",
          bulk: { edit: ["status", "kategori"], add: { shared: ["kategori", "status"], perRow: ["nama", "harga", "telepon"], dupScope: ["kategori"] } },
        }} />
    </div>
  );
}
