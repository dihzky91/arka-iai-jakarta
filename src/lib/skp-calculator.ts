import { differenceInCalendarDays } from "date-fns";

export function calculateSKP(
  startDate: Date,
  endDate: Date,
  halfDaySkp?: number | null,
): number {
  if (halfDaySkp != null) return halfDaySkp;

  const days = differenceInCalendarDays(endDate, startDate) + 1;
  return Math.max(days, 1) * 8;
}

export function formatSKP(skp: number | string | null | undefined): string {
  if (skp == null || skp === "") return "-";
  const value = typeof skp === "number" ? skp : Number(skp);
  if (Number.isNaN(value)) return "-";
  return `${value} SKP`;
}
