# Revamp Ekosistem PPL

## Status: Completed

## Ringkasan

Dokumen ini mencakup 4 inisiatif yang saling terkait untuk memperkuat ekosistem PPL (Pendidikan Profesional Lanjutan):

1. **Phase 1**: Enrichment Evaluasi — Dynamic narasumber section, multi-tipe evaluasi, scoring engine
2. **Phase 2**: Bank Tema PPL — Template library kegiatan dengan auto-suggest dan pre-fill
3. **Phase 3**: Penguatan Link Kegiatan ↔ Project — Embedded project, sync 2 arah
4. **Phase 4**: Unified People Directory — Merge view narasumber + instruktur brevet

---

## Arsitektur Target

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BANK TEMA PPL                                  │
│  (template library, rekomendasi, pre-fill, bundle evaluasi)          │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ suggest / pre-fill
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     KEGIATAN PPL (source of truth)                    │
│  (data akademik, SKP, kehadiran, narasumber assignment)              │
└────────────┬─────────────────────────────────┬──────────────────────┘
             │                                 │
             ▼                                 ▼
┌────────────────────────────┐   ┌────────────────────────────────────┐
│   EVALUASI (Enhanced)       │   │   PROJECT (operational hub)         │
│   Multi-section form        │   │   Tasks, budget, timeline,          │
│   Dynamic narasumber block  │   │   speakers, files                   │
│   Scoring + benchmark       │   │   ← embedded di detail kegiatan    │
└────────────────────────────┘   └────────────────────────────────────┘
                                              │
                                              ▼
                               ┌────────────────────────────────────┐
                               │   UNIFIED PEOPLE DIRECTORY          │
                               │   Narasumber PPL + Instruktur Brevet│
                               │   Cross-assign, riwayat penugasan   │
                               └────────────────────────────────────┘
```

---

## Phase 1: Enrichment Evaluasi

### 1.1 Masalah Saat Ini

| Masalah | Dampak |
|---------|--------|
| Halaman `/ppl-evaluasi/kuesioner` hanya read-only list | User bingung, harus masuk ke detail kegiatan untuk create/edit |
| 1 kegiatan = 1 kuesioner link | Tidak bisa evaluasi pre & post, atau multi-section |
| Tidak ada evaluasi per-narasumber | Analytics narasumber tidak akurat (skor dari keseluruhan, bukan spesifik) |
| Template terkunci setelah ada respons | Tidak bisa iterasi/improve template |
| Semua template diperlakukan sama | Tidak ada kategorisasi tipe evaluasi |

### 1.2 Solusi: Dynamic Narasumber Section

Konsep utama: **1 form, 1 link, 1 kali submit** — tapi di dalam form ada section yang otomatis di-repeat per-narasumber.

#### Tampilan Form Peserta

```
┌─────────────────────────────────────────────────────────────┐
│ EVALUASI KEGIATAN PPL                                        │
│ "Workshop Transfer Pricing 2026"                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ ▸ BAGIAN 1: Evaluasi Umum (dari template)                    │
│   - Kualitas materi secara keseluruhan [1-5]                 │
│   - Relevansi topik dengan kebutuhan [1-5]                   │
│   - Kualitas logistik/teknis [1-5]                          │
│                                                               │
│ ▸ BAGIAN 2: Evaluasi Narasumber (auto-generated)             │
│                                                               │
│   ┌─ Dr. Ahmad (Topik: Regulasi TP) ────────────────────┐   │
│   │  Penguasaan materi [1-5]                              │   │
│   │  Cara penyampaian [1-5]                               │   │
│   │  Interaksi dengan peserta [1-5]                       │   │
│   └───────────────────────────────────────────────────────┘   │
│                                                               │
│   ┌─ Ibu Sari (Topik: Dokumentasi TP) ──────────────────┐   │
│   │  Penguasaan materi [1-5]                              │   │
│   │  Cara penyampaian [1-5]                               │   │
│   │  Interaksi dengan peserta [1-5]                       │   │
│   └───────────────────────────────────────────────────────┘   │
│                                                               │
│ ▸ BAGIAN 3: Saran & Masukan (dari template)                  │
│   - Apa yang paling bermanfaat? [textarea]                   │
│   - Saran perbaikan [textarea]                               │
│                                                               │
│              [ Kirim Respons ]                                │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Perubahan Schema

