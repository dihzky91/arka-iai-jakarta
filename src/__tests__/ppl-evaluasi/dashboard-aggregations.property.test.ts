import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  filterByDateRange,
  aggregateCategoryMonth,
  rankCategoriesByAttendance,
  computeYoYChange,
  type KegiatanRow,
} from "@/lib/ppl-dashboard-aggregations";

// ─── GENERATORS ──────────────────────────────────────────────────────────────

const KATEGORI_PPL_VALUES = [
  "Perpajakan",
  "Sistem Informasi & Softskill",
  "Akuntansi Keuangan",
  "Audit",
  "Akuntansi Syariah",
  "Akuntansi Manajemen",
  "Akuntansi Manajemen dan Manajemen Keuangan",
  "Akuntansi Perpajakan",
  "Manajemen Keuangan",
  "Akuntansi Keuangan & Softskill",
  "Akuntansi Keuangan dan Manajemen Keuangan",
  "Manajemen Strategik",
  "SAK & PSAK",
] as const;

/** Generate a valid date string in YYYY-MM-DD format */
const dateArb = fc
  .record({
    year: fc.integer({ min: 2020, max: 2025 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }), // Use 28 to avoid invalid dates
  })
  .map(({ year, month, day }) => {
    const m = month.toString().padStart(2, "0");
    const d = day.toString().padStart(2, "0");
    return `${year}-${m}-${d}`;
  });

/** Generate a valid KegiatanRow */
const kegiatanRowArb: fc.Arbitrary<KegiatanRow> = fc.record({
  kategoriPpl: fc.constantFrom(...KATEGORI_PPL_VALUES),
  tanggalMulai: dateArb,
  pendaftar: fc.integer({ min: 0, max: 99_999 }),
  realisasiHadir: fc.integer({ min: 0, max: 99_999 }),
});

/** Generate a non-empty array of KegiatanRow */
const kegiatanArrayArb = fc.array(kegiatanRowArb, { minLength: 1, maxLength: 50 });

/** Generate a sorted date range [start, end] */
const dateRangeArb = fc
  .tuple(dateArb, dateArb)
  .map(([a, b]) => (a <= b ? [a, b] : [b, a]) as [string, string]);

// ─── PROPERTY 16: Category-Month Aggregation ─────────────────────────────────

/**
 * **Validates: Requirements 8.1, 8.3**
 *
 * Property 16: Category-Month Aggregation
 * For any set of Kegiatan within a date range, the aggregation SHALL correctly
 * count the number of Kegiatan per Kategori_PPL per month, and the attendance
 * trend SHALL correctly sum realisasiHadir per Kategori_PPL per month.
 */
