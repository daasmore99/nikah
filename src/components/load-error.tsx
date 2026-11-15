"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { signOut } from "@/app/actions";

/**
 * Panel "gagal memuat" bergaya aplikasi (krem/emerald), dipakai error boundary dan layout (app).
 * `onRetry` dari error boundary (retry); tanpa itu, muat ulang data server (router.refresh).
 */
export function LoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const retry = () => start(() => (onRetry ? onRetry() : router.refresh()));
  return (
    <div role="alert" className="mx-auto max-w-lg px-4 py-12 md:px-0">
      <p className="eyebrow">Gagal memuat</p>
      <h1 className="display mt-3 text-[2.4rem]">Datanya belum bisa diambil</h1>
      <p className="mt-3 text-ink-2">{message}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="btn btn-primary" onClick={retry} disabled={pending}>
          {pending ? "Memuat…" : "Coba lagi"}
        </button>
        <form action={signOut}>
          <button className="btn">Keluar</button>
        </form>
      </div>
    </div>
  );
}

/** Pesan aman untuk error dari boundary: di production pesan server disembunyikan (ada digest). */
export function pesanError(error: unknown) {
  if (error instanceof Error && error.message && !(error as Error & { digest?: string }).digest) return error.message;
  return "Mungkin koneksi sedang putus, atau sesi login sudah habis. Kalau terus terjadi, cek pengaturan Supabase.";
}
