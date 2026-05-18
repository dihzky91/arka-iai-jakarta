import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  computeGridAnalytics,
  computeChoiceAnalytics,
} from "@/server/lib/ppl-analytics";
import type { GridConfig } from "@/components/ppl-evaluasi/form-builder/types";

/**
 * **Validates: Requirements 6.2, 6.3, 6.4**
 *
 * Property 11: Grid Field Per-Row Analytics
 * For any set of grid responses with R rows and C columns, the computed analytics
 * SHALL produce R row results where each row's mean equals the arithmetic average
 * of that row's numeric values rounded to 2 decimal places, and each row's
 * distribution maps each column label to its selection count.
 *
 * Property 12: Choice Field Frequency Distribution
 * For any set of responses to a radio/select field, the frequency distribution
 * SHALL map each option to its count, and all percentages SHALL sum to 100%
 * (within rounding tolerance). For any set of responses to a checkbox field,
 * each option's percentage SHALL equal (option_count / total_respondents) × 100
 * rounded to 1 decimal place.
 */

// ─── GENERATORS ──────────────────────────────────────────────────────────────

/**
 * Generate a valid GridConfig with R rows and C columns.
 */
const gridConfigArb = fc
  .record({
    rowCount: fc.integer({ min: 1, max: 10 }),
    colCount: fc.integer({ min: 2, max: 7 }),
  })
  .chain(({ rowCount, colCount }) =>
    fc.record({
      rows: fc.array(
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
        { minLength: rowCount, maxLength: rowCount },
      ),
      columns: fc.array(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
        { minLength: colCount, maxLength: colCount },
      ),
    }),
  )
  .filter((config) => {
    // Ensure unique row labels and unique column labels
    const uniqueRows = new Set(config.rows);
    const uniqueCols = new Set(config.columns);
    return uniqueRows.size === config.rows.length && uniqueCols.size === config.columns.length;
  });

/**
 * Generate grid responses for a given config.
 * Each response maps row labels to column indices (0-based).
 */
function gridResponsesArb(config: GridConfig) {
  const responseArb = fc.record(
    Object.fromEntries(
      config.rows.map((rowLabel) => [
        rowLabel,
        fc.integer({ min: 0, max: config.columns.length - 1 }),
      ]),
    ),
  ) as fc.Arbitrary<Record<string, number>>;

  return fc.array(responseArb, { minLength: 1, maxLength: 30 });
}

/**
 * Generate a list of unique option labels for choice fields.
 */
const optionsArb = fc
  .array(
    fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
    { minLength: 2, maxLength: 8 },
  )
  .filter((opts) => new Set(opts).size === opts.length);

/**
 * Generate radio/select responses (single selection per respondent).
 */
function radioResponsesArb(options: string[]) {
  return fc.array(
    fc.integer({ min: 0, max: options.length - 1 }).map((idx) => [options[idx]]),
    { minLength: 1, maxLength: 50 },
  );
}

/**
 * Generate checkbox responses (multiple selections per respondent).
 */
function checkboxResponsesArb(options: string[]) {
  return fc.array(
    fc
      .subarray(options, { minLength: 1 })
      .map((selected) => selected),
    { minLength: 1, maxLength: 50 },
  );
}

// ─── PROPERTY 11: GRID FIELD PER-ROW ANALYTICS ───────────────────────────────

