import { connection } from "next/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { localMode, supabaseConfigured } from "@/lib/env";
import { safeNextPath } from "@/lib/security/url";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  if (!supabaseConfigured) redirect(localMode ? "/" : "/setup");
  // hanya path internal; URL luar / "//host" menjadi "/" (cegah open redirect)
  const next = safeNextPath((await searchParams).next);
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
      <p className="eyebrow">Catatan pernikahan</p>
      <h1 className="display mt-3 text-[3.2rem] leading-[0.95]">
        Tracker<br /><em className="text-emerald">Pernikahan</em>
      </h1>
      <p className="mt-4 text-[15px] text-ink-2">Catatan persiapan dan uang pernikahan. Masuk dulu.</p>
      <div className="rule my-8" />
      <LoginForm next={next === "/" ? undefined : next} />
    </main>
  );
}
