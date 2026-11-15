import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Sans, Instrument_Serif } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { connection } from "next/server";
import "./globals.css";

const serif = Instrument_Serif({ variable: "--font-serif", weight: "400", style: ["normal", "italic"], subsets: ["latin"] });
const body = Instrument_Sans({ variable: "--font-body", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-plex-mono", weight: ["400", "500"], subsets: ["latin"] });

export const metadata: Metadata = {
  // netral: nama mempelai diambil dari Pengaturan di layout halaman setelah login
  title: { default: "Tracker Pernikahan", template: "%s · Tracker Pernikahan" },
  description: "Catatan persiapan dan uang pernikahan.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f5f1e8",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Semua halaman (termasuk 404) dirender per request supaya script framework mendapat nonce CSP
  // dari proxy.ts. Halaman statis tidak punya nonce dan script-nya akan diblokir CSP.
  await connection();
  return (
    <html lang="id" className={`${serif.variable} ${body.variable} ${mono.variable} antialiased`}>
      <body className="min-h-dvh">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
