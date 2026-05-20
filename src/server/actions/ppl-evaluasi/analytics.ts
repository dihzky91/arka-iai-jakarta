"use server";

import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/server/db";
import {
  pplKegiatan,
  pplKuesionerLink,
  pplKuesionerResponse,
  pplKuesionerTemplate,
  pplKegiatanNarasumber,
  pplNarasumber,
} from "@/server/db/schema";
import {
  computeScaleAnalytics,
  computeGridAnalytics,
  computeChoiceAnalytics,
  computePopularityScore,
} from "@/server/lib/ppl-analytics";
import { computeConversionRate } from "@/lib/ppl-conversion-rate";
import { requirePermission } from "@/server/actions/auth";
import type {
  FormField,
  GridConfig,
  NarasumberSectionConfig,
  OptionsConfig,
} from "@/components/ppl-evaluasi/form-builder/types";
import type { GridResponse } from "@/server/lib/ppl-analytics";
import type {
  DashboardFilter,
  SpeakerFilter,
  FieldAnalyticsResult,
  AttendanceDashboardData,
  CategoryMonthData,
  CategoryRanking,
  YoYComparison,
  YoYMonthlyDetail,
  PatternAnalysisData,
  CategoryPattern,
  TopMonth,
  SpeakerPerformanceData,
  SpeakerPerformanceRow,
  SpeakerScoreTrend,
  NarasumberScore,
  NarasumberFieldScore,
  KegiatanEvaluationSummary,
  KategoriPpl,
} from "./types";

// â”€â”€â”€ HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getDateRange(filter: DashboardFilter): { startDate: string; endDate: string } {
  if (filter.startDate && filter.endDate) {
    return { startDate: filter.startDate, endDate: filter.endDate };
  }
  const year = filter.year ?? new Date().getFullYear();
  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
  };
}


// â”€â”€â”€ GET FIELD ANALYTICS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// ─── GET NARASUMBER SCORES ────────────────────────────────────────────────────

/**
 * Compute per-narasumber evaluation scores from narasumber_section fields.
 * Parses answers stored in format "narasumber_{id}_{fieldIndex}" and groups by narasumber.
 */
export async function getNarasumberScores(
  kegiatanId: number,
): Promise<NarasumberScore[]> {
  await requirePermission("pplEvaluasi", "view");

  const [link] = await db
    .select({
      id: pplKuesionerLink.id,
      templateId: pplKuesionerLink.templateId,
    })
    .from(pplKuesionerLink)
    .where(eq(pplKuesionerLink.kegiatanId, kegiatanId))
    .limit(1);

  if (!link) return [];

  const [template] = await db
    .select({ configJson: pplKuesionerTemplate.configJson })
    .from(pplKuesionerTemplate)
    .where(eq(pplKuesionerTemplate.id, link.templateId))
    .limit(1);

  if (!template) return [];

  const fields = template.configJson as FormField[];

  // Find narasumber_section fields and their configs
  const narasumberFields = fields.filter((f) => f.type === "narasumber_section");
  if (narasumberFields.length === 0) return [];

  // Fetch narasumber assignments for this kegiatan
  const assignments = await db
    .select({
      narasumberId: pplKegiatanNarasumber.narasumberId,
      nama: pplNarasumber.nama,
      topik: pplKegiatanNarasumber.topik,
    })
    .from(pplKegiatanNarasumber)
    .innerJoin(
      pplNarasumber,
      eq(pplKegiatanNarasumber.narasumberId, pplNarasumber.id),
    )
    .where(eq(pplKegiatanNarasumber.kegiatanId, kegiatanId));

  // Fetch all responses for this link
  const responses = await db
    .select({ answersJson: pplKuesionerResponse.answersJson })
    .from(pplKuesionerResponse)
    .where(eq(pplKuesionerResponse.linkId, link.id));

  if (responses.length === 0) return [];

  const result: NarasumberScore[] = [];

  for (const nars of assignments) {
    const narasumberScore: NarasumberScore = {
      narasumberId: nars.narasumberId,
      nama: nars.nama,
      topik: nars.topik,
      avgScore: 0,
      fieldScores: [],
      respondenCount: 0,
    };

    // Collect answers for this narasumber
    const narasumberAnswers = responses.map((resp) => {
      const answers = resp.answersJson as Record<string, unknown>;
      const narasumberAnswer: Record<string, unknown> = {};
      for (const field of narasumberFields) {
        const config = field.config as NarasumberSectionConfig | null;
        if (!config?.fields) continue;
        for (let fi = 0; fi < config.fields.length; fi++) {
          const key = `narasumber_${nars.narasumberId}_${fi}`;
          narasumberAnswer[String(fi)] = answers[key];
        }
      }
      return narasumberAnswer;
    });

    const nonEmptyAnswers = narasumberAnswers.filter(
      (a) => Object.values(a).some((v) => v !== undefined && v !== null),
    );
    narasumberScore.respondenCount = nonEmptyAnswers.length;

    // Compute per-field scores
    for (const field of narasumberFields) {
      const config = field.config as NarasumberSectionConfig | null;
      if (!config?.fields) continue;

      for (let fi = 0; fi < config.fields.length; fi++) {
        const subField = config.fields[fi];
        if (!subField) continue;
        const values: number[] = [];

        for (const ans of nonEmptyAnswers) {
          const val = ans[String(fi)];
          if (val !== undefined && val !== null) {
            const num = Number(val);
            if (!isNaN(num)) values.push(num);
          }
        }

        if (values.length > 0) {
          const sorted = [...values].sort((a, b) => a - b);
          const mean = values.reduce((s, v) => s + v, 0) / values.length;
          const mid = Math.floor(sorted.length / 2);
          const median =
            sorted.length % 2 === 0
              ? (sorted[mid - 1]! + sorted[mid]!) / 2
              : sorted[mid]!;

          const distribution: Record<number, number> = {};
          for (const v of values) {
            distribution[v] = (distribution[v] ?? 0) + 1;
          }

          narasumberScore.fieldScores.push({
            label: subField.label,
            avg: Math.round(mean * 100) / 100,
            median: Math.round(median * 100) / 100,
            distribution,
          });
        }
      }
    }

    // Compute overall avgScore (average of all scale field averages)
    if (narasumberScore.fieldScores.length > 0) {
      const totalAvg = narasumberScore.fieldScores.reduce(
        (s, fs) => s + fs.avg,
        0,
      );
      narasumberScore.avgScore =
        Math.round((totalAvg / narasumberScore.fieldScores.length) * 100) / 100;
    }

    result.push(narasumberScore);
  }

  return result;
}

