"use server";

import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { requirePermission } from "@/server/actions/auth";
import { db } from "@/server/db";
import {
  classSessions,
  honorariumItems,
  honorariumBatches,
  honorariumRateRules,
  instructorExpertise,
  instructorRates,
  instructors,
  kelasPelatihan,
  programs,
  sessionAssignments,
} from "@/server/db/schema";
import {
  type ExpertiseLevel,
  type SessionHonorariumStatusValue,
  defaultDateRange,
  mapBatchStatusToSessionStatus,
  normalizeExpertiseLevel,
  normalizeMode,
  pickRateRule,
  reportFilterSchema,
  statusPriority,
  toNumber,
} from "./honorarium-utils";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type HonorariumReportRow = {
  assignmentId: string;
  sessionId: string;
  kelasId: string;
  scheduledDate: string;
  namaKelas: string;
  programId: string;
  programName: string;
  materiBlock: string;
  sessionStatus: string;
  paidInstructorId: string;
  paidInstructorName: string;
  source: "planned" | "actual";
  availabilityStatus:
    | "pending_wa_confirmation"
    | "accepted"
    | "rejected"
    | "no_response";
  kelasMode: "online" | "offline";
  expertiseLevel: ExpertiseLevel;
  rateSource: "override_instructor" | "matrix_standard" | "missing";
  honorAmount: number;
  transportAmount: number;
  rateAmount: number;
  totalAmount: number;
};

export type HonorariumSummaryRow = {
  key: string;
  label: string;
  sessionCount: number;
  totalAmount: number;
};

export type OutstandingHonorariumSession = {
  assignmentId: string;
  sessionId: string;
  kelasId: string;
  scheduledDate: string;
  namaKelas: string;
  programId: string;
  programName: string;
  materiBlock: string;
  paidInstructorId: string;
  paidInstructorName: string;
  source: "planned" | "actual";
  kelasMode: "online" | "offline";
  expertiseLevel: ExpertiseLevel;
  rateSource: "override_instructor" | "matrix_standard" | "missing";
  honorAmount: number;
  transportAmount: number;
  totalAmount: number;
};

