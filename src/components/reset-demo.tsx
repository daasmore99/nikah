"use client";

import { useState, useTransition } from "react";
import { resetDemo } from "@/app/actions";

/** Reset ruang demo ke contoh awal, dua langkah: tombol -> konfirmasi (ketik RESET) -> jalankan. */
export function ResetDemo() {
  const [step, setStep] = useState<"idle" | "confirm">("idle");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      const r = await resetDemo(text.trim());
      if (r.ok) {
        setMsg({ ok: true, text: "Data demo sudah dikembalikan ke contoh awal." });
        setStep("idle");
        setText("");
      } else setMsg({ ok: false, text: r.message });
    });

  if (step === "idle")
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn" onClick={() => { setStep("confirm"); setMsg(null); }}>Reset data demo…</button>
        {msg && <span role="status" className={`text-[14px] ${msg.ok ? "text-emerald" : "text-alert"}`}>{msg.text}</span>}
      </div>
    );

  return (
    <div className="max-w-[32rem] border border-clay/40 bg-clay-tint px-4 py-4">
      <p className="text-[14px] text-ink">Kembalikan ke contoh awal?</p>
      <p className="mt-1 text-[13px] text-ink-2">Semua isian di browser ini dihapus, lalu diisi lagi dengan contoh awal.</p>
      <label htmlFor="reset-konfirmasi" className="mt-3 mb-1.5 block text-[13px] font-medium text-ink-2">
        Ketik <span className="num">RESET</span> untuk melanjutkan
      </label>
      <input id="reset-konfirmasi" className="input max-w-[12rem]" value={text} autoComplete="off" onChange={(e) => setText(e.target.value)} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={text.trim() !== "RESET" || pending} onClick={run}>
          {pending ? "Mereset…" : "Ya, kembalikan ke contoh awal"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => { setStep("idle"); setText(""); }}>Batal</button>
        {msg && !msg.ok && <span role="status" className="text-[14px] text-alert">{msg.text}</span>}
      </div>
    </div>
  );
}