/**
 * Get full evaluation summary for a kegiatan including overall and per-narasumber scores.
 */
export async function getKegiatanEvaluationSummary(
  kegiatanId: number,
): Promise<KegiatanEvaluationSummary | null> {
  await requirePermission("pplEvaluasi", "view");

  const [link] = await db
    .select({
      id: pplKuesionerLink.id,
      templateId: pplKuesionerLink.templateId,
    })
    .from(pplKuesionerLink)
    .where(eq(pplKuesionerLink.kegiatanId, kegiatanId))
    .limit(1);

  if (!link) return null;

  const [template] = await db
    .select({ configJson: pplKuesionerTemplate.configJson })
    .from(pplKuesionerTemplate)
    .where(eq(pplKuesionerTemplate.id, link.templateId))
    .limit(1);

  if (!template) return null;

  const [kegiatan] = await db
    .select({ realisasiHadir: pplKegiatan.realisasiHadir })
    .from(pplKegiatan)
    .where(eq(pplKegiatan.id, kegiatanId))
    .limit(1);

  const fields = template.configJson as FormField[];

  const responses = await db
    .select({ answersJson: pplKuesionerResponse.answersJson })
    .from(pplKuesionerResponse)
    .where(eq(pplKuesionerResponse.linkId, link.id));

  const totalResponden = responses.length;

  // Compute overall score (average of all non-narasumber scale fields)
  let overallTotal = 0;
  let overallCount = 0;

  for (const resp of responses) {
    const answers = resp.answersJson as Record<string, unknown>;
    for (const field of fields) {
      if (field.type === "narasumber_section") continue;
      if (field.type !== "scale") continue;
      const val = answers[field.id];
      if (val !== undefined && val !== null) {
        const num = Number(val);
        if (!isNaN(num)) {
          overallTotal += num;
          overallCount += 1;
        }
      }
    }
  }

  const overallScore =
    overallCount > 0
      ? Math.round((overallTotal / overallCount) * 100) / 100
      : 0;

  const narasumberScores = await getNarasumberScores(kegiatanId);

  const responseRate =
    kegiatan && kegiatan.realisasiHadir > 0
      ? Math.round((totalResponden / kegiatan.realisasiHadir) * 1000) / 10
      : 0;

  return {
    kegiatanId,
    overallScore,
    narasumberScores,
    totalResponden,
    responseRate,
  };
}

/**
 * Compute per-field analytics for a specific kegiatan.
 * Fetches all responses, then computes analytics per field using the
 * appropriate computation function based on field type.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */
