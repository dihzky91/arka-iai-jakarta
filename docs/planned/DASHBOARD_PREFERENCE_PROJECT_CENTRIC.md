# Dashboard Preference & Project-Centric Default View

> **Asal**: Fase 3 dari `docs/BLUEPRINT_ADOPSI_RISERSCRM.md` — dipindahkan dan diperluas di sini.  
> **Referensi**: Rise CRM dashboard layout (project-centric untuk staff/member).  
> **Status**: Planned  
> **Tanggal**: 17 Mei 2026

---

## Latar Belakang

Dashboard ARKA saat ini menampilkan semua widget berdasarkan capability user — Persuratan, Kepegawaian, Sertifikat, Keuangan, Ujian, Analitik. Untuk SuperAdmin/Admin ini masuk akal karena mereka perlu overview semua modul.

Namun untuk **staff biasa** yang sehari-hari bekerja di Projects, tampilan ini terlalu "ramai" dan tidak fokus. Di Rise CRM, dashboard staff langsung menampilkan:

- Clock In/Out status
- My Open Tasks
- Projects Overview (Open/Completed/Hold + progress)
- Events hari ini
- My Timesheet
- Project Timeline
- To-do (Private)
- Sticky Note

Pendekatan ini lebih **actionable** dan **personal** — user langsung tahu apa yang harus dikerjakan hari ini.

---

## Tujuan

1. **Default dashboard yang relevan per tipe user** — bukan one-size-fits-all.
2. **Project-centric view** sebagai default untuk non-admin yang punya akses `projects:view`.
3. **Dashboard preference** agar user bisa customize tampilan sesuai kebutuhan personal.
4. **Preset per role** yang bisa diatur admin sebagai starting point.

---

## Desain Solusi

### A. Logika Default View

```
┌─────────────────────────────────────────────────────────┐
│ User login → cek role & capabilities                     │
├─────────────────────────────────────────────────────────┤
│ SuperAdmin / Admin (isSuperAdmin = true)                 │
│   → Default: Overview semua modul (seperti sekarang)     │
│   → Tabs: Ringkasan, Persuratan, Kepegawaian, dll       │
├─────────────────────────────────────────────────────────┤
│ Staff/Pejabat dengan projects:view                       │
│   → Default: Project-Centric Dashboard                   │
│   → Tabs: Ringkasan (project), + tabs sesuai capability  │
├─────────────────────────────────────────────────────────┤
│ User tanpa projects:view                                 │
│   → Default: Widget sesuai capability tertinggi          │
│   → Fallback: Ringkasan minimal (profil + pengumuman)    │
└─────────────────────────────────────────────────────────┘
```

### B. Project-Centric Ringkasan (Default Staff)

Layout terinspirasi Rise CRM, disesuaikan dengan design language ARKA:

```
┌──────────────────────────────────────────────────────────────┐
│  [⚠️ Terlambat: 1] │ [📋 Task Saya: 3] │ [📅 Event Hari Ini: 1] │ [🔔 Belum Dibaca: 2] │
│                     │                    │                        │                      │
├─────────────────────┴────────────────────┴────────────────────────┴──────────────────────┤
│                                                              │
│  ┌─────────────────────┐  ┌──────────────────────────────┐  │
│  │  Projects Overview   │  │  Semua Task                  │  │
│  │  Open: 2             │  │  To Do: 5                    │  │
│  │  Completed: 1        │  │  In Progress: 3              │  │
│  │  Hold: 0             │  │  Done: 12                    │  │
│  │                      │  │                              │  │
│  │  [Progress Bar 45%]  │  │  [Terlambat: 1 ⚠️]          │  │
│  └─────────────────────┘  └──────────────────────────────┘  │
│                                                              │
│  ┌─────────────────────┐  ┌──────────────────────────────┐  │
│  │  Task Saya           │  │  Event Mendatang             │  │
│  │  ─────────────────── │  │  ───────────────────────     │  │
│  │  □ Siapkan soal...   │  │  📅 Workshop React (20 Mei)  │  │
│  │  □ Review materi...  │  │  📅 Seminar AI (25 Mei)      │  │
│  │  ☑ Upload berkas...  │  │                              │  │
│  └─────────────────────┘  └──────────────────────────────┘  │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Pengumuman Terbaru                                     │ │
│  │  • Jadwal Pengawas Ujian 237 Reguler Ekstra             │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

#### Widget yang Ditampilkan (Project-Centric)

| Widget | Data Source | Keterangan |
|--------|-------------|-----------|
| **Quick Stats Row** | project_tasks, calendar, announcements | Terlambat (overdue), Task Saya, Event Hari Ini, Belum Dibaca |
| **Projects Overview** | projects (member) | Count by status + overall progress |
| **Semua Task** | project_tasks (assigned to me) | Count by status + overdue warning |
| **Task Saya** | project_tasks (assigned to me, limit 5) | List task terbaru, sortable by due date |
| **Event Mendatang** | calendar + projects (startDate) | Event/project dalam 7 hari ke depan |
| **Pengumuman Terbaru** | announcements (unread, limit 3) | Announcement banner |
| **Profil Card** | session | Tetap ada di sidebar kanan (seperti sekarang) |

### C. Dashboard Preference (Customizable)

#### Tabel Database

```sql
CREATE TABLE user_dashboard_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  widget_key VARCHAR(50) NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, widget_key)
);

