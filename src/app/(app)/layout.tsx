import Link from "next/link";
import { requireRepo } from "@/lib/repo";
import { localMode } from "@/lib/env";
import { daysBetween, todayJakarta } from "@/lib/calc";
import { tglPanjang } from "@/lib/format";
import { BottomNav, SideNav } from "@/components/nav";
import { signOut } from "../actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const repo = await requireRepo();
  const p = await repo.pengaturan();
  const sisa = daysBetween(todayJakarta(), p.tanggal_nikah);

  return (
    <div className="mx-auto min-h-dvh max-w-[76rem] md:grid md:grid-cols-[15rem_1fr] md:gap-10 md:px-8">
      {/* desktop rail */}
      <aside className="hidden md:block">
        <div className="sticky top-0 flex h-dvh flex-col py-8">
          <Link href="/" className="block">
            <span className="display block text-[2.4rem] leading-[0.95]">
              {p.nama_pria}<br /><em className="text-emerald">&amp;</em> {p.nama_wanita}
            </span>
          </Link>
          <p className="mt-3 text-[13px] text-ink-2">{tglPanjang(p.tanggal_nikah)}</p>
          <div className="rule my-6" />
          <SideNav />
          <div className="mt-auto space-y-2 text-[12.5px] text-ink-3">
            <p>Masuk sebagai {repo.user.nama}</p>
            <form action={signOut}><button className="underline hover:text-ink">Keluar</button></form>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        {/* header HP */}
        <header className="flex items-center justify-between border-b border-line px-4 py-3 md:hidden">
          <Link href="/" className="display text-[1.5rem]">
            {p.nama_pria} <em className="text-emerald">&amp;</em> {p.nama_wanita}
          </Link>
          <span className="num text-[12px] text-ink-2">{sisa > 0 ? `${sisa} hari lagi` : sisa === 0 ? "hari ini" : "sudah lewat"}</span>
        </header>
        {localMode && (
          <p className="border-b border-brass/40 bg-brass-tint px-4 py-2 text-[12.5px] text-ink-2 md:mt-4 md:border">
            Mode lokal: data disimpan di <code>.local-data/db.json</code> di laptop ini, tanpa login. Hanya untuk mencoba.
          </p>
        )}
        <main className="px-4 pb-28 pt-5 md:px-0 md:pb-16 md:pt-8">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
