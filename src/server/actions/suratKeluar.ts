"use server";

import { desc, eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { revalidateDashboardTag } from "@/server/actions/statistics";
import { DASHBOARD_TAGS } from "@/lib/dashboard-cache-tags";
import { PDFDocument } from "pdf-lib";
import { z } from "zod";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import {
  suratKeluar,
  auditLog,
  divisi,
  users,
  pejabatPenandatangan,
} from "@/server/db/schema";
import { getStorageProvider } from "@/lib/storage";
import {
  parseDataUrl,
  prepareUploadPayload,
  sanitizeFileName,
} from "@/lib/storage/utils";
import { allocateNomorSurat } from "@/lib/nomor-surat";
import { resolveNomorSuratParams } from "@/lib/nomor-surat-helpers";
import {
  buildVerifikasiSuratPayload,
  generateQRDataURL,
} from "@/lib/qr/generateQR";
import {
  suratKeluarCreateSchema,
  suratKeluarUpdateSchema,
} from "@/lib/validators/suratKeluar.schema";
import { requirePermission, requireSession } from "./auth";
import {
  notifySuratKeluarApproval,
  notifySuratKeluarRevisi,
  notifySuratKeluarSelesai,
} from "./notifications";
import { uploadFileSchema, uuidIdSchema } from "@/lib/validators/common";
import { parseIsoDateInJakarta } from "@/lib/utils";
import { enforceUploadRateLimit } from "@/lib/rate-limit/upload-guard";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SuratKeluarRow = {
  id: string;
  nomorSurat: string | null;
  perihal: string;
  tujuan: string;
  tujuanAlamat: string | null;
  tanggalSurat: string;
  jenisSurat: string;
  isiSingkat: string | null;
  status: string | null;
  prosesViaSimpeg: boolean;
  catatSaja: boolean;
  fileDraftUrl: string | null;
  fileFinalUrl: string | null;
  lampiranUrl: string | null;
  qrCodeUrl: string | null;
  catatanReviu: string | null;
  catatanReviuAt: Date | null;
  pejabatId: number | null;
  divisiId: number | null;
  divisiNama: string | null;
  dibuatOleh: string | null;
  dibuatOlehNama: string | null;
  pejabatNama: string | null;
  tentang: string | null;
  tanggalBerlaku: string | null;
  tanggalBerakhir: string | null;
  pihakKedua: string | null;
  pihakKeduaAlamat: string | null;
  nilaiKerjasama: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type PejabatOption = {
  id: number;
  namaJabatan: string;
};

export type DivisiOption = {
  id: number;
  nama: string;
  kode: string | null;
};

export type SuratKeluarReviewRow = SuratKeluarRow & {
  pejabatUserId: string | null;
};

const idSchema = uuidIdSchema;
const bulkAssignNomorSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});
const stampQrPdfSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string().min(1, "Nama file wajib ada."),
  contentType: z.string().min(1).optional(),
  dataUrl: z.string().min(1, "Data file wajib ada."),
  placement: z.enum(["bottom-right", "bottom-left", "top-right", "top-left"]),
});
const manualNomorSuratSchema = z.object({
  id: z.string().uuid(),
  nomorSurat: z.string().min(1, "Nomor surat wajib diisi.").max(200),
});

