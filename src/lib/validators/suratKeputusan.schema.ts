import { z } from "zod";
import { fileUrlSchema } from "@/lib/validators/fileUrl";
import { isoDate } from "@/lib/validators/common";

export const suratKeputusanCreateSchema = z.object({
  nomorSK: z.string().min(1, "Nomor SK wajib diisi."),
  perihal: z.string().min(1, "Perihal wajib diisi."),
  tentang: z.string().min(1, "Tentang wajib diisi."),
  tanggalSK: isoDate,
  tanggalBerlaku: isoDate.optional(),
  tanggalBerakhir: isoDate.optional(),
  pejabatId: z.number().int().positive().optional(),
  fileUrl: fileUrlSchema.optional(),
  qrCodeUrl: fileUrlSchema.optional(),
});

export const suratKeputusanUpdateSchema = suratKeputusanCreateSchema.partial().extend({
  id: z.string().uuid(),
});

export type SuratKeputusanCreateInput = z.infer<typeof suratKeputusanCreateSchema>;
export type SuratKeputusanUpdateInput = z.infer<typeof suratKeputusanUpdateSchema>;
