/** Parser CSV kecil (RFC 4180): kutip, "" escape, baris baru di dalam kutip. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** "Rp 2.631.000" / "Rp70.000.000" / "4.000.000" -> 2631000. "Rp -" / "" -> null. */
export function parseRupiah(raw: string | undefined): number | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (!s) return null;
  const stripped = s.replace(/^Rp\s*/i, "").trim();
  if (!stripped || stripped === "-") return null;
  const neg = stripped.startsWith("-");
  const digits = stripped.replace(/[^0-9,]/g, "").split(",")[0];
  if (!digits) return null;
  const n = parseInt(digits, 10);
  return neg ? -n : n;
}

const BULAN: Record<string, number> = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
};

/** "26 Februari 2026" / "18/05/2026" / "10-04-2027" -> "2026-02-26". Selain itu null. */
export function parseTanggal(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  let m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const bln = BULAN[m[2].toLowerCase()];
    if (!bln) return null;
    return iso(+m[3], bln, +m[1]);
  }
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  return null;
}

function iso(y: number, mo: number, d: number) {
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function parseBool(raw: string | undefined): boolean | null {
  const s = (raw ?? "").trim().toUpperCase();
  if (s === "TRUE") return true;
  if (s === "FALSE") return false;
  return null;
}

export const clean = (raw: string | undefined) => {
  const s = (raw ?? "").replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
};
