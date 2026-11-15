import type { NextConfig } from "next";
import { staticSecurityHeaders } from "./src/lib/security/csp";

const nextConfig: NextConfig = {
  // Model render dinamis klasik: semua halaman membaca sesi login per request.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  poweredByHeader: false,
  devIndicators: false,
  experimental: {
    serverActions: {
      // batas body Server Action (default Next 1 MB). Simpan massal maks. 50 baris x teks 2000 karakter.
      bodySizeLimit: "1mb",
    },
  },
  async headers() {
    // CSP (dengan nonce per request) dipasang di src/proxy.ts; header statis di sini berlaku juga untuk aset.
    return [{ source: "/:path*", headers: staticSecurityHeaders(process.env.NODE_ENV === "production") }];
  },
};

export default nextConfig;
