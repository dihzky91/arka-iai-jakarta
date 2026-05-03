import { z } from "zod";

export const kelasOtomatisCreateSchema = z.object({
  namaKelas: z.string().trim().min(2, "Nama kelas minimal 2 karakter").max(200),
  programId: z.string().min(1, "Program wajib dipilih"),
  classTypeId: z.string().min(1, "Tipe kelas wajib dipilih"),
  mode: z.enum(["offline", "online"]),
  angkatan: z
    .number()
    .int("Angkatan harus bilangan bulat")
    .min(100, "Angkatan minimal 3 digit")
    .max(999, "Angkatan maksimal 3 digit")
    .optional(),
  certificateClassCode: z.enum(["01", "02", "03"]).optional().or(z.literal("")),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid (YYYY-MM-DD)"),
  lokasi: z.string().trim().max(300).optional().or(z.literal("")),
  excludedDates: z.array(z.string()),
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
