/**
 * Opsi cookie sesi Supabase. Aplikasi ini hanya memakai klien Supabase di SERVER (proxy, Server
 * Component, Server Action), jadi cookie sesi boleh httpOnly: JavaScript di browser (termasuk
 * script sisipan kalau ada XSS) tidak bisa membaca token. secure di production, sameSite lax
 * (strict akan membuat link dari WhatsApp dll. tampak belum login di klik pertama).
 */
export function authCookieOptions(production: boolean) {
  return { path: "/", sameSite: "lax" as const, httpOnly: true, secure: production };
}
