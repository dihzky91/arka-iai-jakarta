import type { GridConfig } from "@/components/ppl-evaluasi/form-builder/types";
export { computeConversionRate } from "@/lib/ppl-conversion-rate";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ScaleAnalytics {
  fieldId: string;
  label: string;
  mean: number; // rounded to 2 decimal places
  median: number;
  stdDev: number; // rounded to 2 decimal places
  distribution: Record<number, number>; // value -> count
  totalResponses: number;
}

export interface GridAnalytics {
  fieldId: string;
  label: string;
  rows: Array<{
    rowLabel: string;
    mean: number; // rounded to 2 decimal places
    distribution: Record<string, number>; // column -> count
  }>;
  totalResponses: number;
}

export interface ChoiceAnalytics {
  fieldId: string;
  label: string;
  type: "radio" | "select" | "checkbox";
  options: Array<{
    label: string;
    count: number;
    percentage: number; // rounded to 1 decimal place
  }>;
  totalResponses: number;
}

export interface TextAnalytics {
  fieldId: string;
  label: string;
  responses: string[];
  totalResponses: number;
}

/**
 * Grid response: for each respondent, a record mapping row index (or row label)
 * to the selected column index (numeric value).
 */
export type GridResponse = Record<string, number>;

export interface PopularityParams {
  /** Average realisasiHadir for this category */
  avgAttendance: number;
  /** Average conversion rate for this category */
  avgConversion: number;
  /** Average evaluation score for this category */
  avgEvalScore: number;
  /** Min/max values across ALL categories for normalization */
  minAttendance: number;
  maxAttendance: number;
  minConversion: number;
  maxConversion: number;
  minEvalScore: number;
  maxEvalScore: number;
}

// ─── SCALE ANALYTICS ─────────────────────────────────────────────────────────

/**
 * Compute statistical analytics for a scale (Likert) field.
 *
 * @param values - Array of numeric responses (integers within scale range)
 * @returns Object with mean, median, stdDev, and distribution
 *
 * Requirements: 6.1
 * - mean: arithmetic average rounded to 2 decimal places
 * - median: middle value (or average of two middle values) of sorted array
 * - stdDev: population standard deviation rounded to 2 decimal places
 * - distribution: maps each unique value to its occurrence count
 */
export function computeScaleAnalytics(values: number[]): {
  mean: number;
  median: number;
  stdDev: number;
  distribution: Record<number, number>;
} {
  if (values.length === 0) {
    return { mean: 0, median: 0, stdDev: 0, distribution: {} };
  }

  // Mean
  const sum = values.reduce((acc, v) => acc + v, 0);
  const mean = Math.round((sum / values.length) * 100) / 100;

  // Median
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? (sorted[mid - 1]! + sorted[mid]!) / 2
      : sorted[mid]!;

  // Population standard deviation
  const meanExact = sum / values.length;
  const squaredDiffs = values.reduce(
    (acc, v) => acc + (v - meanExact) ** 2,
    0,
  );
  const stdDev =
    Math.round(Math.sqrt(squaredDiffs / values.length) * 100) / 100;

  // Distribution
  const distribution: Record<number, number> = {};
  for (const v of values) {
    distribution[v] = (distribution[v] ?? 0) + 1;
  }

  return { mean, median, stdDev, distribution };
}

// ─── GRID ANALYTICS ──────────────────────────────────────────────────────────

/**
 * Compute analytics for a grid (matrix) field.
 *
 * Each response is a record mapping row labels to selected column indices (numeric).
 * We compute per-row mean and per-column frequency distribution.
 *
 * @param responses - Array of grid responses (one per respondent)
 * @param config - Grid configuration with row and column labels
 * @returns GridAnalytics with per-row statistics
 *
 * Requirements: 6.2
 * - Per-row mean rounded to 2 decimal places
 * - Per-column frequency distribution for each row
 */
export function computeGridAnalytics(
  responses: GridResponse[],
  config: GridConfig,
): GridAnalytics {
  const rows = config.rows.map((rowLabel) => {
    // Collect all numeric values for this row across respondents
    const rowValues: number[] = [];
    for (const response of responses) {
      const value = response[rowLabel];
      if (value !== undefined && value !== null) {
        rowValues.push(value);
      }
    }

    // Mean for this row
    const mean =
      rowValues.length > 0
        ? Math.round(
            (rowValues.reduce((acc, v) => acc + v, 0) / rowValues.length) * 100,
          ) / 100
        : 0;

    // Distribution: count how many times each column was selected.
    // Use a Map to stay safe against option labels that collide with object
    // prototype keys (e.g. "__proto__", "constructor").
    const counts = new Map<string, number>();
    for (const col of config.columns) {
      counts.set(col, 0);
    }
    for (const response of responses) {
      const value = response[rowLabel];
      if (value !== undefined && value !== null) {
        // value is a column index (0-based), map to column label
        const colLabel = config.columns[value];
        if (colLabel !== undefined) {
          counts.set(colLabel, (counts.get(colLabel) ?? 0) + 1);
        }
      }
    }

    const distribution: Record<string, number> = {};
    for (const [col, count] of counts) {
      distribution[col] = count;
    }

    return { rowLabel, mean, distribution };
  });

  return {
    fieldId: "",
    label: "",
    rows,
    totalResponses: responses.length,
  };
}

