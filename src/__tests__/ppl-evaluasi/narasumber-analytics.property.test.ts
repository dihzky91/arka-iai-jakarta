import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  extractNumericScores,
  computeAverageScore,
  computeCompletedKegiatanStats,
  buildScoreTrend,
  rankSpeakersByScore,
  filterAssignmentsByCategory,
  computeSpeakerPerformance,
  type NarasumberAssignment,
  type KegiatanEvalData,
  type NarasumberInfo,
  type SpeakerPerformanceEntry,
} from "@/lib/ppl-narasumber-analytics";
import type { FormField } from "@/components/ppl-evaluasi/form-builder/types";

// ─── GENERATORS ──────────────────────────────────────────────────────────────

const KATEGORI_PPL_VALUES = [
  "Perpajakan",
  "Sistem Informasi & Softskill",
  "Akuntansi Keuangan",
  "Audit",
  "Akuntansi Syariah",
  "Akuntansi Manajemen",
] as const;

/** Generate a valid date string in YYYY-MM-DD format */
const dateArb = fc
  .record({
    year: fc.integer({ min: 2020, max: 2025 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
  })
  .map(({ year, month, day }) => {
    const m = month.toString().padStart(2, "0");
    const d = day.toString().padStart(2, "0");
    return `${year}-${m}-${d}`;
  });

/** Generate a scale FormField */
const scaleFieldArb: fc.Arbitrary<FormField> = fc
  .record({
    id: fc.string({ minLength: 3, maxLength: 10 }).filter((s) => /^[a-z0-9]+$/.test(s)),
    label: fc.string({ minLength: 1, maxLength: 50 }),
  })
  .map(({ id, label }) => ({
    id,
    type: "scale" as const,
    label,
    required: true,
    order: 0,
    config: { min: 1, max: 5, minLabel: "Low", maxLabel: "High" },
  }));

/** Generate a grid FormField with row labels */
const gridFieldArb: fc.Arbitrary<FormField> = fc
  .record({
    id: fc.string({ minLength: 3, maxLength: 10 }).filter((s) => /^[a-z0-9]+$/.test(s)),
    label: fc.string({ minLength: 1, maxLength: 50 }),
    rows: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
    columns: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 5 }),
  })
  .map(({ id, label, rows, columns }) => ({
    id,
    type: "grid" as const,
    label,
    required: true,
    order: 0,
    config: { rows, columns },
  }));

/** Generate evaluation responses with scale values for a kegiatan */
function genScaleResponses(
  fields: FormField[],
  count: number,
): fc.Arbitrary<KegiatanEvalData[]> {
  return fc
    .array(
      fc.record({
        answers: fc.dictionary(
          fc.constantFrom(...fields.map((f) => f.id)),
          fc.integer({ min: 1, max: 5 }),
        ),
      }),
      { minLength: count, maxLength: count },
    )
    .map((items) =>
      items.map((item) => ({
        kegiatanId: 0, // will be set by caller
        configJson: fields,
        answersJson: item.answers as Record<string, unknown>,
      })),
    );
}

/** Generate a NarasumberAssignment */
const assignmentArb = (narasumberId: number): fc.Arbitrary<NarasumberAssignment> =>
  fc.record({
    narasumberId: fc.constant(narasumberId),
    kegiatanId: fc.integer({ min: 1, max: 1000 }),
    kegiatanNama: fc.string({ minLength: 3, maxLength: 30 }),
    kategoriPpl: fc.constantFrom(...KATEGORI_PPL_VALUES),
    tanggalSelesai: dateArb,
    skp: fc.integer({ min: 1, max: 100 }),
    statusEvent: fc.constantFrom("aktif", "archived"),
  });

// ─── PROPERTY 23: Narasumber Average Evaluation Score ────────────────────────

/**
 * **Validates: Requirements 10.1**
 *
 * Property 23: Narasumber Average Evaluation Score
 * For any Narasumber with linked evaluation responses containing Likert_Scale
 * and Grid_Field numeric values, the average score SHALL equal the arithmetic
 * mean of all such numeric values across all linked Kegiatan responses.
 */
