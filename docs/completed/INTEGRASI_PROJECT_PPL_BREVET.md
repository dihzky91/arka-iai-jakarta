# Integrasi Project ↔ PPL Evaluasi & Brevet

## Status: Completed

---

## 1. Tujuan

Menyatukan modul PPL Evaluasi dan Brevet/Pelatihan dengan modul Project sebagai hub kolaborasi. Project menjadi tempat koordinasi tim (tasks, comments, files, budget) sementara modul spesifik tetap menjadi source of truth untuk data domain masing-masing.

---

## 2. Arsitektur Integrasi

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROJECT (Hub Kolaborasi)                       │
│                                                                   │
│  projects.eventId ──────────→ events (kegiatan sertifikat)       │
│  projects.kelasUjianId ─────→ kelasUjian (brevet/pelatihan)      │
│  projects.pplKegiatanId ────→ pplKegiatan (PPL evaluasi) [BARU]  │
└─────────────────────────────────────────────────────────────────┘
         │                          │                    │
         ▼                          ▼                    ▼
   projectSpeakers            projectTasks          projectTasks
   (narasumber/instruktur)    (auto-generated)      (auto-generated)
```

---

## 3. Scope Perubahan

### 3.1 PPL Evaluasi → Project (Baru)

| Item | Detail |
|------|--------|
| Schema | Tambah `pplKegiatanId` (nullable, unique) di tabel `projects` |
| Auto-create | Saat kegiatan PPL dibuat → otomatis buat project terkait |
| Sync speakers | Narasumber PPL → `projectSpeakers` (auto saat assign/update) |
| Auto tasks | Generate tasks: persiapan, kuesioner, distribusi QR, rekap, honorarium |
| Summary | `getPplSummaryByProject()` — kehadiran, conversion rate, skor evaluasi |
| UI PPL | Section "Project Kolaborasi" di detail kegiatan (link ke project) |
| UI Project | Section/tab "PPL Evaluasi" di project detail (ringkasan data) |

### 3.2 Brevet → Project (Enhancement)

| Item | Detail |
|------|--------|
| Sync instruktur | Instruktur dari `kelasPelatihan` → `projectSpeakers` |
| Auto-sync | Saat kelas pelatihan di-link ke project, sync instruktur |
| UI Project | Section instruktur di project detail (sudah ada speakers, tinggal populate) |

---

## 4. Detail Implementasi

### 4.1 Schema Migration

```sql
-- Tambah kolom di projects
ALTER TABLE projects ADD COLUMN ppl_kegiatan_id INTEGER
  REFERENCES ppl_kegiatan(id) ON DELETE SET NULL;

-- Unique index (1 kegiatan = 1 project)
CREATE UNIQUE INDEX projects_ppl_kegiatan_unique_idx
  ON projects (ppl_kegiatan_id) WHERE ppl_kegiatan_id IS NOT NULL;