CREATE TABLE role_dashboard_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  widget_key VARCHAR(50) NOT NULL,
  visible BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(role_id, widget_key)
);
```

#### Widget Registry

```typescript
const DASHBOARD_WIDGETS = [
  // Project-centric widgets
  { key: "quick_stats", label: "Statistik Cepat", category: "project" },
  { key: "projects_overview", label: "Projects Overview", category: "project", requiredCapability: "projects:view" },
  { key: "tasks_overview", label: "Semua Task", category: "project", requiredCapability: "projects:view" },
  { key: "my_tasks", label: "Task Saya", category: "project", requiredCapability: "projects:view" },
  { key: "upcoming_events", label: "Event Mendatang", category: "general", requiredCapability: "calendar:view" },
  { key: "announcements", label: "Pengumuman Terbaru", category: "general", requiredCapability: "announcement:view" },
  
  // Admin/overview widgets (existing)
  { key: "metric_surat_masuk", label: "Surat Masuk", category: "persuratan", requiredCapability: "surat_masuk:view" },
  { key: "metric_kepegawaian", label: "Kepegawaian", category: "kepegawaian", requiredCapability: "absensi:view" },
  { key: "metric_sertifikat", label: "Sertifikat", category: "sertifikat", requiredCapability: "sertifikat:view" },
  { key: "metric_keuangan", label: "Keuangan", category: "keuangan", requiredCapability: "keuangan:view" },
  { key: "antrean_persuratan", label: "Antrean Persuratan", category: "persuratan", requiredCapability: "surat_masuk:view" },
  { key: "profile_card", label: "Profil Saya", category: "general" },
  { key: "quick_actions", label: "Aksi Cepat", category: "general" },
] as const;
```

#### Alur Penentuan Widget

```
1. Cek user_dashboard_preferences → jika ada, pakai ini (user sudah customize)
2. Jika tidak ada, cek role_dashboard_presets → pakai preset role
3. Jika tidak ada preset role, pakai default logic:
   - SuperAdmin → semua widget overview
   - Staff/Pejabat + projects:view → project-centric widgets
   - Lainnya → widget sesuai capability
