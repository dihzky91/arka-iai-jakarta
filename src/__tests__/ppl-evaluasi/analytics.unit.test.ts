import { describe, it, expect } from "vitest";
import {
  computeScaleAnalytics,
  computeGridAnalytics,
  computeChoiceAnalytics,
  computePopularityScore,
} from "@/server/lib/ppl-analytics";
import { computeConversionRate } from "@/lib/ppl-conversion-rate";

describe("computeScaleAnalytics", () => {
  it("returns zeros for empty array", () => {
    const result = computeScaleAnalytics([]);
    expect(result).toEqual({ mean: 0, median: 0, stdDev: 0, distribution: {} });
  });

  it("computes correct statistics for single value", () => {
    const result = computeScaleAnalytics([5]);
    expect(result.mean).toBe(5);
    expect(result.median).toBe(5);
    expect(result.stdDev).toBe(0);
    expect(result.distribution).toEqual({ 5: 1 });
  });

  it("computes correct mean rounded to 2 decimal places", () => {
    const result = computeScaleAnalytics([1, 2, 3]);
    expect(result.mean).toBe(2);
  });

  it("computes mean with rounding", () => {
    // 1+2+3+4+5+6+7 = 28, 28/7 = 4
    const result = computeScaleAnalytics([1, 2, 3, 4, 5, 6, 7]);
    expect(result.mean).toBe(4);
  });

  it("computes mean with non-trivial rounding", () => {
    // 1+1+2 = 4, 4/3 = 1.333...
    const result = computeScaleAnalytics([1, 1, 2]);
    expect(result.mean).toBe(1.33);
  });

  it("computes correct median for odd-length array", () => {
    const result = computeScaleAnalytics([3, 1, 5, 2, 4]);
    expect(result.median).toBe(3);
  });

  it("computes correct median for even-length array", () => {
    const result = computeScaleAnalytics([1, 2, 3, 4]);
    expect(result.median).toBe(2.5);
  });

  it("computes correct population standard deviation", () => {
    // values: [2, 4, 4, 4, 5, 5, 7, 9]
    // mean = 40/8 = 5
    // variance = ((2-5)^2 + (4-5)^2 + (4-5)^2 + (4-5)^2 + (5-5)^2 + (5-5)^2 + (7-5)^2 + (9-5)^2) / 8
    //          = (9 + 1 + 1 + 1 + 0 + 0 + 4 + 16) / 8 = 32/8 = 4
    // stdDev = sqrt(4) = 2
    const result = computeScaleAnalytics([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(result.stdDev).toBe(2);
  });

  it("computes correct distribution", () => {
    const result = computeScaleAnalytics([1, 2, 2, 3, 3, 3]);
    expect(result.distribution).toEqual({ 1: 1, 2: 2, 3: 3 });
  });

  it("distribution counts sum equals array length", () => {
    const values = [1, 3, 3, 5, 5, 5, 4, 4, 2];
    const result = computeScaleAnalytics(values);
    const totalCount = Object.values(result.distribution).reduce(
      (a, b) => a + b,
      0,
    );
    expect(totalCount).toBe(values.length);
  });
});

describe("computeGridAnalytics", () => {
  const config = {
    rows: ["Materi jelas", "Penyampaian baik"],
    columns: ["Sangat Tidak Setuju", "Tidak Setuju", "Netral", "Setuju", "Sangat Setuju"],
  };

  it("returns empty rows for no responses", () => {
    const result = computeGridAnalytics([], config);
    expect(result.totalResponses).toBe(0);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].mean).toBe(0);
  });

  it("computes per-row mean correctly", () => {
    // Respondent 1: row0=3 (Setuju), row1=4 (Sangat Setuju)
    // Respondent 2: row0=2 (Netral), row1=3 (Setuju)
    const responses = [
      { "Materi jelas": 3, "Penyampaian baik": 4 },
      { "Materi jelas": 2, "Penyampaian baik": 3 },
    ];
    const result = computeGridAnalytics(responses, config);

    // Row "Materi jelas": mean = (3+2)/2 = 2.5
    expect(result.rows[0].mean).toBe(2.5);
    // Row "Penyampaian baik": mean = (4+3)/2 = 3.5
    expect(result.rows[1].mean).toBe(3.5);
  });

  it("computes per-column distribution correctly", () => {
    // Both respondents select column index 3 (Setuju) for "Materi jelas"
    const responses = [
      { "Materi jelas": 3, "Penyampaian baik": 4 },
      { "Materi jelas": 3, "Penyampaian baik": 2 },
    ];
    const result = computeGridAnalytics(responses, config);

    expect(result.rows[0].distribution["Setuju"]).toBe(2);
    expect(result.rows[0].distribution["Sangat Setuju"]).toBe(0);
  });

  it("handles missing row values gracefully", () => {
    // Respondent 2 didn't answer "Penyampaian baik"
    const responses = [
      { "Materi jelas": 3, "Penyampaian baik": 4 },
      { "Materi jelas": 2 },
    ];
    const result = computeGridAnalytics(responses, config);

    // "Penyampaian baik" only has 1 value (4)
    expect(result.rows[1].mean).toBe(4);
    expect(result.totalResponses).toBe(2);
  });
});

