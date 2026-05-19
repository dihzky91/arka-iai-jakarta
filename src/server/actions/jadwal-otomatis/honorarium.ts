"use server";

import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { revalidateDashboardTag } from "@/server/actions/statistics";
import { DASHBOARD_TAGS } from "@/lib/dashboard-cache-tags";
import { z } from "zod";
import { getStorageProvider } from "@/lib/storage";
import { prepareUploadPayload } from "@/lib/storage/utils";
import { enforceUploadRateLimit } from "@/lib/rate-limit/upload-guard";
import {
  requireCapability,
  requirePermission,
  requireSession,
} from "@/server/actions/auth";
import { db } from "@/server/db";
import { getTodayIsoInJakarta, APP_TIME_ZONE } from "@/lib/utils";
import {
  classSessions,
  honorariumAuditLogs,
  honorariumBatches,
  honorariumDeductions,
  honorariumItems,
  honorariumPaymentProofs,
  honorariumRateRules,
  instructorExpertise,
  instructorRates,
  instructors,
  kelasPelatihan,
  programs,
  sessionAssignments,
  users,
} from "@/server/db/schema";
import { createNotification } from "@/server/actions/notifications";
import { checkNotificationPreference } from "@/server/actions/notificationPreferences";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const upsertRateSchema = z.object({
  instructorId: z.string().min(1),
  programId: z.string().min(1),
  materiBlock: z.string().trim().min(1).max(100),
  mode: z.enum(["online", "offline"]),
  rateAmount: z.number().finite().min(0),
});

const upsertRateRuleSchema = z.object({
  id: z.string().optional(),
  programId: z.string().min(1),
  level: z.enum(["basic", "middle", "senior"]),
  mode: z.enum(["online", "offline"]),
  honorPerSession: z.number().finite().min(0),
  transportAmount: z.number().finite().min(0),
  effectiveFrom: dateSchema,
  effectiveTo: dateSchema.optional().or(z.literal("")),
  locationScope: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

const reportFilterSchema = z.object({
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  instructorId: z.string().optional(),
  programId: z.string().optional(),
});

const generateBatchSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
  internalNotes: z.string().trim().max(500).optional().or(z.literal("")),
});

const listBatchFilterSchema = z.object({
  startDate: dateSchema.optional().or(z.literal("")),
  endDate: dateSchema.optional().or(z.literal("")),
  status: z
    .enum([
      "draft",
      "dikirim_ke_keuangan",
      "diproses_keuangan",
      "dibayar",
      "locked",
    ])
    .optional()
    .or(z.literal("")),
  financeOnly: z.boolean().optional(),
});