export async function getFieldAnalytics(
  kegiatanId: number,
): Promise<FieldAnalyticsResult[]> {
  await requirePermission("pplEvaluasi", "view");

  // Find the kuesioner link for this kegiatan
  const [link] = await db
    .select({
      id: pplKuesionerLink.id,
      templateId: pplKuesionerLink.templateId,
    })
    .from(pplKuesionerLink)
    .where(eq(pplKuesionerLink.kegiatanId, kegiatanId))
    .limit(1);

  if (!link) return [];

  // Fetch template config
  const [template] = await db
    .select({ configJson: pplKuesionerTemplate.configJson })
    .from(pplKuesionerTemplate)
    .where(eq(pplKuesionerTemplate.id, link.templateId))
    .limit(1);

  if (!template) return [];

  const fields = template.configJson as FormField[];

  // Fetch all responses for this link
  const responses = await db
    .select({ answersJson: pplKuesionerResponse.answersJson })
    .from(pplKuesionerResponse)
    .where(eq(pplKuesionerResponse.linkId, link.id));

  if (responses.length === 0) return [];

  const results: FieldAnalyticsResult[] = [];

  for (const field of fields) {
    switch (field.type) {
      case "scale": {
        const values: number[] = [];
        for (const resp of responses) {
          const answers = resp.answersJson as Record<string, unknown>;
          const val = answers[field.id];
          if (val !== undefined && val !== null && typeof val === "number") {
            values.push(val);
          } else if (val !== undefined && val !== null) {
            const parsed = Number(val);
            if (!isNaN(parsed)) values.push(parsed);
          }
        }
        if (values.length > 0) {
          const analytics = computeScaleAnalytics(values);
          results.push({
            type: "scale",
            fieldId: field.id,
            label: field.label,
            mean: analytics.mean,
            median: analytics.median,
            stdDev: analytics.stdDev,
            distribution: analytics.distribution,
            totalResponses: values.length,
          });
        }
        break;
      }

      case "grid": {
        const config = field.config as GridConfig | null;
        if (!config) break;

        const gridResponses: GridResponse[] = [];
        for (const resp of responses) {
          const answers = resp.answersJson as Record<string, unknown>;
          const val = answers[field.id];
          if (val && typeof val === "object" && !Array.isArray(val)) {
            // Convert row indices to row labels for computeGridAnalytics
            const gridAnswer: GridResponse = {};
            const rawAnswer = val as Record<string, unknown>;
            for (const [key, value] of Object.entries(rawAnswer)) {
              // key could be row index (0-based) or row label
              const rowIndex = Number(key);
              if (!isNaN(rowIndex) && rowIndex < config.rows.length) {
                const rowLabel = config.rows[rowIndex] as string;
                gridAnswer[rowLabel] = Number(value);
              } else {
                // key is already a row label
                gridAnswer[key] = Number(value);
              }
            }
            gridResponses.push(gridAnswer);
          }
        }
        if (gridResponses.length > 0) {
          const analytics = computeGridAnalytics(gridResponses, config);
          results.push({
            type: "grid",
            fieldId: field.id,
            label: field.label,
            rows: analytics.rows,
            totalResponses: gridResponses.length,
          });
        }
        break;
      }

      case "radio":
      case "select": {
        const config = field.config as OptionsConfig | null;
        if (!config) break;

        const choiceResponses: string[][] = [];
        for (const resp of responses) {
          const answers = resp.answersJson as Record<string, unknown>;
          const val = answers[field.id];
          if (val !== undefined && val !== null) {
            choiceResponses.push([String(val)]);
          }
        }
        if (choiceResponses.length > 0) {
          const analytics = computeChoiceAnalytics(
            choiceResponses,
            config.options,
            false,
          );
          results.push({
            type: "choice",
            choiceType: field.type as "radio" | "select",
            fieldId: field.id,
            label: field.label,
            options: analytics.options,
            totalResponses: choiceResponses.length,
          });
        }
        break;
      }

      case "checkbox": {
        const config = field.config as OptionsConfig | null;
        if (!config) break;

        const checkboxResponses: string[][] = [];
        for (const resp of responses) {
          const answers = resp.answersJson as Record<string, unknown>;
          const val = answers[field.id];
          if (Array.isArray(val)) {
            checkboxResponses.push(val.map(String));
          }
        }
        if (checkboxResponses.length > 0) {
          const analytics = computeChoiceAnalytics(
            checkboxResponses,
            config.options,
            true,
          );
          results.push({
            type: "choice",
            choiceType: "checkbox",
            fieldId: field.id,
            label: field.label,
            options: analytics.options,
            totalResponses: checkboxResponses.length,
          });
        }
        break;
      }

      case "text":
      case "textarea": {
        const textResponses: string[] = [];
        for (const resp of responses) {
          const answers = resp.answersJson as Record<string, unknown>;
          const val = answers[field.id];
          if (val !== undefined && val !== null && String(val).trim().length > 0) {
            textResponses.push(String(val));
          }
        }
        if (textResponses.length > 0) {
          results.push({
            type: "text",
            fieldId: field.id,
            label: field.label,
            responses: textResponses,
            totalResponses: textResponses.length,
          });
        }
        break;
      }

      case "narasumber_section": {
        // Skip — narasumber_section is handled by getNarasumberScores
        // to avoid double-counting in overall field analytics
        break;
      }

      // number and email fields treated as text for analytics
      case "number":
      case "email": {
        const textResponses: string[] = [];
        for (const resp of responses) {
          const answers = resp.answersJson as Record<string, unknown>;
          const val = answers[field.id];
          if (val !== undefined && val !== null && String(val).trim().length > 0) {
            textResponses.push(String(val));
          }
        }
        if (textResponses.length > 0) {
          results.push({
            type: "text",
            fieldId: field.id,
            label: field.label,
            responses: textResponses,
            totalResponses: textResponses.length,
          });
        }
        break;
      }
    }
  }

  return results;
}


// â”€â”€â”€ GET ATTENDANCE DASHBOARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Aggregate kegiatan data by kategori and month for the attendance dashboard.
 * Computes trends, conversion rates, category rankings, and YoY comparisons.
 *
 * Requirements: 8.1, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8
 */
