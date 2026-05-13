# Roadmap Implementasi: Modul Project (ARKA)

> Dokumentasi pelaksanaan enrich & revamp modul Project ARKA  
> **Tujuan**: Menyelaraskan modul project agar memadai untuk kolaborasi pelatihan short-term (workshop, seminar, lokakarya) sekaligus integrasi persiapan brevet (AB, C, BFA).

---

## Prinsip Panduan

- **No client/stakeholder features** — user sudah menyatakan tidak dipakai.
- **RISE CRM = inspirasi, bukan blueprint 1:1** — hanya fitur relevan yang diadopsi.
- **ARKA tech stack**: Next.js 16, TypeScript, Drizzle ORM, PostgreSQL (Neon), shadcn/ui, Tailwind CSS v4.
- **Domain utama**: short-term training collaboration (1–5 hari) + brevet exam preparation.

---

## Arsitektur Data (Schema Changes Summary)

### Tabel Baru

| Tabel | Tujuan |
|-------|--------|
| `project_tasks` | To-do list / task assignment per project |
| `project_milestones` | Fase checkpoint (open reg, close reg, hari-H, dll) |
| `project_notes` | Catatan internal (meeting minutes, agenda) |
| `project_expenses` | Pencatatan pengeluaran aktual pelatihan |
| `project_timesheets` | Timer & jam kerja panitia |
| `project_speakers` | Narasumber internal/eksternal per project |
| `project_budget_items` | Rencana anggaran (sebelum pelaksanaan) — diband. actuals di expenses |

### Kolom Baru di `projects`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| `price_member` | `numeric(15,2)` | Harga anggota IAI (`price` existing → deprecated) |
| `price_non_member` | `numeric(15,2)` | Harga non-anggota |
| `tipe_pelaksanaan` | `varchar(20)` | `online` / `offline` / `hybrid` |
| `waktu_mulai` | `time` | Jam mulai event |
| `waktu_selesai` | `time` | Jam selesai event |
| `lokasi` | `varchar(255)` | Venue / ruang / link Zoom |
| `progress` | `integer` | 0–100, auto-dihitung |
| `kelas_ujian_id` | `text` → `kelas_ujian.id` | Link ke modul brevet (opsional) |
| `max_peserta` | `integer` | Kapasitas maksimum peserta (null = tidak terbatas) |
| `is_waitlist_enabled` | `boolean` | Aktifkan waiting list kalau penuh |
| `template_source_id` | `uuid` → `projects.id` | Sumber project kalau di-clone dari template |

### `projectTypeEnum` Update

Tambah nilai baru: `"Brevet AB"`, `"Brevet C"`, `"BFA"` — saat ini hanya Workshop/Seminar/Lokakarya/Pelatihan/Lainnya.

---

## Fase Implementasi

---

### 🔴 Fase 1 — Core Kolaborasi (Task + Milestone)

**Estimasi**: 2 sprint (4 minggu)  
**Goal**: Project berfungsi sebagai "project management" nyata, bukan sekadar chat room.

#### 1.1 Database Schema

- [x] Migration: tabel `project_tasks`
  - `id`, `project_id`, `title`, `description`, `assignee_id`, `status`, `due_date`, `milestone_id`, `related_entity_type`, `related_entity_id`, `created_by`, `created_at`, `updated_at`
- [x] Migration: tabel `project_milestones`
  - `id`, `project_id`, `title`, `target_date`, `is_completed`, `created_at`
- [x] Migration: kolom `progress` di `projects` (integer default 0)
- [x] Update `projectFiles` FK cascade check (sudah ada, verifikasi)
- [x] Update TypeScript type exports (`src/server/db/schema.ts` lines 1301–1374)
- [x] Drizzle schema declaration + relations

#### 1.2 Server Actions (`src/server/actions/projects.ts`)

- [x] `createProjectTask(projectId, data)` — CRUD task
- [x] `updateProjectTask(id, data)` — edit title, assignee, due date, status
- [x] `deleteProjectTask(id)` — soft delete atau hard delete (pilih hard, cascade)
- [x] `listProjectTasks(projectId)` — list dengan join ke users (assignee)
- [x] `createProjectMilestone(projectId, data)` — CRUD milestone
- [x] `updateProjectMilestone(id, data)` — edit title, target_date, toggle complete
- [x] `deleteProjectMilestone(id)`
- [x] `listProjectMilestones(projectId)`
- [x] `recalculateProjectProgress(projectId)` — auto `progress = completed_tasks / total_tasks * 100` (atau milestone-based)
- [x] Activity log hooks: log saat task created, updated, completed, deleted

