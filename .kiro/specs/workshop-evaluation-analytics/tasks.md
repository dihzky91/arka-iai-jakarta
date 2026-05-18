# Implementation Plan: Workshop Evaluation Analytics

## Overview

Implementasi modul Workshop Evaluation Analytics untuk IAI Jakarta, mencakup manajemen kegiatan PPL, narasumber, form builder kuesioner evaluasi, pengumpulan respons peserta, tracking registrasi & kehadiran, analytics per field type, export data, dashboard analytics kehadiran & kategori, analisis pola perencanaan program tahunan, dan analisis performa narasumber. Dibangun menggunakan Next.js App Router, Drizzle ORM (PostgreSQL/Neon), Radix UI, dan Tailwind CSS.

## Tasks

- [x] 1. Set up database schema and core types
  - [x] 1.1 Create Drizzle schema for PPL Evaluasi tables
    - Add PPL Evaluasi schema definitions to `src/server/db/schema.ts`
    - Define enums: `kategoriPplEnum`, `statusPplEnum`
    - Define tables: `pplKegiatan`, `pplNarasumber`, `pplNarasumberExpertise`, `pplKegiatanNarasumber`, `pplKuesionerTemplate`, `pplKuesionerLink`, `pplKuesionerResponse`
    - Add all indexes and unique constraints as specified in design
    - Run `drizzle-kit generate` to create migration files
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 3.1, 4.1, 4.5, 5.1, 5.2_

  - [x] 1.2 Create Zod validation schemas
    - Create file `src/lib/validators/ppl-evaluasi.ts`
    - Implement `createKegiatanSchema` with date refinement validation
    - Implement `narasumberSchema` with phone regex and fee range
    - Implement `scaleConfigSchema`, `gridConfigSchema`, `optionsConfigSchema`
    - Implement `formFieldSchema` and `templateSchema`
    - Implement `submitResponseSchema` and `attendanceSchema`
    - _Requirements: 1.2, 1.7, 2.1, 2.4, 3.2, 3.3, 3.4, 3.5, 4.4, 5.1, 5.2_

  - [x] 1.3 Create TypeScript interfaces and types
    - Create file `src/components/ppl-evaluasi/form-builder/types.ts`
    - Define `FieldType`, `FormField`, `ScaleConfig`, `GridConfig`, `OptionsConfig`, `KuesionerTemplate`
    - Create file `src/server/actions/ppl-evaluasi/types.ts`
    - Define action input/output types: `CreateKegiatanInput`, `ListKegiatanOpts`, `PaginatedResult`, `ActionResult`, etc.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 2. Implement Kegiatan PPL management
  - [x] 2.1 Implement Kegiatan server actions
    - Create file `src/server/actions/ppl-evaluasi/kegiatan.ts`
    - Implement `createKegiatan` with SKP auto-calculation: (tanggalSelesai - tanggalMulai + 1) × 8
    - Implement `updateKegiatan` with archived status check
    - Implement `deleteKegiatan` with soft-delete (archive) when responses/attendance exist
    - Implement `listKegiatan` with pagination and status filtering
    - Implement `getKegiatan` for detail view
    - _Requirements: 1.1, 1.4, 1.6, 1.7, 1.8_

  - [x] 2.2 Write property tests for SKP calculation and date validation
    - **Property 1: SKP Auto-Calculation**
    - **Property 2: Date Validation Rejects Invalid Ranges**
    - **Validates: Requirements 1.4, 1.7**

  - [x] 2.3 Implement Kegiatan list page
    - Create file `src/app/(dashboard)/ppl-evaluasi/page.tsx`
    - Display paginated list of active Kegiatan with kategori, tanggal, SKP, status
    - Add create button, search, and filter by kategori/status
    - _Requirements: 1.1, 1.6_

  - [x] 2.4 Implement Kegiatan detail page
    - Create file `src/app/(dashboard)/ppl-evaluasi/[id]/page.tsx`
    - Display full Kegiatan details with tabs for kuesioner, responses, attendance
    - Show conversion rate and warning badge when realisasiHadir > pendaftar
    - _Requirements: 1.1, 5.3, 5.4, 5.5_

  - [x] 2.5 Write unit tests for Kegiatan server actions
    - Test archived kegiatan prevents updates
    - Test soft-delete when responses exist
    - Test SKP auto-calculation edge cases
    - _Requirements: 1.4, 1.6, 1.7, 1.8_

