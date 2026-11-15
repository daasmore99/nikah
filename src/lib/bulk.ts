/**
 * Logika murni untuk input massal (tanpa React / server), supaya bisa dites unit.
 */

export const MAX_CREATE = 50;
export const MAX_IDS = 200;

type Rec = Record<string, unknown>;

/** Rapikan spasi: "  make   up " -> "make up". */
export const cleanText = (s: string) => s.trim().replace(/\s+/g, " ");

/** Daftar sub-kategori unik (ejaan pertama yang tercatat menang, beda huruf/spasi dianggap sama). */
export function subOptionsOf(rows: Rec[], key: string): string[] {
  const seen = new Map<string, string>();
  for (const r of rows) {
    const s = cleanText(String(r[key] ?? ""));
    if (s && !seen.has(s.toLowerCase())) seen.set(s.toLowerCase(), s);
  }
  return [...seen.values()];
}

/** Samakan ejaan sub-kategori dengan yang sudah ada ("makeup" -> "Makeup"). */
export function canonSub(value: string, options: string[]): string {
  const clean = cleanText(value);
  return options.find((o) => o.toLowerCase() === clean.toLowerCase()) ?? clean;
}

/**
 * Angka rupiah dari teks bebas: "150000", "150.000", "Rp 150.000", "150rb", "150k", "1,5jt", "1.5 juta".
 * Kosong -> null. Tidak dikenali -> NaN.
 */
export function parseRupiah(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/^rp\.?\s*/, "");
  if (!s) return null;
  const m = s.match(/^(\d+(?:[.,]\d+)?)\s*(rb|ribu|k|jt|juta)$/);
  if (m) {
    const n = Number(m[1].replace(",", "."));
    return Math.round(n * (m[2] === "jt" || m[2] === "juta" ? 1_000_000 : 1_000));
  }
  if (/^\d{1,3}([.,]\d{3})+$/.test(s) || /^\d+$/.test(s)) return Number(s.replace(/\D/g, ""));
  return NaN;
}

export interface PastedRow {
  line: number;
  nama: string;
  estimasi: number | null;
  realisasi: number | null;
  error?: string;
}

const looksLikeAmount = (t: string) => {
  const n = parseRupiah(t);
  return n !== null && !Number.isNaN(n);
};

/**
 * Teks tempel, satu item per baris: "Nama", "Nama, estimasi", atau "Nama, estimasi, realisasi".
 * Pemisah boleh koma, titik koma, tab, atau "|". Koma di dalam nama tetap aman karena angka
 * dibaca dari kanan (maks. 2 angka); sisanya digabung lagi jadi nama.
 * Penanda daftar di depan ("- ", "1. ", "• ") dibuang. Baris kosong dilewati.
 */
export function parsePasted(text: string, max = MAX_CREATE): { rows: PastedRow[]; extra: number } {
  const rows: PastedRow[] = [];
  let extra = 0;
  text.split(/\r?\n/).forEach((rawLine, i) => {
    const line = rawLine.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim();
    if (!line) return;
    if (rows.length >= max) {
      extra++;
      return;
    }
    const byOther = line.split(/\s*[;\t|]\s*/);
    // koma di dalam angka ("1,5jt", "150,000") bukan pemisah kolom
    let protectedLine = line.replace(/(\d),(\d+\s*(?:jt|juta|rb|ribu|k)\b)/gi, "$1.$2");
    for (let prev = ""; prev !== protectedLine; ) {
      prev = protectedLine;
      protectedLine = protectedLine.replace(/(\d),(\d{3})(?!\d)/, "$1.$2");
    }
    const parts = byOther.length > 1 ? byOther : protectedLine.split(/\s*,\s*/);
    const nums: string[] = [];
    while (parts.length > 1 && nums.length < 2 && looksLikeAmount(parts[parts.length - 1])) nums.unshift(parts.pop()!);
    // kolom angka kosong di tengah, mis. "Toner, , 50000"
    while (parts.length > 1 && parts[parts.length - 1] === "" && nums.length < 2) {
      parts.pop();
      nums.unshift("");
    }
    const nama = cleanText(parts.join(", "));
    const [e = "", r = ""] = nums;
    const row: PastedRow = { line: i + 1, nama, estimasi: parseRupiah(e), realisasi: parseRupiah(r) };
    if (!nama) row.error = "Nama kosong";
    rows.push(row);
  });
  return { rows, extra };
}

