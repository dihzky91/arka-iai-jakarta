import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { calculateHonorarium } from "@/lib/ppl-honorarium";

/**
 * **Validates: Requirements 2.5**
 *
 * Property 3: Honorarium Calculation
 * For any Narasumber with fee_per_skp F assigned to a Kegiatan with SKP value S,
 * the total Honorarium SHALL equal F × S.
 */
describe("Property 3: Honorarium Calculation", () => {
  it("totalHonorarium always equals feePerSkp × SKP", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99_999_999 }), // feePerSkp
        fc.integer({ min: 1, max: 999 }),          // SKP
        (feePerSkp, skp) => {
          const result = calculateHonorarium(feePerSkp, skp);
          expect(result).toBe(feePerSkp * skp);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("honorarium is zero when feePerSkp is zero", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999 }), // SKP
        (skp) => {
          const result = calculateHonorarium(0, skp);
          expect(result).toBe(0);
        },
      ),
    );
  });

  it("honorarium is non-negative for all valid inputs", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99_999_999 }),
        fc.integer({ min: 1, max: 999 }),
        (feePerSkp, skp) => {
          const result = calculateHonorarium(feePerSkp, skp);
          expect(result).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 1000 },
    );
  });
});
