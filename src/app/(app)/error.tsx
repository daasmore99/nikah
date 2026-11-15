"use client";

import { LoadError, pesanError } from "@/components/load-error";

/** Error di halaman (page) setelah login: tampil di dalam kerangka aplikasi. */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  return <LoadError message={pesanError(error)} onRetry={retry} />;
}
