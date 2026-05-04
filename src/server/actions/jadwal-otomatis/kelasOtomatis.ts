"use server";

import { asc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { db } from "@/server/db";
import {
  kelasPelatihan,
  classExcludedDates,
  classSessions,
  honorariumItems,
  programs,
  sessionAssignments,
  classTypes,
} from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";
import {
  kelasOtomatisCreateSchema,
  type KelasOtomatisCreateInput,
  kelasOtomatisUpdateStartDateSchema,
  type KelasOtomatisUpdateStartDateInput,
} from "@/lib/validators/jadwalOtomatis.schema";
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
  status: string;
  totalSessions: number;
  createdAt: Date;
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
  const utcMs = parseIsoDateToUtc(date) + offsetDays * 24 * 60 * 60 * 1000;
  return new Date(utcMs).toISOString().slice(0, 10);
}

export async function listKelasOtomatis(): Promise<KelasOtomatisRow[]> {
  await requirePermission("jadwalUjian", "view");

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
    .orderBy(asc(kelasPelatihan.createdAt));

  return rows as KelasOtomatisRow[];
}

export async function createKelasOtomatis(data: KelasOtomatisCreateInput) {
  const parsed = kelasOtomatisCreateSchema.parse(data);
  await requirePermission("jadwalUjian", "manage");

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

  revalidatePath("/jadwal-otomatis");
  return { ok: true as const, data: row };
}

export async function getKelasOtomatisDetail(id: string) {
  await requirePermission("jadwalUjian", "view");

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
      status: kelasPelatihan.status,
      createdAt: kelasPelatihan.createdAt,
    })
    .from(kelasPelatihan)
    .leftJoin(programs, eq(kelasPelatihan.programId, programs.id))
    .leftJoin(classTypes, eq(kelasPelatihan.classTypeId, classTypes.id))
    .where(eq(kelasPelatihan.id, id))
    .then((r) => r[0] ?? null);

  return row;
}

export async function getSessionsByKelas(kelasId: string) {
  await requirePermission("jadwalUjian", "view");

  return db
    .select()
    .from(classSessions)
    .where(eq(classSessions.kelasId, kelasId))
    .orderBy(asc(classSessions.scheduledDate));
}

export async function deleteKelasOtomatis(id: string) {
  await requirePermission("jadwalUjian", "configure");

  await db.delete(kelasPelatihan).where(eq(kelasPelatihan.id, id));

  revalidatePath("/jadwal-otomatis");
  return { ok: true as const };
}

export async function updateKelasOtomatisStartDate(data: KelasOtomatisUpdateStartDateInput) {
  await requirePermission("jadwalUjian", "manage");
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

  const sessionRows = await db
    .select({ id: classSessions.id })
    .from(classSessions)
    .where(eq(classSessions.kelasId, parsed.id));

  if (sessionRows.length > 0) {
    const sessionIds = sessionRows.map((row) => row.id);
    await db
      .delete(sessionAssignments)
      .where(inArray(sessionAssignments.sessionId, sessionIds));
  }

  await db.delete(classSessions).where(eq(classSessions.kelasId, parsed.id));

  await db
    .update(kelasPelatihan)
    .set({
      startDate: parsed.startDate,
      endDate: null,
      updatedAt: new Date(),
    })
    .where(eq(kelasPelatihan.id, parsed.id));

  await generateSchedule({
    kelasId: kelas.id,
    programId: kelas.programId,
    classTypeId: kelas.classTypeId,
    startDate: parsed.startDate,
  });

  const lastSessions = await db
    .select({ scheduledDate: classSessions.scheduledDate })
    .from(classSessions)
    .where(eq(classSessions.kelasId, parsed.id))
    .orderBy(asc(classSessions.scheduledDate));

  const lastSession = lastSessions[lastSessions.length - 1];
  await db
    .update(kelasPelatihan)
    .set({
      endDate: lastSession?.scheduledDate ?? null,
      updatedAt: new Date(),
    })
    .where(eq(kelasPelatihan.id, parsed.id));

  revalidatePath("/jadwal-otomatis");
  revalidatePath(`/jadwal-otomatis/${parsed.id}`);
  return {
    ok: true as const,
    exclusionStrategy: parsed.exclusionStrategy,
    startDateOffsetDays,
  };
}
