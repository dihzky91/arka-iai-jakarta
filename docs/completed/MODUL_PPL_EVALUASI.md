# Modul PPL Evaluasi (Workshop Evaluation Analytics)

## Tujuan

Modul PPL Evaluasi adalah sistem manajemen dan evaluasi kegiatan PPL (Pendidikan Profesional Lanjutan) untuk IAI Jakarta. Modul ini mencakup pengelolaan kegiatan workshop/seminar/PPL, manajemen narasumber dengan fee per SKP, kuesioner evaluasi peserta dengan form builder fleksibel, tracking registrasi & kehadiran, serta dashboard analytics internal untuk perencanaan program tahunan berbasis data.

Modul ini bersifat **internal** (hanya diakses oleh staf IAI Jakarta), kecuali halaman pengisian kuesioner yang bersifat publik.

---

## 1. Route & Page Structure

### Admin Pages (memerlukan autentikasi)

```
src/app/(dashboard)/ppl-evaluasi/
├── page.tsx                              # List kegiatan PPL (CRUD)
├── loading.tsx                           # Loading state
├── [id]/
│   ├── page.tsx                          # Detail kegiatan (tabs)
│   ├── kuesioner/
│   │   └── page.tsx                      # Form builder kuesioner
│   ├── responses/
│   │   └── page.tsx                      # List responses + analytics per field
│   └── attendance/
│       └── page.tsx                      # Input registrasi & kehadiran
├── narasumber/
│   └── page.tsx                          # CRUD narasumber
└── analytics/
    ├── page.tsx                          # Dashboard kehadiran & kategori
    ├── perencanaan/
    │   └── page.tsx                      # Analisis pola & rekomendasi program tahunan
    └── narasumber/
        └── page.tsx                      # Performa narasumber
```

### Public Page (tanpa autentikasi)

```
src/app/evaluasi/
└── [token]/
    └── page.tsx                          # Form pengisian kuesioner peserta
```

---

## 2. Fitur Utama

### 2.1 Manajemen Kegiatan PPL

- CRUD kegiatan workshop/seminar/PPL
- Kategori PPL: Perpajakan, Sistem Informasi & Softskill, Akuntansi Keuangan, Audit, Akuntansi Syariah, Akuntansi Manajemen, dll. (13 kategori)
- Tipe pelaksanaan: online / offline / hybrid
- Auto-kalkulasi SKP: `(tanggalSelesai - tanggalMulai + 1) × 8`
- Status: aktif / archived (soft-delete jika ada data terkait)

### 2.2 Manajemen Narasumber

- CRUD profil narasumber (nama, email, telepon, fee per SKP)
- Expertise per kategori PPL dengan topik-topik
- Assignment narasumber ke kegiatan dengan auto-kalkulasi honorarium: `feePerSkp × SKP`
- Soft-delete (deactivate) jika sudah pernah di-assign

### 2.3 Form Builder Kuesioner

- Buat template kuesioner dengan drag-and-drop field reordering
- Field types: text, textarea, number, email, select, radio, checkbox, scale (Likert), grid (matriks)
- Konfigurasi per field type (scale min/max, grid rows/columns, options)
- Duplikasi template untuk reuse
- Lock template jika sudah ada respons
- Aktivasi kuesioner → generate unique URL + QR code

### 2.4 Pengumpulan Respons

- Halaman publik (`/evaluasi/[token]`) tanpa login
- Validasi required fields
- Deteksi duplikat (case-insensitive nama + email per kegiatan)
- Reject submission jika kuesioner sudah ditutup

### 2.5 Tracking Registrasi & Kehadiran

- Input jumlah pendaftar dan realisasi hadir
- Auto-kalkulasi conversion rate: `(realisasiHadir / pendaftar) × 100`
- Warning badge jika realisasi > pendaftar
- Reject update jika kegiatan sudah diarsipkan

### 2.6 Analytics per Field Type

