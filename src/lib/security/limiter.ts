import "server-only";
import { headers } from "next/headers";
import { supabaseConfigured } from "../env";
import { createClient } from "../supabase/server";
import { securityRelaxedFlag } from "./csp";
import { memoryLimiter, pickClientIp, RL_POLICIES, rlKeys, type RlScope } from "./ratelimit";

/**
 * Rate limit di server. Supabase dikonfigurasi: tabel public.rl_bucket lewat RPC rl_check/rl_hit
 * (berlaku lintas instance serverless). Fungsi belum ada (migrasi 20261117000000 belum dijalankan)
 * atau error lain: jatuh ke memori per instance (perlindungan sebagian, tidak pernah mengunci user).
 * SECURITY_RELAXED=1: semua pengecekan dilewati (darurat saja).
 */

const relaxed = securityRelaxedFlag(process.env);
const mem = memoryLimiter();
let rpcMissingLogged = false;

type Sb = Awaited<ReturnType<typeof createClient>>;

async function viaRpc(sb: Sb | null, fn: "rl_check" | "rl_hit", scope: RlScope, key: string): Promise<number | null> {
  if (!sb) return null;
  const { data, error } = await sb.rpc(fn, { p_scope: scope, p_key: key });
  if (error) {
    if (!rpcMissingLogged) {
      rpcMissingLogged = true;
      console.error(`[ratelimit] ${fn} gagal (${error.code ?? "?"}); memakai memori per instance. Jalankan migrasi 20261117000000_ratelimit.sql.`);
    }
    return null;
  }
  const n = Number(data);
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : 0;
}

async function client(sb?: Sb | null): Promise<Sb | null> {
  if (!supabaseConfigured) return null;
  return sb ?? (await createClient());
}

export async function rlCheck(scope: RlScope, key: string, sb?: Sb | null): Promise<number> {
  if (relaxed) return 0;
  const viaDb = await viaRpc(await client(sb), "rl_check", scope, key);
  return Math.max(viaDb ?? 0, mem.check(scope, key));
}

export async function rlHitServer(scope: RlScope, key: string, sb?: Sb | null): Promise<number> {
  if (relaxed) return 0;
  const viaDb = await viaRpc(await client(sb), "rl_hit", scope, key);
  if (viaDb !== null) return viaDb;
  return mem.hit(scope, key);
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return pickClientIp(h.get("x-real-ip"), h.get("x-forwarded-for"));
}

/** Penjaga login: cek jeda sebelum mencoba, catat kegagalan, bersihkan setelah berhasil. */
export async function loginGuard(email: string) {
  const ip = await clientIp();
  const keys: [RlScope, string][] = [
    ["login-ip", rlKeys.ip(ip)],
    ["login-email-ip", rlKeys.emailIp(email, ip)],
    ["login-email", rlKeys.email(email)],
  ];
  const sb = await client();
  return {
    async check() {
      const waits = await Promise.all(keys.map(([s, k]) => rlCheck(s, k, sb)));
      return Math.max(0, ...waits);
    },
    async fail() {
      await Promise.all(keys.map(([s, k]) => rlHitServer(s, k, sb)));
    },
    /** `authed`: klien yang SUDAH login (rl_clear_login hanya membersihkan kunci email pemilik sesi). */
    async success(authed: Sb | null) {
      if (relaxed) return;
      mem.clear("login-email-ip", keys[1][1]);
      mem.clear("login-email", keys[2][1]);
      if (authed) {
        const { error } = await authed.rpc("rl_clear_login", { p_ip: ip });
        if (error && !rpcMissingLogged) console.error("[ratelimit] rl_clear_login gagal", error.code);
      }
    },
  };
}

/** Penjaga aksi tulis akun demo (per IP). Hasil: detik tunggu, 0 = boleh. */
export async function demoWriteWait(): Promise<number> {
  return rlHitServer("demo-write", rlKeys.ip(await clientIp()));
}

/** Penjaga pembuatan ruang demo baru (per IP). */
export async function demoNewWsWait(): Promise<number> {
  return rlHitServer("demo-ws", rlKeys.ip(await clientIp()));
}

export { RL_POLICIES };
