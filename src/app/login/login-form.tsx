"use client";

import { useActionState } from "react";
import { signIn } from "../actions";
import { HONEYPOT_FIELD } from "@/lib/security/login";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      {/* jebakan bot: tidak terlihat dan tidak bisa difokus manusia; kalau terisi, login dianggap gagal */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={HONEYPOT_FIELD}>Jangan diisi</label>
        <input id={HONEYPOT_FIELD} name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-ink-2">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} className="input" />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-[13px] font-medium text-ink-2">Kata sandi</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={256} className="input" />
      </div>
      {state?.message && <p role="alert" className="text-[14px] text-alert">{state.message}</p>}
      <button className="btn btn-primary w-full justify-center" disabled={pending}>{pending ? "Masuk…" : "Masuk"}</button>
      <p className="text-[12.5px] text-ink-3">Hanya untuk dua akun yang sudah dibuat. Tidak ada pendaftaran.</p>
    </form>
  );
}
