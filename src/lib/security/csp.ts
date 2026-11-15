/**
 * Header keamanan (logika murni, tanpa server-only, supaya bisa dites).
 *
 * CSP memakai nonce per request (dibuat di proxy.ts). Next.js membaca nonce dari header
 * Content-Security-Policy pada request lalu menempelkannya ke semua <script> framework.
 * Script yang dibuat oleh script ber-nonce (mis. Vercel Analytics) diizinkan lewat 'strict-dynamic'.
 *
 * Gaya: 'unsafe-inline' tetap diizinkan untuk style karena React merender atribut style="..."
 * (lebar bar progres, delay animasi). Risiko injeksi CSS jauh lebih kecil daripada script, dan
 * nonce untuk style akan mematikan atribut style di browser yang belum mengenal style-src-attr.
 */

/** Darurat saja: SECURITY_RELAXED=1 mematikan CSP dan pembatasan laju. Default mati. */
export function securityRelaxedFlag(env: Record<string, string | undefined>) {
  return env.SECURITY_RELAXED === "1";
}

/** 16 byte acak, base64. Harus unik per request. */
export function newNonce(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** Origin https dari URL Supabase di env (atau null kalau kosong/tidak valid). */
export function supabaseOrigin(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.origin : null;
  } catch {
    return null;
  }
}

const VERCEL_SCRIPTS = "https://va.vercel-scripts.com";

/** localhost / 127.0.0.1 / [::1] (uji `next start` lokal lewat http): tanpa upgrade-insecure-requests. */
export function isLocalHost(host: string | null | undefined): boolean {
  const h = (host ?? "").toLowerCase().replace(/:\d+$/, "");
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".localhost");
}

export function buildCsp({ nonce, dev, supabaseUrl, localHost = false }: {
  nonce: string; dev: boolean; supabaseUrl?: string | null; localHost?: boolean;
}): string {
  if (!/^[A-Za-z0-9+/=]{16,64}$/.test(nonce)) throw new Error("nonce tidak valid");
  const supa = supabaseOrigin(supabaseUrl);
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'self' + host hanya cadangan untuk browser lama; browser CSP3 memakai nonce + strict-dynamic
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", VERCEL_SCRIPTS, ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      VERCEL_SCRIPTS,
      ...(supa ? [supa, supa.replace(/^https:/, "wss:")] : []),
      ...(dev ? ["ws:"] : []), // HMR next dev
    ],
    "media-src": ["'self'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!dev && !localHost) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/**
 * Header statis untuk semua respons (dipasang lewat next.config.ts, termasuk aset _next/static).
 * HSTS hanya di production (di localhost http tidak berarti apa-apa).
 */
export function staticSecurityHeaders(production: boolean): { key: string; value: string }[] {
  return [
    ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    // same-origin lebih ketat dari strict-origin-when-cross-origin: link keluar tidak membawa referrer sama sekali
    { key: "Referrer-Policy", value: "same-origin" },
    {
      key: "Permissions-Policy",
      value: [
        "accelerometer=()", "autoplay=()", "camera=()", "display-capture=()", "encrypted-media=()", "fullscreen=(self)",
        "geolocation=()", "gyroscope=()", "hid=()", "magnetometer=()", "microphone=()", "midi=()", "payment=()",
        "picture-in-picture=()", "publickey-credentials-get=()", "screen-wake-lock=()", "serial=()", "usb=()",
        "xr-spatial-tracking=()", "browsing-topics=()",
      ].join(", "),
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
    { key: "X-Robots-Tag", value: "noindex, nofollow" },
  ];
}
