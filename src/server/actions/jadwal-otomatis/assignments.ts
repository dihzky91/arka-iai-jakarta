"use server";

import { eq, and, asc, or, desc, sql, gte, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/server/db";
import {
  sessionAssignments,
  classSessions,
  kelasPelatihan,
  programs,
  instructors,
  instructorExpertise,
  honorariumItems,
} from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";
import { addDaysToIsoDate, getTodayIsoInJakarta } from "@/lib/utils";

const bulkUnassignSchema = z.object({
  assignmentIds: z.array(z.string().min(1)).min(1, "Pilih minimal satu assignment").max(200),
});

const availabilityStatusSchema = z.enum([
  "pending_wa_confirmation",
  "accepted",
  "rejected",
  "no_response",
]);

const expertiseLevelWeight: Record<"basic" | "middle" | "senior", number> = {
  basic: 0.6,
  middle: 0.8,
  senior: 1,
};

type ExpertiseLevel = "basic" | "middle" | "senior";

function normalizeExpertiseLevel(level: string | null): ExpertiseLevel | null {
  if (level === "basic" || level === "middle" || level === "senior") return level;
  if (level === "intermediate") return "middle";
  if (level === "expert") return "senior";
  return null;
}

function expertiseLevelLabel(level: ExpertiseLevel) {
  if (level === "basic") return "Basic";
  if (level === "middle") return "Middle";
  return "Senior";
}

// ASSIGN

const assignSchema = z.object({
  sessionId: z.string().min(1),
  plannedInstructorId: z.string().min(1),
});

export async function assignInstructorToSession(data: z.infer<typeof assignSchema>) {
  const parsed = assignSchema.parse(data);
  await requirePermission("jadwalUjian", "manage");

  const session = await db
    .select({
      materiName: classSessions.materiName,
      kelasId: classSessions.kelasId,
    })
    .from(classSessions)
    .where(eq(classSessions.id, parsed.sessionId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!session) return { ok: false as const, error: "Sesi tidak ditemukan." };

  const kelas = await db
    .select({ programId: kelasPelatihan.programId })
    .from(kelasPelatihan)
    .where(eq(kelasPelatihan.id, session.kelasId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!kelas) return { ok: false as const, error: "Kelas tidak ditemukan." };
  if (!session.materiName) return { ok: false as const, error: "Sesi tidak memiliki materi." };

  const expertise = await db
    .select()
    .from(instructorExpertise)
    .where(
      and(
        eq(instructorExpertise.instructorId, parsed.plannedInstructorId),
        eq(instructorExpertise.programId, kelas.programId),
        eq(instructorExpertise.materiBlock, session.materiName),
      ),
    )
    .limit(1);

  if (expertise.length === 0) {
    return {
      ok: false as const,
      error: `Instruktur tidak memiliki keahlian untuk materi "${session.materiName}". Tambahkan keahlian terlebih dahulu.`,
    };
  }

  const existing = await db
    .select()
    .from(sessionAssignments)
    .where(
      and(
        eq(sessionAssignments.sessionId, parsed.sessionId),
        eq(sessionAssignments.plannedInstructorId, parsed.plannedInstructorId),
      ),
    );

  if (existing.length > 0) return { ok: true as const };

  await db.insert(sessionAssignments).values({
    id: nanoid(),
    sessionId: parsed.sessionId,
    plannedInstructorId: parsed.plannedInstructorId,
    availabilityStatus: "pending_wa_confirmation",
  });

  revalidatePath("/jadwal-otomatis");
  return { ok: true as const };
}

// BULK ASSIGN BY BLOCK

export async function assignInstructorToBlock(
  kelasId: string,
  instrukturId: string,
  materiBlock: string,
) {
  await requirePermission("jadwalUjian", "manage");

  const kelas = await db
    .select({ programId: kelasPelatihan.programId })
    .from(kelasPelatihan)
    .where(eq(kelasPelatihan.id, kelasId))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!kelas) return { ok: false as const, error: "Kelas tidak ditemukan." };

  const expertise = await db
    .select()
    .from(instructorExpertise)
    .where(
      and(
        eq(instructorExpertise.instructorId, instrukturId),
        eq(instructorExpertise.programId, kelas.programId),
        eq(instructorExpertise.materiBlock, materiBlock),
      ),
    )
    .limit(1);

  if (expertise.length === 0) {
    return {
      ok: false as const,
      error: `Instruktur tidak memiliki keahlian untuk blok materi "${materiBlock}". Tambahkan keahlian terlebih dahulu.`,
      assignedCount: 0,
    };
  }

  const sessions = await db
    .select()
    .from(classSessions)
    .where(
      and(
        eq(classSessions.kelasId, kelasId),
        eq(classSessions.materiName, materiBlock),
        eq(classSessions.isExamDay, false),
      ),
    );

  let insertedCount = 0;
  for (const session of sessions) {
    const existing = await db
      .select()
      .from(sessionAssignments)
      .where(eq(sessionAssignments.sessionId, session.id));

    if (existing.length > 0) continue;

    insertedCount += 1;
    await db.insert(sessionAssignments).values({
      id: nanoid(),
      sessionId: session.id,
      plannedInstructorId: instrukturId,
      availabilityStatus: "pending_wa_confirmation",
    });
  }

  revalidatePath("/jadwal-otomatis");
  return { ok: true as const, assignedCount: insertedCount };
}

// SUBSTITUTE

export async function substituteInstructor(
  assignmentId: string,
  newInstructorId: string,
  reason: string,
) {
  await requirePermission("jadwalUjian", "manage");

  await db
    .update(sessionAssignments)
    .set({
      actualInstructorId: newInstructorId,
      substitutionReason: reason,
      availabilityStatus: "pending_wa_confirmation",
      availabilityCheckedAt: null,
      availabilityNote: null,
      updatedAt: new Date(),
    })
    .where(eq(sessionAssignments.id, assignmentId));

  revalidatePath("/jadwal-otomatis");
  return { ok: true as const };
}

const availabilityUpdateSchema = z.object({
  assignmentId: z.string().min(1),
  availabilityStatus: availabilityStatusSchema,
  availabilityNote: z.string().trim().max(300).optional().or(z.literal("")),
});

const bulkAvailabilityUpdateSchema = z.object({
  assignmentIds: z.array(z.string().min(1)).min(1, "Pilih minimal satu assignment").max(200),
  availabilityStatus: availabilityStatusSchema,
  availabilityNote: z.string().trim().max(300).optional().or(z.literal("")),
});

const bulkSessionStatusUpdateSchema = z.object({
  assignmentIds: z.array(z.string().min(1)).min(1, "Pilih minimal satu assignment").max(200),
  sessionStatus: z.enum(["scheduled", "completed"]),
});

async function splitDeletableAssignmentIds(assignmentIds: string[]) {
  if (assignmentIds.length === 0) {
    return { deletableIds: [] as string[], blockedIds: [] as string[] };
  }

  const linkedRows = await db
    .select({ assignmentId: honorariumItems.assignmentId })
    .from(honorariumItems)
    .where(inArray(honorariumItems.assignmentId, assignmentIds));

  const blockedIds = Array.from(new Set(linkedRows.map((row) => row.assignmentId)));
  const blockedSet = new Set(blockedIds);
  const deletableIds = assignmentIds.filter((id) => !blockedSet.has(id));

  return { deletableIds, blockedIds };
}

export async function updateAssignmentAvailabilityStatus(
  data: z.infer<typeof availabilityUpdateSchema>,
) {
  const parsed = availabilityUpdateSchema.parse(data);
  await requirePermission("jadwalUjian", "manage");

  await db
    .update(sessionAssignments)
    .set({
      availabilityStatus: parsed.availabilityStatus,
      availabilityNote: parsed.availabilityNote || null,
      availabilityCheckedAt:
        parsed.availabilityStatus === "pending_wa_confirmation" ? null : new Date(),
      updatedAt: new Date(),
    })
    .where(eq(sessionAssignments.id, parsed.assignmentId));

  revalidatePath("/jadwal-otomatis");
  return { ok: true as const };
}

export async function bulkUpdateAssignmentAvailabilityStatus(
  data: z.infer<typeof bulkAvailabilityUpdateSchema>,
) {
  const parsed = bulkAvailabilityUpdateSchema.parse(data);
  await requirePermission("jadwalUjian", "manage");

  const result = await db
    .update(sessionAssignments)
    .set({
      availabilityStatus: parsed.availabilityStatus,
      availabilityNote: parsed.availabilityNote || null,
      availabilityCheckedAt:
        parsed.availabilityStatus === "pending_wa_confirmation" ? null : new Date(),
      updatedAt: new Date(),
    })
    .where(inArray(sessionAssignments.id, parsed.assignmentIds));

  revalidatePath("/jadwal-otomatis");
  return { ok: true as const, updatedCount: result.rowCount ?? 0 };
}

export async function bulkUpdateSessionStatus(
  data: z.infer<typeof bulkSessionStatusUpdateSchema>,
) {
  const parsed = bulkSessionStatusUpdateSchema.parse(data);
  await requirePermission("jadwalUjian", "manage");

  const assignmentRows = await db
    .select({ sessionId: sessionAssignments.sessionId })
    .from(sessionAssignments)
    .where(inArray(sessionAssignments.id, parsed.assignmentIds));

  const sessionIds = Array.from(new Set(assignmentRows.map((row) => row.sessionId)));
  if (sessionIds.length === 0) {
    return { ok: true as const, updatedCount: 0 };
  }

  const result = await db
    .update(classSessions)
    .set({
      status: parsed.sessionStatus,
    })
    .where(inArray(classSessions.id, sessionIds));

  revalidatePath("/jadwal-otomatis");
  return { ok: true as const, updatedCount: result.rowCount ?? 0 };
}

// GET ASSIGNMENTS FOR KELAS

export async function getAssignmentsByKelas(kelasId: string) {
  await requirePermission("jadwalUjian", "view");

  return db
    .select({
      assignmentId: sessionAssignments.id,
      sessionId: sessionAssignments.sessionId,
      sessionNumber: classSessions.sessionNumber,
      scheduledDate: classSessions.scheduledDate,
      materiName: classSessions.materiName,
      isExamDay: classSessions.isExamDay,
      plannedInstructorId: sessionAssignments.plannedInstructorId,
      plannedInstructorName: instructors.name,
      actualInstructorId: sessionAssignments.actualInstructorId,
      substitutionReason: sessionAssignments.substitutionReason,
      availabilityStatus: sessionAssignments.availabilityStatus,
      availabilityCheckedAt: sessionAssignments.availabilityCheckedAt,
      availabilityNote: sessionAssignments.availabilityNote,
    })
    .from(sessionAssignments)
    .innerJoin(classSessions, eq(sessionAssignments.sessionId, classSessions.id))
    .innerJoin(instructors, eq(sessionAssignments.plannedInstructorId, instructors.id))
    .where(eq(classSessions.kelasId, kelasId))
    .orderBy(asc(classSessions.scheduledDate));
}

// GET ASSIGNMENTS FOR SESSION

export async function getAssignmentsBySession(sessionId: string) {
  await requirePermission("jadwalUjian", "view");

  return db
    .select()
    .from(sessionAssignments)
    .innerJoin(instructors, eq(sessionAssignments.plannedInstructorId, instructors.id))
    .where(eq(sessionAssignments.sessionId, sessionId));
}

const recommendationSchema = z.object({
  kelasId: z.string().min(1),
  programId: z.string().min(1),
  materiBlock: z.string().trim().min(1).max(100),
});

export type InstructorRecommendation = {
  instructorId: string;
  instructorName: string;
  expertiseLevel: ExpertiseLevel;
  score: number;
  weeklySessions: number;
  monthlySessions: number;
  activeClassCount: number;
  activeClassNames: string[];
  similarExperienceCount: number;
  availabilityStatus: "pending_wa_confirmation";
  reasons: string[];
};

export async function getInstructorRecommendationsForBlock(
  data: z.infer<typeof recommendationSchema>,
): Promise<InstructorRecommendation[]> {
  const parsed = recommendationSchema.parse(data);
  await requirePermission("jadwalUjian", "view");

  const activeInstructors = await db
    .select({
      id: instructors.id,
      name: instructors.name,
    })
    .from(instructors)
    .where(eq(instructors.isActive, true))
    .orderBy(asc(instructors.name));

  if (activeInstructors.length === 0) return [];

  const instructorIds = activeInstructors.map((instructor) => instructor.id);
  const todayStr = getTodayIsoInJakarta();
  const weekEndStr = addDaysToIsoDate(todayStr, 6);
  const monthEndStr = addDaysToIsoDate(todayStr, 29);

  const [expertiseRows, upcomingRows, similarHistoryRows] = await Promise.all([
    db
      .select({
        instructorId: instructorExpertise.instructorId,
        level: instructorExpertise.level,
      })
      .from(instructorExpertise)
      .where(
        and(
          inArray(instructorExpertise.instructorId, instructorIds),
          eq(instructorExpertise.programId, parsed.programId),
          eq(instructorExpertise.materiBlock, parsed.materiBlock),
        ),
      ),
    db
      .select({
        instructorId: sessionAssignments.plannedInstructorId,
        scheduledDate: classSessions.scheduledDate,
        kelasId: classSessions.kelasId,
        kelasName: kelasPelatihan.namaKelas,
      })
      .from(sessionAssignments)
      .innerJoin(classSessions, eq(sessionAssignments.sessionId, classSessions.id))
      .innerJoin(kelasPelatihan, eq(classSessions.kelasId, kelasPelatihan.id))
      .where(
        and(
          inArray(sessionAssignments.plannedInstructorId, instructorIds),
          gte(classSessions.scheduledDate, todayStr),
          eq(kelasPelatihan.status, "active"),
        ),
      ),
    db
      .select({
        instructorId: sessionAssignments.plannedInstructorId,
      })
      .from(sessionAssignments)
      .innerJoin(classSessions, eq(sessionAssignments.sessionId, classSessions.id))
      .innerJoin(kelasPelatihan, eq(classSessions.kelasId, kelasPelatihan.id))
      .where(
        and(
          inArray(sessionAssignments.plannedInstructorId, instructorIds),
          eq(kelasPelatihan.programId, parsed.programId),
          eq(classSessions.isExamDay, false),
          eq(classSessions.materiName, parsed.materiBlock),
        ),
      ),
  ]);

  const expertiseMap = new Map<string, ExpertiseLevel>();
  for (const row of expertiseRows) {
    const normalizedLevel = normalizeExpertiseLevel(row.level);
    if (normalizedLevel) expertiseMap.set(row.instructorId, normalizedLevel);
  }

  if (expertiseMap.size === 0) return [];

  const weeklySessionsMap = new Map<string, number>();
  const monthlySessionsMap = new Map<string, number>();
  const activeClassNamesMap = new Map<string, Set<string>>();

  for (const row of upcomingRows) {
    const classNames = activeClassNamesMap.get(row.instructorId) ?? new Set<string>();
    classNames.add(row.kelasName);
    activeClassNamesMap.set(row.instructorId, classNames);

    if (row.scheduledDate <= weekEndStr) {
      weeklySessionsMap.set(
        row.instructorId,
        (weeklySessionsMap.get(row.instructorId) ?? 0) + 1,
      );
    }
    if (row.scheduledDate <= monthEndStr) {
      monthlySessionsMap.set(
        row.instructorId,
        (monthlySessionsMap.get(row.instructorId) ?? 0) + 1,
      );
    }
  }

  const similarExperienceMap = new Map<string, number>();
  for (const row of similarHistoryRows) {
    similarExperienceMap.set(
      row.instructorId,
      (similarExperienceMap.get(row.instructorId) ?? 0) + 1,
    );
  }

  const maxSimilarExperience = Math.max(0, ...similarExperienceMap.values());
  const recommendations: InstructorRecommendation[] = [];

  for (const instructor of activeInstructors) {
    const expertiseLevel = expertiseMap.get(instructor.id);
    if (!expertiseLevel) continue;

    const weeklySessions = weeklySessionsMap.get(instructor.id) ?? 0;
    const monthlySessions = monthlySessionsMap.get(instructor.id) ?? 0;
    const activeClassNames = Array.from(activeClassNamesMap.get(instructor.id) ?? []).sort(
      (a, b) => a.localeCompare(b),
    );
    const similarExperienceCount = similarExperienceMap.get(instructor.id) ?? 0;

    const expertiseScore = 50 * expertiseLevelWeight[expertiseLevel];
    const workloadScore = 25 * (1 - Math.min(weeklySessions, 8) / 8);
    const historyScore =
      maxSimilarExperience > 0 ? (similarExperienceCount / maxSimilarExperience) * 15 : 7.5;
    const rotationScore = 10 * (1 - Math.min(monthlySessions, 16) / 16);

    recommendations.push({
      instructorId: instructor.id,
      instructorName: instructor.name,
      expertiseLevel,
      score: Number((expertiseScore + workloadScore + historyScore + rotationScore).toFixed(1)),
      weeklySessions,
      monthlySessions,
      activeClassCount: activeClassNames.length,
      activeClassNames,
      similarExperienceCount,
      availabilityStatus: "pending_wa_confirmation",
      reasons: [
        `Keahlian ${expertiseLevelLabel(expertiseLevel)}`,
        `Beban 7 hari: ${weeklySessions} sesi`,
        `Beban 30 hari: ${monthlySessions} sesi`,
        `Histori materi sejenis: ${similarExperienceCount} sesi`,
      ],
    });
  }

  return recommendations.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.weeklySessions !== b.weeklySessions) return a.weeklySessions - b.weeklySessions;
    return a.instructorName.localeCompare(b.instructorName);
  });
}