export type OutstandingHonorariumResult = {
  sessions: OutstandingHonorariumSession[];
  totals: {
    sessionCount: number;
    instructorCount: number;
    totalAmount: number;
    missingRateCount: number;
  };
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

export function getEligibleRows(rows: HonorariumReportRow[]) {
  return rows.filter(
    (row) =>
      row.sessionStatus === "completed" &&
      row.availabilityStatus === "accepted",
  );
}

// ─── REPORT ───────────────────────────────────────────────────────────────────

export async function getHonorariumReport(
  filters?: { startDate?: string; endDate?: string; instructorId?: string; programId?: string },
) {
  await requirePermission("jadwalPelatihan", "view");

  const parsed = reportFilterSchema.parse(filters ?? {});
  const defaults = defaultDateRange();

  const startDate = parsed.startDate ?? defaults.startDate;
  const endDate = parsed.endDate ?? defaults.endDate;

  const assignmentRows = await db
    .select({
      assignmentId: sessionAssignments.id,
      sessionId: sessionAssignments.sessionId,
      kelasId: classSessions.kelasId,
      plannedInstructorId: sessionAssignments.plannedInstructorId,
      actualInstructorId: sessionAssignments.actualInstructorId,
      scheduledDate: classSessions.scheduledDate,
      materiBlock: classSessions.materiName,
      sessionStatus: classSessions.status,
      namaKelas: kelasPelatihan.namaKelas,
      kelasMode: kelasPelatihan.mode,
      lokasi: kelasPelatihan.lokasi,
      programId: programs.id,
      programName: programs.name,
      availabilityStatus: sessionAssignments.availabilityStatus,
    })
    .from(sessionAssignments)
    .innerJoin(
      classSessions,
      eq(sessionAssignments.sessionId, classSessions.id),
    )
    .innerJoin(kelasPelatihan, eq(classSessions.kelasId, kelasPelatihan.id))
    .innerJoin(programs, eq(kelasPelatihan.programId, programs.id))
    .where(
      and(
        eq(classSessions.isExamDay, false),
        gte(classSessions.scheduledDate, startDate),
        lte(classSessions.scheduledDate, endDate),
      ),
    )
    .orderBy(asc(classSessions.scheduledDate), asc(kelasPelatihan.namaKelas));

  const filteredAssignments = assignmentRows.filter((row) => {
    if (!row.materiBlock) return false;
    if (row.sessionStatus === "cancelled") return false;

    const paidInstructorId = row.actualInstructorId ?? row.plannedInstructorId;
    if (parsed.instructorId && paidInstructorId !== parsed.instructorId)
      return false;
    if (parsed.programId && row.programId !== parsed.programId) return false;
    return true;
  });

  if (filteredAssignments.length === 0) {
    return {
      appliedFilters: {
        startDate,
        endDate,
        instructorId: parsed.instructorId ?? "",
        programId: parsed.programId ?? "",
      },
      rows: [] as HonorariumReportRow[],
      summaryByInstructor: [] as HonorariumSummaryRow[],
      summaryByProgram: [] as HonorariumSummaryRow[],
      totals: { sessionCount: 0, totalAmount: 0 },
    };
  }

  const instructorIds = Array.from(
    new Set(
      filteredAssignments.flatMap((row) =>
        row.actualInstructorId
          ? [row.plannedInstructorId, row.actualInstructorId]
          : [row.plannedInstructorId],
      ),
    ),
  );

  const programIds = Array.from(
    new Set(filteredAssignments.map((row) => row.programId)),
  );

  const [instructorRows, rateRows, expertiseRows, standardRateRows] =
    await Promise.all([
      db
        .select({ id: instructors.id, name: instructors.name })
        .from(instructors)
        .where(inArray(instructors.id, instructorIds)),
      db
        .select({
          instructorId: instructorRates.instructorId,
          programId: instructorRates.programId,
          materiBlock: instructorRates.materiBlock,
          mode: instructorRates.mode,
          rateAmount: instructorRates.rateAmount,
        })
        .from(instructorRates)
        .where(
          and(
            inArray(instructorRates.instructorId, instructorIds),
            inArray(instructorRates.programId, programIds),
          ),
        ),
      db
        .select({
          instructorId: instructorExpertise.instructorId,
          programId: instructorExpertise.programId,
          materiBlock: instructorExpertise.materiBlock,
          level: instructorExpertise.level,
        })
        .from(instructorExpertise)
        .where(
          and(
            inArray(instructorExpertise.instructorId, instructorIds),
            inArray(instructorExpertise.programId, programIds),
          ),
        ),
      db
        .select({
          programId: honorariumRateRules.programId,
          level: honorariumRateRules.level,
          mode: honorariumRateRules.mode,
          honorPerSession: honorariumRateRules.honorPerSession,
          transportAmount: honorariumRateRules.transportAmount,
          effectiveFrom: honorariumRateRules.effectiveFrom,
          effectiveTo: honorariumRateRules.effectiveTo,
          locationScope: honorariumRateRules.locationScope,
        })
        .from(honorariumRateRules)
        .where(
          and(
            inArray(honorariumRateRules.programId, programIds),
            eq(honorariumRateRules.isActive, true),
          ),
        ),
    ]);

  const instructorNameById = new Map(
    instructorRows.map((row) => [row.id, row.name]),
  );
  const rateByKey = new Map(
    rateRows.map((row) => [
      `${row.instructorId}::${row.programId}::${row.materiBlock}::${normalizeMode(row.mode)}`,
      toNumber(row.rateAmount),
    ]),
  );

  const expertiseByKey = new Map<string, ExpertiseLevel>();
  for (const row of expertiseRows) {
    expertiseByKey.set(
      `${row.instructorId}::${row.programId}::${row.materiBlock}`,
      normalizeExpertiseLevel(row.level),
    );
  }

  const rows: HonorariumReportRow[] = filteredAssignments.map((row) => {
    const paidInstructorId = row.actualInstructorId ?? row.plannedInstructorId;
    const source: "planned" | "actual" = row.actualInstructorId
      ? "actual"
      : "planned";
    const materiBlock = row.materiBlock ?? "";
    const kelasMode = normalizeMode(row.kelasMode);
    const expertiseLevel =
      expertiseByKey.get(
        `${paidInstructorId}::${row.programId}::${materiBlock}`,
      ) ?? "middle";

    const overrideRate = rateByKey.get(
      `${paidInstructorId}::${row.programId}::${materiBlock}::${kelasMode}`,
    );

    let honorAmount = 0;
    let transportAmount = 0;
    let rateSource: HonorariumReportRow["rateSource"] = "missing";

    if (overrideRate !== undefined) {
      honorAmount = overrideRate;
      transportAmount = 0;
      rateSource = "override_instructor";
    } else {
      const matchedRule = pickRateRule(standardRateRows, {
        programId: row.programId,
        level: expertiseLevel,
        mode: kelasMode,
        scheduledDate: row.scheduledDate,
        lokasi: row.lokasi,
      });

      if (matchedRule) {
        honorAmount = toNumber(matchedRule.honorPerSession);
        transportAmount = toNumber(matchedRule.transportAmount);
        rateSource = "matrix_standard";
      }
    }

    const rateAmount = honorAmount + transportAmount;

    return {
      assignmentId: row.assignmentId,
      sessionId: row.sessionId,
      kelasId: row.kelasId,
      scheduledDate: row.scheduledDate,
      namaKelas: row.namaKelas,
      programId: row.programId,
      programName: row.programName,
      materiBlock,
      sessionStatus: row.sessionStatus,
      paidInstructorId,
      paidInstructorName:
        instructorNameById.get(paidInstructorId) ??
        "Instruktur tidak ditemukan",
      source,
      kelasMode,
      expertiseLevel,
      rateSource,
      honorAmount,
      transportAmount,
      availabilityStatus:
        row.availabilityStatus === "accepted" ||
        row.availabilityStatus === "rejected" ||
        row.availabilityStatus === "no_response"
          ? row.availabilityStatus
          : "pending_wa_confirmation",
      rateAmount,
      totalAmount: rateAmount,
    };
  });

  const byInstructor = new Map<string, HonorariumSummaryRow>();
  const byProgram = new Map<string, HonorariumSummaryRow>();

  for (const row of rows) {
    const instKey = row.paidInstructorId;
    const progKey = row.programId;

    if (!byInstructor.has(instKey)) {
      byInstructor.set(instKey, {
        key: instKey,
        label: row.paidInstructorName,
        sessionCount: 0,
        totalAmount: 0,
      });
    }
    if (!byProgram.has(progKey)) {
      byProgram.set(progKey, {
        key: progKey,
        label: row.programName,
        sessionCount: 0,
        totalAmount: 0,
      });
    }

    const inst = byInstructor.get(instKey);
    if (inst) {
      inst.sessionCount += 1;
      inst.totalAmount += row.totalAmount;
    }

    const prog = byProgram.get(progKey);
    if (prog) {
      prog.sessionCount += 1;
      prog.totalAmount += row.totalAmount;
    }
  }

  const sessionCount = rows.length;
  const totalAmount = rows.reduce((sum, row) => sum + row.totalAmount, 0);

  return {
    appliedFilters: {
      startDate,
      endDate,
      instructorId: parsed.instructorId ?? "",
      programId: parsed.programId ?? "",
    },
    rows,
    summaryByInstructor: Array.from(byInstructor.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    ),
    summaryByProgram: Array.from(byProgram.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    ),
    totals: {
      sessionCount,
      totalAmount,
    },
  };
}

// ─── OUTSTANDING HONORARIUM ─────────────────────────────────────────────────

export async function getOutstandingHonorariumSessions(): Promise<OutstandingHonorariumResult> {
  await requirePermission("jadwalPelatihan", "view");

  const assignmentRows = await db
    .select({
      assignmentId: sessionAssignments.id,
      sessionId: sessionAssignments.sessionId,
      kelasId: classSessions.kelasId,
      plannedInstructorId: sessionAssignments.plannedInstructorId,
      actualInstructorId: sessionAssignments.actualInstructorId,
      scheduledDate: classSessions.scheduledDate,
      materiBlock: classSessions.materiName,
      namaKelas: kelasPelatihan.namaKelas,
      kelasMode: kelasPelatihan.mode,
      lokasi: kelasPelatihan.lokasi,
      programId: programs.id,
      programName: programs.name,
    })
    .from(sessionAssignments)
    .innerJoin(classSessions, eq(sessionAssignments.sessionId, classSessions.id))
    .innerJoin(kelasPelatihan, eq(classSessions.kelasId, kelasPelatihan.id))
    .innerJoin(programs, eq(kelasPelatihan.programId, programs.id))
    .where(
      and(
        eq(classSessions.isExamDay, false),
        eq(classSessions.status, "completed"),
        eq(sessionAssignments.availabilityStatus, "accepted"),
      ),
    )
    .orderBy(asc(classSessions.scheduledDate), asc(kelasPelatihan.namaKelas));

  const withMateri = assignmentRows.filter((row) => !!row.materiBlock);

  if (withMateri.length === 0) {
    return {
      sessions: [],
      totals: { sessionCount: 0, instructorCount: 0, totalAmount: 0, missingRateCount: 0 },
    };
  }

  const allAssignmentIds = withMateri.map((row) => row.assignmentId);
  const existingItems = await db
    .select({ assignmentId: honorariumItems.assignmentId })
    .from(honorariumItems)
    .where(inArray(honorariumItems.assignmentId, allAssignmentIds));

  const existingSet = new Set(existingItems.map((item) => item.assignmentId));
  const outstandingRows = withMateri.filter((row) => !existingSet.has(row.assignmentId));

  if (outstandingRows.length === 0) {
    return {
      sessions: [],
      totals: { sessionCount: 0, instructorCount: 0, totalAmount: 0, missingRateCount: 0 },
    };
  }

  const instructorIds = Array.from(
    new Set(
      outstandingRows.flatMap((row) =>
        row.actualInstructorId
          ? [row.plannedInstructorId, row.actualInstructorId]
          : [row.plannedInstructorId],
      ),
    ),
  );

  const programIds = Array.from(new Set(outstandingRows.map((row) => row.programId)));

  const [instructorRowsData, rateRows, expertiseRows, standardRateRows] = await Promise.all([
    db.select({ id: instructors.id, name: instructors.name }).from(instructors).where(inArray(instructors.id, instructorIds)),
    db.select({
      instructorId: instructorRates.instructorId,
      programId: instructorRates.programId,
      materiBlock: instructorRates.materiBlock,
      mode: instructorRates.mode,
      rateAmount: instructorRates.rateAmount,
    }).from(instructorRates).where(and(inArray(instructorRates.instructorId, instructorIds), inArray(instructorRates.programId, programIds))),
    db.select({
      instructorId: instructorExpertise.instructorId,
      programId: instructorExpertise.programId,
      materiBlock: instructorExpertise.materiBlock,
      level: instructorExpertise.level,
    }).from(instructorExpertise).where(and(inArray(instructorExpertise.instructorId, instructorIds), inArray(instructorExpertise.programId, programIds))),
    db.select({
      programId: honorariumRateRules.programId,
      level: honorariumRateRules.level,
      mode: honorariumRateRules.mode,
      honorPerSession: honorariumRateRules.honorPerSession,
      transportAmount: honorariumRateRules.transportAmount,
      effectiveFrom: honorariumRateRules.effectiveFrom,
      effectiveTo: honorariumRateRules.effectiveTo,
      locationScope: honorariumRateRules.locationScope,
    }).from(honorariumRateRules).where(and(inArray(honorariumRateRules.programId, programIds), eq(honorariumRateRules.isActive, true))),
  ]);

  const instructorNameById = new Map(instructorRowsData.map((row) => [row.id, row.name]));
  const rateByKey = new Map(
    rateRows.map((row) => [
      `${row.instructorId}::${row.programId}::${row.materiBlock}::${normalizeMode(row.mode)}`,
      toNumber(row.rateAmount),
    ]),
  );
  const expertiseByKey = new Map<string, ExpertiseLevel>();
  for (const row of expertiseRows) {
    expertiseByKey.set(`${row.instructorId}::${row.programId}::${row.materiBlock}`, normalizeExpertiseLevel(row.level));
  }

  const sessions: OutstandingHonorariumSession[] = outstandingRows.map((row) => {
    const paidInstructorId = row.actualInstructorId ?? row.plannedInstructorId;
    const source: "planned" | "actual" = row.actualInstructorId ? "actual" : "planned";
    const materiBlock = row.materiBlock ?? "";
    const kelasMode = normalizeMode(row.kelasMode);
    const expertiseLevel = expertiseByKey.get(`${paidInstructorId}::${row.programId}::${materiBlock}`) ?? "middle";

    const overrideRate = rateByKey.get(`${paidInstructorId}::${row.programId}::${materiBlock}::${kelasMode}`);

    let honorAmount = 0;
    let transportAmount = 0;
    let rateSource: OutstandingHonorariumSession["rateSource"] = "missing";

    if (overrideRate !== undefined) {
      honorAmount = overrideRate;
      transportAmount = 0;
      rateSource = "override_instructor";
    } else {
      const matchedRule = pickRateRule(standardRateRows, {
        programId: row.programId,
        level: expertiseLevel,
        mode: kelasMode,
        scheduledDate: row.scheduledDate,
        lokasi: row.lokasi,
      });
      if (matchedRule) {
        honorAmount = toNumber(matchedRule.honorPerSession);
        transportAmount = toNumber(matchedRule.transportAmount);
        rateSource = "matrix_standard";
      }
    }

    return {
      assignmentId: row.assignmentId,
      sessionId: row.sessionId,
      kelasId: row.kelasId,
      scheduledDate: row.scheduledDate,
      namaKelas: row.namaKelas,
      programId: row.programId,
      programName: row.programName,
      materiBlock,
      paidInstructorId,
      paidInstructorName: instructorNameById.get(paidInstructorId) ?? "Instruktur tidak ditemukan",
      source,
      kelasMode,
      expertiseLevel,
      rateSource,
      honorAmount,
      transportAmount,
      totalAmount: honorAmount + transportAmount,
    };
  });

  const instructorSet = new Set(sessions.map((s) => s.paidInstructorId));
  const missingRateCount = sessions.filter((s) => s.rateSource === "missing").length;

  return {
    sessions,
    totals: {
      sessionCount: sessions.length,
      instructorCount: instructorSet.size,
      totalAmount: sessions.reduce((sum, s) => sum + s.totalAmount, 0),
      missingRateCount,
    },
  };
}

// ─── SESSION HONORARIUM STATUS ──────────────────────────────────────────────

export async function getSessionHonorariumStatuses(
  sessionIds: string[],
): Promise<Record<string, SessionHonorariumStatusValue>> {
  await requirePermission("jadwalPelatihan", "view");

  if (sessionIds.length === 0) return {};

  const rows = await db
    .select({
      sessionId: honorariumItems.sessionId,
      batchStatus: honorariumBatches.status,
    })
    .from(honorariumItems)
    .innerJoin(honorariumBatches, eq(honorariumItems.batchId, honorariumBatches.id))
    .where(inArray(honorariumItems.sessionId, sessionIds));

  const result: Record<string, SessionHonorariumStatusValue> = {};

  for (const row of rows) {
    const current = result[row.sessionId];
    const mapped = mapBatchStatusToSessionStatus(row.batchStatus);

    if (!current || statusPriority(mapped) > statusPriority(current)) {
      result[row.sessionId] = mapped;
    }
  }

  return result;
}
