"use server";

import { and, asc, count, desc, eq, max, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import {
  auditLog,
  certificateBatches,
  certificateClassTypes,
  certificateItems,
  certificatePrograms,
  certificateSerialConfig,
  classTypes,
  kelasPelatihan,
  programs,
  users,
} from "@/server/db/schema";
import { requirePermission, requireSession } from "../../auth";

// â”€â”€â”€ Schemas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const batchFilterSchema = z.object({
  programId:   z.string().optional(),
  classTypeId: z.string().optional(),
  angkatan:    z.coerce.number().int().optional(),
  status:      z.enum(["active", "revised", "cancelled"]).optional(),
});

const generateSchema = z.object({
  sourceMode: z.enum(["existing", "manual"]).default("existing"),
  useCustomAngkatanFormat: z.boolean().default(false),
  kelasId: z.string().optional(),
  overrideAngkatan: z.number().int().min(1).max(999).optional(),
  overrideCertificateClassCode: z.enum(["01", "02", "03"]).optional(),
  manualNamaKelas: z.string().trim().min(2).max(200).optional(),
  manualProgramId: z.string().optional(),
  manualClassTypeId: z.string().optional(),
  manualMode: z.enum(["offline", "online"]).optional(),
  manualStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  manualAngkatan: z.number().int().min(1).max(999).optional(),
  manualCertificateClassCode: z.enum(["01", "02", "03"]).optional(),
  quantity: z.number().int().min(1, "Jumlah minimal 1.").max(1000, "Jumlah maksimal 1000."),
  notes: z.string().trim().max(1000).optional(),
});

const idSchema = z.string().min(1, "ID tidak valid.");

