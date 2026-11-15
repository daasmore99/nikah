import "server-only";
import { cookies } from "next/headers";
import { DEMO_WS_COOKIE, DEMO_WS_HILANG, demoWsCookieOptions, isDemoWs, newDemoWs } from "./demo";
import { RepoError } from "./repo-types";

const production = process.env.NODE_ENV === "production";

/**
 * uuid ruang demo browser ini (cookie demo_ws, biasanya dipasang proxy.ts).
 * Cookie tidak ada/rusak: di Server Function cookie baru dipasang di sini; di Server Component
 * cookie tidak bisa ditulis, jadi gagal dengan pesan ramah. Tidak pernah jalan tanpa ws.
 * Hanya dipanggil untuk mode demo.
 */
export async function demoWs(): Promise<string> {
  const store = await cookies();
  const cur = store.get(DEMO_WS_COOKIE)?.value;
  if (isDemoWs(cur)) return cur;
  const ws = newDemoWs();
  try {
    store.set(DEMO_WS_COOKIE, ws, demoWsCookieOptions(production));
  } catch {
    throw new RepoError(DEMO_WS_HILANG);
  }
  return ws;
}

/** Setelah login: akun demo dipastikan punya ruang; akun asli tidak pernah membawa cookie demo_ws. */
export async function syncDemoWsCookie(demo: boolean) {
  const store = await cookies();
  if (demo) await demoWs();
  else if (store.has(DEMO_WS_COOKIE)) store.delete(DEMO_WS_COOKIE);
}