export async function getAttendanceDashboard(
  filter: DashboardFilter = {},
): Promise<AttendanceDashboardData> {
  await requirePermission("pplEvaluasi", "view");

  const { startDate, endDate } = getDateRange(filter);

  // Fetch all kegiatan within the date range
  const kegiatanRows = await db
    .select({
      id: pplKegiatan.id,
      kategoriPpl: pplKegiatan.kategoriPpl,
      tanggalMulai: pplKegiatan.tanggalMulai,
      pendaftar: pplKegiatan.pendaftar,
      realisasiHadir: pplKegiatan.realisasiHadir,
    })
    .from(pplKegiatan)
    .where(
      and(
        gte(pplKegiatan.tanggalMulai, startDate),
        lte(pplKegiatan.tanggalMulai, endDate),
        eq(pplKegiatan.statusEvent, "aktif"),
      ),
    );

  // Build category-month aggregation
  const categoryMonthMap = new Map<string, CategoryMonthData>();

  for (const row of kegiatanRows) {
    const month = row.tanggalMulai.substring(0, 7); // "YYYY-MM"
    const key = `${row.kategoriPpl}|${month}`;

    const existing = categoryMonthMap.get(key);
    if (existing) {
      existing.kegiatanCount += 1;
      existing.totalHadir += row.realisasiHadir;
    } else {
      categoryMonthMap.set(key, {
        kategori: row.kategoriPpl as KategoriPpl,
        month,
        kegiatanCount: 1,
        totalHadir: row.realisasiHadir,
        avgConversionRate: null, // computed below
      });
    }
  }

  // Compute avg conversion rate per category-month
  const categoryMonthConversions = new Map<string, { totalConversion: number; count: number }>();
  for (const row of kegiatanRows) {
    const month = row.tanggalMulai.substring(0, 7);
    const key = `${row.kategoriPpl}|${month}`;
    const rate = computeConversionRate(row.pendaftar, row.realisasiHadir);
    if (rate !== null) {
      const existing = categoryMonthConversions.get(key);
      if (existing) {
        existing.totalConversion += rate;
        existing.count += 1;
      } else {
        categoryMonthConversions.set(key, { totalConversion: rate, count: 1 });
      }
    }
  }

  for (const [key, data] of categoryMonthMap) {
    const convData = categoryMonthConversions.get(key);
    if (convData && convData.count > 0) {
      data.avgConversionRate =
        Math.round((convData.totalConversion / convData.count) * 10) / 10;
    }
  }

  const categoryMonthData = Array.from(categoryMonthMap.values());

  // Build category ranking (sorted by total hadir descending)
  const categoryTotals = new Map<
    string,
    { totalHadir: number; kegiatanCount: number; conversionSum: number; conversionCount: number }
  >();

  for (const row of kegiatanRows) {
    const existing = categoryTotals.get(row.kategoriPpl);
    const rate = computeConversionRate(row.pendaftar, row.realisasiHadir);
    if (existing) {
      existing.totalHadir += row.realisasiHadir;
      existing.kegiatanCount += 1;
      if (rate !== null) {
        existing.conversionSum += rate;
        existing.conversionCount += 1;
      }
    } else {
      categoryTotals.set(row.kategoriPpl, {
        totalHadir: row.realisasiHadir,
        kegiatanCount: 1,
        conversionSum: rate ?? 0,
        conversionCount: rate !== null ? 1 : 0,
      });
    }
  }

  const categoryRanking: CategoryRanking[] = Array.from(categoryTotals.entries())
    .map(([kategori, data]) => ({
      kategori: kategori as KategoriPpl,
      totalHadir: data.totalHadir,
      kegiatanCount: data.kegiatanCount,
      avgConversionRate:
        data.conversionCount > 0
          ? Math.round((data.conversionSum / data.conversionCount) * 10) / 10
          : null,
    }))
    .sort((a, b) => b.totalHadir - a.totalHadir);

  // Build YoY comparison â€” fetch previous year data separately
  const previousYear = parseInt(startDate.substring(0, 4)) - 1;
  const prevStartDate = `${previousYear}-01-01`;
  const prevEndDate = `${previousYear}-12-31`;

  const previousYearRows = await db
    .select({
      id: pplKegiatan.id,
      kategoriPpl: pplKegiatan.kategoriPpl,
      tanggalMulai: pplKegiatan.tanggalMulai,
      pendaftar: pplKegiatan.pendaftar,
      realisasiHadir: pplKegiatan.realisasiHadir,
    })
    .from(pplKegiatan)
    .where(
      and(
        gte(pplKegiatan.tanggalMulai, prevStartDate),
        lte(pplKegiatan.tanggalMulai, prevEndDate),
        eq(pplKegiatan.statusEvent, "aktif"),
      ),
    );

  const yoyComparison = buildYoYComparison(
    [...kegiatanRows, ...previousYearRows],
    startDate,
    endDate,
  );

  return {
    categoryMonthData,
    categoryRanking,
    yoyComparison,
    period: { startDate, endDate },
  };
}

/**
 * Build year-over-year comparison data.
 * Compares the current period's year with the previous year.
 * Includes monthly breakdown for granular trend analysis.
 */
