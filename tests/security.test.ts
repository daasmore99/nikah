import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { normalizeHttpUrl, safeHref, safeNextPath } from "../src/lib/security/url";
import { csvCell } from "../src/lib/security/csv";
import { buildCsp, isLocalHost, newNonce, securityRelaxedFlag, staticSecurityHeaders, supabaseOrigin } from "../src/lib/security/csp";
import { memoryLimiter, pesanTunggu, pickClientIp, RL_POLICIES, rlHit, rlKeys, rlRetryAfter, type RlState } from "../src/lib/security/ratelimit";
import { MIN_GAGAL_MS, sisaJeda } from "../src/lib/security/login";
import { validate } from "../src/lib/validate";
import { FIELDS } from "../src/lib/fields";
import { authCookieOptions } from "../src/lib/supabase/cookie-options";
import { demoWsCookieOptions } from "../src/lib/demo";

const root = join(__dirname, "..");

/* ---------------- URL ---------------- */

test("url: skema berbahaya ditolak saat validasi", () => {
  for (const bad of [
    "javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "java\tscript:alert(1)", "java\nscript:alert(1)",
    "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)", "file:///etc/passwd", "mailto:a@b.c",
    "https:", "https://", "http:/evil.com", "//evil.com", "​javascript:alert(1)", "https://exa mple.com",
    `https://a.com/${"x".repeat(2100)}`, "foo", "",
  ]) {
    assert.equal(normalizeHttpUrl(bad), null, bad);
  }
});

test("url: http/https dan domain polos diterima", () => {
  assert.equal(normalizeHttpUrl("https://tokopedia.com/x?y=1"), "https://tokopedia.com/x?y=1");
  assert.equal(normalizeHttpUrl("http://contoh.id"), "http://contoh.id");
  assert.equal(normalizeHttpUrl("instagram.com/vendor_x"), "https://instagram.com/vendor_x");
  assert.equal(normalizeHttpUrl("  shopee.co.id/abc  "), "https://shopee.co.id/abc");
});

test("url: validate() memakai aturan yang sama untuk field link", () => {
  const bad = validate(FIELDS.biaya_item, { grup: "Resepsi", nama: "x", link: "javascript:alert(document.cookie)" });
  assert.equal(bad.ok, false);
  const badV = validate(FIELDS.vendor, { kategori: "MUA", nama: "x", instagram_web: "data:text/html;base64,PHNjcmlwdD4=" });
  assert.equal(badV.ok, false);
  const ok = validate(FIELDS.biaya_item, { grup: "Resepsi", nama: "x", link: "tokoku.com/a" });
  assert.ok(ok.ok && ok.data.link === "https://tokoku.com/a");
});

test("url: safeHref saat render menolak data lama yang aneh", () => {
  assert.equal(safeHref("javascript:alert(1)"), null);
  assert.equal(safeHref("data:text/html,x"), null);
  assert.equal(safeHref("vbscript:x"), null);
  assert.equal(safeHref(" javascript:alert(1)"), null);
  assert.equal(safeHref("tokoku.com"), null); // tanpa skema = bukan href
  assert.equal(safeHref(null), null);
  assert.equal(safeHref(123), null);
  assert.equal(safeHref("https://tokoku.com/a"), "https://tokoku.com/a");
});

/* ---------------- redirect ---------------- */

test("redirect: hanya path internal", () => {
  for (const bad of [
    "https://evil.com", "//evil.com", "/\\evil.com", "\\\\evil.com", "/%2F%2Fevil.com/../", "javascript:alert(1)",
    "evil.com", "", null, undefined, 42, "/\t/evil.com", "/login", "/login?next=/x",
  ]) {
    const r = safeNextPath(bad);
    assert.ok(r.startsWith("/") && !r.startsWith("//") && !r.includes("evil.com") || r === "/", String(bad));
    assert.ok(!r.startsWith("/login"), String(bad));
  }
  assert.equal(safeNextPath("https://evil.com"), "/");
  assert.equal(safeNextPath("//evil.com"), "/");
  assert.equal(safeNextPath("/biaya"), "/biaya");
  assert.equal(safeNextPath("/tamu?f=1"), "/tamu?f=1");
});