describe("Property 23: Narasumber Average Evaluation Score", () => {
  it("average score equals arithmetic mean of all scale numeric values", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 1, maxLength: 50 }),
        (values) => {
          const avg = computeAverageScore(values);
          const expectedSum = values.reduce((s, v) => s + v, 0);
          const expectedMean = Math.round((expectedSum / values.length) * 100) / 100;
          expect(avg).toBe(expectedMean);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("returns null when no numeric values exist", () => {
    const result = computeAverageScore([]);
    expect(result).toBeNull();
  });

  it("extractNumericScores extracts all scale and grid values from responses", () => {
    fc.assert(
      fc.property(
        fc.record({
          scaleId: fc.string({ minLength: 3, maxLength: 8 }).filter((s) => /^[a-z]+$/.test(s)),
          gridId: fc.string({ minLength: 3, maxLength: 8 }).filter((s) => /^[a-z]+$/.test(s)),
          scaleVal: fc.integer({ min: 1, max: 5 }),
          gridVals: fc.dictionary(
            fc.constantFrom("row0", "row1", "row2"),
            fc.integer({ min: 1, max: 5 }),
            { minKeys: 1, maxKeys: 3 },
          ),
        }).filter(({ scaleId, gridId }) => scaleId !== gridId),
        ({ scaleId, gridId, scaleVal, gridVals }) => {
          const fields: FormField[] = [
            { id: scaleId, type: "scale", label: "Scale", required: true, order: 0, config: { min: 1, max: 5, minLabel: "L", maxLabel: "H" } },
            { id: gridId, type: "grid", label: "Grid", required: true, order: 1, config: { rows: ["row0", "row1", "row2"], columns: ["1", "2", "3", "4", "5"] } },
          ];
          const responses: KegiatanEvalData[] = [{
            kegiatanId: 1,
            configJson: fields,
            answersJson: { [scaleId]: scaleVal, [gridId]: gridVals },
          }];

          const scores = extractNumericScores(responses);
          // Should contain the scale value + all grid values
          const expectedCount = 1 + Object.keys(gridVals).length;
          expect(scores.length).toBe(expectedCount);
          expect(scores).toContain(scaleVal);
          for (const v of Object.values(gridVals)) {
            expect(scores).toContain(v);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("average score across multiple responses equals mean of all extracted values", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            scaleVal: fc.integer({ min: 1, max: 5 }),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        (items) => {
          const fieldId = "field1";
          const fields: FormField[] = [
            { id: fieldId, type: "scale", label: "Q", required: true, order: 0, config: { min: 1, max: 5, minLabel: "L", maxLabel: "H" } },
          ];
          const responses: KegiatanEvalData[] = items.map((item) => ({
            kegiatanId: 1,
            configJson: fields,
            answersJson: { [fieldId]: item.scaleVal },
          }));

          const scores = extractNumericScores(responses);
          const avg = computeAverageScore(scores);

          const expectedSum = items.reduce((s, i) => s + i.scaleVal, 0);
          const expectedMean = Math.round((expectedSum / items.length) * 100) / 100;
          expect(avg).toBe(expectedMean);
        },
      ),
      { numRuns: 500 },
    );
  });
});

// ─── PROPERTY 24: Narasumber Ranking Sorted Descending ───────────────────────

/**
 * **Validates: Requirements 10.2**
 *
 * Property 24: Narasumber Ranking Sorted Descending
 * For any set of Narasumber with evaluation data, the ranking SHALL be sorted
 * in descending order by average evaluation score.
 */
describe("Property 24: Narasumber Ranking Sorted Descending", () => {
  /** Generate a list of speakers with varying scores */
  const speakersArb: fc.Arbitrary<SpeakerPerformanceEntry[]> = fc
    .array(
      fc.record({
        narasumberId: fc.integer({ min: 1, max: 1000 }),
        nama: fc.string({ minLength: 3, maxLength: 20 }),
        email: fc.string({ minLength: 5, maxLength: 30 }),
        avgScore: fc.oneof(
          fc.double({ min: 1, max: 5, noNaN: true }).map((v) => Math.round(v * 100) / 100),
          fc.constant(null as number | null),
        ),
        kegiatanCount: fc.integer({ min: 0, max: 20 }),
        totalSkp: fc.integer({ min: 0, max: 500 }),
        respondenCount: fc.integer({ min: 0, max: 100 }),
      }),
      { minLength: 2, maxLength: 20 },
    )
    .map((items) =>
      items.map((item) => ({
        ...item,
        trend: [],
        hasEvaluationData: item.avgScore !== null,
      })),
    );

  it("ranking is sorted in descending order by avgScore", () => {
    fc.assert(
      fc.property(speakersArb, (speakers) => {
        const ranked = rankSpeakersByScore(speakers);

        for (let i = 0; i < ranked.length - 1; i++) {
          const current = ranked[i]!;
          const next = ranked[i + 1]!;

          // Speakers with scores come before speakers without scores
          if (current.avgScore !== null && next.avgScore !== null) {
            expect(current.avgScore).toBeGreaterThanOrEqual(next.avgScore);
          } else if (current.avgScore === null) {
            // If current is null, next must also be null
            expect(next.avgScore).toBeNull();
          }
        }
      }),
      { numRuns: 500 },
    );
  });

  it("speakers without evaluation data are placed at the end", () => {
    fc.assert(
      fc.property(speakersArb, (speakers) => {
        const ranked = rankSpeakersByScore(speakers);

        let foundNull = false;
        for (const speaker of ranked) {
          if (speaker.avgScore === null) {
            foundNull = true;
          } else if (foundNull) {
            // A non-null score after a null score means incorrect ordering
            expect(foundNull).toBe(false);
          }
        }
      }),
      { numRuns: 500 },
    );
  });

  it("ranking preserves all speakers (no data lost)", () => {
    fc.assert(
      fc.property(speakersArb, (speakers) => {
        const ranked = rankSpeakersByScore(speakers);
        expect(ranked.length).toBe(speakers.length);
      }),
      { numRuns: 500 },
    );
  });
});

// ─── PROPERTY 25: Narasumber Kegiatan Count and SKP Sum ──────────────────────

/**
 * **Validates: Requirements 10.3**
 *
 * Property 25: Narasumber Kegiatan Count and SKP Sum
 * For any Narasumber, the completed Kegiatan count SHALL equal the number of
 * assigned Kegiatan with status "archived" or past tanggal_selesai, and the
 * total SKP SHALL equal the sum of SKP values from those Kegiatan.
 */
describe("Property 25: Narasumber Kegiatan Count and SKP Sum", () => {
  const assignmentsArb = fc.array(
    fc.record({
      narasumberId: fc.constant(1),
      kegiatanId: fc.integer({ min: 1, max: 100 }),
      kegiatanNama: fc.string({ minLength: 3, maxLength: 20 }),
      kategoriPpl: fc.constantFrom(...KATEGORI_PPL_VALUES),
      tanggalSelesai: dateArb,
      skp: fc.integer({ min: 1, max: 100 }),
      statusEvent: fc.constantFrom("aktif", "archived"),
    }),
    { minLength: 1, maxLength: 20 },
  );

  it("kegiatanCount equals number of archived or past-date assignments", () => {
    fc.assert(
      fc.property(assignmentsArb, dateArb, (assignments, today) => {
        const { kegiatanCount } = computeCompletedKegiatanStats(assignments, today);

        const expectedCount = assignments.filter(
          (a) => a.statusEvent === "archived" || a.tanggalSelesai <= today,
        ).length;

        expect(kegiatanCount).toBe(expectedCount);
      }),
      { numRuns: 500 },
    );
  });

  it("totalSkp equals sum of SKP from completed assignments", () => {
    fc.assert(
      fc.property(assignmentsArb, dateArb, (assignments, today) => {
        const { totalSkp } = computeCompletedKegiatanStats(assignments, today);

        const expectedSkp = assignments
          .filter((a) => a.statusEvent === "archived" || a.tanggalSelesai <= today)
          .reduce((sum, a) => sum + a.skp, 0);

        expect(totalSkp).toBe(expectedSkp);
      }),
      { numRuns: 500 },
    );
  });

  it("all archived assignments are always counted regardless of date", () => {
    fc.assert(
      fc.property(assignmentsArb, (assignments) => {
        // Use a very early date so only archived ones pass the date check
        const farFuture = "2099-12-31";
        const { kegiatanCount } = computeCompletedKegiatanStats(assignments, "2000-01-01");

        // Only archived should be counted when today is very early
        const archivedCount = assignments.filter(
          (a) => a.statusEvent === "archived",
        ).length;

        // kegiatanCount should be >= archivedCount (some may also have past dates)
        expect(kegiatanCount).toBeGreaterThanOrEqual(archivedCount);
      }),
      { numRuns: 300 },
    );
  });

  it("future aktif assignments are not counted as completed", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            narasumberId: fc.constant(1),
            kegiatanId: fc.integer({ min: 1, max: 100 }),
            kegiatanNama: fc.string({ minLength: 3, maxLength: 20 }),
            kategoriPpl: fc.constantFrom(...KATEGORI_PPL_VALUES),
            tanggalSelesai: fc.constant("2099-12-31"),
            skp: fc.integer({ min: 1, max: 100 }),
            statusEvent: fc.constant("aktif" as const),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (assignments) => {
          const { kegiatanCount, totalSkp } = computeCompletedKegiatanStats(
            assignments,
            "2024-06-15",
          );
          expect(kegiatanCount).toBe(0);
          expect(totalSkp).toBe(0);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ─── PROPERTY 26: Narasumber Score Trend Chronological Order ─────────────────

/**
 * **Validates: Requirements 10.4**
 *
 * Property 26: Narasumber Score Trend Chronological Order
 * For any Narasumber with ≥ 2 Kegiatan, the evaluation score trend SHALL be
 * ordered chronologically by tanggal_selesai.
 */
describe("Property 26: Narasumber Score Trend Chronological Order", () => {
  it("trend entries are sorted chronologically by tanggal_selesai", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            kegiatanId: fc.integer({ min: 1, max: 100 }),
            tanggalSelesai: dateArb,
            scaleVal: fc.integer({ min: 1, max: 5 }),
          }),
          { minLength: 2, maxLength: 15 },
        ).filter((items) => {
          // Ensure unique kegiatanIds
          const ids = new Set(items.map((i) => i.kegiatanId));
          return ids.size === items.length;
        }),
        (items) => {
          const fieldId = "evalfield";
          const fields: FormField[] = [
            { id: fieldId, type: "scale", label: "Eval", required: true, order: 0, config: { min: 1, max: 5, minLabel: "L", maxLabel: "H" } },
          ];

          const assignments: NarasumberAssignment[] = items.map((item) => ({
            narasumberId: 1,
            kegiatanId: item.kegiatanId,
            kegiatanNama: `Kegiatan ${item.kegiatanId}`,
            kategoriPpl: "Perpajakan",
            tanggalSelesai: item.tanggalSelesai,
            skp: 8,
            statusEvent: "archived",
          }));

          const evalDataByKegiatan = new Map<number, KegiatanEvalData[]>();
          for (const item of items) {
            evalDataByKegiatan.set(item.kegiatanId, [{
              kegiatanId: item.kegiatanId,
              configJson: fields,
              answersJson: { [fieldId]: item.scaleVal },
            }]);
          }

          const trend = buildScoreTrend(assignments, evalDataByKegiatan);

          // Verify chronological order
          for (let i = 0; i < trend.length - 1; i++) {
            expect(trend[i]!.tanggalSelesai <= trend[i + 1]!.tanggalSelesai).toBe(true);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("trend includes only kegiatan with evaluation data", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            kegiatanId: fc.integer({ min: 1, max: 100 }),
            tanggalSelesai: dateArb,
            hasData: fc.boolean(),
            scaleVal: fc.integer({ min: 1, max: 5 }),
          }),
          { minLength: 2, maxLength: 10 },
        ).filter((items) => {
          const ids = new Set(items.map((i) => i.kegiatanId));
          return ids.size === items.length;
        }),
        (items) => {
          const fieldId = "evalfield";
          const fields: FormField[] = [
            { id: fieldId, type: "scale", label: "Eval", required: true, order: 0, config: { min: 1, max: 5, minLabel: "L", maxLabel: "H" } },
          ];

          const assignments: NarasumberAssignment[] = items.map((item) => ({
            narasumberId: 1,
            kegiatanId: item.kegiatanId,
            kegiatanNama: `Kegiatan ${item.kegiatanId}`,
            kategoriPpl: "Perpajakan",
            tanggalSelesai: item.tanggalSelesai,
            skp: 8,
            statusEvent: "archived",
          }));

          const evalDataByKegiatan = new Map<number, KegiatanEvalData[]>();
          for (const item of items) {
            if (item.hasData) {
              evalDataByKegiatan.set(item.kegiatanId, [{
                kegiatanId: item.kegiatanId,
                configJson: fields,
                answersJson: { [fieldId]: item.scaleVal },
              }]);
            }
          }

          const trend = buildScoreTrend(assignments, evalDataByKegiatan);
          const expectedCount = items.filter((i) => i.hasData).length;
          expect(trend.length).toBe(expectedCount);
        },
      ),
      { numRuns: 500 },
    );
  });
});

// ─── PROPERTY 27: Category Filter Correctness ────────────────────────────────

/**
 * **Validates: Requirements 10.5**
 *
 * Property 27: Category Filter Correctness
 * For any Kategori_PPL filter applied to narasumber performance data, the result
 * SHALL include only Kegiatan assignments matching the specified category.
 */
describe("Property 27: Category Filter Correctness", () => {
  const mixedAssignmentsArb = fc.array(
    fc.record({
      narasumberId: fc.integer({ min: 1, max: 5 }),
      kegiatanId: fc.integer({ min: 1, max: 100 }),
      kegiatanNama: fc.string({ minLength: 3, maxLength: 20 }),
      kategoriPpl: fc.constantFrom(...KATEGORI_PPL_VALUES),
      tanggalSelesai: dateArb,
      skp: fc.integer({ min: 1, max: 100 }),
      statusEvent: fc.constantFrom("aktif", "archived"),
    }),
    { minLength: 1, maxLength: 30 },
  );

  it("filtered result includes only assignments matching the specified category", () => {
    fc.assert(
      fc.property(
        mixedAssignmentsArb,
        fc.constantFrom(...KATEGORI_PPL_VALUES),
        (assignments, kategori) => {
          const filtered = filterAssignmentsByCategory(assignments, kategori);

          for (const a of filtered) {
            expect(a.kategoriPpl).toBe(kategori);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("filtered result excludes all assignments with different categories", () => {
    fc.assert(
      fc.property(
        mixedAssignmentsArb,
        fc.constantFrom(...KATEGORI_PPL_VALUES),
        (assignments, kategori) => {
          const filtered = filterAssignmentsByCategory(assignments, kategori);
          const excluded = assignments.filter((a) => a.kategoriPpl !== kategori);

          // None of the excluded items should appear in the filtered result
          for (const ex of excluded) {
            expect(filtered).not.toContain(ex);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("filtered count equals count of assignments with matching category", () => {
    fc.assert(
      fc.property(
        mixedAssignmentsArb,
        fc.constantFrom(...KATEGORI_PPL_VALUES),
        (assignments, kategori) => {
          const filtered = filterAssignmentsByCategory(assignments, kategori);
          const expectedCount = assignments.filter(
            (a) => a.kategoriPpl === kategori,
          ).length;
          expect(filtered.length).toBe(expectedCount);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("filtering with a category not in assignments returns empty array", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            narasumberId: fc.constant(1),
            kegiatanId: fc.integer({ min: 1, max: 100 }),
            kegiatanNama: fc.string({ minLength: 3, maxLength: 20 }),
            kategoriPpl: fc.constant("Perpajakan"),
            tanggalSelesai: dateArb,
            skp: fc.integer({ min: 1, max: 100 }),
            statusEvent: fc.constantFrom("aktif", "archived"),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (assignments) => {
          const filtered = filterAssignmentsByCategory(assignments, "Audit");
          expect(filtered.length).toBe(0);
        },
      ),
      { numRuns: 200 },
    );
  });
});
