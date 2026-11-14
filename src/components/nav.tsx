"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export const NAV = [
  { href: "/", label: "Ringkasan", short: "Ringkas" },
  { href: "/uang", label: "Tabungan", short: "Tabungan" },
  { href: "/biaya", label: "Biaya", short: "Biaya" },
  { href: "/persiapan", label: "Persiapan", short: "Persiapan" },
  { href: "/tamu", label: "Tamu & RSVP" },
  { href: "/seserahan", label: "Seserahan" },
  { href: "/vendor", label: "Vendor" },
  { href: "/undangan", label: "Undangan & souvenir" },
  { href: "/lagu", label: "Lagu" },
  { href: "/pengaturan", label: "Pengaturan" },
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
  const main = NAV.slice(0, 4);
  const rest = NAV.slice(4);
  const restActive = rest.some((n) => isActive(path, n.href));
  return (
    <>
      {more && (
        <div className="fixed inset-0 z-40 bg-ink/30 md:hidden" onClick={() => setMore(false)}>
          <nav aria-label="Menu lainnya" className="absolute inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] border-t border-line bg-sheet px-5 py-3"
            onClick={(e) => e.stopPropagation()}>
            <ul>
              {rest.map((n) => (
                <li key={n.href} className="border-b border-line-2 last:border-0">
                  <Link href={n.href} onClick={() => setMore(false)} className={`block py-3 text-[16px] ${isActive(path, n.href) ? "text-emerald" : ""}`}>{n.label}</Link>
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
                <Link href={n.href} aria-current={on ? "page" : undefined}
                  className={`flex h-full flex-col items-center justify-center gap-1 text-[12px] ${on ? "text-emerald" : "text-ink-2"}`}>
                  <span className={`h-[3px] w-5 ${on ? "bg-emerald" : "bg-transparent"}`} />
                  {n.short}
                </Link>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more}
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