function buildYoYComparison(
  kegiatanRows: Array<{
    kategoriPpl: string;
    tanggalMulai: string;
    pendaftar: number;
    realisasiHadir: number;
  }>,
  startDate: string,
  endDate: string,
): YoYComparison[] {
  const currentYear = parseInt(startDate.substring(0, 4));
  const previousYear = currentYear - 1;

  // Group by year and kategori (totals)
  const yearCategoryMap = new Map<
    string,
    { totalHadir: number; kegiatanCount: number; conversionSum: number; conversionCount: number }
  >();

  // Group by year, kategori, and month (for monthly breakdown)
  const yearCategoryMonthMap = new Map<
    string,
    { totalHadir: number; kegiatanCount: number }
  >();

  for (const row of kegiatanRows) {
    const rowYear = parseInt(row.tanggalMulai.substring(0, 4));
    if (rowYear !== currentYear && rowYear !== previousYear) continue;

    const key = `${rowYear}|${row.kategoriPpl}`;
    const rate = computeConversionRate(row.pendaftar, row.realisasiHadir);

    // Aggregate totals
    const existing = yearCategoryMap.get(key);
    if (existing) {
      existing.totalHadir += row.realisasiHadir;
      existing.kegiatanCount += 1;
      if (rate !== null) {
        existing.conversionSum += rate;
        existing.conversionCount += 1;
      }
    } else {
      yearCategoryMap.set(key, {
        totalHadir: row.realisasiHadir,
        kegiatanCount: 1,
        conversionSum: rate ?? 0,
        conversionCount: rate !== null ? 1 : 0,
      });
    }

    // Aggregate monthly
    const monthNum = parseInt(row.tanggalMulai.substring(5, 7));
    const monthKey = `${rowYear}|${row.kategoriPpl}|${monthNum}`;
    const existingMonth = yearCategoryMonthMap.get(monthKey);
    if (existingMonth) {
      existingMonth.totalHadir += row.realisasiHadir;
      existingMonth.kegiatanCount += 1;
    } else {
      yearCategoryMonthMap.set(monthKey, {
        totalHadir: row.realisasiHadir,
        kegiatanCount: 1,
      });
    }
  }

  // Build comparison for each kategori
  const allKategori = new Set<string>();
  for (const row of kegiatanRows) {
    const rowYear = parseInt(row.tanggalMulai.substring(0, 4));
    if (rowYear === currentYear || rowYear === previousYear) {
      allKategori.add(row.kategoriPpl);
    }
  }

  const comparisons: YoYComparison[] = [];

  for (const kategori of allKategori) {
    const currentData = yearCategoryMap.get(`${currentYear}|${kategori}`);
    const previousData = yearCategoryMap.get(`${previousYear}|${kategori}`);

    if (!currentData && !previousData) continue;

    const currentTotalHadir = currentData?.totalHadir ?? 0;
    const previousTotalHadir = previousData?.totalHadir ?? 0;
    const currentKegiatanCount = currentData?.kegiatanCount ?? 0;
    const previousKegiatanCount = previousData?.kegiatanCount ?? 0;

    const currentAvgConversion =
      currentData && currentData.conversionCount > 0
        ? Math.round((currentData.conversionSum / currentData.conversionCount) * 10) / 10
        : null;
    const previousAvgConversion =
      previousData && previousData.conversionCount > 0
        ? Math.round((previousData.conversionSum / previousData.conversionCount) * 10) / 10
        : null;

    const hadirChangePercent =
      previousTotalHadir > 0
        ? Math.round(((currentTotalHadir - previousTotalHadir) / previousTotalHadir) * 1000) / 10
        : null;

    const kegiatanChangePercent =
      previousKegiatanCount > 0
        ? Math.round(((currentKegiatanCount - previousKegiatanCount) / previousKegiatanCount) * 1000) / 10
        : null;

    const conversionChange =
      previousAvgConversion !== null && currentAvgConversion !== null
        ? Math.round((currentAvgConversion - previousAvgConversion) * 10) / 10
        : null;

    // Build monthly details (1-12)
    const monthlyDetails: YoYMonthlyDetail[] = [];
    for (let month = 1; month <= 12; month++) {
      const currentMonthData = yearCategoryMonthMap.get(`${currentYear}|${kategori}|${month}`);
      const previousMonthData = yearCategoryMonthMap.get(`${previousYear}|${kategori}|${month}`);

      // Only include months that have data in at least one year
      if (!currentMonthData && !previousMonthData) continue;

      const currentHadir = currentMonthData?.totalHadir ?? 0;
      const previousHadir = previousMonthData?.totalHadir ?? 0;
      const monthHadirChange =
        previousHadir > 0
          ? Math.round(((currentHadir - previousHadir) / previousHadir) * 1000) / 10
          : null;

      monthlyDetails.push({
        month,
        currentHadir,
        previousHadir,
        hadirChangePercent: monthHadirChange,
        currentKegiatanCount: currentMonthData?.kegiatanCount ?? 0,
        previousKegiatanCount: previousMonthData?.kegiatanCount ?? 0,
      });
    }

    comparisons.push({
      kategori: kategori as KategoriPpl,
      currentYear,
      previousYear,
      currentTotalHadir,
      previousTotalHadir,
      currentKegiatanCount,
      previousKegiatanCount,
      currentAvgConversion,
      previousAvgConversion,
      hadirChangePercent,
      kegiatanChangePercent,
      conversionChange,
      monthlyDetails,
    });
  }

  return comparisons;
}


// â”€â”€â”€ GET PATTERN ANALYSIS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Analyze historical patterns for annual program planning.
 * Identifies top months per kategori, recommended months (above median),
 * YoY trends, and popularity scores.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.6
 */