// ─── CHOICE ANALYTICS ────────────────────────────────────────────────────────

/**
 * Compute frequency distribution for choice fields (radio, select, checkbox).
 *
 * @param responses - Array of responses. Each response is an array of selected option labels.
 *   For radio/select: each response has exactly 1 element.
 *   For checkbox: each response can have multiple elements.
 * @param options - All available option labels
 * @param isMulti - true for checkbox (multiple selections), false for radio/select
 * @returns ChoiceAnalytics with frequency and percentage per option
 *
 * Requirements: 6.3, 6.4
 * - Radio/select: percentage = (count / totalResponses) × 100, rounded to 1 decimal
 * - Checkbox: percentage = (count / totalRespondents) × 100, rounded to 1 decimal
 *   (multiple selections counted independently against total respondents)
 */
export function computeChoiceAnalytics(
  responses: string[][],
  options: string[],
  isMulti: boolean,
): ChoiceAnalytics {
  const totalResponses = responses.length;

  // Count occurrences of each option. Use a Map so option labels that collide
  // with object prototype keys (e.g. "__proto__", "constructor") are counted
  // correctly instead of resolving up the prototype chain.
  const counts = new Map<string, number>();
  for (const opt of options) {
    counts.set(opt, 0);
  }
  for (const response of responses) {
    for (const selected of response) {
      if (counts.has(selected)) {
        counts.set(selected, counts.get(selected)! + 1);
      }
    }
  }

  // For radio/select: percentages sum to 100% (based on total responses)
  // For checkbox: percentages are independent (based on total respondents)
  const denominator = totalResponses;

  const optionResults = options.map((label) => {
    const count = counts.get(label) ?? 0;
    const percentage =
      denominator > 0
        ? Math.round((count / denominator) * 1000) / 10
        : 0;
    return { label, count, percentage };
  });

  return {
    fieldId: "",
    label: "",
    type: isMulti ? "checkbox" : "radio",
    options: optionResults,
    totalResponses,
  };
}

// ─── POPULARITY SCORE ────────────────────────────────────────────────────────

/**
 * Compute popularity score for a category using min-max normalization.
 *
 * Formula: (normalized_attendance × 40%) + (normalized_conversion × 30%) + (normalized_eval_score × 30%)
 * Result scaled to 0-100 range.
 *
 * Edge case: when min === max for a metric (single category or all same values),
 * normalized value defaults to 0. If only one category exists, return 50 as default.
 *
 * @param params - Popularity parameters with raw values and min/max for normalization
 * @returns Popularity score between 0 and 100
 *
 * Requirements: 9.4
 */
export function computePopularityScore(params: PopularityParams): number {
  const {
    avgAttendance,
    avgConversion,
    avgEvalScore,
    minAttendance,
    maxAttendance,
    minConversion,
    maxConversion,
    minEvalScore,
    maxEvalScore,
  } = params;

  // If all min === max (single category scenario), return 50 as default
  const allSame =
    minAttendance === maxAttendance &&
    minConversion === maxConversion &&
    minEvalScore === maxEvalScore;
  if (allSame) return 50;

  // Min-max normalization: (value - min) / (max - min), or 0 if max === min
  const normalizeValue = (value: number, min: number, max: number): number => {
    if (max === min) return 0;
    return (value - min) / (max - min);
  };

  const normAttendance = normalizeValue(
    avgAttendance,
    minAttendance,
    maxAttendance,
  );
  const normConversion = normalizeValue(
    avgConversion,
    minConversion,
    maxConversion,
  );
  const normEvalScore = normalizeValue(avgEvalScore, minEvalScore, maxEvalScore);

  // Weighted formula
  const score =
    (normAttendance * 0.4 + normConversion * 0.3 + normEvalScore * 0.3) * 100;

  // Clamp to [0, 100] and round to 1 decimal
  return Math.round(Math.min(100, Math.max(0, score)) * 10) / 10;
}
