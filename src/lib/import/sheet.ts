/**
 * Membaca CSV ekspor tiap tab Google Sheet dan mengubahnya ke baris database.
 * Layout sheet berlapis (beberapa tabel berdampingan), jadi tiap tabel dicari
 * lewat teks header-nya lalu dibaca per kolom. Kalau header tidak ketemu,
 * parser melempar error (lebih baik gagal daripada salah baca).
 */
import { clean, parseBool, parseCsv, parseRupiah, parseTanggal } from "./csv";
import type { BiayaItem, ImportData, NewRow, StatusBayar } from "../types";

export const SHEET_ID = "1UGMSpEwOsRK3ofdD5UebJ6NYHDqyFZJWxBf1xAJMqL0";
export const TABS = {
  summary: 1925015220,
  todo: 963784088,
  biaya: 486415200,
  nabung: 2112793950,
  vendor: 22044038,
  seserahan: 871401805,
  souvenir: 1111865612,
  tamu: 1792918792,
  lagu: 731899609,
} as const;
export type TabName = keyof typeof TABS;
export type Csvs = Record<TabName, string>;

/** Angka yang TERTULIS di sheet (hasil rumus sheet), untuk dibandingkan dengan hitung ulang. */
export interface SheetTotals {
  tanggalNikahSummary: string | null;
  estimasiTamuSummary: number | null;
  estimasiTamuTodo: string | null;
  estimasiTamuTab: number | null;
  checklistSudah: number | null;
  checklistBelum: number | null;
  checklistTotal: number | null;
  targetDana: number | null;
  danaTerkumpul: number | null;
  sisaDana: number | null;
  totalCpp: number | null;
  saldoCpp: number | null;
  totalCpw: number | null;
  saldoCpw: number | null;
  totalGether: number | null;
  totalOutcomeSeserahan: number | null;
  budget: number | null;
  realisasiRingkasan: number | null;
  selisihRingkasan: number | null;
  statusCount: Record<StatusBayar, number | null>;
  admin: { estimasi: number | null; realisasi: number | null };
  lamaran: { estimasi: number | null; realisasi: number | null };
  mahar: { estimasi: number | null; realisasi: number | null };
  seserahan: { estimasi: number | null; realisasi: number | null };
  rangkumanTotal: { estimasi: number | null; realisasi: number | null };
  rekomDibeliKiri: number | null;
  rekomDibeliKanan: number | null;
  souvenirTotal: number | null;
  tamuRealisasi: number | null;
}

export interface ImportNotes {
  skipped: string[];
  mapped: string[];
}

type Grid = string[][];
const cell = (g: Grid, r: number, c: number) => g[r]?.[c] ?? "";

function find(g: Grid, pred: (row: string[], r: number) => boolean, from = 0): number {
  for (let r = from; r < g.length; r++) if (pred(g[r], r)) return r;
  return -1;
}
function must(n: number, what: string) {
  if (n < 0) throw new Error(`Layout sheet berubah: tidak menemukan ${what}`);
  return n;
}
const t = (s: string) => s.replace(/\s+/g, " ").trim();
const isNum = (s: string) => /^\d+$/.test(t(s));

function normStatus(raw: string, notes: ImportNotes, where: string): StatusBayar | null {
  const s = t(raw).toUpperCase();
  if (!s) return null;
  if (s === "SUDAH BAYAR") {
    notes.mapped.push(`${where}: status "SUDAH BAYAR" disimpan sebagai LUNAS`);
    return "LUNAS";
  }
  if (["BELUM BAYAR", "SUDAH DP", "BELUM LUNAS", "LUNAS"].includes(s)) return s as StatusBayar;
  notes.mapped.push(`${where}: status tak dikenal "${raw}" dikosongkan`);
  return null;
}

function biaya(
  base: Partial<NewRow<"biaya_item">> & Pick<BiayaItem, "grup" | "nama" | "urutan" | "import_key">,
): NewRow<"biaya_item"> {
  return {
    sub: null, estimasi: null, realisasi: null, dp: null, status: null,
    tanggal_bayar: null, catatan: null, link: null, gram_emas: null, ...base,
  };
}