/* ---------------- CSV ---------------- */

test("csv: formula injection di-escape", () => {
  assert.equal(csvCell("=HYPERLINK(\"http://x\",\"klik\")"), `"'=HYPERLINK(""http://x"",""klik"")"`);
  assert.equal(csvCell("+1+1"), "'+1+1");
  assert.equal(csvCell("-2+3"), "'-2+3");
  assert.equal(csvCell("@SUM(A1)"), "'@SUM(A1)");
  assert.equal(csvCell("\t=1"), "'\t=1");
  assert.equal(csvCell("\r=1"), `"'\r=1"`);
  assert.equal(csvCell("=1;2"), `"'=1;2"`);
});

test("csv: nilai biasa tidak berubah", () => {
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(undefined), "");
  assert.equal(csvCell(150000), "150000");
  assert.equal(csvCell(-5), "-5"); // angka asli bukan formula
  assert.equal(csvCell(true), "true");
  assert.equal(csvCell("Gedung, Aula"), `"Gedung, Aula"`);
  assert.equal(csvCell('a "b"'), `"a ""b"""`);
  assert.equal(csvCell("Rp 1.000"), "Rp 1.000");
});

/* ---------------- CSP & header ---------------- */

test("csp: nonce unik per request dan berformat aman", () => {
  const set = new Set(Array.from({ length: 500 }, () => newNonce()));
  assert.equal(set.size, 500);
  for (const n of set) assert.match(n, /^[A-Za-z0-9+/]{22}==$/);
});

test("csp: production ketat", () => {
  const nonce = newNonce();
  const csp = buildCsp({ nonce, dev: false, supabaseUrl: "https://abcdefgh.supabase.co" });
  const d = Object.fromEntries(csp.split("; ").map((p) => [p.split(" ")[0], p.split(" ").slice(1)]));
  assert.deepEqual(d["default-src"], ["'self'"]);
  assert.ok(d["script-src"].includes(`'nonce-${nonce}'`));
  assert.ok(d["script-src"].includes("'strict-dynamic'"));
  assert.ok(!d["script-src"].includes("'unsafe-eval'"));
  assert.ok(!d["script-src"].includes("'unsafe-inline'"));
  assert.deepEqual(d["object-src"], ["'none'"]);
  assert.deepEqual(d["frame-ancestors"], ["'none'"]);
  assert.deepEqual(d["base-uri"], ["'self'"]);
  assert.deepEqual(d["form-action"], ["'self'"]);
  assert.ok(d["connect-src"].includes("https://abcdefgh.supabase.co"));
  assert.ok(d["connect-src"].includes("https://va.vercel-scripts.com"));
  assert.ok("upgrade-insecure-requests" in d);
  assert.ok(!csp.includes("*"));
  // uji next start di localhost (http): tanpa upgrade, sisanya sama ketat
  const local = buildCsp({ nonce, dev: false, localHost: true });
  assert.ok(!local.includes("upgrade-insecure-requests"));
  assert.ok(!local.includes("'unsafe-eval'"));
  assert.equal(isLocalHost("localhost"), true);
  assert.equal(isLocalHost("127.0.0.1:3000"), true);
  assert.equal(isLocalHost("zalfananda.my.id"), false);
  assert.equal(isLocalHost("localhost.evil.com"), false);
});

test("csp: dev boleh eval & websocket HMR, tanpa upgrade-insecure-requests", () => {
  const csp = buildCsp({ nonce: newNonce(), dev: true });
  assert.match(csp, /script-src [^;]*'unsafe-eval'/);
  assert.match(csp, /connect-src [^;]* ws:/);
  assert.ok(!csp.includes("upgrade-insecure-requests"));
});

