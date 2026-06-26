"use server";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/server/db";
import {
  kelasPelatihan,
  classExcludedDates,
  classSessions,
  honorariumItems,
  honorariumBatches,
  programs,
  systemSettings,
  sessionAssignments,
  classTypes,
  pesertaKelas,
  kelasUjian,
} from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";
import { writeAuditLog } from "@/server/lib/audit";
import {
  kelasOtomatisCreateSchema,
  type KelasOtomatisCreateInput,
  kelasOtomatisUpdateStartDateSchema,
  type KelasOtomatisUpdateStartDateInput,
  kelasOtomatisUpdateStatusSchema,
  type KelasOtomatisUpdateStatusInput,
  kelasOtomatisUpdateMetadataSchema,
  type KelasOtomatisUpdateMetadataInput,
  kelasOtomatisExcludedDateSchema,
  type KelasOtomatisExcludedDateInput,
  kelasOtomatisRemoveExcludedDateSchema,
  type KelasOtomatisRemoveExcludedDateInput,
} from "@/lib/validators/jadwalOtomatis.schema";
import { addDaysToIsoDate } from "@/lib/utils";
import { toNumber } from "./honorarium-utils";
import { generateSchedule } from "./generate";

export type KelasOtomatisRow = {
  id: string;
  namaKelas: string;
  programName: string;
  programCode: string;
  classTypeName: string;
  mode: string;
  angkatan: number | null;
  certificateClassCode: string | null;
  source: string;
  startDate: string;
  endDate: string | null;
  lokasi: string | null;
  financeContactNameOverride: string | null;
  financeWhatsappNumberOverride: string | null;
  status: string;
  totalSessions: number;
  createdAt: Date;
};

export type ResolvedFinanceWhatsappContact = {
  financeContactName: string | null;
  financeWhatsappNumber: string | null;
  source: "kelas_override" | "global_default" | "unconfigured";
};

export type KelasHonorariumWhatsappSnapshot = {
  batchId: string;
  documentNumber: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
  totalAmount: number;
  perInstructor: Array<{
    instructorId: string;
    instructorName: string;
    amount: number;
  }>;
};

function parseIsoDateToUtc(date: string) {
  const [yearText, monthText, dayText] = date.split("-");
  const year = Number.parseInt(yearText ?? "", 10);
  const month = Number.parseInt(monthText ?? "", 10);
  const day = Number.parseInt(dayText ?? "", 10);
  return Date.UTC(year, month - 1, day);
}

function dateDiffInDays(fromDate: string, toDate: string) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((parseIsoDateToUtc(toDate) - parseIsoDateToUtc(fromDate)) / msPerDay);
}

function shiftIsoDate(date: string, offsetDays: number) {
  return addDaysToIsoDate(date, offsetDays);
}