export type InstructorAllocationSummary = {
  weeklySessions: number;
  monthlySessions: number;
  totalUpcomingSessions: number;
  pendingWaConfirmation: number;
  activeClasses: Array<{
    kelasId: string;
    namaKelas: string;
    programName: string;
    nextSessionDate: string;
    sessionCount: number;
  }>;
};

export async function getInstructorAllocationSummary(
  instructorId: string,
): Promise<InstructorAllocationSummary> {
  await requirePermission("jadwalUjian", "view");

  const todayStr = getTodayIsoInJakarta();
  const weekEndStr = addDaysToIsoDate(todayStr, 6);
  const monthEndStr = addDaysToIsoDate(todayStr, 29);

  const rows = await db
    .select({
      kelasId: classSessions.kelasId,
      namaKelas: kelasPelatihan.namaKelas,
      programName: programs.name,
      scheduledDate: classSessions.scheduledDate,
      availabilityStatus: sessionAssignments.availabilityStatus,
    })
    .from(sessionAssignments)
    .innerJoin(classSessions, eq(sessionAssignments.sessionId, classSessions.id))
    .innerJoin(kelasPelatihan, eq(classSessions.kelasId, kelasPelatihan.id))
    .innerJoin(programs, eq(kelasPelatihan.programId, programs.id))
    .where(
      and(
        eq(sessionAssignments.plannedInstructorId, instructorId),
        gte(classSessions.scheduledDate, todayStr),
        eq(kelasPelatihan.status, "active"),
      ),
    )
    .orderBy(asc(classSessions.scheduledDate));

  const classes = new Map<
    string,
    {
      kelasId: string;
      namaKelas: string;
      programName: string;
      nextSessionDate: string;
      sessionCount: number;
    }
  >();

  let weeklySessions = 0;
  let monthlySessions = 0;
  let pendingWaConfirmation = 0;

  for (const row of rows) {
    if (row.scheduledDate <= weekEndStr) weeklySessions += 1;
    if (row.scheduledDate <= monthEndStr) monthlySessions += 1;
    if (row.availabilityStatus === "pending_wa_confirmation") pendingWaConfirmation += 1;

    const existing = classes.get(row.kelasId);
    if (existing) {
      existing.sessionCount += 1;
      if (row.scheduledDate < existing.nextSessionDate) {
        existing.nextSessionDate = row.scheduledDate;
      }
      continue;
    }

    classes.set(row.kelasId, {
      kelasId: row.kelasId,
      namaKelas: row.namaKelas,
      programName: row.programName,
      nextSessionDate: row.scheduledDate,
      sessionCount: 1,
    });
  }

  return {
    weeklySessions,
    monthlySessions,
    totalUpcomingSessions: rows.length,
    pendingWaConfirmation,
    activeClasses: Array.from(classes.values()).sort((a, b) =>
      a.nextSessionDate.localeCompare(b.nextSessionDate),
    ),
  };
}