test("csp: nonce tidak valid ditolak; URL supabase hanya https", () => {
  assert.throws(() => buildCsp({ nonce: "abc'; script-src *", dev: false }));
  assert.equal(supabaseOrigin("http://x.supabase.co"), null);
  assert.equal(supabaseOrigin("bukan url"), null);
  assert.equal(supabaseOrigin("https://x.supabase.co/rest/v1"), "https://x.supabase.co");
});

test("header statis: HSTS 2 tahun di production, perlindungan dasar lengkap", () => {
  const prod = Object.fromEntries(staticSecurityHeaders(true).map((h) => [h.key, h.value]));
  assert.equal(prod["Strict-Transport-Security"], "max-age=63072000; includeSubDomains");
  assert.equal(prod["X-Frame-Options"], "DENY");
  assert.equal(prod["X-Content-Type-Options"], "nosniff");
  assert.equal(prod["Cross-Origin-Opener-Policy"], "same-origin");
  for (const f of ["camera=()", "microphone=()", "geolocation=()", "payment=()"]) assert.ok(prod["Permissions-Policy"].includes(f));
  const dev = Object.fromEntries(staticSecurityHeaders(false).map((h) => [h.key, h.value]));
  assert.equal(dev["Strict-Transport-Security"], undefined);
});

test("SECURITY_RELAXED hanya aktif kalau persis '1'", () => {
  assert.equal(securityRelaxedFlag({}), false);
  assert.equal(securityRelaxedFlag({ SECURITY_RELAXED: "true" }), false);
  assert.equal(securityRelaxedFlag({ SECURITY_RELAXED: "1" }), true);
});

test("cookie: sesi Supabase & demo_ws httpOnly, secure di production, sameSite lax", () => {
  for (const o of [authCookieOptions(true), demoWsCookieOptions(true)]) {
    assert.equal(o.httpOnly, true);
    assert.equal(o.secure, true);
    assert.equal(o.sameSite, "lax");
  }
  assert.equal(authCookieOptions(false).secure, false);
});

/* ---------------- rate limiter ---------------- */

test("ratelimit: 5 login gagal per email+IP lalu jeda, jeda membesar, tidak permanen", () => {
  const p = RL_POLICIES["login-email-ip"];
  let s: RlState | undefined;
  let now = 1_000_000;
  for (let i = 1; i <= 4; i++) {
    const r = rlHit(s, p, now);
    s = r.state;
    assert.equal(r.retryAfterSec, 0, `gagal ke-${i} belum dijeda`);
  }
  let r = rlHit(s, p, now);
  s = r.state;
  assert.equal(r.retryAfterSec, 60); // gagal ke-5 -> jeda 1 menit
  assert.equal(rlRetryAfter(s, now + 30_000), 30);
  // selama dijeda, hit tidak menambah strike
  assert.equal(rlHit(s, p, now + 1000).state.strikes, 1);
  // setelah jeda habis: 5 gagal lagi -> 2 menit, lalu 4 menit
  now += 61_000;
  for (let i = 0; i < 4; i++) s = rlHit(s, p, now).state;
  r = rlHit(s, p, now);
  s = r.state;
  assert.equal(r.retryAfterSec, 120);
  now += 121_000;
  for (let i = 0; i < 4; i++) s = rlHit(s, p, now).state;
  r = rlHit(s, p, now);
  assert.equal(r.retryAfterSec, 240);
  // maksimal tetap terbatas
  let t: RlState = { hits: 0, windowStart: now, strikes: 50, blockedUntil: 0 };
  for (let i = 0; i < 5; i++) t = rlHit(t, p, now).state;
  assert.equal(rlRetryAfter(t, now), p.maxBlockSec);
  // strike kembali 0 setelah sehari tenang
  const later = now + 2 * 24 * 3600 * 1000;
  assert.equal(rlHit(t, p, later).state.strikes, 0);
});

test("ratelimit: jendela waktu mereset hitungan", () => {
  const p = RL_POLICIES["login-email-ip"];
  let s: RlState | undefined;
  for (let i = 0; i < 4; i++) s = rlHit(s, p, 0).state;
  const r = rlHit(s, p, p.windowSec * 1000 + 1);
  assert.equal(r.retryAfterSec, 0);
  assert.equal(r.state.hits, 1);
});

