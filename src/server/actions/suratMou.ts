"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import {
  auditLog,
  pejabatPenandatangan,
  suratMou,
  users,
} from "@/server/db/schema";
import { getStorageProvider } from "@/lib/storage";
import { prepareUploadPayload } from "@/lib/storage/utils";
import {
  buildVerifikasiSuratPayload,
  generateQRDataURL,
} from "@/lib/qr/generateQR";
import {
  suratMouCreateSchema,
  suratMouUpdateSchema,
} from "@/lib/validators/suratMou.schema";
import { requirePermission, requireSession } from "./auth";
import { uploadFileSchema, uuidIdSchema } from "@/lib/validators/common";

export type SuratMouRow = {
  id: string;
  nomorMOU: string;
  perihal: string;
  pihakKedua: string;
  pihakKeduaAlamat: string | null;
  tanggalMOU: string;
  tanggalBerlaku: string | null;
  tanggalBerakhir: string | null;
  nilaiKerjasama: string | null;
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

export async function listSuratMou(): Promise<SuratMouRow[]> {
  await requireSession();
  return db
    .select({
      id: suratMou.id,
      nomorMOU: suratMou.nomorMOU,
      perihal: suratMou.perihal,
      pihakKedua: suratMou.pihakKedua,
      pihakKeduaAlamat: suratMou.pihakKeduaAlamat,
      tanggalMOU: suratMou.tanggalMOU,
      tanggalBerlaku: suratMou.tanggalBerlaku,
      tanggalBerakhir: suratMou.tanggalBerakhir,
      nilaiKerjasama: suratMou.nilaiKerjasama,
      pejabatId: suratMou.pejabatId,
      pejabatNama: pejabatPenandatangan.namaJabatan,
      fileUrl: suratMou.fileUrl,
      qrCodeUrl: suratMou.qrCodeUrl,
      dibuatOleh: suratMou.dibuatOleh,
      dibuatOlehNama: users.namaLengkap,
      createdAt: suratMou.createdAt,
      updatedAt: suratMou.updatedAt,
    })
    .from(suratMou)
    .leftJoin(pejabatPenandatangan, eq(suratMou.pejabatId, pejabatPenandatangan.id))
    .leftJoin(users, eq(suratMou.dibuatOleh, users.id))
    .orderBy(desc(suratMou.createdAt))
    .limit(100);
}

export async function createSuratMou(data: unknown) {
  const parsed = suratMouCreateSchema.parse(data);
  const session = await requirePermission("suratMou", "create");

  const [row] = await db
    .insert(suratMou)
    .values({
      id: crypto.randomUUID(),
      ...parsed,
      dibuatOleh: session.user.id,
    })
    .returning();

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_SURAT_MOU",
    entitasType: "surat_mou",
    entitasId: row!.id,
    detail: { nomorMOU: parsed.nomorMOU, perihal: parsed.perihal },
  });

  revalidatePath("/surat-mou");
  return { ok: true as const, data: row! };
}

export async function updateSuratMou(data: unknown) {
  const parsed = suratMouUpdateSchema.parse(data);
  const session = await requirePermission("suratMou", "update");

  const [existing] = await db
    .select({ id: suratMou.id })
    .from(suratMou)
    .where(eq(suratMou.id, parsed.id));

  if (!existing) {
    return { ok: false as const, error: "Surat MOU tidak ditemukan." };
  }

  const { id, ...rest } = parsed;
  const [row] = await db
    .update(suratMou)
    .set({ ...rest, updatedAt: new Date() })
    .where(eq(suratMou.id, id))
    .returning();

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_SURAT_MOU",
    entitasType: "surat_mou",
    entitasId: id,
    detail: { nomorMOU: row?.nomorMOU ?? null, perihal: row?.perihal ?? null },
  });

  revalidatePath("/surat-mou");
  return { ok: true as const, data: row! };
}

export async function deleteSuratMou(data: unknown) {
  const parsed = idSchema.parse(data);
  const session = await requirePermission("suratMou", "delete");

  const [existing] = await db
    .select({ id: suratMou.id, nomorMOU: suratMou.nomorMOU })
    .from(suratMou)
    .where(eq(suratMou.id, parsed.id));

  if (!existing) {
    return { ok: false as const, error: "Surat MOU tidak ditemukan." };
  }

  await db.delete(suratMou).where(eq(suratMou.id, parsed.id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_SURAT_MOU",
    entitasType: "surat_mou",
    entitasId: parsed.id,
    detail: { nomorMOU: existing.nomorMOU },
  });

  revalidatePath("/surat-mou");
  return { ok: true as const };
}

export async function uploadSuratMouFile(data: unknown) {
  const parsed = uploadFileSchema.parse(data);
  await requirePermission("suratMou", "create");
  const prepared = prepareUploadPayload(parsed);
  const storage = getStorageProvider();
  const uploaded = await storage.upload({
    body: prepared.body,
    fileName: prepared.fileName,
    contentType: prepared.contentType,
    folder: "surat-mou",
  });

  return { ok: true as const, data: uploaded };
}

export async function generateQrSuratMou(data: { id: string }) {
  const parsed = idSchema.parse(data);
  const session = await requirePermission("suratMou", "generate");

  const [row] = await db
    .select({
      id: suratMou.id,
      nomorMOU: suratMou.nomorMOU,
    })
    .from(suratMou)
    .where(eq(suratMou.id, parsed.id));

  if (!row) {
    return { ok: false as const, error: "Surat MOU tidak ditemukan." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const verificationUrl = buildVerifikasiSuratPayload({
    appUrl,
    jenis: "surat-mou",
    id: row.id,
    nomor: row.nomorMOU,
  });
  const qrCodeUrl = await generateQRDataURL(verificationUrl, { size: 512 });

  await db
    .update(suratMou)
    .set({ qrCodeUrl, updatedAt: new Date() })
    .where(eq(suratMou.id, parsed.id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "GENERATE_QR_SURAT_MOU",
    entitasType: "surat_mou",
    entitasId: parsed.id,
    detail: { verificationUrl },
  });

  revalidatePath("/surat-mou");
  return { ok: true as const, qrCodeUrl, verificationUrl };
}

export type SuratMouVerificationRow = {
  id: string;
  nomorMOU: string;
  perihal: string;
  pihakKedua: string;
  pihakKeduaAlamat: string | null;
  tanggalMOU: string;
  pejabatNama: string | null;
  fileUrl: string | null;
  qrCodeUrl: string | null;
};

export async function getSuratMouVerificationById(
  id: string,
): Promise<SuratMouVerificationRow | null> {
  const [row] = await db
    .select({
      id: suratMou.id,
      nomorMOU: suratMou.nomorMOU,
      perihal: suratMou.perihal,
      pihakKedua: suratMou.pihakKedua,
      pihakKeduaAlamat: suratMou.pihakKeduaAlamat,
      tanggalMOU: suratMou.tanggalMOU,
      pejabatNama: pejabatPenandatangan.namaJabatan,
      fileUrl: suratMou.fileUrl,
      qrCodeUrl: suratMou.qrCodeUrl,
    })
    .from(suratMou)
    .leftJoin(pejabatPenandatangan, eq(suratMou.pejabatId, pejabatPenandatangan.id))
    .where(eq(suratMou.id, id));

  return row ?? null;
}
