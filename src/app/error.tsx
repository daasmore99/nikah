"use client";

import { LoadError, pesanError } from "@/components/load-error";

/**
 * Error di layout (app) (mis. gagal membaca pengaturan) tidak tertangkap (app)/error.tsx,
 * karena error.tsx tidak membungkus layout di segmen yang sama. Boundary ini menangkapnya
 * di bawah root layout, jadi tetap bergaya aplikasi, bukan layar error Next generik.
 */
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return <LoadError message={pesanError(error)} onRetry={retry} />;
}
