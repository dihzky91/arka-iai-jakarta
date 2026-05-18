/**
 * Pure helper functions for PPL pattern analysis.
 *
 * These functions encapsulate the core pattern analysis logic used by the
 * annual planning analytics, separated from database concerns for testability.
 *
 * Requirements: 9.1, 9.2
 */

import type { KegiatanRow } from "@/lib/ppl-dashboard-aggregations";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface MonthAverage {
  month: number; // 1-12
  avgHadir: number;
  avgConversionRate: number | null;
}

// ─── TOP MONTHS IDENTIFICATION ───────────────────────────────────────────────

/**
 * Identify the top 3 months with the highest average realisasiHadir for a
 * given set of kegiatan belonging to a single Kategori_PPL.
 *
 * Groups kegiatan by month number (1-12), computes average realisasiHadir per
 * month, and returns the top 3 sorted descending by avgHadir.
 *
 * Returns empty array if fewer than 12 distinct months of data exist.
 *
 * Requirements: 9.1
 */
export function identifyTopMonths(kegiatan: KegiatanRow[]): MonthAverage[] {
  const monthAverages = computeMonthlyAverages(kegiatan);

  // Check if we have >= 12 distinct months of data
  const distinctMonths = new Set<string>();
  for (const row of kegiatan) {
    distinctMonths.add(row.tanggalMulai.substring(0, 7)); // "YYYY-MM"
  }
  if (distinctMonths.size < 12) return [];

  // Sort by avgHadir descending and take top 3
  const sorted = [...monthAverages].sort((a, b) => b.avgHadir - a.avgHadir);
  return sorted.slice(0, 3);
}

// ─── RECOMMENDED MONTHS ──────────────────────────────────────────────────────

/**
 * Identify recommended months where the average realisasiHadir exceeds the
 * median of all monthly averages for the category.
 *
 * Returns empty array if fewer than 12 distinct months of data exist.
 *
 * Requirements: 9.2
 */
export function getRecommendedMonths(kegiatan: KegiatanRow[]): MonthAverage[] {
  const monthAverages = computeMonthlyAverages(kegiatan);

  // Check if we have >= 12 distinct months of data
  const distinctMonths = new Set<string>();
  for (const row of kegiatan) {
    distinctMonths.add(row.tanggalMulai.substring(0, 7)); // "YYYY-MM"
  }
  if (distinctMonths.size < 12) return [];

  // Compute median of all monthly averages
  const allAvgs = monthAverages.map((m) => m.avgHadir).sort((a, b) => a - b);
  const medianIdx = Math.floor(allAvgs.length / 2);
  const median =
    allAvgs.length % 2 === 0 && allAvgs.length > 0
      ? ((allAvgs[medianIdx - 1] ?? 0) + (allAvgs[medianIdx] ?? 0)) / 2
      : allAvgs[medianIdx] ?? 0;

  // Filter months above median, sorted descending
  return monthAverages
    .filter((m) => m.avgHadir > median)
    .sort((a, b) => b.avgHadir - a.avgHadir);
}

// ─── SHARED HELPER ───────────────────────────────────────────────────────────

/**
 * Compute average realisasiHadir and conversion rate per month number (1-12).
 */
export function computeMonthlyAverages(kegiatan: KegiatanRow[]): MonthAverage[] {
  const monthData = new Map<
    number,
    { totalHadir: number; count: number; conversions: number[] }
  >();

  for (const row of kegiatan) {
    const monthNum = parseInt(row.tanggalMulai.substring(5, 7));
    const existing = monthData.get(monthNum);
    const rate =
      row.pendaftar > 0
        ? Math.round((row.realisasiHadir / row.pendaftar) * 1000) / 10
        : null;

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

  const results: MonthAverage[] = [];
  for (const [month, data] of monthData) {
    const avgHadir = Math.round((data.totalHadir / data.count) * 100) / 100;
    const avgConversionRate =
      data.conversions.length > 0
        ? Math.round(
            (data.conversions.reduce((s, c) => s + c, 0) /
              data.conversions.length) *
              10,
          ) / 10
        : null;
    results.push({ month, avgHadir, avgConversionRate });
  }

  return results;
}
