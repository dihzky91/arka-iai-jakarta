import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const APP_TIME_ZONE = "Asia/Jakarta";
const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

// Untuk format nomor surat: {counter}/{prefix}/{bulanRomawi}/{tahun}
const ROMAWI = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
] as const;

export function formatBulanRomawi(bulan: number): string {
  if (bulan < 1 || bulan > 12) {
    throw new Error(`Bulan harus 1-12, dapat: ${bulan}`);
  }
  return ROMAWI[bulan - 1]!;
}

function getJakartaDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Gagal membaca tanggal Asia/Jakarta.");
  }

  return { year, month, day };
}

export function getTodayIsoInJakarta(date = new Date()): string {
  const { year, month, day } = getJakartaDateParts(date);
  return `${year}-${month}-${day}`;
}

export function getWeekdayInJakarta(date = new Date()): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
  }).format(date);

  return WEEKDAY_MAP[weekday] ?? 0;
}

function parseIsoDateParts(isoDate: string) {
  const [yearText, monthText, dayText] = isoDate.split("-");
  const year = Number.parseInt(yearText ?? "", 10);
  const month = Number.parseInt(monthText ?? "", 10);
  const day = Number.parseInt(dayText ?? "", 10);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    throw new Error(`Format tanggal tidak valid: ${isoDate}`);
  }

  return { year, month, day };
}

export function addDaysToIsoDate(isoDate: string, offsetDays: number): string {
  const { year, month, day } = parseIsoDateParts(isoDate);
  const utcDate = new Date(Date.UTC(year, month - 1, day + offsetDays));
  const shiftedYear = utcDate.getUTCFullYear();
  const shiftedMonth = `${utcDate.getUTCMonth() + 1}`.padStart(2, "0");
  const shiftedDay = `${utcDate.getUTCDate()}`.padStart(2, "0");
  return `${shiftedYear}-${shiftedMonth}-${shiftedDay}`;
}

export function parseIsoDateInJakarta(isoDate: string): Date {
  const { year, month, day } = parseIsoDateParts(isoDate);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
}

export function parseIsoDateTimeInJakarta(
  isoDate: string,
  timeHHmm: string,
): Date {
  const { year, month, day } = parseIsoDateParts(isoDate);
  const [hourText, minuteText] = timeHHmm.split(":");
  const hour = Number.parseInt(hourText ?? "", 10);
  const minute = Number.parseInt(minuteText ?? "", 10);

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error(`Format jam tidak valid: ${timeHHmm}`);
  }

  // Asia/Jakarta is UTC+7 with no DST.
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute, 0));
}

export function getMonthRangeInJakarta(date = new Date()) {
  const { year, month } = getJakartaDateParts(date);
  const monthNumber = Number(month);
  const yearNumber = Number(year);
  const lastDay = new Date(Date.UTC(yearNumber, monthNumber, 0)).getUTCDate();

  return {
    start: `${year}-${month}-01`,
    end: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function getCurrentMonthInJakarta(date = new Date()): number {
  return Number(getJakartaDateParts(date).month);
}

export function getCurrentYearInJakarta(date = new Date()): number {
  return Number(getJakartaDateParts(date).year);
}

// Tampilkan tanggal mengikuti Asia/Jakarta agar konsisten lintas server/client.
export function formatTanggal(iso: string | Date | null | undefined): string {
  if (!iso) return "-";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  }).format(d);
}

export function formatTanggalPendek(
  iso: string | Date | null | undefined,
): string {
  if (!iso) return "-";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  }).format(d);
}

export function formatTanggalLengkapJakarta(
  iso: string | Date | null | undefined,
): string {
  if (!iso) return "-";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  }).format(d);
}

export function formatTanggalWaktuJakarta(
  iso: string | Date | null | undefined,
): string {
  if (!iso) return "-";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: APP_TIME_ZONE,
  }).format(d);
}