- [x] 3. Implement Narasumber management
  - [x] 3.1 Implement Narasumber server actions
    - Create file `src/server/actions/ppl-evaluasi/narasumber.ts`
    - Implement `createNarasumber` with email uniqueness check
    - Implement `updateNarasumber` with email uniqueness check
    - Implement `deactivateNarasumber` (soft-delete when referenced)
    - Implement `listNarasumber` with pagination
    - Implement `assignNarasumberToKegiatan` with honorarium auto-calculation (feePerSkp × SKP)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 3.2 Write property test for Honorarium calculation
    - **Property 3: Honorarium Calculation**
    - **Validates: Requirements 2.5**

  - [x] 3.3 Implement Narasumber list page
    - Create file `src/app/(dashboard)/ppl-evaluasi/narasumber/page.tsx`
    - Display paginated list with nama, email, expertise categories, status
    - Add create/edit dialog, deactivate action
    - _Requirements: 2.1, 2.2, 2.7_

  - [x] 3.4 Write unit tests for Narasumber server actions
    - Test duplicate email rejection
    - Test deactivation instead of deletion when referenced
    - Test honorarium calculation
    - _Requirements: 2.5, 2.7, 2.8_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Form Builder and Kuesioner management
  - [x] 5.1 Implement Kuesioner template server actions
    - Create file `src/server/actions/ppl-evaluasi/kuesioner.ts`
    - Implement `createTemplate` with field validation
    - Implement `updateTemplate` with lock check (reject if responses exist)
    - Implement `duplicateTemplate` creating independent copy
    - Implement `linkTemplateToKegiatan` and `activateKuesioner` (generate token + QR)
    - Implement `deactivateKuesioner`
    - _Requirements: 3.1, 3.6, 3.8, 3.9, 4.1, 4.2, 4.7_

  - [x] 5.2 Write property tests for form field configuration validation
    - **Property 4: Form Field Configuration Validation**
    - **Property 5: Template Field Count Constraint**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.10**

  - [x] 5.3 Implement Form Builder UI component
    - Create file `src/app/(dashboard)/ppl-evaluasi/[id]/kuesioner/page.tsx`
    - Create form builder components in `src/components/ppl-evaluasi/form-builder/`
    - Implement drag-and-drop field reordering using @dnd-kit
    - Implement field type configuration panels (scale, grid, options)
    - Show lock indicator when template has responses
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.9_

  - [x] 5.4 Write unit tests for Kuesioner template actions
    - Test template duplication creates independent copy
    - Test template lock when responses exist
    - Test QR code generation from access URL
    - _Requirements: 3.8, 3.9, 4.1, 4.2_

- [x] 6. Implement response collection (public form)
  - [x] 6.1 Implement response submission server actions
    - Create file `src/server/actions/ppl-evaluasi/responses.ts`
    - Implement `getKuesionerByToken` to fetch form config for public rendering
    - Implement `submitResponse` with required field validation, duplicate detection (case-insensitive nama+email), and kuesioner active check
    - Implement `listResponses` with pagination for admin view
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 6.2 Write property tests for response submission
    - **Property 6: Response Answers Round-Trip**
    - **Property 7: Required Field Validation**
    - **Property 8: Case-Insensitive Duplicate Detection**
    - **Validates: Requirements 4.3, 4.4, 4.5, 4.6**

  - [x] 6.3 Implement public form page
    - Create file `src/app/evaluasi/[token]/page.tsx`
    - Render form fields dynamically from Config_JSON
    - Handle all field types: text, textarea, number, email, select, radio, checkbox, scale, grid
    - Show success message on submit, error messages for validation/duplicate/closed
    - _Requirements: 4.1, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [x] 6.4 Implement responses list page (admin)
    - Create file `src/app/(dashboard)/ppl-evaluasi/[id]/responses/page.tsx`
    - Display paginated list of responses with respondent name, email, submitted date
    - _Requirements: 4.3_