const updateQuantitySchema = z.object({
  batchId: z.string().min(1),
  newQuantity: z.number().int().min(1, "Jumlah minimal 1."),
});

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type BatchRow = {
  id: string;
  kelasId: string | null;
  kelasName: string | null;
  kelasMode: string | null;
  programId: string;
  programName: string;
  classTypeId: string;
  classTypeName: string;
  classTypeCode: string;
  angkatan: number;
  quantityRequested: number;
  firstCertificateNumber: string;
  lastCertificateNumber: string;
  status: "active" | "revised" | "cancelled";
  notes: string | null;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BatchDetailRow = BatchRow & {
  items: BatchItemRow[];
};

export type BatchItemRow = {
  id: string;
  fullNumber: string;
  serialNumber: number;
  status: "active" | "cancelled";
  createdAt: Date;
};

export type YearlyStats = {
  year: number;
  totalActive: number;
  totalCancelled: number;
  firstSerial: number | null;
  lastSerial: number | null;
};

export type YearlyProgramStats = {
  programName: string;
  classTypeName: string;
  classTypeCode: string;
  activeCount: number;
  cancelledCount: number;
};

export type CsvExportRow = {
  "No.": number;
  "Nomor Sertifikat": string;
  "Serial Number": number;
  Status: string;
};

export type CertificateBatchClassOption = {
  id: string;
  namaKelas: string;
  programId: string;
  programName: string;
  programCode: string;
  classTypeId: string;
  classTypeName: string;
  mode: string;
  angkatan: number | null;
  certificateClassCode: string | null;
  source: string;
  startDate: string;
  status: string;
};

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function getLastSerial(): Promise<number> {
  const [config] = await db
    .select({ value: certificateSerialConfig.value })
    .from(certificateSerialConfig)
    .where(eq(certificateSerialConfig.key, "last_serial_number"))
    .limit(1);

  return config ? parseInt(config.value, 10) : 0;
}

async function setLastSerial(value: number): Promise<void> {
  await db
    .insert(certificateSerialConfig)
    .values({ key: "last_serial_number", value: String(value) })
    .onConflictDoUpdate({
      target: certificateSerialConfig.key,
      set: { value: String(value), updatedAt: new Date() },
    });
}

function formatAngkatanPrefix(angkatan: number, useCustomAngkatanFormat: boolean) {
  return useCustomAngkatanFormat
    ? String(angkatan)
    : String(angkatan).padStart(3, "0");
}

function extractNumberPrefix(firstCertificateNumber: string, fallbackPrefix: string) {
  const [prefix] = firstCertificateNumber.split(".");
  return prefix || fallbackPrefix;
}

function certificateClassLabel(code: string) {
  if (code === "01") return "Kelas Pagi";
  if (code === "02") return "Kelas Siang";
  if (code === "03") return "Kelas Sore / Ekstra";
  return `Kelas ${code}`;
}

async function getOrCreateCertificateProgram(input: { name: string; code: string | null }) {
  const [existing] = await db
    .select()
    .from(certificatePrograms)
    .where(eq(certificatePrograms.name, input.name))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(certificatePrograms)
    .values({
      name: input.name,
      code: input.code,
      updatedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  const [row] = await db
    .select()
    .from(certificatePrograms)
    .where(eq(certificatePrograms.name, input.name))
    .limit(1);

  if (!row) throw new Error("Gagal menyiapkan program sertifikat.");
  return row;
}

async function getOrCreateCertificateClassType(code: string) {
  const [existing] = await db
    .select()
    .from(certificateClassTypes)
    .where(eq(certificateClassTypes.code, code))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(certificateClassTypes)
    .values({
      name: certificateClassLabel(code),
      code,
      updatedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  const [row] = await db
    .select()
    .from(certificateClassTypes)
    .where(eq(certificateClassTypes.code, code))
    .limit(1);

  if (!row) throw new Error("Gagal menyiapkan jenis kelas sertifikat.");
  return row;
}

// â”€â”€â”€ Actions: List & Get â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function listCertificateBatchClasses(): Promise<CertificateBatchClassOption[]> {
  await requireSession();

  const rows = await db
    .select({
      id: kelasPelatihan.id,
      namaKelas: kelasPelatihan.namaKelas,
      programId: kelasPelatihan.programId,
      programName: programs.name,
      programCode: programs.code,
      classTypeId: kelasPelatihan.classTypeId,
      classTypeName: classTypes.name,
      mode: kelasPelatihan.mode,
      angkatan: kelasPelatihan.angkatan,
      certificateClassCode: kelasPelatihan.certificateClassCode,
      source: kelasPelatihan.source,
      startDate: kelasPelatihan.startDate,
      status: kelasPelatihan.status,
    })
    .from(kelasPelatihan)
    .innerJoin(programs, eq(kelasPelatihan.programId, programs.id))
    .innerJoin(classTypes, eq(kelasPelatihan.classTypeId, classTypes.id))
    .where(sql`${kelasPelatihan.status} <> 'cancelled'`)
    .orderBy(desc(kelasPelatihan.createdAt));

  return rows as CertificateBatchClassOption[];
}

export async function listBatches(filters?: z.infer<typeof batchFilterSchema>): Promise<BatchRow[]> {
  await requireSession();

  const rows = await db
    .select({
      id:                     certificateBatches.id,
      kelasId:                certificateBatches.kelasId,
      kelasName:              kelasPelatihan.namaKelas,
      kelasMode:              kelasPelatihan.mode,
      programId:              certificateBatches.programId,
      programName:            certificatePrograms.name,
      classTypeId:            certificateBatches.classTypeId,
      classTypeName:          certificateClassTypes.name,
      classTypeCode:          certificateClassTypes.code,
      angkatan:               certificateBatches.angkatan,
      quantityRequested:      certificateBatches.quantityRequested,
      firstCertificateNumber: certificateBatches.firstCertificateNumber,
      lastCertificateNumber:  certificateBatches.lastCertificateNumber,
      status:                 certificateBatches.status,
      notes:                  certificateBatches.notes,
      createdByName:          users.namaLengkap,
      createdAt:              certificateBatches.createdAt,
      updatedAt:              certificateBatches.updatedAt,
    })
    .from(certificateBatches)
    .innerJoin(certificatePrograms, eq(certificateBatches.programId, certificatePrograms.id))
    .innerJoin(certificateClassTypes, eq(certificateBatches.classTypeId, certificateClassTypes.id))
    .leftJoin(kelasPelatihan, eq(certificateBatches.kelasId, kelasPelatihan.id))
    .leftJoin(users, eq(certificateBatches.createdBy, users.id))
    .where(
      and(
        filters?.programId   ? eq(certificateBatches.programId, filters.programId)     : undefined,
        filters?.classTypeId ? eq(certificateBatches.classTypeId, filters.classTypeId) : undefined,
        filters?.angkatan    ? eq(certificateBatches.angkatan, filters.angkatan)       : undefined,
        filters?.status      ? eq(certificateBatches.status, filters.status)           : undefined,
      ),
    )
    .orderBy(desc(certificateBatches.createdAt));

  return rows as BatchRow[];
}

export async function getBatch(id: string): Promise<BatchDetailRow | null> {
  await requireSession();
  const parsedId = idSchema.parse(id);

  const rows = await db
    .select({
      id:                     certificateBatches.id,
      kelasId:                certificateBatches.kelasId,
      kelasName:              kelasPelatihan.namaKelas,
      kelasMode:              kelasPelatihan.mode,
      programId:              certificateBatches.programId,
      programName:            certificatePrograms.name,
      classTypeId:            certificateBatches.classTypeId,
      classTypeName:          certificateClassTypes.name,
      classTypeCode:          certificateClassTypes.code,
      angkatan:               certificateBatches.angkatan,
      quantityRequested:      certificateBatches.quantityRequested,
      firstCertificateNumber: certificateBatches.firstCertificateNumber,
      lastCertificateNumber:  certificateBatches.lastCertificateNumber,
      status:                 certificateBatches.status,
      notes:                  certificateBatches.notes,
      createdByName:          users.namaLengkap,
      createdAt:              certificateBatches.createdAt,
      updatedAt:              certificateBatches.updatedAt,
    })
    .from(certificateBatches)
    .innerJoin(certificatePrograms, eq(certificateBatches.programId, certificatePrograms.id))
    .innerJoin(certificateClassTypes, eq(certificateBatches.classTypeId, certificateClassTypes.id))
    .leftJoin(kelasPelatihan, eq(certificateBatches.kelasId, kelasPelatihan.id))
    .leftJoin(users, eq(certificateBatches.createdBy, users.id))
    .where(eq(certificateBatches.id, parsedId))
    .limit(1);

  const batch = rows[0];
  if (!batch) return null;

  const items = await db
    .select({
      id:           certificateItems.id,
      fullNumber:   certificateItems.fullNumber,
      serialNumber: certificateItems.serialNumber,
      status:       certificateItems.status,
      createdAt:    certificateItems.createdAt,
    })
    .from(certificateItems)
    .where(eq(certificateItems.batchId, parsedId))
    .orderBy(asc(certificateItems.serialNumber));

  return { ...(batch as BatchRow), items: items as BatchItemRow[] };
}

// â”€â”€â”€ Actions: Generate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function generateBatch(data: unknown) {
  const result = generateSchema.safeParse(data);
  if (!result.success) {
    return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const parsed = result.data;
  const { quantity, notes, useCustomAngkatanFormat } = parsed;
  const session = await requirePermission("sertifikat", "manage");

  try {
    let kelas:
      | {
          id: string;
          namaKelas: string;
          angkatan: number | null;
          certificateClassCode: string | null;
          programName: string;
          programCode: string;
        }
      | undefined;

    if (parsed.sourceMode === "manual") {
      if (
        !parsed.manualNamaKelas ||
        !parsed.manualProgramId ||
        !parsed.manualClassTypeId ||
        !parsed.manualMode ||
        !parsed.manualStartDate ||
        !parsed.manualAngkatan ||
        !parsed.manualCertificateClassCode
      ) {
        return { ok: false as const, error: "Data kelas manual belum lengkap." };
      }

      const [programRow] = await db
        .select({ id: programs.id, name: programs.name, code: programs.code })
        .from(programs)
        .where(eq(programs.id, parsed.manualProgramId))
        .limit(1);

      if (!programRow) {
        return { ok: false as const, error: "Program tidak ditemukan." };
      }

      const [createdClass] = await db
        .insert(kelasPelatihan)
        .values({
          namaKelas: parsed.manualNamaKelas,
          programId: parsed.manualProgramId,
          classTypeId: parsed.manualClassTypeId,
          mode: parsed.manualMode,
          angkatan: parsed.manualAngkatan,
          certificateClassCode: parsed.manualCertificateClassCode,
          source: "manual",
          certificateNotes: notes || null,
          startDate: parsed.manualStartDate,
          lokasi: null,
          status: "active",
          updatedAt: new Date(),
        })
        .returning({
          id: kelasPelatihan.id,
          namaKelas: kelasPelatihan.namaKelas,
          angkatan: kelasPelatihan.angkatan,
          certificateClassCode: kelasPelatihan.certificateClassCode,
        });

      if (!createdClass) {
        return { ok: false as const, error: "Gagal membuat kelas manual." };
      }

      kelas = {
        ...createdClass,
        programName: programRow.name,
        programCode: programRow.code,
      };
    } else {
      if (!parsed.kelasId) {
        return { ok: false as const, error: "Kelas wajib dipilih." };
      }

      const [existingClass] = await db
        .select({
          id: kelasPelatihan.id,
          namaKelas: kelasPelatihan.namaKelas,
          angkatan: kelasPelatihan.angkatan,
          certificateClassCode: kelasPelatihan.certificateClassCode,
          programName: programs.name,
          programCode: programs.code,
        })
        .from(kelasPelatihan)
        .innerJoin(programs, eq(kelasPelatihan.programId, programs.id))
        .where(eq(kelasPelatihan.id, parsed.kelasId))
        .limit(1);

      if (!existingClass) {
        return { ok: false as const, error: "Kelas tidak ditemukan." };
      }

      const nextAngkatan = existingClass.angkatan ?? parsed.overrideAngkatan;
      const nextClassCode =
        existingClass.certificateClassCode ?? parsed.overrideCertificateClassCode;

      if (!nextAngkatan || !nextClassCode) {
        return {
          ok: false as const,
          error:
            "Kelas belum punya angkatan atau kode kelas sertifikat. Isi override untuk melanjutkan.",
        };
      }

      if (
        nextAngkatan !== existingClass.angkatan ||
        nextClassCode !== existingClass.certificateClassCode
      ) {
        await db
          .update(kelasPelatihan)
          .set({
            angkatan: nextAngkatan,
            certificateClassCode: nextClassCode,
            certificateNotes: notes || null,
            updatedAt: new Date(),
          })
          .where(eq(kelasPelatihan.id, existingClass.id));
      }

      kelas = {
        ...existingClass,
        angkatan: nextAngkatan,
        certificateClassCode: nextClassCode,
      };
    }

    const program = await getOrCreateCertificateProgram({
      name: kelas.programName,
      code: kelas.programCode,
    });
    if (!kelas.angkatan || !kelas.certificateClassCode) {
      return {
        ok: false as const,
        error: "Kelas belum punya angkatan atau kode kelas sertifikat.",
      };
    }

    const angkatan = kelas.angkatan;
    const classTypeCode = kelas.certificateClassCode;
    const classType = await getOrCreateCertificateClassType(classTypeCode);

    // 1. Baca serial terakhir
    const lastSerial = await getLastSerial();
    const startSerial = lastSerial + 1;
    const endSerial = startSerial + quantity - 1;

    // 2. Format nomor: default 3-digit, bisa override per batch untuk case khusus
    const numberPrefix = `${formatAngkatanPrefix(angkatan, useCustomAngkatanFormat)}${classTypeCode}`;
    const firstNumber = `${numberPrefix}.${startSerial}`;
    const lastNumber  = `${numberPrefix}.${endSerial}`;

    // 3. Insert batch
    const [batch] = await db
      .insert(certificateBatches)
      .values({
        programId: program.id,
        classTypeId: classType.id,
        kelasId: kelas.id,
        angkatan,
        quantityRequested: quantity,
        firstCertificateNumber: firstNumber,
        lastCertificateNumber:  lastNumber,
        notes: notes || null,
        status: "active",
        createdBy: session.user.id,
        updatedAt: new Date(),
      })
      .returning();

    if (!batch) throw new Error("Gagal membuat batch.");

    // 4. Insert items individual
    const itemValues = [];
    for (let i = startSerial; i <= endSerial; i++) {
      itemValues.push({
        batchId:       batch.id,
        fullNumber:    `${numberPrefix}.${i}`,
        angkatan,
        classTypeCode,
        serialNumber:  i,
        status:        "active" as const,
      });
    }

    // Insert dalam chunk 500 untuk menghindari batas parameter query
    const CHUNK_SIZE = 500;
    const generatedItems = [];
    for (let i = 0; i < itemValues.length; i += CHUNK_SIZE) {
      const chunk = itemValues.slice(i, i + CHUNK_SIZE);
      const inserted = await db.insert(certificateItems).values(chunk).returning();
      generatedItems.push(...inserted);
    }

    // 5. Update serial config
    await setLastSerial(endSerial);

    // 6. Audit log
    await writeAuditLog({
      userId: session.user.id,
      aksi: "GENERATE_CERT_BATCH",
      entitasType: "cert_batch",
      entitasId: batch.id,
      detail: {
        kelasId: kelas.id,
        kelasName: kelas.namaKelas,
        programId: program.id,
        classTypeId: classType.id,
        angkatan,
        quantity,
        firstNumber,
        lastNumber,
        useCustomAngkatanFormat,
        startSerial,
        endSerial,
      },
    });

    revalidatePath("/sertifikat/nomor");
    return {
      ok: true as const,
      data: {
        batch,
        items: generatedItems,
        firstNumber,
        lastNumber,
      },
    };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Gagal generate batch sertifikat.",
    };
  }
}

// â”€â”€â”€ Actions: Update Jumlah Batch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function updateBatchQuantity(rawData: unknown) {
  const result = updateQuantitySchema.safeParse(rawData);
  if (!result.success) {
    return { ok: false as const, error: result.error.issues[0]?.message ?? "Data tidak valid." };
  }
  const { batchId, newQuantity } = result.data;
  const session = await requirePermission("sertifikat", "manage");

  const [batchMeta] = await db
    .select({
      id: certificateBatches.id,
      firstCertificateNumber: certificateBatches.firstCertificateNumber,
      angkatan: certificateBatches.angkatan,
      classTypeCode: certificateClassTypes.code,
    })
    .from(certificateBatches)
    .innerJoin(certificateClassTypes, eq(certificateBatches.classTypeId, certificateClassTypes.id))
    .where(eq(certificateBatches.id, batchId))
    .limit(1);

  if (!batchMeta) {
    return { ok: false as const, error: "Batch tidak ditemukan." };
  }

  // Ambil semua items batch ini
  const batchItems = await db
    .select()
    .from(certificateItems)
    .where(eq(certificateItems.batchId, batchId))
    .orderBy(asc(certificateItems.serialNumber));

  const currentQty = batchItems.length;
  if (newQuantity === currentQty) return { ok: true as const };

  if (newQuantity < currentQty) {
    // === PENGURANGAN â€” hanya boleh untuk batch terakhir (serial tertinggi) ===
    const batchMaxSerial = Math.max(...batchItems.map((item) => item.serialNumber));

    const [globalMaxRow] = await db
      .select({ maxSerial: max(certificateItems.serialNumber) })
      .from(certificateItems);

    const globalMaxSerial = globalMaxRow?.maxSerial ?? 0;

    if (batchMaxSerial !== globalMaxSerial) {
      return {
        ok: false as const,
        error:
          "Batch ini bukan batch dengan nomor serial tertinggi. Pengurangan jumlah hanya diizinkan untuk batch terakhir agar tidak ada celah nomor.",
      };
    }

    // Hapus items dari ekor
    const toDelete = batchItems.slice(newQuantity);
    const deleteIds = toDelete.map((item) => item.id);

    // Hapus satu per satu untuk menghindari batas IN clause
    for (const deleteId of deleteIds) {
      await db.delete(certificateItems).where(eq(certificateItems.id, deleteId));
    }

    const remaining = batchItems.slice(0, newQuantity);
    const firstItem = remaining[0];
    const lastItem  = remaining[remaining.length - 1];

    if (!firstItem || !lastItem) {
      return { ok: false as const, error: "Gagal menghitung sisa items." };
    }

    // Update batch record
    await db
      .update(certificateBatches)
      .set({
        quantityRequested:      newQuantity,
        firstCertificateNumber: firstItem.fullNumber,
        lastCertificateNumber:  lastItem.fullNumber,
        status: "revised",
        updatedAt: new Date(),
      })
      .where(eq(certificateBatches.id, batchId));

    // Recompute serial config dari data aktual
    const [newMaxRow] = await db
      .select({ maxSerial: max(certificateItems.serialNumber) })
      .from(certificateItems);

    await setLastSerial(newMaxRow?.maxSerial ?? 0);

    await writeAuditLog({
      userId: session.user.id,
      aksi: "DECREASE_CERT_BATCH_QTY",
      entitasType: "cert_batch",
      entitasId: batchId,
      detail: { previousQty: currentQty, newQty: newQuantity, deletedCount: toDelete.length },
    });

  } else {
    // === PENAMBAHAN â€” generate nomor baru melanjutkan serial global ===
    const addCount = newQuantity - currentQty;
    const lastSerial = await getLastSerial();
    const startSerial = lastSerial + 1;
    const endSerial = startSerial + addCount - 1;

    const fallbackPrefix = `${String(batchMeta.angkatan).padStart(3, "0")}${batchMeta.classTypeCode}`;
    const numberPrefix = extractNumberPrefix(
      batchMeta.firstCertificateNumber,
      fallbackPrefix,
    );
    const newItems = [];
    for (let i = startSerial; i <= endSerial; i++) {
      newItems.push({
        batchId,
        fullNumber:    `${numberPrefix}.${i}`,
        angkatan: batchMeta.angkatan,
        classTypeCode: batchMeta.classTypeCode,
        serialNumber:  i,
        status:        "active" as const,
      });
    }

    const CHUNK_SIZE = 500;
    for (let i = 0; i < newItems.length; i += CHUNK_SIZE) {
      await db.insert(certificateItems).values(newItems.slice(i, i + CHUNK_SIZE));
    }

    await setLastSerial(endSerial);

    // Ambil lastNumber terbaru untuk update batch
    const lastNumber = `${numberPrefix}.${endSerial}`;
    await db
      .update(certificateBatches)
      .set({
        quantityRequested: newQuantity,
        lastCertificateNumber: lastNumber,
        status: "revised",
        updatedAt: new Date(),
      })
      .where(eq(certificateBatches.id, batchId));

    await writeAuditLog({
      userId: session.user.id,
      aksi: "INCREASE_CERT_BATCH_QTY",
      entitasType: "cert_batch",
      entitasId: batchId,
      detail: { previousQty: currentQty, newQty: newQuantity, addedCount: addCount, endSerial },
    });
  }

  revalidatePath("/sertifikat/nomor");
  revalidatePath(`/sertifikat/nomor/${batchId}`);
  return { ok: true as const };
}

// â”€â”€â”€ Actions: Cancel Batch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function cancelBatch(id: string) {
  const parsedId = idSchema.parse(id);
  const session = await requirePermission("sertifikat", "configure");

  const [existing] = await db
    .select({ id: certificateBatches.id, status: certificateBatches.status, firstCertificateNumber: certificateBatches.firstCertificateNumber })
    .from(certificateBatches)
    .where(eq(certificateBatches.id, parsedId))
    .limit(1);

  if (!existing) return { ok: false as const, error: "Batch tidak ditemukan." };
  if (existing.status === "cancelled") return { ok: false as const, error: "Batch sudah dibatalkan." };

  await db
    .update(certificateBatches)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(certificateBatches.id, parsedId));

  // Update semua items jadi cancelled
  await db
    .update(certificateItems)
    .set({ status: "cancelled" })
    .where(eq(certificateItems.batchId, parsedId));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CANCEL_CERT_BATCH",
    entitasType: "cert_batch",
    entitasId: parsedId,
    detail: { firstCertificateNumber: existing.firstCertificateNumber },
  });

  revalidatePath("/sertifikat/nomor");
  revalidatePath(`/sertifikat/nomor/${parsedId}`);
  return { ok: true as const };
}