#### Field Type Baru: `narasumber_section`

```typescript
// Tambahan di FormField type
type FieldType = 
  | "text" | "textarea" | "number" | "email" 
  | "select" | "radio" | "checkbox" | "scale" | "grid"
  | "narasumber_section";  // BARU

// Config untuk narasumber_section
interface NarasumberSectionConfig {
  fields: Array<{
    type: "scale" | "radio" | "textarea" | "text";
    label: string;
    required: boolean;
    config: ScaleConfig | OptionsConfig | null;
  }>;
}
```

#### Tipe Evaluasi (Enum Baru)

```sql
CREATE TYPE tipe_evaluasi AS ENUM (
  'evaluasi_umum',
  'evaluasi_materi', 
  'evaluasi_narasumber',
  'evaluasi_logistik'
);

-- Tambah kolom di ppl_kuesioner_template
ALTER TABLE ppl_kuesioner_template 
  ADD COLUMN tipe_evaluasi tipe_evaluasi NOT NULL DEFAULT 'evaluasi_umum';
```

#### Multi-Kuesioner per Kegiatan

```sql
-- Hapus constraint 1:1 (saat ini enforced di application level)
-- Izinkan multiple links per kegiatan
-- Tambah kolom tipe di link table
ALTER TABLE ppl_kuesioner_link
  ADD COLUMN tipe_evaluasi tipe_evaluasi NOT NULL DEFAULT 'evaluasi_umum';
```

#### Penyimpanan Jawaban Narasumber

```typescript
// Struktur answersJson yang baru (backward compatible)
interface ResponseAnswers {
  // Field biasa (existing)
  [fieldId: string]: unknown;
  
  // Narasumber section (baru)
  // Key format: "narasumber_{narasumberId}_{subFieldIndex}"
  // Contoh: "narasumber_5_0" = jawaban untuk narasumber id=5, field index 0
}
```

### 1.4 Perubahan Scoring Engine

```typescript
interface NarasumberScore {
  narasumberId: number;
  nama: string;
  topik: string;
  avgScore: number;          // rata-rata semua scale fields di section-nya
  fieldScores: Array<{
    label: string;
    avg: number;
    median: number;
    distribution: Record<number, number>;
  }>;
  respondenCount: number;
}

interface KegiatanEvaluationSummary {
  kegiatanId: number;
  overallScore: number;       // rata-rata semua scale fields non-narasumber
  narasumberScores: NarasumberScore[];
  totalResponden: number;
  responseRate: number;       // responden / realisasiHadir * 100
}
```

### 1.5 Perubahan UI

| Halaman | Perubahan |
|---------|-----------|
| `/ppl-evaluasi/kuesioner` | Jadikan halaman manajemen template yang proper: create, edit, duplicate, kategorisasi |
| `/ppl-evaluasi/[id]/kuesioner` | Tampilkan preview form termasuk dynamic narasumber section |
| `/evaluasi/[token]` (public) | Render narasumber section berdasarkan assignment kegiatan |
| `/ppl-evaluasi/[id]/responses` | Breakdown skor per-narasumber + overall |
| `/ppl-evaluasi/analytics/narasumber` | Gunakan skor dari section spesifik, bukan keseluruhan |

### 1.6 Backward Compatibility

- Template lama tanpa `narasumber_section` tetap berfungsi normal
- Response lama tetap bisa dibaca (format answersJson backward compatible)
- Migrasi: template existing otomatis mendapat `tipe_evaluasi = 'evaluasi_umum'`

### 1.7 Checklist Phase 1

- [x] Tambah enum `tipe_evaluasi` di schema
- [x] Tambah kolom `tipe_evaluasi` di `ppl_kuesioner_template`
- [x] Tambah kolom `tipe_evaluasi` di `ppl_kuesioner_link`
- [x] Hapus constraint 1:1 kegiatan-kuesioner (izinkan multi-link)
- [x] Tambah field type `narasumber_section` di FormField types
- [x] Update FormBuilder untuk support `narasumber_section`
- [x] Update public form renderer — fetch narasumber assignment, render dynamic section
- [x] Update `submitResponse` — validasi jawaban narasumber section
- [x] Implement scoring engine per-narasumber
- [x] Update analytics — breakdown per-narasumber dari section spesifik
- [x] Revamp halaman `/ppl-evaluasi/kuesioner` — full CRUD template
- [x] Migration script untuk data existing
- [x] Update validator (`ppl-evaluasi.ts`) untuk field type baru

