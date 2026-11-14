import { hitungBiaya, hitungDana, hitungTodo, totalPerkiraanTamu } from "../calc";
import type { ImportData } from "../types";
import type { SheetTotals } from "./sheet";

export interface Cek {
  label: string;
  sheet: number;
  hitung: number;
  cocok: boolean;
  penjelasan: string;
}

const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);

/** Bandingkan angka yang tertulis di sheet dengan hitung ulang dari baris yang diimpor. */
export function compareTotals(data: ImportData, s: SheetTotals): Cek[] {
  const T = data.tables;
  const dana = hitungDana(T.setoran, T.pengeluaran);
  const biaya = hitungBiaya(T.biaya_item);
  const todo = hitungTodo(T.todo);
  const grup = (g: string) => biaya.perGrup.find((x) => x.grup === g)!;
  const setor = (p: "CPP" | "CPW", awal: boolean) =>
    sum(T.setoran.filter((x) => x.pihak === p && x.saldo_awal === awal).map((x) => x.jumlah));
  const rekom = (tier: string) =>
    sum(T.seserahan_rekom.filter((x) => x.budget_tier === tier && x.dibeli).map((x) => x.harga));
  const tiers = [...new Set(T.seserahan_rekom.map((x) => x.budget_tier))];
  const mahar = grup("Mahar"), sesr = grup("Seserahan"), lam = grup("Lamaran"), adm = grup("Administrasi & MCU");

  const rows: Omit<Cek, "cocok">[] = [
    { label: "Target dana", sheet: s.targetDana ?? 0, hitung: data.pengaturan.target_dana, penjelasan: "" },
    { label: "Setoran CPP (jumlah)", sheet: s.totalCpp ?? 0, hitung: setor("CPP", false), penjelasan: "" },
    { label: "Saldo CPP", sheet: s.saldoCpp ?? 0, hitung: dana.cpp, penjelasan: "" },
    { label: "Setoran CPW (jumlah, tanpa saldo awal)", sheet: s.totalCpw ?? 0, hitung: setor("CPW", false), penjelasan: "" },
    {
      label: "Saldo CPW", sheet: s.saldoCpw ?? 0, hitung: dana.cpw,
      penjelasan: "setoran CPW 1 Nov 2026 Rp500.000 tidak punya nilai Saldo di sheet, jadi saldo sheet berhenti di 30 Sep",
    },
    { label: "Outcome gether", sheet: s.totalGether ?? 0, hitung: dana.gether, penjelasan: "" },
    { label: "Outcome seserahan", sheet: s.totalOutcomeSeserahan ?? 0, hitung: dana.seserahan, penjelasan: "" },
    {
      label: "Dana terkumpul (CPP + CPW - gether)", sheet: s.danaTerkumpul ?? 0, hitung: dana.terkumpul,
      penjelasan: "ikut terbawa dari Saldo CPW: setoran 1 Nov 2026 Rp500.000 belum masuk hitungan sheet",
    },
    {
      label: "Sisa dana dibutuhkan", sheet: s.sisaDana ?? 0, hitung: data.pengaturan.target_dana - dana.terkumpul,
      penjelasan: "akibat selisih dana terkumpul di atas",
    },
    { label: "Budget / estimasi biaya (ringkasan)", sheet: s.budget ?? 0, hitung: data.pengaturan.target_dana, penjelasan: "" },
    {
      label: "Realisasi biaya (ringkasan atas)", sheet: s.realisasiRingkasan ?? 0, hitung: biaya.realisasi,
      penjelasan: "rumus sheet hanya menjumlah Seserahan; hitung ulang = Lamaran 1.720.000 + Mahar 17.038.000 + Seserahan 2.178.310",
    },
    { label: "Administrasi & MCU estimasi", sheet: s.admin.estimasi ?? 0, hitung: adm.estimasi, penjelasan: "" },
    { label: "Administrasi & MCU realisasi", sheet: s.admin.realisasi ?? 0, hitung: adm.realisasi, penjelasan: "" },
    { label: "Lamaran estimasi", sheet: s.lamaran.estimasi ?? 0, hitung: lam.estimasi, penjelasan: "" },
    { label: "Lamaran realisasi", sheet: s.lamaran.realisasi ?? 0, hitung: lam.realisasi, penjelasan: "" },
    { label: "Mahar estimasi", sheet: s.mahar.estimasi ?? 0, hitung: mahar.estimasi, penjelasan: "" },
    { label: "Mahar realisasi", sheet: s.mahar.realisasi ?? 0, hitung: mahar.realisasi, penjelasan: "" },
    { label: "Seserahan estimasi", sheet: s.seserahan.estimasi ?? 0, hitung: sesr.estimasi, penjelasan: "" },
    { label: "Seserahan realisasi", sheet: s.seserahan.realisasi ?? 0, hitung: sesr.realisasi, penjelasan: "" },
    {
      label: "Rangkuman estimasi (semua kategori)", sheet: s.rangkumanTotal.estimasi ?? 0, hitung: biaya.estimasi,
      penjelasan: "tabel RANGKUMAN sheet tidak memuat kategori Lamaran (1.720.000)",
    },
    {
      label: "Rangkuman realisasi (semua kategori)", sheet: s.rangkumanTotal.realisasi ?? 0, hitung: biaya.realisasi,
      penjelasan: "tabel RANGKUMAN sheet tidak memuat kategori Lamaran (1.720.000)",
    },
    { label: "Status BELUM BAYAR (jumlah item)", sheet: s.statusCount["BELUM BAYAR"] ?? 0, hitung: biaya.status["BELUM BAYAR"], penjelasan: "" },
    { label: "Status SUDAH DP", sheet: s.statusCount["SUDAH DP"] ?? 0, hitung: biaya.status["SUDAH DP"], penjelasan: "" },
    { label: "Status BELUM LUNAS", sheet: s.statusCount["BELUM LUNAS"] ?? 0, hitung: biaya.status["BELUM LUNAS"], penjelasan: "" },
    {
      label: "Status LUNAS", sheet: s.statusCount.LUNAS ?? 0, hitung: biaya.status.LUNAS,
      penjelasan: "sheet hanya menghitung Mahar+Resepsi; di web ikut 2 cincin Lamaran + 15 item Seserahan berstatus SUDAH BAYAR",
    },
    { label: "Checklist sudah", sheet: s.checklistSudah ?? 0, hitung: todo.sudah, penjelasan: "" },
    {
      label: "Checklist total", sheet: s.checklistTotal ?? 0, hitung: todo.total,
      penjelasan: "3 baris checkbox kosong tanpa judul di akhir To-Do tidak diimpor",
    },
    { label: "Perkiraan tamu (tab Tamu)", sheet: s.estimasiTamuTab ?? 0, hitung: totalPerkiraanTamu(T.tamu_kelompok), penjelasan: "" },
    ...tiers.map((tier, i) => ({
      label: `Seserahan rekomendasi ${tier} yang dibeli`,
      sheet: (i === 0 ? s.rekomDibeliKiri : s.rekomDibeliKanan) ?? 0, hitung: rekom(tier), penjelasan: "",
    })),
    {
      label: "Kalkulator souvenir (harga x jumlah)", sheet: s.souvenirTotal ?? 0,
      hitung: (data.pengaturan.souvenir_harga_satuan ?? 0) * (data.pengaturan.souvenir_jumlah ?? 0), penjelasan: "",
    },
  ];
  return rows.map((r) => ({ ...r, cocok: r.sheet === r.hitung }));
}
