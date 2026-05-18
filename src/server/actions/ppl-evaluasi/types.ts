import type { FormField } from "@/components/ppl-evaluasi/form-builder/types";

export type KategoriPpl =
  | "Perpajakan"
  | "Sistem Informasi & Softskill"
  | "Akuntansi Keuangan"
  | "Audit"
  | "Akuntansi Syariah"
  | "Akuntansi Manajemen"
  | "Akuntansi Manajemen dan Manajemen Keuangan"
  | "Akuntansi Perpajakan"
  | "Manajemen Keuangan"
  | "Akuntansi Keuangan & Softskill"
  | "Akuntansi Keuangan dan Manajemen Keuangan"
  | "Manajemen Strategik"
  | "SAK & PSAK";

export type TipePelaksanaan = "online" | "offline" | "hybrid";
export type StatusPpl = "aktif" | "archived";

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationOpts {
  page?: number;
  pageSize?: number;
}

// ─── Kegiatan ────────────────────────────────────────────────────────────────

export interface CreateKegiatanInput {
  namaKegiatan: string;
  kategoriPpl: KategoriPpl;
  tipePelaksanaan: TipePelaksanaan;
  tanggalMulai: string;
  tanggalSelesai: string;
  lokasi?: string;
  skp?: number;
}

export interface UpdateKegiatanInput extends Partial<CreateKegiatanInput> {}

export interface ListKegiatanOpts extends PaginationOpts {
  status?: StatusPpl;
  kategori?: KategoriPpl;
  search?: string;
}

export interface KegiatanRow {
  id: number;
  namaKegiatan: string;
  kategoriPpl: KategoriPpl;
  tipePelaksanaan: TipePelaksanaan;
  statusEvent: StatusPpl;
  tanggalMulai: string;
  tanggalSelesai: string;
  lokasi: string | null;
  skp: number;
  pendaftar: number;
  realisasiHadir: number;
}

export interface KegiatanDetail extends KegiatanRow {
  createdBy: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  conversionRate: number | null;
}

// ─── Narasumber ──────────────────────────────────────────────────────────────

export interface CreateNarasumberInput {
  nama: string;
  email: string;
  noTelepon?: string;
  feePerSkp: number;
  isActive?: boolean;
}

export interface UpdateNarasumberInput extends Partial<CreateNarasumberInput> {}

export interface ListNarasumberOpts extends PaginationOpts {
  search?: string;
  isActive?: boolean;
}

export interface NarasumberRow {
  id: number;
  nama: string;
  email: string;
  noTelepon: string | null;
  isActive: boolean;
  feePerSkp: number;
}

export interface AssignNarasumberInput {
  kegiatanId: number;
  narasumberId: number;
  topik?: string;
}

// ─── Kuesioner Template ──────────────────────────────────────────────────────

export interface CreateTemplateInput {
  nama: string;
  fields: FormField[];
}

export interface UpdateTemplateInput extends CreateTemplateInput {}

// ─── Responses ───────────────────────────────────────────────────────────────

export interface SubmitResponseInput {
  namaResponden: string;
  emailResponden: string;
  answers: Record<string, unknown>;
}

export interface ResponseRow {
  id: number;
  namaResponden: string;
  emailResponden: string;
  submittedAt: Date;
}

// ─── Attendance ──────────────────────────────────────────────────────────────

export interface AttendanceInput {
  pendaftar: number;
  realisasiHadir: number;
}

// ─── Public Kuesioner ────────────────────────────────────────────────────────

export interface PublicKuesionerData {
  kegiatanNama: string;
  templateNama: string;
  fields: FormField[];
  isActive: boolean;
}

// ─── Dashboard & Analytics Filters ──────────────────────────────────────────

export interface DashboardFilter {
  startDate?: string;
  endDate?: string;
  year?: number;
}

export interface SpeakerFilter extends DashboardFilter {
  kategori?: KategoriPpl;
}

// ─── Field Analytics ─────────────────────────────────────────────────────────

import type {
  ScaleAnalytics,
  GridAnalytics,
  ChoiceAnalytics,
  TextAnalytics,
} from "@/server/lib/ppl-analytics";

export type FieldAnalyticsResult =
  | (ScaleAnalytics & { type: "scale" })
  | (GridAnalytics & { type: "grid" })
  | (Omit<ChoiceAnalytics, "type"> & { type: "choice"; choiceType: "radio" | "select" | "checkbox" })
  | (TextAnalytics & { type: "text" });

// ─── Attendance Dashboard ────────────────────────────────────────────────────

export interface CategoryMonthData {
  kategori: KategoriPpl;
  month: string; // "YYYY-MM"
  kegiatanCount: number;
  totalHadir: number;
  avgConversionRate: number | null;
}

export interface CategoryRanking {
  kategori: KategoriPpl;
  totalHadir: number;
  kegiatanCount: number;
  avgConversionRate: number | null;
}

export interface YoYComparison {
  kategori: KategoriPpl;
  currentYear: number;
  previousYear: number;
  currentTotalHadir: number;
  previousTotalHadir: number;
  currentKegiatanCount: number;
  previousKegiatanCount: number;
  currentAvgConversion: number | null;
  previousAvgConversion: number | null;
  hadirChangePercent: number | null;
  kegiatanChangePercent: number | null;
  conversionChange: number | null;
}

export interface AttendanceDashboardData {
  categoryMonthData: CategoryMonthData[];
  categoryRanking: CategoryRanking[];
  yoyComparison: YoYComparison[];
  period: { startDate: string; endDate: string };
}

// ─── Pattern Analysis ────────────────────────────────────────────────────────

export interface TopMonth {
  month: number; // 1-12
  avgHadir: number;
  avgConversionRate: number | null;
}

export interface CategoryPattern {
  kategori: KategoriPpl;
  topMonths: TopMonth[];
  recommendedMonths: TopMonth[];
  yoyTrend: { changePercent: number; label: "pertumbuhan" | "penurunan" } | null;
  popularityScore: number;
  hasEnoughData: boolean; // >= 12 months
}

export interface PatternAnalysisData {
  patterns: CategoryPattern[];
  period: { startDate: string; endDate: string };
}

// ─── Speaker Performance ─────────────────────────────────────────────────────

export interface SpeakerScoreTrend {
  kegiatanId: number;
  kegiatanNama: string;
  tanggalSelesai: string;
  avgScore: number;
  respondenCount: number;
}

export interface SpeakerPerformanceRow {
  narasumberId: number;
  nama: string;
  email: string;
  avgScore: number | null;
  kegiatanCount: number;
  totalSkp: number;
  respondenCount: number;
  trend: SpeakerScoreTrend[];
  hasEvaluationData: boolean;
}

export interface SpeakerPerformanceData {
  speakers: SpeakerPerformanceRow[];
  period: { startDate: string; endDate: string };
}
