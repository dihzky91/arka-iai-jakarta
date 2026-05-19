"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { revalidateDashboardTag } from "@/server/actions/statistics";
import { DASHBOARD_TAGS } from "@/lib/dashboard-cache-tags";
import { z } from "zod";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import { auditLog, suratMasuk, users } from "@/server/db/schema";
import { getStorageProvider } from "@/lib/storage";
import { prepareUploadPayload } from "@/lib/storage/utils";
import {
  suratMasukCreateSchema,
  suratMasukUpdateSchema,
} from "@/lib/validators/suratMasuk.schema";
import { requirePermission, requireSession } from "./auth";
import { notifySuratMasukBaru } from "./notifications";
import { uploadFileSchema, uuidIdSchema } from "@/lib/validators/common";
import { enforceUploadRateLimit } from "@/lib/rate-limit/upload-guard";

export type SuratMasukRow = {
  id: string;
  nomorAgenda: string | null;
  nomorSuratAsal: string | null;
  perihal: string;
  pengirim: string;
  pengirimAlamat: string | null;
  tanggalSurat: string;
  tanggalDiterima: string;
  jenisSurat: string;
  status: string | null;
  isiSingkat: string | null;
  fileUrl: string | null;
  dicatatOleh: string | null;
  dicatatOlehNama: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

const idSchema = uuidIdSchema;

export async function listSuratMasuk(): Promise<SuratMasukRow[]> {
  await requireSession();
  return db
    .select({
      id: suratMasuk.id,
      nomorAgenda: suratMasuk.nomorAgenda,
      nomorSuratAsal: suratMasuk.nomorSuratAsal,
      perihal: suratMasuk.perihal,
      pengirim: suratMasuk.pengirim,
      pengirimAlamat: suratMasuk.pengirimAlamat,
      tanggalSurat: suratMasuk.tanggalSurat,
      tanggalDiterima: suratMasuk.tanggalDiterima,
      jenisSurat: suratMasuk.jenisSurat,
      status: suratMasuk.status,
      isiSingkat: suratMasuk.isiSingkat,
      fileUrl: suratMasuk.fileUrl,
      dicatatOleh: suratMasuk.dicatatOleh,
      dicatatOlehNama: users.namaLengkap,
      createdAt: suratMasuk.createdAt,
      updatedAt: suratMasuk.updatedAt,
    })
    .from(suratMasuk)
    .leftJoin(users, eq(suratMasuk.dicatatOleh, users.id))
    .orderBy(desc(suratMasuk.tanggalDiterima), desc(suratMasuk.createdAt))
    .limit(100);
}

export async function getSuratMasukById(id: string) {
  await requireSession();
  const [row] = await db
    .select({
      id: suratMasuk.id,
      nomorAgenda: suratMasuk.nomorAgenda,
      nomorSuratAsal: suratMasuk.nomorSuratAsal,
      perihal: suratMasuk.perihal,
      pengirim: suratMasuk.pengirim,
      pengirimAlamat: suratMasuk.pengirimAlamat,
      tanggalSurat: suratMasuk.tanggalSurat,
      tanggalDiterima: suratMasuk.tanggalDiterima,
      jenisSurat: suratMasuk.jenisSurat,
      status: suratMasuk.status,
      isiSingkat: suratMasuk.isiSingkat,
      fileUrl: suratMasuk.fileUrl,
      dicatatOleh: suratMasuk.dicatatOleh,
      dicatatOlehNama: users.namaLengkap,
      createdAt: suratMasuk.createdAt,
      updatedAt: suratMasuk.updatedAt,
    })
    .from(suratMasuk)
    .leftJoin(users, eq(suratMasuk.dicatatOleh, users.id))
    .where(eq(suratMasuk.id, id));
  return row ?? null;
}

export async function createSuratMasuk(data: unknown) {
  const parsed = suratMasukCreateSchema.parse(data);
  const session = await requirePermission("suratMasuk", "create");
  const [row] = await db
    .insert(suratMasuk)
    .values({
      id: crypto.randomUUID(),
      ...parsed,
      dicatatOleh: session.user.id,
    })
    .returning();

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_SURAT_MASUK",
    entitasType: "surat_masuk",
    entitasId: row!.id,
    detail: { perihal: parsed.perihal, pengirim: parsed.pengirim },
  });

  void notifySuratMasukBaru(parsed.perihal, parsed.pengirim, row!.id);

  revalidatePath("/surat-masuk");
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  return { ok: true as const, data: row! };
}