export async function getPatternAnalysis(
  filter: DashboardFilter = {},
): Promise<PatternAnalysisData> {
  await requirePermission("pplEvaluasi", "view");

  const { startDate, endDate } = getDateRange(filter);

  // Fetch all kegiatan (use all historical data for pattern analysis)
  const kegiatanRows = await db
    .select({
      id: pplKegiatan.id,
      kategoriPpl: pplKegiatan.kategoriPpl,
      tanggalMulai: pplKegiatan.tanggalMulai,
      tanggalSelesai: pplKegiatan.tanggalSelesai,
      pendaftar: pplKegiatan.pendaftar,
      realisasiHadir: pplKegiatan.realisasiHadir,
      skp: pplKegiatan.skp,
    })
    .from(pplKegiatan)
    .where(eq(pplKegiatan.statusEvent, "aktif"));

  // Group by kategori
  const kategoriMap = new Map<
    string,
    Array<{
      tanggalMulai: string;
      tanggalSelesai: string;
      pendaftar: number;
      realisasiHadir: number;
    }>
  >();

  for (const row of kegiatanRows) {
    const existing = kategoriMap.get(row.kategoriPpl) ?? [];
    existing.push({
      tanggalMulai: row.tanggalMulai,
      tanggalSelesai: row.tanggalSelesai,
      pendaftar: row.pendaftar,
      realisasiHadir: row.realisasiHadir,
    });
    kategoriMap.set(row.kategoriPpl, existing);
  }

  // Compute average evaluation scores per kategori (for popularity score)
  const kategoriEvalScores = await getKategoriEvalScores();

  // Compute min/max across all categories for normalization
  const allAvgAttendance: number[] = [];
  const allAvgConversion: number[] = [];
  const allAvgEvalScore: number[] = [];

  const kategoriMetrics = new Map<
    string,
    { avgAttendance: number; avgConversion: number; avgEvalScore: number }
  >();

  for (const [kategori, rows] of kategoriMap) {
    const avgAttendance =
      rows.length > 0
        ? rows.reduce((sum, r) => sum + r.realisasiHadir, 0) / rows.length
        : 0;

    const conversions = rows
      .map((r) => computeConversionRate(r.pendaftar, r.realisasiHadir))
      .filter((c): c is number => c !== null);
    const avgConversion =
      conversions.length > 0
        ? conversions.reduce((sum, c) => sum + c, 0) / conversions.length
        : 0;

    const avgEvalScore = kategoriEvalScores.get(kategori) ?? 0;

    kategoriMetrics.set(kategori, { avgAttendance, avgConversion, avgEvalScore });
    allAvgAttendance.push(avgAttendance);
    allAvgConversion.push(avgConversion);
    allAvgEvalScore.push(avgEvalScore);
  }

  const minAttendance = Math.min(...allAvgAttendance, 0);
  const maxAttendance = Math.max(...allAvgAttendance, 0);
  const minConversion = Math.min(...allAvgConversion, 0);
  const maxConversion = Math.max(...allAvgConversion, 0);
  const minEvalScore = Math.min(...allAvgEvalScore, 0);
  const maxEvalScore = Math.max(...allAvgEvalScore, 0);

  // Build patterns per kategori
  const patterns: CategoryPattern[] = [];

  for (const [kategori, rows] of kategoriMap) {
    // Determine distinct months with data
    const monthSet = new Set<string>();
    for (const row of rows) {
      monthSet.add(row.tanggalMulai.substring(0, 7));
    }
    const hasEnoughData = monthSet.size >= 12;

    // Group by month number (1-12) for pattern detection
    const monthData = new Map<number, { totalHadir: number; count: number; conversions: number[] }>();
    for (const row of rows) {
      const monthNum = parseInt(row.tanggalMulai.substring(5, 7));
      const existing = monthData.get(monthNum);
      const rate = computeConversionRate(row.pendaftar, row.realisasiHadir);
      if (existing) {
        existing.totalHadir += row.realisasiHadir;
        existing.count += 1;
        if (rate !== null) existing.conversions.push(rate);
      } else {
        monthData.set(monthNum, {
          totalHadir: row.realisasiHadir,
          count: 1,
          conversions: rate !== null ? [rate] : [],
        });
      }
    }

    // Compute average hadir per month
    const monthAverages: TopMonth[] = [];
    for (const [month, data] of monthData) {
      const avgHadir = Math.round((data.totalHadir / data.count) * 100) / 100;
      const avgConversionRate =
        data.conversions.length > 0
          ? Math.round(
              (data.conversions.reduce((s, c) => s + c, 0) / data.conversions.length) * 10,
            ) / 10
          : null;
      monthAverages.push({ month, avgHadir, avgConversionRate });
    }

    // Sort by avgHadir descending for top months
    const sorted = [...monthAverages].sort((a, b) => b.avgHadir - a.avgHadir);
    const topMonths = hasEnoughData ? sorted.slice(0, 3) : [];

    // Recommended months: above median of all monthly averages
    const allAvgs = monthAverages.map((m) => m.avgHadir).sort((a, b) => a - b);
    const medianIdx = Math.floor(allAvgs.length / 2);
    const median =
      allAvgs.length % 2 === 0 && allAvgs.length > 0
        ? ((allAvgs[medianIdx - 1] ?? 0) + (allAvgs[medianIdx] ?? 0)) / 2
        : allAvgs[medianIdx] ?? 0;

    const recommendedMonths = hasEnoughData
      ? monthAverages
          .filter((m) => m.avgHadir > median)
          .sort((a, b) => b.avgHadir - a.avgHadir)
      : [];

    // YoY trend
    const yearTotals = new Map<number, number>();
    for (const row of rows) {
      const year = parseInt(row.tanggalMulai.substring(0, 4));
      yearTotals.set(year, (yearTotals.get(year) ?? 0) + row.realisasiHadir);
    }
    const years = Array.from(yearTotals.keys()).sort((a, b) => a - b);
    let yoyTrend: CategoryPattern["yoyTrend"] = null;
    if (years.length >= 2) {
      const latestYear = years[years.length - 1] as number;
      const prevYear = years[years.length - 2] as number;
      const latestTotal = yearTotals.get(latestYear) ?? 0;
      const prevTotal = yearTotals.get(prevYear) ?? 0;
      if (prevTotal > 0) {
        const changePercent =
          Math.round(((latestTotal - prevTotal) / prevTotal) * 1000) / 10;
        yoyTrend = {
          changePercent,
          label: changePercent > 0 ? "pertumbuhan" : "penurunan",
        };
      }
    }

    // Popularity score
    const metrics = kategoriMetrics.get(kategori)!;
    const popularityScore = computePopularityScore({
      avgAttendance: metrics.avgAttendance,
      avgConversion: metrics.avgConversion,
      avgEvalScore: metrics.avgEvalScore,
      minAttendance,
      maxAttendance,
      minConversion,
      maxConversion,
      minEvalScore,
      maxEvalScore,
    });

    patterns.push({
      kategori: kategori as KategoriPpl,
      topMonths,
      recommendedMonths,
      yoyTrend,
      popularityScore,
      hasEnoughData,
    });
  }

  return {
    patterns,
    period: { startDate, endDate },
  };
}

/**
 * Helper: compute average evaluation scores per kategori.
 * Averages all numeric (scale + grid) values from responses linked to kegiatan in each kategori.
 */
