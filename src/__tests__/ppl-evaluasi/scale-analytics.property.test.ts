import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { computeScaleAnalytics } from "@/server/lib/ppl-analytics";

/**
 * **Validates: Requirements 6.1**
 *
 * Property 10: Scale Field Statistical Analytics
 * For any non-empty array of integer values within a scale range, the computed analytics SHALL satisfy:
 * (a) mean equals the arithmetic average rounded to 2 decimal places,
 * (b) median equals the middle value (or average of two middle values) of the sorted array,
 * (c) standard deviation equals the population standard deviation rounded to 2 decimal places,
 * (d) distribution maps each unique value to its occurrence count, and
 * (e) sum of all distribution counts equals the array length.
 */
describe("Property 10: Scale Field Statistical Analytics", () => {
  // Generator for non-empty arrays of integers within a typical scale range (1-10)
  const scaleValuesArb = fc.array(fc.integer({ min: 1, max: 10 }), {
    minLength: 1,
    maxLength: 200,
  });

  it("(a) mean equals the arithmetic average rounded to 2 decimal places", () => {
    fc.assert(
      fc.property(scaleValuesArb, (values) => {
        const result = computeScaleAnalytics(values);
        const sum = values.reduce((acc, v) => acc + v, 0);
        const expectedMean = Math.round((sum / values.length) * 100) / 100;
        expect(result.mean).toBe(expectedMean);
      }),
      { numRuns: 1000 },
    );
  });

  it("(b) median equals the middle value (or average of two middle values) of the sorted array", () => {
    fc.assert(
      fc.property(scaleValuesArb, (values) => {
        const result = computeScaleAnalytics(values);
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const expectedMedian =
          sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
        expect(result.median).toBe(expectedMedian);
      }),
      { numRuns: 1000 },
    );
  });

  it("(c) standard deviation equals the population standard deviation rounded to 2 decimal places", () => {
    fc.assert(
      fc.property(scaleValuesArb, (values) => {
        const result = computeScaleAnalytics(values);
        const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
        const squaredDiffs = values.reduce(
          (acc, v) => acc + (v - mean) ** 2,
          0,
        );
        const expectedStdDev =
          Math.round(Math.sqrt(squaredDiffs / values.length) * 100) / 100;
        expect(result.stdDev).toBe(expectedStdDev);
      }),
      { numRuns: 1000 },
    );
  });

  it("(d) distribution maps each unique value to its occurrence count", () => {
    fc.assert(
      fc.property(scaleValuesArb, (values) => {
        const result = computeScaleAnalytics(values);
        // Build expected distribution
        const expectedDist: Record<number, number> = {};
        for (const v of values) {
          expectedDist[v] = (expectedDist[v] ?? 0) + 1;
        }
        // Every unique value in input should appear in distribution with correct count
        for (const [key, count] of Object.entries(expectedDist)) {
          expect(result.distribution[Number(key)]).toBe(count);
        }
        // Distribution should not contain keys not in the input
        for (const key of Object.keys(result.distribution)) {
          expect(expectedDist[Number(key)]).toBeDefined();
        }
      }),
      { numRuns: 1000 },
    );
  });

  it("(e) sum of all distribution counts equals the array length", () => {
    fc.assert(
      fc.property(scaleValuesArb, (values) => {
        const result = computeScaleAnalytics(values);
        const totalCount = Object.values(result.distribution).reduce(
          (acc, count) => acc + count,
          0,
        );
        expect(totalCount).toBe(values.length);
      }),
      { numRuns: 1000 },
    );
  });

  it("mean is always within the scale range [min, max] of input values", () => {
    fc.assert(
      fc.property(scaleValuesArb, (values) => {
        const result = computeScaleAnalytics(values);
        const min = Math.min(...values);
        const max = Math.max(...values);
        expect(result.mean).toBeGreaterThanOrEqual(min);
        expect(result.mean).toBeLessThanOrEqual(max);
      }),
      { numRuns: 500 },
    );
  });

  it("median is always within the scale range [min, max] of input values", () => {
    fc.assert(
      fc.property(scaleValuesArb, (values) => {
        const result = computeScaleAnalytics(values);
        const min = Math.min(...values);
        const max = Math.max(...values);
        expect(result.median).toBeGreaterThanOrEqual(min);
        expect(result.median).toBeLessThanOrEqual(max);
      }),
      { numRuns: 500 },
    );
  });

  it("standard deviation is zero when all values are identical", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 100 }),
        (value, count) => {
          const values = Array(count).fill(value);
          const result = computeScaleAnalytics(values);
          expect(result.stdDev).toBe(0);
          expect(result.mean).toBe(value);
          expect(result.median).toBe(value);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("standard deviation is non-negative for any input", () => {
    fc.assert(
      fc.property(scaleValuesArb, (values) => {
        const result = computeScaleAnalytics(values);
        expect(result.stdDev).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 500 },
    );
  });
});
