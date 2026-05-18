import Papa from "papaparse";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import "jspdf-autotable";
import type { FormField, GridConfig, OptionsConfig } from "@/components/ppl-evaluasi/form-builder/types";
import { computeScaleAnalytics, computeGridAnalytics, computeChoiceAnalytics } from "@/server/lib/ppl-analytics";
import type { GridResponse } from "@/server/lib/ppl-analytics";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ExportRow {
  namaResponden: string;
  emailResponden: string;
  submittedAt: Date;
  answersJson: Record<string, unknown>;
}

export interface ProgramTahunanRow {
  kategoriPpl: string;
  recommendedMonths: string[];
  avgAttendance: number;
  avgConversion: number;
  yoyChange: number | null;
  trendLabel: string | null;
  popularityScore: number;
}

// ─── COLUMN EXPANSION ────────────────────────────────────────────────────────

/**
 * Build column headers from form fields, expanding grid fields into
 * "{field_label} - {row_label}" columns.
 *
 * Requirements: 7.3, 7.4
 */
export function buildExportColumns(fields: FormField[]): {
  headers: string[];
  fieldMap: Array<{ fieldId: string; type: string; rowIndex?: number }>;
} {
  const headers: string[] = ["Nama Responden", "Email", "Waktu Submit"];
  const fieldMap: Array<{ fieldId: string; type: string; rowIndex?: number }> = [];

  // Sort fields by order
  const sortedFields = [...fields].sort((a, b) => a.order - b.order);

  for (const field of sortedFields) {
    if (field.type === "grid") {
      const config = field.config as GridConfig | null;
      if (config?.rows) {
        for (let i = 0; i < config.rows.length; i++) {
          headers.push(`${field.label} - ${config.rows[i]}`);
          fieldMap.push({ fieldId: field.id, type: "grid", rowIndex: i });
        }
      }
    } else {
      headers.push(field.label);
      fieldMap.push({ fieldId: field.id, type: field.type });
    }
  }

  return { headers, fieldMap };
}

/**
 * Transform a single response row into an array of cell values
 * matching the column headers.
 *
 * Requirements: 7.3, 7.4
 */
export function transformResponseRow(
  row: ExportRow,
  fieldMap: Array<{ fieldId: string; type: string; rowIndex?: number }>,
): string[] {
  const cells: string[] = [
    row.namaResponden,
    row.emailResponden,
    row.submittedAt instanceof Date
      ? row.submittedAt.toISOString()
      : String(row.submittedAt),
  ];

  for (const col of fieldMap) {
    const answer = row.answersJson[col.fieldId];

    if (col.type === "grid" && col.rowIndex !== undefined) {
      // Grid field: answer is Record<string|number, number>
      if (answer && typeof answer === "object" && !Array.isArray(answer)) {
        const gridAnswer = answer as Record<string, unknown>;
        // Try both string index and row label as key
        const value = gridAnswer[String(col.rowIndex)] ?? gridAnswer[col.rowIndex.toString()];
        cells.push(value !== undefined && value !== null ? String(value) : "");
      } else {
        cells.push("");
      }
    } else if (col.type === "checkbox") {
      // Checkbox: answer is string[]
      if (Array.isArray(answer)) {
        cells.push(answer.join(", "));
      } else {
        cells.push("");
      }
    } else {
      // All other types: scalar value
      cells.push(answer !== undefined && answer !== null ? String(answer) : "");
    }
  }

  return cells;
}

// ─── CSV EXPORT ──────────────────────────────────────────────────────────────

/**
 * Generate CSV content with UTF-8 BOM encoding.
 *
 * Requirements: 7.1, 7.3, 7.4
 */
export function generateCsvContent(
  fields: FormField[],
  responses: ExportRow[],
): string {
  const { headers, fieldMap } = buildExportColumns(fields);

  const data = responses.map((row) => transformResponseRow(row, fieldMap));

  const csv = Papa.unparse({
    fields: headers,
    data,
  });

  // Add UTF-8 BOM
  const BOM = "\uFEFF";
  return BOM + csv;
}

// ─── XLSX EXPORT ─────────────────────────────────────────────────────────────

/**
 * Build summary sheet data for XLSX export.
 *
 * Requirements: 7.5
 * - Scale fields: mean, stdDev
 * - Grid fields: mean per row
 * - Choice fields (radio, select, checkbox): frequency distribution
 */