---

## Phase 2: Bank Tema PPL

### 2.1 Konsep

Bank Tema PPL adalah **library template kegiatan** yang menyimpan informasi lengkap tentang tema-tema PPL yang pernah atau akan diselenggarakan. Ketika admin membuat kegiatan baru, sistem memberikan rekomendasi tema yang relevan dan bisa langsung pre-fill data.

### 2.2 Schema Database

```sql
CREATE TABLE ppl_tema_bank (
  id SERIAL PRIMARY KEY,
  nama_tema VARCHAR(255) NOT NULL,
  kategori_ppl kategori_ppl NOT NULL,
  
  -- Konten tema
  latar_belakang TEXT,                    -- deskripsi latar belakang/urgensi
  susunan_materi JSONB DEFAULT '[]',      -- array of { judul, deskripsi, durasiMenit }
  benefit JSONB DEFAULT '[]',             -- array of string
  target_peserta TEXT,                    -- deskripsi target audience
  
  -- Rekomendasi operasional
  durasi_hari INTEGER DEFAULT 1,
  tipe_pelaksanaan_default tipe_pelaksanaan,
  rekomendasi_narasumber_ids JSONB DEFAULT '[]',  -- array of narasumber IDs
  default_template_ids JSONB DEFAULT '[]',         -- bundle template evaluasi
  
  -- Metadata
  tags JSONB DEFAULT '[]',                -- array of string untuk search
  usage_count INTEGER DEFAULT 0,          -- berapa kali dipakai
  last_used_at TIMESTAMP,
  
  -- Source tracking
  source_kegiatan_id INTEGER REFERENCES ppl_kegiatan(id) ON DELETE SET NULL,
  
  -- Audit
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index untuk fuzzy search
CREATE INDEX ppl_tema_bank_nama_idx ON ppl_tema_bank USING gin(nama_tema gin_trgm_ops);
CREATE INDEX ppl_tema_bank_kategori_idx ON ppl_tema_bank(kategori_ppl);
CREATE INDEX ppl_tema_bank_tags_idx ON ppl_tema_bank USING gin(tags);
```

### 2.3 Struktur Susunan Materi

```typescript
interface MateriItem {
  judul: string;
  deskripsi: string;
  durasiMenit: number;
  urutan: number;
}

interface TemaBankData {
  id: number;
  namaTema: string;
  kategoriPpl: KategoriPpl;
  latarBelakang: string | null;
  susunanMateri: MateriItem[];
  benefit: string[];
  targetPeserta: string | null;
  durasiHari: number;
  tipePelaksanaanDefault: TipePelaksanaan | null;
  rekomendasiNarasumberIds: number[];
  defaultTemplateIds: number[];
  tags: string[];
  usageCount: number;
  lastUsedAt: Date | null;
  sourceKegiatanId: number | null;
}
```

### 2.4 Fitur Auto-Suggest

Saat admin mengetik nama kegiatan di form "Buat Kegiatan PPL":

```typescript
// Server action
async function suggestTema(query: string, kategori?: KategoriPpl): Promise<TemaSuggestion[]> {
  // 1. Fuzzy search by nama_tema (trigram similarity)
  // 2. Filter by kategori jika dipilih
  // 3. Sort by: similarity score DESC, usage_count DESC
  // 4. Return top 5 suggestions
}

interface TemaSuggestion {
  id: number;
  namaTema: string;
  kategoriPpl: KategoriPpl;
  matchScore: number;       // 0-1, seberapa mirip
  usageCount: number;
  lastUsedAt: Date | null;
  preview: {
    benefitCount: number;
    materiCount: number;
    hasNarasumberRekomendasi: boolean;
  };
}
```

#### UX Flow