const normName = (s: unknown) => cleanText(String(s ?? "")).toLowerCase();

/**
 * Peringatan duplikat (tidak memblokir): nama sama di lingkup yang sama (mis. kategori + sub),
 * baik terhadap data yang sudah ada maupun sesama baris baru.
 * Hasil: index baris baru -> pesan.
 */
export function findDuplicates(
  newRows: Rec[], existing: Rec[], nameKey: string, scopeKeys: string[],
): Map<number, string> {
  const scope = (r: Rec) => scopeKeys.map((k) => normName(r[k])).join("\u0000");
  const keyOf = (r: Rec) => `${scope(r)}\u0001${normName(r[nameKey])}`;
  const have = new Set(existing.map(keyOf));
  const firstAt = new Map<string, number>();
  const out = new Map<number, string>();
  newRows.forEach((r, i) => {
    if (!normName(r[nameKey])) return;
    const k = keyOf(r);
    if (have.has(k)) out.set(i, "Sudah ada item dengan nama ini");
    else if (firstAt.has(k)) out.set(i, `Sama dengan baris ${firstAt.get(k)! + 1}`);
    else firstAt.set(k, i);
  });
  return out;
}

export interface RowChange {
  id: string;
  values: Rec;
}

const same = (a: unknown, b: unknown) => (a ?? null) === (b ?? null) || String(a ?? "") === String(b ?? "");

/**
 * Terapkan isian "ubah massal" ke baris terpilih. Kolom yang kosong (undefined/""/null) tidak diubah.
 * Baris yang nilainya sudah sama dilewati. Mengembalikan perubahan dan nilai sebelumnya (untuk Urungkan).
 */
export function mergeChanges(rows: (Rec & { id: string })[], patch: Rec): { changes: RowChange[]; undo: RowChange[] } {
  const filled = Object.entries(patch).filter(([, v]) => v !== undefined && v !== null && v !== "");
  const changes: RowChange[] = [];
  const undo: RowChange[] = [];
  for (const r of rows) {
    const values: Rec = {};
    const prev: Rec = {};
    for (const [k, v] of filled) {
      if (same(r[k], v)) continue;
      values[k] = v;
      prev[k] = r[k] ?? null;
    }
    if (Object.keys(values).length) {
      changes.push({ id: r.id, values });
      undo.push({ id: r.id, values: prev });
    }
  }
  return { changes, undo };
}

/**
 * Perubahan per baris (tabel "Isi cepat"): bandingkan draf dengan nilai asli,
 * kirim hanya kolom yang benar-benar berubah. Di sini string kosong berarti "dikosongkan".
 */
export function diffDrafts(rows: (Rec & { id: string })[], drafts: Record<string, Rec>): { changes: RowChange[]; undo: RowChange[] } {
  const changes: RowChange[] = [];
  const undo: RowChange[] = [];
  for (const r of rows) {
    const d = drafts[r.id];
    if (!d) continue;
    const values: Rec = {};
    const prev: Rec = {};
    for (const [k, v] of Object.entries(d)) {
      const nv = v === "" || v === undefined ? null : v;
      if (same(r[k], nv)) continue;
      values[k] = nv;
      prev[k] = r[k] ?? null;
    }
    if (Object.keys(values).length) {
      changes.push({ id: r.id, values });
      undo.push({ id: r.id, values: prev });
    }
  }
  return { changes, undo };
}

/** Kelompokkan perubahan yang nilainya identik, supaya bisa dikirim sebagai satu UPDATE ... WHERE id IN (...). */
export function groupSameValues(changes: RowChange[]): { ids: string[]; values: Rec }[] {
  const m = new Map<string, { ids: string[]; values: Rec }>();
  for (const c of changes) {
    const key = JSON.stringify(Object.entries(c.values).sort(([a], [b]) => a.localeCompare(b)));
    const g = m.get(key);
    if (g) g.ids.push(c.id);
    else m.set(key, { ids: [c.id], values: c.values });
  }
  return [...m.values()];
}
