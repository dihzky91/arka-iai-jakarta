"use server";

import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStorageProvider } from "@/lib/storage";
import { prepareUploadPayload } from "@/lib/storage/utils";
import { enforceUploadRateLimit } from "@/lib/rate-limit/upload-guard";
import {
  requireCapability,
  requirePermission,
} from "@/server/actions/auth";
import { db } from "@/server/db";
import {
  honorariumAuditLogs,
  honorariumBatches,
  honorariumPaymentProofs,
  users,
} from "@/server/db/schema";
import { uploadPaymentProofSchema } from "./honorarium-utils";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type HonorariumPaymentProofRow = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploaderName: string | null;
  uploadedAt: Date;
};

// ─── FUNCTIONS ────────────────────────────────────────────────────────────────

export async function listHonorariumPaymentProofs(
  batchId: string,
): Promise<HonorariumPaymentProofRow[]> {
  await requirePermission("jadwalPelatihan", "view").catch(() =>
    requireCapability("keuangan:view"),
  );

  const rows = await db
    .select({
      id: honorariumPaymentProofs.id,
      fileName: honorariumPaymentProofs.fileName,
      fileUrl: honorariumPaymentProofs.fileUrl,
      fileSize: honorariumPaymentProofs.fileSize,
      mimeType: honorariumPaymentProofs.mimeType,
      uploadedBy: honorariumPaymentProofs.uploadedBy,
      uploaderName: users.namaLengkap,
      uploadedAt: honorariumPaymentProofs.uploadedAt,
    })
    .from(honorariumPaymentProofs)
    .leftJoin(users, eq(honorariumPaymentProofs.uploadedBy, users.id))
    .where(eq(honorariumPaymentProofs.batchId, batchId))
    .orderBy(desc(honorariumPaymentProofs.uploadedAt));

  return rows.map((row) => ({
    ...row,
    fileSize: Number(row.fileSize) || 0,
  }));
}

export async function uploadHonorariumPaymentProof(
  data: z.infer<typeof uploadPaymentProofSchema>,
) {
  const session = await requireCapability("keuangan:pay");
  enforceUploadRateLimit(session.user.id);
  const parsed = uploadPaymentProofSchema.parse(data);

  const [batch] = await db
    .select({
      id: honorariumBatches.id,
      status: honorariumBatches.status,
    })
    .from(honorariumBatches)
    .where(eq(honorariumBatches.id, parsed.batchId))
    .limit(1);

  if (!batch) throw new Error("Batch honorarium tidak ditemukan.");
  if (!["diproses_keuangan", "dibayar", "locked"].includes(batch.status)) {
    throw new Error(
      "Upload bukti pembayaran hanya diizinkan saat batch diproses/dibayar/locked.",
    );
  }

  const prepared = prepareUploadPayload({
    fileName: parsed.fileName,
    contentType: parsed.contentType,
    dataUrl: parsed.dataUrl,
  });

  const storage = getStorageProvider();
  const uploaded = await storage.upload({
    body: prepared.body,
    fileName: prepared.fileName,
    contentType: prepared.contentType,
    folder: `honorarium/payment-proofs/${parsed.batchId}`,
  });

  const id = nanoid();
  await db.insert(honorariumPaymentProofs).values({
    id,
    batchId: parsed.batchId,
    fileName: uploaded.fileName || prepared.fileName,
    fileUrl: uploaded.url,
    storageKey: uploaded.key ?? null,
    fileSize: uploaded.size ?? prepared.size,
    mimeType: uploaded.contentType || prepared.contentType,
    uploadedBy: session.user.id,
  });

  await db.insert(honorariumAuditLogs).values({
    id: nanoid(),
    batchId: parsed.batchId,
    actorId: session.user.id,
    action: "payment_proof_uploaded",
    payload: {
      paymentProofId: id,
      fileName: uploaded.fileName || prepared.fileName,
      fileUrl: uploaded.url,
    },
  });

  revalidatePath(`/jadwal-otomatis/honorarium/${parsed.batchId}`);
  revalidatePath(`/keuangan/honorarium/${parsed.batchId}`);

  return {
    ok: true as const,
    data: {
      id,
      fileName: uploaded.fileName || prepared.fileName,
      fileUrl: uploaded.url,
      fileSize: uploaded.size ?? prepared.size,
      mimeType: uploaded.contentType || prepared.contentType,
    },
  };
}
