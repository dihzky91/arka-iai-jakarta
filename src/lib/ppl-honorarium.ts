/**
 * Calculate total honorarium for a Narasumber assigned to a Kegiatan.
 *
 * Formula: fee_per_skp × SKP kegiatan
 *
 * @param feePerSkp - Narasumber's fee per SKP (integer, 0–99,999,999 IDR)
 * @param skp - Kegiatan's SKP value (integer, 1–999)
 * @returns Total honorarium in IDR
 */
export function calculateHonorarium(feePerSkp: number, skp: number): number {
  return feePerSkp * skp;
}
