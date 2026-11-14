"use client";

import { useActionState } from "react";
import { signIn } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-ink-2">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-[13px] font-medium text-ink-2">Kata sandi</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
      </div>
      {state?.message && <p role="alert" className="text-[14px] text-alert">{state.message}</p>}
      <button className="btn btn-primary w-full justify-center" disabled={pending}>{pending ? "Masuk…" : "Masuk"}</button>
      <p className="text-[12.5px] text-ink-3">Hanya untuk dua akun yang sudah dibuat. Tidak ada pendaftaran.</p>
    </form>
  );
}
