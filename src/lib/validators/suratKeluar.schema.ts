import { z } from "zod";
import { jenisSuratEnum, statusSuratKeluarEnum } from "@/server/db/schema";
import { fileUrlSchema } from "@/lib/validators/fileUrl";
import { isoDate } from "@/lib/validators/common";

const jenisSuratValues = jenisSuratEnum.enumValues;
const statusValues = statusSuratKeluarEnum.enumValues;

// CATATAN: tanggalSurat TIDAK punya validasi range (backdate diizinkan per SYSTEM.md §5.3).

const suratKeluarBaseSchema = z.object({
  perihal: z.string().min(1, "Perihal wajib diisi"),
  tujuan: z.string().min(1, "Tujuan wajib diisi"),
  tujuanAlamat: z.string().optional(),
  tanggalSurat: isoDate,
  jenisSurat: z.enum(jenisSuratValues),
  isiSingkat: z.string().optional(),
  prosesViaSimpeg: z.boolean().optional().default(false),
  catatSaja: z.boolean().optional().default(false),
  fileDraftUrl: fileUrlSchema.optional(),
  lampiranUrl: fileUrlSchema.optional(),
  fileFinalUrl: fileUrlSchema.optional(),
  pejabatId: z.number().int().positive().optional(),
  divisiId: z.number().int().positive().optional(),
  // SK/MOU fields (optional in base schema, validated conditionally via superRefine)
  tentang: z.string().optional(),
  tanggalBerlaku: isoDate.optional(),
  tanggalBerakhir: isoDate.optional(),
  pihakKedua: z.string().optional(),
  pihakKeduaAlamat: z.string().optional(),
  nilaiKerjasama: z.string().optional(),
});

function suratKeluarConditionalRefine(data: z.infer<typeof suratKeluarBaseSchema>, ctx: z.RefinementCtx) {
  if (data.jenisSurat === "keputusan" && !data.tentang?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Field 'Tentang' wajib diisi untuk Surat Keputusan.",
      path: ["tentang"],
    });
  }

  if (data.jenisSurat === "mou" && !data.pihakKedua?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Field 'Pihak Kedua' wajib diisi untuk Surat MOU.",
      path: ["pihakKedua"],
    });
  }
}

export const suratKeluarCreateSchema = suratKeluarBaseSchema.superRefine(suratKeluarConditionalRefine);

export const suratKeluarUpdateSchema = suratKeluarBaseSchema.partial().extend({
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
