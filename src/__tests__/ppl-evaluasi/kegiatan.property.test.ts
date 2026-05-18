import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { differenceInCalendarDays } from "date-fns";
import { createKegiatanSchema } from "@/lib/validators/ppl-evaluasi";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Replicates the calculateSkp logic from src/server/actions/ppl-evaluasi/kegiatan.ts
 * Formula: (differenceInCalendarDays(tanggalSelesai, tanggalMulai) + 1) × 8
 */
function calculateSkp(tanggalMulai: string, tanggalSelesai: string): number {
  const start = new Date(tanggalMulai);
  const end = new Date(tanggalSelesai);
  const days = differenceInCalendarDays(end, start) + 1;
  return days * 8;
}

/**
 * Format a date from year/month/day integers to YYYY-MM-DD string.
 * Using integers directly avoids Date object timezone issues.
 */
function toDateString(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Days in a given month (handles leap years) */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// ─── GENERATORS ──────────────────────────────────────────────────────────────

/** Generate a valid YYYY-MM-DD date string */
const dateArb = fc
  .tuple(
    fc.integer({ min: 2020, max: 2030 }), // year
    fc.integer({ min: 1, max: 12 }) // month
  )
  .chain(([year, month]) =>
    fc
      .integer({ min: 1, max: daysInMonth(year, month) })
      .map((day) => ({ year, month, day }))
  );

/** Generate a valid date pair where tanggalSelesai >= tanggalMulai */
const validDatePair = dateArb.chain((start) => {
  const startStr = toDateString(start.year, start.month, start.day);
  // Generate an offset of 0-365 days, then compute end date
  return fc.integer({ min: 0, max: 365 }).map((offsetDays) => {
    const startDate = new Date(start.year, start.month - 1, start.day);
    const endDate = new Date(
      startDate.getTime() + offsetDays * 24 * 60 * 60 * 1000
    );
    const endStr = toDateString(
      endDate.getFullYear(),
      endDate.getMonth() + 1,
      endDate.getDate()
    );
    return { tanggalMulai: startStr, tanggalSelesai: endStr };
  });
});

/** Generate an invalid date pair where tanggalSelesai < tanggalMulai */
const invalidDatePair = dateArb
  .filter((d) => !(d.year === 2020 && d.month === 1 && d.day === 1)) // ensure we can go back at least 1 day
  .chain((start) => {
    const startStr = toDateString(start.year, start.month, start.day);
    return fc.integer({ min: 1, max: 365 }).map((offsetDays) => {
      const startDate = new Date(start.year, start.month - 1, start.day);
      const endDate = new Date(
        startDate.getTime() - offsetDays * 24 * 60 * 60 * 1000
      );
      const endStr = toDateString(
        endDate.getFullYear(),
        endDate.getMonth() + 1,
        endDate.getDate()
      );
      return { tanggalMulai: startStr, tanggalSelesai: endStr };
    });
  });

/** Generate a valid base kegiatan input (without skp) */
const validBaseKegiatan = (dates: {
  tanggalMulai: string;
  tanggalSelesai: string;
}) =>
  fc.record({
    namaKegiatan: fc.string({ minLength: 1, maxLength: 255 }),
    kategoriPpl: fc.constantFrom(
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
      "SAK & PSAK"
    ),
    tipePelaksanaan: fc.constantFrom("online", "offline", "hybrid"),
    tanggalMulai: fc.constant(dates.tanggalMulai),
    tanggalSelesai: fc.constant(dates.tanggalSelesai),
  });

/**
 * Property 1: SKP Auto-Calculation
 * Validates: Requirements 1.4
 *
 * For any valid date pair where tanggalSelesai >= tanggalMulai, the auto-calculated
 * SKP SHALL equal (differenceInCalendarDays(tanggalSelesai, tanggalMulai) + 1) × 8.
 * If a manual SKP value between 1 and 999 is provided, the stored SKP SHALL equal
 * the manual value.
 */
describe("Property 1: SKP Auto-Calculation", () => {
  it("SHALL auto-calculate SKP as (days + 1) × 8 for any valid date pair", () => {
    fc.assert(
      fc.property(validDatePair, (dates) => {
        const skp = calculateSkp(dates.tanggalMulai, dates.tanggalSelesai);
        const start = new Date(dates.tanggalMulai);
        const end = new Date(dates.tanggalSelesai);
        const expectedDays = differenceInCalendarDays(end, start) + 1;
        const expectedSkp = expectedDays * 8;

        expect(skp).toBe(expectedSkp);
        // SKP must always be positive for valid date pairs
        expect(skp).toBeGreaterThanOrEqual(8); // minimum 1 day × 8
      }),
      { numRuns: 500 }
    );
  });

  it("SHALL produce SKP = 8 when tanggalMulai equals tanggalSelesai (single day)", () => {
    fc.assert(
      fc.property(dateArb, (d) => {
        const dateStr = toDateString(d.year, d.month, d.day);
        const skp = calculateSkp(dateStr, dateStr);
        // 1 day × 8 = 8
        expect(skp).toBe(8);
      }),
      { numRuns: 200 }
    );
  });

  it("SHALL produce SKP proportional to duration (multi-day events)", () => {
    fc.assert(
      fc.property(
        dateArb.chain((start) => {
          return fc.integer({ min: 1, max: 30 }).map((durationDays) => {
            const startDate = new Date(start.year, start.month - 1, start.day);
            const endDate = new Date(
              startDate.getTime() + durationDays * 24 * 60 * 60 * 1000
            );
            const startStr = toDateString(start.year, start.month, start.day);
            const endStr = toDateString(
              endDate.getFullYear(),
              endDate.getMonth() + 1,
              endDate.getDate()
            );
            return { startStr, endStr, durationDays };
          });
        }),
        ({ startStr, endStr, durationDays }) => {
          const skp = calculateSkp(startStr, endStr);
          // Duration is durationDays + 1 (inclusive of both start and end)
          expect(skp).toBe((durationDays + 1) * 8);
        }
      ),
      { numRuns: 300 }
    );
  });

  it("SHALL preserve manual SKP value (1-999) when provided in schema input", () => {
    fc.assert(
      fc.property(
        validDatePair.chain((dates) =>
          fc.tuple(
            validBaseKegiatan(dates),
            fc.integer({ min: 1, max: 999 })
          )
        ),
        ([baseInput, manualSkp]) => {
          const input = { ...baseInput, skp: manualSkp };
          const parsed = createKegiatanSchema.safeParse(input);

          expect(parsed.success).toBe(true);
          if (parsed.success) {
            // The manual SKP should be preserved in the parsed data
            expect(parsed.data.skp).toBe(manualSkp);
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  it("SHALL leave skp as undefined when not provided (allowing auto-calculation)", () => {
    fc.assert(
      fc.property(
        validDatePair.chain((dates) => validBaseKegiatan(dates)),
        (baseInput) => {
          const parsed = createKegiatanSchema.safeParse(baseInput);

          expect(parsed.success).toBe(true);
          if (parsed.success) {
            // When no manual SKP is provided, parsed.data.skp should be undefined
            expect(parsed.data.skp).toBeUndefined();
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("SHALL reject manual SKP values outside 1-999 range", () => {
    // Test SKP = 0
    fc.assert(
      fc.property(
        validDatePair.chain((dates) => validBaseKegiatan(dates)),
        (baseInput) => {
          const input = { ...baseInput, skp: 0 };
          const parsed = createKegiatanSchema.safeParse(input);
          expect(parsed.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );

    // Test SKP > 999
    fc.assert(
      fc.property(
        fc.tuple(
          validDatePair.chain((dates) => validBaseKegiatan(dates)),
          fc.integer({ min: 1000, max: 99999 })
        ),
        ([baseInput, invalidSkp]) => {
          const input = { ...baseInput, skp: invalidSkp };
          const parsed = createKegiatanSchema.safeParse(input);
          expect(parsed.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );

    // Test negative SKP
    fc.assert(
      fc.property(
        fc.tuple(
          validDatePair.chain((dates) => validBaseKegiatan(dates)),
          fc.integer({ min: -1000, max: -1 })
        ),
        ([baseInput, negativeSkp]) => {
          const input = { ...baseInput, skp: negativeSkp };
          const parsed = createKegiatanSchema.safeParse(input);
          expect(parsed.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 2: Date Validation Rejects Invalid Ranges
 * Validates: Requirements 1.7
 *
 * For any date pair where tanggalSelesai < tanggalMulai, the validation SHALL reject
 * the input. For any date pair where tanggalSelesai >= tanggalMulai, the validation
 * SHALL accept the input.
 */
describe("Property 2: Date Validation Rejects Invalid Ranges", () => {
  it("SHALL reject any input where tanggalSelesai < tanggalMulai", () => {
    fc.assert(
      fc.property(
        invalidDatePair.chain((dates) =>
          validBaseKegiatan(dates).map((base) => ({ ...base }))
        ),
        (input) => {
          const parsed = createKegiatanSchema.safeParse(input);
          expect(parsed.success).toBe(false);
        }
      ),
      { numRuns: 500 }
    );
  });

  it("SHALL accept any input where tanggalSelesai >= tanggalMulai", () => {
    fc.assert(
      fc.property(
        validDatePair.chain((dates) =>
          validBaseKegiatan(dates).map((base) => ({ ...base }))
        ),
        (input) => {
          const parsed = createKegiatanSchema.safeParse(input);
          expect(parsed.success).toBe(true);
        }
      ),
      { numRuns: 500 }
    );
  });

  it("SHALL accept input where tanggalSelesai equals tanggalMulai (same day)", () => {
    fc.assert(
      fc.property(
        dateArb.chain((d) => {
          const dateStr = toDateString(d.year, d.month, d.day);
          return validBaseKegiatan({
            tanggalMulai: dateStr,
            tanggalSelesai: dateStr,
          });
        }),
        (input) => {
          const parsed = createKegiatanSchema.safeParse(input);
          expect(parsed.success).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("SHALL reject input where tanggalSelesai is exactly 1 day before tanggalMulai", () => {
    fc.assert(
      fc.property(
        dateArb
          .filter((d) => !(d.year === 2020 && d.month === 1 && d.day === 1))
          .chain((start) => {
            const startDate = new Date(start.year, start.month - 1, start.day);
            const endDate = new Date(
              startDate.getTime() - 1 * 24 * 60 * 60 * 1000
            );
            const startStr = toDateString(start.year, start.month, start.day);
            const endStr = toDateString(
              endDate.getFullYear(),
              endDate.getMonth() + 1,
              endDate.getDate()
            );
            return validBaseKegiatan({
              tanggalMulai: startStr,
              tanggalSelesai: endStr,
            });
          }),
        (input) => {
          const parsed = createKegiatanSchema.safeParse(input);
          expect(parsed.success).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("SHALL reject inputs with invalid date format strings", () => {
    const invalidDateFormats = fc.oneof(
      fc.constant("2024/01/15"), // wrong separator
      fc.constant("15-01-2024"), // wrong order
      fc.constant("2024-1-15"), // missing leading zero
      fc.constant("2024-01-5"), // missing leading zero
      fc.constant("not-a-date"), // completely invalid
      fc.constant("") // empty string
    );

    fc.assert(
      fc.property(invalidDateFormats, (invalidDate) => {
        const input = {
          namaKegiatan: "Test Kegiatan",
          kategoriPpl: "Perpajakan" as const,
          tipePelaksanaan: "online" as const,
          tanggalMulai: invalidDate,
          tanggalSelesai: "2024-12-31",
        };
        const parsed = createKegiatanSchema.safeParse(input);
        expect(parsed.success).toBe(false);
      }),
      { numRuns: 50 }
    );
  });
});
