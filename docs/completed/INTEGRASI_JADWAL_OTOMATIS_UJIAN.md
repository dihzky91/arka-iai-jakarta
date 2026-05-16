# Integrasi Jadwal Otomatis → Jadwal Ujian

> **Status:** ✅ Selesai (2026-05-01)
> **Cutoff:** Kelas Brevet AB 238, Brevet C, BFA (kelas baru ke depan)
> **Data existing:** Kelas ≤ 237 tidak disentuh, tetap jalan independen
> **Dibuat:** 2026-04-30
> **Next:** Setelah selesai → `MODUL_PESERTA_NILAI_PROGRAM_PELATIHAN.md` depend on this

---

## Daftar Isi

1. [Konteks & Tujuan](#1-konteks--tujuan)
2. [Cutoff Strategy](#2-cutoff-strategy)
3. [Gap Analysis (Sekarang)](#3-gap-analysis-sekarang)
4. [Target Arsitektur](#4-target-arsitektur)
5. [Fase 1 — Schema & Migration](#fase-1--schema--migration)
6. [Fase 2 — Server Actions](#fase-2--server-actions)
7. [Fase 3 — UI](#fase-3--ui)
8. [Checklist Progress](#checklist-progress)

---

## 1. Konteks & Tujuan

Saat ini dua modul berjalan sepenuhnya terpisah:

- **Jadwal Otomatis** (`/jadwal-otomatis`) — generate sesi pelatihan, assign instruktur, hitung honorarium
- **Jadwal Ujian** (`/jadwal-ujian`) — kelola jadwal ujian, pengawas, admin jaga, beban kerja

Padahal secara proses bisnis keduanya adalah satu alur:

```
Kelas Pelatihan dibuat
        ↓
Sesi berjalan (classSessions)
        ↓
Hari ujian tiba (isExamDay = true)
        ↓
[GAP: saat ini manual input ulang di jadwal ujian]
        ↓
Jadwal Ujian → pengawas ditugaskan
        ↓
Sertifikat diterbitkan
```

**Tujuan integrasi:** Eliminasi input ulang. Saat kelas pelatihan sudah selesai di-generate, data ujiannya bisa langsung dibuat dari sana dengan satu klik.

---

## 2. Cutoff Strategy

### Prinsip: Nullable FK — Zero Risk ke Data Lama

```sql
-- Kolom baru di kelas_ujian, NULLABLE
kelas_pelatihan_id TEXT NULL REFERENCES kelas_pelatihan(id)
```

| Kelas | `kelas_pelatihan_id` | Perilaku |
|-------|----------------------|----------|
| Brevet AB ≤ 237 | `NULL` | Tidak berubah sama sekali |
| Brevet AB 238 ke atas | Diisi | Ter-link, fitur integrasi aktif |
| Brevet C (semua baru) | Diisi | Ter-link |
| BFA (semua baru) | Diisi | Ter-link |

Tidak ada backfill. Tidak ada data lama yang dimodifikasi.

---

## 3. Gap Analysis (Sekarang)

### A. Duplikasi Data Program & Tipe

| Field | `kelasPelatihan` | `kelasUjian` |
|-------|-------------------|--------------|
| Program | `programId` (FK ke `programs`) | `program` (varchar bebas) |
| Tipe kelas | `classTypeId` (FK ke `classTypes`) | `tipe` (varchar bebas) |
| Mode | `mode` (offline/online) | `mode` (varchar) |
| Lokasi | `lokasi` | `lokasi` |

`kelasUjian` tidak pakai FK → data bisa diverge, typo, inkonsisten.

### B. Hari Ujian Sudah Ada di classSessions, Tidak Dipakai

`classSessions` punya:
```typescript
isExamDay: boolean        // sudah true untuk hari ujian
examSubjects: text[]      // sudah berisi mata ujian
scheduledDate: date       // sudah berisi tanggal
timeSlotStart / End       // sudah berisi jam
```

Data ini **tidak pernah mengalir** ke `jadwalUjian`. Saat ini operator input ulang manual.

### C. Tidak Ada Link Peserta Pelatihan → Peserta Ujian

Peserta kelas pelatihan ada di modul sertifikat (`participants` → `events`), tapi tidak terhubung ke `kelasUjian`. Siapa yang berhak ikut ujian tidak bisa divalidasi otomatis.

> **Catatan:** Gap C (peserta) di-scope out untuk iterasi pertama ini. Fokus ke A dan B dulu.

---

## 4. Target Arsitektur

```
kelasPelatihan ──────────────────────────┐
  ├─ programId ──→ programs.name          │
  ├─ classTypeId ──→ classTypes.name      │ nullable FK
  ├─ mode, lokasi                         │
  └─ classSessions (isExamDay=true) ──┐  │
       ├─ scheduledDate               │  ↓
       ├─ examSubjects                └──→ kelasUjian (kelasPelatihanId)
       └─ timeSlotStart/End               └─→ jadwalUjian (auto-created)
```

### Flow Baru (Kelas 238+)

1. Operator buat `kelasPelatihan` + generate sesi di Jadwal Otomatis (existing flow)
2. Setelah kelas dibuat, di halaman detail muncul tombol **"Buat Jadwal Ujian"**
3. Klik tombol → dialog konfirmasi tampil preview data yang akan dibuat:
   - Nama kelas, program, tipe, mode, lokasi (pre-filled)
   - List tanggal ujian dari `classSessions.isExamDay=true`
   - Mata ujian per tanggal dari `examSubjects`
4. Operator konfirmasi → sistem buat `kelasUjian` + semua `jadwalUjian` sekaligus
5. Halaman detail kelas pelatihan tampilkan link ke `kelasUjian` yang terbuat
6. Dari situ, operator tinggal assign pengawas di modul jadwal ujian

---

## Fase 1 — Schema & Migration

### 1.1 Perubahan Schema (`src/server/db/schema.ts`)

Tambah satu kolom nullable di `kelasUjian`:

```typescript
export const kelasUjian = pgTable("kelas_ujian", {
  id: text("id").primaryKey(),
  namaKelas: varchar("nama_kelas", { length: 200 }).notNull(),
  program: varchar("program", { length: 100 }).notNull(),
  tipe: varchar("tipe", { length: 100 }).notNull(),
  mode: varchar("mode", { length: 50 }).notNull(),
  lokasi: varchar("lokasi", { length: 300 }),
  catatan: text("catatan"),
  // BARU — nullable, kelas lama tetap NULL
  kelasPelatihanId: text("kelas_pelatihan_id")
    .references(() => kelasPelatihan.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**`onDelete: "set null"`** — jika kelas pelatihan dihapus, ujiannya tidak ikut terhapus (data ujian tetap valid berdiri sendiri).

### 1.2 Generate Migration

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

### 1.3 Update Type Exports

```typescript
export type KelasUjian = typeof kelasUjian.$inferSelect;
// kelasPelatihanId: string | null — otomatis dari perubahan schema
```

### Checklist Fase 1
- [ ] Tambah kolom `kelasPelatihanId` di schema
- [ ] Generate migration Drizzle
- [ ] Jalankan migration di dev
- [ ] Verifikasi data lama tetap `NULL`

---

## Fase 2 — Server Actions

### 2.1 Action Baru: `createKelasUjianFromPelatihan`

Lokasi: `src/server/actions/jadwal-otomatis/integrasi.ts` (file baru)

**Input:** `kelasPelatihanId: string`

**Logic:**
```
1. Fetch kelasPelatihan + join programs + classTypes
2. Fetch classSessions where kelasId = id AND isExamDay = true, order by scheduledDate
3. Cek apakah kelasUjian dengan kelasPelatihanId ini sudah ada → throw jika sudah
4. Create kelasUjian:
   - namaKelas  ← kelasPelatihan.namaKelas
   - program    ← programs.name
   - tipe       ← classTypes.name
   - mode       ← kelasPelatihan.mode
   - lokasi     ← kelasPelatihan.lokasi
   - kelasPelatihanId ← kelasPelatihan.id
5. Untuk setiap examSession, create jadwalUjian:
   - kelasId        ← kelasUjian.id (baru dibuat)
   - tanggalUjian   ← examSession.scheduledDate
   - mataPelajaran  ← examSession.examSubjects
   - jamMulai       ← examSession.timeSlotStart
   - jamSelesai     ← examSession.timeSlotEnd
6. Return { kelasUjianId, jadwalUjianCount }
```

### 2.2 Action Baru: `getKelasUjianByPelatihan`

Lokasi: `src/server/actions/jadwal-otomatis/integrasi.ts`

**Input:** `kelasPelatihanId: string`

**Return:** `KelasUjian | null` — untuk cek apakah sudah ada link

### 2.3 Action Baru: `previewKelasUjianFromPelatihan`

**Input:** `kelasPelatihanId: string`

**Return:** Data preview tanpa menyimpan — dipakai di dialog konfirmasi:
```typescript
{
  namaKelas: string
  program: string
  tipe: string
  mode: string
  lokasi: string | null
  jadwalList: Array<{
    tanggalUjian: string
    mataPelajaran: string[]
    jamMulai: string
    jamSelesai: string
  }>
}
```

### 2.4 Update Action `getKelasPelatihan` / detail page query

Tambah join ke `kelasUjian` untuk fetch `kelasPelatihanId` → tahu apakah kelas ini sudah punya jadwal ujian ter-link.

### Checklist Fase 2
- [ ] Buat file `src/server/actions/jadwal-otomatis/integrasi.ts`
- [ ] Implement `previewKelasUjianFromPelatihan`
- [ ] Implement `createKelasUjianFromPelatihan`
- [ ] Implement `getKelasUjianByPelatihan`
- [ ] Update query detail kelasPelatihan — sertakan linked kelasUjian

---

## Fase 3 — UI

### 3.1 Halaman Detail Kelas Pelatihan

Lokasi: `src/app/(dashboard)/jadwal-otomatis/[id]/page.tsx` (atau component-nya)

**Kondisi A — Belum ada jadwal ujian ter-link:**

Tampilkan card/section "Jadwal Ujian" dengan tombol:

```
┌─────────────────────────────────────────────┐
│  Jadwal Ujian                                │
│                                             │
│  Kelas ini belum memiliki jadwal ujian.     │
│                                             │
│  [Buat Jadwal Ujian]                        │
└─────────────────────────────────────────────┘
```

Tombol hanya tampil jika:
- `kelasPelatihanId` pada `kelasUjian` = NULL (belum ter-link)
- Ada minimal 1 `classSession.isExamDay = true` (ada data ujian untuk di-generate)

**Kondisi B — Sudah ada jadwal ujian ter-link:**

```
┌─────────────────────────────────────────────┐
│  Jadwal Ujian                   ✓ Terhubung  │
│                                             │
│  Kelas: Brevet AB 238                       │
│  3 jadwal ujian terdaftar                   │
│                                             │
│  [Lihat Jadwal Ujian →]                     │
└─────────────────────────────────────────────┘
```

### 3.2 Dialog Konfirmasi "Buat Jadwal Ujian"

Tampil setelah tombol diklik. Preview data sebelum submit:

```
┌──────────────────────────────────────────────────┐
│  Buat Jadwal Ujian                               │
├──────────────────────────────────────────────────┤
│  Data yang akan dibuat:                          │
│                                                  │
│  Nama Kelas    : Brevet AB 238                   │
│  Program       : Brevet AB                       │
│  Tipe          : Weekday Selasa-Kamis            │
│  Mode          : Offline                         │
│  Lokasi        : Gedung A Lt. 3                  │
│                                                  │
│  Jadwal Ujian (3 sesi):                          │
│  ✦ 15 Jun 2026 — PPh OP, KUP A — 08:00–12:30   │
│  ✦ 20 Jul 2026 — PPh Badan, KUP B — 08:00–12:30│
│  ✦ 10 Agt 2026 — PPN A, PBB — 08:00–12:30      │
│                                                  │
│  Pengawas belum ditugaskan. Assign setelah ini.  │
│                                                  │
│           [Batal]    [Buat Jadwal Ujian]         │
└──────────────────────────────────────────────────┘
```

### 3.3 Halaman List Kelas Ujian (`/jadwal-ujian/kelas`)

Tambah kolom/badge "Dari Jadwal Otomatis" untuk kelas yang `kelasPelatihanId IS NOT NULL`. Bisa berupa badge kecil atau ikon link.

### Checklist Fase 3
- [ ] Tambah section "Jadwal Ujian" di halaman detail kelasPelatihan
- [ ] Buat dialog konfirmasi dengan preview data
- [ ] Handle loading & error state di dialog
- [ ] Redirect ke `/jadwal-ujian/kelas/[id]` setelah berhasil dibuat
- [ ] Badge "Dari Jadwal Otomatis" di list kelasUjian

---

## Checklist Progress

### Fase 1 — Schema & Migration
- [ ] Tambah kolom `kelasPelatihanId` nullable di `kelasUjian`
- [ ] Generate & run migration Drizzle
- [ ] Verifikasi data existing tetap `NULL`

### Fase 2 — Server Actions
- [ ] `previewKelasUjianFromPelatihan`
- [ ] `createKelasUjianFromPelatihan`
- [ ] `getKelasUjianByPelatihan`
- [ ] Update query detail kelasPelatihan

### Fase 3 — UI
- [ ] Section jadwal ujian di detail kelasPelatihan
- [ ] Dialog konfirmasi + preview
- [ ] Redirect post-create
- [ ] Badge di list kelasUjian

---

## Out of Scope (Iterasi Ini)

| Item | Alasan |
|------|--------|
| Link peserta pelatihan → peserta ujian | Kompleks, butuh analisis flow peserta tersendiri |
| Sinkronisasi dua arah (ujian → pelatihan) | Tidak perlu; pelatihan adalah source of truth |
| Backfill kelas ≤ 237 | Risiko tidak perlu; data lama valid berdiri sendiri |
| Auto-create sertifikat setelah ujian | **Out of scope permanen** — sertifikat Brevet/BFA diterbitkan sistem pusat (tidak boleh dihubungkan) |
| Modul Peserta & Nilai | Dikerjakan setelah integrasi ini selesai — lihat `MODUL_PESERTA_NILAI_PROGRAM_PELATIHAN.md` |
| Validasi konflik jadwal ujian dengan hari pelatihan | Nice-to-have, bisa ditambah setelah core selesai |
