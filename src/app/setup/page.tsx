import { connection } from "next/server";
import { redirect } from "next/navigation";
import { localMode, supabaseConfigured } from "@/lib/env";

export default async function Setup() {
  await connection();
  if (supabaseConfigured || localMode) redirect("/");
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <p className="eyebrow">Belum tersambung</p>
      <h1 className="display mt-3 text-[2.6rem]">Supabase belum diatur</h1>
      <p className="mt-4 text-ink-2">
        Isi <code>NEXT_PUBLIC_SUPABASE_URL</code> dan <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> di environment
        (Vercel: Project Settings → Environment Variables), lalu deploy ulang. Langkah lengkap ada di README.
      </p>
    </main>
  );
}
