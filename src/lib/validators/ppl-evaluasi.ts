import { z } from "zod";

// ─── KEGIATAN PPL ─────────────────────────────────────────────────────────────

export const kategoriPplValues = [
  "Perpajakan",
  "Sistem Informasi & Softskill",
  "Akuntansi Keuangan",
  "Audit",
  "Akuntansi Syariah",
  "Akuntansi Manajemen",
  "Akuntansi Manajemen dan Manajemen Keuangan",
  "Akuntansi Perpajakan",
  "Manajemen Keuangan",
  "Akuntansi Keuangan & Softskill",
  "Akuntansi Keuangan dan Manajemen Keuangan",
  "Manajemen Strategik",
  "SAK & PSAK",
] as const;

export const createKegiatanSchema = z
  .object({
    namaKegiatan: z.string().min(1).max(255),
    kategoriPpl: z.enum(kategoriPplValues),
    tipePelaksanaan: z.enum(["online", "offline", "hybrid"]),
    tanggalMulai: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    tanggalSelesai: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    lokasi: z.string().max(255).optional(),
    skp: z.number().int().min(1).max(999).optional(),
  })
  .refine((d) => d.tanggalSelesai >= d.tanggalMulai, {
    message: "Tanggal selesai harus sama atau setelah tanggal mulai",
  });

export type CreateKegiatanInput = z.infer<typeof createKegiatanSchema>;

// ─── NARASUMBER ───────────────────────────────────────────────────────────────

export const narasumberSchema = z.object({
  nama: z.string().min(1).max(200),
  email: z.string().email().max(150),
  noTelepon: z
    .string()
    .max(30)
    .regex(/^[0-9+\-]*$/)
    .optional(),
  feePerSkp: z.number().int().min(0).max(99_999_999),
  isActive: z.boolean().optional(),
});

export type NarasumberInput = z.infer<typeof narasumberSchema>;

// ─── FORM FIELD CONFIGS ───────────────────────────────────────────────────────

export const scaleConfigSchema = z
  .object({
    min: z.number().int().min(1).max(10),
    max: z.number().int().min(1).max(10),
    minLabel: z.string().max(50),
    maxLabel: z.string().max(50),
  })
  .refine((d) => d.min < d.max, {
    message: "Minimum harus kurang dari maximum",
  });

export type ScaleConfigInput = z.infer<typeof scaleConfigSchema>;

export const gridConfigSchema = z.object({
  rows: z.array(z.string().min(1).max(300)).min(1).max(30),
  columns: z.array(z.string().min(1).max(100)).min(2).max(10),
});

export type GridConfigInput = z.infer<typeof gridConfigSchema>;

export const optionsConfigSchema = z.object({
  options: z.array(z.string().min(1).max(200)).min(1).max(50),
});

export type OptionsConfigInput = z.infer<typeof optionsConfigSchema>;

// ─── FORM FIELD & TEMPLATE ────────────────────────────────────────────────────

export const formFieldSchema = z.object({
  id: z.string(),
  type: z.enum([
    "text",
    "textarea",
    "number",
    "email",
    "select",
    "radio",
    "checkbox",
    "scale",
    "grid",
  ]),
  label: z.string().min(1).max(300),
  required: z.boolean(),
  order: z.number().int().min(0),
  config: z
    .union([scaleConfigSchema, gridConfigSchema, optionsConfigSchema])
    .nullable(),
});

export type FormFieldInput = z.infer<typeof formFieldSchema>;

export const templateSchema = z.object({
  nama: z.string().min(1).max(200),
  fields: z.array(formFieldSchema).min(1).max(50),
});

export type TemplateInput = z.infer<typeof templateSchema>;

// ─── RESPONSE SUBMISSION ──────────────────────────────────────────────────────

export const submitResponseSchema = z.object({
  namaResponden: z.string().min(1).max(200),
  emailResponden: z.string().email().max(150),
  answers: z.record(z.unknown()),
});

export type SubmitResponseInput = z.infer<typeof submitResponseSchema>;

// ─── ATTENDANCE ───────────────────────────────────────────────────────────────

export const attendanceSchema = z.object({
  pendaftar: z.number().int().min(0).max(99_999),
  realisasiHadir: z.number().int().min(0).max(99_999),
});

export type AttendanceInput = z.infer<typeof attendanceSchema>;