describe("Property 16: Category-Month Aggregation", () => {
  it("total kegiatanCount across all aggregations equals input array length", () => {
    fc.assert(
      fc.property(kegiatanArrayArb, (kegiatan) => {
        const result = aggregateCategoryMonth(kegiatan);
        const totalCount = result.reduce((sum, r) => sum + r.kegiatanCount, 0);
        expect(totalCount).toBe(kegiatan.length);
      }),
      { numRuns: 500 },
    );
  });

  it("total realisasiHadir across all aggregations equals sum of input realisasiHadir", () => {
    fc.assert(
      fc.property(kegiatanArrayArb, (kegiatan) => {
        const result = aggregateCategoryMonth(kegiatan);
        const totalHadir = result.reduce((sum, r) => sum + r.totalHadir, 0);
        const expectedTotal = kegiatan.reduce((sum, k) => sum + k.realisasiHadir, 0);
        expect(totalHadir).toBe(expectedTotal);
      }),
      { numRuns: 500 },
    );
  });

  it("each aggregation entry has correct count for its kategori-month combination", () => {
    fc.assert(
      fc.property(kegiatanArrayArb, (kegiatan) => {
        const result = aggregateCategoryMonth(kegiatan);

        for (const entry of result) {
          // Count how many kegiatan match this kategori and month
          const matching = kegiatan.filter(
            (k) =>
              k.kategoriPpl === entry.kategori &&
              k.tanggalMulai.substring(0, 7) === entry.month,
          );
          expect(entry.kegiatanCount).toBe(matching.length);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("each aggregation entry has correct totalHadir for its kategori-month combination", () => {
    fc.assert(
      fc.property(kegiatanArrayArb, (kegiatan) => {
        const result = aggregateCategoryMonth(kegiatan);

        for (const entry of result) {
          // Sum realisasiHadir for matching kegiatan
          const expectedHadir = kegiatan
            .filter(
              (k) =>
                k.kategoriPpl === entry.kategori &&
                k.tanggalMulai.substring(0, 7) === entry.month,
            )
            .reduce((sum, k) => sum + k.realisasiHadir, 0);
          expect(entry.totalHadir).toBe(expectedHadir);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("no duplicate kategori-month keys in the result", () => {
    fc.assert(
      fc.property(kegiatanArrayArb, (kegiatan) => {
        const result = aggregateCategoryMonth(kegiatan);
        const keys = result.map((r) => `${r.kategori}|${r.month}`);
        const uniqueKeys = new Set(keys);
        expect(keys.length).toBe(uniqueKeys.size);
      }),
      { numRuns: 500 },
    );
  });
});

// ─── PROPERTY 17: Date Range Filter Correctness ──────────────────────────────

/**
 * **Validates: Requirements 8.4**
 *
 * Property 17: Date Range Filter Correctness
 * For any set of Kegiatan and a date range filter [start, end], the filtered
 * result SHALL include only Kegiatan where tanggalMulai falls within [start, end],
 * and SHALL exclude all Kegiatan outside this range.
 */
describe("Property 17: Date Range Filter Correctness", () => {
  it("all filtered results have tanggalMulai within [start, end]", () => {
    fc.assert(
      fc.property(kegiatanArrayArb, dateRangeArb, (kegiatan, [start, end]) => {
        const result = filterByDateRange(kegiatan, start, end);

        for (const row of result) {
          expect(row.tanggalMulai >= start).toBe(true);
          expect(row.tanggalMulai <= end).toBe(true);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("no kegiatan outside [start, end] is included in the result", () => {
    fc.assert(
      fc.property(kegiatanArrayArb, dateRangeArb, (kegiatan, [start, end]) => {
        const result = filterByDateRange(kegiatan, start, end);
        const excluded = kegiatan.filter(
          (k) => k.tanggalMulai < start || k.tanggalMulai > end,
        );

        // None of the excluded items should appear in the result
        for (const ex of excluded) {
          expect(result).not.toContain(ex);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("filtered count equals count of kegiatan with tanggalMulai in [start, end]", () => {
    fc.assert(
      fc.property(kegiatanArrayArb, dateRangeArb, (kegiatan, [start, end]) => {
        const result = filterByDateRange(kegiatan, start, end);
        const expectedCount = kegiatan.filter(
          (k) => k.tanggalMulai >= start && k.tanggalMulai <= end,
        ).length;
        expect(result.length).toBe(expectedCount);
      }),
      { numRuns: 500 },
    );
  });

  it("filtering with range covering all dates returns all kegiatan", () => {
    fc.assert(
      fc.property(kegiatanArrayArb, (kegiatan) => {
        const result = filterByDateRange(kegiatan, "2000-01-01", "2099-12-31");
        expect(result.length).toBe(kegiatan.length);
      }),
      { numRuns: 200 },
    );
  });

  it("filtering with empty range (end < start of all data) returns empty", () => {
    fc.assert(
      fc.property(kegiatanArrayArb, (kegiatan) => {
        // Use a range before all possible dates in our generator (2020+)
        const result = filterByDateRange(kegiatan, "2000-01-01", "2000-01-31");
        expect(result.length).toBe(0);
      }),
      { numRuns: 200 },
    );
  });
});

// ─── PROPERTY 18: Category Ranking by Total Attendance ───────────────────────

/**
 * **Validates: Requirements 8.6**
 *
 * Property 18: Category Ranking by Total Attendance
 * For any set of Kegiatan grouped by Kategori_PPL, the ranking SHALL be sorted
 * in descending order by total realisasiHadir, such that for any adjacent pair
 * in the ranking, the higher-ranked category has total attendance ≥ the lower-ranked category.
 */
describe("Property 18: Category Ranking by Total Attendance", () => {
  it("ranking is sorted in descending order by totalHadir", () => {
    fc.assert(
      fc.property(kegiatanArrayArb, (kegiatan) => {
        const ranking = rankCategoriesByAttendance(kegiatan);

        for (let i = 0; i < ranking.length - 1; i++) {
          expect(ranking[i]!.totalHadir).toBeGreaterThanOrEqual(
            ranking[i + 1]!.totalHadir,
          );
        }
      }),
      { numRuns: 500 },
    );
  });

  it("total attendance in ranking equals sum of all realisasiHadir", () => {
    fc.assert(
      fc.property(kegiatanArrayArb, (kegiatan) => {
        const ranking = rankCategoriesByAttendance(kegiatan);
        const rankingTotal = ranking.reduce((sum, r) => sum + r.totalHadir, 0);
        const inputTotal = kegiatan.reduce((sum, k) => sum + k.realisasiHadir, 0);
        expect(rankingTotal).toBe(inputTotal);
      }),
      { numRuns: 500 },
    );
  });

  it("each category totalHadir equals sum of realisasiHadir for that category", () => {
    fc.assert(
      fc.property(kegiatanArrayArb, (kegiatan) => {
        const ranking = rankCategoriesByAttendance(kegiatan);

        for (const entry of ranking) {
          const expectedTotal = kegiatan
            .filter((k) => k.kategoriPpl === entry.kategori)
            .reduce((sum, k) => sum + k.realisasiHadir, 0);
          expect(entry.totalHadir).toBe(expectedTotal);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("each category kegiatanCount equals number of kegiatan for that category", () => {
    fc.assert(
      fc.property(kegiatanArrayArb, (kegiatan) => {
        const ranking = rankCategoriesByAttendance(kegiatan);

        for (const entry of ranking) {
          const expectedCount = kegiatan.filter(
            (k) => k.kategoriPpl === entry.kategori,
          ).length;
          expect(entry.kegiatanCount).toBe(expectedCount);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("number of categories in ranking equals number of distinct categories in input", () => {
    fc.assert(
      fc.property(kegiatanArrayArb, (kegiatan) => {
        const ranking = rankCategoriesByAttendance(kegiatan);
        const distinctCategories = new Set(kegiatan.map((k) => k.kategoriPpl));
        expect(ranking.length).toBe(distinctCategories.size);
      }),
      { numRuns: 500 },
    );
  });
});

// ─── PROPERTY 19: Year-over-Year Percentage Change ───────────────────────────

/**
 * **Validates: Requirements 8.7**
 *
 * Property 19: Year-over-Year Percentage Change
 * For any Kategori_PPL with data in two consecutive years (Y and Y-1), the YoY
 * percentage change SHALL equal ((total_Y - total_Y_minus_1) / total_Y_minus_1) × 100.
 */
describe("Property 19: Year-over-Year Percentage Change", () => {
  /** Generate kegiatan with data in two consecutive years for a given category */
  const twoYearKegiatanArb = fc
    .record({
      currentYear: fc.integer({ min: 2021, max: 2025 }),
      kategori: fc.constantFrom(...KATEGORI_PPL_VALUES),
      currentYearItems: fc.array(
        fc.record({
          month: fc.integer({ min: 1, max: 12 }),
          day: fc.integer({ min: 1, max: 28 }),
          pendaftar: fc.integer({ min: 0, max: 99_999 }),
          realisasiHadir: fc.integer({ min: 0, max: 99_999 }),
        }),
        { minLength: 1, maxLength: 10 },
      ),
      previousYearItems: fc.array(
        fc.record({
          month: fc.integer({ min: 1, max: 12 }),
          day: fc.integer({ min: 1, max: 28 }),
          pendaftar: fc.integer({ min: 0, max: 99_999 }),
          realisasiHadir: fc.integer({ min: 1, max: 99_999 }), // min 1 to ensure previousTotal > 0
        }),
        { minLength: 1, maxLength: 10 },
      ),
    })
    .map(({ currentYear, kategori, currentYearItems, previousYearItems }) => {
      const previousYear = currentYear - 1;
      const kegiatan: KegiatanRow[] = [
        ...currentYearItems.map((item) => ({
          kategoriPpl: kategori,
          tanggalMulai: `${currentYear}-${item.month.toString().padStart(2, "0")}-${item.day.toString().padStart(2, "0")}`,
          pendaftar: item.pendaftar,
          realisasiHadir: item.realisasiHadir,
        })),
        ...previousYearItems.map((item) => ({
          kategoriPpl: kategori,
          tanggalMulai: `${previousYear}-${item.month.toString().padStart(2, "0")}-${item.day.toString().padStart(2, "0")}`,
          pendaftar: item.pendaftar,
          realisasiHadir: item.realisasiHadir,
        })),
      ];
      return { kegiatan, currentYear, kategori };
    });

  it("YoY change equals ((total_Y - total_Y_minus_1) / total_Y_minus_1) × 100 when previous year > 0", () => {
    fc.assert(
      fc.property(twoYearKegiatanArb, ({ kegiatan, currentYear, kategori }) => {
        const results = computeYoYChange(kegiatan, currentYear);
        const entry = results.find((r) => r.kategori === kategori);

        expect(entry).toBeDefined();

        if (entry && entry.previousTotalHadir > 0) {
          const expected =
            Math.round(
              ((entry.currentTotalHadir - entry.previousTotalHadir) /
                entry.previousTotalHadir) *
                1000,
            ) / 10;
          expect(entry.hadirChangePercent).toBe(expected);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("YoY change is null when previous year total is 0", () => {
    fc.assert(
      fc.property(
        fc.record({
          currentYear: fc.integer({ min: 2021, max: 2025 }),
          kategori: fc.constantFrom(...KATEGORI_PPL_VALUES),
          currentYearItems: fc.array(
            fc.record({
              month: fc.integer({ min: 1, max: 12 }),
              day: fc.integer({ min: 1, max: 28 }),
              pendaftar: fc.integer({ min: 0, max: 99_999 }),
              realisasiHadir: fc.integer({ min: 1, max: 99_999 }),
            }),
            { minLength: 1, maxLength: 5 },
          ),
        }),
        ({ currentYear, kategori, currentYearItems }) => {
          // Only current year data, no previous year
          const kegiatan: KegiatanRow[] = currentYearItems.map((item) => ({
            kategoriPpl: kategori,
            tanggalMulai: `${currentYear}-${item.month.toString().padStart(2, "0")}-${item.day.toString().padStart(2, "0")}`,
            pendaftar: item.pendaftar,
            realisasiHadir: item.realisasiHadir,
          }));

          const results = computeYoYChange(kegiatan, currentYear);
          const entry = results.find((r) => r.kategori === kategori);

          // previousTotalHadir should be 0, so hadirChangePercent should be null
          if (entry) {
            expect(entry.previousTotalHadir).toBe(0);
            expect(entry.hadirChangePercent).toBeNull();
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("currentTotalHadir equals sum of realisasiHadir for current year", () => {
    fc.assert(
      fc.property(twoYearKegiatanArb, ({ kegiatan, currentYear, kategori }) => {
        const results = computeYoYChange(kegiatan, currentYear);
        const entry = results.find((r) => r.kategori === kategori);

        expect(entry).toBeDefined();

        const expectedCurrentTotal = kegiatan
          .filter(
            (k) =>
              k.kategoriPpl === kategori &&
              k.tanggalMulai.startsWith(`${currentYear}`),
          )
          .reduce((sum, k) => sum + k.realisasiHadir, 0);

        expect(entry!.currentTotalHadir).toBe(expectedCurrentTotal);
      }),
      { numRuns: 500 },
    );
  });

  it("previousTotalHadir equals sum of realisasiHadir for previous year", () => {
    fc.assert(
      fc.property(twoYearKegiatanArb, ({ kegiatan, currentYear, kategori }) => {
        const previousYear = currentYear - 1;
        const results = computeYoYChange(kegiatan, currentYear);
        const entry = results.find((r) => r.kategori === kategori);

        expect(entry).toBeDefined();

        const expectedPreviousTotal = kegiatan
          .filter(
            (k) =>
              k.kategoriPpl === kategori &&
              k.tanggalMulai.startsWith(`${previousYear}`),
          )
          .reduce((sum, k) => sum + k.realisasiHadir, 0);

        expect(entry!.previousTotalHadir).toBe(expectedPreviousTotal);
      }),
      { numRuns: 500 },
    );
  });

  it("positive change when current year total > previous year total (above rounding threshold)", () => {
    fc.assert(
      fc.property(twoYearKegiatanArb, ({ kegiatan, currentYear, kategori }) => {
        const results = computeYoYChange(kegiatan, currentYear);
        const entry = results.find((r) => r.kategori === kategori);

        if (
          entry &&
          entry.previousTotalHadir > 0 &&
          entry.currentTotalHadir > entry.previousTotalHadir
        ) {
          expect(entry.hadirChangePercent).not.toBeNull();
          // Due to rounding to 1 decimal, very small differences may round to 0
          expect(entry.hadirChangePercent!).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("negative change when current year total < previous year total (above rounding threshold)", () => {
    fc.assert(
      fc.property(twoYearKegiatanArb, ({ kegiatan, currentYear, kategori }) => {
        const results = computeYoYChange(kegiatan, currentYear);
        const entry = results.find((r) => r.kategori === kategori);

        if (
          entry &&
          entry.previousTotalHadir > 0 &&
          entry.currentTotalHadir < entry.previousTotalHadir
        ) {
          expect(entry.hadirChangePercent).not.toBeNull();
          // Due to rounding to 1 decimal, very small differences may round to 0
          expect(entry.hadirChangePercent!).toBeLessThanOrEqual(0);
        }
      }),
      { numRuns: 500 },
    );
  });
});
