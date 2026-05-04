import { z } from "zod";
import { jenisSuratEnum, statusSuratKeluarEnum } from "@/server/db/schema";
import { fileUrlSchema } from "@/lib/validators/fileUrl";
import { isoDate } from "@/lib/validators/common";

const jenisSuratValues = jenisSuratEnum.enumValues;
const statusValues = statusSuratKeluarEnum.enumValues;

// CATATAN: tanggalSurat TIDAK punya validasi range (backdate diizinkan per SYSTEM.md §5.3).

export const suratKeluarCreateSchema = z.object({
  perihal: z.string().min(1, "Perihal wajib diisi"),
  tujuan: z.string().min(1, "Tujuan wajib diisi"),
  tujuanAlamat: z.string().optional(),
  tanggalSurat: isoDate,
  jenisSurat: z.enum(jenisSuratValues),
  isiSingkat: z.string().optional(),
  fileDraftUrl: fileUrlSchema.optional(),
  lampiranUrl: fileUrlSchema.optional(),
  fileFinalUrl: fileUrlSchema.optional(),
  pejabatId: z.number().int().positive().optional(),
  divisiId: z.number().int().positive().optional(),
});

export const suratKeluarUpdateSchema = suratKeluarCreateSchema.partial().extend({
  id: z.string().uuid(),
});

export const suratKeluarStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(statusValues),
  catatanReviu: z.string().optional(),
});

export type SuratKeluarCreateInput = z.infer<typeof suratKeluarCreateSchema>;
export type SuratKeluarUpdateInput = z.infer<typeof suratKeluarUpdateSchema>;
export type SuratKeluarStatusInput = z.infer<typeof suratKeluarStatusSchema>;
