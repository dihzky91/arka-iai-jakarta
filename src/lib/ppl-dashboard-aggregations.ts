/**
 * Pure aggregation helper functions for PPL Evaluasi Dashboard.
 *
 * These functions encapsulate the core aggregation logic used by the
 * attendance dashboard, separated from database concerns for testability.
 *
 * Requirements: 8.1, 8.3, 8.4, 8.6, 8.7
 */

import type { KategoriPpl } from "@/server/actions/ppl-evaluasi/types";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface KegiatanRow {
  kategoriPpl: string;
  tanggalMulai: string; // "YYYY-MM-DD"
  pendaftar: number;
  realisasiHadir: number;
}

export interface CategoryMonthAggregation {
  kategori: string;
  month: string; // "YYYY-MM"
  kegiatanCount: number;
  totalHadir: number;
}

export interface CategoryRankingResult {
  kategori: string;
  totalHadir: number;
  kegiatanCount: number;
}

export interface YoYResult {
  kategori: string;
  currentYear: number;
  previousYear: number;
  currentTotalHadir: number;
  previousTotalHadir: number;
  hadirChangePercent: number | null;
}

// ─── DATE RANGE FILTER ───────────────────────────────────────────────────────

/**
 * Filter kegiatan by date range [start, end] based on tanggalMulai.
 * Includes kegiatan where tanggalMulai >= startDate AND tanggalMulai <= endDate.
 *
 * Requirements: 8.4
 */
export function filterByDateRange(
  kegiatan: KegiatanRow[],
  startDate: string,
  endDate: string,
): KegiatanRow[] {
  return kegiatan.filter(
    (k) => k.tanggalMulai >= startDate && k.tanggalMulai <= endDate,
  );
}

// ─── CATEGORY-MONTH AGGREGATION ──────────────────────────────────────────────

/**
 * Aggregate kegiatan by kategori and month.
 * Counts the number of kegiatan per kategori per month and sums realisasiHadir.
 *
 * Requirements: 8.1, 8.3
 */
export function aggregateCategoryMonth(
  kegiatan: KegiatanRow[],
): CategoryMonthAggregation[] {
  const map = new Map<string, CategoryMonthAggregation>();

  for (const row of kegiatan) {
    const month = row.tanggalMulai.substring(0, 7); // "YYYY-MM"
    const key = `${row.kategoriPpl}|${month}`;

    const existing = map.get(key);
    if (existing) {
      existing.kegiatanCount += 1;
      existing.totalHadir += row.realisasiHadir;
    } else {
      map.set(key, {
        kategori: row.kategoriPpl,
        month,
        kegiatanCount: 1,
        totalHadir: row.realisasiHadir,
      });
    }
  }

  return Array.from(map.values());
}

// ─── CATEGORY RANKING ────────────────────────────────────────────────────────

/**
 * Rank categories by total realisasiHadir in descending order.
 *
 * Requirements: 8.6
 */
export function rankCategoriesByAttendance(
  kegiatan: KegiatanRow[],
): CategoryRankingResult[] {
  const totals = new Map<string, { totalHadir: number; kegiatanCount: number }>();

  for (const row of kegiatan) {
    const existing = totals.get(row.kategoriPpl);
    if (existing) {
      existing.totalHadir += row.realisasiHadir;
      existing.kegiatanCount += 1;
    } else {
      totals.set(row.kategoriPpl, {
        totalHadir: row.realisasiHadir,
        kegiatanCount: 1,
      });
    }
  }

  return Array.from(totals.entries())
    .map(([kategori, data]) => ({
      kategori,
      totalHadir: data.totalHadir,
      kegiatanCount: data.kegiatanCount,
    }))
    .sort((a, b) => b.totalHadir - a.totalHadir);
}

// ─── YEAR-OVER-YEAR PERCENTAGE CHANGE ────────────────────────────────────────

/**
 * Compute year-over-year percentage change for each kategori.
 * Formula: ((total_Y - total_Y_minus_1) / total_Y_minus_1) × 100
 * Returns null when previous year total is 0 (cannot compute percentage change).
 *
 * Requirements: 8.7
 */
export function computeYoYChange(
  kegiatan: KegiatanRow[],
  currentYear: number,
): YoYResult[] {
  const previousYear = currentYear - 1;

  // Group by year and kategori
  const yearCategoryMap = new Map<string, number>();

  for (const row of kegiatan) {
    const rowYear = parseInt(row.tanggalMulai.substring(0, 4));
    if (rowYear !== currentYear && rowYear !== previousYear) continue;

    const key = `${rowYear}|${row.kategoriPpl}`;
    yearCategoryMap.set(key, (yearCategoryMap.get(key) ?? 0) + row.realisasiHadir);
  }

  // Find all categories that have data in at least one of the two years
  const allKategori = new Set<string>();
  for (const row of kegiatan) {
    const rowYear = parseInt(row.tanggalMulai.substring(0, 4));
    if (rowYear === currentYear || rowYear === previousYear) {
      allKategori.add(row.kategoriPpl);
    }
  }

  const results: YoYResult[] = [];

  for (const kategori of allKategori) {
    const currentTotal = yearCategoryMap.get(`${currentYear}|${kategori}`) ?? 0;
    const previousTotal = yearCategoryMap.get(`${previousYear}|${kategori}`) ?? 0;

    const hadirChangePercent =
      previousTotal > 0
        ? Math.round(((currentTotal - previousTotal) / previousTotal) * 1000) / 10
        : null;

    results.push({
      kategori,
      currentYear,
      previousYear,
      currentTotalHadir: currentTotal,
      previousTotalHadir: previousTotal,
      hadirChangePercent,
    });
  }

  return results;
}