describe("computeChoiceAnalytics", () => {
  const options = ["Sangat Puas", "Puas", "Cukup", "Tidak Puas"];

  it("returns zero counts for no responses", () => {
    const result = computeChoiceAnalytics([], options, false);
    expect(result.totalResponses).toBe(0);
    expect(result.options.every((o) => o.count === 0)).toBe(true);
    expect(result.options.every((o) => o.percentage === 0)).toBe(true);
  });

  it("computes radio/select frequency correctly", () => {
    const responses = [
      ["Sangat Puas"],
      ["Puas"],
      ["Puas"],
      ["Cukup"],
    ];
    const result = computeChoiceAnalytics(responses, options, false);

    expect(result.totalResponses).toBe(4);
    expect(result.type).toBe("radio");
    expect(result.options[0]).toEqual({ label: "Sangat Puas", count: 1, percentage: 25 });
    expect(result.options[1]).toEqual({ label: "Puas", count: 2, percentage: 50 });
    expect(result.options[2]).toEqual({ label: "Cukup", count: 1, percentage: 25 });
    expect(result.options[3]).toEqual({ label: "Tidak Puas", count: 0, percentage: 0 });
  });

  it("computes checkbox frequency with independent percentages", () => {
    // 3 respondents, each can select multiple options
    const responses = [
      ["Sangat Puas", "Puas"],       // selected 2
      ["Puas", "Cukup"],             // selected 2
      ["Sangat Puas"],               // selected 1
    ];
    const result = computeChoiceAnalytics(responses, options, true);

    expect(result.totalResponses).toBe(3);
    expect(result.type).toBe("checkbox");
    // Sangat Puas: 2/3 = 66.7%
    expect(result.options[0]).toEqual({ label: "Sangat Puas", count: 2, percentage: 66.7 });
    // Puas: 2/3 = 66.7%
    expect(result.options[1]).toEqual({ label: "Puas", count: 2, percentage: 66.7 });
    // Cukup: 1/3 = 33.3%
    expect(result.options[2]).toEqual({ label: "Cukup", count: 1, percentage: 33.3 });
    // Tidak Puas: 0/3 = 0%
    expect(result.options[3]).toEqual({ label: "Tidak Puas", count: 0, percentage: 0 });
  });

  it("radio percentages sum to approximately 100%", () => {
    const responses = [
      ["Sangat Puas"],
      ["Puas"],
      ["Cukup"],
    ];
    const result = computeChoiceAnalytics(responses, options, false);
    const totalPercentage = result.options.reduce((sum, o) => sum + o.percentage, 0);
    // Allow small rounding tolerance
    expect(totalPercentage).toBeCloseTo(100, 0);
  });
});

