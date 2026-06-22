"use server";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  requireCapability,
  requirePermission,
  requireSession,
} from "@/server/actions/auth";
import { db } from "@/server/db";
import { revalidateDashboardTag } from "@/server/actions/statistics";
import { DASHBOARD_TAGS } from "@/lib/dashboard-cache-tags";
import { getTodayIsoInJakarta } from "@/lib/utils";
import {
  honorariumAuditLogs,
  honorariumBatches,
  honorariumDeductions,
  honorariumItems,
  instructors,
  users,
} from "@/server/db/schema";
import {
  type HonorariumBatchStatus,
  type ExistingAssignmentRow,
  batchIdSchema,
  batchIdsSchema,
  batchStatusLabel,
  batchStatusLabelLoose,
  correctBatchPaymentSchema,
  formatCurrency,
  generateBatchSchema,
  generateFromSelectionSchema,
  markBatchPaidSchema,
  mergeNotes,
  nextHonorariumDocumentNumber,
  parsePaidDate,
  readObject,
  reopenBatchSchema,
  toNumber,
  isUniqueViolationOnHonorariumAssignment,
  addDaysToIsoDate,
} from "./honorarium-utils";
import { notifyHonorariumStatusTransition } from "./honorarium-notifications";
import {
  getHonorariumReport,
  getOutstandingHonorariumSessions,
  getEligibleRows,
} from "./honorarium-report";

// ─── INTERNAL HELPERS ─────────────────────────────────────────────────────────

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

// ─── TRANSITION ───────────────────────────────────────────────────────────────

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

// ─── EXPORTED WORKFLOW ACTIONS ────────────────────────────────────────────────

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

// ─── GENERATE BATCH ───────────────────────────────────────────────────────────

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

// ─── GENERATE BATCH FROM SELECTION ──────────────────────────────────────────

export async function generateHonorariumBatchFromSelection(
  data: z.infer<typeof generateFromSelectionSchema>,
) {
  const session = await requirePermission("jadwalPelatihan", "manage");
  const parsed = generateFromSelectionSchema.parse(data);

  const outstanding = await getOutstandingHonorariumSessions();
  const selectedSessions = outstanding.sessions.filter((s) =>
    parsed.assignmentIds.includes(s.assignmentId),
  );

  if (selectedSessions.length === 0) {
    return {
      ok: false as const,
      message: "Tidak ada sesi eligible dari yang dipilih. Pastikan sesi sudah selesai dan belum masuk batch.",
    };
  }

  const missingRateRows = selectedSessions.filter((s) => s.rateSource === "missing");
  if (missingRateRows.length > 0) {
    return {
      ok: false as const,
      message: `Draft gagal: ${missingRateRows.length} sesi belum punya tarif. Lengkapi master tarif terlebih dahulu.`,
    };
  }

  const existingAssignmentRows = await findExistingHonorariumAssignments(
    selectedSessions.map((s) => s.assignmentId),
  );
  if (existingAssignmentRows.length > 0) {
    const conflictDocs = summarizeConflictBatches(existingAssignmentRows)
      .map((r) => `${r.documentNumber} (${r.statusLabel})`)
      .slice(0, 3)
      .join(", ");
    return {
      ok: false as const,
      message: `Draft gagal: ${existingAssignmentRows.length} sesi sudah masuk batch lain (${conflictDocs}).`,
    };
  }

  const dates = selectedSessions.map((s) => s.scheduledDate).sort();
  const periodStart = dates[0]!;
  const periodEnd = dates[dates.length - 1]!;

  const batchId = nanoid();
  const documentNumber = nextHonorariumDocumentNumber();

  await db.insert(honorariumBatches).values({
    id: batchId,
    documentNumber,
    periodStart,
    periodEnd,
    status: "draft",
    generatedBy: session.user.id,
    internalNotes: parsed.internalNotes || null,
  });

  try {
    await db.insert(honorariumItems).values(
      selectedSessions.map((s) => ({
        id: nanoid(),
        batchId,
        assignmentId: s.assignmentId,
        sessionId: s.sessionId,
        kelasId: s.kelasId,
        programId: s.programId,
        scheduledDate: s.scheduledDate,
        paidInstructorId: s.paidInstructorId,
        paidInstructorName: s.paidInstructorName,
        source: s.source,
        materiBlock: s.materiBlock,
        expertiseLevelSnapshot: s.expertiseLevel,
        rateSnapshot: s.totalAmount.toFixed(2),
        amount: s.totalAmount.toFixed(2),
      })),
    );
  } catch (error) {
    await db.delete(honorariumBatches).where(eq(honorariumBatches.id, batchId));
    if (isUniqueViolationOnHonorariumAssignment(error)) {
      return {
        ok: false as const,
        message: "Generate dibatalkan: beberapa sesi sudah masuk batch lain. Refresh dan coba lagi.",
      };
    }
    throw error;
  }

  await db.insert(honorariumAuditLogs).values({
    id: nanoid(),
    batchId,
    actorId: session.user.id,
    action: "generated_draft",
    payload: {
      periodStart,
      periodEnd,
      eligibleItemCount: selectedSessions.length,
      totalAmount: selectedSessions.reduce((sum, s) => sum + s.totalAmount, 0),
      source: "outstanding_selection",
    },
  });

  revalidatePath("/jadwal-otomatis/honorarium");
  return {
    ok: true as const,
    batchId,
    documentNumber,
    itemCount: selectedSessions.length,
    totalAmount: selectedSessions.reduce((sum, s) => sum + s.totalAmount, 0),
  };
}

// ─── DELETE BATCH ─────────────────────────────────────────────────────────────

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
