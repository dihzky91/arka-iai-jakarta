/**
 * Pure computation helper functions for Narasumber Performance Analytics.
 *
 * These functions encapsulate the core narasumber analytics logic used by the
 * speaker performance dashboard, separated from database concerns for testability.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import type { FormField } from "@/components/ppl-evaluasi/form-builder/types";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface NarasumberAssignment {
  narasumberId: number;
  kegiatanId: number;
  kegiatanNama: string;
  kategoriPpl: string;
  tanggalSelesai: string; // "YYYY-MM-DD"
  skp: number;
  statusEvent: string; // "aktif" | "archived"
}

export interface KegiatanEvalData {
  kegiatanId: number;
  configJson: FormField[];
  answersJson: Record<string, unknown>;
}

export interface NarasumberInfo {
  id: number;
  nama: string;
  email: string;
}

export interface SpeakerScoreTrendEntry {
  kegiatanId: number;
  kegiatanNama: string;
  tanggalSelesai: string;
  avgScore: number;
  respondenCount: number;
}

export interface SpeakerPerformanceEntry {
  narasumberId: number;
  nama: string;
  email: string;
  avgScore: number | null;
  kegiatanCount: number;
  totalSkp: number;
  respondenCount: number;
  trend: SpeakerScoreTrendEntry[];
  hasEvaluationData: boolean;
}

// ─── EXTRACT NUMERIC SCORES FROM RESPONSES ───────────────────────────────────

/**
 * Extract all numeric evaluation scores from a set of responses for a kegiatan.
 * Considers only "scale" and "grid" field types.
 *
 * For scale fields: extracts the numeric value directly.
 * For grid fields: extracts all numeric values from the grid object.
 *
 * Requirements: 10.1
 */
export function extractNumericScores(
  responses: KegiatanEvalData[],
): number[] {
  const scores: number[] = [];

  for (const resp of responses) {
    const fields = resp.configJson;
    const answers = resp.answersJson;

    for (const field of fields) {
      if (field.type === "scale") {
        const val = answers[field.id];
        if (val !== undefined && val !== null) {
          const num = Number(val);
          if (!isNaN(num)) scores.push(num);
        }
      } else if (field.type === "grid") {
        const val = answers[field.id];
        if (val && typeof val === "object" && !Array.isArray(val)) {
          for (const v of Object.values(val as Record<string, unknown>)) {
            const num = Number(v);
            if (!isNaN(num)) scores.push(num);
          }
        }
      }
    }
  }

  return scores;
}

/**
 * Compute the average evaluation score from an array of numeric values.
 * Returns null if no values are provided.
 * Result is rounded to 2 decimal places.
 *
 * Requirements: 10.1
 */
export function computeAverageScore(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const sum = scores.reduce((acc, v) => acc + v, 0);
  return Math.round((sum / scores.length) * 100) / 100;
}

// ─── KEGIATAN COUNT AND SKP SUM ──────────────────────────────────────────────

/**
 * Count completed kegiatan and sum their SKP values for a narasumber.
 * A kegiatan is considered "completed" if its status is "archived" or
 * its tanggal_selesai is on or before today.
 *
 * Requirements: 10.3
 */
export function computeCompletedKegiatanStats(
  assignments: NarasumberAssignment[],
  today: string,
): { kegiatanCount: number; totalSkp: number } {
  const completed = assignments.filter(
    (a) => a.statusEvent === "archived" || a.tanggalSelesai <= today,
  );
  return {
    kegiatanCount: completed.length,
    totalSkp: completed.reduce((sum, a) => sum + a.skp, 0),
  };
}

// ─── SCORE TREND ─────────────────────────────────────────────────────────────

/**
 * Build the evaluation score trend for a narasumber, ordered chronologically
 * by tanggal_selesai.
 *
 * For each kegiatan assignment that has evaluation data, computes the average
 * score and includes it in the trend.
 *
 * Requirements: 10.4
 */