// â”€â”€â”€ Actions: Export CSV â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function exportBatchToCsv(id: string): Promise<
  { ok: true; data: CsvExportRow[]; filename: string } | { ok: false; error: string }
> {
  await requirePermission("sertifikat", "manage");
  const parsedId = idSchema.parse(id);

  const [batch] = await db
    .select({
      id:                     certificateBatches.id,
      firstCertificateNumber: certificateBatches.firstCertificateNumber,
      programName:            certificatePrograms.name,
      angkatan:               certificateBatches.angkatan,
    })
    .from(certificateBatches)
    .innerJoin(certificatePrograms, eq(certificateBatches.programId, certificatePrograms.id))
    .where(eq(certificateBatches.id, parsedId))
    .limit(1);

  if (!batch) return { ok: false, error: "Batch tidak ditemukan." };

  const items = await db
    .select({
      fullNumber:   certificateItems.fullNumber,
      serialNumber: certificateItems.serialNumber,
      status:       certificateItems.status,
    })
    .from(certificateItems)
    .where(
      and(
        eq(certificateItems.batchId, parsedId),
        eq(certificateItems.status, "active"),
      ),
    )
    .orderBy(asc(certificateItems.serialNumber));

  const data: CsvExportRow[] = items.map((item, idx) => ({
    "No.": idx + 1,
    "Nomor Sertifikat": item.fullNumber,
    "Serial Number": item.serialNumber,
    Status: item.status === "active" ? "Aktif" : "Dibatalkan",
  }));

  const safeProgramName = batch.programName.replace(/[^a-zA-Z0-9-_]/g, "_");
  const filename = `sertifikat_${safeProgramName}_${batch.angkatan}_${batch.id.slice(0, 8)}.csv`;

  return { ok: true, data, filename };
}