async function ensureSuratStatus(
  id: string,
  allowedStatuses: Array<NonNullable<typeof suratKeluar.$inferSelect.status>>,
) {
  const [existing] = await db
    .select({ status: suratKeluar.status })
    .from(suratKeluar)
    .where(eq(suratKeluar.id, id));

  if (!existing) {
    return { ok: false as const, error: "Surat tidak ditemukan." };
  }

  const status = existing.status ?? "draft";
  if (!allowedStatuses.includes(status)) {
    return {
      ok: false as const,
      error: `Transisi tidak valid dari status ${status}.`,
    };
  }

  return { ok: true as const, status };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listSuratKeluar(): Promise<SuratKeluarRow[]> {
  await requireSession();
  return db
    .select({
      id: suratKeluar.id,
      nomorSurat: suratKeluar.nomorSurat,
      perihal: suratKeluar.perihal,
      tujuan: suratKeluar.tujuan,
      tujuanAlamat: suratKeluar.tujuanAlamat,
      tanggalSurat: suratKeluar.tanggalSurat,
      jenisSurat: suratKeluar.jenisSurat,
      isiSingkat: suratKeluar.isiSingkat,
      status: suratKeluar.status,
      prosesViaSimpeg: suratKeluar.prosesViaSimpeg,
      catatSaja: suratKeluar.catatSaja,
      fileDraftUrl: suratKeluar.fileDraftUrl,
      fileFinalUrl: suratKeluar.fileFinalUrl,
      lampiranUrl: suratKeluar.lampiranUrl,
      qrCodeUrl: suratKeluar.qrCodeUrl,
      catatanReviu: suratKeluar.catatanReviu,
      catatanReviuAt: suratKeluar.catatanReviuAt,
      pejabatId: suratKeluar.pejabatId,
      divisiId: suratKeluar.divisiId,
      divisiNama: divisi.nama,
      dibuatOleh: suratKeluar.dibuatOleh,
      dibuatOlehNama: users.namaLengkap,
      pejabatNama: pejabatPenandatangan.namaJabatan,
      tentang: suratKeluar.tentang,
      tanggalBerlaku: suratKeluar.tanggalBerlaku,
      tanggalBerakhir: suratKeluar.tanggalBerakhir,
      pihakKedua: suratKeluar.pihakKedua,
      pihakKeduaAlamat: suratKeluar.pihakKeduaAlamat,
      nilaiKerjasama: suratKeluar.nilaiKerjasama,
      createdAt: suratKeluar.createdAt,
      updatedAt: suratKeluar.updatedAt,
    })
    .from(suratKeluar)
    .leftJoin(divisi, eq(suratKeluar.divisiId, divisi.id))
    .leftJoin(users, eq(suratKeluar.dibuatOleh, users.id))
    .leftJoin(pejabatPenandatangan, eq(suratKeluar.pejabatId, pejabatPenandatangan.id))
    .orderBy(desc(suratKeluar.tanggalSurat))
    .limit(100);
}

export async function listPejabatAktif(): Promise<PejabatOption[]> {
  await requireSession();
  return db
    .select({
      id: pejabatPenandatangan.id,
      namaJabatan: pejabatPenandatangan.namaJabatan,
    })
    .from(pejabatPenandatangan)
    .where(eq(pejabatPenandatangan.isActive, true))
    .orderBy(pejabatPenandatangan.namaJabatan);
}

export async function listDivisiOptions(): Promise<DivisiOption[]> {
  await requireSession();
  return db
    .select({ id: divisi.id, nama: divisi.nama, kode: divisi.kode })
    .from(divisi)
    .orderBy(divisi.nama);
}

export async function getSuratKeluarById(id: string) {
  await requireSession();
  const [row] = await db
    .select()
    .from(suratKeluar)
    .where(eq(suratKeluar.id, id));
  return row ?? null;
}

export async function getSuratKeluarReviewById(
  id: string,
): Promise<SuratKeluarReviewRow | null> {
  await requirePermission("suratKeluar", "approve");
  const [row] = await db
    .select({
      id: suratKeluar.id,
      nomorSurat: suratKeluar.nomorSurat,
      perihal: suratKeluar.perihal,
      tujuan: suratKeluar.tujuan,
      tujuanAlamat: suratKeluar.tujuanAlamat,
      tanggalSurat: suratKeluar.tanggalSurat,
      jenisSurat: suratKeluar.jenisSurat,
      isiSingkat: suratKeluar.isiSingkat,
      status: suratKeluar.status,
      prosesViaSimpeg: suratKeluar.prosesViaSimpeg,
      catatSaja: suratKeluar.catatSaja,
      fileDraftUrl: suratKeluar.fileDraftUrl,
      fileFinalUrl: suratKeluar.fileFinalUrl,
      lampiranUrl: suratKeluar.lampiranUrl,
      qrCodeUrl: suratKeluar.qrCodeUrl,
      catatanReviu: suratKeluar.catatanReviu,
      catatanReviuAt: suratKeluar.catatanReviuAt,
      pejabatId: suratKeluar.pejabatId,
      divisiId: suratKeluar.divisiId,
      divisiNama: divisi.nama,
      dibuatOleh: suratKeluar.dibuatOleh,
      dibuatOlehNama: users.namaLengkap,
      pejabatNama: pejabatPenandatangan.namaJabatan,
      pejabatUserId: pejabatPenandatangan.userId,
      tentang: suratKeluar.tentang,
      tanggalBerlaku: suratKeluar.tanggalBerlaku,
      tanggalBerakhir: suratKeluar.tanggalBerakhir,
      pihakKedua: suratKeluar.pihakKedua,
      pihakKeduaAlamat: suratKeluar.pihakKeduaAlamat,
      nilaiKerjasama: suratKeluar.nilaiKerjasama,
      createdAt: suratKeluar.createdAt,
      updatedAt: suratKeluar.updatedAt,
    })
    .from(suratKeluar)
    .leftJoin(divisi, eq(suratKeluar.divisiId, divisi.id))
    .leftJoin(users, eq(suratKeluar.dibuatOleh, users.id))
    .leftJoin(pejabatPenandatangan, eq(suratKeluar.pejabatId, pejabatPenandatangan.id))
    .where(eq(suratKeluar.id, id));

  return row ?? null;
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createSuratKeluar(data: unknown) {
  const parsed = suratKeluarCreateSchema.parse(data);
  const session = await requirePermission("suratKeluar", "create");

  const [row] = await db
    .insert(suratKeluar)
    .values({
      id: crypto.randomUUID(),
      ...parsed,
      dibuatOleh: session.user.id,
      status: "draft",
    })
    .returning();

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_SURAT_KELUAR",
    entitasType: "surat_keluar",
    entitasId: row!.id,
    detail: { perihal: parsed.perihal, tujuan: parsed.tujuan },
  });

  revalidatePath("/surat-keluar");
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  return { ok: true as const, data: row! };
}