const listBatchPageSchema = listBatchFilterSchema.extend({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(100).default(10),
  sortBy: z
    .enum([
      "documentNumber",
      "periodStart",
      "itemCount",
      "netAmount",
      "status",
      "submittedAt",
      "waitingDays",
      "createdAt",
    ])
    .default("submittedAt"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

const batchIdSchema = z.object({
  batchId: z.string().min(1),
});

const batchIdsSchema = z.object({
  batchIds: z.array(z.string().min(1)).min(1),
});

const markBatchPaidSchema = z.object({
  batchId: z.string().min(1),
  paidDate: dateSchema.optional(),
  paymentReference: z
    .string()
    .trim()
    .min(1, "Referensi transfer wajib diisi.")
    .max(200),
  paymentAmount: z
    .number()
    .finite()
    .positive("Nominal pembayaran harus lebih dari 0."),
});

const correctBatchPaymentSchema = markBatchPaidSchema.extend({
  reason: z.string().trim().min(1, "Alasan koreksi wajib diisi.").max(500),
});

const addDeductionSchema = z.object({
  batchId: z.string().min(1),
  instructorId: z.string().min(1),
  deductionType: z.enum(["pph21", "pph23", "other"]),
  description: z.string().trim().min(1).max(200),
  amount: z.number().finite().min(0),
});

const removeDeductionSchema = z.object({
  deductionId: z.string().min(1),
});

const reopenBatchSchema = z.object({
  batchId: z.string().min(1),
  reason: z.string().trim().min(1, "Alasan reopen wajib diisi.").max(500),
});

const exportPdfAuditSchema = z.object({
  batchId: z.string().min(1),
  fileName: z.string().trim().min(1).max(220),
});

const uploadPaymentProofSchema = z.object({
  batchId: z.string().min(1),
  fileName: z.string().trim().min(1).max(500),
  contentType: z.string().trim().min(1).max(255),
  dataUrl: z.string().trim().min(1),
});

const financeRecapFilterSchema = z.object({
  startDate: dateSchema.optional().or(z.literal("")),
  endDate: dateSchema.optional().or(z.literal("")),
  instructorId: z.string().optional().or(z.literal("")),
  status: z
    .enum([
      "dikirim_ke_keuangan",
      "diproses_keuangan",
      "dibayar",
      "locked",
      "all",
    ])
    .optional()
    .or(z.literal("")),
});

type HonorariumBatchStatus =
  | "draft"
  | "dikirim_ke_keuangan"
  | "diproses_keuangan"
  | "dibayar"
  | "locked";

type ExpertiseLevel = "basic" | "middle" | "senior";
type RoleValue = "admin" | "staff" | "pejabat" | "viewer";

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatCurrency(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

function batchStatusLabel(status: HonorariumBatchStatus) {
  if (status === "draft") return "Draft";
  if (status === "dikirim_ke_keuangan") return "Dikirim ke Keuangan";
  if (status === "diproses_keuangan") return "Diproses Keuangan";
  if (status === "dibayar") return "Dibayar";
  if (status === "locked") return "Locked";
  return status;
}

function batchStatusLabelLoose(status: string) {
  if (
    status === "draft" ||
    status === "dikirim_ke_keuangan" ||
    status === "diproses_keuangan" ||
    status === "dibayar" ||
    status === "locked"
  ) {
    return batchStatusLabel(status);
  }
  return status;
}

function defaultDateRange() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const partMap = new Map(parts.map((part) => [part.type, part.value]));
  const year = partMap.get("year") ?? String(now.getFullYear());
  const month =
    partMap.get("month") ?? String(now.getMonth() + 1).padStart(2, "0");
  const day = partMap.get("day") ?? String(now.getDate()).padStart(2, "0");

  return {
    startDate: `${year}-${month}-01`,
    endDate: `${year}-${month}-${day}`,
  };
}

function normalizeMode(mode: string | null): "online" | "offline" {
  return mode === "online" ? "online" : "offline";
}

type RateRuleCandidate = {
  programId: string;
  level: string;
  mode: string;
  honorPerSession: unknown;
  transportAmount: unknown;
  effectiveFrom: string;
  effectiveTo: string | null;
  locationScope: string;
};

function isDateWithinRange(
  dateValue: string,
  start: string,
  end: string | null,
) {
  if (dateValue < start) return false;
  if (end && dateValue > end) return false;
  return true;
}

function matchLocationScope(location: string | null, scope: string) {
  const normalizedScope = scope.trim().toLowerCase();
  if (!normalizedScope) return true;
  if (!location) return false;
  return location.toLowerCase().includes(normalizedScope);
}

function pickRateRule(
  rules: RateRuleCandidate[],
  params: {
    programId: string;
    level: ExpertiseLevel;
    mode: "online" | "offline";
    scheduledDate: string;
    lokasi: string | null;
  },
) {
  const filtered = rules.filter((rule) => {
    if (rule.programId !== params.programId) return false;
    if (normalizeExpertiseLevel(rule.level) !== params.level) return false;
    if (rule.mode !== params.mode) return false;
    if (
      !isDateWithinRange(
        params.scheduledDate,
        rule.effectiveFrom,
        rule.effectiveTo,
      )
    )
      return false;
    return matchLocationScope(params.lokasi, rule.locationScope);
  });

  if (filtered.length === 0) return null;

  const sorted = filtered.sort((a, b) => {
    const aHasScope = a.locationScope.trim().length > 0 ? 1 : 0;
    const bHasScope = b.locationScope.trim().length > 0 ? 1 : 0;
    if (aHasScope !== bHasScope) return bHasScope - aHasScope;
    return b.effectiveFrom.localeCompare(a.effectiveFrom);
  });

  return sorted[0] ?? null;
}

export async function listInstructorRates(instructorId: string) {
  await requirePermission("jadwalPelatihan", "view");

  if (!instructorId) return [];

  return db
    .select({
      id: instructorRates.id,
      instructorId: instructorRates.instructorId,
      programId: instructorRates.programId,
      programName: programs.name,
      materiBlock: instructorRates.materiBlock,
      mode: instructorRates.mode,
      rateAmount: instructorRates.rateAmount,
      updatedAt: instructorRates.updatedAt,
    })
    .from(instructorRates)
    .innerJoin(programs, eq(instructorRates.programId, programs.id))
    .where(eq(instructorRates.instructorId, instructorId))
    .orderBy(
      asc(programs.name),
      asc(instructorRates.materiBlock),
      asc(instructorRates.mode),
    );
}

export async function upsertInstructorRate(
  data: z.infer<typeof upsertRateSchema>,
) {
  await requirePermission("jadwalPelatihan", "manage");
  const parsed = upsertRateSchema.parse(data);

  const existing = await db
    .select({ id: instructorRates.id })
    .from(instructorRates)
    .where(
      and(
        eq(instructorRates.instructorId, parsed.instructorId),
        eq(instructorRates.programId, parsed.programId),
        eq(instructorRates.materiBlock, parsed.materiBlock),
        eq(instructorRates.mode, parsed.mode),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(instructorRates)
      .set({
        rateAmount: parsed.rateAmount.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(instructorRates.id, existing[0].id));
  } else {
    await db.insert(instructorRates).values({
      id: nanoid(),
      instructorId: parsed.instructorId,
      programId: parsed.programId,
      materiBlock: parsed.materiBlock,
      mode: parsed.mode,
      rateAmount: parsed.rateAmount.toFixed(2),
    });
  }

  revalidatePath("/jadwal-otomatis/instruktur");
  return { ok: true as const };
}

export async function removeInstructorRate(id: string) {
  await requirePermission("jadwalPelatihan", "manage");

  await db.delete(instructorRates).where(eq(instructorRates.id, id));

  revalidatePath("/jadwal-otomatis/instruktur");
  return { ok: true as const };
}

export async function listHonorariumRateRules(programId?: string) {
  await requirePermission("jadwalPelatihan", "view");

  const rows = await db
    .select({
      id: honorariumRateRules.id,
      programId: honorariumRateRules.programId,
      programName: programs.name,
      level: honorariumRateRules.level,
      mode: honorariumRateRules.mode,
      honorPerSession: honorariumRateRules.honorPerSession,
      transportAmount: honorariumRateRules.transportAmount,
      effectiveFrom: honorariumRateRules.effectiveFrom,
      effectiveTo: honorariumRateRules.effectiveTo,
      locationScope: honorariumRateRules.locationScope,
      isActive: honorariumRateRules.isActive,
      notes: honorariumRateRules.notes,
      updatedAt: honorariumRateRules.updatedAt,
    })
    .from(honorariumRateRules)
    .innerJoin(programs, eq(honorariumRateRules.programId, programs.id))
    .where(
      programId
        ? and(
            eq(honorariumRateRules.programId, programId),
            eq(honorariumRateRules.isActive, true),
          )
        : eq(honorariumRateRules.isActive, true),
    )
    .orderBy(
      asc(programs.name),
      asc(honorariumRateRules.level),
      asc(honorariumRateRules.mode),
      desc(honorariumRateRules.effectiveFrom),
    );

  return rows.map((row) => ({
    ...row,
    honorPerSession: toNumber(row.honorPerSession),
    transportAmount: toNumber(row.transportAmount),
  }));
}

export async function upsertHonorariumRateRule(
  data: z.infer<typeof upsertRateRuleSchema>,
) {
  await requirePermission("jadwalPelatihan", "manage");
  const parsed = upsertRateRuleSchema.parse(data);

  if (parsed.effectiveTo && parsed.effectiveTo < parsed.effectiveFrom) {
    throw new Error("effective_to harus >= effective_from.");
  }

  if (parsed.id) {
    await db
      .update(honorariumRateRules)
      .set({
        programId: parsed.programId,
        level: parsed.level,
        mode: parsed.mode,
        honorPerSession: parsed.honorPerSession.toFixed(2),
        transportAmount: parsed.transportAmount.toFixed(2),
        effectiveFrom: parsed.effectiveFrom,
        effectiveTo: parsed.effectiveTo || null,
        locationScope: parsed.locationScope || "",
        notes: parsed.notes || null,
        isActive: parsed.isActive,
        updatedAt: new Date(),
      })
      .where(eq(honorariumRateRules.id, parsed.id));
  } else {
    await db.insert(honorariumRateRules).values({
      id: nanoid(),
      programId: parsed.programId,
      level: parsed.level,
      mode: parsed.mode,
      honorPerSession: parsed.honorPerSession.toFixed(2),
      transportAmount: parsed.transportAmount.toFixed(2),
      effectiveFrom: parsed.effectiveFrom,
      effectiveTo: parsed.effectiveTo || null,
      locationScope: parsed.locationScope || "",
      notes: parsed.notes || null,
      isActive: parsed.isActive,
    });
  }

  revalidatePath("/jadwal-otomatis/honorarium");
  return { ok: true as const };
}

export async function removeHonorariumRateRule(id: string) {
  await requirePermission("jadwalPelatihan", "manage");

  await db
    .update(honorariumRateRules)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(honorariumRateRules.id, id));

  revalidatePath("/jadwal-otomatis/honorarium");
  return { ok: true as const };
}

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

export async function getHonorariumReport(
  filters?: z.infer<typeof reportFilterSchema>,
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

function normalizeExpertiseLevel(level: string | null): ExpertiseLevel {
  if (level === "basic" || level === "middle" || level === "senior")
    return level;
  if (level === "intermediate") return "middle";
  if (level === "expert") return "senior";
  return "middle";
}

function nextHonorariumDocumentNumber() {
  const { year, month, day } = getJakartaDatePartsFromUtils();
  return `HON-${year}${month}${day}-${nanoid(6).toUpperCase()}`;
}

function getJakartaDatePartsFromUtils() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return { year, month, day };
}

function getEligibleRows(rows: HonorariumReportRow[]) {
  return rows.filter(
    (row) =>
      row.sessionStatus === "completed" &&
      row.availabilityStatus === "accepted",
  );
}

type ExistingAssignmentRow = {
  assignmentId: string;
  batchId: string;
  documentNumber: string;
  status: string;
};

async function findExistingHonorariumAssignments(
  assignmentIds: string[],
): Promise<ExistingAssignmentRow[]> {
  if (assignmentIds.length === 0) return [];

  return db
    .select({
      assignmentId: honorariumItems.assignmentId,
      batchId: honorariumBatches.id,
      documentNumber: honorariumBatches.documentNumber,
      status: honorariumBatches.status,
    })
    .from(honorariumItems)
    .innerJoin(
      honorariumBatches,
      eq(honorariumItems.batchId, honorariumBatches.id),
    )
    .where(inArray(honorariumItems.assignmentId, assignmentIds));
}

function summarizeConflictBatches(existingRows: ExistingAssignmentRow[]) {
  const byBatch = new Map<
    string,
    {
      batchId: string;
      documentNumber: string;
      status: string;
      statusLabel: string;
    }
  >();

  for (const row of existingRows) {
    if (byBatch.has(row.batchId)) continue;
    byBatch.set(row.batchId, {
      batchId: row.batchId,
      documentNumber: row.documentNumber,
      status: row.status,
      statusLabel: batchStatusLabelLoose(row.status),
    });
  }

  return Array.from(byBatch.values()).sort((a, b) =>
    b.documentNumber.localeCompare(a.documentNumber),
  );
}

function isUniqueViolationOnHonorariumAssignment(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const withCode = error as {
    code?: string;
    constraint?: string;
    message?: string;
  };
  if (withCode.code !== "23505") return false;
  if (withCode.constraint === "uniq_honorarium_assignment_once") return true;
  return typeof withCode.message === "string"
    ? withCode.message.includes("uniq_honorarium_assignment_once")
    : false;
}

function mergeNotes(current: string | null, next: string | undefined) {
  const trimmed = next?.trim();
  if (!trimmed) return current;
  if (!current?.trim()) return trimmed;
  return `${current.trim()}\n${trimmed}`;
}

function parsePaidDate(value: string | undefined) {
  if (!value) return new Date();
  const parsed = new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

function readObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

async function validateBatchCompletenessBeforeLock(batchId: string) {
  const [batchRow, itemAggregateRows, recapRows, deductionRows, paidAuditRows] =
    await Promise.all([
      db
        .select({
          id: honorariumBatches.id,
          paidAt: honorariumBatches.paidAt,
          paidBy: honorariumBatches.paidBy,
        })
        .from(honorariumBatches)
        .where(eq(honorariumBatches.id, batchId))
        .limit(1),
      db
        .select({
          itemCount: sql<number>`COUNT(*)::int`,
          totalAmount: sql<string>`COALESCE(SUM(${honorariumItems.amount}), 0)::text`,
        })
        .from(honorariumItems)
        .where(eq(honorariumItems.batchId, batchId)),
      db
        .select({
          instructorId: honorariumItems.paidInstructorId,
          instructorName: honorariumItems.paidInstructorName,
          grossAmount: sql<string>`COALESCE(SUM(${honorariumItems.amount}), 0)::text`,
        })
        .from(honorariumItems)
        .where(eq(honorariumItems.batchId, batchId))
        .groupBy(
          honorariumItems.paidInstructorId,
          honorariumItems.paidInstructorName,
        ),
      db
        .select({
          instructorId: honorariumDeductions.instructorId,
          instructorName: instructors.name,
          amount: honorariumDeductions.amount,
        })
        .from(honorariumDeductions)
        .leftJoin(
          instructors,
          eq(honorariumDeductions.instructorId, instructors.id),
        )
        .where(eq(honorariumDeductions.batchId, batchId)),
      db
        .select({
          payload: honorariumAuditLogs.payload,
        })
        .from(honorariumAuditLogs)
        .where(
          and(
            eq(honorariumAuditLogs.batchId, batchId),
            inArray(honorariumAuditLogs.action, [
              "finance_paid",
              "finance_payment_corrected",
            ]),
          ),
        )
        .orderBy(desc(honorariumAuditLogs.createdAt))
        .limit(1),
    ]);

  const errors: string[] = [];
  const batch = batchRow[0];
  if (!batch) {
    return { errors: ["Batch honorarium tidak ditemukan."] };
  }

  if (!batch.paidAt) {
    errors.push(
      "Tanggal bayar belum tercatat. Tandai batch sebagai dibayar terlebih dahulu.",
    );
  }
  if (!batch.paidBy) {
    errors.push(
      "Petugas pembayaran belum tercatat. Ulangi proses tandai dibayar melalui sistem.",
    );
  }

  const aggregate = itemAggregateRows[0];
  const itemCount = aggregate?.itemCount ?? 0;
  const grossAmount = toNumber(aggregate?.totalAmount ?? 0);
  if (itemCount <= 0) {
    errors.push("Batch tidak memiliki item sesi honorarium.");
  }
  if (grossAmount <= 0) {
    errors.push("Total gross batch harus lebih dari 0.");
  }

  const grossByInstructor = new Map<string, { name: string; gross: number }>();
  for (const row of recapRows) {
    grossByInstructor.set(row.instructorId, {
      name: row.instructorName,
      gross: toNumber(row.grossAmount),
    });
  }

  const deductionByInstructor = new Map<
    string,
    { name: string; total: number }
  >();
  for (const row of deductionRows) {
    const current = deductionByInstructor.get(row.instructorId);
    deductionByInstructor.set(row.instructorId, {
      name: row.instructorName ?? row.instructorId,
      total: (current?.total ?? 0) + toNumber(row.amount),
    });
  }

  for (const [instructorId, deduction] of deductionByInstructor.entries()) {
    const gross = grossByInstructor.get(instructorId);
    if (!gross) {
      errors.push(
        `Potongan ditemukan untuk instruktur "${deduction.name}" yang tidak memiliki item honorarium di batch ini.`,
      );
      continue;
    }
    if (deduction.total > gross.gross) {
      errors.push(
        `Total potongan untuk "${gross.name}" (${formatCurrency(deduction.total)}) melebihi gross (${formatCurrency(gross.gross)}).`,
      );
    }
  }

  const paidPayload = readObject(paidAuditRows[0]?.payload);
  const paymentReference = paidPayload?.paymentReference;
  if (
    typeof paymentReference !== "string" ||
    paymentReference.trim().length === 0
  ) {
    errors.push("Referensi transfer belum diisi pada proses tandai dibayar.");
  }

  const paymentAmountRaw = paidPayload?.paymentAmount;
  const paymentAmount =
    typeof paymentAmountRaw === "number"
      ? paymentAmountRaw
      : typeof paymentAmountRaw === "string"
        ? Number.parseFloat(paymentAmountRaw)
        : Number.NaN;
  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    errors.push(
      "Nominal pembayaran belum tercatat pada proses tandai dibayar.",
    );
  } else {
    let expectedNet = 0;
    for (const [instructorId, gross] of grossByInstructor.entries()) {
      const deduction = deductionByInstructor.get(instructorId)?.total ?? 0;
      expectedNet += Math.max(0, gross.gross - deduction);
    }
    const diff = Math.abs(paymentAmount - expectedNet);
    if (diff > 0.01) {
      errors.push(
        `Rekonsiliasi gagal: nominal pembayaran (${formatCurrency(paymentAmount)}) tidak sama dengan total net batch (${formatCurrency(expectedNet)}).`,
      );
    }
  }

  return { errors };
}

const HONORARIUM_NOTIFICATION_ROLES: RoleValue[] = ["admin", "staff"];

function buildHonorariumTransitionText(
  from: HonorariumBatchStatus,
  to: HonorariumBatchStatus,
) {
  if (from === "draft" && to === "dikirim_ke_keuangan") {
    return {
      title: "Batch Honorarium Dikirim ke Keuangan",
      actionText: "dikirim ke keuangan",
    };
  }
  if (from === "dikirim_ke_keuangan" && to === "diproses_keuangan") {
    return {
      title: "Batch Honorarium Sedang Diproses",
      actionText: "masuk proses keuangan",
    };
  }
  if (from === "diproses_keuangan" && to === "dibayar") {
    return {
      title: "Batch Honorarium Sudah Dibayar",
      actionText: "ditandai sudah dibayar",
    };
  }
  if (from === "dibayar" && to === "locked") {
    return {
      title: "Batch Honorarium Final (Locked)",
      actionText: "di-lock sebagai final",
    };
  }
  if (to === "draft") {
    return {
      title: "Batch Honorarium Direopen",
      actionText: "dikembalikan ke draft",
    };
  }
  return {
    title: "Status Batch Honorarium Diperbarui",
    actionText: `berpindah dari ${batchStatusLabel(from)} ke ${batchStatusLabel(to)}`,
  };
}

async function notifyHonorariumStatusTransition(params: {
  batchId: string;
  documentNumber: string;
  from: HonorariumBatchStatus;
  to: HonorariumBatchStatus;
  actorId: string;
}) {
  const [actorRows, recipients] = await Promise.all([
    db
      .select({ name: users.namaLengkap })
      .from(users)
      .where(eq(users.id, params.actorId))
      .limit(1),
    db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.isActive, true),
          inArray(users.role, HONORARIUM_NOTIFICATION_ROLES),
        ),
      ),
  ]);

  const targetUserIds = recipients
    .map((row) => row.id)
    .filter((id) => id !== params.actorId);

  if (targetUserIds.length === 0) return;

  const actorName = actorRows[0]?.name ?? "System";
  const template = buildHonorariumTransitionText(params.from, params.to);
  const message = `Batch ${params.documentNumber} ${template.actionText} oleh ${actorName}. Status: ${batchStatusLabel(params.from)} -> ${batchStatusLabel(params.to)}.`;

  await Promise.all(
    targetUserIds.map(async (userId) => {
      const pref = await checkNotificationPreference(
        userId,
        "honorarium_status",
      );
      if (!pref.inApp) return;

      await createNotification({
        userId,
        type: "honorarium_status",
        title: template.title,
        message,
        entitasType: "honorarium_batch",
        entitasId: params.batchId,
      });
    }),
  );

  revalidatePath("/dashboard");
}

async function transitionBatchStatus(params: {
  batchId: string;
  from: HonorariumBatchStatus;
  to: HonorariumBatchStatus;
  actorId: string;
  action: string;
  note?: string;
  payload?: Record<string, unknown>;
  paidAt?: Date | null;
  paidBy?: string | null;
  submittedAt?: Date | null;
  lockedAt?: Date | null;
}) {
  let documentNumberForNotification = "";

  const [existing] = await db
    .select({
      id: honorariumBatches.id,
      documentNumber: honorariumBatches.documentNumber,
      status: honorariumBatches.status,
      internalNotes: honorariumBatches.internalNotes,
    })
    .from(honorariumBatches)
    .where(eq(honorariumBatches.id, params.batchId))
    .limit(1);

  if (!existing) {
    throw new Error("Batch honorarium tidak ditemukan.");
  }
  documentNumberForNotification = existing.documentNumber;

  if (existing.status !== params.from) {
    throw new Error(
      `Status batch harus ${params.from}, status saat ini ${existing.status}.`,
    );
  }

  const updatePayload: Partial<typeof honorariumBatches.$inferInsert> = {
    status: params.to,
    internalNotes: mergeNotes(existing.internalNotes, params.note),
    updatedAt: new Date(),
  };

  if (params.submittedAt !== undefined)
    updatePayload.submittedAt = params.submittedAt;
  if (params.paidAt !== undefined) updatePayload.paidAt = params.paidAt;
  if (params.paidBy !== undefined) updatePayload.paidBy = params.paidBy;
  if (params.lockedAt !== undefined) updatePayload.lockedAt = params.lockedAt;

  const [updated] = await db
    .update(honorariumBatches)
    .set(updatePayload)
    .where(
      and(
        eq(honorariumBatches.id, params.batchId),
        eq(honorariumBatches.status, params.from),
      ),
    )
    .returning({ id: honorariumBatches.id });

  if (!updated) {
    throw new Error("Batch gagal diperbarui karena status berubah.");
  }

  await db.insert(honorariumAuditLogs).values({
    id: nanoid(),
    batchId: params.batchId,
    actorId: params.actorId,
    action: params.action,
    payload: {
      from: params.from,
      to: params.to,
      ...(params.payload ?? {}),
    },
  });

  revalidatePath("/jadwal-otomatis/honorarium");
  revalidatePath(`/jadwal-otomatis/honorarium/${params.batchId}`);
  revalidatePath("/keuangan");
  revalidatePath("/keuangan/honorarium");
  revalidatePath(`/keuangan/honorarium/${params.batchId}`);
  await revalidateDashboardTag(DASHBOARD_TAGS.keuangan);

  try {
    await notifyHonorariumStatusTransition({
      batchId: params.batchId,
      documentNumber: documentNumberForNotification,
      from: params.from,
      to: params.to,
      actorId: params.actorId,
    });
  } catch (error) {
    console.error("Gagal mengirim notifikasi status honorarium:", error);
  }
}

export type HonorariumBatchRow = {
  id: string;
  documentNumber: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  generatedBy: string | null;
  submittedAt: Date | null;
  approvedAt: Date | null;
  paidAt: Date | null;
  lockedAt: Date | null;
  createdAt: Date;
  itemCount: number;
  totalAmount: number;
  grossAmount: number;
  netAmount: number;
  waitingDays: number;
};

export type HonorariumBatchSortBy = z.infer<
  typeof listBatchPageSchema
>["sortBy"];

export type HonorariumBatchSortDir = z.infer<
  typeof listBatchPageSchema
>["sortDir"];

export type HonorariumBatchPage = {
  rows: HonorariumBatchRow[];
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  totals: {
    batchCount: number;
    outstandingAmount: number;
    netAmount: number;
  };
};

function getWaitingDays(submittedAt: Date | null) {
  if (!submittedAt) return 0;
  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  const submittedUtc = new Date(
    `${formatDate(submittedAt)}T00:00:00Z`,
  ).getTime();
  const todayUtc = new Date(`${formatDate(new Date())}T00:00:00Z`).getTime();
  return Math.max(0, Math.floor((todayUtc - submittedUtc) / 86_400_000));
}

function getBatchSortValue(
  row: HonorariumBatchRow,
  sortBy: HonorariumBatchSortBy,
) {
  if (sortBy === "documentNumber") return row.documentNumber;
  if (sortBy === "periodStart") return row.periodStart;
  if (sortBy === "itemCount") return row.itemCount;
  if (sortBy === "netAmount") return row.netAmount;
  if (sortBy === "status") return row.status;
  if (sortBy === "submittedAt") return row.submittedAt?.getTime() ?? 0;
  if (sortBy === "waitingDays") return row.waitingDays;
  return row.createdAt.getTime();
}

export async function listHonorariumBatches(
  filters?: z.infer<typeof listBatchFilterSchema>,
): Promise<HonorariumBatchRow[]> {
  const page = await listHonorariumBatchesPage({
    ...(filters ?? {}),
    page: 1,
    pageSize: 50,
    sortBy: "createdAt",
    sortDir: "desc",
  });
  return page.rows;
}

export async function listHonorariumBatchesPage(
  filters?: Partial<z.infer<typeof listBatchPageSchema>>,
): Promise<HonorariumBatchPage> {
  await requirePermission("jadwalUjian", "view");
  const parsed = listBatchPageSchema.parse(filters ?? {});

  if (
    parsed.startDate &&
    parsed.endDate &&
    parsed.startDate !== "" &&
    parsed.endDate !== "" &&
    parsed.startDate > parsed.endDate
  ) {
    throw new Error("Tanggal mulai filter batch harus <= tanggal akhir.");
  }

  const whereClause = and(
    parsed.startDate
      ? gte(honorariumBatches.periodStart, parsed.startDate)
      : undefined,
    parsed.endDate
      ? lte(honorariumBatches.periodEnd, parsed.endDate)
      : undefined,
    parsed.status ? eq(honorariumBatches.status, parsed.status) : undefined,
    parsed.financeOnly
      ? inArray(honorariumBatches.status, [
          "dikirim_ke_keuangan",
          "diproses_keuangan",
          "dibayar",
          "locked",
        ])
      : undefined,
  );

  const batchRows = await db
    .select({
      id: honorariumBatches.id,
      documentNumber: honorariumBatches.documentNumber,
      periodStart: honorariumBatches.periodStart,
      periodEnd: honorariumBatches.periodEnd,
      status: honorariumBatches.status,
      generatedBy: honorariumBatches.generatedBy,
      submittedAt: honorariumBatches.submittedAt,
      approvedAt: honorariumBatches.approvedAt,
      paidAt: honorariumBatches.paidAt,
      lockedAt: honorariumBatches.lockedAt,
      createdAt: honorariumBatches.createdAt,
    })
    .from(honorariumBatches)
    .where(whereClause)
    .orderBy(desc(honorariumBatches.createdAt));

  if (batchRows.length === 0) {
    return {
      rows: [],
      page: parsed.page,
      pageSize: parsed.pageSize,
      totalRows: 0,
      totalPages: 0,
      totals: { batchCount: 0, outstandingAmount: 0, netAmount: 0 },
    };
  }

  const batchIds = batchRows.map((row) => row.id);
  const [aggregateRows, allDeductions] = await Promise.all([
    db
      .select({
        batchId: honorariumItems.batchId,
        itemCount: sql<number>`COUNT(*)::int`,
        totalAmount: sql<string>`COALESCE(SUM(${honorariumItems.amount}), 0)::text`,
      })
      .from(honorariumItems)
      .where(inArray(honorariumItems.batchId, batchIds))
      .groupBy(honorariumItems.batchId),
    db
      .select({
        batchId: honorariumDeductions.batchId,
        amount: honorariumDeductions.amount,
      })
      .from(honorariumDeductions)
      .where(inArray(honorariumDeductions.batchId, batchIds)),
  ]);

  const aggregateByBatch = new Map(
    aggregateRows.map((row) => [
      row.batchId,
      {
        itemCount: row.itemCount,
        totalAmount: toNumber(row.totalAmount),
      },
    ]),
  );

  const deductionByBatch = new Map<string, number>();
  for (const d of allDeductions) {
    const current = deductionByBatch.get(d.batchId) ?? 0;
    deductionByBatch.set(d.batchId, current + toNumber(d.amount));
  }

  const rows = batchRows.map((row) => {
    const aggregate = aggregateByBatch.get(row.id);
    const gross = aggregate?.totalAmount ?? 0;
    const deduction = deductionByBatch.get(row.id) ?? 0;
    return {
      ...row,
      itemCount: aggregate?.itemCount ?? 0,
      totalAmount: gross,
      grossAmount: gross,
      netAmount: Math.max(0, gross - deduction),
      waitingDays: getWaitingDays(row.submittedAt),
    };
  });

  rows.sort((a, b) => {
    const valueA = getBatchSortValue(a, parsed.sortBy);
    const valueB = getBatchSortValue(b, parsed.sortBy);
    const direction = parsed.sortDir === "asc" ? 1 : -1;

    if (typeof valueA === "number" && typeof valueB === "number") {
      return (valueA - valueB) * direction;
    }

    return String(valueA).localeCompare(String(valueB), "id-ID") * direction;
  });

  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / parsed.pageSize));
  const safePage = Math.min(parsed.page, totalPages);
  const start = (safePage - 1) * parsed.pageSize;
  const netAmount = rows.reduce((sum, row) => sum + row.netAmount, 0);
  const outstandingAmount = rows
    .filter(
      (row) =>
        row.status === "dikirim_ke_keuangan" ||
        row.status === "diproses_keuangan",
    )
    .reduce((sum, row) => sum + row.netAmount, 0);

  return {
    rows: rows.slice(start, start + parsed.pageSize),
    page: safePage,
    pageSize: parsed.pageSize,
    totalRows,
    totalPages,
    totals: {
      batchCount: totalRows,
      outstandingAmount,
      netAmount,
    },
  };
}