test("ratelimit: penyimpanan memori terbatas & kunci terpisah", () => {
  let now = 0;
  const m = memoryLimiter(3, () => now);
  for (let i = 0; i < 5; i++) m.hit("login-email-ip", `k${i}`);
  assert.equal(m.size(), 3);
  for (let i = 0; i < 5; i++) m.hit("login-email-ip", "a");
  assert.ok(m.check("login-email-ip", "a") > 0);
  assert.equal(m.check("login-email-ip", "b"), 0);
  m.clear("login-email-ip", "a");
  assert.equal(m.check("login-email-ip", "a"), 0);
  now += 1;
});

test("ratelimit: kebijakan sesuai SQL migrasi", () => {
  const sql = readFileSync(join(root, "supabase", "migrations", "20261117000000_ratelimit.sql"), "utf8");
  for (const [scope, p] of Object.entries(RL_POLICIES)) {
    const re = new RegExp(`\\('${scope}',\\s*${p.limit},\\s*${p.windowSec},\\s*${p.blockSec},\\s*${p.maxBlockSec}\\)`);
    assert.match(sql, re, scope);
  }
  // kunci hash sama bentuknya dengan rl_clear_login
  assert.match(sql, /'e:' \|\| v_email/);
  assert.match(sql, /'ei:' \|\| v_email \|\| '\|' \|\| p_ip/);
  assert.match(rlKeys.email(" A@B.id "), /^[0-9a-f]{64}$/);
  assert.equal(rlKeys.email(" A@B.id "), rlKeys.email("a@b.id"));
  assert.notEqual(rlKeys.emailIp("a@b.id", "1.1.1.1"), rlKeys.emailIp("a@b.id", "1.1.1.2"));
});

test("migrasi keamanan: aman dijalankan ulang & tidak menyentuh data asli", () => {
  const sql = readFileSync(join(root, "supabase", "migrations", "20261117000000_ratelimit.sql"), "utf8");
  const kode = sql.replace(/--.*$/gm, "");
  assert.doesNotMatch(kode, /drop\s+(schema|table)|truncate\s/i);
  assert.doesNotMatch(kode, /\b(delete\s+from|update)\s+public\.(?!rl_bucket\b|demo_)/i);
  // setiap fungsi security definer punya search_path tetap
  for (const m of kode.matchAll(/create or replace function ([\w.]+)\([^)]*\)[\s\S]*?as \$\$/gi)) {
    if (/security definer/i.test(m[0])) assert.match(m[0], /set search_path =/, m[1]);
  }
  // tabel rate limit tertutup total untuk API
  assert.match(kode, /alter table public\.rl_bucket enable row level security/);
  assert.match(kode, /revoke all on public\.rl_bucket from public, anon, authenticated/);
  assert.doesNotMatch(kode, /grant [^;]* on public\.rl_bucket/i);
  // rl_clear_login hanya untuk user login
  assert.match(kode, /revoke all on function public\.rl_clear_login\(text\) from public, anon/);
  assert.equal((sql.match(/^-- ===================== BAGIAN \d/gm) ?? []).length, 4);
});

test("ratelimit: IP klien dari header Vercel, nilai aneh diabaikan", () => {
  assert.equal(pickClientIp("203.0.113.7", "1.2.3.4"), "203.0.113.7");
  assert.equal(pickClientIp(null, "198.51.100.1, 10.0.0.1"), "198.51.100.1");
  assert.equal(pickClientIp(null, "2001:db8::1"), "2001:db8::1");
  assert.equal(pickClientIp("<script>", "x y"), "unknown");
  assert.equal(pickClientIp(null, null), "unknown");
  assert.equal(pesanTunggu(61), "Terlalu banyak percobaan masuk. Coba lagi dalam 2 menit.");
  assert.equal(pesanTunggu(5), "Terlalu banyak percobaan masuk. Coba lagi dalam 1 menit.");
});