export async function uploadSuratKeluarDraft(data: unknown) {
  const parsed = uploadFileSchema.parse(data);
  const session = await requirePermission("suratKeluar", "create");
  enforceUploadRateLimit(session.user.id);
  const prepared = prepareUploadPayload(parsed);

  const storage = getStorageProvider();
  const uploaded = await storage.upload({
    body: prepared.body,
    fileName: prepared.fileName,
    contentType: prepared.contentType,
    folder: "surat-keluar/draft",
  });

  return {
    ok: true as const,
    data: uploaded,
  };
}

export async function uploadSuratKeluarLampiran(data: unknown) {
  const parsed = uploadFileSchema.parse(data);
  const session = await requirePermission("suratKeluar", "create");
  enforceUploadRateLimit(session.user.id);
  const prepared = prepareUploadPayload(parsed);

  const storage = getStorageProvider();
  const uploaded = await storage.upload({
    body: prepared.body,
    fileName: prepared.fileName,
    contentType: prepared.contentType,
    folder: "surat-keluar/lampiran",
  });

  return {
    ok: true as const,
    data: uploaded,
  };
}

export async function uploadSuratKeluarFinal(data: unknown) {
  const parsed = z
    .object({
      id: z.string().uuid(),
      fileName: z.string().min(1, "Nama file wajib ada."),
      contentType: z.string().min(1).optional(),
      dataUrl: z.string().min(1, "Data file wajib ada."),
    })
    .parse(data);
  const session = await requirePermission("suratKeluar", "generate");
  enforceUploadRateLimit(session.user.id);
  const prepared = prepareUploadPayload(parsed);

  const [existing] = await db
    .select({ status: suratKeluar.status })
    .from(suratKeluar)
    .where(eq(suratKeluar.id, parsed.id));

  if (!existing) {
    return { ok: false as const, error: "Surat tidak ditemukan." };
  }

  if (existing.status !== "pengarsipan" && existing.status !== "selesai") {
    return {
      ok: false as const,
      error: "File final hanya boleh diunggah saat pengarsipan atau setelah selesai.",
    };
  }

  const storage = getStorageProvider();
  const uploaded = await storage.upload({
    body: prepared.body,
    fileName: prepared.fileName,
    contentType: prepared.contentType,
    folder: "surat-keluar/final",
  });

  await db
    .update(suratKeluar)
    .set({
      fileFinalUrl: uploaded.url,
      updatedAt: new Date(),
    })
    .where(eq(suratKeluar.id, parsed.id));

  revalidatePath("/surat-keluar");
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  return { ok: true as const, data: uploaded };
}

export async function stampQrToSuratKeluarPdf(data: unknown) {
  const parsed = stampQrPdfSchema.parse(data);
  const session = await requirePermission("suratKeluar", "generate");
  enforceUploadRateLimit(session.user.id);
  const prepared = prepareUploadPayload(parsed);

  if (prepared.contentType !== "application/pdf") {
    return { ok: false as const, error: "Fitur ini hanya mendukung file PDF." };
  }

  const [existing] = await db
    .select({
      status: suratKeluar.status,
      qrCodeUrl: suratKeluar.qrCodeUrl,
      nomorSurat: suratKeluar.nomorSurat,
    })
    .from(suratKeluar)
    .where(eq(suratKeluar.id, parsed.id));

  if (!existing) {
    return { ok: false as const, error: "Surat tidak ditemukan." };
  }

  if (existing.status !== "pengarsipan" && existing.status !== "selesai") {
    return {
      ok: false as const,
      error: "QR hanya bisa dibubuhkan saat pengarsipan atau setelah selesai.",
    };
  }

  if (!existing.qrCodeUrl) {
    return {
      ok: false as const,
      error: "Generate QR verifikasi terlebih dahulu.",
    };
  }

  const qrParsed = parseDataUrl(existing.qrCodeUrl);
  const pdfDoc = await PDFDocument.load(prepared.body);
  const qrImage = await pdfDoc.embedPng(qrParsed.body);
  const pages = pdfDoc.getPages();
  const targetPage = pages[pages.length - 1];

  if (!targetPage) {
    return {
      ok: false as const,
      error: "PDF tidak memiliki halaman yang dapat diproses.",
    };
  }

  const qrSize = 92;
  const margin = 36;
  const { width, height } = targetPage.getSize();
  const positionMap = {
    "bottom-right": { x: width - qrSize - margin, y: margin },
    "bottom-left": { x: margin, y: margin },
    "top-right": { x: width - qrSize - margin, y: height - qrSize - margin },
    "top-left": { x: margin, y: height - qrSize - margin },
  } as const;
  const position = positionMap[parsed.placement];

  targetPage.drawImage(qrImage, {
    x: position.x,
    y: position.y,
    width: qrSize,
    height: qrSize,
  });

  const stampedBytes = await pdfDoc.save();
  const safeInputName = sanitizeFileName(parsed.fileName);
  const stampedName = safeInputName.toLowerCase().endsWith(".pdf")
    ? safeInputName.replace(/\.pdf$/i, "-qr.pdf")
    : `${safeInputName}-qr.pdf`;

  const storage = getStorageProvider();
  const uploaded = await storage.upload({
    body: Buffer.from(stampedBytes),
    fileName: stampedName,
    contentType: "application/pdf",
    folder: "surat-keluar/final",
  });

  await db
    .update(suratKeluar)
    .set({
      fileFinalUrl: uploaded.url,
      updatedAt: new Date(),
    })
    .where(eq(suratKeluar.id, parsed.id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "STAMP_QR_PDF_SURAT_KELUAR",
    entitasType: "surat_keluar",
    entitasId: parsed.id,
    detail: {
      placement: parsed.placement,
      fileName: stampedName,
    },
  });

  revalidatePath("/surat-keluar");
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  return { ok: true as const, data: uploaded };
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateSuratKeluar(data: unknown) {
  const parsed = suratKeluarUpdateSchema.parse(data);
  const session = await requirePermission("suratKeluar", "update");

  const [existing] = await db
    .select({ status: suratKeluar.status })
    .from(suratKeluar)
    .where(eq(suratKeluar.id, parsed.id));

  if (!existing) return { ok: false as const, error: "Surat tidak ditemukan." };
  if (existing.status !== "draft") {
    return {
      ok: false as const,
      error: "Surat hanya bisa diubah saat berstatus Draft.",
    };
  }

  const { id, ...rest } = parsed;
  const [row] = await db
    .update(suratKeluar)
    .set({ ...rest, updatedAt: new Date() })
    .where(eq(suratKeluar.id, id))
    .returning();

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_SURAT_KELUAR",
    entitasType: "surat_keluar",
    entitasId: id,
    detail: { perihal: parsed.perihal },
  });

  revalidatePath("/surat-keluar");
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  return { ok: true as const, data: row! };
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteSuratKeluar(data: { id: string }) {
  const { id } = idSchema.parse(data);
  const session = await requirePermission("suratKeluar", "delete");

  const [existing] = await db
    .select({ status: suratKeluar.status, perihal: suratKeluar.perihal })
    .from(suratKeluar)
    .where(eq(suratKeluar.id, id));

  if (!existing) return { ok: false as const, error: "Surat tidak ditemukan." };
  if (existing.status !== "draft" && existing.status !== "dibatalkan") {
    return {
      ok: false as const,
      error: "Hanya surat berstatus Draft atau Dibatalkan yang dapat dihapus.",
    };
  }

  await db.delete(suratKeluar).where(eq(suratKeluar.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_SURAT_KELUAR",
    entitasType: "surat_keluar",
    entitasId: id,
    detail: null,
  });

  revalidatePath("/surat-keluar");
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  return { ok: true as const };
}

