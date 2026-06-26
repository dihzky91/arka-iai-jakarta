import { z } from "zod";
import { APP_TIME_ZONE, getTodayIsoInJakarta } from "@/lib/utils";
import { nanoid } from "nanoid";

// ─── ZOD SCHEMAS ──────────────────────────────────────────────────────────────

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const upsertRateSchema = z.object({
  instructorId: z.string().min(1),
  programId: z.string().min(1),
  materiBlock: z.string().trim().min(1).max(100),
  mode: z.enum(["online", "offline"]),
  rateAmount: z.number().finite().min(0),
});

export const upsertRateRuleSchema = z.object({
  id: z.string().optional(),
  programId: z.string().min(1),
  level: z.enum(["basic", "middle", "senior"]),
  mode: z.enum(["online", "offline"]),
  honorPerSession: z.number().finite().min(0),
  transportAmount: z.number().finite().min(0),
  effectiveFrom: dateSchema,
  effectiveTo: dateSchema.optional().or(z.literal("")),
  locationScope: z.string().trim().max(200).optional().or(z.literal("")),
  notes: z.string().trim().max(300).optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export const reportFilterSchema = z.object({
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  instructorId: z.string().optional(),
  programId: z.string().optional(),
});

export const generateBatchSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
  internalNotes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const listBatchFilterSchema = z.object({
  startDate: dateSchema.optional().or(z.literal("")),
  endDate: dateSchema.optional().or(z.literal("")),
  status: z
    .enum([
      "draft",
      "dikirim_ke_keuangan",
      "diproses_keuangan",
      "dibayar",
      "locked",
    ])
    .optional()
    .or(z.literal("")),
  financeOnly: z.boolean().optional(),
});

export const listBatchPageSchema = listBatchFilterSchema.extend({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(5).max(100).default(10),
  sortBy: z
    .enum([
      "documentNumber",
      "periodStart",
      "itemCount",
      "netAmount",
      "status",
      "submittedAt",
      "waitingDays",
      "createdAt",
    ])
    .default("submittedAt"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
});

export const batchIdSchema = z.object({
  batchId: z.string().min(1),
});

export const batchIdsSchema = z.object({
  batchIds: z.array(z.string().min(1)).min(1),
});

export const markBatchPaidSchema = z.object({
  batchId: z.string().min(1),
  paidDate: dateSchema.optional(),
  paymentReference: z
    .string()
    .trim()
    .min(1, "Referensi transfer wajib diisi.")
    .max(200),
  paymentAmount: z
    .number()
    .finite()
    .positive("Nominal pembayaran harus lebih dari 0."),
});

export const correctBatchPaymentSchema = markBatchPaidSchema.extend({
  reason: z.string().trim().min(1, "Alasan koreksi wajib diisi.").max(500),
});

export const addDeductionSchema = z.object({
  batchId: z.string().min(1),
  instructorId: z.string().min(1),
  deductionType: z.enum(["pph21", "pph23", "other"]),
  description: z.string().trim().min(1).max(200),
  amount: z.number().finite().min(0),
});

export const removeDeductionSchema = z.object({
  deductionId: z.string().min(1),
});

export const reopenBatchSchema = z.object({
  batchId: z.string().min(1),
  reason: z.string().trim().min(1, "Alasan reopen wajib diisi.").max(500),
});

export const exportPdfAuditSchema = z.object({
  batchId: z.string().min(1),
  fileName: z.string().trim().min(1).max(220),
});

export const uploadPaymentProofSchema = z.object({
  batchId: z.string().min(1),
  fileName: z.string().trim().min(1).max(500),
  contentType: z.string().trim().min(1).max(255),
  dataUrl: z.string().trim().min(1),
});

export const financeRecapFilterSchema = z.object({
  startDate: dateSchema.optional().or(z.literal("")),
  endDate: dateSchema.optional().or(z.literal("")),
  instructorId: z.string().optional().or(z.literal("")),
  status: z
    .enum([
      "dikirim_ke_keuangan",
      "diproses_keuangan",
      "dibayar",
      "locked",
      "all",
    ])
    .optional()
    .or(z.literal("")),
});

export const reminderBatchSchema = z.object({
  batchId: z.string().min(1),
  channels: z.array(z.enum(["whatsapp", "email"])).min(1),
});

export const sendDirectWaReminderSchema = z.object({
  batchId: z.string().min(1),
  recipientPhone: z.string().min(5),
  message: z.string().min(5).max(5000),
});

export const generateFromSelectionSchema = z.object({
  assignmentIds: z.array(z.string().min(1)).min(1, "Minimal 1 sesi dipilih."),
  internalNotes: z.string().trim().max(500).optional().or(z.literal("")),
});

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type HonorariumBatchStatus =
  | "draft"
  | "dikirim_ke_keuangan"
  | "diproses_keuangan"
  | "dibayar"
  | "locked";

export type ExpertiseLevel = "basic" | "middle" | "senior";
export type RoleValue = "admin" | "staff" | "pejabat" | "viewer";

export type RateRuleCandidate = {
  programId: string;
  level: string;
  mode: string;
  honorPerSession: unknown;
  transportAmount: unknown;
  effectiveFrom: string;
  effectiveTo: string | null;
  locationScope: string;
};

export type ExistingAssignmentRow = {
  assignmentId: string;
  batchId: string;
  documentNumber: string;
  status: string;
};

// ─── UTILITY FUNCTIONS ────────────────────────────────────────────────────────

export function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function formatCurrency(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

export function batchStatusLabel(status: HonorariumBatchStatus) {
  if (status === "draft") return "Draft";
  if (status === "dikirim_ke_keuangan") return "Dikirim ke Keuangan";
  if (status === "diproses_keuangan") return "Diproses Keuangan";
  if (status === "dibayar") return "Dibayar";
  if (status === "locked") return "Locked";
  return status;
}

export function batchStatusLabelLoose(status: string) {
  if (
    status === "draft" ||
    status === "dikirim_ke_keuangan" ||
    status === "diproses_keuangan" ||
    status === "dibayar" ||
    status === "locked"
  ) {
    return batchStatusLabel(status);
  }
  return status;
}

export function defaultDateRange() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const partMap = new Map(parts.map((part) => [part.type, part.value]));
  const year = partMap.get("year") ?? String(now.getFullYear());
  const month =
    partMap.get("month") ?? String(now.getMonth() + 1).padStart(2, "0");
  const day = partMap.get("day") ?? String(now.getDate()).padStart(2, "0");

  return {
    startDate: `${year}-${month}-01`,
    endDate: `${year}-${month}-${day}`,
  };
}

export function normalizeMode(mode: string | null): "online" | "offline" {
  return mode === "online" ? "online" : "offline";
}

export function isDateWithinRange(
  dateValue: string,
  start: string,
  end: string | null,
) {
  if (dateValue < start) return false;
  if (end && dateValue > end) return false;
  return true;
}

export function matchLocationScope(location: string | null, scope: string) {
  const normalizedScope = scope.trim().toLowerCase();
  if (!normalizedScope) return true;
  if (!location) return false;
  return location.toLowerCase().includes(normalizedScope);
}

export function normalizeExpertiseLevel(level: string | null): ExpertiseLevel {
  if (level === "basic" || level === "middle" || level === "senior")
    return level;
  if (level === "intermediate") return "middle";
  if (level === "expert") return "senior";
  return "middle";
}

export function pickRateRule(
  rules: RateRuleCandidate[],
  params: {
    programId: string;
    level: ExpertiseLevel;
    mode: "online" | "offline";
    scheduledDate: string;
    lokasi: string | null;
  },
) {
  const filtered = rules.filter((rule) => {
    if (rule.programId !== params.programId) return false;
    if (normalizeExpertiseLevel(rule.level) !== params.level) return false;
    if (rule.mode !== params.mode) return false;
    if (
      !isDateWithinRange(
        params.scheduledDate,
        rule.effectiveFrom,
        rule.effectiveTo,
      )
    )
      return false;
    return matchLocationScope(params.lokasi, rule.locationScope);
  });

  if (filtered.length === 0) return null;

  const sorted = filtered.sort((a, b) => {
    const aHasScope = a.locationScope.trim().length > 0 ? 1 : 0;
    const bHasScope = b.locationScope.trim().length > 0 ? 1 : 0;
    if (aHasScope !== bHasScope) return bHasScope - aHasScope;
    return b.effectiveFrom.localeCompare(a.effectiveFrom);
  });

  return sorted[0] ?? null;
}

export function nextHonorariumDocumentNumber() {
  const { year, month, day } = getJakartaDatePartsFromUtils();
  return `HON-${year}${month}${day}-${nanoid(6).toUpperCase()}`;
}

export function getJakartaDatePartsFromUtils() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parts.find((p) => p.type === "month")!.value;
  const day = parts.find((p) => p.type === "day")!.value;
  return { year, month, day };
}

export function mergeNotes(current: string | null, next: string | undefined) {
  const trimmed = next?.trim();
  if (!trimmed) return current;
  if (!current?.trim()) return trimmed;
  return `${current.trim()}\n${trimmed}`;
}

export function parsePaidDate(value: string | undefined) {
  if (!value) return new Date();
  const parsed = new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

export function readObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function addDaysToIsoDate(isoDate: string, days: number) {
  const base = new Date(`${isoDate}T00:00:00+07:00`);
  if (Number.isNaN(base.getTime())) {
    return isoDate;
  }
  base.setDate(base.getDate() + days);
  return getTodayIsoInJakarta(base);
}

export function getWaitingDays(submittedAt: Date | null) {
  if (!submittedAt) return 0;
  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  const submittedUtc = new Date(
    `${formatDate(submittedAt)}T00:00:00Z`,
  ).getTime();
  const todayUtc = new Date(`${formatDate(new Date())}T00:00:00Z`).getTime();
  return Math.max(0, Math.floor((todayUtc - submittedUtc) / 86_400_000));
}

export function isUniqueViolationOnHonorariumAssignment(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const withCode = error as {
    code?: string;
    constraint?: string;
    message?: string;
  };
  if (withCode.code !== "23505") return false;
  if (withCode.constraint === "uniq_honorarium_assignment_once") return true;
  return typeof withCode.message === "string"
    ? withCode.message.includes("uniq_honorarium_assignment_once")
    : false;
}

export type HonorariumBatchSortBy = z.infer<
  typeof listBatchPageSchema
>["sortBy"];

export type HonorariumBatchSortDir = z.infer<
  typeof listBatchPageSchema
>["sortDir"];

export type SessionHonorariumStatusValue = "outstanding" | "draft" | "submitted" | "paid" | null;

export function mapBatchStatusToSessionStatus(batchStatus: string): SessionHonorariumStatusValue {
  switch (batchStatus) {
    case "draft":
      return "draft";
    case "dikirim_ke_keuangan":
    case "diproses_keuangan":
      return "submitted";
    case "dibayar":
    case "locked":
      return "paid";
    default:
      return "draft";
  }
}

export function statusPriority(status: SessionHonorariumStatusValue): number {
  switch (status) {
    case "paid": return 3;
    case "submitted": return 2;
    case "draft": return 1;
    case "outstanding": return 0;
    default: return -1;
  }
}
