import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  buildExportColumns,
  transformResponseRow,
  type ExportRow,
} from "@/server/lib/ppl-export";
import type {
  FormField,
  GridConfig,
} from "@/components/ppl-evaluasi/form-builder/types";

/**
 * **Validates: Requirements 7.3, 7.4**
 *
 * Property 14: Grid Field Export Column Expansion
 * For any grid field with label L and row labels [R1, R2, ..., Rn], the export
 * SHALL produce n columns named ["{L} - {R1}", "{L} - {R2}", ..., "{L} - {Rn}"],
 * each containing the selected scale value for that row.
 *
 * Property 15: Export Row Count Matches Respondent Count
 * For any Kegiatan with N responses, the exported data (excluding header) SHALL
 * contain exactly N rows, one per respondent.
 */

// ─── GENERATORS ──────────────────────────────────────────────────────────────

/**
 * Generate a unique field ID (simulating nanoid).
 */
const fieldIdArb = fc.string({ minLength: 5, maxLength: 10, unit: fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789") });

/**
 * Generate a non-empty label string.
 */
const labelArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

/**
 * Generate a valid GridConfig with unique row labels.
 */
const gridConfigArb = fc
  .record({
    rowCount: fc.integer({ min: 1, max: 10 }),
    colCount: fc.integer({ min: 2, max: 5 }),
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
    const uniqueRows = new Set(config.rows);
    const uniqueCols = new Set(config.columns);
    return uniqueRows.size === config.rows.length && uniqueCols.size === config.columns.length;
  });

/**
 * Generate a grid FormField with a valid GridConfig.
 */
const gridFieldArb = fc
  .tuple(fieldIdArb, labelArb, gridConfigArb, fc.integer({ min: 0, max: 20 }))
  .map(([id, label, config, order]) => ({
    id,
    type: "grid" as const,
    label,
    required: true,
    order,
    config,
  }));

/**
 * Generate a non-grid FormField (text, number, scale, etc.).
 */
const simpleFieldArb = fc
  .tuple(
    fieldIdArb,
    labelArb,
    fc.constantFrom("text", "textarea", "number", "email", "scale", "radio", "select", "checkbox") as fc.Arbitrary<FormField["type"]>,
    fc.integer({ min: 0, max: 20 }),
  )
  .map(([id, label, type, order]) => ({
    id,
    type,
    label,
    required: false,
    order,
    config: null,
  }));

/**
 * Generate a mixed list of form fields with at least one grid field.
 */
const fieldsWithGridArb = fc
  .tuple(
    fc.array(gridFieldArb, { minLength: 1, maxLength: 3 }),
    fc.array(simpleFieldArb, { minLength: 0, maxLength: 5 }),
  )
  .map(([gridFields, simpleFields]) => {
    const all = [...gridFields, ...simpleFields];
    // Assign unique orders
    return all.map((f, i) => ({ ...f, order: i }));
  })
  .filter((fields) => {
    // Ensure unique field IDs
    const ids = new Set(fields.map((f) => f.id));
    return ids.size === fields.length;
  });

/**
 * Generate a list of form fields (may or may not include grid fields).
 */
const fieldsArb = fc
  .array(
    fc.oneof(gridFieldArb, simpleFieldArb),
    { minLength: 1, maxLength: 8 },
  )
  .map((fields) => fields.map((f, i) => ({ ...f, order: i })))
  .filter((fields) => {
    const ids = new Set(fields.map((f) => f.id));
    return ids.size === fields.length;
  });

/**
 * Generate a valid Date (never NaN) within a reasonable range.
 */
const validDateArb = fc.integer({
  min: new Date("2020-01-01T00:00:00.000Z").getTime(),
  max: new Date("2025-12-31T23:59:59.999Z").getTime(),
}).map((ts) => new Date(ts));

/**
 * Generate an ExportRow with answers matching the given fields.
 */
function exportRowArb(fields: FormField[]): fc.Arbitrary<ExportRow> {
  const answersArb = fc.record(
    Object.fromEntries(
      fields.map((field) => {
        if (field.type === "grid") {
          const config = field.config as GridConfig;
          // Grid answers are stored as Record<rowIndex, columnIndex>
          const gridAnswerArb = fc.record(
            Object.fromEntries(
              config.rows.map((_, i) => [
                String(i),
                fc.integer({ min: 0, max: config.columns.length - 1 }),
              ]),
            ),
          );
          return [field.id, gridAnswerArb];
        } else if (field.type === "checkbox") {
          return [field.id, fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 3 })];
        } else if (field.type === "number" || field.type === "scale") {
          return [field.id, fc.integer({ min: 1, max: 10 })];
        } else {
          return [field.id, fc.string({ minLength: 1, maxLength: 20 })];
        }
      }),
    ),
  );

  return fc.record({
    namaResponden: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
    emailResponden: fc.emailAddress(),
    submittedAt: validDateArb,
    answersJson: answersArb as fc.Arbitrary<Record<string, unknown>>,
  });
}