describe("computeConversionRate", () => {
  it("returns null when pendaftar is 0", () => {
    expect(computeConversionRate(0, 50)).toBeNull();
  });

  it("returns null when pendaftar is negative", () => {
    expect(computeConversionRate(-1, 50)).toBeNull();
  });

  it("calculates correct rate", () => {
    // 80/100 * 100 = 80.0
    expect(computeConversionRate(100, 80)).toBe(80);
  });

  it("rounds to 1 decimal place", () => {
    // 33/100 * 100 = 33.0
    expect(computeConversionRate(100, 33)).toBe(33);
    // 1/3 * 100 = 33.333... -> 33.3
    expect(computeConversionRate(3, 1)).toBe(33.3);
  });

  it("handles realisasiHadir > pendaftar", () => {
    // 120/100 * 100 = 120.0
    expect(computeConversionRate(100, 120)).toBe(120);
  });
});

describe("computePopularityScore", () => {
  it("returns 50 when all min === max (single category)", () => {
    const result = computePopularityScore({
      avgAttendance: 100,
      avgConversion: 80,
      avgEvalScore: 4.5,
      minAttendance: 100,
      maxAttendance: 100,
      minConversion: 80,
      maxConversion: 80,
      minEvalScore: 4.5,
      maxEvalScore: 4.5,
    });
    expect(result).toBe(50);
  });

  it("returns 100 for the category with all max values", () => {
    const result = computePopularityScore({
      avgAttendance: 200,
      avgConversion: 90,
      avgEvalScore: 5,
      minAttendance: 50,
      maxAttendance: 200,
      minConversion: 30,
      maxConversion: 90,
      minEvalScore: 2,
      maxEvalScore: 5,
    });
    expect(result).toBe(100);
  });

  it("returns 0 for the category with all min values", () => {
    const result = computePopularityScore({
      avgAttendance: 50,
      avgConversion: 30,
      avgEvalScore: 2,
      minAttendance: 50,
      maxAttendance: 200,
      minConversion: 30,
      maxConversion: 90,
      minEvalScore: 2,
      maxEvalScore: 5,
    });
    expect(result).toBe(0);
  });

  it("computes correct weighted score", () => {
    // normAttendance = (150-50)/(200-50) = 100/150 = 0.6667
    // normConversion = (60-30)/(90-30) = 30/60 = 0.5
    // normEvalScore = (3.5-2)/(5-2) = 1.5/3 = 0.5
    // score = (0.6667*0.4 + 0.5*0.3 + 0.5*0.3) * 100
    //       = (0.2667 + 0.15 + 0.15) * 100
    //       = 0.5667 * 100 = 56.67 -> 56.7
    const result = computePopularityScore({
      avgAttendance: 150,
      avgConversion: 60,
      avgEvalScore: 3.5,
      minAttendance: 50,
      maxAttendance: 200,
      minConversion: 30,
      maxConversion: 90,
      minEvalScore: 2,
      maxEvalScore: 5,
    });
    expect(result).toBeCloseTo(56.7, 1);
  });

  it("score is always between 0 and 100", () => {
    const result = computePopularityScore({
      avgAttendance: 75,
      avgConversion: 45,
      avgEvalScore: 3,
      minAttendance: 50,
      maxAttendance: 200,
      minConversion: 30,
      maxConversion: 90,
      minEvalScore: 2,
      maxEvalScore: 5,
    });
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });

  it("handles partial same metrics (one metric has min === max)", () => {
    // When one metric has same min/max, its normalized value is 0
    const result = computePopularityScore({
      avgAttendance: 100,
      avgConversion: 80,
      avgEvalScore: 4,
      minAttendance: 100,
      maxAttendance: 100, // same -> normalized = 0
      minConversion: 50,
      maxConversion: 90,
      minEvalScore: 2,
      maxEvalScore: 5,
    });
    // normAttendance = 0 (min===max)
    // normConversion = (80-50)/(90-50) = 30/40 = 0.75
    // normEvalScore = (4-2)/(5-2) = 2/3 = 0.6667
    // score = (0*0.4 + 0.75*0.3 + 0.6667*0.3) * 100
    //       = (0 + 0.225 + 0.2) * 100 = 42.5
    expect(result).toBeCloseTo(42.5, 1);
  });
});
