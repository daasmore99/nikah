/**
 * Panduan pemakaian: hanya untuk akun demo, isinya netral (tanpa data pasangan sungguhan).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { showGuide } from "../src/lib/demo";
import { LANGKAH_AWAL, PANDUAN } from "../src/lib/panduan";

const src = (...p: string[]) => readFileSync(join(__dirname, "..", "src", ...p), "utf8");

test("showGuide: hanya mode demo", () => {
  assert.equal(showGuide("demo"), true);
  assert.equal(showGuide("asli"), false);
});

test("rute /panduan: 404 untuk akun asli, tautan & kartu hanya untuk demo", () => {
  const page = src("app", "(app)", "panduan", "page.tsx");
  assert.match(page, /if \(!showGuide\(repo\.mode\)\) notFound\(\);/);
  // notFound dipanggil sebelum isi panduan dirender
  assert.ok(page.indexOf("notFound();") < page.indexOf("PANDUAN.map"));

  // proxy memberi 404 sungguhan sebelum halaman dirender
  const proxy = src("proxy.ts");
  assert.match(proxy, /if \(panduan && !localDemo\) return notFound\(\);/);
  assert.match(proxy, /if \(error \|\| penonton !== true\) return notFound\(\);/);

  const nav = src("components", "nav.tsx");
  assert.match(nav, /export const navFor = \(demo: boolean\) => \(demo \? \[\.\.\.NAV, PANDUAN_NAV\] : NAV\);/);
  assert.doesNotMatch(nav.slice(nav.indexOf("export const NAV"), nav.indexOf("];")), /\/panduan/, "NAV dasar tidak boleh memuat /panduan");
  for (const fn of ["SideNav", "BottomNav"]) assert.match(nav, new RegExp(`export function ${fn}\\(\\{ demo = false \\}`));

  const layout = src("app", "(app)", "layout.tsx");
  assert.match(layout, /<SideNav demo=\{demo\} \/>/);
  assert.match(layout, /<BottomNav demo=\{demo\} \/>/);
  assert.match(layout, /const demo = repo\.mode === "demo";/);

  const ringkasan = src("app", "(app)", "page.tsx");
  assert.match(ringkasan, /\{showGuide\(repo\.mode\) && <DemoWelcome \/>\}/);
  // tidak ada tautan /panduan lain di luar komponen khusus demo
  for (const f of [["app", "(app)", "layout.tsx"], ["app", "(app)", "page.tsx"], ["app", "(app)", "pengaturan", "page.tsx"]])
    assert.doesNotMatch(src(...f), /href="\/panduan"/, f.join("/"));
});

test("isi panduan: lengkap, ringkas, tanpa data atau nama sungguhan", () => {
  const ids = PANDUAN.map((b) => b.id);
  for (const id of ["ringkasan", "pengaturan", "tabungan", "biaya", "persiapan", "tamu", "seserahan", "vendor", "undangan", "lagu", "ekspor", "reset"])
    assert.ok(ids.includes(id), `bagian ${id}`);
  assert.equal(new Set(ids).size, ids.length);
  for (const b of PANDUAN) {
    const kalimat = b.isi.join(" ").split(/(?<=\.)\s+/).filter(Boolean).length;
    assert.ok(kalimat >= 2 && kalimat <= 4, `${b.id}: ${kalimat} kalimat`);
    assert.ok(b.coba.length >= 1 && b.coba.length <= 4, `${b.id}: langkah coba`);
    assert.match(b.href, /^\//);
  }
  const semua = JSON.stringify({ PANDUAN, LANGKAH_AWAL });
  for (const larang of [/Ananda/i, /Zalfa/i, /Umma/i, /34\.685\.759/, /70\.000\.000|70000000/, /2027-04-10/, /data asli/i, /pemilik/i])
    assert.doesNotMatch(semua, larang);
  // contoh tempel yang diminta
  assert.ok(semua.includes("Parfum, 150rb, 140.000"));
  assert.deepEqual(LANGKAH_AWAL.map((l) => l.href), ["/pengaturan", "/uang", "/biaya"]);
});
