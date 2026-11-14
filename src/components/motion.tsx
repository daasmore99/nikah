"use client";

import { useEffect, useRef, useState } from "react";
import { angka, rp } from "@/lib/format";

const reduce = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Angka yang menghitung naik saat pertama tampil. Server merender nilai akhir
 * (aman tanpa JS & untuk pembaca layar); animasi dilewati kalau pengguna
 * memilih kurangi gerak.
 */
/** Durasi & easing yang sama dengan .bar-fill / .bar-clip di globals.css (easeOutCubic). */
export const STEADY_MS = 1100;
export const STEADY_DELAY = 150;
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);

/** Panggil cb sekali saat elemen pertama kali masuk layar. */
function useFirstSeen(ref: React.RefObject<Element | null>, cb: () => void) {
  const fired = useRef(false);
  const cbRef = useRef(cb);
  useEffect(() => {
    cbRef.current = cb;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el || fired.current) return;
    if (typeof IntersectionObserver === "undefined") {
      fired.current = true;
      cbRef.current();
      return;
    }
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting) && !fired.current) {
        fired.current = true;
        io.disconnect();
        cbRef.current();
      }
    }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
}

/**
 * Angka yang menghitung naik saat pertama terlihat di layar, dengan durasi dan
 * easing yang sama dengan bar supaya selesai bersamaan. Server merender nilai akhir
 * (aman tanpa JS & untuk pembaca layar); animasi dilewati kalau pengguna memilih kurangi gerak.
 */
export function CountUp({ value, format = "angka", ms = STEADY_MS, delay = STEADY_DELAY }: {
  value: number; format?: "angka" | "rp" | "plain"; ms?: number; delay?: number;
}) {
  const box = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(value);
  const [seen, setSeen] = useState(false);
  // mulai dari 0 saat pertama tampil, lalu dari angka terakhir kalau nilainya berubah
  const from = useRef(0);
  useFirstSeen(box, () => setSeen(true));

  useEffect(() => {
    if (!seen) {
      // tahan di 0 sampai terlihat (kecuali kurangi gerak)
      if (reduce()) return;
      const r = requestAnimationFrame(() => setN(0));
      return () => cancelAnimationFrame(r);
    }
    const a = from.current;
    const dur = reduce() || a === value ? 0 : ms;
    const wait = dur === 0 ? 0 : delay;
    let raf = 0;
    const t0 = performance.now() + wait;
    const step = (t: number) => {
      const p = dur === 0 ? 1 : Math.max(0, Math.min(1, (t - t0) / dur));
      const cur = p < 1 ? Math.round(a + (value - a) * easeOutCubic(p)) : value;
      from.current = cur;
      setN(cur);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, delay, seen]);

  const show = (x: number) => (format === "rp" ? rp(x) : format === "angka" ? angka(x) : String(x));
  return (
    <span ref={box}>
      <span aria-hidden>{show(n)}</span>
      <span className="sr-only">{show(value)}</span>
    </span>
  );
}

/**
 * Pembungkus grafik: animasi masuk (.bar-fill/.bar-clip) baru jalan saat pertama terlihat,
 * dan gerak ambient (.sheen, .hatch-run) hanya berjalan selama elemen di layar dan tab terlihat.
 * Semua gerak memakai CSS; tidak ada requestAnimationFrame terus-menerus.
 */
export function Reveal({ children, className = "", delay }: { children: React.ReactNode; className?: string; delay?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  useFirstSeen(box, () => setSeen(true));
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => setOnScreen(es.some((e) => e.isIntersecting)));
    io.observe(el);
    const vis = () => setTabVisible(document.visibilityState === "visible");
    vis();
    document.addEventListener("visibilitychange", vis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);
  return (
    <div ref={box} className={`reveal ${className}`} data-seen={seen || undefined} data-play={seen && onScreen && tabVisible ? "on" : "off"}
      style={delay != null ? ({ "--d": `${delay}ms` } as React.CSSProperties) : undefined}>
      {children}
    </div>
  );
}