async function getKategoriEvalScores(): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  // Fetch kegiatan with their responses
  const rows = await db
    .select({
      kategoriPpl: pplKegiatan.kategoriPpl,
      configJson: pplKuesionerTemplate.configJson,
      answersJson: pplKuesionerResponse.answersJson,
    })
    .from(pplKuesionerResponse)
    .innerJoin(pplKuesionerLink, eq(pplKuesionerResponse.linkId, pplKuesionerLink.id))
    .innerJoin(pplKegiatan, eq(pplKuesionerLink.kegiatanId, pplKegiatan.id))
    .innerJoin(pplKuesionerTemplate, eq(pplKuesionerLink.templateId, pplKuesionerTemplate.id));

  // Group scores by kategori
  const kategoriScores = new Map<string, number[]>();

  for (const row of rows) {
    const fields = row.configJson as FormField[];
    const answers = row.answersJson as Record<string, unknown>;
    const scores: number[] = [];

    for (const field of fields) {
      if (field.type === "scale") {
        const val = answers[field.id];
        if (val !== undefined && val !== null) {
          const num = Number(val);
          if (!isNaN(num)) scores.push(num);
        }
      } else if (field.type === "grid") {
        const val = answers[field.id];
        if (val && typeof val === "object" && !Array.isArray(val)) {
          for (const v of Object.values(val as Record<string, unknown>)) {
            const num = Number(v);
            if (!isNaN(num)) scores.push(num);
          }
        }
      }
    }

    if (scores.length > 0) {
      const existing = kategoriScores.get(row.kategoriPpl) ?? [];
      existing.push(...scores);
      kategoriScores.set(row.kategoriPpl, existing);
    }
  }

  for (const [kategori, scores] of kategoriScores) {
    if (scores.length > 0) {
      const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      result.set(kategori, Math.round(avg * 100) / 100);
    }
  }

  return result;
}


// â”€â”€â”€ GET SPEAKER PERFORMANCE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Calculate narasumber performance analytics based on evaluation scores.
 * Computes average scores, rankings, kegiatan count, SKP sum, and score trends.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 */
