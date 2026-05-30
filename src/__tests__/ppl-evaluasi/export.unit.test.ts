/**
 * Unit tests for Export functionality
 * Validates: Requirements 7.1, 7.5, 7.6
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FormField } from "@/components/ppl-evaluasi/form-builder/types";
import {
  generateCsvContent,
  buildSummarySheetData,
  type ExportRow,
} from "@/server/lib/ppl-export";

// ─── MOCKS ───────────────────────────────────────────────────────────────────

const { mockDb, createChainableMock } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  function createChainableMock(resolvedValue: unknown = []) {
    const chain: Record<string, unknown> = {};
    const thenFn = (resolve: (v: unknown) => void) => resolve(resolvedValue);
    chain.then = thenFn;
    chain[Symbol.iterator] = function* () {
      if (Array.isArray(resolvedValue)) {
        yield* resolvedValue;
      }
    };
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.innerJoin = vi.fn().mockReturnValue(chain);
    chain.orderBy = vi.fn().mockReturnValue(chain);
    chain.offset = vi.fn().mockReturnValue(chain);
    chain.returning = vi.fn().mockReturnValue(chain);
    chain.set = vi.fn().mockReturnValue(chain);
    chain.values = vi.fn().mockReturnValue(chain);
    return chain;
  }

  return { mockDb, createChainableMock };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/server/actions/auth", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User" },
  }),
  requirePermission: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User" },
  }),
}));

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

vi.mock("@/server/db/schema", () => ({
  pplKegiatan: {
    id: "id",
    namaKegiatan: "nama_kegiatan",
  },
  pplKuesionerLink: {
    id: "id",
    kegiatanId: "kegiatan_id",
    templateId: "template_id",
  },
  pplKuesionerTemplate: {
    id: "id",
    configJson: "config_json",
  },
  pplKuesionerResponse: {
    namaResponden: "nama_responden",
    emailResponden: "email_responden",
    submittedAt: "submitted_at",
    answersJson: "answers_json",
    linkId: "link_id",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  count: vi.fn(() => "count"),
  sql: vi.fn(),
}));

// ─── IMPORTS (after mocks) ───────────────────────────────────────────────────

import { exportResponsesCsv, exportResponsesXlsx } from "@/server/actions/ppl-evaluasi/export";

// ─── TEST DATA ───────────────────────────────────────────────────────────────

function createScaleField(id: string, label: string, order: number): FormField {
  return {
    id,
    type: "scale",
    label,
    required: true,
    order,
    config: { min: 1, max: 5, minLabel: "Buruk", maxLabel: "Sangat Baik" },
  };
}

function createGridField(id: string, label: string, order: number): FormField {
  return {
    id,
    type: "grid",
    label,
    required: true,
    order,
    config: {
      rows: ["Materi", "Penyampaian", "Fasilitas"],
      columns: ["1", "2", "3", "4", "5"],
    },
  };
}

function createRadioField(id: string, label: string, order: number): FormField {
  return {
    id,
    type: "radio",
    label,
    required: true,
    order,
    config: { options: ["Ya", "Tidak", "Mungkin"] },
  };
}

function createCheckboxField(id: string, label: string, order: number): FormField {
  return {
    id,
    type: "checkbox",
    label,
    required: false,
    order,
    config: { options: ["Online", "Offline", "Hybrid"] },
  };
}

function createTestResponses(count: number): ExportRow[] {
  return Array.from({ length: count }, (_, i) => ({
    namaResponden: `Responden ${i + 1}`,
    emailResponden: `responden${i + 1}@example.com`,
    submittedAt: new Date("2024-01-15T10:00:00Z"),
    answersJson: {
      "scale-1": 4,
      "grid-1": { "0": 3, "1": 4, "2": 5 },
      "radio-1": "Ya",
      "checkbox-1": ["Online", "Hybrid"],
    },
  }));
}

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe("Export Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Requirement 7.1: CSV includes UTF-8 BOM ──────────────────────────────

  describe("generateCsvContent - UTF-8 BOM", () => {
    it("SHALL start with UTF-8 BOM character (\\uFEFF)", () => {
      const fields: FormField[] = [createScaleField("scale-1", "Kepuasan", 0)];
      const responses = createTestResponses(1);

      const csv = generateCsvContent(fields, responses);

      expect(csv.charCodeAt(0)).toBe(0xfeff);
      expect(csv.startsWith("\uFEFF")).toBe(true);
    });

    it("SHALL produce valid CSV content after BOM", () => {
      const fields: FormField[] = [createScaleField("scale-1", "Kepuasan", 0)];
      const responses = createTestResponses(1);

      const csv = generateCsvContent(fields, responses);
      const withoutBom = csv.slice(1); // Remove BOM

      // Should contain header row with field labels
      expect(withoutBom).toContain("Nama Responden");
      expect(withoutBom).toContain("Email");
      expect(withoutBom).toContain("Waktu Submit");
      expect(withoutBom).toContain("Kepuasan");
    });

    it("SHALL include BOM even with empty fields array", () => {
      const fields: FormField[] = [];
      const responses: ExportRow[] = [];

      const csv = generateCsvContent(fields, responses);

      expect(csv.charCodeAt(0)).toBe(0xfeff);
    });
  });

  // ─── Requirement 7.5: XLSX summary sheet statistics ────────────────────────

  describe("buildSummarySheetData - correct statistics", () => {
    it("SHALL include header row [Field, Metric, Value]", () => {
      const fields: FormField[] = [createScaleField("scale-1", "Kepuasan", 0)];
      const responses = createTestResponses(3);

      const summary = buildSummarySheetData(fields, responses);

      expect(summary[0]).toEqual(["Field", "Metric", "Value"]);
    });

    it("SHALL compute Rata-rata and Standar Deviasi for scale fields", () => {
      const fields: FormField[] = [createScaleField("scale-1", "Kepuasan", 0)];
      const responses: ExportRow[] = [
        {
          namaResponden: "A",
          emailResponden: "a@test.com",
          submittedAt: new Date(),
          answersJson: { "scale-1": 3 },
        },
        {
          namaResponden: "B",
          emailResponden: "b@test.com",
          submittedAt: new Date(),
          answersJson: { "scale-1": 5 },
        },
        {
          namaResponden: "C",
          emailResponden: "c@test.com",
          submittedAt: new Date(),
          answersJson: { "scale-1": 4 },
        },
      ];

      const summary = buildSummarySheetData(fields, responses);

      // Find the Rata-rata row for Kepuasan
      const meanRow = summary.find(
        (row) => row[0] === "Kepuasan" && row[1] === "Rata-rata",
      );
      expect(meanRow).toBeDefined();
      // Mean of [3, 5, 4] = 4
      expect(Number(meanRow![2])).toBe(4);

      // Find the Standar Deviasi row
      const stdDevRow = summary.find(
        (row) => row[0] === "Kepuasan" && row[1] === "Standar Deviasi",
      );
      expect(stdDevRow).toBeDefined();
      // Population stdDev of [3, 5, 4] = sqrt(((3-4)^2 + (5-4)^2 + (4-4)^2) / 3) = sqrt(2/3) ≈ 0.82
      expect(Number(stdDevRow![2])).toBeCloseTo(0.82, 1);
    });

    it("SHALL compute Rata-rata per row for grid fields", () => {
      const fields: FormField[] = [
        createGridField("grid-1", "Evaluasi Materi", 0),
      ];
      const responses: ExportRow[] = [
        {
          namaResponden: "A",
          emailResponden: "a@test.com",
          submittedAt: new Date(),
          answersJson: { "grid-1": { "0": 3, "1": 4, "2": 5 } },
        },
        {
          namaResponden: "B",
          emailResponden: "b@test.com",
          submittedAt: new Date(),
          answersJson: { "grid-1": { "0": 5, "1": 4, "2": 3 } },
        },
      ];

      const summary = buildSummarySheetData(fields, responses);

      // Grid rows: "Materi", "Penyampaian", "Fasilitas"
      const materiRow = summary.find(
        (row) =>
          row[0] === "Evaluasi Materi - Materi" && row[1] === "Rata-rata",
      );
      expect(materiRow).toBeDefined();
      // Mean of [3, 5] = 4
      expect(Number(materiRow![2])).toBe(4);

      const penyampaianRow = summary.find(
        (row) =>
          row[0] === "Evaluasi Materi - Penyampaian" && row[1] === "Rata-rata",
      );
      expect(penyampaianRow).toBeDefined();
      // Mean of [4, 4] = 4
      expect(Number(penyampaianRow![2])).toBe(4);

      const fasilitasRow = summary.find(
        (row) =>
          row[0] === "Evaluasi Materi - Fasilitas" && row[1] === "Rata-rata",
      );
      expect(fasilitasRow).toBeDefined();
      // Mean of [5, 3] = 4
      expect(Number(fasilitasRow![2])).toBe(4);
    });

    it("SHALL compute frequency distribution for radio/select fields", () => {
      const fields: FormField[] = [
        createRadioField("radio-1", "Rekomendasi", 0),
      ];
      const responses: ExportRow[] = [
        {
          namaResponden: "A",
          emailResponden: "a@test.com",
          submittedAt: new Date(),
          answersJson: { "radio-1": "Ya" },
        },
        {
          namaResponden: "B",
          emailResponden: "b@test.com",
          submittedAt: new Date(),
          answersJson: { "radio-1": "Ya" },
        },
        {
          namaResponden: "C",
          emailResponden: "c@test.com",
          submittedAt: new Date(),
          answersJson: { "radio-1": "Tidak" },
        },
      ];

      const summary = buildSummarySheetData(fields, responses);

      // "Ya" count should be 2
      const yaCountRow = summary.find(
        (row) => row[0] === "Rekomendasi" && row[1] === "Ya (jumlah)",
      );
      expect(yaCountRow).toBeDefined();
      expect(Number(yaCountRow![2])).toBe(2);

      // "Ya" percentage should be 66.7%
      const yaPctRow = summary.find(
        (row) => row[0] === "Rekomendasi" && row[1] === "Ya (%)",
      );
      expect(yaPctRow).toBeDefined();
      expect(yaPctRow![2]).toBe("66.7%");

      // "Tidak" count should be 1
      const tidakCountRow = summary.find(
        (row) => row[0] === "Rekomendasi" && row[1] === "Tidak (jumlah)",
      );
      expect(tidakCountRow).toBeDefined();
      expect(Number(tidakCountRow![2])).toBe(1);

      // "Mungkin" count should be 0
      const mungkinCountRow = summary.find(
        (row) => row[0] === "Rekomendasi" && row[1] === "Mungkin (jumlah)",
      );
      expect(mungkinCountRow).toBeDefined();
      expect(Number(mungkinCountRow![2])).toBe(0);
    });

    it("SHALL compute frequency distribution for checkbox fields", () => {
      const fields: FormField[] = [
        createCheckboxField("checkbox-1", "Format Preferensi", 0),
      ];
      const responses: ExportRow[] = [
        {
          namaResponden: "A",
          emailResponden: "a@test.com",
          submittedAt: new Date(),
          answersJson: { "checkbox-1": ["Online", "Hybrid"] },
        },
        {
          namaResponden: "B",
          emailResponden: "b@test.com",
          submittedAt: new Date(),
          answersJson: { "checkbox-1": ["Online"] },
        },
        {
          namaResponden: "C",
          emailResponden: "c@test.com",
          submittedAt: new Date(),
          answersJson: { "checkbox-1": ["Offline", "Hybrid"] },
        },
      ];

      const summary = buildSummarySheetData(fields, responses);

      // "Online" count should be 2
      const onlineCountRow = summary.find(
        (row) => row[0] === "Format Preferensi" && row[1] === "Online (jumlah)",
      );
      expect(onlineCountRow).toBeDefined();
      expect(Number(onlineCountRow![2])).toBe(2);

      // "Online" percentage: 2/3 respondents = 66.7%
      const onlinePctRow = summary.find(
        (row) => row[0] === "Format Preferensi" && row[1] === "Online (%)",
      );
      expect(onlinePctRow).toBeDefined();
      expect(onlinePctRow![2]).toBe("66.7%");

      // "Hybrid" count should be 2
      const hybridCountRow = summary.find(
        (row) => row[0] === "Format Preferensi" && row[1] === "Hybrid (jumlah)",
      );
      expect(hybridCountRow).toBeDefined();
      expect(Number(hybridCountRow![2])).toBe(2);
    });

    it("SHALL skip fields with no valid responses", () => {
      const fields: FormField[] = [createScaleField("scale-1", "Kepuasan", 0)];
      const responses: ExportRow[] = [
        {
          namaResponden: "A",
          emailResponden: "a@test.com",
          submittedAt: new Date(),
          answersJson: {}, // No answer for scale-1
        },
      ];

      const summary = buildSummarySheetData(fields, responses);

      // Should only have the header row since no valid scale values
      const scaleRows = summary.filter((row) => row[0] === "Kepuasan");
      expect(scaleRows.length).toBe(0);
    });
  });

  // ─── Requirement 7.6: Zero responses returns error ─────────────────────────

  describe("exportResponsesCsv - zero responses", () => {
    it("SHALL return error when kegiatan has zero responses", async () => {
      // Mock: kegiatan exists
      const kegiatanChain = createChainableMock([
        { namaKegiatan: "Workshop Test" },
      ]);
      // Mock: link exists
      const linkChain = createChainableMock([{ id: 1, templateId: 1 }]);
      // Mock: template exists
      const templateChain = createChainableMock([
        { configJson: [createScaleField("scale-1", "Kepuasan", 0)] },
      ]);
      // Mock: zero responses
      const responsesChain = createChainableMock([]);

      mockDb.select
        .mockReturnValueOnce(kegiatanChain)
        .mockReturnValueOnce(linkChain)
        .mockReturnValueOnce(templateChain)
        .mockReturnValueOnce(responsesChain);

      const result = await exportResponsesCsv(1);

      expect(result.ok).toBe(false);
      expect(result.error).toBe("Tidak ada data respons untuk diekspor");
    });
  });

  describe("exportResponsesXlsx - zero responses", () => {
    it("SHALL return error when kegiatan has zero responses", async () => {
      // Mock: kegiatan exists
      const kegiatanChain = createChainableMock([
        { namaKegiatan: "Workshop Test" },
      ]);
      // Mock: link exists
      const linkChain = createChainableMock([{ id: 1, templateId: 1 }]);
      // Mock: template exists
      const templateChain = createChainableMock([
        { configJson: [createScaleField("scale-1", "Kepuasan", 0)] },
      ]);
      // Mock: zero responses
      const responsesChain = createChainableMock([]);

      mockDb.select
        .mockReturnValueOnce(kegiatanChain)
        .mockReturnValueOnce(linkChain)
        .mockReturnValueOnce(templateChain)
        .mockReturnValueOnce(responsesChain);

      const result = await exportResponsesXlsx(1);

      expect(result.ok).toBe(false);
      expect(result.error).toBe("Tidak ada data respons untuk diekspor");
    });
  });

  describe("exportResponsesCsv - kegiatan not found", () => {
    it("SHALL return error when kegiatan does not exist", async () => {
      const kegiatanChain = createChainableMock([]);
      mockDb.select.mockReturnValueOnce(kegiatanChain);

      const result = await exportResponsesCsv(999);

      expect(result.ok).toBe(false);
      expect(result.error).toBe(
        "Kuesioner tidak ditemukan untuk kegiatan ini",
      );
    });
  });

  describe("exportResponsesXlsx - kegiatan not found", () => {
    it("SHALL return error when kegiatan does not exist", async () => {
      const kegiatanChain = createChainableMock([]);
      mockDb.select.mockReturnValueOnce(kegiatanChain);

      const result = await exportResponsesXlsx(999);

      expect(result.ok).toBe(false);
      expect(result.error).toBe(
        "Kuesioner tidak ditemukan untuk kegiatan ini",
      );
    });
  });
});