#### 1.3 Validators (Zod)

- [x] `projectTaskCreateSchema` — title required, assignee optional, due_date optional
- [x] `projectTaskUpdateSchema` — extends create + id
- [x] `projectMilestoneCreateSchema` — title required, target_date optional
- [x] `projectMilestoneUpdateSchema` — extends create + id

#### 1.4 UI Components

- [x] Tab baru **"Tasks"** di `ProjectDetail.tsx`
- [x] `TaskSection` component — list view dengan:
  - Checkbox toggle status
  - Assignee badge
  - Due date badge (merah kalau overdue)
  - Tombol add/edit/delete (permission-gated)
- [x] `MilestoneSection` — inline di atas Tasks atau tab terpisah tergantung UX decision
- [x] `AddTaskDialog` / `EditTaskDialog` — shadcn Dialog + Form
- [x] `AddMilestoneDialog` / `EditMilestoneDialog`
- [x] Progress bar di card header project (sebelah status badge)

#### 1.5 RBAC & Permission

- [x] Capability: `projects:manage_tasks` — owner/manager bisa CRUD semua task
- [x] Capability: `projects:assign_tasks` — assign ke anggota lain
- [x] Member biasa hanya bisa update task milik sendiri
- [x] Viewer: read-only

#### 1.6 Notifikasi

- [ ] Notifikasi ke assignee saat task di-assign — *belum diimplementasi*
- [ ] Notifikasi ke creator saat task selesai — *belum diimplementasi*
- [ ] Notifikasi X hari sebelum due date (opsional, gunakan cron/edge function) — *belum diimplementasi*

---

### 🔴 Fase 2 — Revamp UI/UX Comments & Overview

**Estimasi**: 1.5 sprint (3 minggu)  
**Goal**: UX langsung terasa lebih modern, kaya, dan produktif. Hilang kesan "biasa banget".

#### 2.1 Comments Revamp

- [x] **Enlarge editor**: `min-h-[140px]` textarea dengan card border yang jelas
- [x] **@mention popover**: ketik `@` → dropdown member (filter saat type, pilih dengan keyboard)
  - Hook: `useMentionPopover(textareaRef, members)`
  - Parser sudah ada (`splitMentions`), tinggal UI-nya
- [x] **Inline file attachment di comment**: tombol 📎 attach file → upload inline → render file preview di bawah comment
- [x] **Toolbar sederhana**: Bold, Italic, Bullet list (TipTap-lite atau markdown)
- [x] **Rich comment card**: shadow, padding 20px, border lebih soft (`border-border/60`)
- [x] **Human-readable timestamp**: pakai `formatDistanceToNow` (date-fns) → "2 jam lalu", "kemarin"
- [x] **Avatar stack di mention**: tampilkan avatar kecil di sebelah nama mention
- [x] **Comment count badge** di tab trigger: `Comments (12)`

#### 2.2 Overview Dashboard Revamp

- [x] Layout 3-kolom (responsive: 1 kolom di mobile):
  - **Kiri (lebar)**: Progress ring/chart + Tasks summary mini (todo/in_progress/done count) + Recent 5 activity
  - **Tengah**: Deskripsi (rich text rendered) + Notes preview (3 latest)
  - **Kanan**: Metadata detail card + Members avatar row + File count quick link
- [x] **Circular progress ring**: shadcn `Progress` diperkaya dengan SVG ring (terinspirasi RISE CRM)
- [x] **Task summary widget**: 3 badge — `To do: 4`, `In progress: 3`, `Done: 8`
- [x] **Recent activity widget**: 5 log terakhir dengan icon per action type
- [x] **Members avatar row**: tumpuk avatar (max 5, +N) dengan tooltip nama

#### 2.3 Tabs Revamp

- [x] Tab trigger dengan icon + badge count:
  - `Overview`, `Tasks (8)`, `Comments (12)`, `Files (5)`, `Members (4)`, `Activity`
- [x] Active state: background lebih tegas, border bottom accent
- [x] Scrollable horizontal di mobile

#### 2.4 Files Section Polish

- [x] **Drag & drop zone**: visual feedback saat drag (border accent, background tint)
- [x] **File type icon**: PDF, Excel, Word, Image, ZIP — pakai Lucide icon
- [x] **Inline image preview**: thumbnail kecil, klik → lightbox
- [x] **File size + uploader + timestamp** dalam 1 baris compact

