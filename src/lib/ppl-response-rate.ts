/**
 * Calculate the response rate for a Kegiatan.
 *
 * Formula: round((respondenCount / realisasiHadir) × 100, 1) when realisasiHadir > 0
 * Returns null when realisasiHadir is 0 (response rate not available).
 *
 * @param realisasiHadir - Number of actual attendees (integer, 0–99,999)
 * @param respondenCount - Number of respondents who submitted evaluations (integer, 0–99,999)
 * @returns Response rate as percentage rounded to 1 decimal, or null if realisasiHadir is 0
 */
export function computeResponseRate(
  realisasiHadir: number,
  respondenCount: number,
): number | null {
  if (realisasiHadir <= 0) return null;
  return Math.round((respondenCount / realisasiHadir) * 1000) / 10;
}