export function buildScoreTrend(
  assignments: NarasumberAssignment[],
  evalDataByKegiatan: Map<number, KegiatanEvalData[]>,
): SpeakerScoreTrendEntry[] {
  const trend: SpeakerScoreTrendEntry[] = [];

  for (const assignment of assignments) {
    const responses = evalDataByKegiatan.get(assignment.kegiatanId);
    if (!responses || responses.length === 0) continue;

    const scores = extractNumericScores(responses);
    if (scores.length === 0) continue;

    const avgScore = computeAverageScore(scores)!;
    trend.push({
      kegiatanId: assignment.kegiatanId,
      kegiatanNama: assignment.kegiatanNama,
      tanggalSelesai: assignment.tanggalSelesai,
      avgScore,
      respondenCount: responses.length,
    });
  }

  // Sort chronologically by tanggal_selesai
  trend.sort((a, b) => a.tanggalSelesai.localeCompare(b.tanggalSelesai));

  return trend;
}

// ─── RANKING ─────────────────────────────────────────────────────────────────

/**
 * Rank speakers by average evaluation score in descending order.
 * Speakers without evaluation data (avgScore === null) are placed at the end.
 *
 * Requirements: 10.2
 */
export function rankSpeakersByScore(
  speakers: SpeakerPerformanceEntry[],
): SpeakerPerformanceEntry[] {
  return [...speakers].sort((a, b) => {
    if (a.avgScore === null && b.avgScore === null) return 0;
    if (a.avgScore === null) return 1;
    if (b.avgScore === null) return -1;
    return b.avgScore - a.avgScore;
  });
}

// ─── CATEGORY FILTER ─────────────────────────────────────────────────────────

/**
 * Filter narasumber assignments by Kategori_PPL.
 * Returns only assignments matching the specified category.
 *
 * Requirements: 10.5
 */
export function filterAssignmentsByCategory(
  assignments: NarasumberAssignment[],
  kategori: string,
): NarasumberAssignment[] {
  return assignments.filter((a) => a.kategoriPpl === kategori);
}

// ─── COMPUTE SPEAKER PERFORMANCE (PURE) ─────────────────────────────────────

/**
 * Compute full speaker performance data from pre-fetched inputs.
 * This is the pure computation core of getSpeakerPerformance.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */
export function computeSpeakerPerformance(
  narasumberList: NarasumberInfo[],
  assignments: NarasumberAssignment[],
  evalDataByKegiatan: Map<number, KegiatanEvalData[]>,
  today: string,
): SpeakerPerformanceEntry[] {
  const speakers: SpeakerPerformanceEntry[] = [];

  for (const narasumber of narasumberList) {
    const narasumberAssignments = assignments.filter(
      (a) => a.narasumberId === narasumber.id,
    );

    if (narasumberAssignments.length === 0) continue;

    // Count completed kegiatan
    const { kegiatanCount, totalSkp } = computeCompletedKegiatanStats(
      narasumberAssignments,
      today,
    );

    // Build score trend
    const trend = buildScoreTrend(narasumberAssignments, evalDataByKegiatan);

    // Compute overall average score
    let totalScore = 0;
    let totalScoreCount = 0;
    let totalRespondenCount = 0;

    for (const assignment of narasumberAssignments) {
      const responses = evalDataByKegiatan.get(assignment.kegiatanId);
      if (!responses || responses.length === 0) continue;

      const scores = extractNumericScores(responses);
      totalScore += scores.reduce((sum, s) => sum + s, 0);
      totalScoreCount += scores.length;
      totalRespondenCount += responses.length;
    }

    const hasEvaluationData = totalScoreCount > 0;
    const avgScore = hasEvaluationData
      ? Math.round((totalScore / totalScoreCount) * 100) / 100
      : null;

    speakers.push({
      narasumberId: narasumber.id,
      nama: narasumber.nama,
      email: narasumber.email,
      avgScore,
      kegiatanCount,
      totalSkp,
      respondenCount: totalRespondenCount,
      trend,
      hasEvaluationData,
    });
  }

  return rankSpeakersByScore(speakers);
}