function normalizeContactValue(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function resolveFinanceContactFromCandidates(values: {
  kelasContactNameOverride: string | null | undefined;
  kelasWhatsappNumberOverride: string | null | undefined;
  globalContactName: string | null | undefined;
  globalWhatsappNumber: string | null | undefined;
}): ResolvedFinanceWhatsappContact {
  const kelasContactNameOverride = normalizeContactValue(values.kelasContactNameOverride);
  const kelasWhatsappNumberOverride = normalizeContactValue(values.kelasWhatsappNumberOverride);
  const globalContactName = normalizeContactValue(values.globalContactName);
  const globalWhatsappNumber = normalizeContactValue(values.globalWhatsappNumber);

  if (kelasWhatsappNumberOverride) {
    return {
      financeContactName: kelasContactNameOverride ?? globalContactName,
      financeWhatsappNumber: kelasWhatsappNumberOverride,
      source: "kelas_override",
    };
  }

  if (globalWhatsappNumber) {
    return {
      financeContactName: globalContactName,
      financeWhatsappNumber: globalWhatsappNumber,
      source: "global_default",
    };
  }

  return {
    financeContactName: null,
    financeWhatsappNumber: null,
    source: "unconfigured",
  };
}

// ─── SHARED INTERNAL HELPERS ──────────────────────────────────────────────────

function revalidateKelas(kelasId?: string) {
  revalidatePath("/jadwal-otomatis");
  if (kelasId) {
    revalidatePath(`/jadwal-otomatis/${kelasId}`);
  }
}

/**
 * Clears existing sessions + assignments for a kelas, regenerates the schedule,
 * and updates the kelas endDate. Used by all functions that modify schedule-affecting data.
 */
async function regenerateScheduleForKelas(kelas: {
  id: string;
  programId: string;
  classTypeId: string;
  startDate: string;
}) {
  const sessionRows = await db
    .select({ id: classSessions.id })
    .from(classSessions)
    .where(eq(classSessions.kelasId, kelas.id));

  if (sessionRows.length > 0) {
    const sessionIds = sessionRows.map((row) => row.id);
    await db.delete(sessionAssignments).where(inArray(sessionAssignments.sessionId, sessionIds));
  }

  await db.delete(classSessions).where(eq(classSessions.kelasId, kelas.id));

  await generateSchedule({
    kelasId: kelas.id,
    programId: kelas.programId,
    classTypeId: kelas.classTypeId,
    startDate: kelas.startDate,
  });

  const lastSessions = await db
    .select({ scheduledDate: classSessions.scheduledDate })
    .from(classSessions)
    .where(eq(classSessions.kelasId, kelas.id))
    .orderBy(asc(classSessions.scheduledDate));

  const lastSession = lastSessions[lastSessions.length - 1];
  await db
    .update(kelasPelatihan)
    .set({ endDate: lastSession?.scheduledDate ?? null, updatedAt: new Date() })
    .where(eq(kelasPelatihan.id, kelas.id));
}

export async function listKelasOtomatis(
  filter?: { excludeCancelled?: boolean },
): Promise<KelasOtomatisRow[]> {
  await requirePermission("jadwalPelatihan", "view");

  const conditions = [];
  if (filter?.excludeCancelled) {
    conditions.push(sql`${kelasPelatihan.status} != 'cancelled'`);
  }

  const rows = await db
    .select({
      id: kelasPelatihan.id,
      namaKelas: kelasPelatihan.namaKelas,
      programName: programs.name,
      programCode: programs.code,
      classTypeName: classTypes.name,
      mode: kelasPelatihan.mode,
      angkatan: kelasPelatihan.angkatan,
      certificateClassCode: kelasPelatihan.certificateClassCode,
      source: kelasPelatihan.source,
      startDate: kelasPelatihan.startDate,
      endDate: kelasPelatihan.endDate,
      lokasi: kelasPelatihan.lokasi,
      financeContactNameOverride: kelasPelatihan.financeContactNameOverride,
      financeWhatsappNumberOverride: kelasPelatihan.financeWhatsappNumberOverride,
      status: kelasPelatihan.status,
      totalSessions:
        sql<number>`COALESCE((SELECT COUNT(*) FROM ${classSessions} WHERE ${classSessions.kelasId} = ${kelasPelatihan.id})::int, 0)`.as(
          "total_sessions",
        ),
      createdAt: kelasPelatihan.createdAt,
    })
    .from(kelasPelatihan)
    .leftJoin(programs, eq(kelasPelatihan.programId, programs.id))
    .leftJoin(classTypes, eq(kelasPelatihan.classTypeId, classTypes.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(kelasPelatihan.createdAt));

  return rows as KelasOtomatisRow[];
}

export async function createKelasOtomatis(data: KelasOtomatisCreateInput) {
  const parsed = kelasOtomatisCreateSchema.parse(data);
  const session = await requirePermission("jadwalPelatihan", "manage");

  const id = nanoid();

  // Insert excluded dates
  if (parsed.excludedDates.length > 0) {
    const seen = new Set<string>();
    for (const entry of parsed.excludedDates) {
      if (seen.has(entry.date)) continue;
      seen.add(entry.date);
      try {
        await db
          .insert(classExcludedDates)
          .values({ id: nanoid(), kelasId: id, date: entry.date, reason: entry.reason ?? "Manual" })
          .onConflictDoNothing();
      } catch {
        // skip duplicate
      }
    }
  }

  // Insert kelas
  const rows = await db
    .insert(kelasPelatihan)
    .values({
      id,
      namaKelas: parsed.namaKelas,
      programId: parsed.programId,
      classTypeId: parsed.classTypeId,
      mode: parsed.mode ?? "offline",
      angkatan: parsed.angkatan ?? null,
      certificateClassCode: parsed.certificateClassCode || null,
      source: "system",
      startDate: parsed.startDate,
      lokasi: parsed.lokasi || null,
      financeContactNameOverride: parsed.financeContactNameOverride || null,
      financeWhatsappNumberOverride: parsed.financeWhatsappNumberOverride || null,
      status: "active",
    })
    .returning();

  const row = rows[0];
  if (!row) throw new Error("Gagal membuat kelas");

  // Generate schedule
  await generateSchedule({
    kelasId: id,
    programId: parsed.programId,
    classTypeId: parsed.classTypeId,
    startDate: parsed.startDate,
  });

  // Update end date based on last session
  const lastSessions = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.kelasId, id))
    .orderBy(asc(classSessions.scheduledDate));

  const lastSession = lastSessions[lastSessions.length - 1];
  if (lastSession) {
    await db
      .update(kelasPelatihan)
      .set({ endDate: lastSession.scheduledDate, updatedAt: new Date() })
      .where(eq(kelasPelatihan.id, id));
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_KELAS_PELATIHAN",
    entitasType: "kelas_pelatihan",
    entitasId: id,
    detail: { namaKelas: parsed.namaKelas, programId: parsed.programId, classTypeId: parsed.classTypeId, startDate: parsed.startDate },
  });

  revalidateKelas();
  return { ok: true as const, data: row };
}