---

### 🟡 Fase 3 — Integrasi Modul Brevet

**Estimasi**: 1.5 sprint (3 minggu)  
**Goal**: Project bisa menjadi "command center" persiapan ujian brevet.

#### 3.1 Schema & Linking

- [x] Migration: `kelas_ujian_id` di `projects` (nullable FK ke `kelas_ujian`)
- [x] Update `project.type` enum: tambah `"brevet_ab"`, `"brevet_c"`, `"bfa"` (atau gunakan `type` existing + `kelasUjianId`)
- [x] Validasi: hanya 1 project boleh link ke 1 kelas (unique constraint + server-side check)

#### 3.2 Server Actions

- [x] `getBrevetSummaryByProject(projectId)` — query join ke `kelasUjian`, `jadwalUjian`, `penugasanPengawas`
- [x] `autoGenerateBrevetTasks(projectId)` — generate task list berdasarkan:
  - Jadwal ujian yang ada → task "Assign pengawas UH-{n}"
  - Materi ujian → task "Siapkan soal {materi}"
  - Lokasi/mode → task "Booking ruang / setup link Zoom"
  - Kelulusan → task "Input nilai & cetak sertifikat"
- [x] `syncBrevetTasks(projectId)` — regenerate kalau jadwal ujian berubah

#### 3.3 UI Components

- [x] **Brevet Info Card** di Overview (kanan atas, hanya muncul kalau `kelasUjianId` ada):
  - Nama Kelas, Program, Tipe, Mode, Lokasi
  - Jumlah ujian terjadwal
  - Link "Buka Modul Brevet →"
- [x] **Jadwal Ujian Summary** — tabel mini 3 kolom: Tanggal, Materi, Pengawas (✅/❌)
- [x] **Quick Actions** di Brevet Card:
  - "+ Assign Pengawas"
  - "+ Tambah Jadwal Ujian"
  - redirect ke modul brevet dengan pre-filled `kelasId`

#### 3.4 Task Auto-Generate Rules

| Trigger | Task yang Digenerate | Assignee Default |
|---------|----------------------|------------------|
| Project created with `kelasUjianId` | "Assign pengawas untuk semua ujian" | Owner |
| Ujian baru dijadwalkan | "Siapkan soal {materi} — {tanggal}" | Owner |
| Pengawas assigned | "Kirim briefing pengawas {nama}" | Manager |
| 3 hari sebelum ujian | "Cetak & siapkan berkas ujian" | Member (rotasi) |
| Ujian selesai | "Input nilai & review" | Owner |

---

### 🟡 Fase 4 — Data Lengkap Pelatihan & Notes

**Estimasi**: 1 sprint (2 minggu)  
**Goal**: Metadata project lengkap untuk laporan dan dokumentasi.

#### 4.1 Schema Migration

- [x] `price_member`, `price_non_member` numeric(15,2) — kolom `price` existing tetap, migrasi data lalu deprecated
- [x] `tipe_pelaksanaan` enum/varchar: `online`, `offline`, `hybrid`
- [x] `waktu_mulai`, `waktu_selesai` varchar(5)
- [x] `lokasi` varchar(255)
- [x] `max_peserta` integer nullable (null = unlimited)
- [x] `is_waitlist_enabled` boolean default false
- [x] Update `projectTypeEnum` — sudah align dari Fase 3

#### 4.2 Server Actions

- [x] Update `createProject` dan `updateProject` untuk menerima field baru
- [x] Update `projectListResult` / `projectDetailRow` types
- [x] `getProjectParticipantCounts(projectId)` — aggregate dari `participants` via `eventId`
- [x] `getProjectNarasumberList(projectId)` — diimplementasi sebagai `listProjectSpeakers(projectId)`
- [x] `getProjectCapacityStatus(projectId)` — `{ registered, max, waitlist_count, is_full }`

#### 4.3 UI Components

- [x] Update **Create/Edit Project Modal** (`ProjectManager.tsx`):
  - Field: Harga Anggota, Harga Non-Anggota
  - Field: Tipe Pelaksanaan (Select)
  - Field: Waktu Mulai, Waktu Selesai
  - Field: Lokasi
  - Field: Kapasitas Maks (number input, kosong = tidak terbatas)
  - Toggle: Aktifkan Waiting List
- [x] Update **Overview Detail Card**:
  - Harga (anggota vs non-anggota)
  - Tipe pelaksanaan + waktu
  - Lokasi
  - Kapasitas
  - Status waiting list

#### 4.4 Notes Tab

