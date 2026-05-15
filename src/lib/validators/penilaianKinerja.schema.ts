import { z } from "zod";

// ─── TEMPLATE ─────────────────────────────────────────────────────────────────

export const templateCreateSchema = z.object({
  nama: z.string().min(1, "Nama template wajib diisi").max(200),
  tipe: z.enum(["tugas", "perilaku"]),
  divisiId: z.number().int().positive().nullable().optional(),
  jabatan: z.string().max(150).nullable().optional(),
  isDefault: z.boolean().optional().default(false),
});

export const templateUpdateSchema = z.object({
  id: z.number().int().positive(),
  nama: z.string().min(1, "Nama template wajib diisi").max(200).optional(),
  tipe: z.enum(["tugas", "perilaku"]).optional(),
  divisiId: z.number().int().positive().nullable().optional(),
  jabatan: z.string().max(150).nullable().optional(),
  isDefault: z.boolean().optional(),
});

export const templateDeleteSchema = z.object({
  id: z.number().int().positive(),
});

// ─── TEMPLATE ITEM ────────────────────────────────────────────────────────────

export const templateItemCreateSchema = z.object({
  templateId: z.number().int().positive(),
  nomor: z.number().int().positive(),
  keterangan: z.string().min(1, "Keterangan wajib diisi"),
  bobot: z
    .number()
    .min(0.001, "Bobot minimal 0.001")
    .max(1, "Bobot maksimal 1.000"),
});

export const templateItemUpdateSchema = z.object({
  id: z.number().int().positive(),
  nomor: z.number().int().positive().optional(),
  keterangan: z.string().min(1, "Keterangan wajib diisi").optional(),
  bobot: z
    .number()
    .min(0.001, "Bobot minimal 0.001")
    .max(1, "Bobot maksimal 1.000")
    .optional(),
});

export const templateItemDeleteSchema = z.object({
  id: z.number().int().positive(),
});

export const templateItemBulkCreateSchema = z.object({
  templateId: z.number().int().positive(),
  items: z
    .array(
      z.object({
        nomor: z.number().int().positive(),
        keterangan: z.string().min(1, "Keterangan wajib diisi"),
        bobot: z
          .number()
          .min(0.001, "Bobot minimal 0.001")
          .max(1, "Bobot maksimal 1.000"),
      }),
    )
    .min(1, "Minimal 1 item"),
});

// ─── PERIODE ──────────────────────────────────────────────────────────────────

export const periodeCreateSchema = z.object({
  nama: z.string().min(1, "Nama periode wajib diisi").max(100),
  tahun: z.number().int().min(2020).max(2100),
  kuartal: z.number().int().min(1).max(4),
  tanggalMulai: z.string().min(1, "Tanggal mulai wajib diisi"),
  tanggalSelesai: z.string().min(1, "Tanggal selesai wajib diisi"),
});

export const periodeUpdateSchema = z.object({
  id: z.number().int().positive(),
  nama: z.string().min(1).max(100).optional(),
  tahun: z.number().int().min(2020).max(2100).optional(),
  kuartal: z.number().int().min(1).max(4).optional(),
  tanggalMulai: z.string().optional(),
  tanggalSelesai: z.string().optional(),
  status: z.enum(["open", "closed"]).optional(),
});

// ─── PENILAIAN KINERJA ────────────────────────────────────────────────────────

export const penilaianCreateSchema = z.object({
  periodeId: z.number().int().positive(),
  userId: z.string().min(1, "Karyawan wajib dipilih"),
  templateTugasId: z.number().int().positive().nullable().optional(),
  templatePerilakuId: z.number().int().positive().nullable().optional(),
});

export const penilaianDetailItemSchema = z.object({
  templateItemId: z.number().int().positive(),
  tipe: z.enum(["tugas", "perilaku"]),
  nilai: z.number().int().min(0).max(100),
  bobot: z.number().min(0).max(1),
  keterangan: z.string().optional(),
});

export const penilaianSubmitSchema = z.object({
  id: z.string().min(1),
  items: z.array(penilaianDetailItemSchema).min(1, "Minimal 1 item penilaian"),
  catatan: z.string().optional(),
});

export const penilaianApproveSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["review", "finalize"]),
  catatan: z.string().optional(),
});

// ─── TYPE EXPORTS ─────────────────────────────────────────────────────────────

export type TemplateCreateInput = z.infer<typeof templateCreateSchema>;
export type TemplateUpdateInput = z.infer<typeof templateUpdateSchema>;
export type TemplateItemCreateInput = z.infer<typeof templateItemCreateSchema>;
export type TemplateItemUpdateInput = z.infer<typeof templateItemUpdateSchema>;
export type TemplateItemBulkCreateInput = z.infer<typeof templateItemBulkCreateSchema>;
export type PeriodeCreateInput = z.infer<typeof periodeCreateSchema>;
export type PeriodeUpdateInput = z.infer<typeof periodeUpdateSchema>;
export type PenilaianCreateInput = z.infer<typeof penilaianCreateSchema>;
export type PenilaianDetailItemInput = z.infer<typeof penilaianDetailItemSchema>;
export type PenilaianSubmitInput = z.infer<typeof penilaianSubmitSchema>;
export type PenilaianApproveInput = z.infer<typeof penilaianApproveSchema>;
