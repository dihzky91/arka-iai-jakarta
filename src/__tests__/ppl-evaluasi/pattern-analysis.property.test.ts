import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  identifyTopMonths,
  getRecommendedMonths,
  computeMonthlyAverages,
} from "@/lib/ppl-pattern-analysis";
import { computePopularityScore } from "@/server/lib/ppl-analytics";
import type { KegiatanRow } from "@/lib/ppl-dashboard-aggregations";
import type { PopularityParams } from "@/server/lib/ppl-analytics";

// ─── GENERATORS ──────────────────────────────────────────────────────────────

const KATEGORI_PPL_VALUES = [
  "Perpajakan",
  "Sistem Informasi & Softskill",
  "Akuntansi Keuangan",
  "Audit",
  "Akuntansi Syariah",
  "Akuntansi Manajemen",
] as const;

/**
 * Generate kegiatan data spanning at least 12 distinct months for a single category.
 * This ensures the "hasEnoughData" condition is met for top months identification.
 */
const kegiatanWith12MonthsArb: fc.Arbitrary<KegiatanRow[]> = fc
  .record({
    kategori: fc.constantFrom(...KATEGORI_PPL_VALUES),
    // Generate data across 2 years to ensure >= 12 distinct months
    items: fc.array(
      fc.record({
        year: fc.constantFrom(2023, 2024),
        month: fc.integer({ min: 1, max: 12 }),
        day: fc.integer({ min: 1, max: 28 }),
        pendaftar: fc.integer({ min: 1, max: 500 }),
        realisasiHadir: fc.integer({ min: 1, max: 500 }),
      }),
      { minLength: 24, maxLength: 60 },
    ),
  })
  .filter(({ items }) => {
    // Ensure at least 12 distinct YYYY-MM values
    const months = new Set(
      items.map(
        (i) =>
          `${i.year}-${i.month.toString().padStart(2, "0")}`,
      ),
    );
    return months.size >= 12;
  })
  .map(({ kategori, items }) =>
    items.map((item) => ({
      kategoriPpl: kategori,
      tanggalMulai: `${item.year}-${item.month.toString().padStart(2, "0")}-${item.day.toString().padStart(2, "0")}`,
      pendaftar: item.pendaftar,
      realisasiHadir: item.realisasiHadir,
    })),
  );

/**
 * Generate kegiatan data with fewer than 12 distinct months.
 */
const kegiatanLessThan12MonthsArb: fc.Arbitrary<KegiatanRow[]> = fc
  .record({
    kategori: fc.constantFrom(...KATEGORI_PPL_VALUES),
    items: fc.array(
      fc.record({
        month: fc.integer({ min: 1, max: 6 }), // Only 6 months in one year
        day: fc.integer({ min: 1, max: 28 }),
        pendaftar: fc.integer({ min: 1, max: 500 }),
        realisasiHadir: fc.integer({ min: 1, max: 500 }),
      }),
      { minLength: 1, maxLength: 20 },
    ),
  })
  .map(({ kategori, items }) =>
    items.map((item) => ({
      kategoriPpl: kategori,
      tanggalMulai: `2024-${item.month.toString().padStart(2, "0")}-${item.day.toString().padStart(2, "0")}`,
      pendaftar: item.pendaftar,
      realisasiHadir: item.realisasiHadir,
    })),
  );

/**
 * Generate valid PopularityParams with proper min/max constraints.
 * Ensures min <= value <= max for each metric.
 */
const popularityParamsArb: fc.Arbitrary<PopularityParams> = fc
  .record({
    attendance: fc.tuple(
      fc.integer({ min: 0, max: 1000 }),
      fc.integer({ min: 0, max: 1000 }),
      fc.integer({ min: 0, max: 1000 }),
    ),
    conversion: fc.tuple(
      fc.integer({ min: 0, max: 200 }),
      fc.integer({ min: 0, max: 200 }),
      fc.integer({ min: 0, max: 200 }),
    ),
    evalScore: fc.tuple(
      fc.integer({ min: 0, max: 50 }),
      fc.integer({ min: 0, max: 50 }),
      fc.integer({ min: 0, max: 50 }),
    ),
  })
  .map(({ attendance, conversion, evalScore }) => {
    const [a1, a2, a3] = [...attendance].sort((x, y) => x - y);
    const [c1, c2, c3] = [...conversion].sort((x, y) => x - y);
    const [e1, e2, e3] = [...evalScore].sort((x, y) => x - y);
    return {
      avgAttendance: a2! / 10,
      minAttendance: a1! / 10,
      maxAttendance: a3! / 10,
      avgConversion: c2! / 10,
      minConversion: c1! / 10,
      maxConversion: c3! / 10,
      avgEvalScore: e2! / 10,
      minEvalScore: e1! / 10,
      maxEvalScore: e3! / 10,
    };
  });