- Scale: rata-rata, median, standar deviasi, distribusi frekuensi
- Grid: rata-rata per baris, distribusi per kolom
- Radio/Select/Checkbox: frekuensi per opsi (absolut + persentase)
- Text/Textarea: daftar jawaban dengan pagination + search
- Response rate: responden / realisasiHadir × 100

### 2.7 Export Data

- CSV (UTF-8 BOM) dan XLSX per kegiatan
- Grid field expansion: kolom terpisah per baris (`"{label} - {row_label}"`)
- XLSX summary sheet dengan statistik agregat
- Export rekomendasi program tahunan (PDF/XLSX)

### 2.8 Dashboard Analytics Kehadiran & Kategori

- Heatmap/pivot: jumlah kegiatan per kategori per bulan
- Line chart: tren realisasi hadir per kategori
- Rata-rata conversion rate per kategori
- Ranking kategori by total peserta hadir
- Year-over-year comparison
- Filter: tahun, semester, custom range (1-60 bulan)

### 2.9 Analisis Pola Perencanaan Program Tahunan

- Top 3 bulan terbaik per kategori (rata-rata realisasi hadir tertinggi)
- Rekomendasi bulan (di atas median)
- Tren minat YoY ("pertumbuhan" / "penurunan")
- Skor popularitas per kategori (0-100): attendance 40% + conversion 30% + evaluasi 30%
- Indikator "data belum mencukupi" jika < 12 bulan

### 2.10 Analisis Performa Narasumber

- Ranking narasumber by rata-rata skor evaluasi
- Jumlah kegiatan completed + total SKP
- Tren skor evaluasi per kegiatan (kronologis)
- Filter by kategori PPL
- Indikator "belum ada data evaluasi"

---

## 3. Arsitektur & Komponen

### Server Actions

```
src/server/actions/ppl-evaluasi/
├── kegiatan.ts          # CRUD kegiatan, SKP calculation
├── narasumber.ts        # CRUD narasumber, assignment, honorarium
├── kuesioner.ts         # Template CRUD, link, activate/deactivate, QR
├── responses.ts         # Submit response, list responses
├── attendance.ts        # Update pendaftar/realisasiHadir
├── analytics.ts         # Field analytics, dashboard, pattern, speaker
├── export.ts            # CSV, XLSX, PDF export
└── types.ts             # Shared TypeScript types
```

### Analytics Engine

```
src/server/lib/
├── ppl-analytics.ts     # computeScaleAnalytics, computeGridAnalytics, computeChoiceAnalytics, computePopularityScore
└── ppl-export.ts        # CSV/XLSX/PDF generation logic
```

### Shared Libraries

```
src/lib/
├── validators/ppl-evaluasi.ts       # Zod schemas
├── ppl-conversion-rate.ts           # Conversion rate utility
├── ppl-honorarium.ts                # Honorarium calculation
├── ppl-response-rate.ts             # Response rate utility
├── ppl-pattern-analysis.ts          # Pattern analysis (top months, recommendations)
├── ppl-narasumber-analytics.ts      # Speaker performance computation
├── ppl-dashboard-aggregations.ts    # Dashboard aggregation helpers
└── qr/generateQR.ts                 # QR code generation
```

### UI Components

```
src/components/ppl-evaluasi/
├── form-builder/
│   └── types.ts                     # FormField, ScaleConfig, GridConfig, OptionsConfig
├── ResponsesListClient.tsx          # Client component for responses list
└── [other components]
```

---

## 4. Database Schema

### Tabel Baru (prefix `ppl_`)

| Tabel | Deskripsi |
|-------|-----------|
| `ppl_kegiatan` | Data kegiatan PPL (nama, kategori, tanggal, SKP, attendance) |
| `ppl_narasumber` | Profil narasumber (nama, email, fee per SKP) |
| `ppl_narasumber_expertise` | Expertise narasumber per kategori + topik |
| `ppl_kegiatan_narasumber` | Assignment narasumber ke kegiatan + honorarium |
| `ppl_kuesioner_template` | Template kuesioner (config JSON) |
| `ppl_kuesioner_link` | Link kegiatan ↔ template + access token |
| `ppl_kuesioner_response` | Respons peserta (answers JSON) |