export async function getKelasOtomatisDetail(id: string) {
  await requirePermission("jadwalPelatihan", "view");

  const row = await db
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
      endDate: kelasPelatihan.endDate,
      lokasi: kelasPelatihan.lokasi,
      financeContactNameOverride: kelasPelatihan.financeContactNameOverride,
      financeWhatsappNumberOverride: kelasPelatihan.financeWhatsappNumberOverride,
      status: kelasPelatihan.status,
      createdAt: kelasPelatihan.createdAt,
    })
    .from(kelasPelatihan)
    .leftJoin(programs, eq(kelasPelatihan.programId, programs.id))
    .leftJoin(classTypes, eq(kelasPelatihan.classTypeId, classTypes.id))
    .where(eq(kelasPelatihan.id, id))
    .then((r) => r[0] ?? null);

  if (!row) return null;

  const settings = await db
    .select({
      globalFinanceContactName: systemSettings.financeContactName,
      globalFinanceWhatsappNumber: systemSettings.financeWhatsappNumber,
    })
    .from(systemSettings)
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const resolvedFinanceContact = resolveFinanceContactFromCandidates({
    kelasContactNameOverride: row.financeContactNameOverride,
    kelasWhatsappNumberOverride: row.financeWhatsappNumberOverride,
    globalContactName: settings?.globalFinanceContactName,
    globalWhatsappNumber: settings?.globalFinanceWhatsappNumber,
  });

  return {
    ...row,
    financeContactName: resolvedFinanceContact.financeContactName,
    financeWhatsappNumber: resolvedFinanceContact.financeWhatsappNumber,
    financeContactSource: resolvedFinanceContact.source,
  };
}