- [x] Migration: `project_notes` table
- [x] Server actions: CRUD notes
- [x] Tab **"Notes"** baru di `ProjectDetail.tsx`
- [x] `NoteSection` component:
  - List card (title + snippet + timestamp)
  - Create/Edit dialog dengan textarea
  - No threading, no mention — pure internal notes
- [x] Activity log: log `note_created`, `note_updated`, `note_deleted`

---

### 🟢 Fase 5 — Narasumber, Budget, Expenses, Timesheets

**Estimasi**: 2 sprint (4 minggu)  
**Goal**: Lengkapkan administrative + financial tracking untuk pelatihan.

#### 5.1 Narasumber Management

- [x] Migration: `project_speakers` table
  - `id`, `project_id`, `user_id` (nullable, internal), `nama`, `email`, `topik`, `durasi_menit`, `skp`, `is_external`
- [x] Server actions: CRUD speaker
- [x] UI: Section di Overview kanan atau tab terpisah
- [x] Quick add: search user internal → auto-fill, atau input manual untuk eksternal

#### 5.2 Budget Planning (Pra-Pelaksanaan)

> Distinct dari Expenses (aktual). Budget = rencana sebelum event.

- [x] Migration: `project_budget_items` table
  - `id`, `project_id`, `kategori`, `deskripsi`, `jumlah_rencana numeric(15,2)`, `created_by`, `created_at`
- [x] Server actions: CRUD budget items + total budget via `getProjectFinancialSummary(projectId)`
- [x] Section di tab Expenses atau sub-tab tersendiri:
  - Input: kategori, deskripsi, jumlah rencana
  - Summary: total anggaran
- [x] **Budget vs Actuals view**: tabel paralel rencana vs realisasi (join budget_items + expenses per kategori)
  - Delta badge: surplus (hijau) / defisit (merah)

#### 5.3 Expenses Tracking (Aktual)

- [x] Migration: `project_expenses` table
  - `id`, `project_id`, `kategori`, `jumlah numeric(15,2)`, `tanggal`, `keterangan`, `bukti_url`, `uploaded_by`, `created_at`
- [x] Server actions: CRUD expenses + total summary
- [x] Tab **"Expenses"** dengan:
  - Form: kategori (select/ketik), jumlah, tanggal, keterangan, upload bukti
  - Summary card: total pengeluaran vs total anggaran
  - Table list dengan kategori badge

#### 5.4 Timesheets / Timer

- [x] Migration: `project_timesheets` table
  - `id`, `project_id`, `user_id`, `start_time`, `end_time`, `duration_minutes`, `description`
- [x] Server actions: start timer, stop timer, list, edit, delete
- [x] Tab **"Timesheets"** dengan:
  - Tombol "Start / Stop Timer" (mirip RISE CRM `project_timer.php`)
  - Summary: total jam kerja per user + project
  - Table: tanggal, durasi, deskripsi

---

### 🟢 Fase 6 — Polish & Advanced Features

**Estimasi**: 2 sprint (4 minggu)  
**Goal**: Fitur nice-to-have yang meningkatkan profesionalisme.

- [x] **Kanban Board** untuk Tasks (alternatif view selain list)
  - Library: `@dnd-kit/core` + `@dnd-kit/sortable`
  - Kolom: `To Do`, `In Progress`, `Done`
  - Drag to change status
- [ ] **Gantt Chart** (defer — overkill untuk short-term, tapi bisa dibuat sederhana)
  - Hanya kalau ada demand nyata
- [x] **Project Duplication / Clone**
  - Tombol "Duplikat Project" → copy metadata + milestones + task structure (bukan members/comments/files)
  - Set `template_source_id` ke project asal
  - Useful untuk pelatihan berulang (monthly workshop, brevet sesi baru)
- [x] **Project Templates**
  - Template: "Workshop 2 Hari", "Seminar 1 Hari", "Brevet AB"
  - Auto-generate tasks, milestones, dan checklist standar
  - Bisa dihasilkan dari Duplikat Project yang di-mark sebagai template
- [x] **Project Labels Enhancement**
  - Color picker yang lebih kaya
  - Label groups: `Program`, `Priority`, `Tahun`
- [x] **Export Project Summary**
  - PDF: ringkasan project, tasks, milestones, members via jsPDF + autoTable
- [ ] **Email Digest**
  - Weekly summary ke anggota project (pending tasks, upcoming milestones)