### Enums

- `kategori_ppl`: 13 kategori bidang PPL
- `status_ppl`: "aktif", "archived"

### Relasi

```
pplKegiatan ──┬── pplKegiatanNarasumber ──── pplNarasumber
              │                                    │
              │                              pplNarasumberExpertise
              │
              └── pplKuesionerLink ──── pplKuesionerTemplate
                       │
                  pplKuesionerResponse
```

---

## 5. Alur Utama

### Alur Admin: Buat & Kelola Kegiatan

1. Admin buat kegiatan baru → SKP auto-calculated
2. Assign narasumber → honorarium auto-calculated
3. Buat/pilih template kuesioner → link ke kegiatan
4. Aktivasi kuesioner → generate URL + QR code
5. Distribusi QR ke peserta
6. Input data pendaftar & realisasi hadir
7. Lihat analytics per field + export data

### Alur Peserta: Isi Kuesioner

1. Scan QR / buka URL → `/evaluasi/[token]`
2. Isi form evaluasi (tanpa login)
3. Submit → validasi required fields + cek duplikat
4. Tampil pesan sukses / error

### Alur Analytics

1. Dashboard kehadiran & kategori → filter by periode
2. Analisis pola → rekomendasi program tahunan
3. Performa narasumber → ranking & tren skor

---

## 6. Dependensi Library

| Library | Kegunaan |
|---------|----------|
| `recharts` | Chart (line, bar, pie) di dashboard analytics |
| `xlsx` | Export XLSX dengan summary sheet |
| `papaparse` | Export CSV |
| `jspdf` + `jspdf-autotable` | Export PDF program tahunan |
| `qrcode` | Generate QR code dari URL |
| `@dnd-kit` | Drag-and-drop reordering di form builder |
| `date-fns` | Kalkulasi tanggal & SKP |
| `fast-check` | Property-based testing |

---

## 7. Testing

### Property-Based Tests (27 properties)

Menggunakan `fast-check` untuk memvalidasi correctness properties:

- SKP auto-calculation, date validation
- Honorarium calculation
- Form field configuration validation
- Response submission (round-trip, required fields, duplicate detection)
- Conversion rate, response rate
- Scale/grid/choice analytics (mean, median, stddev, distribution)
- Export transformations (column expansion, row count)
- Dashboard aggregations (category-month, date filter, ranking, YoY)
- Pattern analysis (top months, recommended months, popularity score)
- Narasumber analytics (average score, ranking, trend order, category filter)

### Unit Tests

- Kegiatan: archived prevents updates, soft-delete, SKP edge cases
- Narasumber: duplicate email, deactivation, honorarium
- Kuesioner: template duplication, lock, QR generation
- Attendance: conversion rate edge cases, archived rejection
- Export: UTF-8 BOM, summary sheet, zero responses

### Lokasi Test Files

```
src/__tests__/ppl-evaluasi/
├── kegiatan.property.test.ts
├── kegiatan.unit.test.ts
├── narasumber.unit.test.ts
├── narasumber-analytics.property.test.ts
├── kuesioner.property.test.ts
├── responses.property.test.ts
├── response-rate.property.test.ts
├── attendance.unit.test.ts
├── scale-analytics.property.test.ts
├── grid-choice-analytics.property.test.ts
├── export.property.test.ts
├── export.unit.test.ts
└── pattern-analysis.property.test.ts
```

---

## 8. Checklist Implementasi

### Database & Schema

- [x] Drizzle schema untuk tabel PPL (`ppl_kegiatan`, `ppl_narasumber`, dll.)
- [x] Enum `kategori_ppl` dan `status_ppl`
- [x] Indexes dan unique constraints
- [x] Migration files generated