export async function resolveFinanceWhatsappContactForKelas(
  kelasId: string,
): Promise<ResolvedFinanceWhatsappContact | null> {
  await requirePermission("jadwalPelatihan", "view");

  const kelas = await db
    .select({
      financeContactNameOverride: kelasPelatihan.financeContactNameOverride,
      financeWhatsappNumberOverride: kelasPelatihan.financeWhatsappNumberOverride,
    })
    .from(kelasPelatihan)
    .where(eq(kelasPelatihan.id, kelasId))
    .then((rows) => rows[0] ?? null);

  if (!kelas) return null;

  const settings = await db
    .select({
      globalFinanceContactName: systemSettings.financeContactName,
      globalFinanceWhatsappNumber: systemSettings.financeWhatsappNumber,
    })
    .from(systemSettings)
    .limit(1)
    .then((rows) => rows[0] ?? null);

  return resolveFinanceContactFromCandidates({
    kelasContactNameOverride: kelas.financeContactNameOverride,
    kelasWhatsappNumberOverride: kelas.financeWhatsappNumberOverride,
    globalContactName: settings?.globalFinanceContactName,
    globalWhatsappNumber: settings?.globalFinanceWhatsappNumber,
  });
}

export async function getLatestHonorariumWhatsappSnapshotByKelas(
  kelasId: string,
): Promise<KelasHonorariumWhatsappSnapshot | null> {
  await requirePermission("jadwalPelatihan", "view");

  const latestBatch = await db
    .select({
      batchId: honorariumBatches.id,
      documentNumber: honorariumBatches.documentNumber,
      status: honorariumBatches.status,
      periodStart: honorariumBatches.periodStart,
      periodEnd: honorariumBatches.periodEnd,
      paidAt: honorariumBatches.paidAt,
      createdAt: honorariumBatches.createdAt,
    })
    .from(honorariumItems)
    .innerJoin(honorariumBatches, eq(honorariumItems.batchId, honorariumBatches.id))
    .where(eq(honorariumItems.kelasId, kelasId))
    .orderBy(desc(honorariumBatches.createdAt), desc(honorariumBatches.periodEnd))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!latestBatch) return null;

  const itemRows = await db
    .select({
      instructorId: honorariumItems.paidInstructorId,
      instructorName: honorariumItems.paidInstructorName,
      amount: sql<string>`SUM(${honorariumItems.amount})`,
    })
    .from(honorariumItems)
    .where(
      and(
        eq(honorariumItems.kelasId, kelasId),
        eq(honorariumItems.batchId, latestBatch.batchId),
      ),
    )
    .groupBy(honorariumItems.paidInstructorId, honorariumItems.paidInstructorName)
    .orderBy(asc(honorariumItems.paidInstructorName));

  const perInstructor = itemRows.map((row) => ({
    instructorId: row.instructorId,
    instructorName: row.instructorName,
    amount: toNumber(row.amount),
  }));

  return {
    batchId: latestBatch.batchId,
    documentNumber: latestBatch.documentNumber,
    status: latestBatch.status,
    periodStart: latestBatch.periodStart,
    periodEnd: latestBatch.periodEnd,
    paidAt: latestBatch.paidAt ? latestBatch.paidAt.toISOString() : null,
    totalAmount: perInstructor.reduce((total, row) => total + row.amount, 0),
    perInstructor,
  };
}

export async function getSessionsByKelas(kelasId: string) {
  await requirePermission("jadwalPelatihan", "view");

  return db
    .select()
    .from(classSessions)
    .where(eq(classSessions.kelasId, kelasId))
    .orderBy(asc(classSessions.scheduledDate));
}

const kelasFinanceOverrideSchema = z.object({
  id: z.string().min(1),
  financeContactNameOverride: z.string().trim().max(200).optional().or(z.literal("")),
  financeWhatsappNumberOverride: z
    .string()
    .trim()
    .max(30)
    .optional()
    .or(z.literal("")),
});

