import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { localDemo, localMode } from "./lib/env";
import { DEMO_WS_COOKIE, demoWsCookieOptions, isDemoWs, newDemoWs, wsCookieAction } from "./lib/demo";

/** Foto asli pasangan di public/: tidak boleh terbuka untuk akun demo. */
const FOTO_ASLI = "/foto-kami.jpg";
const notFound = () => new NextResponse("Not found", { status: 404 });
/** Panduan pemakaian hanya untuk akun demo: akun asli mendapat 404 sungguhan (halaman juga memanggil notFound). */
const isPanduan = (path: string) => path === "/panduan" || path.startsWith("/panduan/");

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
  if (ws) next.cookies.set(DEMO_WS_COOKIE, ws, demoWsCookieOptions(process.env.NODE_ENV === "production"));
  else next.cookies.delete(DEMO_WS_COOKIE);
  return next;
}

/**
 * Refresh sesi Supabase dan arahkan tamu (belum login) ke /login.
 * Ini hanya pengecekan awal; otorisasi sebenarnya ada di RLS Postgres
 * dan di requireUser() pada tiap halaman/aksi.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const foto = request.nextUrl.pathname === FOTO_ASLI;
  const panduan = isPanduan(request.nextUrl.pathname);
  if (!url || !key) {
    if (foto && localDemo) return notFound();
    if (panduan && !localDemo) return notFound();
    if (localMode) return applyDemoWs(request, NextResponse.next({ request }), localDemo);
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
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
    to.search = "";
    return NextResponse.redirect(to);
  }
  // is_penonton dipanggil paling banyak sekali per request, dan hanya kalau dibutuhkan
  let cek: Promise<{ data: unknown; error: unknown }> | null = null;
  const isPenonton = () => (cek ??= Promise.resolve(supabase.rpc("is_penonton")));
  if (foto && data?.claims) {
    // akun demo (terdaftar di penonton) tidak boleh mengambil foto asli; gagal cek = tolak juga
    const { data: penonton, error } = await isPenonton();
    if (error || penonton === true) {
      const { data: anggota } = await supabase.rpc("is_anggota");
      if (penonton === true || anggota !== true) return notFound();
    }
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
