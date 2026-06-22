"use server";

import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import {
  requireCapability,
  requirePermission,
} from "@/server/actions/auth";
import { db } from "@/server/db";
import { getTodayIsoInJakarta } from "@/lib/utils";
import {
  honorariumAuditLogs,
  honorariumBatches,
  honorariumDeductions,
  honorariumItems,
  programs,
  users,
} from "@/server/db/schema";
import {
  type HonorariumBatchSortBy,
  addDaysToIsoDate,
  batchIdSchema,
  batchStatusLabelLoose,
  defaultDateRange,
  getWaitingDays,
  listBatchFilterSchema,
  listBatchPageSchema,
  readObject,
  toNumber,
} from "./honorarium-utils";

// ─── TYPES ────────────────────────────────────────────────────────────────────

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

export type HonorariumBatchPeriodSuggestion = {
  startDate: string;
  endDate: string;
  hasExistingBatch: boolean;
  sourceBatchId: string | null;
  sourceDocumentNumber: string | null;
  sourcePeriodEnd: string | null;
};

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

// ─── HELPERS ──────────────────────────────────────────────────────────────────

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

// ─── LIST BATCHES ─────────────────────────────────────────────────────────────

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
  await requirePermission("jadwalUjian", "view").catch(() =>
    requireCapability("keuangan:view"),
  );
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

// ─── BATCH DETAIL ─────────────────────────────────────────────────────────────

export async function getHonorariumBatchDetail(
  batchId: string,
): Promise<HonorariumBatchDetail | null> {
  await requirePermission("jadwalPelatihan", "view").catch(() =>
    requireCapability("keuangan:view"),
  );
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

// ─── SUGGESTED PERIOD ─────────────────────────────────────────────────────────

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

// ─── PREVIEW GENERATION ───────────────────────────────────────────────────────

export async function previewHonorariumBatchGeneration(
  data: z.infer<typeof import("./honorarium-utils").generateBatchSchema>,
): Promise<HonorariumGeneratePreview> {
  await requirePermission("jadwalPelatihan", "manage");
  const { generateBatchSchema } = await import("./honorarium-utils");
  const parsed = generateBatchSchema.parse(data);

  if (parsed.startDate > parsed.endDate) {
    throw new Error("Tanggal mulai harus <= tanggal akhir.");
  }

  const { getHonorariumReport, getEligibleRows } = await import("./honorarium-report");
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

  // Find existing assignments in batches
  const assignmentIds = eligibleRows.map((row) => row.assignmentId);
  let existingRows: Array<{ assignmentId: string; batchId: string; documentNumber: string; status: string }> = [];
  if (assignmentIds.length > 0) {
    existingRows = await db
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

  // Summarize conflict batches
  const byBatch = new Map<string, { batchId: string; documentNumber: string; status: string; statusLabel: string }>();
  for (const row of existingRows) {
    if (byBatch.has(row.batchId)) continue;
    byBatch.set(row.batchId, {
      batchId: row.batchId,
      documentNumber: row.documentNumber,
      status: row.status,
      statusLabel: batchStatusLabelLoose(row.status),
    });
  }
  const conflictingBatches = Array.from(byBatch.values()).sort((a, b) =>
    b.documentNumber.localeCompare(a.documentNumber),
  );

  return {
    period: { startDate: parsed.startDate, endDate: parsed.endDate },
    eligibleCount: eligibleRows.length,
    missingRateCount: missingRateRows.length,
    conflictingAssignmentCount: existingRows.length,
    conflictingBatches,
  };
}