export async function updateKelasFinanceContactOverride(input: unknown) {
  await requirePermission("jadwalPelatihan", "manage");
  const parsed = kelasFinanceOverrideSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }

  const updated = await db
    .update(kelasPelatihan)
    .set({
      financeContactNameOverride: parsed.data.financeContactNameOverride?.trim() || null,
      financeWhatsappNumberOverride: parsed.data.financeWhatsappNumberOverride?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(kelasPelatihan.id, parsed.data.id))
    .returning({ id: kelasPelatihan.id });

  if (updated.length === 0) {
    return { ok: false as const, error: "Kelas tidak ditemukan." };
  }

  revalidateKelas(parsed.data.id);
  return { ok: true as const };
}

export async function deleteKelasOtomatis(id: string) {
  const session = await requirePermission("jadwalPelatihan", "configure");

  const pesertaCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pesertaKelas)
    .where(eq(pesertaKelas.kelasId, id))
    .then((r) => r[0]?.count ?? 0);

  const honorariumCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(honorariumItems)
    .where(eq(honorariumItems.kelasId, id))
    .then((r) => r[0]?.count ?? 0);

  const kelasUjianCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(kelasUjian)
    .where(eq(kelasUjian.kelasPelatihanId, id))
    .then((r) => r[0]?.count ?? 0);

  if (honorariumCount > 0) {
    return {
      ok: false as const,
      error: "Kelas sudah masuk perhitungan honorarium. Hapus permanen diblokir. Gunakan Batalkan Kelas.",
    };
  }

  if (pesertaCount > 0 || kelasUjianCount > 0) {
    return {
      ok: false as const,
      error: `Kelas memiliki ${pesertaCount} peserta dan ${kelasUjianCount} kelas ujian terkait. Hapus permanen diblokir.`,
      blockers: { pesertaCount, kelasUjianCount },
    };
  }

  await db.delete(kelasPelatihan).where(eq(kelasPelatihan.id, id));
  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_KELAS_PELATIHAN",
    entitasType: "kelas_pelatihan",
    entitasId: id,
  });

  revalidateKelas();
  return { ok: true as const };
}

export async function updateKelasOtomatisStatus(data: KelasOtomatisUpdateStatusInput) {
  const session = await requirePermission("jadwalPelatihan", "manage");
  const parsed = kelasOtomatisUpdateStatusSchema.parse(data);

  const kelas = await db
    .select({
      id: kelasPelatihan.id,
      status: kelasPelatihan.status,
    })
    .from(kelasPelatihan)
    .where(eq(kelasPelatihan.id, parsed.id))
    .then((rows) => rows[0] ?? null);

  if (!kelas) {
    return { ok: false as const, error: "Kelas tidak ditemukan." };
  }

  if (kelas.status === parsed.status) {
    return { ok: true as const, unchanged: true as const };
  }

  const allowedTransitions: Record<string, string[]> = {
    active: ["completed", "cancelled"],
    cancelled: ["active"],
    completed: ["active"],
  };

  if (!allowedTransitions[kelas.status]?.includes(parsed.status)) {
    return {
      ok: false as const,
      error: `Transisi status dari "${kelas.status}" ke "${parsed.status}" tidak diizinkan.`,
    };
  }

  if (parsed.status === "cancelled") {
    const honorariumCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(honorariumItems)
      .where(eq(honorariumItems.kelasId, parsed.id))
      .then((r) => r[0]?.count ?? 0);

    if (honorariumCount > 0) {
      return {
        ok: false as const,
        error: "Kelas sudah masuk perhitungan honorarium. Pembatalan diblokir.",
      };
    }
  }

  if ((parsed.status === "cancelled" || kelas.status === "completed") && !parsed.reason) {
    return {
      ok: false as const,
      error: "Alasan wajib diisi untuk transisi status ini.",
    };
  }

  await db
    .update(kelasPelatihan)
    .set({ status: parsed.status, updatedAt: new Date() })
    .where(eq(kelasPelatihan.id, parsed.id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_STATUS_KELAS_PELATIHAN",
    entitasType: "kelas_pelatihan",
    entitasId: parsed.id,
    detail: { from: kelas.status, to: parsed.status, reason: parsed.reason ?? null },
  });

  revalidateKelas(parsed.id);
  return { ok: true as const };
}