// ─── Status Transitions ───────────────────────────────────────────────────────

export async function ajukanPersetujuan(data: { id: string }) {
  const { id } = idSchema.parse(data);
  const session = await requirePermission("suratKeluar", "update");

  const [existing] = await db
    .select({
      status: suratKeluar.status,
      perihal: suratKeluar.perihal,
      tujuan: suratKeluar.tujuan,
      dibuatOleh: suratKeluar.dibuatOleh,
      pejabatId: suratKeluar.pejabatId,
      prosesViaSimpeg: suratKeluar.prosesViaSimpeg,
    })
    .from(suratKeluar)
    .where(eq(suratKeluar.id, id));

  if (!existing) return { ok: false as const, error: "Surat tidak ditemukan." };
  if (existing.status !== "draft") {
    return {
      ok: false as const,
      error: "Surat harus berstatus Draft untuk diajukan.",
    };
  }

  if (existing.prosesViaSimpeg) {
    return {
      ok: false as const,
      error: "Surat yang diproses di SIMPEG IAI tidak perlu diajukan untuk persetujuan di Arka.",
    };
  }

  await db
    .update(suratKeluar)
    .set({ status: "permohonan_persetujuan", updatedAt: new Date() })
    .where(eq(suratKeluar.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "AJUKAN_PERSETUJUAN_SURAT_KELUAR",
    entitasType: "surat_keluar",
    entitasId: id,
    detail: null,
  });

  // Notify pejabat that approval is needed
  if (existing.pejabatId) {
    const [pejabatUser] = await db
      .select({ userId: pejabatPenandatangan.userId })
      .from(pejabatPenandatangan)
      .where(eq(pejabatPenandatangan.id, existing.pejabatId))
      .limit(1);

    if (pejabatUser?.userId) {
      const pengirimNama = (session.user as { namaLengkap?: string; name?: string }).namaLengkap
        ?? session.user.name
        ?? "Pengirim";
      void notifySuratKeluarApproval(
        pejabatUser.userId,
        pengirimNama,
        existing.perihal,
        id,
        existing.prosesViaSimpeg,
        existing.tujuan,
      );
    }
  }

  revalidatePath("/surat-keluar");
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  return { ok: true as const };
}

