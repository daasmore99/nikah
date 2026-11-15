"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { LANGKAH_AWAL } from "@/lib/panduan";

/** Status "sudah ditutup" disimpan per browser. Gagal baca/tulis (mode privat, dll.) = kartu tampil lagi, tidak apa-apa. */
const KEY = "demo-sambutan-ditutup";
const listeners = new Set<() => void>();
function ditutup() {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
let tutupSesiIni = false;
function tutup() {
  tutupSesiIni = true;
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // abaikan: kartu tetap tertutup sampai halaman dimuat ulang
  }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Kartu sambutan akun demo di Ringkasan: tiga langkah pertama + tautan ke Panduan. Hanya dirender untuk akun demo. */
export function DemoWelcome() {
  // server: anggap tertutup supaya tidak berkedip bagi yang sudah menutupnya
  const hidden = useSyncExternalStore(subscribe, () => tutupSesiIni || ditutup(), () => true);
  if (hidden) return null;
  return (
    <section aria-labelledby="sambutan-judul" className="mb-6 border border-emerald/35 bg-emerald-tint/50 px-4 py-4 md:px-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Mulai dari sini</p>
          <h2 id="sambutan-judul" className="display mt-1.5 text-[1.6rem]">Tiga langkah pertama</h2>
        </div>
        <button type="button" className="btn btn-ghost h-9 px-2 text-[13px]" onClick={tutup}>Tutup</button>
      </div>
      <ol className="mt-3 space-y-1.5">
        {LANGKAH_AWAL.map((l, i) => (
          <li key={l.href} className="flex gap-3 text-[14.5px]">
            <span className="num flex-none text-[12px] leading-[1.7] text-emerald">{i + 1}.</span>
            <Link href={l.href} className="link">{l.teks}</Link>
          </li>
        ))}
      </ol>
      <Link href="/panduan" className="mt-3 inline-block text-[13.5px] font-medium text-emerald underline underline-offset-2">Lihat panduan lengkap</Link>
    </section>
  );
}
