"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import {
  auditLog,
  pejabatPenandatangan,
  suratKeputusan,
  users,
} from "@/server/db/schema";
import { getStorageProvider } from "@/lib/storage";
import { prepareUploadPayload } from "@/lib/storage/utils";
import {
  buildVerifikasiSuratPayload,
  generateQRDataURL,
} from "@/lib/qr/generateQR";
import {
  suratKeputusanCreateSchema,
  suratKeputusanUpdateSchema,
} from "@/lib/validators/suratKeputusan.schema";
import { requirePermission, requireSession } from "./auth";
import { uploadFileSchema, uuidIdSchema } from "@/lib/validators/common";
import { enforceUploadRateLimit } from "@/lib/rate-limit/upload-guard";

export type SuratKeputusanRow = {
  id: string;
  nomorSK: string;
  perihal: string;
  tentang: string;
  tanggalSK: string;
  tanggalBerlaku: string | null;
  tanggalBerakhir: string | null;
  pejabatId: number | null;
  pejabatNama: string | null;
  fileUrl: string | null;
  qrCodeUrl: string | null;
  dibuatOleh: string | null;
  dibuatOlehNama: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

const idSchema = uuidIdSchema;

export async function listSuratKeputusan(): Promise<SuratKeputusanRow[]> {
  await requireSession();
  return db
    .select({
      id: suratKeputusan.id,
      nomorSK: suratKeputusan.nomorSK,
      perihal: suratKeputusan.perihal,
      tentang: suratKeputusan.tentang,
      tanggalSK: suratKeputusan.tanggalSK,
      tanggalBerlaku: suratKeputusan.tanggalBerlaku,
      tanggalBerakhir: suratKeputusan.tanggalBerakhir,
      pejabatId: suratKeputusan.pejabatId,
      pejabatNama: pejabatPenandatangan.namaJabatan,
      fileUrl: suratKeputusan.fileUrl,
      qrCodeUrl: suratKeputusan.qrCodeUrl,
      dibuatOleh: suratKeputusan.dibuatOleh,
      dibuatOlehNama: users.namaLengkap,
      createdAt: suratKeputusan.createdAt,
      updatedAt: suratKeputusan.updatedAt,
    })
    .from(suratKeputusan)
    .leftJoin(pejabatPenandatangan, eq(suratKeputusan.pejabatId, pejabatPenandatangan.id))
    .leftJoin(users, eq(suratKeputusan.dibuatOleh, users.id))
    .orderBy(desc(suratKeputusan.createdAt))
    .limit(100);
}

export async function createSuratKeputusan(data: unknown) {
  const parsed = suratKeputusanCreateSchema.parse(data);
  const session = await requirePermission("suratKeputusan", "create");

  const [row] = await db
    .insert(suratKeputusan)
    .values({
      id: crypto.randomUUID(),
      ...parsed,
      dibuatOleh: session.user.id,
    })
    .returning();

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_SURAT_KEPUTUSAN",
    entitasType: "surat_keputusan",
    entitasId: row!.id,
    detail: { nomorSK: parsed.nomorSK, perihal: parsed.perihal },
  });

  revalidatePath("/surat-keputusan");
  return { ok: true as const, data: row! };
}

export async function updateSuratKeputusan(data: unknown) {
  const parsed = suratKeputusanUpdateSchema.parse(data);
  const session = await requirePermission("suratKeputusan", "update");

  const [existing] = await db
    .select({ id: suratKeputusan.id })
    .from(suratKeputusan)
    .where(eq(suratKeputusan.id, parsed.id));

  if (!existing) {
    return { ok: false as const, error: "Surat Keputusan tidak ditemukan." };
  }

  const { id, ...rest } = parsed;
  const [row] = await db
    .update(suratKeputusan)
    .set({ ...rest, updatedAt: new Date() })
    .where(eq(suratKeputusan.id, id))
    .returning();

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_SURAT_KEPUTUSAN",
    entitasType: "surat_keputusan",
    entitasId: id,
    detail: { nomorSK: row?.nomorSK ?? null, perihal: row?.perihal ?? null },
  });

  revalidatePath("/surat-keputusan");
  return { ok: true as const, data: row! };
}