export function buildSummarySheetData(
  fields: FormField[],
  responses: ExportRow[],
): string[][] {
  const summaryRows: string[][] = [["Field", "Metric", "Value"]];

  const sortedFields = [...fields].sort((a, b) => a.order - b.order);

  for (const field of sortedFields) {
    if (field.type === "scale") {
      // Collect scale values
      const values: number[] = [];
      for (const resp of responses) {
        const answer = resp.answersJson[field.id];
        if (answer !== undefined && answer !== null) {
          const num = Number(answer);
          if (!isNaN(num)) values.push(num);
        }
      }

      if (values.length > 0) {
        const analytics = computeScaleAnalytics(values);
        summaryRows.push([field.label, "Rata-rata", String(analytics.mean)]);
        summaryRows.push([field.label, "Standar Deviasi", String(analytics.stdDev)]);
      }
    } else if (field.type === "grid") {
      const config = field.config as GridConfig | null;
      if (config) {
        // Collect grid responses
        const gridResponses: GridResponse[] = [];
        for (const resp of responses) {
          const answer = resp.answersJson[field.id];
          if (answer && typeof answer === "object" && !Array.isArray(answer)) {
            // Convert row indices to row labels for computeGridAnalytics
            const gridAnswer: GridResponse = {};
            for (let i = 0; i < config.rows.length; i++) {
              const val = (answer as Record<string, unknown>)[String(i)];
              const rowLabel = config.rows[i];
              if (val !== undefined && val !== null && rowLabel !== undefined) {
                gridAnswer[rowLabel] = Number(val);
              }
            }
            gridResponses.push(gridAnswer);
          }
        }

        if (gridResponses.length > 0) {
          const analytics = computeGridAnalytics(gridResponses, config);
          for (const row of analytics.rows) {
            summaryRows.push([
              `${field.label} - ${row.rowLabel}`,
              "Rata-rata",
              String(row.mean),
            ]);
          }
        }
      }
    } else if (
      field.type === "radio" ||
      field.type === "select" ||
      field.type === "checkbox"
    ) {
      const config = field.config as OptionsConfig | null;
      if (config?.options) {
        // Collect choice responses
        const choiceResponses: string[][] = [];
        for (const resp of responses) {
          const answer = resp.answersJson[field.id];
          if (field.type === "checkbox" && Array.isArray(answer)) {
            choiceResponses.push(answer as string[]);
          } else if (answer !== undefined && answer !== null) {
            choiceResponses.push([String(answer)]);
          }
        }

        if (choiceResponses.length > 0) {
          const analytics = computeChoiceAnalytics(
            choiceResponses,
            config.options,
            field.type === "checkbox",
          );
          for (const opt of analytics.options) {
            summaryRows.push([
              field.label,
              `${opt.label} (jumlah)`,
              String(opt.count),
            ]);
            summaryRows.push([
              field.label,
              `${opt.label} (%)`,
              `${opt.percentage}%`,
            ]);
          }
        }
      }
    }
  }

  return summaryRows;
}

/**
 * Generate XLSX workbook buffer with data sheet and summary sheet.
 *
 * Requirements: 7.2, 7.3, 7.4, 7.5
 */
export function generateXlsxBuffer(
  fields: FormField[],
  responses: ExportRow[],
): Uint8Array {
  const { headers, fieldMap } = buildExportColumns(fields);

  // Data sheet
  const dataRows = responses.map((row) => transformResponseRow(row, fieldMap));
  const dataSheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

  // Summary sheet
  const summaryData = buildSummarySheetData(fields, responses);
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, dataSheet, "Responses");
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  // Write to buffer
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new Uint8Array(buffer);
}

// ─── PROGRAM TAHUNAN EXPORT ──────────────────────────────────────────────────

/**
 * Generate Program Tahunan XLSX buffer.
 *
 * Requirements: 9.5
 */
export function generateProgramTahunanXlsx(rows: ProgramTahunanRow[]): Uint8Array {
  const headers = [
    "Kategori PPL",
    "Bulan Rekomendasi",
    "Rata-rata Kehadiran",
    "Rata-rata Conversion Rate (%)",
    "Perubahan YoY (%)",
    "Tren",
    "Skor Popularitas",
  ];

  const dataRows = rows.map((row) => [
    row.kategoriPpl,
    row.recommendedMonths.join(", "),
    String(row.avgAttendance),
    String(row.avgConversion),
    row.yoyChange !== null ? String(row.yoyChange) : "N/A",
    row.trendLabel ?? "N/A",
    String(row.popularityScore),
  ]);

  const sheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Program Tahunan");

  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new Uint8Array(buffer);
}

/**
 * Generate Program Tahunan PDF buffer.
 *
 * Requirements: 9.5
 */
export function generateProgramTahunanPdf(rows: ProgramTahunanRow[]): Uint8Array {
  const doc = new jsPDF({ orientation: "landscape" });

  // Title
  doc.setFontSize(16);
  doc.text("Rekomendasi Program Tahunan PPL", 14, 20);

  doc.setFontSize(10);
  doc.text(`Digenerate: ${new Date().toLocaleDateString("id-ID")}`, 14, 28);

  // Table
  const tableHeaders = [
    "Kategori PPL",
    "Bulan Rekomendasi",
    "Rata-rata Kehadiran",
    "Conversion Rate (%)",
    "YoY (%)",
    "Tren",
    "Skor Popularitas",
  ];

  const tableData = rows.map((row) => [
    row.kategoriPpl,
    row.recommendedMonths.join(", "),
    String(row.avgAttendance),
    String(row.avgConversion),
    row.yoyChange !== null ? String(row.yoyChange) : "N/A",
    row.trendLabel ?? "N/A",
    String(row.popularityScore),
  ]);

  // Use jspdf-autotable
  (doc as unknown as { autoTable: (opts: unknown) => void }).autoTable({
    head: [tableHeaders],
    body: tableData,
    startY: 35,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] },
  });

  // Return as Uint8Array
  const arrayBuffer = doc.output("arraybuffer");
  return new Uint8Array(arrayBuffer);
}
