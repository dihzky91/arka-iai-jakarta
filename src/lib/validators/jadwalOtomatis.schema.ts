import { z } from "zod";

export const kelasOtomatisCreateSchema = z.object({
  namaKelas: z.string().trim().min(2, "Nama kelas minimal 2 karakter").max(200),
  programId: z.string().min(1, "Program wajib dipilih"),
  classTypeId: z.string().min(1, "Tipe kelas wajib dipilih"),
  mode: z.enum(["offline", "online"]),
  angkatan: z
    .number()
    .int("Angkatan harus bilangan bulat")
    .min(1, "Angkatan minimal 1")
    .max(999, "Angkatan maksimal 3 digit")
    .optional(),
  certificateClassCode: z.enum(["01", "02", "03"]).optional().or(z.literal("")),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid (YYYY-MM-DD)"),
  lokasi: z.string().trim().max(300).optional().or(z.literal("")),
  financeContactNameOverride: z
    .string()
    .trim()
    .max(200, "Nama kontak keuangan maksimal 200 karakter")
    .optional()
    .or(z.literal("")),
  financeWhatsappNumberOverride: z
    .string()
    .trim()
    .max(30, "Nomor WhatsApp keuangan maksimal 30 karakter")
    .optional()
    .or(z.literal("")),
  excludedDates: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid"),
      reason: z.string().trim().max(200).optional(),
    }),
  ),
});

export type KelasOtomatisCreateInput = z.infer<typeof kelasOtomatisCreateSchema>;

export const kelasOtomatisFilterSchema = z.object({
  programId: z.string().optional(),
  status: z.string().optional(),
});

export type KelasOtomatisFilter = z.infer<typeof kelasOtomatisFilterSchema>;

export const kelasOtomatisUpdateStartDateSchema = z.object({
  id: z.string().min(1, "ID kelas wajib diisi"),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid (YYYY-MM-DD)"),
  exclusionStrategy: z.enum(["keep", "shift", "clear"]).default("keep"),
});

export type KelasOtomatisUpdateStartDateInput = z.infer<
  typeof kelasOtomatisUpdateStartDateSchema
>;

export const kelasOtomatisUpdateStatusSchema = z.object({
  id: z.string().min(1, "ID kelas wajib diisi"),
  status: z.enum(["active", "completed", "cancelled"]),
  reason: z.string().trim().max(500).optional(),
});
export type KelasOtomatisUpdateStatusInput = z.infer<typeof kelasOtomatisUpdateStatusSchema>;

export const kelasOtomatisUpdateMetadataSchema = z.object({
  id: z.string().min(1, "ID kelas wajib diisi"),
  namaKelas: z.string().min(1, "Nama kelas wajib diisi").max(200),
  mode: z.enum(["offline", "online"]),
  angkatan: z.number().int().positive().nullable().optional(),
  certificateClassCode: z.string().max(2).nullable().optional(),
  lokasi: z.string().max(300).nullable().optional(),
});
export type KelasOtomatisUpdateMetadataInput = z.infer<typeof kelasOtomatisUpdateMetadataSchema>;

export const kelasOtomatisExcludedDateSchema = z.object({
  kelasId: z.string().min(1, "ID kelas wajib diisi"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid (YYYY-MM-DD)"),
  reason: z.string().trim().max(200).optional(),
});
export type KelasOtomatisExcludedDateInput = z.infer<typeof kelasOtomatisExcludedDateSchema>;

export const kelasOtomatisRemoveExcludedDateSchema = z.object({
  kelasId: z.string().min(1, "ID kelas wajib diisi"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid (YYYY-MM-DD)"),
});
export type KelasOtomatisRemoveExcludedDateInput = z.infer<typeof kelasOtomatisRemoveExcludedDateSchema>;
