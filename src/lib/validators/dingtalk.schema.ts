import { z } from "zod";

export const absensiSyncSchema = z.object({
  tanggalMulai: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid (YYYY-MM-DD)"),
  tanggalSelesai: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid (YYYY-MM-DD)"),
  userIds: z.array(z.string()).optional(),
});

export type AbsensiSyncInput = z.infer<typeof absensiSyncSchema>;

export const pengajuanCutiCreateSchema = z.object({
  jenisCuti: z.enum(["tahunan", "kompensasi", "sakit", "melahirkan", "menikah", "kematian", "lainnya"]),
  tanggalMulai: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid"),
  tanggalSelesai: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal tidak valid"),
  jumlahHari: z.number().int().min(1, "Minimal 1 hari"),
  alasan: z.string().trim().max(1000).optional(),
  lampiranUrl: z.string().url().optional().or(z.literal("")),
});

export type PengajuanCutiCreateInput = z.infer<typeof pengajuanCutiCreateSchema>;

export const pengajuanCutiUpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["disetujui", "ditolak", "dibatalkan"]),
  rejectedReason: z.string().trim().max(500).optional(),
});

export type PengajuanCutiUpdateInput = z.infer<typeof pengajuanCutiUpdateSchema>;

export const dingtalkConfigSchema = z.object({
  appKey: z.string().trim().min(1, "App Key wajib diisi"),
  appSecret: z.string().trim().min(1, "App Secret wajib diisi"),
  syncIntervalMenit: z.number().int().min(15).max(1440).default(60),
});

export type DingtalkConfigInput = z.infer<typeof dingtalkConfigSchema>;

export const dingtalkUserMappingSchema = z.object({
  userId: z.string().min(1),
  dingtalkUserId: z.string().trim().min(1, "DingTalk User ID wajib diisi"),
});

export type DingtalkUserMappingInput = z.infer<typeof dingtalkUserMappingSchema>;