export type FinanceHonorariumRecapRow = {
  batchId: string;
  documentNumber: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  statusLabel: string;
  itemCount: number;
  grossAmount: number;
  netAmount: number;
  paidAmount: number | null;
  reconciliationDiff: number | null;
  paymentReference: string | null;
  submittedAt: Date | null;
  paidAt: Date | null;
  lockedAt: Date | null;
};

export type FinanceHonorariumRecap = {
  filters: {
    startDate: string;
    endDate: string;
    status: string;
    instructorId: string;
  };
  rows: FinanceHonorariumRecapRow[];
  instructorRecaps: Array<{
    instructorId: string;
    instructorName: string;
    sessionCount: number;
    batchCount: number;
    grossAmount: number;
    deductionAmount: number;
    netAmount: number;
  }>;
  totals: {
    batchCount: number;
    sessionCount: number;
    grossAmount: number;
    netAmount: number;
    paidAmount: number;
    unpaidCount: number;
    reconciledCount: number;
    mismatchCount: number;
  };
};

export async function getFinanceHonorariumRecap(
  filters?: z.infer<typeof financeRecapFilterSchema>,
): Promise<FinanceHonorariumRecap> {
  await requirePermission("jadwalPelatihan", "view");
  const parsed = financeRecapFilterSchema.parse(filters ?? {});
  const defaults = defaultDateRange();

  const startDate = parsed.startDate || defaults.startDate;
  const endDate = parsed.endDate || defaults.endDate;
  const status = parsed.status || "all";
  const instructorId = parsed.instructorId || "";

  if (startDate > endDate) {
    throw new Error("Tanggal mulai filter batch harus <= tanggal akhir.");
  }

  const batchPage = await listHonorariumBatchesPage({
    startDate,
    endDate,
    status: status === "all" ? "" : status,
    financeOnly: true,
    page: 1,
    pageSize: 100,
    sortBy: "periodStart",
    sortDir: "asc",
  });
  let batches = batchPage.rows;

  if (batches.length === 0) {
    return {
      filters: { startDate, endDate, status, instructorId },
      rows: [],
      instructorRecaps: [],
      totals: {
        batchCount: 0,
        sessionCount: 0,
        grossAmount: 0,
        netAmount: 0,
        paidAmount: 0,
        unpaidCount: 0,
        reconciledCount: 0,
        mismatchCount: 0,
      },
    };
  }

  const batchIds = batches.map((row) => row.id);
  const [paymentLogs, instructorRows, deductionRows] = await Promise.all([
    db
      .select({
        batchId: honorariumAuditLogs.batchId,
        payload: honorariumAuditLogs.payload,
        createdAt: honorariumAuditLogs.createdAt,
      })
      .from(honorariumAuditLogs)
      .where(
        and(
          inArray(honorariumAuditLogs.batchId, batchIds),
          inArray(honorariumAuditLogs.action, [
            "finance_paid",
            "finance_payment_corrected",
          ]),
        ),
      )
      .orderBy(desc(honorariumAuditLogs.createdAt)),
    db
      .select({
        batchId: honorariumItems.batchId,
        instructorId: honorariumItems.paidInstructorId,
        instructorName: honorariumItems.paidInstructorName,
        sessionCount: sql<number>`COUNT(*)::int`,
        grossAmount: sql<string>`COALESCE(SUM(${honorariumItems.amount}), 0)::text`,
      })
      .from(honorariumItems)
      .where(inArray(honorariumItems.batchId, batchIds))
      .groupBy(
        honorariumItems.batchId,
        honorariumItems.paidInstructorId,
        honorariumItems.paidInstructorName,
      ),
    db
      .select({
        batchId: honorariumDeductions.batchId,
        instructorId: honorariumDeductions.instructorId,
        amount: honorariumDeductions.amount,
      })
      .from(honorariumDeductions)
      .where(inArray(honorariumDeductions.batchId, batchIds)),
  ]);

  if (instructorId) {
    const matchingBatchIds = new Set(
      instructorRows
        .filter((row) => row.instructorId === instructorId)
        .map((row) => row.batchId),
    );
    batches = batches.filter((batch) => matchingBatchIds.has(batch.id));
  }

  const relevantBatchIds = new Set(batches.map((batch) => batch.id));
  const deductionByBatchInstructor = new Map<string, number>();
  for (const deduction of deductionRows) {
    if (!relevantBatchIds.has(deduction.batchId)) continue;
    const key = `${deduction.batchId}::${deduction.instructorId}`;
    deductionByBatchInstructor.set(
      key,
      (deductionByBatchInstructor.get(key) ?? 0) + toNumber(deduction.amount),
    );
  }

  const instructorRecapById = new Map<
    string,
    {
      instructorId: string;
      instructorName: string;
      sessionCount: number;
      batchIds: Set<string>;
      grossAmount: number;
      deductionAmount: number;
      netAmount: number;
    }
  >();

  for (const row of instructorRows) {
    if (!relevantBatchIds.has(row.batchId)) continue;
    if (instructorId && row.instructorId !== instructorId) continue;

    const grossAmount = toNumber(row.grossAmount);
    const deductionAmount =
      deductionByBatchInstructor.get(`${row.batchId}::${row.instructorId}`) ??
      0;
    const current = instructorRecapById.get(row.instructorId) ?? {
      instructorId: row.instructorId,
      instructorName: row.instructorName,
      sessionCount: 0,
      batchIds: new Set<string>(),
      grossAmount: 0,
      deductionAmount: 0,
      netAmount: 0,
    };

    current.sessionCount += row.sessionCount;
    current.batchIds.add(row.batchId);
    current.grossAmount += grossAmount;
    current.deductionAmount += deductionAmount;
    current.netAmount += Math.max(0, grossAmount - deductionAmount);
    instructorRecapById.set(row.instructorId, current);
  }

  const instructorRecaps = Array.from(instructorRecapById.values())
    .map((row) => ({
      instructorId: row.instructorId,
      instructorName: row.instructorName,
      sessionCount: row.sessionCount,
      batchCount: row.batchIds.size,
      grossAmount: row.grossAmount,
      deductionAmount: row.deductionAmount,
      netAmount: row.netAmount,
    }))
    .sort((a, b) => b.netAmount - a.netAmount);

  const latestPaymentByBatch = new Map<
    string,
    { paymentReference: string | null; paymentAmount: number | null }
  >();
  for (const log of paymentLogs) {
    if (latestPaymentByBatch.has(log.batchId)) continue;
    const payload = readObject(log.payload);
    const paymentReference =
      typeof payload?.paymentReference === "string"
        ? payload.paymentReference.trim() || null
        : null;
    const amountRaw = payload?.paymentAmount;
    const paymentAmount =
      typeof amountRaw === "number"
        ? amountRaw
        : typeof amountRaw === "string"
          ? Number.parseFloat(amountRaw)
          : Number.NaN;
    latestPaymentByBatch.set(log.batchId, {
      paymentReference,
      paymentAmount: Number.isFinite(paymentAmount) ? paymentAmount : null,
    });
  }

  const rows: FinanceHonorariumRecapRow[] = batches.map((batch) => {
    const payment = latestPaymentByBatch.get(batch.id);
    const paidAmount = payment?.paymentAmount ?? null;
    const diff = paidAmount === null ? null : paidAmount - batch.netAmount;
    return {
      batchId: batch.id,
      documentNumber: batch.documentNumber,
      periodStart: batch.periodStart,
      periodEnd: batch.periodEnd,
      status: batch.status,
      statusLabel: batchStatusLabelLoose(batch.status),
      itemCount: batch.itemCount,
      grossAmount: batch.grossAmount,
      netAmount: batch.netAmount,
      paidAmount,
      reconciliationDiff: diff,
      paymentReference: payment?.paymentReference ?? null,
      submittedAt: batch.submittedAt,
      paidAt: batch.paidAt,
      lockedAt: batch.lockedAt,
    };
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.batchCount += 1;
      acc.sessionCount += row.itemCount;
      acc.grossAmount += row.grossAmount;
      acc.netAmount += row.netAmount;
      if (row.paidAmount !== null) {
        acc.paidAmount += row.paidAmount;
        if (Math.abs(row.reconciliationDiff ?? 0) <= 0.01) {
          acc.reconciledCount += 1;
        } else {
          acc.mismatchCount += 1;
        }
      } else {
        acc.unpaidCount += 1;
      }
      return acc;
    },
    {
      batchCount: 0,
      sessionCount: 0,
      grossAmount: 0,
      netAmount: 0,
      paidAmount: 0,
      unpaidCount: 0,
      reconciledCount: 0,
      mismatchCount: 0,
    },
  );

  return {
    filters: { startDate, endDate, status, instructorId },
    rows,
    instructorRecaps,
    totals,
  };
}

