# Rencana Merge: Certificate Hub → Manajemen Persuratan

> **Status:** Perencanaan  
> **Dibuat:** 2026-04-27  
> **Estimasi Total:** ~5–7 hari kerja

---

## Daftar Isi

1. [Hasil Analisis Kroscek](#1-hasil-analisis-kroscek)
2. [Gap Analysis](#2-gap-analysis-apa-yang-belum-ada)
3. [Arsitektur Target](#3-arsitektur-target)
4. [Fase 1 — Database Schema](#fase-1--database-schema)
5. [Fase 2 — Server Actions](#fase-2--server-actions)
6. [Fase 3 — Komponen UI](#fase-3--komponen-ui)
7. [Fase 4 — Routes & Pages](#fase-4--routes--pages)
8. [Fase 5 — Testing & QA](#fase-5--testing--qa)
9. [Checklist Progress](#checklist-progress)
10. [Catatan Adaptasi Teknis](#catatan-adaptasi-teknis)

---

## 1. Hasil Analisis Kroscek

### Apa yang ada di `certificate-hub-main`?

| Halaman/Fitur | Deskripsi |
|---|---|
| `Dashboard.tsx` | Statistik batch (total batch, total sertifikat, batch aktif) + tabel batch terbaru |
| `BatchList.tsx` | Daftar semua batch dengan filter (program, jenis kelas, status, angkatan) |
| `BatchDetail.tsx` | Detail satu batch + daftar nomor sertifikat + **Export CSV** + **Edit Jumlah** |
| `GenerateCertificates.tsx` | Form generate nomor sertifikat baru (program, angkatan, jenis kelas, jumlah) |
| `YearlyReport.tsx` | Rekap tahunan sertifikat (aktif, dibatalkan, per program & jenis kelas) |
| `Admin.tsx` | CRUD Program pelatihan & CRUD Jenis Kelas (dengan kode 2 digit) |
| `Settings.tsx` | Pengaturan nomor serial terakhir (untuk sinkronisasi dengan data manual) |

### Konsep Inti yang Unik dari certificate-hub

1. **Sistem Penomoran Batch** — Nomor sertifikat mengikuti format `{angkatan}{kode_kelas}.{serial}`, contoh: `22301.3386`
2. **Serial Counter Global** — Ada tabel `system_config` dengan key `last_serial_number` yang terus berlanjut antar batch
3. **Edit Jumlah Batch** — Batch terakhir bisa dikurangi (hapus nomor dari ekor) atau ditambah (generate nomor baru melanjutkan serial)
4. **Status Batch** — `active`, `revised`, `cancelled`
5. **Status Sertifikat Individual** — `active`, `cancelled`
6. **Rekap Tahunan** — Statistik per tahun, dikelompokkan per program & jenis kelas
7. **Export CSV** — Per batch, ekspor daftar nomor sertifikat aktif

### Kondisi Modul Sertifikat yang Sudah Ada

Sistem yang ada di `manajemen-persuratan` adalah modul sertifikat berbasis **kegiatan/event** dengan:
- Generate PDF sertifikat dengan template (bukan sistem penomoran)
- Peserta per kegiatan
- Nomor sertifikat per peserta (format berbeda, counter per event)
- Audit log, email, bulk download ZIP, trash/restore

### ⚠️ Kesimpulan Kroscek

Kedua sistem adalah **dua hal yang BERBEDA** namun saling melengkapi:

| Aspek | Sistem Existing (Events) | Certificate Hub (Batch) |
|---|---|---|
| Fokus | Sertifikat kegiatan/workshop | Penomoran sertifikat formal (Brevet, BFA, dll) |
| Output | PDF sertifikat dengan nama peserta | Nomor urut sertifikat (serial number) |
| Unit kerja | Per peserta | Per batch (kelompok angkatan) |
| Verifikasi | QR Code + halaman verifikasi | Via nomor serial |

**Fitur certificate-hub perlu ditambahkan sebagai sub-modul baru `/sertifikat/nomor`**, bukan menggantikan yang sudah ada.

---

## 2. Gap Analysis: Apa yang Belum Ada

| Fitur certificate-hub | Status di manajemen-persuratan |
|---|---|
| Tabel `certificate_batches` (batch penomoran) | ❌ Belum ada |
| Tabel `certificate_items` (nomor individual) | ❌ Belum ada |
| Tabel `certificate_serial_config` (serial counter) | ❌ Belum ada |
| CRUD Program Pelatihan (tabel terpisah) | ❌ Belum ada |
| CRUD Jenis Kelas dengan kode 2-digit (tabel) | Sebagian (enum hardcode, bukan tabel) |
| Generate batch nomor sertifikat | ❌ Belum ada |
| Daftar batch + filter | ❌ Belum ada |
| Detail batch + daftar nomor | ❌ Belum ada |
| Edit jumlah batch (tambah/kurangi) | ❌ Belum ada |
| Export CSV per batch | ❌ Belum ada |
| Rekap Tahunan sertifikat | Sebagian (`reports.ts` ada) |
| Pengaturan serial terakhir | ❌ Belum ada |

---

## 3. Arsitektur Target

```
src/
├── app/(dashboard)/sertifikat/
│   ├── ...existing (kegiatan, template, peserta, audit-log, sampah)
│   │
│   └── nomor/                          ← BARU: Sub-modul penomoran
│       ├── page.tsx                    ← Daftar batch + tombol generate
│       ├── generate/
│       │   └── page.tsx                ← Form generate batch baru
│       ├── [id]/
│       │   └── page.tsx                ← Detail batch + daftar nomor + export CSV
│       └── rekap/
│           └── page.tsx                ← Rekap tahunan
│
├── components/sertifikat/
│   ├── ...existing
│   ├── BatchTable.tsx                  ← Daftar batch dengan filter
│   ├── BatchDetailView.tsx             ← Detail batch + export CSV
│   ├── GenerateBatchForm.tsx           ← Form generate nomor
│   ├── BatchQuantityEditor.tsx         ← Edit jumlah batch (Dialog)
│   └── YearlyReportView.tsx            ← Rekap tahunan
│
└── server/actions/sertifikat/
    ├── ...existing
    └── nomor/
        ├── batches.ts                  ← Generate + CRUD batch
        ├── programs.ts                 ← CRUD program pelatihan
        └── classTypes.ts              ← CRUD jenis kelas + serial config
```

---

## Fase 1 — Database Schema

**Estimasi:** 1 hari  
**File:** `src/server/db/schema.ts` + migration baru

### Tabel Baru

```typescript
// ─── CERTIFICATE HUB: PENOMORAN SERTIFIKAT ───────────────────────────────────

export const certificatePrograms = pgTable("certificate_programs", {
  id:        text("id").primaryKey().$defaultFn(() => nanoid()),
  name:      text("name").notNull().unique(),
  code:      text("code"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const certificateClassTypes = pgTable("certificate_class_types", {
  id:        text("id").primaryKey().$defaultFn(() => nanoid()),
  name:      text("name").notNull(),
  code:      text("code").notNull(),  // 2-digit: "01", "02", "03"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const certificateSerialConfig = pgTable("certificate_serial_config", {
  key:       text("key").primaryKey(),   // "last_serial_number"
  value:     text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const certificateBatchStatusEnum = pgEnum("certificate_batch_status", [
  "active", "revised", "cancelled"
]);

export const certificateBatches = pgTable("certificate_batches", {
  id:                     text("id").primaryKey().$defaultFn(() => nanoid()),
  programId:              text("program_id").notNull()
                            .references(() => certificatePrograms.id),
  classTypeId:            text("class_type_id").notNull()
                            .references(() => certificateClassTypes.id),
  angkatan:               integer("angkatan").notNull(),
  quantityRequested:      integer("quantity_requested").notNull(),
  firstCertificateNumber: text("first_certificate_number").notNull(),
  lastCertificateNumber:  text("last_certificate_number").notNull(),
  status:                 certificateBatchStatusEnum("status").default("active").notNull(),
  notes:                  text("notes"),
  createdBy:              text("created_by"),
  createdAt:              timestamp("created_at").defaultNow().notNull(),
  updatedAt:              timestamp("updated_at").defaultNow().notNull(),
});

export const certificateItemStatusEnum = pgEnum("certificate_item_status", [
  "active", "cancelled"
]);

export const certificateItems = pgTable("certificate_items", {
  id:            text("id").primaryKey().$defaultFn(() => nanoid()),
  batchId:       text("batch_id").notNull()
                   .references(() => certificateBatches.id, { onDelete: "cascade" }),
  fullNumber:    text("full_number").notNull().unique(),
  angkatan:      integer("angkatan").notNull(),
  classTypeCode: text("class_type_code").notNull(),
  serialNumber:  integer("serial_number").notNull(),
  status:        certificateItemStatusEnum("status").default("active").notNull(),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
});
```

### Data Seed Awal

```sql
-- Seed serial config
INSERT INTO certificate_serial_config (key, value) VALUES ('last_serial_number', '0');

-- Seed program (sesuai kebutuhan IAI)
INSERT INTO certificate_programs (id, name) VALUES
  (nanoid(), 'Brevet AB'),
  (nanoid(), 'Brevet C'),
  (nanoid(), 'BFA');

-- Seed jenis kelas
INSERT INTO certificate_class_types (id, name, code) VALUES
  (nanoid(), 'Reguler Pagi', '01'),
  (nanoid(), 'Reguler Siang', '02'),
  (nanoid(), 'Weekend', '03');
```

### Checklist Fase 1

- [ ] Tambah tabel `certificate_programs`
- [ ] Tambah tabel `certificate_class_types`
- [ ] Tambah tabel `certificate_serial_config`
- [ ] Tambah tabel `certificate_batches`
- [ ] Tambah tabel `certificate_items`
- [ ] Jalankan `npx drizzle-kit generate`
- [ ] Review SQL yang digenerate
- [ ] Jalankan `npx drizzle-kit migrate`
- [ ] Seed data awal (serial config + program + jenis kelas)
- [ ] Verifikasi tabel muncul di DB

---

## Fase 2 — Server Actions

**Estimasi:** 1–2 hari  
**Direktori:** `src/server/actions/sertifikat/nomor/`

### 2.1 — `batches.ts`

| Fungsi | Aksi | Note |
|---|---|---|
| `listBatches(filter?)` | List batch dengan join program & classType | Filter: program, classType, angkatan, status |
| `getBatch(id)` | Detail batch + daftar certificate_items | |
| `generateBatch(data)` | Generate batch baru | Baca serial → hitung range → insert batch → insert items → update config |
| `updateBatchQuantity(id, newQty)` | Tambah/kurangi jumlah | Validasi: kurangi hanya untuk tail batch |
| `cancelBatch(id)` | Set status = `cancelled` di batch + semua items | Role: admin |
| `exportBatchToCsv(id)` | Return array items aktif | Client download |
| `getYearlyStats(year)` | Statistik per tahun per program & jenis kelas | |
| `getAvailableYears()` | List tahun yang ada di data | |

**Logika Generate Batch:**
```typescript
// Pseudocode generateBatch
async function generateBatch({ programId, classTypeId, classTypeCode, angkatan, quantity, userId }) {
  // 1. Baca serial terakhir dari certificate_serial_config
  const lastSerial = await getLastSerial();
  const startSerial = lastSerial + 1;
  const endSerial = startSerial + quantity - 1;

  // 2. Format nomor: {angkatan padded 3 digit}{kode_kelas}.{serial}
  const angkatanStr = angkatan.toString().padStart(3, "0");
  const firstNumber = `${angkatanStr}${classTypeCode}.${startSerial}`;
  const lastNumber  = `${angkatanStr}${classTypeCode}.${endSerial}`;

  // 3. Insert batch
  const batch = await db.insert(certificateBatches).values({ ... }).returning();

  // 4. Insert items satu per satu
  const items = [];
  for (let i = startSerial; i <= endSerial; i++) {
    items.push({ batchId: batch.id, fullNumber: `${angkatanStr}${classTypeCode}.${i}`, serialNumber: i, ... });
  }
  await db.insert(certificateItems).values(items);

  // 5. Update serial config
  await db.update(certificateSerialConfig).set({ value: String(endSerial) }).where(eq(...));

  // 6. Audit log
  await createAuditLog({ ... });
}
```

**Logika Edit Jumlah (Tail Batch Only):**
```typescript
// Validasi pengurangan
const batchMaxSerial = max(items.serialNumber);
const globalMaxSerial = max(all certificateItems.serialNumber);

if (batchMaxSerial !== globalMaxSerial) {
  throw new Error("Hanya batch terakhir yang bisa dikurangi jumlahnya.");
}
// Hapus items dari ekor, update serial config
```

### 2.2 — `programs.ts`

| Fungsi | Aksi | Role |
|---|---|---|
| `listCertificatePrograms()` | List semua program | semua |
| `createCertificateProgram(data)` | Buat program baru | admin |
| `updateCertificateProgram(id, data)` | Edit program | admin |
| `deleteCertificateProgram(id)` | Hapus (cek tidak ada batch) | admin |

### 2.3 — `classTypes.ts`

| Fungsi | Aksi | Role |
|---|---|---|
| `listCertificateClassTypes()` | List semua jenis kelas | semua |
| `createCertificateClassType(data)` | Buat jenis kelas (kode 2-digit unik) | admin |
| `updateCertificateClassType(id, data)` | Edit jenis kelas | admin |
| `deleteCertificateClassType(id)` | Hapus (cek tidak ada batch) | admin |
| `getSerialConfig()` | Baca `last_serial_number` | admin |
| `updateSerialConfig(value)` | Update serial (validasi tidak boleh mundur) | admin |

### Checklist Fase 2

- [ ] `batches.ts` (listBatches, getBatch, generateBatch, updateBatchQuantity, cancelBatch, exportBatchToCsv, getYearlyStats, getAvailableYears)
- [ ] `programs.ts` (CRUD)
- [ ] `classTypes.ts` (CRUD + serial config)
- [ ] Semua action menggunakan `requireRole()` / `requireSession()`
- [ ] Semua mutasi memanggil `createAuditLog()`
- [ ] Zod validation di semua action
- [ ] `revalidatePath("/sertifikat/nomor")` setelah mutasi

---

## Fase 3 — Komponen UI

**Estimasi:** 2 hari  
**Direktori:** `src/components/sertifikat/`

### 3.1 — `BatchTable.tsx`

**Fitur:**
- DataTable batch: Tanggal, Program, Angkatan, Jenis Kelas, Jumlah, Nomor Pertama–Terakhir, Dibuat Oleh, Status
- Filter: Program, Jenis Kelas, Status, Angkatan
- Tombol: "Generate Batch Baru" (link ke `/sertifikat/nomor/generate`)
- Navigasi ke detail batch

### 3.2 — `GenerateBatchForm.tsx`

**Fields:**
- `programId` — Select dari daftar program
- `angkatan` — Input number (3 digit, contoh: 223)
- `classTypeId` — Select dari daftar jenis kelas
- `quantity` — Input number (1–1000)

**Fitur:**
- Preview otomatis format nomor pertama dan terakhir
- Setelah submit: tampilkan ringkasan (nomor pertama–terakhir) + tabel daftar nomor + tombol Export CSV

### 3.3 — `BatchDetailView.tsx`

**Fitur:**
- Card info batch: Program, Angkatan, Jenis Kelas, Status, Jumlah Aktif, Nomor Pertama–Terakhir, Dibuat Oleh, Tanggal
- Tabel items: No, Nomor Sertifikat (font-mono), Serial Number, Status
- Tombol: **Export CSV** (download client-side), **Edit Jumlah** (buka Dialog)

### 3.4 — `BatchQuantityEditor.tsx`

**Fitur (Dialog):**
- Tampilkan jumlah aktif saat ini
- Input jumlah baru
- Peringatan jelas: kurangi hanya diizinkan untuk batch dengan serial tertinggi
- Tampilkan error dari server jika gagal validasi

### 3.5 — `YearlyReportView.tsx`

**Fitur:**
- Select tahun (dari `getAvailableYears()`)
- Stat cards: Total Sertifikat Aktif, Total Dibatalkan, Serial Pertama, Serial Terakhir
- Tabel rincian per Program × Jenis Kelas (kolom: Aktif, Dibatalkan, Total)
- Baris total di bawah tabel

### Checklist Fase 3

- [ ] `BatchTable.tsx` dengan filter
- [ ] `GenerateBatchForm.tsx` dengan preview nomor
- [ ] `BatchDetailView.tsx` dengan export CSV
- [ ] `BatchQuantityEditor.tsx` (Dialog)
- [ ] `YearlyReportView.tsx`

---

## Fase 4 — Routes & Pages

**Estimasi:** 0.5 hari  
**Direktori:** `src/app/(dashboard)/sertifikat/nomor/`

### Struktur File

```
sertifikat/nomor/
├── page.tsx           ← Server Component: fetch listBatches → render BatchTable
├── generate/
│   └── page.tsx       ← Server Component: fetch programs + classTypes → render GenerateBatchForm
├── [id]/
│   └── page.tsx       ← Server Component: fetch getBatch(id) → render BatchDetailView
└── rekap/
    └── page.tsx       ← Server Component: fetch getAvailableYears → render YearlyReportView
```

### Update Navigasi (`navigation.ts`)

Tambahkan di bawah section Sertifikat yang ada:

```typescript
{
  href: "/sertifikat/nomor",
  label: "Penomoran Sertifikat",
  icon: Hash,
  active: true,
  allowedRoles: ["admin", "staff"],
},
{
  href: "/sertifikat/nomor/rekap",
  label: "Rekap Tahunan",
  icon: BarChart2,
  active: true,
  allowedRoles: ["admin", "staff"],
},
```

### Checklist Fase 4

- [ ] `/sertifikat/nomor/page.tsx`
- [ ] `/sertifikat/nomor/generate/page.tsx`
- [ ] `/sertifikat/nomor/[id]/page.tsx`
- [ ] `/sertifikat/nomor/rekap/page.tsx`
- [ ] Update `navigation.ts` dengan link baru

---

## Fase 5 — Testing & QA

**Estimasi:** 0.5–1 hari

### Skenario Test Fungsional

#### Generate Batch
- [ ] Generate batch baru → nomor benar (melanjutkan serial terakhir)
- [ ] Generate 2 batch berturutan → tidak ada nomor tumpang tindih
- [ ] Preview format nomor di form sebelum submit

#### Edit Jumlah
- [ ] Tambah jumlah batch → nomor baru tergenerate melanjutkan serial global
- [ ] Kurangi jumlah batch **terakhir** → nomor ekor terhapus, serial config terupdate
- [ ] Kurangi jumlah batch **bukan terakhir** → error yang jelas muncul

#### Export & Laporan
- [ ] Export CSV batch → file terdownload dengan kolom yang benar (hanya status aktif)
- [ ] Rekap tahunan → data sesuai, filter tahun berfungsi

#### Admin & Pengaturan
- [ ] Pengaturan serial: update ke angka lebih kecil dari max → ditolak dengan pesan jelas
- [ ] CRUD Program → create/edit/delete berjalan
- [ ] CRUD Jenis Kelas → kode 2-digit unik

### Skenario Test Keamanan

- [ ] Staff tidak bisa akses halaman pengaturan serial/admin
- [ ] Viewer tidak bisa generate batch
- [ ] Bypass via server action (tanpa UI) → tetap ditolak oleh `requireRole()`

### Skenario Test Data Integrity

- [ ] Delete batch → cascade ke `certificate_items`
- [ ] `fullNumber` unique constraint → duplikat ditolak

### Test Audit Log

- [ ] Generate batch → tercatat di `/audit-log`
- [ ] Edit jumlah batch → tercatat di `/audit-log`
- [ ] Cancel batch → tercatat di `/audit-log`

### Checklist Fase 5

- [ ] Semua skenario fungsional lulus
- [ ] Semua skenario keamanan lulus
- [ ] Data integrity terjaga
- [ ] Audit log tercatat untuk semua mutasi
- [ ] Tidak ada regresi di modul existing (kegiatan, peserta, template, dll)

---

## Checklist Progress

### Fase 1 — Database Schema
- [x] `certificate_programs`
- [x] `certificate_class_types`
- [x] `certificate_serial_config`
- [x] `certificate_batches`
- [x] `certificate_items`
- [x] Migration generate & apply
- [ ] Data seed awal

### Fase 2 — Server Actions
- [x] `batches.ts`
- [x] `programs.ts`
- [x] `classTypes.ts`

### Fase 3 — Komponen UI
- [x] `BatchTable.tsx`
- [x] `GenerateBatchForm.tsx`
- [x] `BatchDetailView.tsx`
- [x] `BatchQuantityEditor.tsx`
- [x] `YearlyReportView.tsx`

### Fase 4 — Routes & Pages
- [x] `/sertifikat/nomor/page.tsx`
- [x] `/sertifikat/nomor/generate/page.tsx`
- [x] `/sertifikat/nomor/[id]/page.tsx`
- [x] `/sertifikat/nomor/rekap/page.tsx`
- [x] Update navigasi

### Fase 5 — Testing
- [ ] Semua skenario fungsional
- [ ] Semua skenario keamanan
- [ ] Audit log & data integrity
- [ ] Tidak ada regresi

---

## Catatan Adaptasi Teknis

| Aspek | Certificate Hub (Supabase) | Adaptasi (Drizzle + Next.js) |
|---|---|---|
| Data fetching | React Query + Supabase client | Next.js Server Actions + Server Components |
| Auth | Supabase Auth | Better Auth `requireRole()` |
| State management | React Query cache | `revalidatePath()` setelah mutasi |
| `system_config` | Tabel Supabase | Tabel `certificate_serial_config` (Drizzle) |
| Export CSV | `exportToCsv()` lib client | Server Action return data → client-side download |
| `creator_profile` | Join dari `profiles` | Join dari tabel `user` Better Auth |
| Real-time | Supabase realtime | Tidak diperlukan (Server Actions sudah cukup) |

---

## Referensi File Sumber

### Dari `C:\Users\evali\Downloads\certificate-hub-main\certificate-hub-main\`

| File Sumber | Dipakai Untuk |
|---|---|
| `src/pages/Dashboard.tsx` | Widget statistik di `/sertifikat/nomor` |
| `src/pages/BatchList.tsx` | `BatchTable.tsx` |
| `src/pages/BatchDetail.tsx` | `BatchDetailView.tsx` + `BatchQuantityEditor.tsx` |
| `src/pages/GenerateCertificates.tsx` | `GenerateBatchForm.tsx` |
| `src/pages/YearlyReport.tsx` | `YearlyReportView.tsx` |
| `src/pages/Admin.tsx` | CRUD Program & Jenis Kelas (masuk ke halaman Pengaturan) |
| `src/pages/Settings.tsx` | Pengaturan serial (masuk ke halaman Pengaturan) |
| `src/hooks/useCertificateBatches.ts` | Referensi logika generate & edit jumlah |
| `src/hooks/useSystemConfig.ts` | Referensi logika serial config |
| `src/lib/exportCsv.ts` | Referensi logika export CSV |