1. Admin mulai ketik nama kegiatan → debounce 300ms → panggil `suggestTema`
2. Muncul dropdown suggestions di bawah input
3. Admin pilih tema → dialog konfirmasi "Gunakan tema ini?"
4. Jika ya → pre-fill:
   - Nama kegiatan (bisa diedit)
   - Kategori PPL
   - Tipe pelaksanaan default
   - Durasi (auto-set tanggal selesai)
   - Auto-assign narasumber yang direkomendasikan
   - Auto-link template evaluasi default
5. Admin review & submit

### 2.5 Fitur "Simpan sebagai Tema"

Setelah kegiatan PPL selesai (status archived atau completed), admin bisa menyimpannya sebagai tema:

```typescript
async function saveKegiatanAsTema(kegiatanId: number, overrides?: Partial<TemaBankData>): Promise<ActionResult<{ id: number }>> {
  // 1. Fetch data kegiatan (nama, kategori, dll)
  // 2. Fetch narasumber yang di-assign
  // 3. Fetch template evaluasi yang di-link
  // 4. Buat entry di ppl_tema_bank
  // 5. Set source_kegiatan_id untuk traceability
}
```

### 2.6 Navigasi & UI

| Halaman | Fungsi |
|---------|--------|
| `/ppl-evaluasi/tema` (BARU) | List semua tema, search, filter by kategori |
| `/ppl-evaluasi/tema/[id]` (BARU) | Detail tema: latar belakang, materi, benefit, narasumber rekomendasi |
| `/ppl-evaluasi/tema/buat` (BARU) | Form buat tema manual |
| Form "Buat Kegiatan" | Tambah autocomplete + tombol "Pilih dari Bank Tema" |
| Detail Kegiatan (archived) | Tombol "Simpan sebagai Tema" |

### 2.7 Checklist Phase 2

- [x] Buat tabel `ppl_tema_bank` + migration
- [x] Install extension `pg_trgm` untuk fuzzy search (jika belum) — menggunakan `ilike` sebagai alternatif
- [x] CRUD server actions: `createTema`, `updateTema`, `deleteTema`, `getTema`, `listTema`
- [x] Implement `suggestTema` dengan trigram similarity
- [x] Implement `saveKegiatanAsTema`
- [x] Implement `applyTemaToKegiatan` (pre-fill logic)
- [x] UI: Halaman `/ppl-evaluasi/tema` (list + detail)
- [x] UI: Form buat tema manual
- [x] UI: Autocomplete di form buat kegiatan
- [x] UI: Dialog "Gunakan Tema" dengan preview
- [x] UI: Tombol "Simpan sebagai Tema" di detail kegiatan
- [x] Tambah menu "Bank Tema" di sidebar navigasi
- [x] Increment `usage_count` saat tema dipakai

---

## Phase 3: Penguatan Link Kegiatan ↔ Project

### 3.1 Masalah Saat Ini

- Project dan Kegiatan PPL terasa seperti 2 entitas terpisah yang harus di-navigate sendiri-sendiri
- Sync sudah ada tapi one-way (PPL → Project) untuk beberapa aspek
- User harus buka `/projects/[id]` terpisah dari `/ppl-evaluasi/[id]`

### 3.2 Solusi: Embedded Project View

Project ditampilkan sebagai **tab di dalam detail kegiatan PPL**, bukan halaman terpisah yang harus di-navigate.

#### Perubahan UI Detail Kegiatan