export async function uploadSuratMasukFile(data: unknown) {
  const parsed = uploadFileSchema.parse(data);
  const session = await requirePermission("suratMasuk", "create");
  enforceUploadRateLimit(session.user.id);
  const prepared = prepareUploadPayload(parsed);

  const storage = getStorageProvider();
  const uploaded = await storage.upload({
    body: prepared.body,
    fileName: prepared.fileName,
    contentType: prepared.contentType,
    folder: "surat-masuk",
  });

  return {
    ok: true as const,
    data: uploaded,
  };
}

export async function updateSuratMasuk(data: unknown) {
  const parsed = suratMasukUpdateSchema.parse(data);
  const session = await requirePermission("suratMasuk", "update");

  const [existing] = await db
    .select({ id: suratMasuk.id })
    .from(suratMasuk)
    .where(eq(suratMasuk.id, parsed.id));

  if (!existing) {
    return { ok: false as const, error: "Surat masuk tidak ditemukan." };
  }

  const { id, ...rest } = parsed;
  const [row] = await db
    .update(suratMasuk)
    .set({ ...rest, updatedAt: new Date() })
    .where(eq(suratMasuk.id, id))
    .returning();

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_SURAT_MASUK",
    entitasType: "surat_masuk",
    entitasId: id,
    detail: { perihal: row?.perihal ?? null },
  });

  revalidatePath("/surat-masuk");
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  return { ok: true as const, data: row! };
}

export async function updateStatusSuratMasuk(data: unknown) {
  const parsed = z
    .object({
      id: z.string().uuid(),
      status: z.enum(["diterima", "diproses", "diarsip", "dibatalkan"]),
    })
    .parse(data);
  const session = await requirePermission("suratMasuk", "update");

  const [row] = await db
    .update(suratMasuk)
    .set({ status: parsed.status, updatedAt: new Date() })
    .where(eq(suratMasuk.id, parsed.id))
    .returning();

  if (!row) {
    return { ok: false as const, error: "Surat masuk tidak ditemukan." };
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_STATUS_SURAT_MASUK",
    entitasType: "surat_masuk",
    entitasId: parsed.id,
    detail: { status: parsed.status },
  });

  revalidatePath("/surat-masuk");
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  revalidatePath("/disposisi");
  return { ok: true as const, data: row };
}

export async function markSuratMasukDiproses(ids: string[]) {
  if (!ids.length) return;
  await db
    .update(suratMasuk)
    .set({ status: "diproses", updatedAt: new Date() })
    .where(
      and(
        inArray(suratMasuk.id, ids),
        eq(suratMasuk.status, "diterima"),
      ),
    );
}

export async function deleteSuratMasuk(data: { id: string }) {
  const { id } = idSchema.parse(data);
  const session = await requirePermission("suratMasuk", "delete");

  const [existing] = await db
    .select({ id: suratMasuk.id, perihal: suratMasuk.perihal })
    .from(suratMasuk)
    .where(eq(suratMasuk.id, id));

  if (!existing) {
    return { ok: false as const, error: "Surat masuk tidak ditemukan." };
  }

  await db.delete(suratMasuk).where(eq(suratMasuk.id, id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_SURAT_MASUK",
    entitasType: "surat_masuk",
    entitasId: id,
    detail: { perihal: existing.perihal },
  });

  revalidatePath("/surat-masuk");
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  revalidatePath("/disposisi");
  return { ok: true as const };
}
