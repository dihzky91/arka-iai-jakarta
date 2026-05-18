import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  scaleConfigSchema,
  gridConfigSchema,
  optionsConfigSchema,
  templateSchema,
} from "@/lib/validators/ppl-evaluasi";

/**
 * Property 4: Form Field Configuration Validation
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.10
 *
 * For any scale configuration, the validator SHALL accept it if and only if
 * min and max are integers between 1 and 10 with min < max and labels are ≤ 50 characters.
 * For any grid configuration, the validator SHALL accept it if and only if
 * rows count is 1-30 (each ≤ 300 chars) and columns count is 2-10 (each ≤ 100 chars).
 * For any options configuration (select/radio/checkbox), the validator SHALL accept it
 * if and only if options count is 1-50 with each option ≤ 200 characters.
 */
describe("Property 4: Form Field Configuration Validation", () => {
  // ─── SCALE CONFIG ─────────────────────────────────────────────────────────

  describe("Scale Config", () => {
    const validScaleConfig = fc
      .tuple(
        fc.integer({ min: 1, max: 9 }), // min value (leave room for max > min)
        fc.integer({ min: 2, max: 10 }), // max value candidate
        fc.string({ minLength: 0, maxLength: 50 }), // minLabel
        fc.string({ minLength: 0, maxLength: 50 }) // maxLabel
      )
      .filter(([min, max]) => min < max)
      .map(([min, max, minLabel, maxLabel]) => ({
        min,
        max,
        minLabel,
        maxLabel,
      }));

    it("SHALL accept valid scale configurations", () => {
      fc.assert(
        fc.property(validScaleConfig, (config) => {
          const result = scaleConfigSchema.safeParse(config);
          expect(result.success).toBe(true);
        }),
        { numRuns: 200 }
      );
    });

    it("SHALL reject scale configs where min >= max", () => {
      const invalidMinMax = fc
        .tuple(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 10 }),
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 50 })
        )
        .filter(([min, max]) => min >= max)
        .map(([min, max, minLabel, maxLabel]) => ({
          min,
          max,
          minLabel,
          maxLabel,
        }));

      fc.assert(
        fc.property(invalidMinMax, (config) => {
          const result = scaleConfigSchema.safeParse(config);
          expect(result.success).toBe(false);
        }),
        { numRuns: 200 }
      );
    });

    it("SHALL reject scale configs where min or max is outside 1-10", () => {
      const outOfRangeMin = fc
        .tuple(
          fc.oneof(
            fc.integer({ min: -100, max: 0 }),
            fc.integer({ min: 11, max: 100 })
          ),
          fc.integer({ min: 1, max: 10 }),
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 50 })
        )
        .map(([min, max, minLabel, maxLabel]) => ({
          min,
          max,
          minLabel,
          maxLabel,
        }));

      fc.assert(
        fc.property(outOfRangeMin, (config) => {
          const result = scaleConfigSchema.safeParse(config);
          expect(result.success).toBe(false);
        }),
        { numRuns: 100 }
      );

      const outOfRangeMax = fc
        .tuple(
          fc.integer({ min: 1, max: 10 }),
          fc.oneof(
            fc.integer({ min: -100, max: 0 }),
            fc.integer({ min: 11, max: 100 })
          ),
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 50 })
        )
        .map(([min, max, minLabel, maxLabel]) => ({
          min,
          max,
          minLabel,
          maxLabel,
        }));

      fc.assert(
        fc.property(outOfRangeMax, (config) => {
          const result = scaleConfigSchema.safeParse(config);
          expect(result.success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("SHALL reject scale configs where labels exceed 50 characters", () => {
      const longLabel = fc
        .tuple(
          fc.integer({ min: 1, max: 9 }),
          fc.integer({ min: 2, max: 10 }),
          fc.string({ minLength: 51, maxLength: 100 }),
          fc.string({ minLength: 0, maxLength: 50 })
        )
        .filter(([min, max]) => min < max)
        .map(([min, max, minLabel, maxLabel]) => ({
          min,
          max,
          minLabel,
          maxLabel,
        }));

      fc.assert(
        fc.property(longLabel, (config) => {
          const result = scaleConfigSchema.safeParse(config);
          expect(result.success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it("SHALL reject scale configs with non-integer min/max", () => {
      const nonIntegerConfig = fc
        .tuple(
          fc.double({ min: 1.1, max: 9.9, noNaN: true, noDefaultInfinity: true }),
          fc.integer({ min: 2, max: 10 }),
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.string({ minLength: 0, maxLength: 50 })
        )
        .filter(([min]) => !Number.isInteger(min))
        .map(([min, max, minLabel, maxLabel]) => ({
          min,
          max,
          minLabel,
          maxLabel,
        }));

      fc.assert(
        fc.property(nonIntegerConfig, (config) => {
          const result = scaleConfigSchema.safeParse(config);
          expect(result.success).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  // ─── GRID CONFIG ──────────────────────────────────────────────────────────

  describe("Grid Config", () => {
    const validGridConfig = fc.record({
      rows: fc.array(fc.string({ minLength: 1, maxLength: 300 }), {
        minLength: 1,
        maxLength: 30,
      }),
      columns: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
        minLength: 2,
        maxLength: 10,
      }),
    });

    it("SHALL accept valid grid configurations", () => {
      fc.assert(
        fc.property(validGridConfig, (config) => {
          const result = gridConfigSchema.safeParse(config);
          expect(result.success).toBe(true);
        }),
        { numRuns: 200 }
      );
    });

    it("SHALL reject grid configs with 0 rows", () => {
      const emptyRows = fc.record({
        rows: fc.constant([] as string[]),
        columns: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
          minLength: 2,
          maxLength: 10,
        }),
      });

      fc.assert(
        fc.property(emptyRows, (config) => {
          const result = gridConfigSchema.safeParse(config);
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it("SHALL reject grid configs with more than 30 rows", () => {
      const tooManyRows = fc.record({
        rows: fc.array(fc.string({ minLength: 1, maxLength: 300 }), {
          minLength: 31,
          maxLength: 35,
        }),
        columns: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
          minLength: 2,
          maxLength: 10,
        }),
      });

      fc.assert(
        fc.property(tooManyRows, (config) => {
          const result = gridConfigSchema.safeParse(config);
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it("SHALL reject grid configs with fewer than 2 columns", () => {
      const tooFewColumns = fc.record({
        rows: fc.array(fc.string({ minLength: 1, maxLength: 300 }), {
          minLength: 1,
          maxLength: 30,
        }),
        columns: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
          minLength: 0,
          maxLength: 1,
        }),
      });

      fc.assert(
        fc.property(tooFewColumns, (config) => {
          const result = gridConfigSchema.safeParse(config);
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it("SHALL reject grid configs with more than 10 columns", () => {
      const tooManyColumns = fc.record({
        rows: fc.array(fc.string({ minLength: 1, maxLength: 300 }), {
          minLength: 1,
          maxLength: 30,
        }),
        columns: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
          minLength: 11,
          maxLength: 15,
        }),
      });

      fc.assert(
        fc.property(tooManyColumns, (config) => {
          const result = gridConfigSchema.safeParse(config);
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it("SHALL reject grid configs with row labels exceeding 300 chars", () => {
      const longRowLabel = fc
        .record({
          rows: fc.tuple(fc.string({ minLength: 301, maxLength: 400 })).map((t) => [...t]),
          columns: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
            minLength: 2,
            maxLength: 10,
          }),
        });

      fc.assert(
        fc.property(longRowLabel, (config) => {
          const result = gridConfigSchema.safeParse(config);
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it("SHALL reject grid configs with column labels exceeding 100 chars", () => {
      const longColumnLabel = fc.record({
        rows: fc.array(fc.string({ minLength: 1, maxLength: 300 }), {
          minLength: 1,
          maxLength: 30,
        }),
        columns: fc
          .tuple(
            fc.string({ minLength: 101, maxLength: 200 }),
            fc.string({ minLength: 101, maxLength: 200 })
          )
          .map((t) => [...t]),
      });

      fc.assert(
        fc.property(longColumnLabel, (config) => {
          const result = gridConfigSchema.safeParse(config);
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it("SHALL reject grid configs with empty string rows", () => {
      const emptyStringRow = fc.record({
        rows: fc.constant([""]),
        columns: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
          minLength: 2,
          maxLength: 10,
        }),
      });

      fc.assert(
        fc.property(emptyStringRow, (config) => {
          const result = gridConfigSchema.safeParse(config);
          expect(result.success).toBe(false);
        }),
        { numRuns: 20 }
      );
    });
  });

  // ─── OPTIONS CONFIG ───────────────────────────────────────────────────────

  describe("Options Config", () => {
    const validOptionsConfig = fc.record({
      options: fc.array(fc.string({ minLength: 1, maxLength: 200 }), {
        minLength: 1,
        maxLength: 50,
      }),
    });

    it("SHALL accept valid options configurations", () => {
      fc.assert(
        fc.property(validOptionsConfig, (config) => {
          const result = optionsConfigSchema.safeParse(config);
          expect(result.success).toBe(true);
        }),
        { numRuns: 200 }
      );
    });

    it("SHALL reject options configs with 0 options", () => {
      const emptyOptions = fc.constant({ options: [] as string[] });

      fc.assert(
        fc.property(emptyOptions, (config) => {
          const result = optionsConfigSchema.safeParse(config);
          expect(result.success).toBe(false);
        }),
        { numRuns: 10 }
      );
    });

    it("SHALL reject options configs with more than 50 options", () => {
      const tooManyOptions = fc.record({
        options: fc.array(fc.string({ minLength: 1, maxLength: 200 }), {
          minLength: 51,
          maxLength: 55,
        }),
      });

      fc.assert(
        fc.property(tooManyOptions, (config) => {
          const result = optionsConfigSchema.safeParse(config);
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it("SHALL reject options configs with options exceeding 200 chars", () => {
      const longOption = fc.record({
        options: fc
          .tuple(fc.string({ minLength: 201, maxLength: 300 }))
          .map((t) => [...t]),
      });

      fc.assert(
        fc.property(longOption, (config) => {
          const result = optionsConfigSchema.safeParse(config);
          expect(result.success).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it("SHALL reject options configs with empty string options", () => {
      const emptyStringOption = fc.constant({ options: [""] });

      fc.assert(
        fc.property(emptyStringOption, (config) => {
          const result = optionsConfigSchema.safeParse(config);
          expect(result.success).toBe(false);
        }),
        { numRuns: 10 }
      );
    });
  });
});

/**
 * Property 5: Template Field Count Constraint
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.10
 *
 * For any questionnaire template, the validator SHALL accept it if and only if
 * it contains between 1 and 50 fields, each with a non-empty label of at most
 * 300 characters and a valid field type.
 */
describe("Property 5: Template Field Count Constraint", () => {
  const validFieldTypes = [
    "text",
    "textarea",
    "number",
    "email",
    "select",
    "radio",
    "checkbox",
    "scale",
    "grid",
  ] as const;

  // Generator for a valid form field (without config for simplicity - config is nullable)
  const validFormField = (order: number) =>
    fc
      .record({
        id: fc.string({ minLength: 1, maxLength: 21 }),
        type: fc.constantFrom(...validFieldTypes),
        label: fc.string({ minLength: 1, maxLength: 300 }),
        required: fc.boolean(),
        order: fc.constant(order),
        config: fc.constant(null),
      });

  // Generator for a valid template with 1-50 fields
  const validTemplate = fc
    .integer({ min: 1, max: 50 })
    .chain((fieldCount) =>
      fc.record({
        nama: fc.string({ minLength: 1, maxLength: 200 }),
        fields: fc
          .tuple(
            ...Array.from({ length: fieldCount }, (_, i) => validFormField(i))
          )
          .map((fields) => [...fields]),
      })
    );

  it("SHALL accept templates with 1-50 fields, valid labels, and valid types", () => {
    fc.assert(
      fc.property(validTemplate, (template) => {
        const result = templateSchema.safeParse(template);
        expect(result.success).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("SHALL reject templates with 0 fields", () => {
    const emptyFieldsTemplate = fc.record({
      nama: fc.string({ minLength: 1, maxLength: 200 }),
      fields: fc.constant([] as unknown[]),
    });

    fc.assert(
      fc.property(emptyFieldsTemplate, (template) => {
        const result = templateSchema.safeParse(template);
        expect(result.success).toBe(false);
      }),
      { numRuns: 50 }
    );
  });

  it("SHALL reject templates with more than 50 fields", () => {
    const tooManyFieldsTemplate = fc.record({
      nama: fc.string({ minLength: 1, maxLength: 200 }),
      fields: fc
        .tuple(
          ...Array.from({ length: 51 }, (_, i) => validFormField(i))
        )
        .map((fields) => [...fields]),
    });

    fc.assert(
      fc.property(tooManyFieldsTemplate, (template) => {
        const result = templateSchema.safeParse(template);
        expect(result.success).toBe(false);
      }),
      { numRuns: 50 }
    );
  });

  it("SHALL reject templates with empty field labels", () => {
    const emptyLabelTemplate = fc.record({
      nama: fc.string({ minLength: 1, maxLength: 200 }),
      fields: fc.constant([
        {
          id: "field-1",
          type: "text" as const,
          label: "",
          required: true,
          order: 0,
          config: null,
        },
      ]),
    });

    fc.assert(
      fc.property(emptyLabelTemplate, (template) => {
        const result = templateSchema.safeParse(template);
        expect(result.success).toBe(false);
      }),
      { numRuns: 20 }
    );
  });

  it("SHALL reject templates with field labels exceeding 300 characters", () => {
    const longLabelTemplate = fc
      .string({ minLength: 301, maxLength: 400 })
      .map((longLabel) => ({
        nama: "Test Template",
        fields: [
          {
            id: "field-1",
            type: "text" as const,
            label: longLabel,
            required: true,
            order: 0,
            config: null,
          },
        ],
      }));

    fc.assert(
      fc.property(longLabelTemplate, (template) => {
        const result = templateSchema.safeParse(template);
        expect(result.success).toBe(false);
      }),
      { numRuns: 50 }
    );
  });

  it("SHALL reject templates with invalid field types", () => {
    const invalidTypeTemplate = fc
      .string({ minLength: 1, maxLength: 20 })
      .filter(
        (s) =>
          !validFieldTypes.includes(s as (typeof validFieldTypes)[number])
      )
      .map((invalidType) => ({
        nama: "Test Template",
        fields: [
          {
            id: "field-1",
            type: invalidType,
            label: "Some label",
            required: true,
            order: 0,
            config: null,
          },
        ],
      }));

    fc.assert(
      fc.property(invalidTypeTemplate, (template) => {
        const result = templateSchema.safeParse(template);
        expect(result.success).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("SHALL reject templates with empty nama", () => {
    const emptyNamaTemplate = fc.constant({
      nama: "",
      fields: [
        {
          id: "field-1",
          type: "text" as const,
          label: "Valid label",
          required: true,
          order: 0,
          config: null,
        },
      ],
    });

    fc.assert(
      fc.property(emptyNamaTemplate, (template) => {
        const result = templateSchema.safeParse(template);
        expect(result.success).toBe(false);
      }),
      { numRuns: 10 }
    );
  });

  it("SHALL reject templates with nama exceeding 200 characters", () => {
    const longNamaTemplate = fc
      .string({ minLength: 201, maxLength: 300 })
      .map((longNama) => ({
        nama: longNama,
        fields: [
          {
            id: "field-1",
            type: "text" as const,
            label: "Valid label",
            required: true,
            order: 0,
            config: null,
          },
        ],
      }));

    fc.assert(
      fc.property(longNamaTemplate, (template) => {
        const result = templateSchema.safeParse(template);
        expect(result.success).toBe(false);
      }),
      { numRuns: 50 }
    );
  });
});
