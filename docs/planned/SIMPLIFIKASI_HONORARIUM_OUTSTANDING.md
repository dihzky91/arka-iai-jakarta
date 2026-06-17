# Simplifikasi Halaman Honorarium — Outstanding Otomatis

## Latar Belakang

Feedback dari staff: flow halaman Honorarium saat ini terlalu banyak langkah manual. Ketika status sesi sudah diubah ke "Selesai", staff berharap data langsung muncul di halaman honorarium tanpa perlu filter periode, klik "Gunakan Saran", "Cek Kelayakan", baru "Generate Draft".

### Masalah Saat Ini

1. Staff harus atur filter tanggal mulai/akhir lalu klik "Terapkan"
2. Harus klik "Gunakan Saran" untuk mendapatkan periode batch
3. Harus klik "Cek Kelayakan" untuk preview
4. Baru bisa klik "Generate Draft"
5. Tidak ada visibilitas mana saja sesi yang sudah selesai tapi belum masuk batch
6. Dari halaman Jadwal Kelas, tidak terlihat sesi mana yang sudah diajukan honorariumnya

### Tujuan

- Sesi yang selesai (status `completed` + availability `accepted`) langsung terlihat di halaman honorarium tanpa filter
- Generate draft cukup 1 klik
- Staff bisa lihat mana sesi yang sudah masuk batch dari halaman jadwal

---

## Desain Solusi

### 1. Section Baru: "Sesi Siap Bayar" (Outstanding)

Letaknya di **paling atas** halaman Honorarium, sebelum filter laporan dan batch queue.

#### Data yang ditampilkan

Query: semua `session_assignments` yang:
- `class_sessions.status = 'completed'`
- `session_assignments.availability_status = 'accepted'`
- `class_sessions.is_exam_day = false`
- `class_sessions.materi_name IS NOT NULL`
- **BELUM** ada di tabel `honorarium_items` (LEFT JOIN / NOT EXISTS)

#### UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Sesi Siap Bayar                                            │
│  Sesi yang sudah selesai namun belum masuk batch honorarium  │
│                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────┐        │
│  │ 12 Sesi  │  │ 4 Instruktur │  │ Rp 24.000.000  │        │
│  └──────────┘  └──────────────┘  └────────────────┘        │
│                                                             │
│  [ ] Pilih Semua                      [Generate Draft ▶]    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ [ ] │ 2026-04-18 │ Brevet AB Test │ KUP A │         │    │
│  │     │ Joko Try Saputo │ Middle │ Rp 2.000.000       │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ [ ] │ 2026-04-18 │ Brevet AB Test │ KUP A │         │    │
│  │     │ Joko Try Saputo │ Middle │ Rp 2.000.000       │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ ... dst                                              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ⚠ 2 sesi belum punya tarif (perlu dilengkapi dulu)        │
└─────────────────────────────────────────────────────────────┘
```

#### Fitur

- **Tanpa filter** — langsung tampil semua yang outstanding
- **Checkbox** per item untuk partial generate (opsional, bisa select all)
- **Warning** jika ada sesi tanpa tarif (rate missing) — ditampilkan terpisah dengan indikator merah
- **1-klik Generate** — langsung buat batch dari sesi yang dipilih/semua eligible
- **Pengelompokan** bisa toggle per instruktur atau flat list

### 2. Simplifikasi Flow Generate

#### Sebelum (5 langkah)

```
Filter → Terapkan → Gunakan Saran → Cek Kelayakan → Generate Draft
```

#### Sesudah (1-2 langkah)

```
Centang sesi (atau semua) → Generate Draft
```

#### Logika Generate Baru

- Periode batch otomatis ditentukan dari `MIN(scheduledDate)` sampai `MAX(scheduledDate)` dari sesi terpilih
- Tidak perlu input periode manual lagi (kecuali staff mau override)
- Cek kelayakan tetap jalan di background (validasi rate, cek bentrok) — tapi ditampilkan sebagai inline warning, bukan langkah terpisah

### 3. Badge Status Honorarium di Jadwal Kelas

Di halaman detail Jadwal Kelas (tab Jadwal Sesi), tambahkan kolom/badge indikator:

| Status | Badge | Warna |
|--------|-------|-------|
| Belum eligible (sesi belum selesai) | — | — |
| Siap bayar (completed, belum masuk batch) | `Siap Bayar` | kuning/amber |
| Sudah dalam batch draft | `Draft` | biru muda |
| Sudah diajukan ke keuangan | `Diajukan` | biru |
| Sudah dibayar | `Dibayar` | hijau |

#### Query

JOIN ke `honorarium_items` → ambil `honorarium_batches.status` untuk setiap sesi.

### 4. Mempertahankan Filter Laporan (Tetap Ada)

Section "Filter Laporan" tetap dipertahankan di bawah section outstanding, karena berguna untuk:
- Reporting/ekspor PDF per periode
- Drill-down per instruktur/program tertentu
- Keperluan audit

Tapi bukan lagi langkah wajib untuk generate batch.

---

## Perubahan Teknis

### Backend (Server Actions)

#### Baru: `getOutstandingHonorariumSessions()`

```typescript
// Return semua sesi eligible yang BELUM masuk batch honorarium manapun
export async function getOutstandingHonorariumSessions(): Promise<OutstandingSession[]> {
  // 1. Query session_assignments JOIN class_sessions
  //    WHERE status = 'completed' AND availability_status = 'accepted'
  //    AND is_exam_day = false AND materi_name IS NOT NULL
  // 2. LEFT JOIN honorarium_items ON assignment_id
  //    WHERE honorarium_items.id IS NULL (belum masuk batch)
  // 3. Resolve rate per sesi (override instruktur > matriks standar)
  // 4. Return dengan info rate_source dan flag missing
}
```

#### Baru: `generateHonorariumBatchFromSelection(assignmentIds: string[])`

```typescript
// Generate batch dari assignment IDs yang dipilih (tanpa perlu input periode)
export async function generateHonorariumBatchFromSelection(data: {
  assignmentIds: string[];
  internalNotes?: string;
}): Promise<GenerateBatchResult> {
  // 1. Validate semua assignment ada dan eligible
  // 2. Auto-determine periodStart/periodEnd dari MIN/MAX scheduledDate
  // 3. Check rate lengkap
  // 4. Check tidak bentrok dengan batch lain
  // 5. Insert batch + items
}
```

#### Baru: `getSessionHonorariumStatus(sessionIds: string[])`

```typescript
// Return mapping sessionId → honorarium status (untuk badge di jadwal kelas)
export async function getSessionHonorariumStatus(
  sessionIds: string[]
): Promise<Map<string, 'outstanding' | 'draft' | 'submitted' | 'paid'>> {
  // JOIN session_assignments → honorarium_items → honorarium_batches
}
```

### Frontend (Components)

#### Baru: `OutstandingHonorariumSection.tsx`

- Komponen section "Sesi Siap Bayar"
- Fetch `getOutstandingHonorariumSessions()` dari server (atau prop dari page)
- Render summary tiles + tabel dengan checkbox
- Tombol "Generate Draft" yang panggil `generateHonorariumBatchFromSelection`

#### Modifikasi: `HonorariumReport.tsx`

- Tambah prop `outstandingSessions` dari page
- Render `OutstandingHonorariumSection` di atas section filter yang sudah ada
- Section lama tetap ada, tidak dihapus

#### Modifikasi: `JadwalSesiSection.tsx` (atau komponen tabel jadwal sesi)

- Tambah kolom badge status honorarium
- Fetch status via `getSessionHonorariumStatus` di page level

### Database

Tidak ada perubahan schema. Query hanya menggunakan tabel yang sudah ada:
- `session_assignments`
- `class_sessions`
- `honorarium_items`
- `honorarium_batches`

---

## Migrasi & Backward Compatibility

- **Tidak ada breaking change** — section filter dan batch queue lama tetap ada
- Section outstanding adalah penambahan di atas flow yang sudah ada
- Action `generateHonorariumBatch` (versi lama) tetap bisa dipanggil untuk flow manual
- Badge di jadwal kelas bersifat read-only, tidak mengubah perilaku apapun

---

## Urutan Implementasi

| # | Task | Estimasi |
|---|------|----------|
| 1 | Server action `getOutstandingHonorariumSessions()` | Kecil |
| 2 | Server action `generateHonorariumBatchFromSelection()` | Sedang |
| 3 | Komponen `OutstandingHonorariumSection.tsx` | Sedang |
| 4 | Integrasi ke halaman Honorarium (page.tsx + HonorariumReport.tsx) | Kecil |
| 5 | Server action `getSessionHonorariumStatus()` | Kecil |
| 6 | Badge status honorarium di jadwal kelas | Kecil |

---

## Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Sesi tanpa tarif tidak bisa di-generate | Tampilkan warning jelas + link ke halaman instruktur untuk isi tarif |
| Race condition double-generate | Unique constraint `uniq_honorarium_assignment_once` sudah ada di schema |
| Outstanding list terlalu panjang (banyak sesi) | Pagination + grouped view per instruktur |
| Staff generate partial lalu lupa sisanya | Counter outstanding selalu visible di atas halaman |
