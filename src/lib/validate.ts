import type { Field } from "./fields";

export type Values = Record<string, unknown>;
export type Result = { ok: true; data: Values } | { ok: false; errors: Record<string, string> };

const MAX_UANG = 10_000_000_000; // Rp10 M, batas wajar

/**
 * Validasi + normalisasi input form sesuai definisi Field.
 * partial=true: hanya kunci yang dikirim yang dicek (untuk toggle/patch).
 */
export function validate(fields: Field[], input: Values, partial = false): Result {
  const data: Values = {};
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (partial && !(f.key in input)) continue;
    const raw = input[f.key];
    const str = typeof raw === "string" ? raw.trim() : raw;
    const empty = str === undefined || str === null || str === "";

    if (f.type === "bool") {
      // null eksplisit = "tidak berlaku" (mis. Vaksin TT untuk CPP)
      data[f.key] = raw === null ? null : str === true || str === "true" || str === "on";
      continue;
    }
    if (empty) {
      if (f.required) errors[f.key] = `${f.label} wajib diisi`;
      else data[f.key] = null;
      continue;
    }
    const s = String(str);
    switch (f.type) {
      case "money":
      case "int": {
        const n = typeof str === "number" ? str : Number(s.replace(/[^\d-]/g, ""));
        if (!Number.isInteger(n) || n < 0) errors[f.key] = `${f.label} harus angka bulat, tidak negatif`;
        else if (n > MAX_UANG) errors[f.key] = `${f.label} terlalu besar`;
        else if (f.required && f.type === "money" && n === 0 && f.key === "jumlah") errors[f.key] = `${f.label} tidak boleh nol`;
        else data[f.key] = n;
        break;
      }
      case "decimal": {
        const n = Number(s.replace(",", "."));
        if (!Number.isFinite(n) || n < 0) errors[f.key] = `${f.label} harus angka`;
        else data[f.key] = Math.round(n * 1000) / 1000;
        break;
      }
      case "date":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) errors[f.key] = `${f.label} tidak valid`;
        else data[f.key] = s;
        break;
      case "select":
        if (f.options && !f.options.includes(s)) errors[f.key] = `${f.label} tidak dikenal`;
        else data[f.key] = s;
        break;
      case "url":
        if (!/^https?:\/\/\S+$/i.test(s) && !/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(s)) errors[f.key] = `${f.label} bukan link yang valid`;
        else data[f.key] = /^https?:\/\//i.test(s) ? s : `https://${s}`;
        break;
      default:
        if (s.length > 2000) errors[f.key] = `${f.label} terlalu panjang`;
        else data[f.key] = s;
    }
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}