- [x] **Mobile Responsive Polish**
  - Tabs scrollable
  - Kanban board horizontal scroll di mobile
  - Project table scrollable di mobile

---

### 🔵 Fase 7 — Integrasi Modul Internal ARKA

**Estimasi**: 2 sprint (4 minggu)  
**Goal**: Sambungkan project ke modul yang sudah ada — honorarium, invoice, sertifikat, calendar, announcement — agar project jadi "command center" nyata.

> Semua modul ini sudah ada di codebase. Fase ini = surface data yang sudah ada ke dalam project UI.

#### 7.1 Honorarium Integration Card

Project sudah punya `eventId` FK ke tabel `events`. Honorarium batch dibuat dari `eventId` yang sama.

- [x] `getHonorariumSummaryByProject(projectId)` — query join `events` → `honorariumBatches`
  - Return: batch status, total narasumber, total dibayar, total pending
- [x] **Honorarium Card** di Overview (muncul kalau ada data batch terkait):
  - Status batch: Draft / Diajukan / Diproses / Dibayar
  - Jumlah narasumber + total honorarium
  - Link "Buka Honorarium →" ke `/keuangan/honorarium`
- [ ] Activity log saat honorarium batch status berubah (via webhook atau polling event) — *deferred: requires cross-module webhook*

#### 7.2 Invoice & Kuitansi Link

Modul `invoice.ts` dan `kuitansi.ts` sudah ada. Sambungkan ke project.

- [x] `getInvoicesByProject(projectId)` — menampilkan invoice/kuitansi terbaru
- [x] Badge di overview: `Invoice (N)`, `Kuitansi (N)`
- [x] Quick view list: nomor, nominal, status lunas/belum
- [x] Link ke halaman invoice/kuitansi

#### 7.3 Certificate Auto-Trigger

Modul sertifikat sudah ada (`EventManager`, `GenerateBatchForm`).

- [x] Tombol **"Buka Modul Sertifikat"** muncul di Overview saat:
  - Project `eventId` ada
  - Peserta terdaftar
- [x] Action: link ke `/sertifikat/kegiatan/{eventId}`
- [x] Badge di Overview: "Sertifikat: X diterbitkan"
- [ ] Activity log: `certificate_batch_generated` — *deferred: requires hook di certificate module*

#### 7.4 Calendar Integration

Modul `calendar.ts` + `CalendarDashboard.tsx` sudah ada.

- [x] Project `startDate`/`endDate` otomatis muncul di CalendarDashboard sebagai event (warna indigo)
- [x] Milestone `target_date` juga muncul sebagai marker di kalender
- [x] Server action: `getProjectCalendarEntries(month, year)` — return project dates dalam format calendar entry
- [x] Filter di CalendarDashboard: toggle "Tampilkan Project"

#### 7.5 Announcement Auto-Blast

Modul `announcements.ts` sudah ada.

- [x] **Quick Action** di Overview project:
  - "Umumkan Buka Pendaftaran" → pre-fill announcement dengan judul, tanggal, lokasi, harga
  - "Umumkan Pelatihan Selesai" → auto-post ringkasan hasil
- [x] `createAnnouncementFromProject(projectId, type)` action — generate body dari project data
- [x] Setelah post: activity log + notifikasi ke semua user via announcement inbox

---

## Acceptance Criteria Global

Setiap fase harus memenuhi:

- [ ] Semua server actions punya unit test minimal (happy path + error path)
- [x] Drizzle schema di-sync dengan database via migration — **migration 0052 ditambahkan**
- [x] TypeScript types zero-error (`tsc --noEmit`) — **verified**
- [x] UI responsive: mobile, tablet, desktop — **mengikuti existing grid system**
- [x] Activity log mencakup semua mutasi data — **announcement_created + project_integration actions**
- [x] RBAC permission check di setiap server action — **requireProjectMember/session applied**
- [x] Tidak ada fitur client/stakeholder
- [ ] Dokumentasi fitur di-update di `RENCANA_MODUL_PROJECT.md`

---

## Timeline Ringkas

| Fase | Durasi | Deliverable Utama |
|------|--------|-------------------|
| **Fase 1** — Core Kolaborasi | 4 minggu | Tasks, Milestones, Progress |
| **Fase 2** — Revamp UI/UX | 3 minggu | Comments kaya, Overview dashboard |
| **Fase 3** — Integrasi Brevet | 3 minggu | Link ke kelas ujian, auto-generate tasks |
| **Fase 4** — Data Lengkap + Notes | 2 minggu | Harga tier, kapasitas, tipe pelaksanaan, notes tab |
| **Fase 5** — Budget, Expenses, Timesheets | 4 minggu | Budget vs actuals, tracking administratif |
| **Fase 6** — Polish & Advanced | 4 minggu | Kanban, duplikat/template, export, mobile polish |
| **Fase 7** — Integrasi Modul Internal | 4 minggu | Honorarium card, invoice link, sertifikat trigger, calendar, announcement |

