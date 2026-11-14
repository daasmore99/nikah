"use client";

import { useEffect, useRef, useState } from "react";
import { rpSingkat, bulanPendek, rp, tgl } from "@/lib/format";
import { Reveal } from "@/components/motion";

interface Props {
  titik: { tanggal: string; saldo: number }[];
  target: number;
  today: string;
  nikah: string;
}

const t = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

/**
 * Saldo dana bersama dari waktu ke waktu (garis tangga), garis target, dan
 * jalur lurus dari saldo hari ini ke target di hari H. Label langsung, tanpa legenda.
 */
export function SavingsChart({ titik, target, today, nikah }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const h = w < 500 ? 230 : 280;
  const pad = { l: 8, r: w < 500 ? 56 : 70, t: 22, b: 26 };
  if (!titik.length) return <div ref={box} className="py-10 text-center text-ink-3">Belum ada setoran.</div>;

  const x0 = t(titik[0].tanggal);
  const x1 = t(nikah);
  const yMax = Math.max(target, ...titik.map((p) => p.saldo)) * 1.08;
  const X = (ms: number) => pad.l + ((ms - x0) / (x1 - x0)) * (w - pad.l - pad.r);
  const Y = (v: number) => pad.t + (1 - v / yMax) * (h - pad.t - pad.b);

  const last = titik[titik.length - 1];
  const tNow = Math.max(t(today), t(last.tanggal));
  let d = `M${X(t(titik[0].tanggal))},${Y(titik[0].saldo)}`;
  for (let i = 1; i < titik.length; i++) d += ` H${X(t(titik[i].tanggal))} V${Y(titik[i].saldo)}`;
  d += ` H${X(tNow)}`;

  // tanda bulan di sumbu x
  const ticks: { x: number; label: string }[] = [];
  const s = new Date(x0);
  for (let y = s.getUTCFullYear(), m = s.getUTCMonth() + 1; ; m++) {
    if (m > 12) { m = 1; y++; }
    const ms = Date.UTC(y, m - 1, 1);
    if (ms > x1) break;
    if (ms >= x0) ticks.push({ x: X(ms), label: m === 1 ? String(y) : bulanPendek(m) });
  }
  const every = w < 500 ? 3 : 2;
  const milestones = [25, 50, 75].map((pct) => {
    const v = (target * pct) / 100;
    return { pct, v, at: titik.find((p) => p.saldo >= v)?.tanggal ?? null };
  });
  const hp = hover !== null ? titik[hover] : null;

  return (
    <div ref={box} className="relative w-full select-none">
      {w > 0 && (
        // Reveal: gerak loop (jalur target, denyut, kilau) hanya jalan saat grafik di layar & tab terlihat
        <Reveal>
        <svg width={w} height={h} role="img" aria-label={`Saldo dana ${rp(last.saldo)} dari target ${rp(target)}`}
          onPointerLeave={() => setHover(null)}
          onPointerMove={(e) => {
            const rx = e.clientX - e.currentTarget.getBoundingClientRect().left;
            let best = 0;
            titik.forEach((p, i) => { if (Math.abs(X(t(p.tanggal)) - rx) < Math.abs(X(t(titik[best].tanggal)) - rx)) best = i; });
            setHover(best);
          }}>
          {/* sumbu */}
          <line x1={pad.l} x2={w - pad.r} y1={Y(0)} y2={Y(0)} stroke="var(--line)" />
          {ticks.map((k, i) => (
            <g key={i}>
              <line x1={k.x} x2={k.x} y1={Y(0)} y2={Y(0) + 4} stroke="var(--line)" />
              {i % every === 0 && <text x={k.x} y={h - 6} fontSize="11" fill="var(--ink-3)" textAnchor={k.x < pad.l + 14 ? "start" : "middle"} className="num">{k.label}</text>}
            </g>
          ))}
          {/* penanda 25/50/75%: tercapai = hijau + titik di tanggal tercapainya (hanya label persen, tanpa tanggal) */}
          {milestones.map((m) => {
            // pernah tercapai tapi saldo sekarang di bawahnya (dana terpakai): riwayat tetap, warna diredam
            const turun = m.at && last.saldo < m.v;
            return (
            <g key={m.pct}>
              <line x1={pad.l} x2={w - pad.r} y1={Y(m.v)} y2={Y(m.v)} stroke={m.at && !turun ? "var(--emerald-2)" : "var(--line)"} strokeDasharray={m.at ? "1 3" : "2 5"} opacity={m.at && !turun ? 0.7 : 1} />
              <text x={pad.l + 2} y={Y(m.v) - 5} fontSize="10.5" fill={m.at && !turun ? "var(--emerald)" : "var(--ink-3)"} className="num">
                {m.pct}%
              </text>
              {m.at && <circle cx={X(t(m.at))} cy={Y(m.v)} r="3" fill={turun ? "var(--sheet)" : "var(--emerald)"} stroke={turun ? "var(--emerald-2)" : "var(--sheet)"} strokeWidth="1.5" />}
            </g>
            );
          })}
          {/* target */}
          <line x1={pad.l} x2={w - pad.r} y1={Y(target)} y2={Y(target)} stroke="var(--brass)" strokeDasharray="2 4" />
          <text x={w - pad.r + 6} y={Y(target) + 4} fontSize="11.5" fill="var(--brass)" className="num">{rpSingkat(target)}</text>
          <text x={w - pad.r - 2} y={Y(target) - 7} fontSize="11.5" fill="var(--brass)" textAnchor="end">target</text>
          {/* hari ini & hari H */}
          <line x1={X(tNow)} x2={X(tNow)} y1={pad.t - 8} y2={Y(0)} stroke="var(--line)" strokeDasharray="1 3" />
          <text x={X(tNow)} y={pad.t - 11} fontSize="11" fill="var(--ink-3)" textAnchor="middle">hari ini</text>
          {/* jalur yang dibutuhkan */}
          <line x1={X(tNow)} y1={Y(last.saldo)} x2={X(x1)} y2={Y(target)} stroke="var(--emerald-2)" strokeDasharray="5 4" strokeWidth="1.5" className="path-flow" />
          <circle cx={X(x1)} cy={Y(target)} r="3.5" fill="var(--sheet)" stroke="var(--emerald-2)" strokeWidth="1.5" className="twinkle" />
          {/* saldo */}
          <path d={`${d} V${Y(0)} H${X(t(titik[0].tanggal))} Z`} fill="var(--emerald)" opacity="0.07" className="fade-in" />
          <path d={d} fill="none" stroke="var(--emerald)" strokeWidth="2" strokeLinejoin="round" pathLength={1} className="line-draw" />
          <path d={d} fill="none" stroke="var(--paper)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="glint" aria-hidden />
          <circle cx={X(tNow)} cy={Y(last.saldo)} r="4" fill="none" stroke="var(--emerald-2)" strokeWidth="1.25" className="ring-pulse" aria-hidden />
          <circle cx={X(tNow)} cy={Y(last.saldo)} r="4" fill="var(--emerald)" />
          <text x={w - pad.r + 6} y={Y(last.saldo) + 4} fontSize="11.5" fill="var(--emerald)" className="num" fontWeight="500">{rpSingkat(last.saldo)}</text>
          {hp && (
            <g>
              <line x1={X(t(hp.tanggal))} x2={X(t(hp.tanggal))} y1={pad.t} y2={Y(0)} stroke="var(--ink-3)" strokeWidth="0.75" />
              <circle cx={X(t(hp.tanggal))} cy={Y(hp.saldo)} r="3.5" fill="var(--sheet)" stroke="var(--emerald)" strokeWidth="2" />
            </g>
          )}
        </svg>
        </Reveal>
      )}
      <p className="num mt-1 h-5 text-[12px] text-ink-2" aria-live="polite">
        {hp ? `${tgl(hp.tanggal)}: saldo ${rp(hp.saldo)}` : <span className="text-ink-3">Garis putus hijau: jalur supaya target tercapai di hari H.</span>}
      </p>
    </div>
  );
}