export async function lanjutkanSimpegKePengarsipan(data: { id: string }) {
  const { id } = idSchema.parse(data);
  const session = await requirePermission("suratKeluar", "update");

  const [existing] = await db
    .select({
      status: suratKeluar.status,
      prosesViaSimpeg: suratKeluar.prosesViaSimpeg,
    })
    .from(suratKeluar)
    .where(eq(suratKeluar.id, id));

  if (!existing) return { ok: false as const, error: "Surat tidak ditemukan." };
  if (!existing.prosesViaSimpeg) {
    return {
      ok: false as const,
      error: "Aksi ini hanya untuk surat yang diproses di SIMPEG IAI.",
    };
  }
  if (existing.status !== "draft") {
    return {
      ok: false as const,
      error: "Surat SIMPEG harus berstatus Draft untuk masuk pengarsipan.",
    };
  }

  await db
    .update(suratKeluar)
    .set({
      status: "pengarsipan",
      updatedAt: new Date(),
    })
    .where(eq(suratKeluar.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "LANJUTKAN_SIMPEG_SURAT_KELUAR_KE_PENGARSIPAN",
    entitasType: "surat_keluar",
    entitasId: id,
    detail: { prosesViaSimpeg: true },
  });

  revalidatePath("/surat-keluar");
  revalidatePath(`/surat-keluar/review/${id}`);
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  return { ok: true as const };
}

export async function selesaikanCatatSaja(data: { id: string }) {
  const { id } = idSchema.parse(data);
  const session = await requirePermission("suratKeluar", "update");

  const [existing] = await db
    .select({
      status: suratKeluar.status,
      catatSaja: suratKeluar.catatSaja,
    })
    .from(suratKeluar)
    .where(eq(suratKeluar.id, id));

  if (!existing) return { ok: false as const, error: "Surat tidak ditemukan." };
  if (!existing.catatSaja) {
    return {
      ok: false as const,
      error: "Aksi ini hanya untuk surat dengan mode Catat Saja.",
    };
  }
  if (existing.status !== "draft") {
    return {
      ok: false as const,
      error: "Surat harus berstatus Draft untuk diselesaikan langsung.",
    };
  }

  await db
    .update(suratKeluar)
    .set({
      status: "selesai",
      updatedAt: new Date(),
    })
    .where(eq(suratKeluar.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "SELESAIKAN_CATAT_SAJA_SURAT_KELUAR",
    entitasType: "surat_keluar",
    entitasId: id,
    detail: { catatSaja: true },
  });

  revalidatePath("/surat-keluar");
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  return { ok: true as const };
}

export async function mulaiReviu(data: { id: string }) {
  const { id } = idSchema.parse(data);
  const session = await requirePermission("suratKeluar", "approve");

  const guard = await ensureSuratStatus(id, ["permohonan_persetujuan"]);
  if (!guard.ok) return guard;

  const rows = await db
    .update(suratKeluar)
    .set({ status: "reviu", updatedAt: new Date() })
    .where(
      and(
        eq(suratKeluar.id, id),
        eq(suratKeluar.status, "permohonan_persetujuan"),
      ),
    )
    .returning({ id: suratKeluar.id });

  if (!rows[0]) {
    return { ok: false as const, error: "Surat tidak dapat masuk ke tahap reviu." };
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "MULAI_REVIU_SURAT_KELUAR",
    entitasType: "surat_keluar",
    entitasId: id,
    detail: null,
  });

  revalidatePath("/surat-keluar");
  revalidatePath(`/surat-keluar/review/${id}`);
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  return { ok: true as const };
}