### Server Actions

- [x] Kegiatan CRUD (`src/server/actions/ppl-evaluasi/kegiatan.ts`)
- [x] Narasumber CRUD + assignment (`src/server/actions/ppl-evaluasi/narasumber.ts`)
- [x] Kuesioner template + link + activate/deactivate (`src/server/actions/ppl-evaluasi/kuesioner.ts`)
- [x] Response submission + list (`src/server/actions/ppl-evaluasi/responses.ts`)
- [x] Attendance update (`src/server/actions/ppl-evaluasi/attendance.ts`)
- [x] Analytics (field, dashboard, pattern, speaker) (`src/server/actions/ppl-evaluasi/analytics.ts`)
- [x] Export CSV/XLSX/PDF (`src/server/actions/ppl-evaluasi/export.ts`)

### Halaman UI (Admin)

- [x] List kegiatan PPL (`/ppl-evaluasi`)
- [x] Detail kegiatan (`/ppl-evaluasi/[id]`)
- [x] Form builder kuesioner (`/ppl-evaluasi/[id]/kuesioner`)
- [x] List responses + analytics per field (`/ppl-evaluasi/[id]/responses`)
- [x] Input registrasi & kehadiran (`/ppl-evaluasi/[id]/attendance`)
- [x] CRUD narasumber (`/ppl-evaluasi/narasumber`)
- [x] Dashboard analytics kehadiran & kategori (`/ppl-evaluasi/analytics`)
- [x] Analisis pola perencanaan program tahunan (`/ppl-evaluasi/analytics/perencanaan`)
- [x] Performa narasumber (`/ppl-evaluasi/analytics/narasumber`)

### Halaman UI (Public)

- [x] Form pengisian kuesioner peserta (`/evaluasi/[token]`)

### Analytics Engine

- [x] Scale analytics (mean, median, stddev, distribution)
- [x] Grid analytics (per-row mean, distribution)
- [x] Choice analytics (frequency, percentage)
- [x] Conversion rate & response rate
- [x] Popularity score (weighted formula)
- [x] Pattern analysis (top months, recommendations)
- [x] Narasumber performance (ranking, trend)

### Export

- [x] CSV export (UTF-8 BOM)
- [x] XLSX export dengan summary sheet
- [x] Grid field column expansion
- [x] PDF export program tahunan

### Testing

- [x] Property-based tests (27 properties via fast-check)
- [x] Unit tests (kegiatan, narasumber, kuesioner, attendance, export)

### Integrasi Sistem

- [x] Navigasi sidebar — Tambah menu PPL Evaluasi ke `src/components/layout/navigation.ts`
- [x] RBAC capabilities — Tambah `ppl_evaluasi:view`, `ppl_evaluasi:manage`, `ppl_evaluasi:export` ke `src/lib/rbac/capabilities.ts`
- [x] Default role assignment — Assign capability PPL ke role staff/pejabat/viewer
- [x] Update server actions — Ganti `requireSession()` dengan `requirePermission()` sesuai capability
- [x] Capability labels — Tambah label Indonesia untuk capability baru
- [x] Capability groups — Tambah group "PPL & Evaluasi" di `CAPABILITY_GROUPS`

---

## 9. Catatan Teknis

- Semua analytics computation dilakukan server-side untuk konsistensi
- Config kuesioner disimpan sebagai JSONB untuk fleksibilitas tanpa migrasi schema
- Jawaban peserta disimpan sebagai satu dokumen JSON per respons
- Public form endpoint menggunakan unique token (64 char) tanpa autentikasi
- Conversion rate menampilkan "N/A" jika pendaftar = 0
- Popularity score default 50 jika hanya ada 1 kategori (min = max pada normalisasi)
- YoY comparison menampilkan "N/A" jika tahun sebelumnya = 0 (avoid division by zero)
