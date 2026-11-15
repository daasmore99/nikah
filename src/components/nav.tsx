"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export const NAV = [
  { href: "/", label: "Ringkasan", short: "Ringkas",
    desc: "Satu layar untuk hitung mundur ke hari H, posisi tabungan, tagihan terdekat, persiapan berikutnya, dan jumlah tamu." },
  { href: "/uang", label: "Tabungan", short: "Tabungan",
    desc: "Catat setoran tiap pihak dan pengeluaran bareng; grafik menunjukkan saldo dan berapa yang perlu ditabung per bulan." },
  { href: "/biaya", label: "Biaya", short: "Biaya",
    desc: "Daftar biaya per kategori (lamaran, mahar, resepsi, …) dengan estimasi, DP, status bayar, dan tanggal pelunasan." },
  { href: "/persiapan", label: "Persiapan", short: "Persiapan",
    desc: "Daftar tugas per tahap yang bisa dicentang, lengkap dengan tenggat, PIC, dan progres tiap tahap." },
  { href: "/tamu", label: "Tamu & RSVP",
    desc: "Perkiraan tamu per kelompok dan daftar nama dengan status undangan dan konfirmasi hadir." },
  { href: "/seserahan", label: "Seserahan",
    desc: "Daftar barang seserahan per budget dan kategori; centang yang sudah dibeli." },
  { href: "/vendor", label: "Vendor",
    desc: "Kontak, harga, dan status vendor (kandidat atau dipilih) supaya tidak tercecer di chat." },
  { href: "/undangan", label: "Undangan & souvenir",
    desc: "Kalkulator souvenir (harga × jumlah vs budget) dan katalog pilihan undangan cetak, digital, dan souvenir." },
  { href: "/lagu", label: "Lagu",
    desc: "Daftar putar acara untuk band atau operator musik, plus rekomendasi lagu yang bisa langsung dipakai." },
  { href: "/pengaturan", label: "Pengaturan",
    desc: "Nama mempelai, tanggal nikah, target dana, harga emas manual, angka souvenir, dan reset data demo." },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

export function SideNav() {
  const path = usePathname();
  return (
    <nav aria-label="Menu utama">
      <ol className="space-y-0.5">
        {NAV.map((n, i) => {
          const on = isActive(path, n.href);
          return (
            <li key={n.href}>
              <Link href={n.href} aria-current={on ? "page" : undefined}
                className={`flex items-baseline gap-3 py-1.5 text-[15px] transition-colors ${on ? "text-emerald" : "text-ink-2 hover:text-ink"}`}>
                <span className="num w-5 text-[11px] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                <span className={on ? "border-b border-emerald" : ""}>{n.label}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function BottomNav() {
  const path = usePathname();
  const [more, setMore] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  // Tutup panel "Lainnya" setiap kali rute berubah. Klik item di bar bawah
  // (Ringkas/Tabungan/...) tidak melewati onClick panel, jadi panel dulu tertinggal terbuka.
  const [lastPath, setLastPath] = useState(path);
  if (lastPath !== path) {
    setLastPath(path);
    setMore(false);
  }
  useEffect(() => {
    if (!more) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMore(false);
      btn.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [more]);
  const main = NAV.slice(0, 4);
  const rest = NAV.slice(4);
  const restActive = rest.some((n) => isActive(path, n.href));
  return (
    <>
      {more && (
        <div className="fixed inset-0 z-40 bg-[var(--scrim)] md:hidden" onClick={() => { setMore(false); btn.current?.focus(); }}>
          <nav id="menu-lainnya" aria-label="Menu lainnya" className="menu-panel absolute inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] px-3 pb-2 pt-5"
            onClick={(e) => e.stopPropagation()}>
            <ul>
              {rest.map((n) => (
                <li key={n.href} className="border-b border-line last:border-0">
                  <Link href={n.href} onClick={() => setMore(false)} aria-current={isActive(path, n.href) ? "page" : undefined}
                    className={`menu-item flex items-baseline gap-3 px-2 py-3 text-[16px] ${isActive(path, n.href) ? "font-medium text-emerald" : "text-ink"}`}>
                    <span className={`h-[1em] w-[3px] self-center ${isActive(path, n.href) ? "bg-emerald" : "bg-emerald/20"}`} aria-hidden />
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
      <nav aria-label="Menu utama" className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="grid h-[3.75rem] grid-cols-5">
          {main.map((n) => {
            const on = isActive(path, n.href);
            return (
              <li key={n.href}>
                <Link href={n.href} aria-current={on ? "page" : undefined} onClick={() => setMore(false)}
                  className={`flex h-full flex-col items-center justify-center gap-1 text-[12px] ${on ? "text-emerald" : "text-ink-2"}`}>
                  <span className={`h-[3px] w-5 ${on ? "bg-emerald" : "bg-transparent"}`} />
                  {n.short}
                </Link>
              </li>
            );
          })}
          <li>
            <button ref={btn} type="button" onClick={() => setMore((m) => !m)} aria-expanded={more} aria-controls="menu-lainnya"
              className={`flex h-full w-full flex-col items-center justify-center gap-1 text-[12px] ${restActive || more ? "text-emerald" : "text-ink-2"}`}>
              <span className={`h-[3px] w-5 ${restActive ? "bg-emerald" : "bg-transparent"}`} />
              Lainnya
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}

/** Akun demo: satu kalimat tentang isi halaman ini, supaya penonton tahu fitur yang bisa dicoba. */
export function DemoIntro() {
  const path = usePathname();
  const n = NAV.find((x) => isActive(path, x.href));
  if (!n) return null;
  return (
    <aside aria-label="Tentang halaman ini" className="mb-6 border-l-2 border-emerald bg-sheet px-4 py-3">
      <p className="eyebrow mb-1">Isi halaman {n.label}</p>
      <p className="text-[14px] text-ink-2">{n.desc}</p>
    </aside>
  );
}