export async function updateKelasOtomatisMetadata(data: KelasOtomatisUpdateMetadataInput) {
  const session = await requirePermission("jadwalPelatihan", "manage");
  const parsed = kelasOtomatisUpdateMetadataSchema.parse(data);

  const existing = await db
    .select({ id: kelasPelatihan.id })
    .from(kelasPelatihan)
    .where(eq(kelasPelatihan.id, parsed.id))
    .then((rows) => rows[0] ?? null);

  if (!existing) {
    return { ok: false as const, error: "Kelas tidak ditemukan." };
  }

  await db
    .update(kelasPelatihan)
    .set({
      namaKelas: parsed.namaKelas,
      mode: parsed.mode,
      angkatan: parsed.angkatan ?? null,
      certificateClassCode: parsed.certificateClassCode || null,
      lokasi: parsed.lokasi || null,
      updatedAt: new Date(),
    })
    .where(eq(kelasPelatihan.id, parsed.id));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_METADATA_KELAS_PELATIHAN",
    entitasType: "kelas_pelatihan",
    entitasId: parsed.id,
    detail: {
      namaKelas: parsed.namaKelas,
      mode: parsed.mode,
      angkatan: parsed.angkatan ?? null,
      certificateClassCode: parsed.certificateClassCode ?? null,
      lokasi: parsed.lokasi ?? null,
    },
  });

  revalidateKelas(parsed.id);
  return { ok: true as const };
}

export async function updateKelasOtomatisStartDate(data: KelasOtomatisUpdateStartDateInput) {
  await requirePermission("jadwalPelatihan", "manage");
  const parsed = kelasOtomatisUpdateStartDateSchema.parse(data);

  const kelas = await db
    .select({
      id: kelasPelatihan.id,
      programId: kelasPelatihan.programId,
      classTypeId: kelasPelatihan.classTypeId,
      startDate: kelasPelatihan.startDate,
      status: kelasPelatihan.status,
    })
    .from(kelasPelatihan)
    .where(eq(kelasPelatihan.id, parsed.id))
    .then((rows) => rows[0] ?? null);

  if (!kelas) {
    return { ok: false as const, error: "Kelas tidak ditemukan." };
  }

  if (kelas.status !== "active") {
    return { ok: false as const, error: "Hanya kelas aktif yang dapat diubah tanggal mulainya." };
  }

  if (kelas.startDate === parsed.startDate) {
    return { ok: true as const, unchanged: true as const };
  }

  const startDateOffsetDays = dateDiffInDays(kelas.startDate, parsed.startDate);

  const linkedHonorarium = await db
    .select({ id: honorariumItems.id })
    .from(honorariumItems)
    .where(eq(honorariumItems.kelasId, parsed.id))
    .limit(1);

  if (linkedHonorarium.length > 0) {
    return {
      ok: false as const,
      error:
        "Kelas sudah masuk perhitungan honorarium. Ubah tanggal mulai diblokir untuk menjaga konsistensi data keuangan.",
    };
  }

  if (parsed.exclusionStrategy === "clear") {
    await db.delete(classExcludedDates).where(eq(classExcludedDates.kelasId, parsed.id));
  }

  if (parsed.exclusionStrategy === "shift") {
    const exclusions = await db
      .select({
        reason: classExcludedDates.reason,
        date: classExcludedDates.date,
      })
      .from(classExcludedDates)
      .where(eq(classExcludedDates.kelasId, parsed.id));

    await db.delete(classExcludedDates).where(eq(classExcludedDates.kelasId, parsed.id));

    if (exclusions.length > 0) {
      const deduplicated = new Map<string, string | null>();
      for (const exclusion of exclusions) {
        const shiftedDate = shiftIsoDate(exclusion.date, startDateOffsetDays);
        if (!deduplicated.has(shiftedDate)) {
          deduplicated.set(shiftedDate, exclusion.reason ?? "Manual");
        }
      }

      await db.insert(classExcludedDates).values(
        Array.from(deduplicated.entries()).map(([date, reason]) => ({
          id: nanoid(),
          kelasId: parsed.id,
          date,
          reason,
        })),
      );
    }
  }

  await db
    .update(kelasPelatihan)
    .set({
      startDate: parsed.startDate,
      endDate: null,
      updatedAt: new Date(),
    })
    .where(eq(kelasPelatihan.id, parsed.id));

  await regenerateScheduleForKelas({
    id: kelas.id,
    programId: kelas.programId,
    classTypeId: kelas.classTypeId,
    startDate: parsed.startDate,
  });

  revalidateKelas(parsed.id);
  return {
    ok: true as const,
    exclusionStrategy: parsed.exclusionStrategy,
    startDateOffsetDays,
  };
}