type FinanceExportExcelResult =
  | { ok: true; data: { fileName: string; xlsxBase64: string } }
  | { ok: false; error: string };

export async function exportFinanceHonorariumRecapExcel(
  filters?: z.infer<typeof financeRecapFilterSchema>,
): Promise<FinanceExportExcelResult> {
  await requirePermission("jadwalPelatihan", "view");
  const recap = await getFinanceHonorariumRecap(filters);

  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const summaryRows: (string | number | null)[][] = [
      ["REKAP HONORARIUM KEUANGAN (BULANAN)"],
      [""],
      [
        "Periode Filter",
        `${recap.filters.startDate} s.d. ${recap.filters.endDate}`,
      ],
      [
        "Status Filter",
        recap.filters.status === "all" ? "Semua Status" : recap.filters.status,
      ],
      ["Instruktur Filter", recap.filters.instructorId || "Semua Instruktur"],
      ["Total Batch", recap.totals.batchCount],
      ["Total Sesi", recap.totals.sessionCount],
      ["Total Gross", recap.totals.grossAmount],
      ["Total Net", recap.totals.netAmount],
      ["Total Nominal Dibayar", recap.totals.paidAmount],
      ["Batch Belum Dibayar", recap.totals.unpaidCount],
      ["Batch Rekonsiliasi Cocok", recap.totals.reconciledCount],
      ["Batch Rekonsiliasi Selisih", recap.totals.mismatchCount],
      [""],
      [
        "Diekspor pada",
        new Date().toLocaleString("id-ID", { timeZone: APP_TIME_ZONE }),
      ],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    summarySheet["!cols"] = [{ wch: 30 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, summarySheet, "Ringkasan");

    const detailRows = recap.rows.map((row, index) => ({
      "No.": index + 1,
      Dokumen: row.documentNumber,
      "Periode Mulai": row.periodStart,
      "Periode Akhir": row.periodEnd,
      Status: row.statusLabel,
      "Jumlah Sesi": row.itemCount,
      Gross: row.grossAmount,
      Net: row.netAmount,
      "Nominal Dibayar": row.paidAmount ?? "",
      "Selisih Rekonsiliasi": row.reconciliationDiff ?? "",
      "Referensi Transfer": row.paymentReference ?? "",
      "Tgl Kirim Keuangan": row.submittedAt
        ? row.submittedAt.toLocaleString("id-ID", { timeZone: APP_TIME_ZONE })
        : "",
      "Tgl Dibayar": row.paidAt
        ? row.paidAt.toLocaleString("id-ID", { timeZone: APP_TIME_ZONE })
        : "",
      "Tgl Locked": row.lockedAt
        ? row.lockedAt.toLocaleString("id-ID", { timeZone: APP_TIME_ZONE })
        : "",
    }));
    const detailSheet = XLSX.utils.json_to_sheet(
      detailRows.length > 0 ? detailRows : [{ "No.": "", Dokumen: "" }],
    );
    detailSheet["!cols"] = [
      { wch: 5 },
      { wch: 23 },
      { wch: 14 },
      { wch: 14 },
      { wch: 20 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 30 },
      { wch: 20 },
      { wch: 20 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, detailSheet, "Detail Batch");

    const instructorRows = recap.instructorRecaps.map((row, index) => ({
      "No.": index + 1,
      Instruktur: row.instructorName,
      Batch: row.batchCount,
      Sesi: row.sessionCount,
      Gross: row.grossAmount,
      Potongan: row.deductionAmount,
      Net: row.netAmount,
    }));
    const instructorSheet = XLSX.utils.json_to_sheet(
      instructorRows.length > 0
        ? instructorRows
        : [{ "No.": "", Instruktur: "" }],
    );
    instructorSheet["!cols"] = [
      { wch: 5 },
      { wch: 32 },
      { wch: 10 },
      { wch: 10 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, instructorSheet, "Rekap Instruktur");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const xlsxBase64 = Buffer.from(buffer).toString("base64");

    const fileName = `rekap-keuangan-honorarium-${recap.filters.startDate}-${recap.filters.endDate}.xlsx`;
    return { ok: true, data: { fileName, xlsxBase64 } };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Gagal export rekap honorarium keuangan.",
    };
  }
}

export type HonorariumBatchPeriodSuggestion = {
  startDate: string;
  endDate: string;
  hasExistingBatch: boolean;
  sourceBatchId: string | null;
  sourceDocumentNumber: string | null;
  sourcePeriodEnd: string | null;
};

export async function getSuggestedHonorariumBatchPeriod(): Promise<HonorariumBatchPeriodSuggestion> {
  await requirePermission("jadwalPelatihan", "view");

  const defaults = defaultDateRange();
  const today = getTodayIsoInJakarta();

  const [latest] = await db
    .select({
      id: honorariumBatches.id,
      documentNumber: honorariumBatches.documentNumber,
      periodEnd: honorariumBatches.periodEnd,
    })
    .from(honorariumBatches)
    .orderBy(
      desc(honorariumBatches.periodEnd),
      desc(honorariumBatches.createdAt),
    )
    .limit(1);

  if (!latest) {
    return {
      startDate: defaults.startDate,
      endDate: defaults.endDate,
      hasExistingBatch: false,
      sourceBatchId: null,
      sourceDocumentNumber: null,
      sourcePeriodEnd: null,
    };
  }

  const nextStart = addDaysToIsoDate(latest.periodEnd, 1);
  const suggestedEnd = nextStart > today ? nextStart : today;

  return {
    startDate: nextStart,
    endDate: suggestedEnd,
    hasExistingBatch: true,
    sourceBatchId: latest.id,
    sourceDocumentNumber: latest.documentNumber,
    sourcePeriodEnd: latest.periodEnd,
  };
}

export type HonorariumGeneratePreview = {
  period: { startDate: string; endDate: string };
  eligibleCount: number;
  missingRateCount: number;
  conflictingAssignmentCount: number;
  conflictingBatches: Array<{
    batchId: string;
    documentNumber: string;
    status: string;
    statusLabel: string;
  }>;
};

export async function previewHonorariumBatchGeneration(
  data: z.infer<typeof generateBatchSchema>,
): Promise<HonorariumGeneratePreview> {
  await requirePermission("jadwalPelatihan", "manage");
  const parsed = generateBatchSchema.parse(data);

  if (parsed.startDate > parsed.endDate) {
    throw new Error("Tanggal mulai harus <= tanggal akhir.");
  }

  const report = await getHonorariumReport({
    startDate: parsed.startDate,
    endDate: parsed.endDate,
  });

  const eligibleRows = Array.from(
    new Map(
      getEligibleRows(report.rows).map((row) => [row.assignmentId, row]),
    ).values(),
  );
  const missingRateRows = eligibleRows.filter(
    (row) => row.rateSource === "missing",
  );
  const existingRows = await findExistingHonorariumAssignments(
    eligibleRows.map((row) => row.assignmentId),
  );
  const conflictingBatches = summarizeConflictBatches(existingRows);

  return {
    period: { startDate: parsed.startDate, endDate: parsed.endDate },
    eligibleCount: eligibleRows.length,
    missingRateCount: missingRateRows.length,
    conflictingAssignmentCount: existingRows.length,
    conflictingBatches,
  };
}

export type HonorariumBatchDetail = {
  batch: {
    id: string;
    documentNumber: string;
    periodStart: string;
    periodEnd: string;
    status: string;
    generatedByName: string | null;
    paidByName: string | null;
    paidBy: string | null;
    submittedAt: Date | null;
    paidAt: Date | null;
    lockedAt: Date | null;
    internalNotes: string | null;
    createdAt: Date;
    updatedAt: Date;
    itemCount: number;
    totalAmount: number;
  };
  items: Array<{
    id: string;
    scheduledDate: string;
    programName: string;
    paidInstructorName: string;
    source: string;
    materiBlock: string;
    expertiseLevelSnapshot: string;
    rateSnapshot: number;
    amount: number;
  }>;
  recaps: Array<{
    instructorId: string;
    instructorName: string;
    totalSessions: number;
    grossAmount: number;
    netAmount: number;
  }>;
  auditLogs: Array<{
    id: string;
    actorName: string;
    action: string;
    payload: unknown;
    createdAt: Date;
  }>;
  reconciliation: {
    netAmount: number;
    paymentAmount: number | null;
    difference: number | null;
    isMatched: boolean | null;
    paymentReference: string | null;
    lastPaidLoggedAt: Date | null;
  };
};

export async function getHonorariumBatchDetail(
  batchId: string,
): Promise<HonorariumBatchDetail | null> {
  await requirePermission("jadwalPelatihan", "view");
  const parsed = batchIdSchema.parse({ batchId });

  const [batchRow] = await db
    .select({
      id: honorariumBatches.id,
      documentNumber: honorariumBatches.documentNumber,
      periodStart: honorariumBatches.periodStart,
      periodEnd: honorariumBatches.periodEnd,
      status: honorariumBatches.status,
      generatedByName: users.namaLengkap,
      paidBy: honorariumBatches.paidBy,
      submittedAt: honorariumBatches.submittedAt,
      paidAt: honorariumBatches.paidAt,
      lockedAt: honorariumBatches.lockedAt,
      internalNotes: honorariumBatches.internalNotes,
      createdAt: honorariumBatches.createdAt,
      updatedAt: honorariumBatches.updatedAt,
    })
    .from(honorariumBatches)
    .leftJoin(users, eq(honorariumBatches.generatedBy, users.id))
    .where(eq(honorariumBatches.id, parsed.batchId))
    .limit(1);

  if (!batchRow) return null;

  const [itemRows, recapRows, auditRows, paidByRow, deductionRows] =
    await Promise.all([
      db
        .select({
          id: honorariumItems.id,
          scheduledDate: honorariumItems.scheduledDate,
          programName: programs.name,
          paidInstructorName: honorariumItems.paidInstructorName,
          source: honorariumItems.source,
          materiBlock: honorariumItems.materiBlock,
          expertiseLevelSnapshot: honorariumItems.expertiseLevelSnapshot,
          rateSnapshot: honorariumItems.rateSnapshot,
          amount: honorariumItems.amount,
        })
        .from(honorariumItems)
        .innerJoin(programs, eq(honorariumItems.programId, programs.id))
        .where(eq(honorariumItems.batchId, parsed.batchId))
        .orderBy(
          asc(honorariumItems.scheduledDate),
          asc(honorariumItems.paidInstructorName),
        ),
      db
        .select({
          instructorId: honorariumItems.paidInstructorId,
          instructorName: honorariumItems.paidInstructorName,
          totalSessions: sql<number>`COUNT(*)::int`,
          grossAmount: sql<string>`COALESCE(SUM(${honorariumItems.amount}), 0)::text`,
        })
        .from(honorariumItems)
        .where(eq(honorariumItems.batchId, parsed.batchId))
        .groupBy(
          honorariumItems.paidInstructorId,
          honorariumItems.paidInstructorName,
        )
        .orderBy(asc(honorariumItems.paidInstructorName)),
      db
        .select({
          id: honorariumAuditLogs.id,
          actorName: users.namaLengkap,
          action: honorariumAuditLogs.action,
          payload: honorariumAuditLogs.payload,
          createdAt: honorariumAuditLogs.createdAt,
        })
        .from(honorariumAuditLogs)
        .leftJoin(users, eq(honorariumAuditLogs.actorId, users.id))
        .where(eq(honorariumAuditLogs.batchId, parsed.batchId))
        .orderBy(desc(honorariumAuditLogs.createdAt)),
      batchRow.paidBy
        ? db
            .select({ name: users.namaLengkap })
            .from(users)
            .where(eq(users.id, batchRow.paidBy))
            .limit(1)
            .then((rows) => rows[0] ?? null)
        : Promise.resolve(null),
      db
        .select({
          instructorId: honorariumDeductions.instructorId,
          amount: honorariumDeductions.amount,
        })
        .from(honorariumDeductions)
        .where(eq(honorariumDeductions.batchId, parsed.batchId)),
    ]);

  const totalAmount = itemRows.reduce(
    (sum, row) => sum + toNumber(row.amount),
    0,
  );

  const deductionsByInstructor = new Map<string, number>();
  for (const d of deductionRows) {
    const current = deductionsByInstructor.get(d.instructorId) ?? 0;
    deductionsByInstructor.set(d.instructorId, current + toNumber(d.amount));
  }

  const recaps = recapRows.map((row) => {
    const gross = toNumber(row.grossAmount);
    const deduction = deductionsByInstructor.get(row.instructorId) ?? 0;
    return {
      ...row,
      grossAmount: gross,
      netAmount: Math.max(0, gross - deduction),
    };
  });

  const netAmount = recaps.reduce((sum, row) => sum + row.netAmount, 0);
  const paidLog =
    auditRows.find(
      (row) =>
        row.action === "finance_payment_corrected" ||
        row.action === "finance_paid",
    ) ?? null;
  const paidPayload = readObject(paidLog?.payload);
  const paymentAmountRaw = paidPayload?.paymentAmount;
  const parsedPaymentAmount =
    typeof paymentAmountRaw === "number"
      ? paymentAmountRaw
      : typeof paymentAmountRaw === "string"
        ? Number.parseFloat(paymentAmountRaw)
        : Number.NaN;
  const paymentAmount = Number.isFinite(parsedPaymentAmount)
    ? parsedPaymentAmount
    : null;
  const paymentReferenceRaw = paidPayload?.paymentReference;
  const paymentReference =
    typeof paymentReferenceRaw === "string" &&
    paymentReferenceRaw.trim().length > 0
      ? paymentReferenceRaw.trim()
      : null;
  const difference = paymentAmount === null ? null : paymentAmount - netAmount;
  const isMatched = difference === null ? null : Math.abs(difference) <= 0.01;

  return {
    batch: {
      id: batchRow.id,
      documentNumber: batchRow.documentNumber,
      periodStart: batchRow.periodStart,
      periodEnd: batchRow.periodEnd,
      status: batchRow.status,
      generatedByName: batchRow.generatedByName ?? null,
      paidByName: paidByRow?.name ?? null,
      paidBy: batchRow.paidBy,
      submittedAt: batchRow.submittedAt,
      paidAt: batchRow.paidAt,
      lockedAt: batchRow.lockedAt,
      internalNotes: batchRow.internalNotes,
      createdAt: batchRow.createdAt,
      updatedAt: batchRow.updatedAt,
      itemCount: itemRows.length,
      totalAmount,
    },
    items: itemRows.map((row) => ({
      ...row,
      rateSnapshot: toNumber(row.rateSnapshot),
      amount: toNumber(row.amount),
    })),
    recaps,
    auditLogs: auditRows.map((row) => ({
      ...row,
      actorName: row.actorName ?? "System",
    })),
    reconciliation: {
      netAmount,
      paymentAmount,
      difference,
      isMatched,
      paymentReference,
      lastPaidLoggedAt: paidLog?.createdAt ?? null,
    },
  };
}

function addDaysToIsoDate(isoDate: string, days: number) {
  const base = new Date(`${isoDate}T00:00:00+07:00`);
  if (Number.isNaN(base.getTime())) {
    return isoDate;
  }
  base.setDate(base.getDate() + days);
  return getTodayIsoInJakarta(base);
}

export async function deleteHonorariumBatch(batchId: string) {
  const session = await requirePermission("jadwalPelatihan", "manage");
  const parsed = batchIdSchema.parse({ batchId });

  const [existing] = await db
    .select({
      id: honorariumBatches.id,
      status: honorariumBatches.status,
      documentNumber: honorariumBatches.documentNumber,
    })
    .from(honorariumBatches)
    .where(eq(honorariumBatches.id, parsed.batchId))
    .limit(1);

  if (!existing) {
    throw new Error("Batch honorarium tidak ditemukan.");
  }

  if (existing.status !== "draft") {
    throw new Error("Hanya batch status Draft yang boleh dihapus.");
  }

  await db
    .delete(honorariumBatches)
    .where(eq(honorariumBatches.id, parsed.batchId));

  revalidatePath("/jadwal-otomatis/honorarium");
  revalidatePath(`/jadwal-otomatis/honorarium/${parsed.batchId}`);

  return {
    ok: true as const,
    batchId: parsed.batchId,
    documentNumber: existing.documentNumber,
    deletedBy: session.user.id,
  };
}

export async function generateHonorariumBatch(
  data: z.infer<typeof generateBatchSchema>,
) {
  const session = await requirePermission("jadwalPelatihan", "manage");
  const parsed = generateBatchSchema.parse(data);

  if (parsed.startDate > parsed.endDate) {
    throw new Error("Tanggal mulai harus <= tanggal akhir.");
  }

  const report = await getHonorariumReport({
    startDate: parsed.startDate,
    endDate: parsed.endDate,
  });

  const eligibleRows = getEligibleRows(report.rows);
  if (eligibleRows.length === 0) {
    return {
      ok: false as const,
      message:
        "Tidak ada sesi layak bayar (completed + accepted) pada periode ini.",
    };
  }

  const uniqueEligibleRows = Array.from(
    new Map(eligibleRows.map((row) => [row.assignmentId, row])).values(),
  );

  const missingRateRows = uniqueEligibleRows.filter(
    (row) => row.rateSource === "missing",
  );
  if (missingRateRows.length > 0) {
    return {
      ok: false as const,
      message:
        "Draft gagal dibuat karena ada sesi tanpa tarif. Lengkapi master tarif/override instruktur terlebih dahulu.",
    };
  }

  const existingAssignmentRows = await findExistingHonorariumAssignments(
    uniqueEligibleRows.map((row) => row.assignmentId),
  );

  if (existingAssignmentRows.length > 0) {
    const existingDocs = summarizeConflictBatches(existingAssignmentRows).map(
      (row) => `${row.documentNumber} (${row.statusLabel})`,
    );
    const sampleDocs = existingDocs.slice(0, 3).join(", ");
    const moreCount =
      existingDocs.length > 3
        ? ` dan ${existingDocs.length - 3} batch lainnya`
        : "";
    return {
      ok: false as const,
      message: `Draft gagal dibuat karena ada ${existingAssignmentRows.length} sesi yang sudah masuk batch honorarium sebelumnya. Hapus/review batch lama terlebih dahulu (${sampleDocs}${moreCount}).`,
    };
  }

  const batchId = nanoid();
  const documentNumber = nextHonorariumDocumentNumber();

  await db.insert(honorariumBatches).values({
    id: batchId,
    documentNumber,
    periodStart: parsed.startDate,
    periodEnd: parsed.endDate,
    status: "draft",
    generatedBy: session.user.id,
    internalNotes: parsed.internalNotes || null,
  });

  try {
    await db.insert(honorariumItems).values(
      uniqueEligibleRows.map((row) => ({
        id: nanoid(),
        batchId,
        assignmentId: row.assignmentId,
        sessionId: row.sessionId,
        kelasId: row.kelasId,
        programId: row.programId,
        scheduledDate: row.scheduledDate,
        paidInstructorId: row.paidInstructorId,
        paidInstructorName: row.paidInstructorName,
        source: row.source,
        materiBlock: row.materiBlock,
        expertiseLevelSnapshot: row.expertiseLevel,
        rateSnapshot: row.rateAmount.toFixed(2),
        amount: row.totalAmount.toFixed(2),
      })),
    );
  } catch (error) {
    await db.delete(honorariumBatches).where(eq(honorariumBatches.id, batchId));
    if (isUniqueViolationOnHonorariumAssignment(error)) {
      throw new Error(
        "Generate dibatalkan karena beberapa sesi sudah masuk batch lain. Refresh daftar batch lalu review batch yang bentrok.",
      );
    }
    throw error;
  }

  await db.insert(honorariumAuditLogs).values({
    id: nanoid(),
    batchId,
    actorId: session.user.id,
    action: "generated_draft",
    payload: {
      periodStart: parsed.startDate,
      periodEnd: parsed.endDate,
      eligibleItemCount: uniqueEligibleRows.length,
      totalAmount: uniqueEligibleRows.reduce(
        (sum, row) => sum + row.totalAmount,
        0,
      ),
    },
  });

  revalidatePath("/jadwal-otomatis/honorarium");
  return {
    ok: true as const,
    batchId,
    documentNumber,
    itemCount: uniqueEligibleRows.length,
    totalAmount: uniqueEligibleRows.reduce(
      (sum, row) => sum + row.totalAmount,
      0,
    ),
  };
}

export async function submitHonorariumBatchToFinance(batchId: string) {
  const session = await requirePermission("jadwalPelatihan", "manage");
  const parsed = batchIdSchema.parse({ batchId });

  await transitionBatchStatus({
    batchId: parsed.batchId,
    from: "draft",
    to: "dikirim_ke_keuangan",
    actorId: session.user.id,
    action: "submitted_to_finance",
    submittedAt: new Date(),
  });

  return { ok: true as const };
}

export async function markHonorariumBatchInProcess(batchId: string) {
  const session = await requireCapability("keuangan:process");
  const parsed = batchIdSchema.parse({ batchId });

  await transitionBatchStatus({
    batchId: parsed.batchId,
    from: "dikirim_ke_keuangan",
    to: "diproses_keuangan",
    actorId: session.user.id,
    action: "finance_processing_started",
  });

  return { ok: true as const };
}

export async function bulkMarkHonorariumBatchesInProcess(batchIds: string[]) {
  const session = await requireCapability("keuangan:process");
  const parsed = batchIdsSchema.parse({ batchIds });
  const uniqueBatchIds = Array.from(new Set(parsed.batchIds));
  const errors: string[] = [];
  let processed = 0;

  for (const batchId of uniqueBatchIds) {
    try {
      await transitionBatchStatus({
        batchId,
        from: "dikirim_ke_keuangan",
        to: "diproses_keuangan",
        actorId: session.user.id,
        action: "finance_processing_started",
        payload: { bulk: true },
      });
      processed += 1;
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : `Batch ${batchId} gagal diproses.`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    processed,
    failed: errors.length,
    errors,
  };
}

export async function markHonorariumBatchPaid(
  data: z.infer<typeof markBatchPaidSchema>,
) {
  const session = await requireCapability("keuangan:pay");
  const parsed = markBatchPaidSchema.parse(data);

  await transitionBatchStatus({
    batchId: parsed.batchId,
    from: "diproses_keuangan",
    to: "dibayar",
    actorId: session.user.id,
    action: "finance_paid",
    paidAt: parsePaidDate(parsed.paidDate),
    paidBy: session.user.id,
    payload: {
      paymentReference: parsed.paymentReference,
      paidDate: parsed.paidDate || null,
      paymentAmount: parsed.paymentAmount,
    },
  });

  return { ok: true as const };
}

export async function correctHonorariumBatchPayment(
  data: z.infer<typeof correctBatchPaymentSchema>,
) {
  const session = await requireCapability("keuangan:pay");
  const parsed = correctBatchPaymentSchema.parse(data);

  const [batch] = await db
    .select({
      id: honorariumBatches.id,
      status: honorariumBatches.status,
      paidAt: honorariumBatches.paidAt,
      paidBy: honorariumBatches.paidBy,
    })
    .from(honorariumBatches)
    .where(eq(honorariumBatches.id, parsed.batchId))
    .limit(1);

  if (!batch) throw new Error("Batch honorarium tidak ditemukan.");
  if (batch.status !== "dibayar") {
    throw new Error(
      "Koreksi pembayaran hanya bisa dilakukan saat status batch Dibayar dan belum Locked.",
    );
  }

  const [previousPaymentLog] = await db
    .select({
      payload: honorariumAuditLogs.payload,
    })
    .from(honorariumAuditLogs)
    .where(
      and(
        eq(honorariumAuditLogs.batchId, parsed.batchId),
        inArray(honorariumAuditLogs.action, [
          "finance_paid",
          "finance_payment_corrected",
        ]),
      ),
    )
    .orderBy(desc(honorariumAuditLogs.createdAt))
    .limit(1);

  const previousPayment = readObject(previousPaymentLog?.payload);
  const paidAt = parsePaidDate(parsed.paidDate);

  const [updated] = await db
    .update(honorariumBatches)
    .set({
      paidAt,
      paidBy: session.user.id,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(honorariumBatches.id, parsed.batchId),
        eq(honorariumBatches.status, "dibayar"),
      ),
    )
    .returning({ id: honorariumBatches.id });

  if (!updated) {
    throw new Error("Batch gagal diperbarui karena status berubah.");
  }

  await db.insert(honorariumAuditLogs).values({
    id: nanoid(),
    batchId: parsed.batchId,
    actorId: session.user.id,
    action: "finance_payment_corrected",
    payload: {
      paymentReference: parsed.paymentReference,
      paidDate: parsed.paidDate || null,
      paymentAmount: parsed.paymentAmount,
      previousPaymentReference: previousPayment?.paymentReference ?? null,
      previousPaidDate:
        previousPayment?.paidDate ?? batch.paidAt?.toISOString() ?? null,
      previousPaymentAmount: previousPayment?.paymentAmount ?? null,
      previousPaidBy: batch.paidBy,
      reason: parsed.reason,
    },
  });

  revalidatePath("/jadwal-otomatis/honorarium");
  revalidatePath(`/jadwal-otomatis/honorarium/${parsed.batchId}`);
  revalidatePath("/keuangan/honorarium");
  revalidateDashboardTag(DASHBOARD_TAGS.keuangan);
  revalidatePath(`/keuangan/honorarium/${parsed.batchId}`);

  return { ok: true as const };
}

export async function lockHonorariumBatch(batchId: string) {
  const session = await requireCapability("keuangan:pay");
  const parsed = batchIdSchema.parse({ batchId });
  const validation = await validateBatchCompletenessBeforeLock(parsed.batchId);
  if (validation.errors.length > 0) {
    throw new Error(
      `Batch belum bisa di-lock: ${validation.errors.join(" | ")}`,
    );
  }

  await transitionBatchStatus({
    batchId: parsed.batchId,
    from: "dibayar",
    to: "locked",
    actorId: session.user.id,
    action: "batch_locked",
    lockedAt: new Date(),
  });

  return { ok: true as const };
}

// ─── DEDUCTIONS ───────────────────────────────────────────────────────────────

export async function addHonorariumDeduction(
  data: z.infer<typeof addDeductionSchema>,
) {
  const session = await requirePermission("jadwalPelatihan", "manage");
  const parsed = addDeductionSchema.parse(data);

  const [batch] = await db
    .select({ status: honorariumBatches.status })
    .from(honorariumBatches)
    .where(eq(honorariumBatches.id, parsed.batchId))
    .limit(1);

  if (!batch) throw new Error("Batch tidak ditemukan.");
  if (batch.status !== "draft")
    throw new Error("Potongan hanya bisa ditambahkan saat batch status draft.");

  const id = nanoid();
  await db.insert(honorariumDeductions).values({
    id,
    batchId: parsed.batchId,
    instructorId: parsed.instructorId,
    deductionType: parsed.deductionType,
    description: parsed.description,
    amount: parsed.amount.toFixed(2),
  });

  await db.insert(honorariumAuditLogs).values({
    id: nanoid(),
    batchId: parsed.batchId,
    actorId: session.user.id,
    action: "deduction_added",
    payload: {
      deductionId: id,
      instructorId: parsed.instructorId,
      type: parsed.deductionType,
      amount: parsed.amount,
    },
  });

  revalidatePath(`/jadwal-otomatis/honorarium/${parsed.batchId}`);
  return { ok: true as const, deductionId: id };
}

export async function removeHonorariumDeduction(
  data: z.infer<typeof removeDeductionSchema>,
) {
  const session = await requirePermission("jadwalPelatihan", "manage");
  const parsed = removeDeductionSchema.parse(data);

  const [deduction] = await db
    .select({
      id: honorariumDeductions.id,
      batchId: honorariumDeductions.batchId,
    })
    .from(honorariumDeductions)
    .where(eq(honorariumDeductions.id, parsed.deductionId))
    .limit(1);

  if (!deduction) throw new Error("Potongan tidak ditemukan.");

  const [batch] = await db
    .select({ status: honorariumBatches.status })
    .from(honorariumBatches)
    .where(eq(honorariumBatches.id, deduction.batchId))
    .limit(1);

  if (!batch || batch.status !== "draft")
    throw new Error("Potongan hanya bisa dihapus saat batch status draft.");

  await db
    .delete(honorariumDeductions)
    .where(eq(honorariumDeductions.id, parsed.deductionId));

  await db.insert(honorariumAuditLogs).values({
    id: nanoid(),
    batchId: deduction.batchId,
    actorId: session.user.id,
    action: "deduction_removed",
    payload: { deductionId: parsed.deductionId },
  });

  revalidatePath(`/jadwal-otomatis/honorarium/${deduction.batchId}`);
  return { ok: true as const };
}

export type DeductionRow = {
  id: string;
  instructorId: string;
  instructorName: string;
  deductionType: string;
  description: string;
  amount: number;
  createdAt: Date;
};

export async function listHonorariumDeductions(
  batchId: string,
): Promise<DeductionRow[]> {
  await requirePermission("jadwalPelatihan", "view");

  const rows = await db
    .select({
      id: honorariumDeductions.id,
      instructorId: honorariumDeductions.instructorId,
      instructorName: instructors.name,
      deductionType: honorariumDeductions.deductionType,
      description: honorariumDeductions.description,
      amount: honorariumDeductions.amount,
      createdAt: honorariumDeductions.createdAt,
    })
    .from(honorariumDeductions)
    .innerJoin(
      instructors,
      eq(honorariumDeductions.instructorId, instructors.id),
    )
    .where(eq(honorariumDeductions.batchId, batchId))
    .orderBy(asc(honorariumDeductions.createdAt));

  return rows.map((row) => ({
    ...row,
    amount: toNumber(row.amount),
  }));
}

// ─── REOPEN BATCH ─────────────────────────────────────────────────────────────

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

export async function listHonorariumPaymentProofs(
  batchId: string,
): Promise<HonorariumPaymentProofRow[]> {
  await requirePermission("jadwalPelatihan", "view");

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

const REOPEN_ALLOWED_FROM: HonorariumBatchStatus[] = [
  "dikirim_ke_keuangan",
  "diproses_keuangan",
  "dibayar",
  "locked",
];

export async function reopenHonorariumBatch(
  data: z.infer<typeof reopenBatchSchema>,
) {
  const session = await requireCapability("keuangan:pay");
  const parsed = reopenBatchSchema.parse(data);

  const [existing] = await db
    .select({
      id: honorariumBatches.id,
      documentNumber: honorariumBatches.documentNumber,
      status: honorariumBatches.status,
      internalNotes: honorariumBatches.internalNotes,
    })
    .from(honorariumBatches)
    .where(eq(honorariumBatches.id, parsed.batchId))
    .limit(1);

  if (!existing) throw new Error("Batch tidak ditemukan.");
  if (!REOPEN_ALLOWED_FROM.includes(existing.status as HonorariumBatchStatus)) {
    throw new Error(
      `Batch dengan status ${existing.status} tidak bisa di-reopen.`,
    );
  }

  await db
    .update(honorariumBatches)
    .set({
      status: "draft",
      internalNotes: mergeNotes(
        existing.internalNotes,
        `[REOPEN] ${parsed.reason}`,
      ),
      submittedAt: null,
      paidAt: null,
      lockedAt: null,
      paidBy: null,
      updatedAt: new Date(),
    })
    .where(eq(honorariumBatches.id, parsed.batchId));

  await db.insert(honorariumAuditLogs).values({
    id: nanoid(),
    batchId: parsed.batchId,
    actorId: session.user.id,
    action: "batch_reopened",
    payload: {
      from: existing.status,
      to: "draft",
      reason: parsed.reason,
    },
  });

  revalidatePath("/jadwal-otomatis/honorarium");
  revalidatePath(`/jadwal-otomatis/honorarium/${parsed.batchId}`);
  revalidatePath("/keuangan");
  revalidatePath("/keuangan/honorarium");
  revalidatePath(`/keuangan/honorarium/${parsed.batchId}`);
  await revalidateDashboardTag(DASHBOARD_TAGS.keuangan);

  try {
    await notifyHonorariumStatusTransition({
      batchId: parsed.batchId,
      documentNumber: existing.documentNumber,
      from: existing.status as HonorariumBatchStatus,
      to: "draft",
      actorId: session.user.id,
    });
  } catch (error) {
    console.error("Gagal mengirim notifikasi reopen honorarium:", error);
  }

  return { ok: true as const };
}

// ─── EXPORT EXCEL FALLBACK ────────────────────────────────────────────────────

type ExportExcelResult =
  | { ok: true; data: { fileName: string; xlsxBase64: string } }
  | { ok: false; error: string };

export async function exportHonorariumBatchExcel(
  batchId: string,
): Promise<ExportExcelResult> {
  await requirePermission("jadwalPelatihan", "view");

  const detail = await getHonorariumBatchDetail(batchId);
  if (!detail) return { ok: false, error: "Batch tidak ditemukan." };

  const deductions = await listHonorariumDeductions(batchId);

  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    // Sheet 1: Ringkasan Batch
    const summaryRows: (string | number | null)[][] = [
      ["LAPORAN HONORARIUM INTERNAL"],
      [""],
      ["Nomor Dokumen", detail.batch.documentNumber],
      ["Periode", `${detail.batch.periodStart} s.d. ${detail.batch.periodEnd}`],
      ["Status", detail.batch.status],
      ["Dibuat Oleh", detail.batch.generatedByName ?? "-"],
      ["Dibayar Oleh", detail.batch.paidByName ?? "-"],
      ["Total Sesi", detail.batch.itemCount],
      ["Total Gross", detail.batch.totalAmount],
      ["Total Net", detail.reconciliation.netAmount],
      ["Nominal Dibayar", detail.reconciliation.paymentAmount ?? "-"],
      ["Selisih Rekonsiliasi", detail.reconciliation.difference ?? "-"],
      [
        "Status Rekonsiliasi",
        detail.reconciliation.isMatched === null
          ? "Belum ada data pembayaran"
          : detail.reconciliation.isMatched
            ? "Cocok"
            : "Selisih",
      ],
      [""],
      ["RINCIAN PER INSTRUKTUR"],
      ["Instruktur", "Total Sesi", "Gross", "Deductions", "Net"],
      ...detail.recaps.map((r) => [
        r.instructorName,
        r.totalSessions,
        r.grossAmount,
        deductions
          .filter((d) => d.instructorId === r.instructorId)
          .reduce((s, d) => s + d.amount, 0),
        r.netAmount,
      ]),
      [""],
      [
        "Diekspor pada",
        new Date().toLocaleString("id-ID", { timeZone: APP_TIME_ZONE }),
      ],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    summarySheet["!cols"] = [
      { wch: 25 },
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, summarySheet, "Ringkasan");

    // Sheet 2: Detail Potongan
    const deductionRows = deductions.map((d, i) => ({
      "No.": i + 1,
      Instruktur: d.instructorName,
      "Tipe Potongan":
        d.deductionType === "pph21"
          ? "PPh 21"
          : d.deductionType === "pph23"
            ? "PPh 23"
            : "Lainnya",
      Keterangan: d.description,
      Jumlah: d.amount,
    }));
    const deductionSheet = XLSX.utils.json_to_sheet(
      deductionRows.length > 0
        ? deductionRows
        : [
            {
              "No.": "",
              Instruktur: "",
              "Tipe Potongan": "",
              Keterangan: "",
              Jumlah: "",
            },
          ],
    );
    deductionSheet["!cols"] = [
      { wch: 5 },
      { wch: 25 },
      { wch: 18 },
      { wch: 30 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, deductionSheet, "Potongan");

    // Sheet 3: Detail per Sesi
    const itemRows = detail.items.map((item, i) => ({
      "No.": i + 1,
      Tanggal: item.scheduledDate,
      Program: item.programName,
      Instruktur: item.paidInstructorName,
      Sumber: item.source === "actual" ? "Substitusi" : "Planned",
      Materi: item.materiBlock,
      Level: item.expertiseLevelSnapshot,
      Rate: item.rateSnapshot,
      Amount: item.amount,
    }));
    const itemSheet = XLSX.utils.json_to_sheet(itemRows);
    itemSheet["!cols"] = [
      { wch: 5 },
      { wch: 14 },
      { wch: 18 },
      { wch: 25 },
      { wch: 12 },
      { wch: 20 },
      { wch: 10 },
      { wch: 14 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, itemSheet, "Detail Sesi");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const xlsxBase64 = Buffer.from(buffer).toString("base64");

    const fileName = `honorarium-${detail.batch.documentNumber.toLowerCase()}-${detail.batch.periodStart}-${detail.batch.periodEnd}.xlsx`;

    await db.insert(honorariumAuditLogs).values({
      id: nanoid(),
      batchId: detail.batch.id,
      actorId: (await requireSession()).user.id,
      action: "batch_exported_excel",
      payload: { fileName },
    });

    return { ok: true, data: { fileName, xlsxBase64 } };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Gagal export Excel.",
    };
  }
}

export async function logHonorariumBatchPdfExport(
  data: z.infer<typeof exportPdfAuditSchema>,
) {
  await requirePermission("jadwalPelatihan", "view");
  const session = await requireSession();
  const parsed = exportPdfAuditSchema.parse(data);

  await db.insert(honorariumAuditLogs).values({
    id: nanoid(),
    batchId: parsed.batchId,
    actorId: session.user.id,
    action: "batch_exported_pdf",
    payload: { fileName: parsed.fileName },
  });

  revalidatePath(`/jadwal-otomatis/honorarium/${parsed.batchId}`);
  return { ok: true as const };
}
