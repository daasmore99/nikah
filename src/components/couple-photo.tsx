"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Foto pasangan dari public/foto-kami.jpg. Selama foto belum ada (atau gagal
 * dimuat), yang tampil monogram huruf depan; gambar rusak tidak pernah terlihat.
 */
export function CouplePhoto({ a, b, tanggal }: { a: string; b: string; /** ISO YYYY-MM-DD */ tanggal?: string }) {
  const img = useRef<HTMLImageElement>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    // gambar bisa selesai dimuat sebelum React terpasang
    const el = img.current;
    if (el?.complete && el.naturalWidth > 0) requestAnimationFrame(() => setOk(true));
  }, []);

  return (
    <figure className="w-[7.5rem] flex-none md:w-[11rem]">
      {/* bingkai lengkung (arch) satu lapis: garis rambut emerald, jarak 6px, foto di dalam lengkung yang sepusat */}
      <div className="rounded-t-full border border-emerald/35 bg-sheet p-[5px] md:p-[7px]">
        <div className="relative aspect-[3/4] overflow-hidden rounded-t-full bg-emerald-tint">
          {!ok && (
            <div aria-hidden className="absolute inset-0 grid place-items-center pt-[15%]">
              <span className="display text-[2.4rem] leading-none text-emerald md:text-[3.6rem]">
                {a.charAt(0)}<em className="mx-0.5 text-[0.6em] text-brass-ink">&amp;</em>{b.charAt(0)}
              </span>
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element -- file opsional; next/image butuh ukuran & gagal keras kalau file tidak ada */}
          <img ref={img} src="/foto-kami.jpg" alt={`${a} dan ${b}`} aria-hidden={!ok}
            className={`absolute inset-0 h-full w-full object-cover object-[50%_22%] transition-opacity duration-700 ${ok ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setOk(true)} onError={() => setOk(false)} />
        </div>
      </div>
      <figcaption className="num mt-2 truncate text-center text-[10px] tracking-[0.08em] text-ink-3 uppercase md:tracking-[0.04em]">
        {a} &amp; {b}
        {/* tanggal ringkas 10.04.27; di HP tanggal lengkap sudah ada tepat di sebelah foto */}
        {tanggal && <span className="hidden md:inline"> · {tanggal.slice(8, 10)}.{tanggal.slice(5, 7)}.{tanggal.slice(2, 4)}</span>}
      </figcaption>
    </figure>
  );
}