export async function listExcludedDatesByKelas(kelasId: string) {
  await requirePermission("jadwalPelatihan", "view");

  return db
    .select({
      id: classExcludedDates.id,
      date: classExcludedDates.date,
      reason: classExcludedDates.reason,
    })
    .from(classExcludedDates)
    .where(eq(classExcludedDates.kelasId, kelasId))
    .orderBy(asc(classExcludedDates.date));
}

export async function addExcludedDateToKelas(input: KelasOtomatisExcludedDateInput) {
  const session = await requirePermission("jadwalPelatihan", "manage");
  const parsed = kelasOtomatisExcludedDateSchema.parse(input);

  const kelas = await db
    .select({
      id: kelasPelatihan.id,
      programId: kelasPelatihan.programId,
      classTypeId: kelasPelatihan.classTypeId,
      startDate: kelasPelatihan.startDate,
      status: kelasPelatihan.status,
    })
    .from(kelasPelatihan)
    .where(eq(kelasPelatihan.id, parsed.kelasId))
    .then((rows) => rows[0] ?? null);

  if (!kelas) {
    return { ok: false as const, error: "Kelas tidak ditemukan." };
  }

  if (kelas.status !== "active") {
    return { ok: false as const, error: "Hanya kelas aktif yang dapat diubah eksklusinya." };
  }

  const linkedHonorarium = await db
    .select({ id: honorariumItems.id })
    .from(honorariumItems)
    .where(eq(honorariumItems.kelasId, parsed.kelasId))
    .limit(1);

  if (linkedHonorarium.length > 0) {
    return {
      ok: false as const,
      error: "Kelas sudah masuk perhitungan honorarium. Ubah eksklusi diblokir untuk menjaga konsistensi data keuangan.",
    };
  }

  try {
    await db
      .insert(classExcludedDates)
      .values({ id: nanoid(), kelasId: parsed.kelasId, date: parsed.date, reason: parsed.reason ?? "Manual" })
      .onConflictDoNothing();
  } catch {
    return { ok: false as const, error: "Tanggal eksklusi sudah ada atau gagal ditambahkan." };
  }

  await regenerateScheduleForKelas({
    id: kelas.id,
    programId: kelas.programId,
    classTypeId: kelas.classTypeId,
    startDate: kelas.startDate,
  });

  await writeAuditLog({
    userId: session.user.id,
    aksi: "ADD_EXCLUDED_DATE_KELAS",
    entitasType: "kelas_pelatihan",
    entitasId: parsed.kelasId,
    detail: { date: parsed.date, reason: parsed.reason ?? "Manual" },
  });

  revalidateKelas(parsed.kelasId);
  return { ok: true as const };
}

