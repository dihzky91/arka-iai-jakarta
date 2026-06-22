"use server";

import { nanoid } from "nanoid";
import { z } from "zod";
import { requirePermission, requireSession } from "@/server/actions/auth";
import { db } from "@/server/db";
import { honorariumAuditLogs } from "@/server/db/schema";
import { revalidatePath } from "next/cache";
import { APP_TIME_ZONE } from "@/lib/utils";
import {
  type HonorariumBatchStatus,
  batchStatusLabelLoose,
  defaultDateRange,
  exportPdfAuditSchema,
  financeRecapFilterSchema,
  toNumber,
} from "./honorarium-utils";
import { getHonorariumBatchDetail, listHonorariumBatchesPage } from "./honorarium-batch-crud";
import { listHonorariumDeductions } from "./honorarium-deductions";

// ─── TYPES ────────────────────────────────────────────────────────────────────

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

type ExportExcelResult =
  | { ok: true; data: { fileName: string; xlsxBase64: string } }
  | { ok: false; error: string };

type FinanceExportExcelResult =
  | { ok: true; data: { fileName: string; xlsxBase64: string } }
  | { ok: false; error: string };

// ─── FINANCE RECAP ────────────────────────────────────────────────────────────

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

  const { and, desc, eq, inArray } = await import("drizzle-orm");
  const { honorariumItems, honorariumDeductions, honorariumAuditLogs: auditLogs } = await import("@/server/db/schema");
  const { sql } = await import("drizzle-orm");

  const batchIds = batches.map((row) => row.id);
  const [paymentLogs, instructorRows, deductionRows] = await Promise.all([
    db
      .select({
        batchId: auditLogs.batchId,
        payload: auditLogs.payload,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(
        and(
          inArray(auditLogs.batchId, batchIds),
          inArray(auditLogs.action, [
            "finance_paid",
            "finance_payment_corrected",
          ]),
        ),
      )
      .orderBy(desc(auditLogs.createdAt)),
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
      deductionByBatchInstructor.get(`${row.batchId}::${row.instructorId}`) ?? 0;
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

  // Read payment info from audit logs
  function readObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  }

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

// ─── FINANCE RECAP EXCEL ──────────────────────────────────────────────────────

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
      ["Periode Filter", `${recap.filters.startDate} s.d. ${recap.filters.endDate}`],
      ["Status Filter", recap.filters.status === "all" ? "Semua Status" : recap.filters.status],
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
      ["Diekspor pada", new Date().toLocaleString("id-ID", { timeZone: APP_TIME_ZONE })],
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
    XLSX.utils.book_append_sheet(wb, detailSheet, "Detail Batch");

    const instructorSheetRows = recap.instructorRecaps.map((row, index) => ({
      "No.": index + 1,
      Instruktur: row.instructorName,
      Batch: row.batchCount,
      Sesi: row.sessionCount,
      Gross: row.grossAmount,
      Potongan: row.deductionAmount,
      Net: row.netAmount,
    }));
    const instructorSheet = XLSX.utils.json_to_sheet(
      instructorSheetRows.length > 0
        ? instructorSheetRows
        : [{ "No.": "", Instruktur: "" }],
    );
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

// ─── BATCH EXCEL EXPORT ───────────────────────────────────────────────────────

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
      ["Diekspor pada", new Date().toLocaleString("id-ID", { timeZone: APP_TIME_ZONE })],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
    summarySheet["!cols"] = [{ wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, summarySheet, "Ringkasan");

    // Sheet 2: Detail Potongan
    const deductionSheetRows = deductions.map((d, i) => ({
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
      deductionSheetRows.length > 0
        ? deductionSheetRows
        : [{ "No.": "", Instruktur: "", "Tipe Potongan": "", Keterangan: "", Jumlah: "" }],
    );
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

// ─── PDF AUDIT LOG ────────────────────────────────────────────────────────────

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
