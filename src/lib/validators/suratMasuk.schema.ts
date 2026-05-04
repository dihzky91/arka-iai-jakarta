import { z } from "zod";
import { jenisSuratEnum, statusSuratMasukEnum } from "@/server/db/schema";
import { fileUrlSchema } from "@/lib/validators/fileUrl";
import { isoDate } from "@/lib/validators/common";

const jenisSuratValues = jenisSuratEnum.enumValues;
const statusValues = statusSuratMasukEnum.enumValues;

// CATATAN: tanggalSurat & tanggalDiterima TIDAK punya validasi range (backdate diizinkan).
export const suratMasukCreateSchema = z.object({
  nomorAgenda: z.string().optional(),
  nomorSuratAsal: z.string().optional(),
  perihal: z.string().min(1, "Perihal wajib diisi"),
  pengirim: z.string().min(1, "Pengirim wajib diisi"),
  pengirimAlamat: z.string().optional(),
  tanggalSurat: isoDate,
  tanggalDiterima: isoDate,
  jenisSurat: z.enum(jenisSuratValues),
  status: z.enum(statusValues).optional(),
  isiSingkat: z.string().optional(),
  fileUrl: fileUrlSchema.optional(),
});

export const suratMasukUpdateSchema = suratMasukCreateSchema.partial().extend({
  id: z.string().uuid(),
});

export type SuratMasukCreateInput = z.infer<typeof suratMasukCreateSchema>;
export type SuratMasukUpdateInput = z.infer<typeof suratMasukUpdateSchema>;
