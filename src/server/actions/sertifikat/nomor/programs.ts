"use server";

import { asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import {
  auditLog,
  certificateBatches,
  certificatePrograms,
} from "@/server/db/schema";
import { requirePermission, requireSession } from "../../auth";

// â”€â”€â”€ Schemas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const programInputSchema = z.object({
  name: z.string().trim().min(1, "Nama program wajib diisi.").max(200),
  code: z.string().trim().max(50).optional().nullable(),
});

const idSchema = z.string().min(1, "ID tidak valid.");

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type CertificateProgramRow = {
  id: string;
  name: string;
  code: string | null;
  createdAt: Date;
  updatedAt: Date;
};

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function normalizeOptional(value?: string | null) {
  return value && value.trim().length > 0 ? value.trim() : null;
}

// â”€â”€â”€ Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function listCertificatePrograms(): Promise<CertificateProgramRow[]> {
  await requireSession();

  return db
    .select()
    .from(certificatePrograms)
    .orderBy(asc(certificatePrograms.name));
}

export async function createCertificateProgram(data: unknown) {
  const result = programInputSchema.safeParse(data);
  if (!result.success) {
    return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const parsed = result.data;
  const session = await requirePermission("sertifikat", "configure");

  try {
    const [row] = await db
      .insert(certificatePrograms)
      .values({
        name: parsed.name,
        code: normalizeOptional(parsed.code),
        updatedAt: new Date(),
      })
      .returning();

    if (!row) throw new Error("Gagal membuat program.");

    await writeAuditLog({
      userId: session.user.id,
      aksi: "CREATE_CERT_PROGRAM",
      entitasType: "cert_program",
      entitasId: row.id,
      detail: { name: row.name, code: row.code },
    });

    revalidatePath("/sertifikat/nomor");
    return { ok: true as const, data: row };
  } catch (err) {
    // Unique violation
    if (
      typeof err === "object" &&
      err !== null &&
      (err as { code?: string }).code === "23505"
    ) {
      return { ok: false as const, error: "Nama program sudah digunakan." };
    }
    throw err;
  }
}

export async function updateCertificateProgram(id: string, data: unknown) {
  const parsedId = idSchema.parse(id);
  const result = programInputSchema.safeParse(data);
  if (!result.success) {
    return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const parsed = result.data;
  const session = await requirePermission("sertifikat", "configure");

  try {
    const [row] = await db
      .update(certificatePrograms)
      .set({
        name: parsed.name,
        code: normalizeOptional(parsed.code),
        updatedAt: new Date(),
      })
      .where(eq(certificatePrograms.id, parsedId))
      .returning();

    if (!row) return { ok: false as const, error: "Program tidak ditemukan." };

    await writeAuditLog({
      userId: session.user.id,
      aksi: "UPDATE_CERT_PROGRAM",
      entitasType: "cert_program",
      entitasId: parsedId,
      detail: { name: row.name, code: row.code },
    });

    revalidatePath("/sertifikat/nomor");
    return { ok: true as const, data: row };
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      (err as { code?: string }).code === "23505"
    ) {
      return { ok: false as const, error: "Nama program sudah digunakan." };
    }
    throw err;
  }
}

export async function deleteCertificateProgram(id: string) {
  const parsedId = idSchema.parse(id);
  const session = await requirePermission("sertifikat", "configure");

  const [existing] = await db
    .select({ id: certificatePrograms.id, name: certificatePrograms.name })
    .from(certificatePrograms)
    .where(eq(certificatePrograms.id, parsedId))
    .limit(1);

  if (!existing) return { ok: false as const, error: "Program tidak ditemukan." };

  // Cek apakah program masih digunakan oleh batch
  const [usedBatch] = await db
    .select({ id: certificateBatches.id })
    .from(certificateBatches)
    .where(eq(certificateBatches.programId, parsedId))
    .limit(1);

  if (usedBatch) {
    return {
      ok: false as const,
      error: "Program tidak dapat dihapus karena masih digunakan oleh batch sertifikat.",
    };
  }

  await db.delete(certificatePrograms).where(eq(certificatePrograms.id, parsedId));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_CERT_PROGRAM",
    entitasType: "cert_program",
    entitasId: parsedId,
    detail: { name: existing.name },
  });

  revalidatePath("/sertifikat/nomor");
  return { ok: true as const };
}
