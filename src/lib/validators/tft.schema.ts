import { z } from "zod";

// ─── PERIODE TFT ─────────────────────────────────────────────────────────────

export const periodeTftCreateSchema = z.object({
  judul: z.string().trim().min(3, "Judul minimal 3 karakter").max(300),
  slug: z
    .string()
    .trim()
    .min(3, "Slug minimal 3 karakter")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug hanya boleh huruf kecil, angka, dan tanda hubung"),
  deskripsi: z.string().optional().or(z.literal("")),
  tanggalMulai: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid"),
  tanggalSelesai: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid"),
  waktuMulai: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format waktu tidak valid")
    .optional()
    .or(z.literal("")),
  waktuSelesai: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format waktu tidak valid")
    .optional()
    .or(z.literal("")),
  lokasi: z.string().trim().max(300).optional().or(z.literal("")),
  batasPendaftaran: z.string().optional().or(z.literal("")),
  program: z.enum(["brevet_ab", "brevet_c", "all"]),
  maxPeserta: z.number().int().positive().optional().nullable(),
  skorMinimum: z.number().min(0).max(100).optional().nullable(),
  catatanInternal: z.string().optional().or(z.literal("")),
});

export const periodeTftUpdateSchema = periodeTftCreateSchema.extend({
  id: z.string().min(1),
});

export type PeriodeTftCreateInput = z.infer<typeof periodeTftCreateSchema>;
export type PeriodeTftUpdateInput = z.infer<typeof periodeTftUpdateSchema>;

// ─── PENDAFTAR TFT (Public Form Submission) ──────────────────────────────────

export const pendaftarTftSubmitSchema = z.object({
  periodeId: z.string().min(1),
  namaLengkap: z.string().trim().min(2, "Nama minimal 2 karakter").max(200),
  email: z.string().trim().email("Format email tidak valid").max(150),
  noHp: z
    .string()
    .trim()
    .min(8, "Nomor HP minimal 8 digit")
    .max(30)
    .regex(/^[0-9+\-\s()]+$/, "Format nomor HP tidak valid"),
  pekerjaan: z.string().trim().min(2, "Pekerjaan wajib diisi").max(500),
  alamatPekerjaan: z.string().trim().min(2, "Alamat pekerjaan wajib diisi").max(1000),
  alamatDomisili: z.string().trim().min(2, "Alamat domisili wajib diisi").max(1000),
  materiBrevetAb: z.array(z.string()).default([]),
  materiBrevetC: z.array(z.string()).default([]),
  bersediaHadir: z.boolean(),
});

export type PendaftarTftSubmitInput = z.infer<typeof pendaftarTftSubmitSchema>;

// ─── KRITERIA PENILAIAN ──────────────────────────────────────────────────────

export const kriteriaTftCreateSchema = z.object({
  periodeId: z.string().min(1),
  nama: z.string().trim().min(2, "Nama kriteria minimal 2 karakter").max(200),
  deskripsi: z.string().trim().max(1000).optional().or(z.literal("")),
  bobot: z.number().min(0.01, "Bobot harus lebih dari 0").max(100, "Bobot tidak boleh lebih dari 100"),
  skorMin: z.number().min(0).default(0),
  skorMax: z.number().min(1).default(100),
  urutan: z.number().int().min(0).default(0),
});

export const kriteriaTftUpdateSchema = kriteriaTftCreateSchema.extend({
  id: z.string().min(1),
});

export type KriteriaTftCreateInput = z.infer<typeof kriteriaTftCreateSchema>;
export type KriteriaTftUpdateInput = z.infer<typeof kriteriaTftUpdateSchema>;

// ─── PENILAI ─────────────────────────────────────────────────────────────────

export const penilaiTftCreateSchema = z.object({
  periodeId: z.string().min(1),
  nama: z.string().trim().min(2, "Nama penilai minimal 2 karakter").max(200),
  jabatan: z.string().trim().max(200).optional().or(z.literal("")),
  instansi: z.string().trim().max(200).optional().or(z.literal("")),
  catatan: z.string().trim().max(500).optional().or(z.literal("")),
});

export const penilaiTftUpdateSchema = penilaiTftCreateSchema.extend({
  id: z.string().min(1),
});

export type PenilaiTftCreateInput = z.infer<typeof penilaiTftCreateSchema>;
export type PenilaiTftUpdateInput = z.infer<typeof penilaiTftUpdateSchema>;

// ─── INPUT NILAI ─────────────────────────────────────────────────────────────

export const nilaiTftInputSchema = z.object({
  periodeId: z.string().min(1),
  penilaiId: z.string().min(1),
  nilai: z.array(
    z.object({
      pendaftarId: z.string().min(1),
      kriteriaId: z.string().min(1),
      skor: z.number().min(0),
      catatan: z.string().optional().or(z.literal("")),
    }),
  ),
});

export type NilaiTftInputData = z.infer<typeof nilaiTftInputSchema>;

// ─── REVIEW PENDAFTAR ────────────────────────────────────────────────────────

export const reviewPendaftarSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["review", "diterima", "ditolak"]),
  catatanAdmin: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type ReviewPendaftarInput = z.infer<typeof reviewPendaftarSchema>;