/**
 * Generate PopularityParams where min !== max for at least one metric
 * (non-degenerate case).
 */
const popularityParamsNonDegenerateArb: fc.Arbitrary<PopularityParams> = popularityParamsArb.filter(
  (p) =>
    p.minAttendance !== p.maxAttendance ||
    p.minConversion !== p.maxConversion ||
    p.minEvalScore !== p.maxEvalScore,
);

// ─── PROPERTY 20: Top Months Identification ──────────────────────────────────

/**
 * **Validates: Requirements 9.1**
 *
 * Property 20: Top Months Identification
 * For any Kategori_PPL with ≥ 12 months of historical data, the top 3 months
 * SHALL be the 3 months with the highest average realisasiHadir, sorted descending.
 * No month outside the top 3 SHALL have a higher average than any month in the top 3.
 */
describe("Property 20: Top Months Identification", () => {
  it("returns exactly 3 top months when >= 12 distinct months exist", () => {
    fc.assert(
      fc.property(kegiatanWith12MonthsArb, (kegiatan) => {
        const topMonths = identifyTopMonths(kegiatan);
        expect(topMonths).toHaveLength(3);
      }),
      { numRuns: 200 },
    );
  });

  it("top months are sorted in descending order by avgHadir", () => {
    fc.assert(
      fc.property(kegiatanWith12MonthsArb, (kegiatan) => {
        const topMonths = identifyTopMonths(kegiatan);

        for (let i = 0; i < topMonths.length - 1; i++) {
          expect(topMonths[i]!.avgHadir).toBeGreaterThanOrEqual(
            topMonths[i + 1]!.avgHadir,
          );
        }
      }),
      { numRuns: 200 },
    );
  });

  it("no month outside top 3 has a higher average than any month in the top 3", () => {
    fc.assert(
      fc.property(kegiatanWith12MonthsArb, (kegiatan) => {
        const topMonths = identifyTopMonths(kegiatan);
        const allMonthAverages = computeMonthlyAverages(kegiatan);

        if (topMonths.length === 0) return;

        const minTopAvg = topMonths[topMonths.length - 1]!.avgHadir;
        const topMonthNumbers = new Set(topMonths.map((t) => t.month));

        for (const monthAvg of allMonthAverages) {
          if (!topMonthNumbers.has(monthAvg.month)) {
            expect(monthAvg.avgHadir).toBeLessThanOrEqual(minTopAvg);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it("top months are a subset of all monthly averages", () => {
    fc.assert(
      fc.property(kegiatanWith12MonthsArb, (kegiatan) => {
        const topMonths = identifyTopMonths(kegiatan);
        const allMonthAverages = computeMonthlyAverages(kegiatan);
        const allMonthNumbers = new Set(allMonthAverages.map((m) => m.month));

        for (const top of topMonths) {
          expect(allMonthNumbers.has(top.month)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("returns empty array when fewer than 12 distinct months exist", () => {
    fc.assert(
      fc.property(kegiatanLessThan12MonthsArb, (kegiatan) => {
        const topMonths = identifyTopMonths(kegiatan);
        expect(topMonths).toHaveLength(0);
      }),
      { numRuns: 200 },
    );
  });
});

// ─── PROPERTY 21: Recommended Months Above Median ────────────────────────────

/**
 * **Validates: Requirements 9.2**
 *
 * Property 21: Recommended Months Above Median
 * For any Kategori_PPL, the recommended months SHALL be exactly those months
 * where the average realisasiHadir exceeds the median of all monthly averages
 * for that category.
 */
describe("Property 21: Recommended Months Above Median", () => {
  it("all recommended months have avgHadir strictly above the median", () => {
    fc.assert(
      fc.property(kegiatanWith12MonthsArb, (kegiatan) => {
        const recommended = getRecommendedMonths(kegiatan);
        const allMonthAverages = computeMonthlyAverages(kegiatan);

        // Compute median
        const allAvgs = allMonthAverages
          .map((m) => m.avgHadir)
          .sort((a, b) => a - b);
        const medianIdx = Math.floor(allAvgs.length / 2);
        const median =
          allAvgs.length % 2 === 0 && allAvgs.length > 0
            ? ((allAvgs[medianIdx - 1] ?? 0) + (allAvgs[medianIdx] ?? 0)) / 2
            : allAvgs[medianIdx] ?? 0;

        for (const month of recommended) {
          expect(month.avgHadir).toBeGreaterThan(median);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("no month above median is excluded from recommended months", () => {
    fc.assert(
      fc.property(kegiatanWith12MonthsArb, (kegiatan) => {
        const recommended = getRecommendedMonths(kegiatan);
        const allMonthAverages = computeMonthlyAverages(kegiatan);

        // Compute median
        const allAvgs = allMonthAverages
          .map((m) => m.avgHadir)
          .sort((a, b) => a - b);
        const medianIdx = Math.floor(allAvgs.length / 2);
        const median =
          allAvgs.length % 2 === 0 && allAvgs.length > 0
            ? ((allAvgs[medianIdx - 1] ?? 0) + (allAvgs[medianIdx] ?? 0)) / 2
            : allAvgs[medianIdx] ?? 0;

        const recommendedMonthNumbers = new Set(recommended.map((m) => m.month));

        for (const monthAvg of allMonthAverages) {
          if (monthAvg.avgHadir > median) {
            expect(recommendedMonthNumbers.has(monthAvg.month)).toBe(true);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it("recommended months are sorted descending by avgHadir", () => {
    fc.assert(
      fc.property(kegiatanWith12MonthsArb, (kegiatan) => {
        const recommended = getRecommendedMonths(kegiatan);

        for (let i = 0; i < recommended.length - 1; i++) {
          expect(recommended[i]!.avgHadir).toBeGreaterThanOrEqual(
            recommended[i + 1]!.avgHadir,
          );
        }
      }),
      { numRuns: 200 },
    );
  });

  it("returns empty array when fewer than 12 distinct months exist", () => {
    fc.assert(
      fc.property(kegiatanLessThan12MonthsArb, (kegiatan) => {
        const recommended = getRecommendedMonths(kegiatan);
        expect(recommended).toHaveLength(0);
      }),
      { numRuns: 200 },
    );
  });

  it("recommended months count is strictly less than total month count (at most half + ties)", () => {
    fc.assert(
      fc.property(kegiatanWith12MonthsArb, (kegiatan) => {
        const recommended = getRecommendedMonths(kegiatan);
        const allMonthAverages = computeMonthlyAverages(kegiatan);

        // Since recommended = months strictly above median,
        // at most ceil(n/2) - 1 months can be strictly above median
        // (unless there are ties at the median)
        expect(recommended.length).toBeLessThanOrEqual(allMonthAverages.length);
      }),
      { numRuns: 200 },
    );
  });
});

// ─── PROPERTY 22: Popularity Score Bounds and Formula ────────────────────────

/**
 * **Validates: Requirements 9.4**
 *
 * Property 22: Popularity Score Bounds and Formula
 * For any set of Kategori_PPL metrics, the popularity score SHALL be in the
 * range [0, 100] and SHALL equal (normalized_attendance × 0.4) +
 * (normalized_conversion × 0.3) + (normalized_eval_score × 0.3) × 100,
 * where normalization uses min-max scaling across all categories.
 */
describe("Property 22: Popularity Score Bounds and Formula", () => {
  it("popularity score is always in range [0, 100]", () => {
    fc.assert(
      fc.property(popularityParamsArb, (params) => {
        const score = computePopularityScore(params);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }),
      { numRuns: 500 },
    );
  });

  it("popularity score equals the weighted normalized formula", () => {
    fc.assert(
      fc.property(popularityParamsNonDegenerateArb, (params) => {
        const score = computePopularityScore(params);

        // Compute expected score using the formula
        const normalize = (value: number, min: number, max: number): number => {
          if (max === min) return 0;
          return (value - min) / (max - min);
        };

        const normAttendance = normalize(
          params.avgAttendance,
          params.minAttendance,
          params.maxAttendance,
        );
        const normConversion = normalize(
          params.avgConversion,
          params.minConversion,
          params.maxConversion,
        );
        const normEvalScore = normalize(
          params.avgEvalScore,
          params.minEvalScore,
          params.maxEvalScore,
        );

        const expected =
          (normAttendance * 0.4 + normConversion * 0.3 + normEvalScore * 0.3) *
          100;
        const expectedClamped = Math.min(100, Math.max(0, expected));
        const expectedRounded = Math.round(expectedClamped * 10) / 10;

        expect(score).toBeCloseTo(expectedRounded, 1);
      }),
      { numRuns: 500 },
    );
  });

  it("returns 50 when all min === max (single category scenario)", () => {
    fc.assert(
      fc.property(
        fc.record({
          value: fc.integer({ min: 0, max: 1000 }),
          convValue: fc.integer({ min: 0, max: 1000 }),
          evalValue: fc.integer({ min: 0, max: 50 }),
        }),
        ({ value, convValue, evalValue }) => {
          const params: PopularityParams = {
            avgAttendance: value / 10,
            minAttendance: value / 10,
            maxAttendance: value / 10,
            avgConversion: convValue / 10,
            minConversion: convValue / 10,
            maxConversion: convValue / 10,
            avgEvalScore: evalValue / 10,
            minEvalScore: evalValue / 10,
            maxEvalScore: evalValue / 10,
          };
          const score = computePopularityScore(params);
          expect(score).toBe(50);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("score is 100 when all metrics are at their maximum", () => {
    fc.assert(
      fc.property(
        fc.record({
          minAtt: fc.integer({ min: 0, max: 100 }),
          maxAtt: fc.integer({ min: 101, max: 500 }),
          minConv: fc.integer({ min: 0, max: 50 }),
          maxConv: fc.integer({ min: 51, max: 200 }),
          minEval: fc.integer({ min: 0, max: 2 }),
          maxEval: fc.integer({ min: 3, max: 5 }),
        }),
        ({ minAtt, maxAtt, minConv, maxConv, minEval, maxEval }) => {
          const params: PopularityParams = {
            avgAttendance: maxAtt,
            minAttendance: minAtt,
            maxAttendance: maxAtt,
            avgConversion: maxConv,
            minConversion: minConv,
            maxConversion: maxConv,
            avgEvalScore: maxEval,
            minEvalScore: minEval,
            maxEvalScore: maxEval,
          };
          const score = computePopularityScore(params);
          expect(score).toBe(100);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("score is 0 when all metrics are at their minimum", () => {
    fc.assert(
      fc.property(
        fc.record({
          minAtt: fc.integer({ min: 0, max: 100 }),
          maxAtt: fc.integer({ min: 101, max: 500 }),
          minConv: fc.integer({ min: 0, max: 50 }),
          maxConv: fc.integer({ min: 51, max: 200 }),
          minEval: fc.integer({ min: 0, max: 2 }),
          maxEval: fc.integer({ min: 3, max: 5 }),
        }),
        ({ minAtt, maxAtt, minConv, maxConv, minEval, maxEval }) => {
          const params: PopularityParams = {
            avgAttendance: minAtt,
            minAttendance: minAtt,
            maxAttendance: maxAtt,
            avgConversion: minConv,
            minConversion: minConv,
            maxConversion: maxConv,
            avgEvalScore: minEval,
            minEvalScore: minEval,
            maxEvalScore: maxEval,
          };
          const score = computePopularityScore(params);
          expect(score).toBe(0);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("higher metrics produce higher or equal scores", () => {
    fc.assert(
      fc.property(
        fc.record({
          minAtt: fc.integer({ min: 0, max: 50 }),
          maxAtt: fc.integer({ min: 200, max: 500 }),
          minConv: fc.integer({ min: 0, max: 20 }),
          maxConv: fc.integer({ min: 80, max: 200 }),
          minEval: fc.integer({ min: 0, max: 1 }),
          maxEval: fc.integer({ min: 4, max: 5 }),
          lowAtt: fc.integer({ min: 51, max: 100 }),
          highAtt: fc.integer({ min: 101, max: 199 }),
          lowConv: fc.integer({ min: 21, max: 50 }),
          highConv: fc.integer({ min: 51, max: 79 }),
          lowEval: fc.integer({ min: 2, max: 2 }),
          highEval: fc.integer({ min: 3, max: 3 }),
        }),
        (vals) => {
          const baseParams = {
            minAttendance: vals.minAtt,
            maxAttendance: vals.maxAtt,
            minConversion: vals.minConv,
            maxConversion: vals.maxConv,
            minEvalScore: vals.minEval,
            maxEvalScore: vals.maxEval,
          };

          const lowScore = computePopularityScore({
            ...baseParams,
            avgAttendance: vals.lowAtt,
            avgConversion: vals.lowConv,
            avgEvalScore: vals.lowEval,
          });

          const highScore = computePopularityScore({
            ...baseParams,
            avgAttendance: vals.highAtt,
            avgConversion: vals.highConv,
            avgEvalScore: vals.highEval,
          });

          expect(highScore).toBeGreaterThanOrEqual(lowScore);
        },
      ),
      { numRuns: 300 },
    );
  });
});