export function parseAll(csvs: Csvs): { data: ImportData; totals: SheetTotals; notes: ImportNotes } {
  const notes: ImportNotes = { skipped: [], mapped: [] };
  const g = Object.fromEntries(
    Object.entries(csvs).map(([k, v]) => [k, parseCsv(v)]),
  ) as Record<TabName, Grid>;

  /* ---------- SUMMARY ---------- */
  const S = g.summary;
  const rNikah = must(find(S, (r) => t(r[0]) === "Tanggal Pernikahan"), "Summary: Tanggal Pernikahan");
  const rChkS = must(find(S, (r) => t(r[0]) === "Sudah di checklist"), "Summary: checklist");
  const rChkB = must(find(S, (r) => t(r[0]) === "Belum di checklist"), "Summary: belum checklist");
  const rChkT = must(find(S, (r) => t(r[0]) === "Total", rChkB), "Summary: total checklist");
  const rTamuS = must(find(S, (r) => t(r[0]) === "Perkiraan Jumlah tamu"), "Summary: tamu");

  /* ---------- NABUNG ---------- */
  const N = g.nabung;
  const rTarget = must(find(N, (r) => t(r[5]) === "TARGET DANA"), "Nabung: TARGET DANA");
  const rTerkumpul = must(find(N, (r) => t(r[5]) === "DANA TERKUMPUL"), "Nabung: DANA TERKUMPUL");
  const rSisa = must(find(N, (r) => t(r[5]) === "SISA DANA DIBUTUHKAN"), "Nabung: SISA");
  const rHead = must(find(N, (r) => t(r[0]) === "Tanggal" && t(r[5]) === "Tanggal"), "Nabung: header");
  const rTot = must(find(N, (r) => t(r[0]) === "TOTAL", rHead), "Nabung: TOTAL");

  const setoran: NewRow<"setoran">[] = [];
  const pengeluaran: NewRow<"pengeluaran">[] = [];
  for (const [pihak, c0] of [["CPP", 0], ["CPW", 5]] as const) {
    let prevSaldo: number | null = null;
    let urut = 0;
    for (let r = rHead + 1; r < rTot; r++) {
      const jumlah = parseRupiah(cell(N, r, c0 + 1));
      if (jumlah == null) continue;
      const saldo = parseRupiah(cell(N, r, c0 + 2));
      // Saldo baris pertama CPW > jumlahnya: berarti ada saldo awal sebelum setoran pertama.
      if (prevSaldo == null && saldo != null && saldo !== jumlah) {
        setoran.push({
          pihak, tanggal: null, jumlah: saldo - jumlah, lokasi: clean(cell(N, r, c0 + 3)),
          catatan: "Saldo awal sebelum setoran pertama (dihitung dari kolom Saldo di sheet)",
          saldo_awal: true, urutan: urut++, import_key: `nabung:${pihak}:saldo_awal`,
        });
        notes.mapped.push(
          `Nabung ${pihak}: saldo awal ${saldo - jumlah} disimpulkan dari kolom Saldo baris pertama (${saldo} - ${jumlah})`,
        );
      }
      if (saldo == null) notes.mapped.push(`Nabung ${pihak} baris ${r + 1}: setoran ${jumlah} tanpa nilai Saldo di sheet (tetap diimpor)`);
      prevSaldo = saldo ?? prevSaldo;
      setoran.push({
        pihak, tanggal: parseTanggal(cell(N, r, c0)), jumlah, lokasi: clean(cell(N, r, c0 + 3)),
        catatan: null, saldo_awal: false, urutan: urut++, import_key: `nabung:${pihak}:r${r}`,
      });
    }
  }
  for (const [jenis, c0, potong] of [["gether", 10, true], ["seserahan", 14, false]] as const) {
    let urut = 0;
    for (let r = rHead + 1; r < rTot; r++) {
      const jumlah = parseRupiah(cell(N, r, c0 + 1));
      if (jumlah == null) continue;
      pengeluaran.push({
        jenis, tanggal: parseTanggal(cell(N, r, c0)), jumlah, keterangan: clean(cell(N, r, c0 + 2)),
        potong_dana: potong, urutan: urut++, import_key: `nabung:${jenis}:r${r}`,
      });
    }
  }

  /* ---------- BIAYA ---------- */
  const B = g.biaya;
  const items: NewRow<"biaya_item">[] = [];
  let urutB = 0;
  const rRingkas = must(find(B, (r) => t(r[1]) === "Budget/Estimasi Biaya"), "Biaya: ringkasan");
  const statusRow = (label: string) =>
    must(find(B, (r) => t(r[15]) === label), `Biaya: status ${label}`);
  const rHeader = must(find(B, (r) => t(r[0]) === "No" && t(r[9]) === "No" && t(r[20]) === "No"), "Biaya: header tabel");

  // Administrasi & MCU (kolom 0-7)
  const rAdmTot = must(find(B, (r) => t(r[0]) === "TOTAL", rHeader), "Biaya: TOTAL admin");
  for (let r = rHeader + 1; r < rAdmTot; r++) {
    const nama = clean(cell(B, r, 1));
    if (!nama) continue;
    items.push(biaya({
      grup: "Administrasi & MCU", nama, estimasi: parseRupiah(cell(B, r, 2)), realisasi: parseRupiah(cell(B, r, 3)),
      status: normStatus(cell(B, r, 5), notes, `Biaya/${nama}`), tanggal_bayar: parseTanggal(cell(B, r, 6)),
      catatan: clean(cell(B, r, 7)), urutan: urutB++, import_key: `biaya:adm:r${r}`,
    }));
  }
  // Lamaran (kolom 0-7)
  const rLam = must(find(B, (r) => t(r[3]) === "Lamaran", rAdmTot), "Biaya: Lamaran");
  const rLamHead = must(find(B, (r) => t(r[0]) === "No", rLam), "Biaya: header Lamaran");
  const rLamTot = must(find(B, (r) => t(r[0]) === "TOTAL", rLamHead), "Biaya: TOTAL Lamaran");
  for (let r = rLamHead + 1; r < rLamTot; r++) {
    const nama = clean(cell(B, r, 1));
    if (!nama) continue;
    let tgl = parseTanggal(cell(B, r, 6));
    let catatan = clean(cell(B, r, 7));
    const tglDiDetail = parseTanggal(cell(B, r, 7));
    if (!tgl && tglDiDetail) {
      tgl = tglDiDetail;
      catatan = null;
      notes.mapped.push(`Biaya/Lamaran/${nama}: tanggal ${cell(B, r, 7)} ada di kolom Detail, dipindah ke tanggal bayar`);
    }
    items.push(biaya({
      grup: "Lamaran", nama, estimasi: parseRupiah(cell(B, r, 2)), realisasi: parseRupiah(cell(B, r, 3)),
      status: normStatus(cell(B, r, 5), notes, `Biaya/${nama}`), tanggal_bayar: tgl, catatan,
      urutan: urutB++, import_key: `biaya:lamaran:r${r}`,
    }));
  }
  // Mahar (kolom 9-17)
  const rMahTot = must(find(B, (r) => t(r[9]) === "TOTAL", rHeader), "Biaya: TOTAL Mahar");
  for (let r = rHeader + 1; r < rMahTot; r++) {
    const nama = clean(cell(B, r, 10));
    if (!nama) continue;
    const catatan = clean(cell(B, r, 17));
    const gram = catatan?.match(/^([\d.,]+)\s*g(ram)?$/i);
    items.push(biaya({
      grup: "Mahar", nama, estimasi: parseRupiah(cell(B, r, 11)), realisasi: parseRupiah(cell(B, r, 12)),
      dp: parseRupiah(cell(B, r, 14)), status: normStatus(cell(B, r, 15), notes, `Biaya/${nama}`),
      tanggal_bayar: parseTanggal(cell(B, r, 16)), catatan,
      gram_emas: gram ? parseFloat(gram[1].replace(",", ".")) : null,
      urutan: urutB++, import_key: `biaya:mahar:r${r}`,
    }));
  }
  // Resepsi (kolom 20-28): huruf A-K = sub kategori, baris tanpa huruf = item
  const rResTot = must(find(B, (r) => t(r[21]) === "TOTAL", rHeader), "Biaya: TOTAL Resepsi");
  let sub: string | null = null;
  for (let r = rHeader + 1; r < rResTot; r++) {
    const kode = t(cell(B, r, 20));
    const nama = clean(cell(B, r, 21));
    if (/^[A-Z]$/.test(kode)) { sub = nama; continue; }
    if (!nama) continue;
    const dpRaw = t(cell(B, r, 25));
    const dp = parseRupiah(dpRaw);
    if (dpRaw && dp == null) notes.mapped.push(`Biaya/Resepsi/${nama}: isi kolom DP "${dpRaw}" bukan nominal, dikosongkan`);
    items.push(biaya({
      grup: "Resepsi", sub, nama, estimasi: parseRupiah(cell(B, r, 22)), realisasi: parseRupiah(cell(B, r, 23)),
      dp, status: normStatus(cell(B, r, 26), notes, `Biaya/${nama}`), tanggal_bayar: parseTanggal(cell(B, r, 27)),
      catatan: clean(cell(B, r, 28)), urutan: urutB++, import_key: `biaya:resepsi:r${r}`,
    }));
  }
  // Seserahan (kolom 30-36)
  const rSesTot = must(find(B, (r) => t(r[30]) === "TOTAL", rHeader), "Biaya: TOTAL Seserahan");
  sub = null;
  for (let r = rHeader + 1; r < rSesTot; r++) {
    const kode = t(cell(B, r, 30));
    const nama = clean(cell(B, r, 31));
    if (/^[A-Z]$/.test(kode)) { sub = nama; continue; }
    if (!nama) continue;
    items.push(biaya({
      grup: "Seserahan", sub, nama, link: clean(cell(B, r, 32)), estimasi: parseRupiah(cell(B, r, 33)),
      realisasi: parseRupiah(cell(B, r, 34)), status: normStatus(cell(B, r, 36), notes, `Biaya/Seserahan/${nama}`),
      urutan: urutB++, import_key: `biaya:seserahan:r${r}`,
    }));
  }
  const rRangTot = must(find(B, (r) => t(r[38]) === "TOTAL"), "Biaya: TOTAL rangkuman");

  /* ---------- TO-DO ---------- */
  const T = g.todo;
  const rTH = must(find(T, (r) => t(r[1]) === "Daftar Persiapan"), "To-Do: header");
  const todo: NewRow<"todo">[] = [];
  let bagianNo = 0, bagian = "", dual = false, urutT = 0, kosong = 0;
  for (let r = rTH + 1; r < T.length; r++) {
    const c0 = t(cell(T, r, 0));
    const judul = clean(cell(T, r, 1));
    if (isNum(c0) && judul) {
      bagianNo = +c0; bagian = judul;
      dual = t(cell(T, r, 4)) === "CPP" && t(cell(T, r, 5)) === "CPW";
      continue;
    }
    const done = parseBool(c0);
    if (done == null) continue;
    if (!judul) { kosong++; continue; }
    const boolOrNull = (s: string) => parseBool(s);
    todo.push({
      bagian_no: bagianNo, bagian, judul, selesai: done, tenggat: parseTanggal(cell(T, r, 2)),
      progres: dual ? null : clean(cell(T, r, 4)),
      cpp_selesai: dual ? boolOrNull(cell(T, r, 4)) : null,
      cpw_selesai: dual ? boolOrNull(cell(T, r, 5)) : null,
      detail: clean(cell(T, r, 6)), pic: clean(cell(T, r, 7)),
      urutan: urutT++, import_key: `todo:r${r}`,
    });
  }
  if (kosong) notes.skipped.push(`To-Do: ${kosong} baris checkbox tanpa judul dilewati (ikut terhitung di total 75 Summary)`);
  const rTglTodo = find(T, (r) => r.some((c) => t(c) === "Menentukan estimasi jumlah tamu"));

  /* ---------- VENDOR ---------- */
  const V = g.vendor;
  const rVH = must(find(V, (r) => t(r[1]) === "Kategori Vendor"), "Vendor: header");
  const vendor: NewRow<"vendor">[] = [];
  for (let r = rVH + 1; r < V.length; r++) {
    const nama = clean(cell(V, r, 2));
    if (!nama) continue;
    vendor.push({
      kategori: clean(cell(V, r, 1)) ?? "Lainnya", nama, kontak: clean(cell(V, r, 4)), telepon: clean(cell(V, r, 5)),
      instagram_web: clean(cell(V, r, 6)), alamat: clean(cell(V, r, 7)), harga: parseRupiah(cell(V, r, 8)),
      status: clean(cell(V, r, 9)), catatan: clean(cell(V, r, 10)), urutan: r, import_key: `vendor:r${r}`,
    });
  }

  /* ---------- SESERAHAN (rekomendasi per budget) ---------- */
  const R = g.seserahan;
  const rRH = must(find(R, (r) => t(r[0]) === "No" && t(r[6]) === "No"), "Seserahan: header");
  const rTier = must(find(R, (r) => t(r[0]).startsWith("Budget")), "Seserahan: judul budget");
  const rRTot = must(find(R, (r) => t(r[0]) === "TOTAL", rRH), "Seserahan: TOTAL");
  const rekom: NewRow<"seserahan_rekom">[] = [];
  for (const c0 of [0, 6]) {
    const tier = t(cell(R, rTier, c0)).replace(/^Budget\s*/i, "").replace(/\s*-\s*/, "–");
    let kat = "", urut = 0;
    for (let r = rRH + 1; r < rRTot; r++) {
      const no = t(cell(R, r, c0));
      const nama = clean(cell(R, r, c0 + 1));
      const harga = parseRupiah(cell(R, r, c0 + 2));
      if (isNum(no) && nama) { kat = nama; continue; }
      if (!nama && harga == null) continue;
      if (nama && /^\.+$/.test(nama) && harga == null) { notes.skipped.push(`Seserahan ${tier}: baris berisi "${nama}" dilewati`); continue; }
      rekom.push({
        budget_tier: tier, kategori: kat, nama: nama ?? "(tanpa nama di sheet)", harga, link: clean(cell(R, r, c0 + 3)),
        dibeli: parseBool(cell(R, r, c0 + 4)) ?? false, urutan: urut++, import_key: `seserahan:c${c0}:r${r}`,
      });
      if (!nama) notes.mapped.push(`Seserahan ${tier}/${kat}: item ${harga} tanpa nama, diberi label "(tanpa nama di sheet)"`);
    }
  }

  /* ---------- SOUVENIR & UNDANGAN ---------- */
  const U = g.souvenir;
  const rHarga = must(find(U, (r) => t(r[1]).startsWith("Harga souvenir per pcs")), "Souvenir: harga");
  const rJml = must(find(U, (r) => t(r[1]).startsWith("Jumlah souvenir")), "Souvenir: jumlah");
  const rTotal = must(find(U, (r) => t(r[1]).startsWith("Total harga")), "Souvenir: total");
  const rSH = must(find(U, (r) => t(r[0]) === "No" && t(r[1]) === "Details"), "Souvenir: header katalog");
  const katalog: NewRow<"katalog">[] = [];
  for (let r = rSH + 1; r < U.length; r++) {
    const nama = clean(cell(U, r, 1));
    if (!isNum(cell(U, r, 0)) || !nama) continue;
    katalog.push({ jenis: "souvenir", nama, harga: parseRupiah(cell(U, r, 3)), link: clean(cell(U, r, 4)), dipilih: false, urutan: r, import_key: `souvenir:r${r}` });
  }
  const rUH = must(find(U, (r) => t(r[6]) === "No" && t(r[7]) === "Details"), "Undangan fisik: header");
  for (let r = rUH + 1; r < U.length; r++) {
    const nama = clean(cell(U, r, 7));
    if (!isNum(cell(U, r, 6)) || !nama) continue;
    katalog.push({ jenis: "undangan_fisik", nama, harga: parseRupiah(cell(U, r, 10)), link: clean(cell(U, r, 11)), dipilih: false, urutan: r, import_key: `undangan:r${r}` });
  }

  /* ---------- TAMU ---------- */
  const G = g.tamu;
  const rGH = must(find(G, (r) => t(r[0]) === "No" && t(r[1]) === "Nama"), "Tamu: header");
  const tamu: NewRow<"tamu">[] = [];
  let tanpaNama = 0;
  for (let r = rGH + 1; r < G.length; r++) {
    if (!isNum(cell(G, r, 0))) continue;
    const nama = clean(cell(G, r, 1));
    const ada = [2, 3, 4, 5, 6].some((c) => t(cell(G, r, c)));
    if (!nama) { if (ada) tanpaNama++; continue; }
    const jml = t(cell(G, r, 3));
    tamu.push({
      nama, relasi: clean(cell(G, r, 2)), jumlah_orang: isNum(jml) ? +jml : null,
      status_undangan: clean(cell(G, r, 4)), konfirmasi: clean(cell(G, r, 5)), catatan: clean(cell(G, r, 6)),
      urutan: +t(cell(G, r, 0)), import_key: `tamu:r${r}`,
    });
  }
  if (tanpaNama) notes.skipped.push(`Tamu: ${tanpaNama} baris berisi relasi/status tapi tanpa nama dilewati (sheet tetap menghitungnya di realisasi)`);
  // Dua tabel perkiraan: yang pertama (total 100) template lama, yang kedua (total 1300) yang dipakai.
  const kelHeads: number[] = [];
  for (let r = 0; r < G.length; r++) if (t(cell(G, r, 8)) === "No" && t(cell(G, r, 9)) === "Tamu") kelHeads.push(r);
  if (kelHeads.length < 2) throw new Error("Layout sheet berubah: tabel perkiraan tamu kedua tidak ada");
  const kelompok: NewRow<"tamu_kelompok">[] = [];
  const kelTotalRow = (h: number) => must(find(G, (r) => t(r[8]) === "TOTAL", h), "Tamu: TOTAL perkiraan");
  const kh = kelHeads[1];
  for (let r = kh + 1; r < kelTotalRow(kh); r++) {
    const relasi = clean(cell(G, r, 9));
    if (!relasi) continue;
    kelompok.push({ relasi, perkiraan: parseRupiah(cell(G, r, 10)) ?? 0, urutan: +t(cell(G, r, 8)), import_key: `tamu_kelompok:r${r}` });
  }
  notes.skipped.push(`Tamu: tabel perkiraan pertama (total ${t(cell(G, kelTotalRow(kelHeads[0]), 10))}) tidak diimpor; dipakai tabel kedua (total ${t(cell(G, kelTotalRow(kh), 10))})`);
  const rBiayaSov = must(find(G, (r) => t(r[14]) === "BIAYA SOUVENIR"), "Tamu: BIAYA SOUVENIR");
  const rSov = must(find(G, (r) => t(r[9]) === "BLINDBOX"), "Tamu: BLINDBOX");

  /* ---------- LAGU ---------- */
  const L = g.lagu;
  const rLH = must(find(L, (r) => t(r[1]) === "Judul Lagu"), "Lagu: header");
  const lagu: NewRow<"lagu">[] = [];
  const laguRekom: NewRow<"lagu_rekom">[] = [];
  for (let r = rLH + 1; r < L.length; r++) {
    const judul = clean(cell(L, r, 1));
    const ket = clean(cell(L, r, 2));
    if (isNum(cell(L, r, 0)) && (judul || ket)) {
      lagu.push({ judul, keterangan: ket, urutan: +t(cell(L, r, 0)), import_key: `lagu:r${r}` });
    }
    const rj = clean(cell(L, r, 6));
    if (isNum(cell(L, r, 5)) && rj) {
      laguRekom.push({ judul: rj, kategori: clean(cell(L, r, 7)), link: clean(cell(L, r, 8)), urutan: +t(cell(L, r, 5)), import_key: `lagu_rekom:r${r}` });
    }
  }

  const tglNikah = parseTanggal(cell(S, rNikah, 1));
  if (!tglNikah) throw new Error("Tanggal nikah di Summary tidak terbaca");

  const data: ImportData = {
    pengaturan: {
      nama_pria: "Ananda",
      nama_wanita: "Zalfa",
      tanggal_nikah: tglNikah,
      target_dana: parseRupiah(cell(N, rTarget, 7)) ?? 0,
      harga_emas_manual: parseRupiah(cell(N, rTarget + 1, 10)), // sel ini #VALUE! di sheet -> null
      harga_emas_manual_tgl: null,
      harga_emas_terakhir: null,
      harga_emas_terakhir_at: null,
      souvenir_harga_satuan: parseRupiah(cell(U, rHarga, 2)),
      souvenir_jumlah: parseRupiah(cell(U, rJml, 2)),
      souvenir_budget: parseRupiah(cell(G, rBiayaSov + 1, 14)),
      souvenir_blindbox: parseRupiah(cell(G, rSov + 1, 9)),
      souvenir_sisa_umma: parseRupiah(cell(G, rSov + 1, 10)),
      souvenir_kurang: parseRupiah(cell(G, rSov + 1, 11)),
    },
    tables: {
      setoran, pengeluaran, biaya_item: items, todo, vendor, seserahan_rekom: rekom,
      katalog, tamu, tamu_kelompok: kelompok, lagu, lagu_rekom: laguRekom,
    },
  };
  if (t(cell(N, rTarget + 1, 10)).startsWith("#")) notes.skipped.push(`Nabung: sel harga emas berisi ${t(cell(N, rTarget + 1, 10))}, harga emas manual dibiarkan kosong`);

  const pair = (r: number, ce: number, cr: number) => ({ estimasi: parseRupiah(cell(B, r, ce)), realisasi: parseRupiah(cell(B, r, cr)) });
  const totals: SheetTotals = {
    tanggalNikahSummary: tglNikah,
    estimasiTamuSummary: parseRupiah(cell(S, rTamuS, 1)),
    estimasiTamuTodo: rTglTodo >= 0 ? t(cell(T, rTglTodo, 6)) : null,
    estimasiTamuTab: parseRupiah(cell(G, kelTotalRow(kh), 10)),
    checklistSudah: parseRupiah(cell(S, rChkS, 1)),
    checklistBelum: parseRupiah(cell(S, rChkB, 1)),
    checklistTotal: parseRupiah(cell(S, rChkT, 1)),
    targetDana: parseRupiah(cell(N, rTarget, 7)),
    danaTerkumpul: parseRupiah(cell(N, rTerkumpul, 7)),
    sisaDana: parseRupiah(cell(N, rSisa, 7)),
    totalCpp: parseRupiah(cell(N, rTot, 1)),
    saldoCpp: parseRupiah(cell(N, rTot, 2)),
    totalCpw: parseRupiah(cell(N, rTot, 6)),
    saldoCpw: parseRupiah(cell(N, rTot, 7)),
    totalGether: parseRupiah(cell(N, rTot, 11)),
    totalOutcomeSeserahan: parseRupiah(cell(N, rTot, 15)),
    budget: parseRupiah(cell(B, rRingkas, 2)),
    realisasiRingkasan: parseRupiah(cell(B, rRingkas + 1, 2)),
    selisihRingkasan: parseRupiah(cell(B, rRingkas + 2, 2)),
    statusCount: {
      "BELUM BAYAR": parseRupiah(cell(B, statusRow("BELUM BAYAR"), 17)),
      "SUDAH DP": parseRupiah(cell(B, statusRow("SUDAH DP"), 17)),
      "BELUM LUNAS": parseRupiah(cell(B, statusRow("BELUM LUNAS"), 17)),
      LUNAS: parseRupiah(cell(B, statusRow("LUNAS"), 17)),
    },
    admin: pair(rAdmTot, 2, 3),
    lamaran: pair(rLamTot, 2, 3),
    mahar: pair(rMahTot, 11, 12),
    seserahan: pair(rSesTot, 33, 34),
    rangkumanTotal: pair(rRangTot, 39, 40),
    rekomDibeliKiri: parseRupiah(cell(R, rRTot, 4)),
    rekomDibeliKanan: parseRupiah(cell(R, rRTot, 10)),
    souvenirTotal: parseRupiah(cell(U, rTotal, 2)),
    tamuRealisasi: parseRupiah(cell(G, kelTotalRow(kelHeads[0]), 11)),
  };
  return { data, totals, notes };
}