**Total estimasi**: 24 minggu (6 bulan) dengan 1 developer full-time.  
**Rekomendasi prioritas**: Fase 1 → 2 → 4 → 7 (honorarium + sertifikat high-value) → 3 → 5 → 6.  
Fase 7 bisa dikerjakan paralel dengan Fase 3/5 karena tidak ada dependency schema baru.

---

## Catatan Teknis

### Stack & Library Rekomendasi

| Fitur | Library/Approach |
|-------|------------------|
| Mention Popover | Custom hook + `useFloating` (@floating-ui) atau Radix Popover |
| Rich Comment Editor | TipTap (sudah ada di stack ARKA untuk `HtmlEditor`) |
| Progress Ring | SVG custom atau `shadcn` Progress diperkaya |
| Drag & Drop Kanban | `@dnd-kit/core` + `@dnd-kit/sortable` |
| Date Formatting | `date-fns` (sudah ada di `lib/utils.ts`) |
| Timer / Stopwatch | `useInterval` hook custom, state di localStorage (anti-refresh loss) |
| Budget vs Actuals | Computed di server action, render dengan table + badge delta |
| Calendar entries | Extend `calendar.ts` `getCalendarEntries` untuk include project dates |

### Files yang Akan Dimodifikasi

- `src/server/db/schema.ts` — semua migration schema
- `src/server/actions/projects.ts` — barrel re-export (lihat Refactor Log di bawah)
- `src/server/actions/calendar.ts` — extend untuk project calendar entries (Fase 7.4)
- `src/server/actions/announcements.ts` — tambah `createAnnouncementFromProject` (Fase 7.5)
- `src/components/projects/ProjectDetail.tsx` — tab layout + overview
- `src/components/projects/ProjectManager.tsx` — list + create/edit modal
- `src/components/calendar/CalendarDashboard.tsx` — filter + render project entries (Fase 7.4)
- `src/lib/project-constants.ts` — tambah enum/status
- `src/lib/validators/` — schema Zod baru
- `src/components/projects/` — komponen baru (TaskSection, MilestoneSection, NoteSection, BudgetSection, HonorariumCard, dll)

---

## Refactor Log

### [2026-05-13] Pemecahan `projects.ts` → Domain Files

**Latar belakang**: Setelah Fase 5 selesai diimplementasi, `src/server/actions/projects.ts` tumbuh menjadi **3079 baris** — sulit dibaca, sulit di-navigate, dan terlalu besar untuk satu file.

**Keputusan**: Pecah menjadi domain files terpisah dengan barrel re-export agar semua consumer import (`@/server/actions/projects`) tetap tidak perlu diubah.

**Struktur baru**:

| File | Isi |
|------|-----|
| `src/server/actions/projects.ts` | Barrel re-export — tidak ada logic, hanya `export * from` |
| `src/server/actions/_project-shared.ts` | Helper internal: schemas (Zod), RBAC guards, utility functions, shared types. Prefix `_` = tidak diimpor langsung dari luar. Tanpa `"use server"`. |
| `src/server/actions/project-core.ts` | CRUD project, members, labels, event options |
| `src/server/actions/project-content.ts` | Komentar, file, activity log, notes |
| `src/server/actions/project-tasks.ts` | Tasks, milestones, progress, brevet tasks |
| `src/server/actions/project-resources.ts` | Narasumber, budget, expenses, timesheets |

**Pola `"use server"`**: Setiap domain file punya `"use server"` sendiri. Barrel (`projects.ts`) tidak punya — Next.js resolve batas server action melalui barrel ke file domain.

**Impact ke consumer**: **Nol** — semua import yang ada di `ProjectDetail.tsx`, `ProjectPhase5Section.tsx`, `page.tsx`, dll tetap `from "@/server/actions/projects"` tanpa perubahan.

**Catatan tambahan**: File `project-phase5.ts` (dibuat oleh agent saat implementasi Fase 5) juga dihapus dan kontennya digabung ke dalam struktur domain di atas.

---

*Dokumen ini akan di-update seiring progress implementasi. Tandai checkbox saat task selesai.*