// â”€â”€â”€ Actions: Rekap Tahunan â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getAvailableYears(): Promise<number[]> {
  await requireSession();

  const rows = await db
    .selectDistinct({
      year: sql<number>`extract(year from ${certificateBatches.createdAt})::int`,
    })
    .from(certificateBatches)
    .orderBy(desc(sql`extract(year from ${certificateBatches.createdAt})::int`));

  return rows.map((r) => r.year);
}

export async function getYearlyStats(year: number): Promise<YearlyStats> {
  await requireSession();

  const [stats] = await db
    .select({
      totalActive:    sql<number>`count(*) filter (where ${certificateItems.status} = 'active')::int`,
      totalCancelled: sql<number>`count(*) filter (where ${certificateItems.status} = 'cancelled')::int`,
      firstSerial:    sql<number | null>`min(${certificateItems.serialNumber}) filter (where ${certificateItems.status} = 'active')`,
      lastSerial:     sql<number | null>`max(${certificateItems.serialNumber}) filter (where ${certificateItems.status} = 'active')`,
    })
    .from(certificateItems)
    .innerJoin(certificateBatches, eq(certificateItems.batchId, certificateBatches.id))
    .where(
      sql`extract(year from ${certificateBatches.createdAt})::int = ${year}`,
    );

  return {
    year,
    totalActive:    stats?.totalActive    ?? 0,
    totalCancelled: stats?.totalCancelled ?? 0,
    firstSerial:    stats?.firstSerial    ?? null,
    lastSerial:     stats?.lastSerial     ?? null,
  };
}

