import { getAllSampleData, getSampleData } from "./variable-registry";
import type { VariableCategory } from "./types";

const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/**
 * Generate global variables that are always available at runtime.
 */
export function getGlobalVariables(): Record<string, string> {
  const now = new Date();
  const dateStr = `${now.getDate()} ${MONTH_NAMES_ID[now.getMonth()]} ${now.getFullYear()}`;
  return {
    "app.name": "ARKA",
    "app.url": process.env.NEXT_PUBLIC_APP_URL ?? "https://arka.iai-jakarta.or.id",
    "app.logo_url": "",
    "current.date": dateStr,
    "current.year": now.getFullYear().toString(),
    "org.nama": "IAI Wilayah DKI Jakarta",
  };
}

/**
 * Generate sample data for preview based on template category.
 */
export function generateSampleData(
  category?: string,
): Record<string, string> {
  if (category && category !== "custom") {
    return getSampleData(category as VariableCategory);
  }
  return getAllSampleData();
}