export async function removeExcludedDateFromKelas(input: KelasOtomatisRemoveExcludedDateInput) {
  const session = await requirePermission("jadwalPelatihan", "manage");
  const parsed = kelasOtomatisRemoveExcludedDateSchema.parse(input);

  const kelas = await db
    .select({
      id: kelasPelatihan.id,
      programId: kelasPelatihan.programId,
      classTypeId: kelasPelatihan.classTypeId,
      startDate: kelasPelatihan.startDate,
      status: kelasPelatihan.status,
    })
    .from(kelasPelatihan)
    .where(eq(kelasPelatihan.id, parsed.kelasId))
    .then((rows) => rows[0] ?? null);

  if (!kelas) {
    return { ok: false as const, error: "Kelas tidak ditemukan." };
  }

  if (kelas.status !== "active") {
    return { ok: false as const, error: "Hanya kelas aktif yang dapat diubah eksklusinya." };
  }

  const linkedHonorarium = await db
    .select({ id: honorariumItems.id })
    .from(honorariumItems)
    .where(eq(honorariumItems.kelasId, parsed.kelasId))
    .limit(1);

  if (linkedHonorarium.length > 0) {
    return {
      ok: false as const,
      error: "Kelas sudah masuk perhitungan honorarium. Ubah eksklusi diblokir untuk menjaga konsistensi data keuangan.",
    };
  }

  const deleted = await db
    .delete(classExcludedDates)
    .where(
      and(
        eq(classExcludedDates.kelasId, parsed.kelasId),
        eq(classExcludedDates.date, parsed.date),
      ),
    )
    .returning({ id: classExcludedDates.id });

  if (deleted.length === 0) {
    return { ok: false as const, error: "Tanggal eksklusi tidak ditemukan." };
  }

  await regenerateScheduleForKelas({
    id: kelas.id,
    programId: kelas.programId,
    classTypeId: kelas.classTypeId,
    startDate: kelas.startDate,
  });

  await writeAuditLog({
    userId: session.user.id,
    aksi: "REMOVE_EXCLUDED_DATE_KELAS",
    entitasType: "kelas_pelatihan",
    entitasId: parsed.kelasId,
    detail: { date: parsed.date },
  });

  revalidateKelas(parsed.kelasId);
  return { ok: true as const };
}

export async function forceRegenerateSchedule(kelasId: string) {
  const session = await requirePermission("jadwalPelatihan", "manage");

  const kelas = await db
    .select({
      id: kelasPelatihan.id,
      programId: kelasPelatihan.programId,
      classTypeId: kelasPelatihan.classTypeId,
      startDate: kelasPelatihan.startDate,
      status: kelasPelatihan.status,
    })
    .from(kelasPelatihan)
    .where(eq(kelasPelatihan.id, kelasId))
    .then((rows) => rows[0] ?? null);

  if (!kelas) {
    return { ok: false as const, error: "Kelas tidak ditemukan." };
  }

  // Hapus honorarium items terkait kelas ini
  const deletedHonorItems = await db
    .delete(honorariumItems)
    .where(eq(honorariumItems.kelasId, kelasId))
    .returning({ id: honorariumItems.id, batchId: honorariumItems.batchId });

  // Hapus batch yang jadi kosong (tidak punya items lagi)
  if (deletedHonorItems.length > 0) {
    const affectedBatchIds = [...new Set(deletedHonorItems.map((item) => item.batchId))];
    for (const batchId of affectedBatchIds) {
      const remainingItems = await db
        .select({ id: honorariumItems.id })
        .from(honorariumItems)
        .where(eq(honorariumItems.batchId, batchId))
        .limit(1);
      if (remainingItems.length === 0) {
        await db.delete(honorariumBatches).where(eq(honorariumBatches.id, batchId));
      }
    }
  }

  // Hapus semua assignment instruktur terkait dan regenerasi
  await regenerateScheduleForKelas({
    id: kelas.id,
    programId: kelas.programId,
    classTypeId: kelas.classTypeId,
    startDate: kelas.startDate,
  });

  await writeAuditLog({
    userId: session.user.id,
    aksi: "FORCE_REGENERATE_SCHEDULE",
    entitasType: "kelas_pelatihan",
    entitasId: kelasId,
    detail: {
      reason: "Force regenerate - bypass honorarium check",
      deletedHonorItemsCount: deletedHonorItems.length,
    },
  });

  revalidateKelas(kelasId);
  return { ok: true as const };
}
