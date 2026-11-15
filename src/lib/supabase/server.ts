import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../env";
import { authCookieOptions } from "./cookie-options";

/**
 * Klien Supabase baru per request (tidak pernah di-cache lintas request).
 * `headers`: header tambahan untuk setiap request PostgREST, dipakai HANYA oleh akun demo
 * (x-demo-ws, lihat demoHeaders()). Akun asli selalu memanggil tanpa argumen.
 */
export async function createClient(headers?: Record<string, string>) {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    ...(headers && Object.keys(headers).length ? { global: { headers } } : {}),
    cookieOptions: authCookieOptions(process.env.NODE_ENV === "production"),
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Dipanggil dari Server Component: cookie di-refresh oleh proxy.ts.
        }
      },
    },
  });
}