```

### D. UI "Atur Dashboard"

- Tombol gear/settings di header dashboard: "Atur Tampilan"
- Modal/drawer dengan:
  - Daftar widget (drag to reorder)
  - Toggle show/hide per widget
  - Tombol "Reset ke Default" untuk kembali ke preset role
- Admin punya halaman tambahan di Pengaturan > Dashboard Preset:
  - Per role, atur default widget yang tampil

---

## Fase Implementasi

### Fase A — Project-Centric Default (Prioritas Tinggi)

**Estimasi**: 1 sprint (2 minggu)

Tanpa perlu tabel preference dulu — cukup ubah logika `RingkasanTab` berdasarkan role/capability.

#### Deliverable

1. **Komponen baru**: `ProjectCentricDashboard.tsx`
   - Widget: Projects Overview, Tasks Overview, My Tasks, Upcoming Events
   - Layout: 2-kolom responsive (mirip Rise CRM)

2. **Server action baru**: `getProjectCentricData(userId)`
   - Query: projects where user is member + task stats + upcoming events
   - Return: `{ projectStats, taskStats, myTasks, upcomingEvents }`

3. **Ubah logika `DashboardContent.tsx`**:
   ```tsx
   // Jika bukan superadmin DAN punya projects:view → render ProjectCentricDashboard
   // Else → render existing overview
   ```

4. **Ubah `RingkasanTab`**:
   - SuperAdmin/Admin: tetap seperti sekarang (metric cards + antrean)
   - Staff/Pejabat: project-centric layout

#### Checklist

- [x] `getProjectCentricData` server action
- [x] `ProjectsOverviewWidget` component
- [x] `TasksOverviewWidget` component
- [x] `MyTasksWidget` component (list 5 task terbaru assigned to me)
- [x] `UpcomingEventsWidget` component
- [x] Conditional rendering di `RingkasanTab` berdasarkan role
- [x] Responsive layout (mobile: 1 kolom, desktop: 2 kolom)
- [x] Quick Stats Row (Terlambat, Task Saya, Event Hari Ini, Belum Dibaca)

**Status: ✅ Selesai (17 Mei 2026)**

Catatan implementasi:
- Komponen utama: `ProjectCentricRingkasan.tsx` (bukan `ProjectCentricDashboard.tsx` — nama disesuaikan dengan pola existing)
- Server action `getProjectCentricData` di `statistics.ts` dengan cache 60 detik
- Logika eligibility: `!isSuperAdmin && capabilities.includes("projects:view")`
- Data di-fetch parallel di `page.tsx` bersama `getRoleDashboardData`
- Build, typecheck, dan lint passed tanpa error

### Fase B — Dashboard Preference Storage (Prioritas Sedang)

**Estimasi**: 1 sprint (2 minggu)

#### Deliverable

1. **Migration**: tabel `user_dashboard_preferences` + `role_dashboard_presets`
2. **Server actions**:
   - `getUserDashboardPreferences(userId)`
   - `saveUserDashboardPreferences(userId, widgets[])`
   - `getRoleDashboardPreset(roleId)`
   - `saveRoleDashboardPreset(roleId, widgets[])` (admin only)
3. **Widget registry**: definisi semua widget + capability gate
4. **Resolver**: fungsi yang menentukan widget mana yang tampil berdasarkan preference → preset → default

#### Checklist

- [x] Drizzle schema + migration
- [x] Server actions CRUD preference
- [x] Widget registry constant
- [x] Resolver function `resolveVisibleWidgets(userId, roleId, capabilities)`

**Status: ✅ Selesai (17 Mei 2026)**

Catatan implementasi:
- Migration `0054_dashboard_preferences.sql` — tabel `user_dashboard_preferences`
- Tabel `role_dashboard_presets` di-defer (tidak diimplementasi) — default logic sudah cukup tanpa preset per role
- Server actions di `src/server/actions/dashboard-preferences.ts`: get, save, reset
- Widget registry di `src/lib/dashboard-widgets.ts` dengan `resolveVisibleWidgets()`
- Resolver mendukung: user preference → default by role type (project-centric vs admin)

### Fase C — UI Customize Dashboard (Prioritas Rendah)

**Estimasi**: 1 sprint (2 minggu)

#### Deliverable

1. **"Atur Tampilan" button** di dashboard header
2. **Customize modal/drawer**:
   - Drag-and-drop reorder (pakai `@dnd-kit`)
   - Toggle visibility per widget
   - Preview layout
   - Reset to default
3. **Admin: Pengaturan > Dashboard Preset**:
   - Per role, set default widget layout
   - Berlaku untuk user baru atau user yang belum customize

#### Checklist

- [x] `DashboardCustomizeDrawer` component
- [x] Drag-and-drop widget reorder
- [x] Toggle show/hide
- [x] Save preference ke DB
- [x] Reset to default button
- [ ] Admin preset management page (Pengaturan > Dashboard Preset) — *deferred*

**Status: ✅ Selesai (17 Mei 2026)** — tanpa admin preset page (deferred)

Catatan implementasi:
- Komponen `DashboardCustomizeDrawer.tsx` menggunakan Dialog + @dnd-kit
- Tombol "Atur Tampilan" muncul di sebelah kanan DashboardHeader
- Drag-and-drop reorder + toggle visibility per widget
- Save ke DB via `saveUserDashboardPreferences` server action
- Reset menghapus semua preference, kembali ke default
- Admin preset page di-defer karena default logic sudah cukup untuk saat ini

---

## Dampak ke Komponen Existing

| File | Perubahan |
|------|-----------|
| `src/components/dashboard/DashboardContent.tsx` | Conditional render berdasarkan role |
| `src/components/dashboard/DashboardTabs.tsx` | Tidak berubah (tabs tetap ada untuk navigasi) |
| `src/components/dashboard/DashboardHeader.tsx` | Tambah tombol "Atur Tampilan" |
| `src/server/actions/statistics.ts` | Tambah `getProjectCentricData()` |
| `src/server/db/schema.ts` | Tambah tabel preference + preset |
| `src/app/(dashboard)/dashboard/page.tsx` | Pass data project-centric ke DashboardContent |

---

## Prinsip Desain

1. **Tidak breaking** — Admin/SuperAdmin tetap melihat dashboard seperti sekarang.
2. **Progressive enhancement** — Fase A bisa live tanpa Fase B/C.
3. **Consistent UI** — Widget baru tetap pakai Card, Badge, MetricCard pattern yang sudah ada.
4. **Performance** — Data project-centric di-fetch parallel, bukan sequential.
5. **Mobile-first** — Layout responsive, widget stack vertikal di mobile.

---

## Referensi

- Rise CRM Dashboard: project overview, tasks, events, timesheet, to-do, sticky note
- ARKA existing: `DashboardContent.tsx`, `DashboardTabs.tsx`, `RingkasanTab`
- Blueprint asal: `docs/completed/BLUEPRINT_ADOPSI_RISERSCRM.md` → Fase 3 (Dashboard Preference Per User)
- Project module: `docs/completed/ROADMAP_PROJECT_MODULE.md`

---

## Timeline Ringkas

| Fase | Durasi | Deliverable |
|------|--------|-------------|
| **Fase A** — Project-Centric Default | 2 minggu | Staff lihat project dashboard by default |
| **Fase B** — Preference Storage | 2 minggu | DB + resolver untuk custom layout |
| **Fase C** — UI Customize | 2 minggu | Drag-drop atur widget + admin preset |

**Total**: 6 minggu. Rekomendasi: mulai dari Fase A saja dulu — dampak UX langsung terasa tanpa kompleksitas preference system.