export async function getSpeakerPerformance(
  filter: SpeakerFilter = {},
): Promise<SpeakerPerformanceData> {
  await requirePermission("pplEvaluasi", "view");

  const { startDate, endDate } = getDateRange(filter);

  // Fetch all narasumber (active ones)
  const narasumberRows = await db
    .select({
      id: pplNarasumber.id,
      nama: pplNarasumber.nama,
      email: pplNarasumber.email,
      isActive: pplNarasumber.isActive,
    })
    .from(pplNarasumber);

  // Fetch kegiatan-narasumber assignments with kegiatan details
  const assignmentConditions = [
    gte(pplKegiatan.tanggalMulai, startDate),
    lte(pplKegiatan.tanggalMulai, endDate),
  ];

  if (filter.kategori) {
    assignmentConditions.push(eq(pplKegiatan.kategoriPpl, filter.kategori));
  }

  const assignments = await db
    .select({
      narasumberId: pplKegiatanNarasumber.narasumberId,
      kegiatanId: pplKegiatanNarasumber.kegiatanId,
      kegiatanNama: pplKegiatan.namaKegiatan,
      kategoriPpl: pplKegiatan.kategoriPpl,
      tanggalSelesai: pplKegiatan.tanggalSelesai,
      skp: pplKegiatan.skp,
      statusEvent: pplKegiatan.statusEvent,
    })
    .from(pplKegiatanNarasumber)
    .innerJoin(pplKegiatan, eq(pplKegiatanNarasumber.kegiatanId, pplKegiatan.id))
    .where(and(...assignmentConditions));

  // Fetch responses with template configs for evaluation score computation
  // Only fetch responses for kegiatan within the date range
  const responseRows = await db
    .select({
      kegiatanId: pplKuesionerLink.kegiatanId,
      configJson: pplKuesionerTemplate.configJson,
      answersJson: pplKuesionerResponse.answersJson,
    })
    .from(pplKuesionerResponse)
    .innerJoin(pplKuesionerLink, eq(pplKuesionerResponse.linkId, pplKuesionerLink.id))
    .innerJoin(pplKuesionerTemplate, eq(pplKuesionerLink.templateId, pplKuesionerTemplate.id))
    .innerJoin(pplKegiatan, eq(pplKuesionerLink.kegiatanId, pplKegiatan.id))
    .where(
      and(
        gte(pplKegiatan.tanggalMulai, startDate),
        lte(pplKegiatan.tanggalMulai, endDate),
      ),
    );

  // Compute average evaluation score per kegiatan
  // Now includes narasumber_section scores filtered per-narasumber
  const kegiatanScores = new Map<
    number,
    { totalScore: number; scoreCount: number; respondenCount: number }
  >();

  // Also track narasumber-specific scores from narasumber_section
  const narasumberKegiatanScores = new Map<
    string, // "narasumberId_kegiatanId"
    { totalScore: number; scoreCount: number }
  >();

  // Group responses by kegiatanId
  const responsesByKegiatan = new Map<
    number,
    Array<{ configJson: unknown; answersJson: unknown }>
  >();

  for (const row of responseRows) {
    const existing = responsesByKegiatan.get(row.kegiatanId) ?? [];
    existing.push({ configJson: row.configJson, answersJson: row.answersJson });
    responsesByKegiatan.set(row.kegiatanId, existing);
  }

  // Pre-fetch narasumber assignments per kegiatan for narasumber_section parsing
  const assignmentsByKegiatan = new Map<number, Array<{ narasumberId: number }>>();
  const allAssignments = await db
    .select({
      kegiatanId: pplKegiatanNarasumber.kegiatanId,
      narasumberId: pplKegiatanNarasumber.narasumberId,
    })
    .from(pplKegiatanNarasumber);

  for (const a of allAssignments) {
    const existing = assignmentsByKegiatan.get(a.kegiatanId) ?? [];
    existing.push({ narasumberId: a.narasumberId });
    assignmentsByKegiatan.set(a.kegiatanId, existing);
  }

  for (const [kegiatanId, responses] of responsesByKegiatan) {
    let totalScore = 0;
    let scoreCount = 0;

    // Get the first response's configJson to detect narasumber_section fields
    const firstResp = responses[0];
    const fields = firstResp?.configJson as FormField[] | undefined;
    const hasNarasumberSection = fields?.some((f) => f.type === "narasumber_section");
    const narasumberList = assignmentsByKegiatan.get(kegiatanId) ?? [];

    for (const resp of responses) {
      const respFields = resp.configJson as FormField[];
      const answers = resp.answersJson as Record<string, unknown>;

      for (const field of respFields) {
        if (field.type === "narasumber_section") {
          // Narasumber section scores are tracked separately per-narasumber
          const config = field.config as NarasumberSectionConfig | null;
          if (!config?.fields) continue;

          for (const nars of narasumberList) {
            let narsTotal = 0;
            let narsCount = 0;

            for (let fi = 0; fi < config.fields.length; fi++) {
              const key = `narasumber_${nars.narasumberId}_${fi}`;
              const val = answers[key];
              if (val !== undefined && val !== null) {
                const num = Number(val);
                if (!isNaN(num)) {
                  narsTotal += num;
                  narsCount += 1;
                }
              }
            }

            if (narsCount > 0) {
              const mapKey = `${nars.narasumberId}_${kegiatanId}`;
              const existing = narasumberKegiatanScores.get(mapKey) ?? { totalScore: 0, scoreCount: 0 };
              existing.totalScore += narsTotal;
              existing.scoreCount += narsCount;
              narasumberKegiatanScores.set(mapKey, existing);
            }
          }

          // Skip narasumber_section in overall score to avoid double-counting
          continue;
        }

        if (field.type === "scale") {
          const val = answers[field.id];
          if (val !== undefined && val !== null) {
            const num = Number(val);
            if (!isNaN(num)) {
              totalScore += num;
              scoreCount += 1;
            }
          }
        } else if (field.type === "grid") {
          const val = answers[field.id];
          if (val && typeof val === "object" && !Array.isArray(val)) {
            for (const v of Object.values(val as Record<string, unknown>)) {
              const num = Number(v);
              if (!isNaN(num)) {
                totalScore += num;
                scoreCount += 1;
              }
            }
          }
        }
      }
    }

    kegiatanScores.set(kegiatanId, {
      totalScore,
      scoreCount,
      respondenCount: responses.length,
    });
  }

  // Build speaker performance data
  const speakers: SpeakerPerformanceRow[] = [];
  const today = new Date().toISOString().split("T")[0] as string;

  for (const narasumber of narasumberRows) {
    const narasumberAssignments = assignments.filter(
      (a) => a.narasumberId === narasumber.id,
    );

    if (narasumberAssignments.length === 0) continue;

    // Count completed kegiatan (archived or past tanggal_selesai)
    const completedAssignments = narasumberAssignments.filter(
      (a) => a.statusEvent === "archived" || a.tanggalSelesai <= today,
    );
    const kegiatanCount = completedAssignments.length;
    const totalSkp = completedAssignments.reduce((sum, a) => sum + a.skp, 0);

    // Compute average evaluation score across all assigned kegiatan
    let totalNarasumberScore = 0;
    let totalNarasumberScoreCount = 0;
    let totalRespondenCount = 0;

    // Build score trend (chronological by tanggal_selesai)
    const trend: SpeakerScoreTrend[] = [];

    for (const assignment of narasumberAssignments) {
      // Prefer narasumber-specific scores from narasumber_section
      const narasumberKey = `${narasumber.id}_${assignment.kegiatanId}`;
      const narasumberScores = narasumberKegiatanScores.get(narasumberKey);

      if (narasumberScores && narasumberScores.scoreCount > 0) {
        const avgScore = Math.round((narasumberScores.totalScore / narasumberScores.scoreCount) * 100) / 100;
        totalNarasumberScore += narasumberScores.totalScore;
        totalNarasumberScoreCount += narasumberScores.scoreCount;

        // Use kegiatan-level responden count
        const scores = kegiatanScores.get(assignment.kegiatanId);
        const respondenCount = scores?.respondenCount ?? 0;
        totalRespondenCount += respondenCount;

        trend.push({
          kegiatanId: assignment.kegiatanId,
          kegiatanNama: assignment.kegiatanNama,
          tanggalSelesai: assignment.tanggalSelesai,
          avgScore,
          respondenCount,
        });
      } else {
        // Fallback to overall kegiatan scores
        const scores = kegiatanScores.get(assignment.kegiatanId);
        if (scores && scores.scoreCount > 0) {
          const avgScore = Math.round((scores.totalScore / scores.scoreCount) * 100) / 100;
          totalNarasumberScore += scores.totalScore;
          totalNarasumberScoreCount += scores.scoreCount;
          totalRespondenCount += scores.respondenCount;

          trend.push({
            kegiatanId: assignment.kegiatanId,
            kegiatanNama: assignment.kegiatanNama,
            tanggalSelesai: assignment.tanggalSelesai,
            avgScore,
            respondenCount: scores.respondenCount,
          });
        }
      }
    }

    // Sort trend chronologically by tanggal_selesai
    trend.sort((a, b) => a.tanggalSelesai.localeCompare(b.tanggalSelesai));

    const hasEvaluationData = totalNarasumberScoreCount > 0;
    const avgScore = hasEvaluationData
      ? Math.round((totalNarasumberScore / totalNarasumberScoreCount) * 100) / 100
      : null;

    speakers.push({
      narasumberId: narasumber.id,
      nama: narasumber.nama,
      email: narasumber.email,
      avgScore,
      kegiatanCount,
      totalSkp,
      respondenCount: totalRespondenCount,
      trend,
      hasEvaluationData,
    });
  }

  // Sort by average score descending (speakers without data go to the end)
  speakers.sort((a, b) => {
    if (a.avgScore === null && b.avgScore === null) return 0;
    if (a.avgScore === null) return 1;
    if (b.avgScore === null) return -1;
    return b.avgScore - a.avgScore;
  });

  return {
    speakers,
    period: { startDate, endDate },
  };
}
