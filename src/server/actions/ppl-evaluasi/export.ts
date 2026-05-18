"use server";

import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  pplKegiatan,
  pplKuesionerLink,
  pplKuesionerResponse,
  pplKuesionerTemplate,
} from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";
import type { FormField } from "@/components/ppl-evaluasi/form-builder/types";
import type { ActionResult, DashboardFilter } from "./types";
import {
  generateCsvContent,
  generateXlsxBuffer,
  generateProgramTahunanPdf,
  generateProgramTahunanXlsx,
  type ExportRow,
  type ProgramTahunanRow,
} from "@/server/lib/ppl-export";
import { computeConversionRate } from "@/lib/ppl-conversion-rate";
import { computePopularityScore } from "@/server/lib/ppl-analytics";

// â”€â”€â”€ TYPES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ExportFileResult {
  fileName: string;
  base64: string;
  mimeType: string;
}

// â”€â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function fetchResponsesForKegiatan(kegiatanId: number): Promise<{
  fields: FormField[];
  responses: ExportRow[];
  kegiatanNama: string;
} | null> {
  // Find the kegiatan
  const [kegiatan] = await db
    .select({ namaKegiatan: pplKegiatan.namaKegiatan })
    .from(pplKegiatan)
    .where(eq(pplKegiatan.id, kegiatanId))
    .limit(1);

  if (!kegiatan) {
    return null;
  }

  // Find the kuesioner link for this kegiatan
  const [link] = await db
    .select({
      id: pplKuesionerLink.id,
      templateId: pplKuesionerLink.templateId,
    })
    .from(pplKuesionerLink)
    .where(eq(pplKuesionerLink.kegiatanId, kegiatanId))
    .limit(1);

  if (!link) {
    return null;
  }

  // Fetch template config
  const [template] = await db
    .select({ configJson: pplKuesionerTemplate.configJson })
    .from(pplKuesionerTemplate)
    .where(eq(pplKuesionerTemplate.id, link.templateId))
    .limit(1);

  if (!template) {
    return null;
  }

  const fields = template.configJson as FormField[];

  // Fetch all responses
  const rows = await db
    .select({
      namaResponden: pplKuesionerResponse.namaResponden,
      emailResponden: pplKuesionerResponse.emailResponden,
      submittedAt: pplKuesionerResponse.submittedAt,
      answersJson: pplKuesionerResponse.answersJson,
    })
    .from(pplKuesionerResponse)
    .where(eq(pplKuesionerResponse.linkId, link.id));

  const responses: ExportRow[] = rows.map((r) => ({
    namaResponden: r.namaResponden,
    emailResponden: r.emailResponden,
    submittedAt: r.submittedAt,
    answersJson: r.answersJson as Record<string, unknown>,
  }));

  return { fields, responses, kegiatanNama: kegiatan.namaKegiatan };
}

// â”€â”€â”€ EXPORT RESPONSES CSV â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Export kuesioner responses for a Kegiatan as CSV with UTF-8 BOM.
 *
 * Requirements: 7.1, 7.3, 7.4, 7.6
 */
export async function exportResponsesCsv(
  kegiatanId: number,
): Promise<ActionResult<ExportFileResult>> {
  await requirePermission("pplEvaluasi", "export");

  const data = await fetchResponsesForKegiatan(kegiatanId);

  if (!data) {
    return { ok: false, error: "Kuesioner tidak ditemukan untuk kegiatan ini" };
  }

  // Req 7.6: Return error when zero responses
  if (data.responses.length === 0) {
    return {
      ok: false,
      error: "Tidak ada data respons untuk diekspor",
    };
  }

  const csvContent = generateCsvContent(data.fields, data.responses);
  const base64 = Buffer.from(csvContent, "utf-8").toString("base64");

  const safeNama = data.kegiatanNama.replace(/[^a-zA-Z0-9-_\s]/g, "").replace(/\s+/g, "_");
  return {
    ok: true,
    data: {
      fileName: `Evaluasi-${safeNama}.csv`,
      base64,
      mimeType: "text/csv;charset=utf-8",
    },
  };
}

