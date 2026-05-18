/**
 * Calculate the conversion rate for a Kegiatan.
 *
 * Formula: round((realisasiHadir / pendaftar) × 100, 1) when pendaftar > 0
 * Returns null when pendaftar is 0 (displayed as "N/A").
 *
 * @param pendaftar - Number of registrants (integer, 0–99,999)
 * @param realisasiHadir - Number of actual attendees (integer, 0–99,999)
 * @returns Conversion rate as percentage rounded to 1 decimal, or null if pendaftar is 0
 */
export function computeConversionRate(
  pendaftar: number,
  realisasiHadir: number,
): number | null {
  if (pendaftar <= 0) return null;
  return Math.round((realisasiHadir / pendaftar) * 1000) / 10;
}
