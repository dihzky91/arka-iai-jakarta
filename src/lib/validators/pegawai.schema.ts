import { z } from "zod";
import { genderEnum, jenisPegawaiEnum, statusPernikahanEnum } from "@/server/db/schema";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD");

// users.id adalah text. Better Auth v1.x men-generate nanoid (~32 char).
// createPegawai memakai crypto.randomUUID. Jadi pola string-nya bisa
// bercampur — pakai .min(1) saja agar kompatibel dengan kedua format.
const userId = z.string().min(1);

export const pegawaiCreateSchema = z.object({
  namaLengkap: z.string().min(1),
  email: z.string().email(),
  emailPribadi: z.string().email().optional(),
  noHp: z.string().optional(),
  role: z.enum(["admin", "staff", "pejabat", "viewer"]).default("staff"),
  roleId: z.number().int().positive().optional(),
  divisiId: z.number().int().positive().optional(),
  jabatan: z.string().optional(),
  levelJabatan: z.string().optional(),
  jenisPegawai: z.enum(jenisPegawaiEnum.enumValues).optional(),
  tanggalMasuk: isoDate.optional(),
});

export const pegawaiUpdateSchema = pegawaiCreateSchema.extend({
  id: userId,
  isActive: z.boolean().optional(),
});

export const pegawaiDeleteSchema = z.object({
  id: userId,
});

export const biodataSchema = z.object({
  userId,
  noKtp: z.string().optional(),
  gender: z.enum(genderEnum.enumValues).optional(),
  statusPernikahan: z.enum(statusPernikahanEnum.enumValues).optional(),
  tempatLahir: z.string().optional(),
  tanggalLahir: isoDate.optional(),
  alamatTinggal: z.string().optional(),
  kodePos: z.string().optional(),
  provinsi: z.string().optional(),
  kotaKabupaten: z.string().optional(),
  alamatKtp: z.string().optional(),
});

// ─── Keluarga ────────────────────────────────────────────────────────────────

export const keluargaCreateSchema = z.object({
  userId,
  hubungan: z.string().optional(),
  namaAnggota: z.string().min(1, "Nama anggota wajib diisi"),
  tempatLahir: z.string().optional(),
  tanggalLahir: isoDate.optional(),
  pekerjaan: z.string().optional(),
});

export const keluargaUpdateSchema = keluargaCreateSchema.extend({
  id: z.number().int().positive(),
});

export const keluargaDeleteSchema = z.object({
  id: z.number().int().positive(),
  userId,
});

// ─── Pendidikan ──────────────────────────────────────────────────────────────

export const pendidikanCreateSchema = z.object({
  userId,
  jenjang: z.string().optional(),
  namaInstitusi: z.string().optional(),
  jurusan: z.string().optional(),
  tahunMasuk: z.coerce.number().int().min(1900).max(2100).optional(),
  tahunLulus: z.coerce.number().int().min(1900).max(2100).optional(),
});

export const pendidikanUpdateSchema = pendidikanCreateSchema.extend({
  id: z.number().int().positive(),
});

export const pendidikanDeleteSchema = z.object({
  id: z.number().int().positive(),
  userId,
});

// ─── Pekerjaan ───────────────────────────────────────────────────────────────

export const pekerjaanCreateSchema = z.object({
  userId,
  namaPerusahaan: z.string().optional(),
  jabatan: z.string().optional(),
  tanggalMulai: isoDate.optional(),
  tanggalSelesai: isoDate.optional(),
  keterangan: z.string().optional(),
});

export const pekerjaanUpdateSchema = pekerjaanCreateSchema.extend({
  id: z.number().int().positive(),
});

export const pekerjaanDeleteSchema = z.object({
  id: z.number().int().positive(),
  userId,
});

// ─── Kesehatan ───────────────────────────────────────────────────────────────

export const kesehatanSchema = z.object({
  userId,
  golonganDarah: z.string().optional(),
  tinggiBadan: z.coerce.number().int().min(0).max(300).optional(),
  beratBadan: z.coerce.number().int().min(0).max(500).optional(),
  riwayatPenyakit: z.string().optional(),
  alergi: z.string().optional(),
  catatanKesehatan: z.string().optional(),
});

// ─── Kelengkapan ─────────────────────────────────────────────────────────────

export const kelengkapanSchema = z.object({
  userId,
  fotoUrl: z.string().optional(),
  ktpUrl: z.string().optional(),
  npwpUrl: z.string().optional(),
  bpjsUrl: z.string().optional(),
  ijazahUrl: z.string().optional(),
  dokumenLainUrl: z.string().optional(),
});

// ─── Integritas ──────────────────────────────────────────────────────────────

export const integritasSchema = z.object({
  userId,
  tanggalPernyataan: isoDate.optional(),
  statusTandaTangan: z.boolean().optional(),
  catatan: z.string().optional(),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export type PegawaiCreateInput = z.infer<typeof pegawaiCreateSchema>;
export type PegawaiUpdateInput = z.infer<typeof pegawaiUpdateSchema>;
export type BiodataInput = z.infer<typeof biodataSchema>;
export type KeluargaCreateInput = z.infer<typeof keluargaCreateSchema>;
export type KeluargaUpdateInput = z.infer<typeof keluargaUpdateSchema>;
export type PendidikanCreateInput = z.infer<typeof pendidikanCreateSchema>;
export type PendidikanUpdateInput = z.infer<typeof pendidikanUpdateSchema>;
export type PekerjaanCreateInput = z.infer<typeof pekerjaanCreateSchema>;
export type PekerjaanUpdateInput = z.infer<typeof pekerjaanUpdateSchema>;
export type KesehatanInput = z.infer<typeof kesehatanSchema>;
export type IntegritasInput = z.infer<typeof integritasSchema>;
export type KelengkapanInput = z.infer<typeof kelengkapanSchema>;