// â”€â”€â”€ EXPORT RESPONSES XLSX â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Export kuesioner responses for a Kegiatan as XLSX with summary sheet.
 *
 * Requirements: 7.2, 7.3, 7.4, 7.5, 7.6
 */
export async function exportResponsesXlsx(
  kegiatanId: number,
): Promise<ActionResult<ExportFileResult>> {
  await requirePermission("pplEvaluasi", "export");

  const data = await fetchResponsesForKegiatan(kegiatanId);

  if (!data) {
    return { ok: false, error: "Kuesioner tidak ditemukan untuk kegiatan ini" };
  }

  // Req 7.6: Return error when zero responses
  if (data.responses.length === 0) {
    return {
      ok: false,
      error: "Tidak ada data respons untuk diekspor",
    };
  }

  const buffer = generateXlsxBuffer(data.fields, data.responses);
  const base64 = Buffer.from(buffer).toString("base64");

  const safeNama = data.kegiatanNama.replace(/[^a-zA-Z0-9-_\s]/g, "").replace(/\s+/g, "_");
  return {
    ok: true,
    data: {
      fileName: `Evaluasi-${safeNama}.xlsx`,
      base64,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  };
}

// â”€â”€â”€ EXPORT PROGRAM TAHUNAN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Export Program Tahunan recommendations as PDF or XLSX.
 *
 * Requirements: 9.5
 */
export async function exportProgramTahunan(
  filter: DashboardFilter,
  format: "pdf" | "xlsx",
): Promise<ActionResult<ExportFileResult>> {
  await requirePermission("pplEvaluasi", "export");

  // Fetch all kegiatan within the filter range
  const allKegiatan = await db
    .select({
      id: pplKegiatan.id,
      kategoriPpl: pplKegiatan.kategoriPpl,
      tanggalMulai: pplKegiatan.tanggalMulai,
      pendaftar: pplKegiatan.pendaftar,
      realisasiHadir: pplKegiatan.realisasiHadir,
    })
    .from(pplKegiatan);

  // Apply date filter
  const startDate = filter.startDate
    ? new Date(filter.startDate)
    : filter.year
      ? new Date(`${filter.year}-01-01`)
      : new Date(`${new Date().getFullYear()}-01-01`);

  const endDate = filter.endDate
    ? new Date(filter.endDate)
    : filter.year
      ? new Date(`${filter.year}-12-31`)
      : new Date(`${new Date().getFullYear()}-12-31`);

  const filteredKegiatan = allKegiatan.filter((k) => {
    const date = new Date(k.tanggalMulai);
    return date >= startDate && date <= endDate;
  });

  if (filteredKegiatan.length === 0) {
    return {
      ok: false,
      error: "Tidak ada data kegiatan untuk periode yang dipilih",
    };
  }

  // Group by kategori
  const byKategori = new Map<
    string,
    Array<{ month: number; pendaftar: number; realisasiHadir: number }>
  >();

  for (const k of filteredKegiatan) {
    const date = new Date(k.tanggalMulai);
    const month = date.getMonth(); // 0-11
    const entry = { month, pendaftar: k.pendaftar, realisasiHadir: k.realisasiHadir };

    const existing = byKategori.get(k.kategoriPpl) ?? [];
    existing.push(entry);
    byKategori.set(k.kategoriPpl, existing);
  }

  // Compute metrics per kategori
  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];

  const kategoriMetrics: Array<{
    kategori: string;
    avgAttendance: number;
    avgConversion: number;
    avgEvalScore: number;
  }> = [];

  for (const [kategori, entries] of byKategori) {
    const totalAttendance = entries.reduce((sum, e) => sum + e.realisasiHadir, 0);
    const avgAttendance = totalAttendance / entries.length;

    const conversionRates = entries
      .map((e) => computeConversionRate(e.pendaftar, e.realisasiHadir))
      .filter((r): r is number => r !== null);
    const avgConversion =
      conversionRates.length > 0
        ? conversionRates.reduce((sum, r) => sum + r, 0) / conversionRates.length
        : 0;

    // Eval score placeholder (would need actual evaluation data from analytics action)
    const avgEvalScore = 0;

    kategoriMetrics.push({ kategori, avgAttendance, avgConversion, avgEvalScore });
  }

  // Compute min/max for normalization
  const allAttendances = kategoriMetrics.map((m) => m.avgAttendance);
  const allConversions = kategoriMetrics.map((m) => m.avgConversion);
  const allEvalScores = kategoriMetrics.map((m) => m.avgEvalScore);

  const minAttendance = Math.min(...allAttendances);
  const maxAttendance = Math.max(...allAttendances);
  const minConversion = Math.min(...allConversions);
  const maxConversion = Math.max(...allConversions);
  const minEvalScore = Math.min(...allEvalScores);
  const maxEvalScore = Math.max(...allEvalScores);

  // Build program tahunan rows
  const programRows: ProgramTahunanRow[] = [];

  for (const [kategori, entries] of byKategori) {
    // Compute monthly averages
    const monthlyData = new Map<number, { totalHadir: number; count: number }>();
    for (const entry of entries) {
      const existing = monthlyData.get(entry.month) ?? { totalHadir: 0, count: 0 };
      existing.totalHadir += entry.realisasiHadir;
      existing.count += 1;
      monthlyData.set(entry.month, existing);
    }

    const monthlyAverages: Array<{ month: number; avg: number }> = [];
    for (const [month, mData] of monthlyData) {
      monthlyAverages.push({ month, avg: mData.totalHadir / mData.count });
    }

    // Recommended months: above median
    const allAvgs = monthlyAverages.map((m) => m.avg).sort((a, b) => a - b);
    let median = 0;
    if (allAvgs.length > 0) {
      const medianIdx = Math.floor(allAvgs.length / 2);
      if (allAvgs.length % 2 === 0) {
        median = ((allAvgs[medianIdx - 1] ?? 0) + (allAvgs[medianIdx] ?? 0)) / 2;
      } else {
        median = allAvgs[medianIdx] ?? 0;
      }
    }

    const recommendedMonths: string[] = monthlyAverages
      .filter((m) => m.avg > median)
      .sort((a, b) => b.avg - a.avg)
      .map((m) => monthNames[m.month] ?? `Bulan ${m.month + 1}`);

    // Metrics for this kategori
    const metrics = kategoriMetrics.find((m) => m.kategori === kategori);
    const avgAttendance = Math.round((metrics?.avgAttendance ?? 0) * 10) / 10;
    const avgConversion = Math.round((metrics?.avgConversion ?? 0) * 10) / 10;

    // Popularity score
    const popularityScore = computePopularityScore({
      avgAttendance: metrics?.avgAttendance ?? 0,
      avgConversion: metrics?.avgConversion ?? 0,
      avgEvalScore: metrics?.avgEvalScore ?? 0,
      minAttendance,
      maxAttendance,
      minConversion,
      maxConversion,
      minEvalScore,
      maxEvalScore,
    });

    // YoY change (simplified: compare current period vs previous period of same length)
    // Full YoY requires multi-year data which will be computed by the analytics action
    const yoyChange: number | null = null;
    const trendLabel: string | null = null;

    programRows.push({
      kategoriPpl: kategori,
      recommendedMonths: recommendedMonths.length > 0 ? recommendedMonths : ["Data tidak mencukupi"],
      avgAttendance,
      avgConversion,
      yoyChange,
      trendLabel,
      popularityScore,
    });
  }

  // Sort by popularity score descending
  programRows.sort((a, b) => b.popularityScore - a.popularityScore);

  // Generate file based on format
  if (format === "pdf") {
    const buffer = generateProgramTahunanPdf(programRows);
    const base64 = Buffer.from(buffer).toString("base64");
    return {
      ok: true,
      data: {
        fileName: `Program-Tahunan-PPL.pdf`,
        base64,
        mimeType: "application/pdf",
      },
    };
  } else {
    const buffer = generateProgramTahunanXlsx(programRows);
    const base64 = Buffer.from(buffer).toString("base64");
    return {
      ok: true,
      data: {
        fileName: `Program-Tahunan-PPL.xlsx`,
        base64,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    };
  }
}
