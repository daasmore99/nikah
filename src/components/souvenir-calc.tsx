"use client";

import { useState, useTransition } from "react";
import { rp } from "@/lib/format";
import { updatePengaturan } from "@/app/actions";

interface Opt { id: string; nama: string; harga: number | null }

const digits = (s: string) => Number(s.replace(/\D/g, "")) || 0;

export function SouvenirCalc({ harga0, jumlah0, budget, opsi, saranJumlah }: {
  harga0: number; jumlah0: number; budget: number | null; opsi: Opt[]; saranJumlah: number;
}) {
  const [harga, setHarga] = useState(harga0);
  const [jumlah, setJumlah] = useState(jumlah0);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const total = harga * jumlah;
  const berubah = harga !== harga0 || jumlah !== jumlah0;

  const simpan = () =>
    start(async () => {
      const r = await updatePengaturan({ souvenir_harga_satuan: harga, souvenir_jumlah: jumlah });
      setMsg(r.ok ? "Tersimpan." : r.message);
    });

  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-ink-2">Harga per pcs</span>
          <div className="relative">
            <span className="num pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3">Rp</span>
            <input className="input num pl-10" inputMode="numeric" value={harga ? harga.toLocaleString("id-ID") : ""}
              onChange={(e) => { setHarga(digits(e.target.value)); setMsg(null); }} />
          </div>
        </label>
        <span className="display pb-2 text-[1.6rem] text-ink-3">×</span>
        <label className="block">
          <span className="mb-1.5 block text-[13px] text-ink-2">Jumlah</span>
          <input className="input num" inputMode="numeric" value={jumlah ? jumlah.toLocaleString("id-ID") : ""}
            onChange={(e) => { setJumlah(digits(e.target.value)); setMsg(null); }} />
        </label>
      </div>
      {opsi.length > 0 && (
        <label className="mt-3 block">
          <span className="mb-1.5 block text-[13px] text-ink-2">Atau ambil harga dari katalog</span>
          <select className="input" defaultValue="" onChange={(e) => {
            const o = opsi.find((x) => x.id === e.target.value);
            if (o?.harga) { setHarga(o.harga); setMsg(null); }
          }}>
            <option value="">Pilih souvenir…</option>
            {opsi.map((o) => <option key={o.id} value={o.id}>{o.nama} · {rp(o.harga)}</option>)}
          </select>
        </label>
      )}
      {saranJumlah > 0 && saranJumlah !== jumlah && (
        <button type="button" className="mt-2 text-[13px] text-emerald underline" onClick={() => setJumlah(saranJumlah)}>
          Pakai jumlah perkiraan tamu ({saranJumlah.toLocaleString("id-ID")})
        </button>
      )}
      <div className="rule-double mt-5 flex items-baseline justify-between pt-3">
        <span className="text-ink-2">Total</span>
        <span className="num text-[1.8rem] leading-none">{rp(total)}</span>
      </div>
      {budget != null && (
        <p className={`mt-1 text-right text-[13px] ${total > budget ? "text-alert" : "text-ink-3"}`}>
          {total > budget ? `Lewat budget ${rp(total - budget)}` : `Sisa budget ${rp(budget - total)}`} (budget {rp(budget)})
        </p>
      )}
      <div className="mt-4 flex items-center gap-3">
        <button type="button" className="btn" onClick={simpan} disabled={!berubah || pending}>{pending ? "Menyimpan…" : "Simpan angka ini"}</button>
        {msg && <span role="status" className="text-[13px] text-ink-2">{msg}</span>}
      </div>
    </div>
  );
}