// HISTORI MENGAJAR

export async function getTeachingHistory(instructorId: string) {
  await requirePermission("jadwalUjian", "view");

  return db
    .select({
      assignmentId: sessionAssignments.id,
      sessionId: sessionAssignments.sessionId,
      kelasId: kelasPelatihan.id,
      namaKelas: kelasPelatihan.namaKelas,
      programName: programs.name,
      scheduledDate: classSessions.scheduledDate,
      materiName: classSessions.materiName,
      sessionNumber: classSessions.sessionNumber,
      sessionStatus: classSessions.status,
      isExamDay: classSessions.isExamDay,
      availabilityStatus: sessionAssignments.availabilityStatus,
      isSubstitute: sql<boolean>`${sessionAssignments.actualInstructorId} is not null`,
      substitutionReason: sessionAssignments.substitutionReason,
    })
    .from(sessionAssignments)
    .innerJoin(classSessions, eq(sessionAssignments.sessionId, classSessions.id))
    .innerJoin(kelasPelatihan, eq(classSessions.kelasId, kelasPelatihan.id))
    .innerJoin(programs, eq(kelasPelatihan.programId, programs.id))
    .where(
      or(
        eq(sessionAssignments.plannedInstructorId, instructorId),
        eq(sessionAssignments.actualInstructorId, instructorId),
      ),
    )
    .orderBy(desc(classSessions.scheduledDate));
}

