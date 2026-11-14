"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-lg py-10">
      <p className="eyebrow">Gagal memuat</p>
      <h1 className="display mt-3 text-[2.4rem]">Datanya belum bisa diambil</h1>
      <p className="mt-3 text-ink-2">
        {error.message && !error.digest ? error.message : "Mungkin koneksi sedang putus, atau sesi login sudah habis."}
      </p>
      <div className="mt-6 flex gap-3">
        <button className="btn btn-primary" onClick={reset}>Coba lagi</button>
        <a className="btn" href="/login">Masuk ulang</a>
      </div>
    </div>
  );
}
