import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { computeConversionRate } from "@/lib/ppl-conversion-rate";

/**
 * **Validates: Requirements 5.3, 5.4**
 *
 * Property 9: Conversion Rate Calculation
 * For any Kegiatan with pendaftar > 0 and realisasiHadir ≥ 0, the Conversion_Rate
 * SHALL equal round((realisasiHadir / pendaftar) × 100, 1).
 * For any Kegiatan with pendaftar = 0, the Conversion_Rate SHALL be null (displayed as "N/A").
 */
describe("Property 9: Conversion Rate Calculation", () => {
  it("conversion rate equals round((realisasiHadir / pendaftar) × 100, 1) when pendaftar > 0", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99_999 }),   // pendaftar > 0
        fc.integer({ min: 0, max: 99_999 }),   // realisasiHadir ≥ 0
        (pendaftar, realisasiHadir) => {
          const result = computeConversionRate(pendaftar, realisasiHadir);
          const expected = Math.round((realisasiHadir / pendaftar) * 1000) / 10;
          expect(result).toBe(expected);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("conversion rate is null when pendaftar is 0", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99_999 }), // realisasiHadir
        (realisasiHadir) => {
          const result = computeConversionRate(0, realisasiHadir);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("conversion rate still calculates when realisasiHadir > pendaftar (can exceed 100%)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99_998 }),   // pendaftar
        fc.integer({ min: 1, max: 99_998 }),   // offset to add
        (pendaftar, offset) => {
          const realisasiHadir = Math.min(pendaftar + offset, 99_999);
          const result = computeConversionRate(pendaftar, realisasiHadir);
          // Should still return a valid number (not null, not error)
          expect(result).not.toBeNull();
          expect(result!).toBeGreaterThanOrEqual(100);
          // Verify the formula still applies correctly
          const expected = Math.round((realisasiHadir / pendaftar) * 1000) / 10;
          expect(result).toBe(expected);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("conversion rate is always non-negative when inputs are non-negative", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99_999 }),
        fc.integer({ min: 0, max: 99_999 }),
        (pendaftar, realisasiHadir) => {
          const result = computeConversionRate(pendaftar, realisasiHadir);
          expect(result).not.toBeNull();
          expect(result!).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("conversion rate is rounded to exactly 1 decimal place", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99_999 }),
        fc.integer({ min: 0, max: 99_999 }),
        (pendaftar, realisasiHadir) => {
          const result = computeConversionRate(pendaftar, realisasiHadir);
          expect(result).not.toBeNull();
          // Check that the result has at most 1 decimal place
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
