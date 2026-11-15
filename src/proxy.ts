import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { localDemo, localMode } from "./lib/env";
import { DEMO_WS_COOKIE, demoWsCookieOptions, isDemoWs, newDemoWs, wsCookieAction } from "./lib/demo";
import { buildCsp, isLocalHost, newNonce, securityRelaxedFlag } from "./lib/security/csp";
import { safeNextPath } from "./lib/security/url";
import { authCookieOptions } from "./lib/supabase/cookie-options";

/** Foto asli pasangan di public/: hanya untuk anggota (bukan tamu, bukan akun demo). */
const FOTO_ASLI = "/foto-kami.jpg";
/** Panduan pemakaian hanya untuk akun demo: akun asli mendapat 404 sungguhan (halaman juga memanggil notFound). */
const isPanduan = (path: string) => path === "/panduan" || path.startsWith("/panduan/");
const production = process.env.NODE_ENV === "production";
const relaxed = securityRelaxedFlag(process.env);

/**
 * Ruang demo per browser (cookie demo_ws, uuid v4 acak). demo: pasang kalau belum ada/rusak;
 * bukan demo: hapus. Cookie juga ditaruh di request supaya render request INI sudah melihatnya.
 */
function applyDemoWs(request: NextRequest, response: NextResponse, demo: boolean): NextResponse {
  const action = wsCookieAction(demo, request.cookies.get(DEMO_WS_COOKIE)?.value);
  if (action === "keep" || action === "none") return response;
  const ws = action === "set" ? newDemoWs() : null;
  if (ws) request.cookies.set(DEMO_WS_COOKIE, ws);
  else request.cookies.delete(DEMO_WS_COOKIE);
  const next = NextResponse.next({ request });
  for (const c of response.cookies.getAll()) next.cookies.set(c);
  if (ws) next.cookies.set(DEMO_WS_COOKIE, ws, demoWsCookieOptions(production));
  else next.cookies.delete(DEMO_WS_COOKIE);
  return next;
}

/**
 * CSP dengan nonce baru per request. Nonce ditaruh di header Content-Security-Policy REQUEST
 * (Next.js membacanya saat render dan menempelkannya ke script framework) dan di respons.
 * SECURITY_RELAXED=1 (darurat): tanpa CSP sama sekali.
 */
function prepareCsp(request: NextRequest): string | null {
  // header dari klien tidak pernah dipercaya
  request.headers.delete("x-nonce");
  request.headers.delete("content-security-policy");
  if (relaxed) return null;
  const nonce = newNonce();
  const csp = buildCsp({
    nonce,
    dev: process.env.NODE_ENV === "development",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    localHost: isLocalHost(request.nextUrl.hostname),
  });
  request.headers.set("x-nonce", nonce);
  request.headers.set("content-security-policy", csp);
  return csp;
}

function finish(res: NextResponse, csp: string | null, foto: boolean): NextResponse {
  if (csp) res.headers.set("Content-Security-Policy", csp);
  // foto pribadi: jangan pernah disimpan cache bersama (CDN/proxy)
  if (foto) res.headers.set("Cache-Control", "private, no-store, max-age=0");
  return res;
}

const notFound = () => new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/**
 * Refresh sesi Supabase dan arahkan tamu (belum login) ke /login.
 * Ini hanya pengecekan awal; otorisasi sebenarnya ada di RLS Postgres
 * dan di requireRepo() pada tiap halaman/aksi.
 */
export async function proxy(request: NextRequest) {
  const csp = prepareCsp(request);
  const foto = request.nextUrl.pathname === FOTO_ASLI;
  return finish(await handle(request, foto), csp, foto);
}

async function handle(request: NextRequest, foto: boolean): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const panduan = isPanduan(request.nextUrl.pathname);
  if (!url || !key) {
    // tanpa Supabase foto hanya untuk mode lokal data asli (production salah konfigurasi = 404)
    if (foto && (localDemo || !localMode)) return notFound();
    if (panduan && !localDemo) return notFound();
    if (localMode) return applyDemoWs(request, NextResponse.next({ request }), localDemo);
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookieOptions: authCookieOptions(production),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  const isLogin = request.nextUrl.pathname.startsWith("/login");
  if (!data?.claims && !isLogin) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    // kembali ke halaman semula setelah login (hanya path internal; divalidasi lagi saat login)
    const back = safeNextPath(request.nextUrl.pathname + request.nextUrl.search);
    to.search = back !== "/" && !foto ? `?next=${encodeURIComponent(back)}` : "";
    return NextResponse.redirect(to);
  }
  // is_penonton dipanggil paling banyak sekali per request, dan hanya kalau dibutuhkan
  let cek: Promise<{ data: unknown; error: unknown }> | null = null;
  const isPenonton = () => (cek ??= Promise.resolve(supabase.rpc("is_penonton")));
  if (foto && data?.claims) {
    // hanya anggota yang bukan akun demo; gagal cek apa pun = tolak
    const [{ data: penonton, error: e1 }, { data: anggota, error: e2 }] = await Promise.all([
      isPenonton(),
      supabase.rpc("is_anggota"),
    ]);
    if (e1 || e2 || penonton !== false || anggota !== true) return notFound();
  }
  if (panduan && data?.claims) {
    const { data: penonton, error } = await isPenonton();
    if (error || penonton !== true) return notFound();
  }
  // cookie ruang demo: hanya dicek kalau belum ada/rusak (cookie valid milik akun asli diabaikan repo
  // dan dihapus saat login). Akun asli tidak pernah dipasangi cookie ini.
  if (data?.claims && !isDemoWs(request.cookies.get(DEMO_WS_COOKIE)?.value)) {
    const { data: penonton, error } = await isPenonton();
    response = applyDemoWs(request, response, !error && penonton === true);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
