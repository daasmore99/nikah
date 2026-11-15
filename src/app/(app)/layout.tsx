import Link from "next/link";
import type { Metadata } from "next";
import { RepoError, requireRepo, type Repo } from "@/lib/repo";
import type { Pengaturan } from "@/lib/types";
import { localMode } from "@/lib/env";
import { daysBetween, todayJakarta } from "@/lib/calc";
import { tglPanjang } from "@/lib/format";
import { judulPasangan } from "@/lib/demo";
import { BottomNav, DemoIntro, SideNav } from "@/components/nav";
import { LoadError } from "@/components/load-error";
import { signOut } from "../actions";

/** Judul tab dari nama di Pengaturan; akun demo yang belum mengisi nama memakai judul netral. */
export async function generateMetadata(): Promise<Metadata> {
  const r = await muat();
  if ("error" in r) return { title: { absolute: "Gagal memuat · Tracker Pernikahan" } };
  const judul = judulPasangan(r.p);
  // absolute: judul halaman Ringkasan tidak ikut template root ("X · Tracker Pernikahan")
  return { title: { absolute: judul, template: `%s · ${judul}` } };
}

/**
 * Repo + pengaturan untuk kerangka halaman. RepoError (mis. "Penyimpanan demo belum disiapkan",
 * akun belum terdaftar) dikembalikan sebagai pesan supaya tampil sebagai panel ramah: error yang
 * dilempar dari layout ini tidak tertangkap (app)/error.tsx, dan di production pesannya disembunyikan.
 * Error lain (redirect login, jaringan) tetap dilempar ke boundary (src/app/error.tsx).
 */
async function muat(): Promise<{ repo: Repo; p: Pengaturan } | { error: string }> {
  try {
    const repo = await requireRepo();
    return { repo, p: await repo.pengaturan() };
  } catch (e) {
    if (e instanceof RepoError) {
      console.error("[layout (app)]", e.message);
      return { error: e.message };
    }
    throw e;
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const r = await muat();
  if ("error" in r) return <LoadError message={r.error} />;
  const { repo, p } = r;
  const demo = repo.mode === "demo";
  const sisa = p.tanggal_nikah ? daysBetween(todayJakarta(), p.tanggal_nikah) : null;
  const adaNama = Boolean(p.nama_pria.trim() && p.nama_wanita.trim());

  return (
    <div className="mx-auto min-h-dvh max-w-[76rem] md:grid md:grid-cols-[15rem_1fr] md:gap-10 md:px-8">
      {/* desktop rail */}
      <aside className="rail relative hidden md:block">
        <div className="sticky top-0 flex h-dvh flex-col py-8">
          <Link href="/" className="block">
            <span className="display block text-[2.4rem] leading-[0.95]">
              {adaNama ? (
                <>{p.nama_pria}<br /><em className="text-emerald">&amp;</em> {p.nama_wanita}</>
              ) : (
                <>Tracker<br /><em className="text-emerald">Pernikahan</em></>
              )}
            </span>
          </Link>
          <p className="mt-3 text-[13px] text-ink-2">{tglPanjang(p.tanggal_nikah)}</p>
          {demo && <p className="mt-2 inline-block self-start border border-emerald/40 bg-emerald-tint px-2 py-0.5 text-[11.5px] tracking-[0.04em] text-emerald uppercase">Akun demo</p>}
          <div className="rule my-6" />
          <SideNav demo={demo} />
          <div className="mt-auto space-y-2 text-[12.5px] text-ink-3">
            <p>Masuk sebagai {repo.user.nama}</p>
            <form action={signOut}><button className="underline hover:text-ink">Keluar</button></form>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        {/* header HP */}
        <header className="flex items-center justify-between gap-3 border-b border-line bg-rail/80 px-4 py-3 md:hidden">
          <Link href="/" className="display min-w-0 truncate text-[1.5rem]">
            {adaNama ? <>{p.nama_pria} <em className="text-emerald">&amp;</em> {p.nama_wanita}</> : <>Tracker <em className="text-emerald">Pernikahan</em></>}
          </Link>
          <span className="num flex-none text-[12px] text-ink-2">
            {sisa === null ? "tanggal —" : sisa > 0 ? `${sisa} hari lagi` : sisa === 0 ? "hari ini" : "sudah lewat"}
          </span>
        </header>
        {demo && (
          <p role="note" className="sticky top-0 z-30 border-b border-emerald/30 bg-emerald-tint px-4 py-2 text-[12.5px] text-emerald md:mt-4 md:border">
            <strong className="font-medium">Akun demo</strong>
          </p>
        )}
        {localMode && (
          <p className="border-b border-brass/40 bg-brass-tint px-4 py-2 text-[12.5px] text-ink-2 md:mt-4 md:border">
            Mode lokal: data disimpan di <code>.local-data/{demo ? "demo-<ruang>.json" : "db.json"}</code> di laptop ini, tanpa login. Hanya untuk mencoba.
          </p>
        )}
        <main className="px-4 pb-28 pt-5 md:px-0 md:pb-16 md:pt-8">
          {demo && <DemoIntro />}
          {children}
        </main>
      </div>
      <BottomNav demo={demo} />
    </div>
  );
}
