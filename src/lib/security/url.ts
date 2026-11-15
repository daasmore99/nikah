/**
 * URL dari isian user (field `link`, `instagram_web`) dan redirect internal. Logika murni.
 * Hanya http/https yang pernah disimpan atau dirender sebagai href: javascript:, data:, vbscript:,
 * file:, dsb. ditolak.
 */

export const MAX_URL = 2048;

// kontrol, spasi, dan karakter tak kasatmata yang sering dipakai untuk menyamarkan skema
const BAD_CHARS = new RegExp("[\\s\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u200b-\\u200f\\u2028\\u2029\\ufeff]");
const SCHEME = /^([a-z][a-z0-9+-]*):/i;
const BARE_DOMAIN = /^[\w.-]+\.[a-z]{2,}(?::\d{1,5})?(\/\S*)?$/i;

/**
 * Normalisasi input link: "tokoku.com/x" -> "https://tokoku.com/x"; http(s) dipertahankan.
 * Hasil null = tidak valid (skema lain, terlalu panjang, karakter aneh, tidak bisa di-parse).
 */
export function normalizeHttpUrl(input: string): string | null {
  const s = input.trim();
  if (!s || s.length > MAX_URL || BAD_CHARS.test(s)) return null;
  const scheme = SCHEME.exec(s)?.[1]?.toLowerCase();
  let candidate: string;
  if (scheme === "http" || scheme === "https") {
    if (!/^https?:\/\/[^/]/i.test(s)) return null;
    candidate = s;
  } else if (scheme && !BARE_DOMAIN.test(s)) {
    return null; // javascript:, data:, vbscript:, mailto:, file:, ...
  } else if (BARE_DOMAIN.test(s)) {
    candidate = `https://${s}`;
  } else {
    return null;
  }
  return safeHref(candidate);
}

/** Untuk href: kembalikan URL hanya kalau benar-benar http/https. Data lama/impor yang aneh -> null. */
export function safeHref(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > MAX_URL || BAD_CHARS.test(s) || !/^https?:\/\//i.test(s)) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname) return null;
    return s;
  } catch {
    return null;
  }
}

/**
 * Path tujuan setelah login (parameter `next`): hanya path internal yang diawali satu "/".
 * Menolak "//evil.com", "/\\evil.com", "https://...", skema, dan karakter kontrol. Default "/".
 */
export function safeNextPath(v: unknown): string {
  if (typeof v !== "string") return "/";
  const s = v.trim();
  if (!s.startsWith("/") || s.startsWith("//") || s.startsWith("/\\") || s.length > 512) return "/";
  if (BAD_CHARS.test(s) || s.includes("\\")) return "/";
  try {
    const u = new URL(s, "http://x.invalid");
    if (u.origin !== "http://x.invalid") return "/";
    if (u.pathname.startsWith("/login")) return "/";
    return u.pathname + u.search;
  } catch {
    return "/";
  }
}