// CONFLICT DETECTION

export async function checkInstructorConflict(instructorId: string, tanggal: string) {
  await requirePermission("jadwalUjian", "view");

  const conflictingAssignments = await db
    .select({
      kelasId: kelasPelatihan.id,
      namaKelas: kelasPelatihan.namaKelas,
      sessionNumber: classSessions.sessionNumber,
      scheduledDate: classSessions.scheduledDate,
      timeSlotStart: classSessions.timeSlotStart,
      timeSlotEnd: classSessions.timeSlotEnd,
    })
    .from(sessionAssignments)
    .innerJoin(classSessions, eq(sessionAssignments.sessionId, classSessions.id))
    .innerJoin(kelasPelatihan, eq(classSessions.kelasId, kelasPelatihan.id))
    .where(
      and(
        eq(sessionAssignments.plannedInstructorId, instructorId),
        eq(classSessions.scheduledDate, tanggal),
      ),
    );

  return conflictingAssignments;
}

// UNASSIGN SINGLE

export async function unassignInstructorFromSession(assignmentId: string) {
  await requirePermission("jadwalUjian", "manage");

  const { deletableIds, blockedIds } = await splitDeletableAssignmentIds([assignmentId]);
  if (blockedIds.length > 0) {
    return {
      ok: false as const,
      blockedByHonorarium: true as const,
      error:
        "Penugasan tidak bisa dihapus karena sudah masuk perhitungan honorarium.",
    };
  }

  if (deletableIds.length > 0) {
    await db.delete(sessionAssignments).where(eq(sessionAssignments.id, assignmentId));
  }

  revalidatePath("/jadwal-otomatis");
  return { ok: true as const, deletedCount: deletableIds.length };
}

