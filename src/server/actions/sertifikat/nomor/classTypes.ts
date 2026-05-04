"use server";

import { asc, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import {
  auditLog,
  certificateBatches,
  certificateClassTypes,
  certificateItems,
  certificateSerialConfig,
} from "@/server/db/schema";
import { requirePermission, requireSession } from "../../auth";

// â”€â”€â”€ Schemas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const classTypeInputSchema = z.object({
  name: z.string().trim().min(1, "Nama jenis kelas wajib diisi.").max(200),
  code: z
    .string()
    .trim()
    .regex(/^\d{2}$/, "Kode harus 2 digit angka (contoh: 01, 02, 03)."),
});

const idSchema = z.string().min(1, "ID tidak valid.");

const serialValueSchema = z
  .number()
  .int("Nomor serial harus bilangan bulat.")
  .min(0, "Nomor serial tidak boleh negatif.");

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type CertificateClassTypeRow = {
  id: string;
  name: string;
  code: string;
  createdAt: Date;
  updatedAt: Date;
};

export type SerialConfigInfo = {
  lastSerialNumber: number;
  maxUsedSerial: number;
};

// â”€â”€â”€ Actions: Jenis Kelas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function listCertificateClassTypes(): Promise<CertificateClassTypeRow[]> {
  await requireSession();

  return db
    .select()
    .from(certificateClassTypes)
    .orderBy(asc(certificateClassTypes.code));
}

export async function createCertificateClassType(data: unknown) {
  const result = classTypeInputSchema.safeParse(data);
  if (!result.success) {
    return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const parsed = result.data;
  const session = await requirePermission("sertifikat", "configure");

  try {
    const [row] = await db
      .insert(certificateClassTypes)
      .values({
        name: parsed.name,
        code: parsed.code,
        updatedAt: new Date(),
      })
      .returning();

    if (!row) throw new Error("Gagal membuat jenis kelas.");

    await writeAuditLog({
      userId: session.user.id,
      aksi: "CREATE_CERT_CLASS_TYPE",
      entitasType: "cert_class_type",
      entitasId: row.id,
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
      return {
        ok: false as const,
        error: "Kode jenis kelas sudah digunakan. Pilih kode 2-digit lain.",
      };
    }
    throw err;
  }
}

export async function updateCertificateClassType(id: string, data: unknown) {
  const parsedId = idSchema.parse(id);
  const result = classTypeInputSchema.safeParse(data);
  if (!result.success) {
    return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const parsed = result.data;
  const session = await requirePermission("sertifikat", "configure");

  try {
    const [row] = await db
      .update(certificateClassTypes)
      .set({
        name: parsed.name,
        code: parsed.code,
        updatedAt: new Date(),
      })
      .where(eq(certificateClassTypes.id, parsedId))
      .returning();

    if (!row) return { ok: false as const, error: "Jenis kelas tidak ditemukan." };

    await writeAuditLog({
      userId: session.user.id,
      aksi: "UPDATE_CERT_CLASS_TYPE",
      entitasType: "cert_class_type",
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
      return {
        ok: false as const,
        error: "Kode jenis kelas sudah digunakan. Pilih kode 2-digit lain.",
      };
    }
    throw err;
  }
}

export async function deleteCertificateClassType(id: string) {
  const parsedId = idSchema.parse(id);
  const session = await requirePermission("sertifikat", "configure");

  const [existing] = await db
    .select({ id: certificateClassTypes.id, name: certificateClassTypes.name, code: certificateClassTypes.code })
    .from(certificateClassTypes)
    .where(eq(certificateClassTypes.id, parsedId))
    .limit(1);

  if (!existing) return { ok: false as const, error: "Jenis kelas tidak ditemukan." };

  // Cek apakah jenis kelas masih digunakan oleh batch
  const [usedBatch] = await db
    .select({ id: certificateBatches.id })
    .from(certificateBatches)
    .where(eq(certificateBatches.classTypeId, parsedId))
    .limit(1);

  if (usedBatch) {
    return {
      ok: false as const,
      error: "Jenis kelas tidak dapat dihapus karena masih digunakan oleh batch sertifikat.",
    };
  }

  await db.delete(certificateClassTypes).where(eq(certificateClassTypes.id, parsedId));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_CERT_CLASS_TYPE",
    entitasType: "cert_class_type",
    entitasId: parsedId,
    detail: { name: existing.name, code: existing.code },
  });

  revalidatePath("/sertifikat/nomor");
  return { ok: true as const };
}

// â”€â”€â”€ Actions: Serial Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getSerialConfig(): Promise<SerialConfigInfo> {
  await requirePermission("sertifikat", "configure");

  const [config] = await db
    .select()
    .from(certificateSerialConfig)
    .where(eq(certificateSerialConfig.key, "last_serial_number"))
    .limit(1);

  const lastSerialNumber = config ? parseInt(config.value, 10) : 0;

  // Ambil serial terbesar yang benar-benar sudah ada di data
  const [maxRow] = await db
    .select({ maxSerial: max(certificateItems.serialNumber) })
    .from(certificateItems);

  const maxUsedSerial = maxRow?.maxSerial ?? 0;

  return { lastSerialNumber, maxUsedSerial };
}

export async function updateSerialConfig(newValue: number) {
  const parsed = serialValueSchema.parse(newValue);
  const session = await requirePermission("sertifikat", "configure");

  // Ambil max serial yang sudah digunakan â€” tidak boleh dimundurkan
  const [maxRow] = await db
    .select({ maxSerial: max(certificateItems.serialNumber) })
    .from(certificateItems);

  const maxUsedSerial = maxRow?.maxSerial ?? 0;

  if (parsed < maxUsedSerial) {
    return {
      ok: false as const,
      error: `Nomor serial tidak boleh lebih kecil dari serial terbesar yang sudah digunakan (${maxUsedSerial}). Tidak dapat dimundurkan untuk menjaga konsistensi data.`,
    };
  }

  await db
    .insert(certificateSerialConfig)
    .values({ key: "last_serial_number", value: String(parsed) })
    .onConflictDoUpdate({
      target: certificateSerialConfig.key,
      set: { value: String(parsed), updatedAt: new Date() },
    });

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_CERT_SERIAL_CONFIG",
    entitasType: "cert_serial_config",
    entitasId: "last_serial_number",
    detail: { previousMax: maxUsedSerial, newValue: parsed },
  });

  return { ok: true as const };
}