```
┌─────────────────────────────────────────────────────────────┐
│ Kegiatan: Workshop Transfer Pricing 2026                     │
├─────────────────────────────────────────────────────────────┤
│ [Overview] [Narasumber] [Evaluasi] [Kolaborasi] [Kehadiran] │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ Tab "Kolaborasi" = embedded project view:                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Progress: ████████░░ 75%                                 │ │
│ │                                                           │ │
│ │ Tasks (4/6 selesai)                                      │ │
│ │ ✓ Persiapan materi & rundown                             │ │
│ │ ✓ Buat & link kuesioner evaluasi                         │ │
│ │ ✓ Distribusi QR code ke peserta                          │ │
│ │ ✓ Input data kehadiran peserta                           │ │
│ │ ○ Rekap evaluasi & export data                           │ │
│ │ ○ Proses honorarium narasumber                           │ │
│ │                                                           │ │
│ │ Budget: Rp 15.000.000 / Rp 20.000.000                   │ │
│ │ Files: 3 dokumen                                         │ │
│ │                                                           │ │
│ │ [Buka Project Lengkap →]                                 │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Sync 2 Arah yang Ditingkatkan

| Trigger | Arah | Aksi |
|---------|------|------|
| Kegiatan dibuat | PPL → Project | Auto-create project (sudah ada) |
| Kegiatan di-update (nama, tanggal) | PPL → Project | Sync title, dates (sudah ada) |
| Kegiatan di-archive | PPL → Project | Set project completed (sudah ada) |
| Narasumber di-assign | PPL → Project | Sync speakers (sudah ada) |
| **Project status berubah** | Project → PPL | **Update status indicator di kegiatan (BARU)** |
| **Task selesai semua** | Project → PPL | **Notifikasi: kegiatan siap di-archive (BARU)** |
| **Budget disetujui** | Project → PPL | **Tampilkan total budget di overview kegiatan (BARU)** |

### 3.4 Shared Timeline

Gabungkan timeline kegiatan PPL + project activity log dalam 1 view:

```typescript
interface UnifiedTimelineEntry {
  id: string;
  source: "ppl" | "project";
  timestamp: Date;
  action: string;
  description: string;
  userId: string;
  userName: string;
}

