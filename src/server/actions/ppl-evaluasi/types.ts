import type { FormField, TipeEvaluasi } from "@/components/ppl-evaluasi/form-builder/types";

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
  expertise?: KategoriPpl[];
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
  expertise: KategoriPpl[];
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
  tipeEvaluasi?: TipeEvaluasi;
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
  tipeEvaluasi: TipeEvaluasi;
  isActive: boolean;
  narasumberAssignments?: Array<{
    narasumberId: number;
    nama: string;
    topik: string | null;
  }>;
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

export interface YoYMonthlyDetail {
  month: number; // 1-12
  currentHadir: number;
  previousHadir: number;
  hadirChangePercent: number | null;
  currentKegiatanCount: number;
  previousKegiatanCount: number;
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
  monthlyDetails: YoYMonthlyDetail[];
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

// ─── Narasumber Scoring ─────────────────────────────────────────────────────

export interface NarasumberFieldScore {
  label: string;
  avg: number;
  median: number;
  distribution: Record<number, number>;
}

export interface NarasumberScore {
  narasumberId: number;
  nama: string;
  topik: string | null;
  avgScore: number;
  fieldScores: NarasumberFieldScore[];
  respondenCount: number;
}

export interface KegiatanEvaluationSummary {
  kegiatanId: number;
  overallScore: number;
  narasumberScores: NarasumberScore[];
  totalResponden: number;
  responseRate: number;
}

// ─── Tema Bank ───────────────────────────────────────────────────────────────

export interface MateriItem {
  judul: string;
  deskripsi: string;
  durasiMenit: number;
  urutan: number;
}

export interface CreateTemaInput {
  namaTema: string;
  kategoriPpl: KategoriPpl;
  latarBelakang?: string;
  susunanMateri?: MateriItem[];
  benefit?: string[];
  targetPeserta?: string;
  durasiHari?: number;
  tipePelaksanaanDefault?: TipePelaksanaan | null;
  rekomendasiNarasumberIds?: number[];
  defaultTemplateIds?: number[];
  tags?: string[];
}

export interface UpdateTemaInput extends Partial<CreateTemaInput> {}

export interface TemaBankRow {
  id: number;
  namaTema: string;
  kategoriPpl: KategoriPpl;
  susunanMateri: MateriItem[];
  benefit: string[];
  tags: string[];
  usageCount: number;
  lastUsedAt: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface TemaBankDetail extends TemaBankRow {
  latarBelakang: string | null;
  targetPeserta: string | null;
  durasiHari: number;
  tipePelaksanaanDefault: TipePelaksanaan | null;
  rekomendasiNarasumberIds: number[];
  defaultTemplateIds: number[];
  sourceKegiatanId: number | null;
  createdBy: string | null;
}

export interface TemaSuggestion {
  id: number;
  namaTema: string;
  kategoriPpl: KategoriPpl;
  matchScore: number;
  usageCount: number;
  lastUsedAt: Date | null;
  preview: {
    benefitCount: number;
    materiCount: number;
    hasNarasumberRekomendasi: boolean;
  };
}