test("login: waktu respons gagal diseragamkan", () => {
  assert.equal(sisaJeda(0, 0, 0), MIN_GAGAL_MS);
  assert.equal(sisaJeda(0, 100, 50), MIN_GAGAL_MS + 50 - 100);
  assert.equal(sisaJeda(0, 5000, 100), 0);
  assert.equal(sisaJeda(0, 0, 9999), MIN_GAGAL_MS + 250);
});

/* ---------------- validasi input ---------------- */

test("validasi: input bukan objek & teks kepanjangan ditolak", () => {
  assert.equal(validate(FIELDS.tamu, null as never).ok, false);
  assert.equal(validate(FIELDS.tamu, [] as never).ok, false);
  assert.equal(validate(FIELDS.tamu, "x" as never).ok, false);
  assert.equal(validate(FIELDS.tamu, { nama: "x".repeat(2001) }).ok, false);
  assert.equal(validate(FIELDS.biaya_item, { grup: "Resepsi", nama: "emas", gram_emas: "9999999" }).ok, false);
  assert.equal(validate(FIELDS.tamu, { nama: "Budi", __proto__x: "y" }).ok, true);
});

/* ---------------- statis: kode ---------------- */

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const sourceFiles = [...walk(join(root, "src")), join(root, "next.config.ts"), ...walk(join(root, "scripts"))].filter((f) =>
  /\.(ts|tsx|js|mjs)$/.test(f),
);

test("statis: tidak ada service_role / secret key di kode", () => {
  for (const f of [...sourceFiles, join(root, ".env.example")]) {
    const s = readFileSync(f, "utf8");
    assert.doesNotMatch(s, /service_role|SERVICE_ROLE|sb_secret_|sbp_[A-Za-z0-9]{20,}|eyJhbGciOi[A-Za-z0-9_-]{20,}/, relative(root, f));
  }
});

test("statis: tidak ada dangerouslySetInnerHTML / eval / innerHTML", () => {
  for (const f of sourceFiles) {
    const s = readFileSync(f, "utf8");
    assert.doesNotMatch(s, /dangerouslySetInnerHTML|\beval\(|new Function\(|\.innerHTML\s*=|document\.write/, relative(root, f));
  }
});

test("statis: env publik hanya URL & anon key Supabase", () => {
  for (const f of sourceFiles) {
    const s = readFileSync(f, "utf8");
    for (const m of s.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) {
      assert.ok(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"].includes(m[0]), `${relative(root, f)}: ${m[0]}`);
    }
  }
});

test("statis: semua aksi tulis lewat writeRepo (sesi + rate limit demo)", () => {
  const s = readFileSync(join(root, "src", "app", "actions.ts"), "utf8");
  assert.doesNotMatch(s, /await requireRepo\(\);\s*\n\s*await repo\.(insert|update|remove|insertMany|updateMany|removeMany|updatePengaturan|resetDemo)/);
  const tulis = ["createRow", "updateRow", "deleteRow", "createRows", "updateRows", "deleteRows", "updatePengaturan", "resetDemo"];
  for (const fn of tulis) {
    const body = s.slice(s.indexOf(`export async function ${fn}(`));
    const next = body.indexOf("\nexport async function", 10);
    assert.match(next > 0 ? body.slice(0, next) : body, /await writeRepo\(\)/, fn);
  }
  // tidak ada tabel dari input yang langsung dipakai tanpa assertTable
  assert.equal((s.match(/assertTable\(table\)/g) ?? []).length, 6);
});

test("statis: proxy memasang CSP & foto hanya untuk anggota", () => {
  const s = readFileSync(join(root, "src", "proxy.ts"), "utf8");
  assert.match(s, /request\.headers\.set\("content-security-policy", csp\)/);
  assert.match(s, /res\.headers\.set\("Content-Security-Policy", csp\)/);
  assert.match(s, /penonton !== false \|\| anggota !== true\) return notFound\(\)/);
});
