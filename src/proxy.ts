import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { localDemo } from "./lib/env";

/** Foto asli pasangan di public/: tidak boleh terbuka untuk akun demo. */
const FOTO_ASLI = "/foto-kami.jpg";
const notFound = () => new NextResponse("Not found", { status: 404 });

/**
 * Refresh sesi Supabase dan arahkan tamu (belum login) ke /login.
 * Ini hanya pengecekan awal; otorisasi sebenarnya ada di RLS Postgres
 * dan di requireUser() pada tiap halaman/aksi.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const foto = request.nextUrl.pathname === FOTO_ASLI;
  if (!url || !key) return foto && localDemo ? notFound() : NextResponse.next();

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
  if (foto && data?.claims) {
    // akun demo (terdaftar di penonton) tidak boleh mengambil foto asli; gagal cek = tolak juga
    const { data: penonton, error } = await supabase.rpc("is_penonton");
    if (error || penonton === true) {
      const { data: anggota } = await supabase.rpc("is_anggota");
      if (penonton === true || anggota !== true) return notFound();
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