describe("Property 11: Grid Field Per-Row Analytics", () => {
  it("produces exactly R row results for R rows in config", () => {
    fc.assert(
      fc.property(gridConfigArb, (config) => {
        const responses = [
          Object.fromEntries(config.rows.map((r) => [r, 0])),
        ];
        const result = computeGridAnalytics(responses, config);
        expect(result.rows).toHaveLength(config.rows.length);
      }),
      { numRuns: 200 },
    );
  });

  it("each row's mean equals arithmetic average of that row's values rounded to 2 decimal places", () => {
    fc.assert(
      fc.property(
        gridConfigArb.chain((config) =>
          gridResponsesArb(config).map((responses) => ({ config, responses })),
        ),
        ({ config, responses }) => {
          const result = computeGridAnalytics(responses, config);

          for (let i = 0; i < config.rows.length; i++) {
            const rowLabel = config.rows[i];
            const rowValues: number[] = [];
            for (const response of responses) {
              const value = response[rowLabel];
              if (value !== undefined && value !== null) {
                rowValues.push(value);
              }
            }

            const expectedMean =
              rowValues.length > 0
                ? Math.round(
                    (rowValues.reduce((acc, v) => acc + v, 0) / rowValues.length) * 100,
                  ) / 100
                : 0;

            expect(result.rows[i].mean).toBe(expectedMean);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("each row's distribution maps each column label to its selection count", () => {
    fc.assert(
      fc.property(
        gridConfigArb.chain((config) =>
          gridResponsesArb(config).map((responses) => ({ config, responses })),
        ),
        ({ config, responses }) => {
          const result = computeGridAnalytics(responses, config);

          for (let i = 0; i < config.rows.length; i++) {
            const rowLabel = config.rows[i];
            const distribution = result.rows[i].distribution;

            // All column labels should be present in distribution
            for (const col of config.columns) {
              expect(col in distribution).toBe(true);
            }

            // Verify counts match actual selections
            const expectedCounts: Record<string, number> = {};
            for (const col of config.columns) {
              expectedCounts[col] = 0;
            }
            for (const response of responses) {
              const value = response[rowLabel];
              if (value !== undefined && value !== null) {
                const colLabel = config.columns[value];
                if (colLabel !== undefined) {
                  expectedCounts[colLabel]++;
                }
              }
            }

            for (const col of config.columns) {
              expect(distribution[col]).toBe(expectedCounts[col]);
            }
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("totalResponses equals the number of response objects provided", () => {
    fc.assert(
      fc.property(
        gridConfigArb.chain((config) =>
          gridResponsesArb(config).map((responses) => ({ config, responses })),
        ),
        ({ config, responses }) => {
          const result = computeGridAnalytics(responses, config);
          expect(result.totalResponses).toBe(responses.length);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("sum of distribution counts per row does not exceed total responses", () => {
    fc.assert(
      fc.property(
        gridConfigArb.chain((config) =>
          gridResponsesArb(config).map((responses) => ({ config, responses })),
        ),
        ({ config, responses }) => {
          const result = computeGridAnalytics(responses, config);

          for (const row of result.rows) {
            const totalCount = Object.values(row.distribution).reduce(
              (sum, count) => sum + count,
              0,
            );
            expect(totalCount).toBeLessThanOrEqual(responses.length);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});

// ─── PROPERTY 12: CHOICE FIELD FREQUENCY DISTRIBUTION ────────────────────────

describe("Property 12: Choice Field Frequency Distribution", () => {
  it("radio/select: all percentages sum to 100% within rounding tolerance", () => {
    fc.assert(
      fc.property(
        optionsArb.chain((options) =>
          radioResponsesArb(options).map((responses) => ({ options, responses })),
        ),
        ({ options, responses }) => {
          const result = computeChoiceAnalytics(responses, options, false);
          const totalPercentage = result.options.reduce(
            (sum, o) => sum + o.percentage,
            0,
          );
          // Allow rounding tolerance of ±1%
          expect(totalPercentage).toBeGreaterThanOrEqual(99);
          expect(totalPercentage).toBeLessThanOrEqual(101);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("radio/select: each option count matches actual occurrences", () => {
    fc.assert(
      fc.property(
        optionsArb.chain((options) =>
          radioResponsesArb(options).map((responses) => ({ options, responses })),
        ),
        ({ options, responses }) => {
          const result = computeChoiceAnalytics(responses, options, false);

          // Manually count occurrences
          const expectedCounts: Record<string, number> = {};
          for (const opt of options) {
            expectedCounts[opt] = 0;
          }
          for (const response of responses) {
            for (const selected of response) {
              if (selected in expectedCounts) {
                expectedCounts[selected]++;
              }
            }
          }

          for (const optResult of result.options) {
            expect(optResult.count).toBe(expectedCounts[optResult.label]);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("radio/select: sum of all counts equals total responses", () => {
    fc.assert(
      fc.property(
        optionsArb.chain((options) =>
          radioResponsesArb(options).map((responses) => ({ options, responses })),
        ),
        ({ options, responses }) => {
          const result = computeChoiceAnalytics(responses, options, false);
          const totalCount = result.options.reduce((sum, o) => sum + o.count, 0);
          expect(totalCount).toBe(responses.length);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("checkbox: each option percentage equals (count / totalRespondents) × 100 rounded to 1 decimal", () => {
    fc.assert(
      fc.property(
        optionsArb.chain((options) =>
          checkboxResponsesArb(options).map((responses) => ({
            options,
            responses,
          })),
        ),
        ({ options, responses }) => {
          const result = computeChoiceAnalytics(responses, options, true);
          const totalRespondents = responses.length;

          for (const optResult of result.options) {
            const expectedPercentage =
              totalRespondents > 0
                ? Math.round((optResult.count / totalRespondents) * 1000) / 10
                : 0;
            expect(optResult.percentage).toBe(expectedPercentage);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("checkbox: each option count matches actual selections across respondents", () => {
    fc.assert(
      fc.property(
        optionsArb.chain((options) =>
          checkboxResponsesArb(options).map((responses) => ({
            options,
            responses,
          })),
        ),
        ({ options, responses }) => {
          const result = computeChoiceAnalytics(responses, options, true);

          // Manually count occurrences
          const expectedCounts: Record<string, number> = {};
          for (const opt of options) {
            expectedCounts[opt] = 0;
          }
          for (const response of responses) {
            for (const selected of response) {
              if (selected in expectedCounts) {
                expectedCounts[selected]++;
              }
            }
          }

          for (const optResult of result.options) {
            expect(optResult.count).toBe(expectedCounts[optResult.label]);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("totalResponses equals the number of response arrays provided", () => {
    fc.assert(
      fc.property(
        optionsArb.chain((options) =>
          checkboxResponsesArb(options).map((responses) => ({
            options,
            responses,
          })),
        ),
        ({ options, responses }) => {
          const result = computeChoiceAnalytics(responses, options, true);
          expect(result.totalResponses).toBe(responses.length);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("all percentages are rounded to at most 1 decimal place", () => {
    fc.assert(
      fc.property(
        optionsArb.chain((options) =>
          radioResponsesArb(options).map((responses) => ({ options, responses })),
        ),
        ({ options, responses }) => {
          const result = computeChoiceAnalytics(responses, options, false);

          for (const optResult of result.options) {
            const decimalStr = optResult.percentage.toString();
            const decimalPart = decimalStr.split(".")[1];
            if (decimalPart) {
              expect(decimalPart.length).toBeLessThanOrEqual(1);
            }
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("checkbox: percentages can exceed 100% individually (multiple selections)", () => {
    // This is a structural property: for checkbox, individual percentages
    // are independent and can each be up to 100% (if everyone selects that option)
    fc.assert(
      fc.property(
        optionsArb.chain((options) =>
          checkboxResponsesArb(options).map((responses) => ({
            options,
            responses,
          })),
        ),
        ({ options, responses }) => {
          const result = computeChoiceAnalytics(responses, options, true);

          // Each individual percentage should be between 0 and 100
          for (const optResult of result.options) {
            expect(optResult.percentage).toBeGreaterThanOrEqual(0);
            expect(optResult.percentage).toBeLessThanOrEqual(100);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