```

### 4.2 Auto-Create Project saat Buat Kegiatan PPL

Saat `createKegiatan()` berhasil:
1. Buat project baru dengan:
   - `title`: nama kegiatan
   - `type`: "Workshop" (atau mapping dari kategori PPL)
   - `startDate`: tanggalMulai
   - `endDate`: tanggalSelesai
   - `tipePelaksanaan`: dari kegiatan
   - `lokasi`: dari kegiatan
   - `pplKegiatanId`: id kegiatan baru
   - `createdBy`: user yang buat kegiatan
2. Tambah creator sebagai project member (role: owner)
3. Generate initial tasks

### 4.3 Auto-Generate PPL Tasks

Saat project di-link ke kegiatan PPL, generate tasks:

| Task | Due Date | relatedEntityType |
|------|----------|-------------------|
| Persiapan materi & rundown | tanggalMulai - 7 hari | ppl_persiapan |
| Buat & link kuesioner evaluasi | tanggalMulai - 3 hari | ppl_kuesioner |
| Distribusi QR code ke peserta | tanggalMulai | ppl_distribusi |
| Input data kehadiran | tanggalSelesai | ppl_kehadiran |
| Rekap evaluasi & export | tanggalSelesai + 3 hari | ppl_rekap |
| Proses honorarium narasumber | tanggalSelesai + 7 hari | ppl_honorarium |

### 4.4 Sync Narasumber PPL → Project Speakers

Saat `assignNarasumberToKegiatan()`:
1. Cari project yang linked ke kegiatan tersebut
2. Upsert ke `projectSpeakers`:
   - `nama`: dari pplNarasumber
   - `email`: dari pplNarasumber
   - `topik`: dari assignment
   - `isExternal`: true (narasumber PPL = external)
   - `skp`: dari kegiatan

### 4.5 Sync Instruktur Brevet → Project Speakers

Saat project di-link ke kelasUjian (atau on-demand sync):
1. Fetch instruktur dari `classSessions` yang linked ke `kelasPelatihan`
2. Upsert ke `projectSpeakers`:
   - `nama`: dari instruktur
   - `email`: dari instruktur
   - `topik`: materi yang diajar
   - `isExternal`: true (instruktur = profesional/praktisi eksternal)

### 4.6 PPL Summary di Project

```typescript
getPplSummaryByProject(projectId): {
  kegiatanId: number;
  namaKegiatan: string;
  kategoriPpl: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  skp: number;
  pendaftar: number;
  realisasiHadir: number;
  conversionRate: number | null;
  responseCount: number;
  avgEvaluationScore: number | null;
  narasumberCount: number;
}
```

---

## 5. Checklist Implementasi

### Phase 1: Schema & Core

- [x] Tambah `pplKegiatanId` di schema `projects` (nullable, unique index)
- [x] Generate Drizzle migration
- [x] Jalankan migration di database
- [x] Update `projectSchema` validator untuk accept `pplKegiatanId`
- [x] Update `createProject` untuk handle `pplKegiatanId`
- [x] Tambah unique constraint check (`assertPplKegiatanUnique`)

### Phase 2: PPL → Project Auto-Create

- [x] Update `createKegiatan` — auto-create project setelah kegiatan dibuat
- [x] Auto-add creator sebagai project member (owner)
- [x] Auto-generate PPL tasks
- [x] Handle error gracefully (kegiatan tetap dibuat walau project gagal)

### Phase 3: Speaker Sync

- [x] Update `assignNarasumberToKegiatan` — sync ke projectSpeakers
- [x] Buat `syncNarasumberToProject(kegiatanId)` untuk re-sync
- [x] Buat `syncBrevetInstructors(projectId)` untuk instruktur brevet
- [x] Handle remove: saat narasumber di-unassign, hapus dari projectSpeakers (full re-sync)

### Phase 4: Summary & UI

- [x] Implement `getPplSummaryByProject(projectId)`
- [x] Implement `getProjectByKegiatanId(kegiatanId)`
- [x] UI: Section "Project Kolaborasi" di `/ppl-evaluasi/[id]`
- [x] UI: Section "PPL Evaluasi" di project detail (Overview tab)
- [x] UI: Tombol "Sync Instruktur" di project detail (untuk brevet)

### Phase 5: Update & Delete Handling

- [x] Saat kegiatan PPL di-update (tanggal, nama) → update project title/dates
- [x] Saat kegiatan PPL di-archive → update project status ke "completed"
- [x] Saat project di-delete → set `pplKegiatanId = NULL` (onDelete: set null via FK)

---

## 6. Mapping Tipe Project

| Source | Project Type | Alasan |
|--------|-------------|--------|
| PPL Evaluasi (Perpajakan, Audit, dll.) | "Workshop" | Kegiatan PPL = workshop/seminar |
| Brevet AB/C/BFA | "Pelatihan" | Sudah ada tipe ini |
| Events (sertifikat) | Sesuai event type | Existing behavior |

---

## 7. Edge Cases

| Case | Handling |
|------|----------|
| Kegiatan PPL dihapus (hard delete) | Project tetap ada, `pplKegiatanId` jadi NULL |
| Kegiatan PPL di-archive | Project status → "completed" |
| Project dihapus manual | `pplKegiatanId` di projects hilang, kegiatan PPL tetap ada |
| Narasumber di-deactivate | Tetap di projectSpeakers (historical record) |
| Update tanggal kegiatan | Sync ke project startDate/endDate + update task due dates |
| Brevet instruktur berubah | Manual sync via tombol "Sync Instruktur" |

---

## 8. Out of Scope (Iterasi Ini)

- Sinkronisasi peserta PPL/Brevet ke project members
- Auto-create honorarium batch dari project
- Notifikasi otomatis ke narasumber via project
- Dashboard cross-module (PPL + Brevet + Project dalam 1 view)