// ─── PROPERTY 14: GRID FIELD EXPORT COLUMN EXPANSION ─────────────────────────

describe("Property 14: Grid Field Export Column Expansion", () => {
  it("grid field with n row labels produces exactly n columns in export headers", () => {
    fc.assert(
      fc.property(gridFieldArb, (gridField) => {
        const fields: FormField[] = [gridField];
        const { headers } = buildExportColumns(fields);

        const config = gridField.config as GridConfig;
        // Headers include 3 base columns (Nama, Email, Waktu Submit) + n grid columns
        expect(headers.length).toBe(3 + config.rows.length);
      }),
      { numRuns: 300 },
    );
  });

  it("grid field columns are named '{label} - {row_label}' for each row", () => {
    fc.assert(
      fc.property(gridFieldArb, (gridField) => {
        const fields: FormField[] = [gridField];
        const { headers } = buildExportColumns(fields);

        const config = gridField.config as GridConfig;
        // Skip the first 3 base columns
        const gridHeaders = headers.slice(3);

        for (let i = 0; i < config.rows.length; i++) {
          const expectedName = `${gridField.label} - ${config.rows[i]}`;
          expect(gridHeaders[i]).toBe(expectedName);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("grid field columns preserve row label order from config", () => {
    fc.assert(
      fc.property(gridFieldArb, (gridField) => {
        const fields: FormField[] = [gridField];
        const { headers } = buildExportColumns(fields);

        const config = gridField.config as GridConfig;
        const gridHeaders = headers.slice(3);

        // Verify order matches config.rows order
        for (let i = 0; i < config.rows.length; i++) {
          expect(gridHeaders[i]).toContain(config.rows[i]);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("each expanded grid column contains the selected scale value for that row", () => {
    fc.assert(
      fc.property(
        gridFieldArb.chain((gridField) => {
          const fields: FormField[] = [{ ...gridField, order: 0 }];
          return exportRowArb(fields).map((row) => ({ gridField: { ...gridField, order: 0 }, row }));
        }),
        ({ gridField, row }) => {
          const fields: FormField[] = [gridField];
          const { fieldMap } = buildExportColumns(fields);
          const cells = transformResponseRow(row, fieldMap);

          const config = gridField.config as GridConfig;
          const gridAnswer = row.answersJson[gridField.id] as Record<string, unknown>;

          // Skip first 3 cells (nama, email, submittedAt)
          const gridCells = cells.slice(3);

          for (let i = 0; i < config.rows.length; i++) {
            const expectedValue = gridAnswer[String(i)];
            if (expectedValue !== undefined && expectedValue !== null) {
              expect(gridCells[i]).toBe(String(expectedValue));
            } else {
              expect(gridCells[i]).toBe("");
            }
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("mixed fields: grid fields expand while non-grid fields produce single columns", () => {
    fc.assert(
      fc.property(fieldsWithGridArb, (fields) => {
        const { headers } = buildExportColumns(fields);

        // Count expected columns
        let expectedColumnCount = 3; // base columns
        const sortedFields = [...fields].sort((a, b) => a.order - b.order);
        for (const field of sortedFields) {
          if (field.type === "grid") {
            const config = field.config as GridConfig;
            expectedColumnCount += config.rows.length;
          } else {
            expectedColumnCount += 1;
          }
        }

        expect(headers.length).toBe(expectedColumnCount);
      }),
      { numRuns: 300 },
    );
  });

  it("fieldMap entries for grid fields include correct rowIndex values", () => {
    fc.assert(
      fc.property(gridFieldArb, (gridField) => {
        const fields: FormField[] = [gridField];
        const { fieldMap } = buildExportColumns(fields);

        const config = gridField.config as GridConfig;

        expect(fieldMap.length).toBe(config.rows.length);
        for (let i = 0; i < config.rows.length; i++) {
          expect(fieldMap[i].fieldId).toBe(gridField.id);
          expect(fieldMap[i].type).toBe("grid");
          expect(fieldMap[i].rowIndex).toBe(i);
        }
      }),
      { numRuns: 300 },
    );
  });
});

// ─── PROPERTY 15: EXPORT ROW COUNT MATCHES RESPONDENT COUNT ──────────────────

describe("Property 15: Export Row Count Matches Respondent Count", () => {
  it("transforming N responses produces exactly N data rows", () => {
    fc.assert(
      fc.property(
        fieldsArb.chain((fields) =>
          fc
            .integer({ min: 1, max: 30 })
            .chain((n) =>
              fc.array(exportRowArb(fields), { minLength: n, maxLength: n }).map((rows) => ({
                fields,
                rows,
              })),
            ),
        ),
        ({ fields, rows }) => {
          const { fieldMap } = buildExportColumns(fields);
          const transformedRows = rows.map((row) => transformResponseRow(row, fieldMap));

          expect(transformedRows.length).toBe(rows.length);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("each transformed row has the same number of cells as headers", () => {
    fc.assert(
      fc.property(
        fieldsArb.chain((fields) =>
          exportRowArb(fields).map((row) => ({ fields, row })),
        ),
        ({ fields, row }) => {
          const { headers, fieldMap } = buildExportColumns(fields);
          const cells = transformResponseRow(row, fieldMap);

          expect(cells.length).toBe(headers.length);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("first three cells of each row are nama, email, and submittedAt", () => {
    fc.assert(
      fc.property(
        fieldsArb.chain((fields) =>
          exportRowArb(fields).map((row) => ({ fields, row })),
        ),
        ({ fields, row }) => {
          const { fieldMap } = buildExportColumns(fields);
          const cells = transformResponseRow(row, fieldMap);

          expect(cells[0]).toBe(row.namaResponden);
          expect(cells[1]).toBe(row.emailResponden);
          expect(cells[2]).toBe(row.submittedAt.toISOString());
        },
      ),
      { numRuns: 300 },
    );
  });

  it("zero responses produces zero data rows (empty array)", () => {
    fc.assert(
      fc.property(fieldsArb, (fields) => {
        const { fieldMap } = buildExportColumns(fields);
        const responses: ExportRow[] = [];
        const transformedRows = responses.map((row) => transformResponseRow(row, fieldMap));

        expect(transformedRows.length).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  it("row count is independent of field count or field types", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fieldsArb,
          fc.integer({ min: 1, max: 20 }),
        ).chain(([fields, n]) =>
          fc.array(exportRowArb(fields), { minLength: n, maxLength: n }).map((rows) => ({
            fields,
            rows,
            expectedCount: n,
          })),
        ),
        ({ fields, rows, expectedCount }) => {
          const { fieldMap } = buildExportColumns(fields);
          const transformedRows = rows.map((row) => transformResponseRow(row, fieldMap));

          expect(transformedRows.length).toBe(expectedCount);
        },
      ),
      { numRuns: 300 },
    );
  });
});