// UNASSIGN BLOCK

export async function unassignInstructorFromBlock(kelasId: string, materiBlock: string) {
  await requirePermission("jadwalUjian", "manage");

  const sessions = await db
    .select({ id: classSessions.id })
    .from(classSessions)
    .where(
      and(
        eq(classSessions.kelasId, kelasId),
        eq(classSessions.materiName, materiBlock),
        eq(classSessions.isExamDay, false),
      ),
    );

  if (sessions.length === 0) return { ok: true as const, deletedCount: 0 };

  const sessionIds = sessions.map((s) => s.id);
  const assignmentRows = await db
    .select({ id: sessionAssignments.id })
    .from(sessionAssignments)
    .where(inArray(sessionAssignments.sessionId, sessionIds));

  const assignmentIds = assignmentRows.map((row) => row.id);
  const { deletableIds, blockedIds } = await splitDeletableAssignmentIds(assignmentIds);

  let deletedCount = 0;
  if (deletableIds.length > 0) {
    const result = await db
      .delete(sessionAssignments)
      .where(inArray(sessionAssignments.id, deletableIds));
    deletedCount = result.rowCount ?? 0;
  }

  revalidatePath("/jadwal-otomatis");
  return {
    ok: true as const,
    deletedCount,
    blockedCount: blockedIds.length,
  };
}

// BULK UNASSIGN

export async function bulkUnassignInstructors(data: z.infer<typeof bulkUnassignSchema>) {
  const parsed = bulkUnassignSchema.parse(data);
  await requirePermission("jadwalUjian", "manage");

  const { deletableIds, blockedIds } = await splitDeletableAssignmentIds(
    parsed.assignmentIds,
  );

  let deletedCount = 0;
  if (deletableIds.length > 0) {
    const result = await db
      .delete(sessionAssignments)
      .where(inArray(sessionAssignments.id, deletableIds));
    deletedCount = result.rowCount ?? 0;
  }

  revalidatePath("/jadwal-otomatis");
  return {
    ok: true as const,
    deletedCount,
    blockedCount: blockedIds.length,
    blockedByHonorarium: blockedIds.length > 0,
  };
}
