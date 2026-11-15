/**
 * Pembatasan laju (rate limit): logika murni, sama persis dengan fungsi SQL public.rl_hit di
 * supabase/migrations/20261117000000_ratelimit.sql. Dipakai juga sebagai penyimpanan memori
 * (mode lokal, atau cadangan per instance kalau migrasi belum dijalankan).
 *
 * Model: tiap (scope, key) menghitung kejadian dalam jendela waktu. Begitu jumlahnya mencapai
 * `limit`, key dijeda selama blockSec * 2^strikes (maks. maxBlockSec), lalu hitungan mulai lagi.
 * strikes kembali 0 setelah 24 jam tanpa jeda baru. Tidak pernah ada kunci permanen.
 */
import { createHash } from "node:crypto";

export interface RlPolicy {
  /** kejadian ke-`limit` dalam jendela memicu jeda */
  limit: number;
  windowSec: number;
  blockSec: number;
  maxBlockSec: number;
}

export const RL_POLICIES = {
  /** login gagal per IP (NAT rumah/kantor bisa berbagi IP, jadi lebih longgar) */
  "login-ip": { limit: 20, windowSec: 15 * 60, blockSec: 5 * 60, maxBlockSec: 60 * 60 },
  /** login gagal per kombinasi email + IP: 5 gagal / 15 menit, lalu jeda 1, 2, 4, ... menit (maks. 30) */
  "login-email-ip": { limit: 5, windowSec: 15 * 60, blockSec: 60, maxBlockSec: 30 * 60 },
  /** login gagal per email dari IP mana pun (credential stuffing tersebar) */
  "login-email": { limit: 30, windowSec: 15 * 60, blockSec: 5 * 60, maxBlockSec: 30 * 60 },
  /** aksi tulis akun demo per IP */
  "demo-write": { limit: 150, windowSec: 10 * 60, blockSec: 5 * 60, maxBlockSec: 30 * 60 },
  /** ruang demo baru per IP (tiap ruang baru = 1 baris pengaturan + kerangka contoh) */
  "demo-ws": { limit: 10, windowSec: 60 * 60, blockSec: 60 * 60, maxBlockSec: 6 * 60 * 60 },
} as const satisfies Record<string, RlPolicy>;

export type RlScope = keyof typeof RL_POLICIES;
export const RL_SCOPES = Object.keys(RL_POLICIES) as RlScope[];

/** Semua waktu dalam milidetik epoch. */
export interface RlState {
  hits: number;
  windowStart: number;
  strikes: number;
  blockedUntil: number;
}

const DAY = 24 * 60 * 60 * 1000;

/** Detik tunggu kalau sedang dijeda, 0 kalau boleh. */
export function rlRetryAfter(state: RlState | undefined, now: number): number {
  if (!state || state.blockedUntil <= now) return 0;
  return Math.ceil((state.blockedUntil - now) / 1000);
}

/** Catat satu kejadian. Hasil retryAfterSec > 0 = key sedang/baru saja dijeda. */
export function rlHit(prev: RlState | undefined, p: RlPolicy, now: number): { state: RlState; retryAfterSec: number } {
  const s: RlState = prev ? { ...prev } : { hits: 0, windowStart: now, strikes: 0, blockedUntil: 0 };
  if (s.blockedUntil > now) return { state: s, retryAfterSec: rlRetryAfter(s, now) };
  if (now - s.windowStart >= p.windowSec * 1000) {
    if (now - s.windowStart >= DAY) s.strikes = 0;
    s.hits = 0;
    s.windowStart = now;
  }
  s.hits += 1;
  if (s.hits >= p.limit) {
    const block = Math.min(p.maxBlockSec, p.blockSec * 2 ** Math.min(s.strikes, 20));
    s.blockedUntil = now + block * 1000;
    s.strikes += 1;
    s.hits = 0;
    s.windowStart = now;
    return { state: s, retryAfterSec: block };
  }
  return { state: s, retryAfterSec: 0 };
}

/** Penyimpanan memori sederhana (per proses / per instance serverless), dibatasi ukurannya. */
export function memoryLimiter(max = 5000, clock: () => number = Date.now) {
  const m = new Map<string, RlState>();
  const id = (scope: RlScope, key: string) => `${scope}:${key}`;
  return {
    check(scope: RlScope, key: string) {
      return rlRetryAfter(m.get(id(scope, key)), clock());
    },
    hit(scope: RlScope, key: string) {
      const k = id(scope, key);
      const r = rlHit(m.get(k), RL_POLICIES[scope], clock());
      m.delete(k);
      if (m.size >= max) m.delete(m.keys().next().value!); // buang yang paling lama
      m.set(k, r.state);
      return r.retryAfterSec;
    },
    clear(scope: RlScope, key: string) {
      m.delete(id(scope, key));
    },
    size: () => m.size,
  };
}

/* ---------------- kunci (di-hash: tabel tidak menyimpan email/IP mentah) ---------------- */

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
/** Bentuk harus sama dengan rl_clear_login() di SQL. */
export const rlKeys = {
  ip: (ip: string) => sha(`ip:${ip}`),
  email: (email: string) => sha(`e:${email.trim().toLowerCase()}`),
  emailIp: (email: string, ip: string) => sha(`ei:${email.trim().toLowerCase()}|${ip}`),
};

/**
 * IP klien. Di Vercel, x-real-ip dan x-forwarded-for diisi ulang oleh edge Vercel (tidak bisa
 * dipalsukan klien). Di host lain header ini BISA dipalsukan: jangan andalkan di luar Vercel.
 */
export function pickClientIp(realIp: string | null | undefined, forwardedFor: string | null | undefined): string {
  const ok = (v: string | undefined | null) => (v && /^[0-9a-fA-F:.]{2,45}$/.test(v.trim()) ? v.trim() : null);
  return ok(realIp) ?? ok(forwardedFor?.split(",")[0]) ?? "unknown";
}

/** Pesan ramah untuk jeda. */
export function pesanTunggu(detik: number, apa = "percobaan masuk"): string {
  const menit = Math.max(1, Math.ceil(detik / 60));
  return `Terlalu banyak ${apa}. Coba lagi dalam ${menit} menit.`;
}