export async function setujuiSurat(data: { id: string }) {
  const { id } = idSchema.parse(data);
  const session = await requirePermission("suratKeluar", "approve");

  const guard = await ensureSuratStatus(id, ["permohonan_persetujuan", "reviu"]);
  if (!guard.ok) return guard;

  await db
    .update(suratKeluar)
    .set({
      status: "pengarsipan",
      disetujuiOleh: session.user.id,
      tanggalDisetujui: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(suratKeluar.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "SETUJUI_SURAT_KELUAR",
    entitasType: "surat_keluar",
    entitasId: id,
    detail: null,
  });

  revalidatePath("/surat-keluar");
  revalidatePath(`/surat-keluar/review/${id}`);
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  return { ok: true as const };
}

export async function tolakSurat(data: { id: string; catatanReviu: string }) {
  const parsed = z
    .object({
      id: z.string().uuid(),
      catatanReviu: z.string().min(1, "Catatan reviu wajib diisi"),
    })
    .parse(data);
  const session = await requirePermission("suratKeluar", "approve");

  const guard = await ensureSuratStatus(parsed.id, [
    "permohonan_persetujuan",
    "reviu",
  ]);
  if (!guard.ok) return guard;

  const [existing] = await db
    .select({ perihal: suratKeluar.perihal, dibuatOleh: suratKeluar.dibuatOleh })
    .from(suratKeluar)
    .where(eq(suratKeluar.id, parsed.id));

  await db
    .update(suratKeluar)
    .set({
      status: "draft",
      catatanReviu: parsed.catatanReviu,
      catatanReviuAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(suratKeluar.id, parsed.id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "TOLAK_SURAT_KELUAR",
    entitasType: "surat_keluar",
    entitasId: parsed.id,
    detail: { catatanReviu: parsed.catatanReviu },
  });

  // Notify creator about revision request
  if (existing?.dibuatOleh) {
    const pejabatNama = (session.user as { namaLengkap?: string; name?: string }).namaLengkap
      ?? session.user.name
      ?? "Pejabat";
    void notifySuratKeluarRevisi(
      existing.dibuatOleh,
      pejabatNama,
      existing.perihal,
      parsed.catatanReviu,
      parsed.id
    );
  }

  revalidatePath("/surat-keluar");
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  return { ok: true as const };
}

export async function selesaikanSurat(data: { id: string }) {
  const { id } = idSchema.parse(data);
  const session = await requirePermission("suratKeluar", "approve");

  const guard = await ensureSuratStatus(id, ["pengarsipan"]);
  if (!guard.ok) return guard;

  const [existing] = await db
    .select({
      nomorSurat: suratKeluar.nomorSurat,
      qrCodeUrl: suratKeluar.qrCodeUrl,
      fileFinalUrl: suratKeluar.fileFinalUrl,
      perihal: suratKeluar.perihal,
      dibuatOleh: suratKeluar.dibuatOleh,
    })
    .from(suratKeluar)
    .where(eq(suratKeluar.id, id));

  if (!existing?.nomorSurat) {
    return {
      ok: false as const,
      error: "Nomor surat harus digenerate sebelum pengarsipan diselesaikan.",
    };
  }

  if (!existing.qrCodeUrl) {
    return {
      ok: false as const,
      error: "QR verifikasi harus digenerate sebelum pengarsipan diselesaikan.",
    };
  }

  if (!existing.fileFinalUrl) {
    return {
      ok: false as const,
      error: "File final harus diunggah sebelum pengarsipan diselesaikan.",
    };
  }

  await db
    .update(suratKeluar)
    .set({ status: "selesai", updatedAt: new Date() })
    .where(eq(suratKeluar.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "SELESAIKAN_SURAT_KELUAR",
    entitasType: "surat_keluar",
    entitasId: id,
    detail: null,
  });

  // Notify creator that surat is complete
  if (existing.dibuatOleh) {
    void notifySuratKeluarSelesai(
      existing.dibuatOleh,
      existing.perihal,
      existing.nomorSurat,
      id
    );
  }

  revalidatePath("/surat-keluar");
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  return { ok: true as const };
}

export async function generateQrSuratKeluar(data: { id: string }) {
  const { id } = idSchema.parse(data);
  const session = await requirePermission("suratKeluar", "generate");

  const [surat] = await db
    .select({
      id: suratKeluar.id,
      nomorSurat: suratKeluar.nomorSurat,
      status: suratKeluar.status,
    })
    .from(suratKeluar)
    .where(eq(suratKeluar.id, id));

  if (!surat) {
    return { ok: false as const, error: "Surat tidak ditemukan." };
  }

  if (surat.status !== "pengarsipan" && surat.status !== "selesai") {
    return {
      ok: false as const,
      error: "QR verifikasi hanya bisa digenerate saat pengarsipan atau setelah selesai.",
    };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const verificationUrl = buildVerifikasiSuratPayload({
    appUrl,
    jenis: "surat-keluar",
    id: surat.id,
    nomor: surat.nomorSurat,
  });
  const qrCodeUrl = await generateQRDataURL(verificationUrl, { size: 512 });

  await db
    .update(suratKeluar)
    .set({ qrCodeUrl, updatedAt: new Date() })
    .where(eq(suratKeluar.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "GENERATE_QR_SURAT_KELUAR",
    entitasType: "surat_keluar",
    entitasId: id,
    detail: { verificationUrl },
  });

  revalidatePath("/surat-keluar");
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  return { ok: true as const, qrCodeUrl, verificationUrl };
}

export type SuratKeluarVerificationRow = {
  id: string;
  nomorSurat: string | null;
  perihal: string;
  tujuan: string;
  tanggalSurat: string;
  jenisSurat: string;
  status: string | null;
  qrCodeUrl: string | null;
  pejabatNama: string | null;
  fileFinalUrl: string | null;
  tentang: string | null;
  tanggalBerlaku: string | null;
  tanggalBerakhir: string | null;
  pihakKedua: string | null;
  pihakKeduaAlamat: string | null;
  nilaiKerjasama: string | null;
};

export async function getSuratKeluarVerificationById(
  id: string,
): Promise<SuratKeluarVerificationRow | null> {
  const [row] = await db
    .select({
      id: suratKeluar.id,
      nomorSurat: suratKeluar.nomorSurat,
      perihal: suratKeluar.perihal,
      tujuan: suratKeluar.tujuan,
      tanggalSurat: suratKeluar.tanggalSurat,
      jenisSurat: suratKeluar.jenisSurat,
      status: suratKeluar.status,
      qrCodeUrl: suratKeluar.qrCodeUrl,
      pejabatNama: pejabatPenandatangan.namaJabatan,
      fileFinalUrl: suratKeluar.fileFinalUrl,
      tentang: suratKeluar.tentang,
      tanggalBerlaku: suratKeluar.tanggalBerlaku,
      tanggalBerakhir: suratKeluar.tanggalBerakhir,
      pihakKedua: suratKeluar.pihakKedua,
      pihakKeduaAlamat: suratKeluar.pihakKeduaAlamat,
      nilaiKerjasama: suratKeluar.nilaiKerjasama,
    })
    .from(suratKeluar)
    .leftJoin(pejabatPenandatangan, eq(suratKeluar.pejabatId, pejabatPenandatangan.id))
    .where(eq(suratKeluar.id, id));

  return row ?? null;
}

export async function batalkanSurat(data: { id: string }) {
  const { id } = idSchema.parse(data);
  const session = await requirePermission("suratKeluar", "delete");

  const guard = await ensureSuratStatus(id, [
    "draft",
    "permohonan_persetujuan",
    "reviu",
    "pengarsipan",
    "selesai",
  ]);
  if (!guard.ok) return guard;

  await db
    .update(suratKeluar)
    .set({ status: "dibatalkan", updatedAt: new Date() })
    .where(eq(suratKeluar.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "BATALKAN_SURAT_KELUAR",
    entitasType: "surat_keluar",
    entitasId: id,
    detail: { mode: "tandai_tidak_berlaku" },
  });

  revalidatePath("/surat-keluar");
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  return { ok: true as const };
}

// ─── Generate & Assign Nomor Surat ───────────────────────────────────────────
// Atomic: counter increment + nomorSurat assignment dalam satu DB transaction.

export async function assignNomorSuratKeluar(data: { id: string }) {
  const { id } = idSchema.parse(data);
  const session = await requirePermission("suratKeluar", "assign");
  const [surat] = await db
    .select({
      nomorSurat: suratKeluar.nomorSurat,
      tanggalSurat: suratKeluar.tanggalSurat,
      jenisSurat: suratKeluar.jenisSurat,
      status: suratKeluar.status,
    })
    .from(suratKeluar)
    .where(eq(suratKeluar.id, id));

  if (!surat) {
    return { ok: false as const, error: "Surat tidak ditemukan." };
  }

  if (surat.nomorSurat) {
    return { ok: false as const, error: "Nomor surat sudah digenerate." };
  }

  if (surat.status === "selesai" || surat.status === "dibatalkan") {
    return {
      ok: false as const,
      error: "Nomor surat tidak bisa digenerate untuk surat yang sudah selesai atau dibatalkan.",
    };
  }

  const tanggal = parseIsoDateInJakarta(surat.tanggalSurat);
  const bulan = tanggal.getMonth() + 1;
  const tahun = tanggal.getFullYear();

  const { kodeJenis, prefixOrganisasi } = await resolveNomorSuratParams(surat.jenisSurat);

  const result = await allocateNomorSurat({
    tahun,
    bulan,
    kodeJenis,
    prefixOrganisasi,
  });
  const nomorSurat = result.nomorList[0];

  const updated = await db
    .update(suratKeluar)
    .set({ nomorSurat, updatedAt: new Date() })
    .where(and(eq(suratKeluar.id, id), sql`${suratKeluar.nomorSurat} IS NULL`))
    .returning({ id: suratKeluar.id });

  if (!updated[0]) {
    return {
      ok: false as const,
      error: "Nomor surat gagal disimpan karena data berubah. Coba muat ulang.",
    };
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "ASSIGN_NOMOR_SURAT_KELUAR",
    entitasType: "surat_keluar",
    entitasId: id,
    detail: { nomorSurat },
  });

  revalidatePath("/surat-keluar");
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  return { ok: true as const, nomorSurat };
}

export async function setManualNomorSuratKeluar(data: unknown) {
  const parsed = manualNomorSuratSchema.parse(data);
  const session = await requirePermission("suratKeluar", "assign");
  const nomorSurat = parsed.nomorSurat.trim();

  const guard = await ensureSuratStatus(parsed.id, [
    "draft",
    "permohonan_persetujuan",
    "reviu",
    "pengarsipan",
  ]);
  if (!guard.ok) return guard;

  const [duplicate] = await db
    .select({ id: suratKeluar.id })
    .from(suratKeluar)
    .where(
      and(
        eq(suratKeluar.nomorSurat, nomorSurat),
        sql`${suratKeluar.id} <> ${parsed.id}`,
      ),
    )
    .limit(1);

  if (duplicate) {
    return {
      ok: false as const,
      error: "Nomor surat tersebut sudah digunakan oleh surat lain.",
    };
  }

  const [updated] = await db
    .update(suratKeluar)
    .set({
      nomorSurat,
      qrCodeUrl: null,
      fileFinalUrl: null,
      updatedAt: new Date(),
    })
    .where(eq(suratKeluar.id, parsed.id))
    .returning({ id: suratKeluar.id });

  if (!updated) {
    return { ok: false as const, error: "Surat tidak ditemukan." };
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "SET_MANUAL_NOMOR_SURAT_KELUAR",
    entitasType: "surat_keluar",
    entitasId: parsed.id,
    detail: {
      nomorSurat,
      resetQrCode: true,
      resetFileFinal: true,
    },
  });

  revalidatePath("/surat-keluar");
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  return { ok: true as const, nomorSurat };
}

export async function checkNomorSuratKeluarAvailability(data: unknown) {
  const parsed = manualNomorSuratSchema.parse(data);
  await requirePermission("suratKeluar", "assign");
  const nomorSurat = parsed.nomorSurat.trim();

  if (!nomorSurat) {
    return {
      ok: true as const,
      available: false,
      message: "Nomor surat wajib diisi.",
    };
  }

  const [duplicate] = await db
    .select({ id: suratKeluar.id })
    .from(suratKeluar)
    .where(
      and(
        eq(suratKeluar.nomorSurat, nomorSurat),
        sql`${suratKeluar.id} <> ${parsed.id}`,
      ),
    )
    .limit(1);

  if (duplicate) {
    return {
      ok: true as const,
      available: false,
      message: "Nomor surat ini sudah digunakan oleh surat lain.",
    };
  }

  return {
    ok: true as const,
    available: true,
    message: "Nomor surat ini masih tersedia.",
  };
}

export async function bulkAssignNomorSuratKeluar(data: { ids: string[] }) {
  const { ids } = bulkAssignNomorSchema.parse(data);
  const session = await requirePermission("suratKeluar", "assign");

  const rows = await db
    .select({
      id: suratKeluar.id,
      nomorSurat: suratKeluar.nomorSurat,
      tanggalSurat: suratKeluar.tanggalSurat,
      jenisSurat: suratKeluar.jenisSurat,
      status: suratKeluar.status,
      perihal: suratKeluar.perihal,
      createdAt: suratKeluar.createdAt,
    })
    .from(suratKeluar)
    .where(sql`${suratKeluar.id} = ANY(${ids})`);

  if (rows.length !== ids.length) {
    return {
      ok: false as const,
      error: "Sebagian surat tidak ditemukan. Muat ulang data lalu coba lagi.",
    };
  }

  const invalidRows = rows.filter(
    (row) => row.nomorSurat || row.status === "selesai" || row.status === "dibatalkan",
  );
  if (invalidRows.length > 0) {
    return {
      ok: false as const,
      error:
        invalidRows.length === 1
          ? `Surat "${invalidRows[0]?.perihal}" tidak valid untuk generate nomor massal.`
          : `${invalidRows.length} surat tidak valid untuk generate nomor massal. Pastikan semua belum punya nomor dan belum berstatus selesai/dibatalkan.`,
    };
  }

  const orderedRows = [...rows].sort((a, b) => {
    const tanggalCompare =
      parseIsoDateInJakarta(a.tanggalSurat).getTime() -
      parseIsoDateInJakarta(b.tanggalSurat).getTime();
    if (tanggalCompare !== 0) return tanggalCompare;

    const createdCompare =
      (a.createdAt ? new Date(a.createdAt).getTime() : 0) -
      (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    if (createdCompare !== 0) return createdCompare;

    return a.id.localeCompare(b.id);
  });

  const assigned = await db.transaction(async (tx) => {
    const results: Array<{ id: string; nomorSurat: string; perihal: string }> = [];

    // Pre-resolve kodeJenis per unique jenisSurat in this batch
    const jenisSuratSet = [...new Set(orderedRows.map((r) => r.jenisSurat))];
    const kodeJenisMap = new Map<string, string>();
    for (const js of jenisSuratSet) {
      const { kodeJenis } = await resolveNomorSuratParams(js);
      kodeJenisMap.set(js, kodeJenis);
    }

    // Resolve prefixOrganisasi once
    const { prefixOrganisasi } = await resolveNomorSuratParams(jenisSuratSet[0]!);

    for (const row of orderedRows) {
      const tanggal = parseIsoDateInJakarta(row.tanggalSurat);
      const kodeJenis = kodeJenisMap.get(row.jenisSurat)!;
      const result = await allocateNomorSurat(
        {
          tahun: tanggal.getFullYear(),
          bulan: tanggal.getMonth() + 1,
          kodeJenis,
          prefixOrganisasi,
        },
        tx,
      );
      const nomorSurat = result.nomorList[0];

      if (!nomorSurat) {
        throw new Error("Gagal menggenerate nomor surat massal.");
      }

      const updated = await tx
        .update(suratKeluar)
        .set({ nomorSurat, updatedAt: new Date() })
        .where(and(eq(suratKeluar.id, row.id), sql`${suratKeluar.nomorSurat} IS NULL`))
        .returning({ id: suratKeluar.id });

      if (!updated[0]) {
        throw new Error("Sebagian surat berubah saat proses bulk berjalan. Coba lagi.");
      }

      results.push({
        id: row.id,
        nomorSurat,
        perihal: row.perihal,
      });
    }

    return results;
  });

  await writeAuditLog({
    userId: session.user.id,
    aksi: "BULK_ASSIGN_NOMOR_SURAT_KELUAR",
    entitasType: "surat_keluar",
    entitasId: assigned.map((item) => item.id).join(","),
    detail: {
      jumlah: assigned.length,
      ids: assigned.map((item) => item.id),
      nomorAwal: assigned[0]?.nomorSurat,
      nomorAkhir: assigned[assigned.length - 1]?.nomorSurat,
    },
  });

  revalidatePath("/surat-keluar");
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  return { ok: true as const, assigned };
}
