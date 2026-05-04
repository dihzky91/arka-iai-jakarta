import { z } from "zod";
import { fileUrlSchema } from "@/lib/validators/fileUrl";
import { isoDate } from "@/lib/validators/common";

export const suratMouCreateSchema = z.object({
  nomorMOU: z.string().min(1, "Nomor MOU wajib diisi."),
  perihal: z.string().min(1, "Perihal wajib diisi."),
  pihakKedua: z.string().min(1, "Pihak kedua wajib diisi."),
  pihakKeduaAlamat: z.string().optional(),
  tanggalMOU: isoDate,
  tanggalBerlaku: isoDate.optional(),
  tanggalBerakhir: isoDate.optional(),
  nilaiKerjasama: z.string().optional(),
  pejabatId: z.number().int().positive().optional(),
  fileUrl: fileUrlSchema.optional(),
  qrCodeUrl: fileUrlSchema.optional(),
});

export const suratMouUpdateSchema = suratMouCreateSchema.partial().extend({
  id: z.string().uuid(),
});

export type SuratMouCreateInput = z.infer<typeof suratMouCreateSchema>;
export type SuratMouUpdateInput = z.infer<typeof suratMouUpdateSchema>;