- [x] 7. Implement attendance tracking
  - [x] 7.1 Implement attendance server action
    - Create file `src/server/actions/ppl-evaluasi/attendance.ts`
    - Implement `updateAttendance` with archived status check
    - Auto-recalculate conversion rate on update
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7, 5.8_

  - [x] 7.2 Write property test for Conversion Rate calculation
    - **Property 9: Conversion Rate Calculation**
    - **Validates: Requirements 5.3, 5.4**

  - [x] 7.3 Implement attendance page
    - Create file `src/app/(dashboard)/ppl-evaluasi/[id]/attendance/page.tsx`
    - Display and edit pendaftar/realisasiHadir values
    - Show conversion rate with warning badge when realisasiHadir > pendaftar
    - Show "N/A" when pendaftar is 0
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 7.4 Write unit tests for attendance actions
    - Test conversion rate edge cases (0 pendaftar, realisasiHadir > pendaftar)
    - Test archived kegiatan rejection
    - _Requirements: 5.3, 5.4, 5.5, 5.7_

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement analytics engine
  - [x] 9.1 Implement core analytics computation functions
    - Create file `src/server/lib/ppl-analytics.ts`
    - Implement `computeScaleAnalytics` (mean, median, stdDev, distribution)
    - Implement `computeGridAnalytics` (per-row mean and distribution)
    - Implement `computeChoiceAnalytics` (frequency distribution with percentages)
    - Implement `computeConversionRate` and `computePopularityScore`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 8.2, 9.4_

  - [x] 9.2 Write property tests for scale field analytics
    - **Property 10: Scale Field Statistical Analytics**
    - **Validates: Requirements 6.1**

  - [x] 9.3 Write property tests for grid and choice analytics
    - **Property 11: Grid Field Per-Row Analytics**
    - **Property 12: Choice Field Frequency Distribution**
    - **Validates: Requirements 6.2, 6.3, 6.4**

  - [x] 9.4 Write property test for response rate
    - **Property 13: Response Rate Calculation**
    - **Validates: Requirements 6.6, 6.7**

  - [x] 9.5 Implement analytics server actions
    - Create file `src/server/actions/ppl-evaluasi/analytics.ts`
    - Implement `getFieldAnalytics` for per-kegiatan field-level analytics
    - Implement `getAttendanceDashboard` with date range filtering
    - Implement `getPatternAnalysis` for historical pattern detection
    - Implement `getSpeakerPerformance` for narasumber analytics
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 8.1, 8.3, 9.1, 10.1_

- [x] 10. Implement per-field analytics UI
  - [x] 10.1 Implement field analytics display on responses page
    - Enhance `src/app/(dashboard)/ppl-evaluasi/[id]/responses/page.tsx`
    - Display scale analytics: mean, median, stdDev, frequency distribution chart
    - Display grid analytics: per-row mean and distribution table
    - Display choice analytics: bar/pie chart with frequency and percentages
    - Display text responses with pagination (50 per page) and search
    - Show response rate and total respondents
    - Show empty state messages when no data exists
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [x] 11. Implement export functionality
  - [x] 11.1 Implement export server actions
    - Create file `src/server/actions/ppl-evaluasi/export.ts`
    - Create file `src/server/lib/ppl-export.ts`
    - Implement `exportResponsesCsv` with UTF-8 BOM encoding using papaparse
    - Implement `exportResponsesXlsx` with summary sheet using xlsx library
    - Implement grid field column expansion: "{field_label} - {row_label}"
    - Implement `exportProgramTahunan` in PDF (using jspdf) and XLSX formats
    - Handle zero responses case (return error, no file generated)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 9.5_

  - [x] 11.2 Write property tests for export transformations
    - **Property 14: Grid Field Export Column Expansion**
    - **Property 15: Export Row Count Matches Respondent Count**
    - **Validates: Requirements 7.3, 7.4**

  - [x] 11.3 Write unit tests for export
    - Test CSV includes UTF-8 BOM
    - Test XLSX summary sheet contains correct statistics
    - Test zero responses returns error
    - _Requirements: 7.1, 7.5, 7.6_

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement attendance & category dashboard
  - [x] 13.1 Implement attendance dashboard page
    - Create file `src/app/(dashboard)/ppl-evaluasi/analytics/page.tsx`
    - Display heatmap/pivot table: jumlah kegiatan per kategori per bulan
    - Display line chart: tren realisasiHadir per kategori per bulan using recharts
    - Display rata-rata conversion rate per kategori
    - Display ranking kategori by total peserta hadir (descending)
    - Display year-over-year comparison table
    - Implement date range filter (tahun, semester, custom range 1-60 months)
    - Default to current calendar year when no filter applied
    - Show empty state when no data exists
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [x] 13.2 Write property tests for dashboard aggregations
    - **Property 16: Category-Month Aggregation**
    - **Property 17: Date Range Filter Correctness**
    - **Property 18: Category Ranking by Total Attendance**
    - **Property 19: Year-over-Year Percentage Change**
    - **Validates: Requirements 8.1, 8.3, 8.4, 8.6, 8.7**