// Contoh entries:
// [ppl] Kegiatan dibuat oleh Admin A
// [project] Task "Persiapan materi" di-assign ke Staff B
// [ppl] Narasumber Dr. Ahmad di-assign
// [project] File "Rundown.pdf" diupload
// [ppl] Kuesioner diaktifkan
// [ppl] 45 respons evaluasi masuk
// [project] Task "Rekap evaluasi" selesai
```

### 3.5 Checklist Phase 3

- [x] Buat komponen `EmbeddedProjectView` (summary tasks, budget, files)
- [x] Tambah tab "Kolaborasi" di detail kegiatan PPL
- [x] Implement reverse sync: project status → kegiatan indicator
- [x] Implement notifikasi "semua task selesai"
- [x] Implement unified timeline (merge PPL + project activity log)
- [x] Tampilkan budget summary di overview kegiatan
- [x] Link "Buka Project Lengkap" dari embedded view

---

## Phase 4: Unified People Directory

### 4.1 Masalah Saat Ini

- Narasumber PPL (`ppl_narasumber`) dan Instruktur Brevet (`instructors`) adalah 2 tabel terpisah
- Orang yang sama bisa terdaftar di kedua tempat tanpa link
- Tidak ada view terpadu untuk melihat semua "pengajar/pembicara" di organisasi
- Assign narasumber hanya bisa dari modul PPL, assign instruktur hanya dari modul Brevet

### 4.2 Solusi: Unified View (Bukan Merge Tabel)

**Penting**: Kita TIDAK menggabungkan tabel `ppl_narasumber` dan `instructors` karena:
- Masing-masing punya field spesifik domain (feePerSkp vs rate brevet)
- Sudah banyak FK yang reference ke masing-masing
- Migrasi data terlalu berisiko

Yang kita lakukan: **linking + unified view**.

### 4.3 Schema Tambahan

```sql
-- Tabel link antara narasumber PPL dan instruktur brevet
CREATE TABLE people_link (
  id SERIAL PRIMARY KEY,
  ppl_narasumber_id INTEGER REFERENCES ppl_narasumber(id) ON DELETE CASCADE,
  instructor_id TEXT REFERENCES instructors(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,  -- jika juga user internal
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Minimal 2 dari 3 harus terisi
  CONSTRAINT people_link_check CHECK (
    (ppl_narasumber_id IS NOT NULL)::int + 
    (instructor_id IS NOT NULL)::int + 
    (user_id IS NOT NULL)::int >= 2
  )
);

CREATE UNIQUE INDEX people_link_ppl_idx ON people_link(ppl_narasumber_id) WHERE ppl_narasumber_id IS NOT NULL;
CREATE UNIQUE INDEX people_link_instructor_idx ON people_link(instructor_id) WHERE instructor_id IS NOT NULL;
```

### 4.4 Unified View Query

```typescript
interface UnifiedPerson {
  // Identity
  id: string;                    // composite key
  nama: string;
  email: string;
  noTelepon: string | null;
  
  // Roles
  isPplNarasumber: boolean;
  isBrevetInstructor: boolean;
  isInternalUser: boolean;
  
  // PPL data (jika ada)
  pplNarasumberId: number | null;
  feePerSkp: number | null;
  expertise: KategoriPpl[];
  pplKegiatanCount: number;
  avgPplScore: number | null;
  
  // Brevet data (jika ada)
  instructorId: string | null;
  brevetSessionCount: number;
  
  // Cross-module stats
  totalAssignments: number;
  lastActiveAt: Date | null;
}
```

### 4.5 Fitur Cross-Assign

Dari Bank Tema atau form kegiatan PPL, admin bisa:
1. Search dari unified directory
2. Jika orang tersebut belum terdaftar sebagai narasumber PPL tapi sudah ada sebagai instruktur brevet → tawarkan "Tambahkan juga sebagai Narasumber PPL?"
3. Auto-create entry di `ppl_narasumber` + link di `people_link`

### 4.6 UI

| Halaman | Fungsi |
|---------|--------|
| `/people` (BARU) | Unified directory: semua pengajar/pembicara, filter by role |
| `/people/[id]` (BARU) | Profil lengkap: riwayat PPL + Brevet, skor evaluasi, timeline |
| Existing pages | Tetap berfungsi, tapi search bisa cross-reference |

### 4.7 Checklist Phase 4

- [x] Buat tabel `people_link` + migration
- [x] Implement auto-detect duplicate (by email matching)
- [x] Implement `listUnifiedPeople` query
- [x] Implement `linkPeople` action (manual linking)
- [x] Implement cross-assign flow
- [x] UI: Halaman `/people` (list + search + filter)
- [ ] UI: Halaman `/people/[id]` (profil + riwayat) — deferred ke iterasi berikutnya
- [ ] UI: Suggest link saat create narasumber/instruktur dengan email yang sudah ada — deferred
- [x] Tambah menu "Direktori Pengajar" di sidebar

---

## Dependensi Antar Phase

```
Phase 1 (Evaluasi)
  │
  ├──→ Phase 2 (Bank Tema) — butuh template evaluasi yang sudah enhanced untuk bundling
  │       │
  │       └──→ Phase 3 (Kegiatan ↔ Project) — bank tema bisa include project template
  │
  └──→ Phase 4 (People Directory) — scoring per-narasumber jadi input untuk profil unified
```

Phase 1 adalah **fondasi** — harus selesai dulu sebelum yang lain.
Phase 2 dan Phase 4 bisa dikerjakan **paralel** setelah Phase 1.
Phase 3 bisa dikerjakan kapan saja (tidak strict dependency), tapi idealnya setelah Phase 2.

---

## Estimasi Effort

| Phase | Scope | Estimasi |
|-------|-------|----------|
| Phase 1 | Schema + form builder + scoring + UI revamp | Besar (2-3 sprint) |
| Phase 2 | Tabel baru + CRUD + autocomplete + UI | Sedang (1-2 sprint) |
| Phase 3 | Embedded view + sync + timeline | Kecil-Sedang (1 sprint) |
| Phase 4 | Link table + unified query + UI | Sedang (1-2 sprint) |

---

## Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Breaking change di form builder | Backward compatible: field type baru, format lama tetap jalan |
| Performance fuzzy search (Bank Tema) | pg_trgm index + limit results + debounce |
| Data inconsistency people_link | Auto-detect by email, manual review UI |
| Complexity narasumber section rendering | Progressive enhancement: render static dulu, dynamic section optional |
| Migration data evaluasi existing | Migrasi non-destructive: tambah kolom, default value, data lama tetap valid |

---

## Out of Scope (Iterasi Berikutnya)

- AI-powered tema suggestion (berdasarkan tren industri)
- Auto-generate latar belakang dari topik (LLM integration)
- Evaluasi 360° (narasumber mengevaluasi peserta)
- Sertifikat otomatis berdasarkan skor evaluasi
- Integration dengan sistem SKP IAI pusat
- Mobile app untuk pengisian evaluasi (saat ini responsive web sudah cukup)
