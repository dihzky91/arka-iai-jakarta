"use server";

/**
 * Barrel file — re-exports all honorarium modules for backward compatibility.
 *
 * Internal structure:
 * - honorarium-utils.ts        → Schemas, types, utility functions
 * - honorarium-rate-rules.ts   → CRUD tarif instruktur & rate rules
 * - honorarium-report.ts       → Report, outstanding sessions, session status
 * - honorarium-batch-crud.ts   → Batch listing, detail, suggested period, preview
 * - honorarium-batch-workflow.ts → State transitions, generate, delete, reopen
 * - honorarium-deductions.ts   → Deduction CRUD
 * - honorarium-payment-proofs.ts → Payment proof listing & upload
 * - honorarium-notifications.ts → Notifications & reminders
 * - honorarium-export.ts       → Excel/PDF export, finance recap
 */

// ─── Utils & Types ────────────────────────────────────────────────────────────
export type {
  HonorariumBatchStatus,
  ExpertiseLevel,
  HonorariumBatchSortBy,
  HonorariumBatchSortDir,
  SessionHonorariumStatusValue,
} from "./honorarium-utils";

// ─── Rate Rules ───────────────────────────────────────────────────────────────
export {
  listInstructorRates,
  upsertInstructorRate,
  removeInstructorRate,
  listHonorariumRateRules,
  upsertHonorariumRateRule,
  removeHonorariumRateRule,
} from "./honorarium-rate-rules";

// ─── Report & Outstanding ─────────────────────────────────────────────────────
export type {
  HonorariumReportRow,
  HonorariumSummaryRow,
  OutstandingHonorariumSession,
  OutstandingHonorariumResult,
} from "./honorarium-report";
export {
  getHonorariumReport,
  getOutstandingHonorariumSessions,
  getSessionHonorariumStatuses,
} from "./honorarium-report";

// ─── Batch CRUD ───────────────────────────────────────────────────────────────
export type {
  HonorariumBatchRow,
  HonorariumBatchPage,
  HonorariumBatchDetail,
  HonorariumBatchPeriodSuggestion,
  HonorariumGeneratePreview,
} from "./honorarium-batch-crud";
export {
  listHonorariumBatches,
  listHonorariumBatchesPage,
  getHonorariumBatchDetail,
  getSuggestedHonorariumBatchPeriod,
  previewHonorariumBatchGeneration,
} from "./honorarium-batch-crud";

// ─── Batch Workflow ───────────────────────────────────────────────────────────
export {
  submitHonorariumBatchToFinance,
  markHonorariumBatchInProcess,
  bulkMarkHonorariumBatchesInProcess,
  markHonorariumBatchPaid,
  correctHonorariumBatchPayment,
  lockHonorariumBatch,
  reopenHonorariumBatch,
  generateHonorariumBatch,
  generateHonorariumBatchFromSelection,
  deleteHonorariumBatch,
} from "./honorarium-batch-workflow";

// ─── Deductions ───────────────────────────────────────────────────────────────
export type { DeductionRow } from "./honorarium-deductions";
export {
  addHonorariumDeduction,
  removeHonorariumDeduction,
  listHonorariumDeductions,
} from "./honorarium-deductions";

// ─── Payment Proofs ───────────────────────────────────────────────────────────
export type { HonorariumPaymentProofRow } from "./honorarium-payment-proofs";
export {
  listHonorariumPaymentProofs,
  uploadHonorariumPaymentProof,
} from "./honorarium-payment-proofs";

// ─── Notifications & Reminders ────────────────────────────────────────────────
export {
  sendHonorariumReminderToFinance,
  sendHonorariumReminderWhatsappDirect,
} from "./honorarium-notifications";

// ─── Export & Finance Recap ───────────────────────────────────────────────────
export type {
  FinanceHonorariumRecapRow,
  FinanceHonorariumRecap,
} from "./honorarium-export";
export {
  getFinanceHonorariumRecap,
  exportFinanceHonorariumRecapExcel,
  exportHonorariumBatchExcel,
  logHonorariumBatchPdfExport,
} from "./honorarium-export";
