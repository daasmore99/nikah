"use client";

/** Cadangan terakhir kalau root layout sendiri gagal: dokumen sendiri, gaya inline krem/emerald. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="id">
      <body style={{ margin: 0, minHeight: "100dvh", background: "#f5f1e8", color: "#18221d", fontFamily: "system-ui, sans-serif" }}>
        <title>Gagal memuat · Tracker Pernikahan</title>
        <div role="alert" style={{ maxWidth: "32rem", margin: "0 auto", padding: "3rem 1rem" }}>
          <p style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7d857f" }}>Gagal memuat</p>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: "2.4rem", lineHeight: 1, margin: "0.75rem 0 0" }}>Aplikasi belum bisa dibuka</h1>
          <p style={{ marginTop: "0.75rem", color: "#4f5a53" }}>Mungkin koneksi sedang putus, atau sesi login sudah habis.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: "1.5rem", height: "2.5rem", padding: "0 1rem", border: "1px solid #0d4a37", borderRadius: 2, background: "#0d4a37", color: "#f5f1e8", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
          >
            Coba lagi
          </button>
        </div>
      </body>
    </html>
  );
}
