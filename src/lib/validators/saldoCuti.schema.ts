import { z } from "zod";

// ─── Konfigurasi Cuti ─────────────────────────────────────────────────────────

export const konfigurasiCutiSchema = z.object({
  tahun: z.number().int().min(2020).max(2100),
  kuotaCutiTahunan: z.number().int().min(1).max(30).default(12),
  kuotaCutiKompensasi: z.number().int().min(0).max(10).default(2),
  maksimalPotongCutiBersama: z.number().int().min(0).max(12).default(2),
});

export type KonfigurasiCutiInput = z.infer<typeof konfigurasiCutiSchema>;

// ─── Generate Saldo Tahunan ───────────────────────────────────────────────────

export const generateSaldoSchema = z.object({
  tahun: z.number().int().min(2020).max(2100),
});

export type GenerateSaldoInput = z.infer<typeof generateSaldoSchema>;

// ─── Cuti Bersama ─────────────────────────────────────────────────────────────

export const cutiBersamaCreateSchema = z.object({
  tahun: z.number().int().min(2020).max(2100),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid (YYYY-MM-DD)"),
  keterangan: z.string().trim().min(1, "Keterangan wajib diisi").max(200),
});

export type CutiBersamaCreateInput = z.infer<typeof cutiBersamaCreateSchema>;

export const cutiBersamaToggleSchema = z.object({
  id: z.number().int().positive(),
  memotongSaldo: z.boolean(),
});

export type CutiBersamaToggleInput = z.infer<typeof cutiBersamaToggleSchema>;

// ─── Koreksi Saldo ────────────────────────────────────────────────────────────

export const koreksiSaldoSchema = z.object({
  userId: z.string().min(1),
  tahun: z.number().int().min(2020).max(2100),
  jenis: z.enum(["tahunan", "kompensasi"]),
  field: z.enum(["kuotaAwal", "cutiTerpakai", "cutiBersamaTerpakai", "kuota", "terpakai"]),
  value: z.number().int().min(0),
});

export type KoreksiSaldoInput = z.infer<typeof koreksiSaldoSchema>;
