import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { computeResponseRate } from "@/lib/ppl-response-rate";

/**
 * **Validates: Requirements 6.6, 6.7**
 *
 * Property 13: Response Rate Calculation
 * For any Kegiatan with realisasiHadir > 0 and responden count R, the response rate
 * SHALL equal round((R / realisasiHadir) × 100, 1).
 * For any Kegiatan with realisasiHadir = 0, the response rate SHALL be null.
 */
describe("Property 13: Response Rate Calculation", () => {
  it("response rate equals round((R / realisasiHadir) × 100, 1) when realisasiHadir > 0", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99_999 }),   // realisasiHadir > 0
        fc.integer({ min: 0, max: 99_999 }),   // respondenCount ≥ 0
        (realisasiHadir, respondenCount) => {
          const result = computeResponseRate(realisasiHadir, respondenCount);
          const expected = Math.round((respondenCount / realisasiHadir) * 1000) / 10;
          expect(result).toBe(expected);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("response rate is null when realisasiHadir is 0", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99_999 }), // respondenCount
        (respondenCount) => {
          const result = computeResponseRate(0, respondenCount);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("response rate can exceed 100% when respondenCount > realisasiHadir", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99_998 }),   // realisasiHadir
        fc.integer({ min: 1, max: 99_998 }),   // offset to add
        (realisasiHadir, offset) => {
          const respondenCount = Math.min(realisasiHadir + offset, 99_999);
          const result = computeResponseRate(realisasiHadir, respondenCount);
          expect(result).not.toBeNull();
          expect(result!).toBeGreaterThanOrEqual(100);
          const expected = Math.round((respondenCount / realisasiHadir) * 1000) / 10;
          expect(result).toBe(expected);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("response rate is always non-negative when inputs are non-negative", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99_999 }),
        fc.integer({ min: 0, max: 99_999 }),
        (realisasiHadir, respondenCount) => {
          const result = computeResponseRate(realisasiHadir, respondenCount);
          expect(result).not.toBeNull();
          expect(result!).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("response rate is rounded to exactly 1 decimal place", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99_999 }),
        fc.integer({ min: 0, max: 99_999 }),
        (realisasiHadir, respondenCount) => {
          const result = computeResponseRate(realisasiHadir, respondenCount);
          expect(result).not.toBeNull();
          const decimalStr = result!.toString();
          const decimalPart = decimalStr.split(".")[1];
          if (decimalPart) {
            expect(decimalPart.length).toBeLessThanOrEqual(1);
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});
