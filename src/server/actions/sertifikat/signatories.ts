"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import {
  auditLog,
  eventSignatories,
  pejabatPenandatangan,
  signatories,
} from "@/server/db/schema";
import { requirePermission, requireSession } from "../auth";

const signatoryInputSchema = z.object({
  nama: z.string().trim().min(1, "Nama penandatangan wajib diisi.").max(255),
  jabatan: z.string().trim().max(255).optional().nullable(),
  pejabatId: z.coerce.number().int().positive().optional().nullable(),
});

const idSchema = z.coerce.number().int().positive();

export type SignatoryRow = {
  id: number;
  nama: string;
  jabatan: string | null;
  pejabatId: number | null;
  createdAt: Date | null;
  pejabatJabatan: string | null;
};

function normalizeOptional(value?: string | null) {
  return value && value.trim().length > 0 ? value.trim() : null;
}

export async function listSignatories(): Promise<SignatoryRow[]> {
  await requireSession();

  return db
    .select({
      id: signatories.id,
      nama: signatories.nama,
      jabatan: signatories.jabatan,
      pejabatId: signatories.pejabatId,
      createdAt: signatories.createdAt,
      pejabatJabatan: pejabatPenandatangan.namaJabatan,
    })
    .from(signatories)
    .leftJoin(pejabatPenandatangan, eq(signatories.pejabatId, pejabatPenandatangan.id))
    .orderBy(asc(signatories.nama));
}

export async function createSignatory(data: unknown) {
  const parsed = signatoryInputSchema.parse(data);
  const session = await requirePermission("sertifikat", "manage");

  const [row] = await db
    .insert(signatories)
    .values({
      nama: parsed.nama,
      jabatan: normalizeOptional(parsed.jabatan),
      pejabatId: parsed.pejabatId ?? null,
    })
    .returning();

  if (!row) throw new Error("Gagal membuat penandatangan.");

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_SERTIFIKAT_SIGNATORY",
    entitasType: "sertifikat_signatory",
    entitasId: String(row.id),
    detail: { nama: row.nama, jabatan: row.jabatan },
  });

  revalidatePath("/sertifikat/penandatangan");
  revalidatePath("/sertifikat/kegiatan");
  return { ok: true as const, data: row };
}

export async function updateSignatory(id: number, data: unknown) {
  const parsedId = idSchema.parse(id);
  const parsed = signatoryInputSchema.parse(data);
  const session = await requirePermission("sertifikat", "manage");

  const [row] = await db
    .update(signatories)
    .set({
      nama: parsed.nama,
      jabatan: normalizeOptional(parsed.jabatan),
      pejabatId: parsed.pejabatId ?? null,
    })
    .where(eq(signatories.id, parsedId))
    .returning();

  if (!row) return { ok: false as const, error: "Penandatangan tidak ditemukan." };

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_SERTIFIKAT_SIGNATORY",
    entitasType: "sertifikat_signatory",
    entitasId: String(parsedId),
    detail: { nama: row.nama, jabatan: row.jabatan },
  });

  revalidatePath("/sertifikat/penandatangan");
  revalidatePath("/sertifikat/kegiatan");
  revalidatePath("/verifikasi", "layout");
  return { ok: true as const, data: row };
}

export async function deleteSignatory(id: number) {
  const parsedId = idSchema.parse(id);
  const session = await requirePermission("sertifikat", "manage");

  const [existing] = await db
    .select({ id: signatories.id, nama: signatories.nama, jabatan: signatories.jabatan })
    .from(signatories)
    .where(eq(signatories.id, parsedId))
    .limit(1);

  if (!existing) return { ok: false as const, error: "Penandatangan tidak ditemukan." };

  await db.delete(eventSignatories).where(eq(eventSignatories.signatoryId, parsedId));
  await db.delete(signatories).where(eq(signatories.id, parsedId));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_SERTIFIKAT_SIGNATORY",
    entitasType: "sertifikat_signatory",
    entitasId: String(parsedId),
    detail: { nama: existing.nama, jabatan: existing.jabatan },
  });

  revalidatePath("/sertifikat/penandatangan");
  revalidatePath("/sertifikat/kegiatan");
  revalidatePath("/verifikasi", "layout");
  return { ok: true as const };
}