- [x] 14. Implement pattern analysis for annual planning
  - [x] 14.1 Implement pattern analysis page
    - Create file `src/app/(dashboard)/ppl-evaluasi/analytics/perencanaan/page.tsx`
    - Display top 3 months per kategori with highest average realisasiHadir
    - Display recommended months (above median) with average attendance and conversion rate
    - Display YoY trend labels ("pertumbuhan" / "penurunan")
    - Display popularity score per kategori (0-100 scale)
    - Add export button for program tahunan (PDF/XLSX)
    - Show insufficient data indicator when < 12 months available
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 14.2 Write property tests for pattern analysis
    - **Property 20: Top Months Identification**
    - **Property 21: Recommended Months Above Median**
    - **Property 22: Popularity Score Bounds and Formula**
    - **Validates: Requirements 9.1, 9.2, 9.4**

- [x] 15. Implement narasumber performance analytics
  - [x] 15.1 Implement narasumber performance page
    - Create file `src/app/(dashboard)/ppl-evaluasi/analytics/narasumber/page.tsx`
    - Display ranking narasumber by average evaluation score (descending)
    - Display jumlah kegiatan completed and total SKP per narasumber
    - Display evaluation score trend chart (chronological by tanggal_selesai)
    - Display jumlah responden underlying each score
    - Add kategori filter
    - Show "belum ada data evaluasi" indicator for narasumber without responses
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [x] 15.2 Write property tests for narasumber analytics
    - **Property 23: Narasumber Average Evaluation Score**
    - **Property 24: Narasumber Ranking Sorted Descending**
    - **Property 25: Narasumber Kegiatan Count and SKP Sum**
    - **Property 26: Narasumber Score Trend Chronological Order**
    - **Property 27: Category Filter Correctness**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

- [x] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All analytics computations are server-side for consistency and performance
- The public form endpoint (`/evaluasi/[token]`) requires no authentication
- All admin pages are under the `(dashboard)` layout group with authentication
- Libraries already available: recharts (charts), xlsx (export), papaparse (CSV), qrcode (QR), @dnd-kit (drag-drop), date-fns (dates), jspdf (PDF)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "3.1", "5.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "3.3", "5.2", "5.3", "7.1"] },
    { "id": 3, "tasks": ["2.4", "2.5", "3.4", "5.4", "6.1", "7.2", "7.3"] },
    { "id": 4, "tasks": ["6.2", "6.3", "6.4", "7.4", "9.1"] },
    { "id": 5, "tasks": ["9.2", "9.3", "9.4", "9.5", "11.1"] },
    { "id": 6, "tasks": ["10.1", "11.2", "11.3", "13.1"] },
    { "id": 7, "tasks": ["13.2", "14.1"] },
    { "id": 8, "tasks": ["14.2", "15.1"] },
    { "id": 9, "tasks": ["15.2"] }
  ]
}
```