export async function deleteSuratKeputusan(data: unknown) {
  const parsed = idSchema.parse(data);
  const session = await requirePermission("suratKeputusan", "delete");

  const [existing] = await db
    .select({ id: suratKeputusan.id, nomorSK: suratKeputusan.nomorSK })
    .from(suratKeputusan)
    .where(eq(suratKeputusan.id, parsed.id));

  if (!existing) {
    return { ok: false as const, error: "Surat Keputusan tidak ditemukan." };
  }

  await db.delete(suratKeputusan).where(eq(suratKeputusan.id, parsed.id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_SURAT_KEPUTUSAN",
    entitasType: "surat_keputusan",
    entitasId: parsed.id,
    detail: { nomorSK: existing.nomorSK },
  });

  revalidatePath("/surat-keputusan");
  return { ok: true as const };
}

export async function uploadSuratKeputusanFile(data: unknown) {
  const parsed = uploadFileSchema.parse(data);
  const session = await requirePermission("suratKeputusan", "create");
  enforceUploadRateLimit(session.user.id);
  const prepared = prepareUploadPayload(parsed);
  const storage = getStorageProvider();
  const uploaded = await storage.upload({
    body: prepared.body,
    fileName: prepared.fileName,
    contentType: prepared.contentType,
    folder: "surat-keputusan",
  });

  return { ok: true as const, data: uploaded };
}

export async function generateQrSuratKeputusan(data: { id: string }) {
  const parsed = idSchema.parse(data);
  const session = await requirePermission("suratKeputusan", "generate");

  const [row] = await db
    .select({
      id: suratKeputusan.id,
      nomorSK: suratKeputusan.nomorSK,
    })
    .from(suratKeputusan)
    .where(eq(suratKeputusan.id, parsed.id));

  if (!row) {
    return { ok: false as const, error: "Surat Keputusan tidak ditemukan." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const verificationUrl = buildVerifikasiSuratPayload({
    appUrl,
    jenis: "surat-keputusan",
    id: row.id,
    nomor: row.nomorSK,
  });
  const qrCodeUrl = await generateQRDataURL(verificationUrl, { size: 512 });

  await db
    .update(suratKeputusan)
    .set({ qrCodeUrl, updatedAt: new Date() })
    .where(eq(suratKeputusan.id, parsed.id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "GENERATE_QR_SURAT_KEPUTUSAN",
    entitasType: "surat_keputusan",
    entitasId: parsed.id,
    detail: { verificationUrl },
  });

  revalidatePath("/surat-keputusan");
  return { ok: true as const, qrCodeUrl, verificationUrl };
}

export type SuratKeputusanVerificationRow = {
  id: string;
  nomorSK: string;
  perihal: string;
  tentang: string;
  tanggalSK: string;
  pejabatNama: string | null;
  fileUrl: string | null;
  qrCodeUrl: string | null;
};

export async function getSuratKeputusanVerificationById(
  id: string,
): Promise<SuratKeputusanVerificationRow | null> {
  const [row] = await db
    .select({
      id: suratKeputusan.id,
      nomorSK: suratKeputusan.nomorSK,
      perihal: suratKeputusan.perihal,
      tentang: suratKeputusan.tentang,
      tanggalSK: suratKeputusan.tanggalSK,
      pejabatNama: pejabatPenandatangan.namaJabatan,
      fileUrl: suratKeputusan.fileUrl,
      qrCodeUrl: suratKeputusan.qrCodeUrl,
    })
    .from(suratKeputusan)
    .leftJoin(pejabatPenandatangan, eq(suratKeputusan.pejabatId, pejabatPenandatangan.id))
    .where(eq(suratKeputusan.id, id));

  return row ?? null;
}
