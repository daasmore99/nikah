import type { Pengaturan, Row, TableName } from "./types";
import type { RowChange } from "./bulk";

export interface User {
  id: string;
  email: string;
  nama: string;
}

/** asli: data pernikahan sungguhan (tabel public.*); demo: penyimpanan terpisah untuk akun demo. */
export type StoreMode = "asli" | "demo";

export interface Repo {
  user: User;
  mode: StoreMode;
  list<T extends TableName>(table: T): Promise<Row<T>[]>;
  insert(table: TableName, values: Record<string, unknown>): Promise<void>;
  update(table: TableName, id: string, values: Record<string, unknown>): Promise<void>;
  remove(table: TableName, id: string): Promise<void>;
  /** Satu INSERT berisi banyak baris: semua masuk atau tidak sama sekali. */
  insertMany(table: TableName, rows: Record<string, unknown>[]): Promise<void>;
  /**
   * Ubah banyak baris. Perubahan dengan nilai identik dikirim sebagai satu UPDATE (atomik per kelompok);
   * di Supabase, kelompok yang berbeda dijalankan berurutan, jadi bisa sebagian berhasil.
   * Hasil: id yang berhasil dan yang gagal (dengan pesan).
   */
  updateMany(table: TableName, changes: RowChange[]): Promise<BatchOutcome>;
  /** Satu DELETE ... WHERE id IN (...): semua atau tidak sama sekali. Hasil: jumlah yang terhapus. */
  removeMany(table: TableName, ids: string[]): Promise<number>;
  pengaturan(): Promise<Pengaturan>;
  updatePengaturan(values: Record<string, unknown>): Promise<void>;
  /** id user -> nama, untuk "dicatat oleh" */
  profil(): Promise<Record<string, string>>;
  /** Kosongkan semua data demo. Hanya untuk mode demo; di data asli selalu menolak. */
  resetDemo(): Promise<void>;
}

export class RepoError extends Error {}

export interface BatchOutcome {
  done: string[];
  failed: { id: string; message: string }[];
}