export async function getYearlyProgramStats(year: number): Promise<YearlyProgramStats[]> {
  await requireSession();

  const rows = await db
    .select({
      programName:   certificatePrograms.name,
      classTypeName: certificateClassTypes.name,
      classTypeCode: certificateClassTypes.code,
      activeCount:    sql<number>`count(*) filter (where ${certificateItems.status} = 'active')::int`,
      cancelledCount: sql<number>`count(*) filter (where ${certificateItems.status} = 'cancelled')::int`,
    })
    .from(certificateItems)
    .innerJoin(certificateBatches, eq(certificateItems.batchId, certificateBatches.id))
    .innerJoin(certificatePrograms, eq(certificateBatches.programId, certificatePrograms.id))
    .innerJoin(certificateClassTypes, eq(certificateBatches.classTypeId, certificateClassTypes.id))
    .where(
      sql`extract(year from ${certificateBatches.createdAt})::int = ${year}`,
    )
    .groupBy(
      certificatePrograms.name,
      certificateClassTypes.name,
      certificateClassTypes.code,
    )
    .orderBy(
      asc(certificatePrograms.name),
      asc(certificateClassTypes.code),
    );

  return rows;
}

// â”€â”€â”€ Action: Dashboard Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type CertDashboardStats = {
  totalBatches: number;
  activeBatches: number;
  totalCertificates: number;
};

export async function getCertDashboardStats(): Promise<CertDashboardStats> {
  await requireSession();

  const [stats] = await db
    .select({
      totalBatches:  sql<number>`count(*)::int`,
      activeBatches: sql<number>`count(*) filter (where ${certificateBatches.status} = 'active')::int`,
      totalCertificates: sql<number>`coalesce(sum(${certificateBatches.quantityRequested}), 0)::int`,
    })
    .from(certificateBatches);

  return {
    totalBatches:      stats?.totalBatches      ?? 0,
    activeBatches:     stats?.activeBatches     ?? 0,
    totalCertificates: stats?.totalCertificates ?? 0,
  };
}
