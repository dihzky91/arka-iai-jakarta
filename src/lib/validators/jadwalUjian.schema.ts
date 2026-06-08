import { z } from "zod";

const jamRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const jamSchema = z.string().regex(jamRegex, "Format jam tidak valid (HH:MM)");

// ─── MATERI UJIAN ────────────────────────────────────────────────────────────

export const materiCreateSchema = z.object({
  nama: z.string().trim().min(2, "Nama minimal 2 karakter").max(200),
  program: z.string().trim().min(1, "Program wajib dipilih").max(100),
  urutan: z.number().int().min(0).optional(),
});

export const materiUpdateSchema = materiCreateSchema.extend({
  id: z.string().min(1),
});

export type MateriCreateInput = z.infer<typeof materiCreateSchema>;
export type MateriUpdateInput = z.infer<typeof materiUpdateSchema>;

// ─── PENGAWAS ────────────────────────────────────────────────────────────────

export const pengawasCreateSchema = z.object({
  nama: z.string().trim().min(2, "Nama minimal 2 karakter").max(200),
  catatan: z.string().trim().max(500).optional().or(z.literal("")),
});

export const pengawasUpdateSchema = pengawasCreateSchema.extend({
  id: z.string().min(1),
});

export type PengawasCreateInput = z.infer<typeof pengawasCreateSchema>;
export type PengawasUpdateInput = z.infer<typeof pengawasUpdateSchema>;

// ─── KELAS UJIAN ─────────────────────────────────────────────────────────────

export const kelasCreateSchema = z.object({
  namaKelas: z.string().trim().min(2, "Nama kelas minimal 2 karakter").max(200),
  program: z.string().trim().min(1, "Program wajib dipilih").max(100),
  tipe: z.string().trim().min(1, "Tipe wajib dipilih").max(100),
  mode: z.string().trim().min(1, "Mode wajib dipilih").max(50),
  lokasi: z.string().trim().max(300).optional().or(z.literal("")),
  catatan: z.string().trim().max(500).optional().or(z.literal("")),
});

export const kelasUpdateSchema = kelasCreateSchema.extend({
  id: z.string().min(1),
});

export type KelasCreateInput = z.infer<typeof kelasCreateSchema>;
export type KelasUpdateInput = z.infer<typeof kelasUpdateSchema>;

// ─── JADWAL UJIAN ─────────────────────────────────────────────────────────────

const ujianBaseSchema = z.object({
  kelasId: z.string().min(1, "Kelas wajib dipilih"),
  mataPelajaran: z
    .array(z.string().trim().min(1))
    .min(1, "Pilih minimal 1 mata ujian")
    .max(2, "Maksimal 2 mata ujian"),
  tanggalUjian: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid (YYYY-MM-DD)"),
  jamMulai: jamSchema,
  jamSelesai: jamSchema,
  catatan: z.string().trim().max(500).optional().or(z.literal("")),
});

export const ujianCreateSchema = ujianBaseSchema.refine(
  (d) => d.jamSelesai > d.jamMulai,
  { message: "Jam selesai harus setelah jam mulai", path: ["jamSelesai"] },
);
export const ujianUpdateSchema = ujianBaseSchema
  .extend({ id: z.string().min(1) })
  .refine(
    (d) => d.jamSelesai > d.jamMulai,
    { message: "Jam selesai harus setelah jam mulai", path: ["jamSelesai"] },
  );

export type UjianCreateInput = z.infer<typeof ujianCreateSchema>;
export type UjianUpdateInput = z.infer<typeof ujianUpdateSchema>;

export const ujianFilterSchema = z.object({
  tanggalMulai: z.string().optional(),
  tanggalSelesai: z.string().optional(),
  kelasId: z.string().optional(),
  program: z.string().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
});

export type UjianFilter = z.infer<typeof ujianFilterSchema>;

// ─── PENUGASAN PENGAWAS ───────────────────────────────────────────────────────

export const assignPengawasSchema = z.object({
  ujianId: z.string().min(1),
  pengawasId: z.string().min(1),
  forceAssign: z.boolean().optional(),
});

export type AssignPengawasInput = z.infer<typeof assignPengawasSchema>;

// ─── ADMIN JAGA ───────────────────────────────────────────────────────────────

export const adminJagaAssignSchema = z.object({
  ujianId: z.string().min(1),
  pengawasId: z.string().min(1),
  catatan: z.string().trim().max(500).optional().or(z.literal("")),
});

export type AdminJagaAssignInput = z.infer<typeof adminJagaAssignSchema>;

export const adminJagaFilterSchema = z.object({
  pengawasId: z.string().optional(),
  tanggalMulai: z.string().optional(),
  tanggalSelesai: z.string().optional(),
});

export type AdminJagaFilter = z.infer<typeof adminJagaFilterSchema>;

// ─── JADWAL ADMIN JAGA (STANDALONE) ──────────────────────────────────────────

const jadwalAdminJagaBaseSchema = z.object({
  kelasId: z.string().min(1),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  jamMulai: jamSchema,
  jamSelesai: jamSchema,
  materi: z.string().trim().min(1).max(300),
  pengawasId: z.string().min(1),
  catatan: z.string().trim().max(500).optional().or(z.literal("")),
});

export const jadwalAdminJagaCreateSchema = jadwalAdminJagaBaseSchema.refine(
  (d) => d.jamSelesai > d.jamMulai,
  { message: "Jam selesai harus setelah jam mulai", path: ["jamSelesai"] },
);

export const jadwalAdminJagaUpdateSchema = jadwalAdminJagaBaseSchema
  .extend({ id: z.string().min(1) })
  .refine(
    (d) => d.jamSelesai > d.jamMulai,
    { message: "Jam selesai harus setelah jam mulai", path: ["jamSelesai"] },
  );

export type JadwalAdminJagaCreateInput = z.infer<typeof jadwalAdminJagaCreateSchema>;
export type JadwalAdminJagaUpdateInput = z.infer<typeof jadwalAdminJagaUpdateSchema>;

export const jadwalAdminJagaFilterSchema = z.object({
  kelasId: z.string().optional(),
  pengawasId: z.string().optional(),
  tanggalMulai: z.string().optional(),
  tanggalSelesai: z.string().optional(),
});

export type JadwalAdminJagaFilter = z.infer<typeof jadwalAdminJagaFilterSchema>;

// ─── BEBAN KERJA FILTER ───────────────────────────────────────────────────────

export const bebanKerjaFilterSchema = z.object({
  bulan: z.number().int().min(1).max(12).optional(),
  tahun: z.number().int().min(2020).optional(),
  program: z.string().optional(),
});

export type BebanKerjaFilter = z.infer<typeof bebanKerjaFilterSchema>;
