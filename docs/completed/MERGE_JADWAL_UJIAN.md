# Rencana Merge: Jadwal Ujian (jadwal-aman) → Manajemen Persuratan

> **Status:** Perencanaan  
> **Versi Target:** Modul baru `/jadwal-ujian` terintegrasi penuh  
> **Estimasi Total:** ~8–12 hari kerja  
> **Dibuat:** 2026-04-26

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Pemetaan Fitur](#2-pemetaan-fitur)
3. [Arsitektur Target](#3-arsitektur-target)
4. [Fase 1 — Database Schema](#fase-1--database-schema)
5. [Fase 2 — Server Actions](#fase-2--server-actions)
6. [Fase 3 — Komponen UI](#fase-3--komponen-ui)
7. [Fase 4 — Routes & Pages](#fase-4--routes--pages)
8. [Fase 5 — Integrasi Sistem](#fase-5--integrasi-sistem)
9. [Fase 6 — Testing & QA](#fase-6--testing--qa)
10. [Checklist Progress](#checklist-progress)
11. [Referensi File Sumber](#referensi-file-sumber)

---

## 1. Ringkasan Eksekutif

**jadwal-aman** adalah sistem penjadwalan ujian berbasis React SPA + Supabase.  
**manajemen-persuratan** adalah sistem manajemen surat + kepegawaian + sertifikat berbasis Next.js + Drizzle + Neon.

Tujuan merge: mengintegrasikan seluruh fitur jadwal ujian ke dalam sistem utama sebagai modul baru `/jadwal-ujian`, menggunakan infrastruktur yang sudah ada (auth, DB, storage, navigasi, audit log).

### Yang TIDAK diambil dari jadwal-aman

| Komponen | Alasan |
|---|---|
| Supabase Auth | Diganti Better Auth yang sudah ada |
| Supabase client / `@supabase/supabase-js` | Diganti Drizzle ORM |
| Supabase Storage bucket | Diganti sistem storage existing (local/Cloudinary) |
| `lovable-tagger` plugin | Dependency dev Lovable.dev, tidak relevan |
| App settings (nama institusi, logo) | Sudah ada di `systemSettings` |
| `useAuth()` hook | Diganti session dari Better Auth |

---

## 2. Pemetaan Fitur

### Fitur yang Di-merge (Baru)

| Halaman jadwal-aman | Route baru | Keterangan |
|---|---|---|
| `Dashboard.tsx` | `/jadwal-ujian` | List + CRUD jadwal ujian |
| `Pengawas.tsx` | `/jadwal-ujian/pengawas` | Manajemen pengawas |
| `Kelas.tsx` | `/jadwal-ujian/kelas` | Manajemen kelas |
| `JadwalPengawas.tsx` | `/jadwal-ujian/penugasan` | Penugasan pengawas + conflict detection |
| `BebanKerja.tsx` | `/jadwal-ujian/beban-kerja` | Workload analytics pengawas |
| `DashboardStats.tsx` | Widget di `/dashboard` | Statistik ujian hari ini / minggu ini |

### Fitur yang Diintegrasikan ke Modul Existing

| Fitur jadwal-aman | Modul existing | Tindakan |
|---|---|---|
| Kalender ujian | `/kalender` | Tambah tipe event `ujian` |
| Statistik dashboard | `/dashboard` | Tambah widget jadwal ujian |
| Settings institusi | `/pengaturan` | Tidak perlu duplikasi |
| Excel import/export | Sudah ada `xlsx` | Port logika import ujian |

---

## 3. Arsitektur Target

```
src/
├── app/(dashboard)/jadwal-ujian/
│   ├── page.tsx                    ← List + create jadwal ujian
│   ├── [id]/page.tsx               ← Detail & edit ujian
│   ├── pengawas/
│   │   └── page.tsx
│   ├── kelas/
│   │   └── page.tsx
│   ├── penugasan/
│   │   └── page.tsx
│   └── beban-kerja/
│       └── page.tsx
│
├── components/jadwal-ujian/
│   ├── UjianTable.tsx
│   ├── UjianForm.tsx
│   ├── PengawasManager.tsx
│   ├── KelasManager.tsx
│   ├── PenugasanManager.tsx
│   ├── ConflictBadge.tsx
│   ├── BebanKerjaChart.tsx
│   ├── UjianExportButton.tsx
│   └── UjianImportDialog.tsx
│
└── server/actions/jadwal-ujian/
    ├── pengawas.ts
    ├── kelas.ts
    ├── ujian.ts
    ├── penugasan.ts
    └── bebanKerja.ts
```

### Stack yang Digunakan (tidak ada dependency baru)

| Kebutuhan | Library yang sudah ada |
|---|---|
| Data fetching | Next.js Server Actions |
| ORM | Drizzle ORM |
| UI components | shadcn/ui (Radix) yang sudah ada |
| Charts | Recharts (sudah ada) |
| Excel export | xlsx (sudah ada) |
| Form | react-hook-form + Zod (sudah ada) |
| Auth | Better Auth `requireSession()` |
| Audit | `createAuditLog()` yang sudah ada |

---

## Fase 1 — Database Schema

**Estimasi:** 1 hari  
**File:** `src/server/db/schema.ts` + migration baru

### 1.1 — Enum Baru

```typescript
// Di schema.ts — tambah setelah enum existing

export const programKelasEnum = pgEnum("program_kelas", [
  "Brevet AB",
  "Brevet C",
  "BFA",
  "Lainnya",
]);

export const tipeKelasEnum = pgEnum("tipe_kelas", [
  "Reguler Pagi",
  "Reguler Siang",
  "Reguler Sore",
  "Weekend",
]);

export const modeKelasEnum = pgEnum("mode_kelas", [
  "Offline",
  "Online",
]);
```

### 1.2 — Tabel Baru

```typescript
// ─── JADWAL UJIAN ────────────────────────────────────────────────────────────

export const pengawas = pgTable("pengawas", {
  id:        text("id").primaryKey().$defaultFn(() => nanoid()),
  nama:      text("nama").notNull(),
  catatan:   text("catatan"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const kelasUjian = pgTable("kelas_ujian", {
  id:        text("id").primaryKey().$defaultFn(() => nanoid()),
  namaKelas: text("nama_kelas").notNull(),
  program:   programKelasEnum("program").notNull(),
  tipe:      tipeKelasEnum("tipe").notNull(),
  mode:      modeKelasEnum("mode").notNull(),
  lokasi:    text("lokasi"),
  catatan:   text("catatan"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const jadwalUjian = pgTable("jadwal_ujian", {
  id:          text("id").primaryKey().$defaultFn(() => nanoid()),
  kelasId:     text("kelas_id").notNull().references(() => kelasUjian.id, { onDelete: "cascade" }),
  mataPelajaran: text("mata_pelajaran").notNull(),
  tanggalUjian: date("tanggal_ujian").notNull(),
  jamMulai:    text("jam_mulai").notNull(),       // format HH:MM
  jamSelesai:  text("jam_selesai").notNull(),      // format HH:MM
  catatan:     text("catatan"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});

export const penugasanPengawas = pgTable(
  "penugasan_pengawas",
  {
    id:          text("id").primaryKey().$defaultFn(() => nanoid()),
    ujianId:     text("ujian_id").notNull().references(() => jadwalUjian.id, { onDelete: "cascade" }),
    pengawasId:  text("pengawas_id").notNull().references(() => pengawas.id, { onDelete: "cascade" }),
    konflik:     boolean("konflik").default(false).notNull(),
    createdAt:   timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uniq_ujian_pengawas").on(t.ujianId, t.pengawasId),
  ],
);
```

### 1.3 — Generate & Apply Migration

```bash
# Setelah edit schema.ts
npx drizzle-kit generate
npx drizzle-kit migrate
```

> Nama migration yang diharapkan: `0011_jadwal_ujian.sql`

### Checklist Fase 1

- [ ] Tambah 3 enum baru ke `schema.ts`
- [ ] Tambah tabel `pengawas`
- [ ] Tambah tabel `kelas_ujian`
- [ ] Tambah tabel `jadwal_ujian`
- [ ] Tambah tabel `penugasan_pengawas` dengan unique index
- [ ] Jalankan `drizzle-kit generate`
- [ ] Review file SQL yang digenerate
- [ ] Jalankan `drizzle-kit migrate`
- [ ] Verifikasi tabel muncul di DB

---

## Fase 2 — Server Actions

**Estimasi:** 2–3 hari  
**Direktori:** `src/server/actions/jadwal-ujian/`

### 2.1 — `pengawas.ts`

```typescript
"use server";
// Operasi: getPengawas, createPengawas, updatePengawas, deletePengawas
// Guard: requireSession()
// Audit: createAuditLog() untuk create/update/delete
// Validasi: Zod schema { nama: z.string().min(2), catatan: z.string().optional() }
```

**Fungsi yang diekspos:**
| Fungsi | Aksi | Role |
|---|---|---|
| `getPengawas()` | List semua pengawas | semua |
| `createPengawas(data)` | Insert pengawas baru | admin, staff |
| `updatePengawas(id, data)` | Update pengawas | admin, staff |
| `deletePengawas(id)` | Delete (cek apakah ada penugasan aktif) | admin |

### 2.2 — `kelas.ts`

```typescript
"use server";
// Operasi: getKelas, createKelas, updateKelas, deleteKelas
// Guard: requireSession()
// Validasi: Zod schema lengkap (namaKelas, program, tipe, mode, lokasi?, catatan?)
```

**Fungsi yang diekspos:**
| Fungsi | Aksi | Role |
|---|---|---|
| `getKelas(filter?)` | List kelas (filter by program/tipe/mode) | semua |
| `createKelas(data)` | Insert kelas | admin, staff |
| `updateKelas(id, data)` | Update kelas | admin, staff |
| `deleteKelas(id)` | Delete (cek apakah ada ujian terkait) | admin |

### 2.3 — `ujian.ts`

```typescript
"use server";
// Operasi: getUjian, getUjianById, createUjian, updateUjian, deleteUjian
// Join: include kelasUjian, include penugasanPengawas (dengan data pengawas)
// Guard: requireSession()
// Validasi: Zod schema (kelasId, mataPelajaran, tanggalUjian, jamMulai, jamSelesai)
```

**Fungsi yang diekspos:**
| Fungsi | Aksi | Note |
|---|---|---|
| `getUjian(filter?)` | List ujian (filter: tanggal, kelas, program) | include join kelas |
| `getUjianById(id)` | Detail + daftar pengawas bertugas | |
| `createUjian(data)` | Insert ujian baru | trigger revalidatePath |
| `updateUjian(id, data)` | Update ujian | |
| `deleteUjian(id)` | Delete (cascade ke penugasan) | |
| `exportUjianToExcel(filter?)` | Generate XLSX buffer | return ke client |

### 2.4 — `penugasan.ts`

```typescript
"use server";
// Operasi: getPenugasan, assignPengawas, unassignPengawas, detectConflicts
// Conflict detection: cek overlap waktu ujian per pengawas pada tanggal yang sama
// Guard: requireSession()
```

**Fungsi yang diekspos:**
| Fungsi | Aksi | Note |
|---|---|---|
| `getPenugasanByUjian(ujianId)` | List pengawas bertugas di ujian | |
| `getPenugasanByPengawas(pengawasId, filter?)` | Jadwal per pengawas | untuk view JadwalPengawas |
| `assignPengawas(ujianId, pengawasId)` | Tugaskan pengawas | auto-detect conflict |
| `unassignPengawas(penugasanId)` | Hapus penugasan | |
| `detectConflicts(pengawasId, tanggal)` | Cek overlap waktu | gunakan untuk flag `konflik` |

**Logika conflict detection:**
```typescript
// Pseudocode
async function detectConflicts(pengawasId: string, ujianBaru: { tanggal, jamMulai, jamSelesai }) {
  const penugasanHariIni = await db.query.penugasanPengawas.findMany({
    where: eq(penugasanPengawas.pengawasId, pengawasId),
    with: {
      ujian: {
        where: eq(jadwalUjian.tanggalUjian, ujianBaru.tanggal)
      }
    }
  });

  return penugasanHariIni.some(p => {
    // overlap: A.mulai < B.selesai && A.selesai > B.mulai
    return p.ujian.jamMulai < ujianBaru.jamSelesai 
        && p.ujian.jamSelesai > ujianBaru.jamMulai;
  });
}
```

### 2.5 — `bebanKerja.ts`

```typescript
"use server";
// Agregasi: count penugasan per pengawas dalam rentang periode
// Filter: bulan/tahun, program kelas
// Return: array { pengawas: { id, nama }, jumlahTugas: number, ujianList: [...] }
```

**Fungsi yang diekspos:**
| Fungsi | Return |
|---|---|
| `getBebanKerja(filter: { bulan?, tahun?, programKelas? })` | Workload per pengawas |
| `getStatistikUjian()` | Stat untuk dashboard widget (hari ini, minggu, upcoming) |

### Checklist Fase 2

- [ ] Buat `src/server/actions/jadwal-ujian/pengawas.ts`
- [ ] Buat `src/server/actions/jadwal-ujian/kelas.ts`
- [ ] Buat `src/server/actions/jadwal-ujian/ujian.ts`
- [ ] Buat `src/server/actions/jadwal-ujian/penugasan.ts` dengan conflict detection
- [ ] Buat `src/server/actions/jadwal-ujian/bebanKerja.ts`
- [ ] Semua action menggunakan `requireSession()`
- [ ] Semua mutasi memanggil `createAuditLog()`
- [ ] Zod validation di setiap action
- [ ] `revalidatePath("/jadwal-ujian")` setelah mutasi

---

## Fase 3 — Komponen UI

**Estimasi:** 2–3 hari  
**Direktori:** `src/components/jadwal-ujian/`  
**Referensi sumber:** `jadwal-aman-main/src/pages/`

### 3.1 — `PengawasManager.tsx`

Adaptasi dari `Pengawas.tsx` (jadwal-aman).

**Fitur:**
- DataTable pengawas (nama, jumlah tugas, catatan, aksi)
- Dialog create/edit pengawas (Form + Zod)
- Delete dengan konfirmasi
- Validasi: tidak bisa hapus jika ada penugasan aktif

**Komponen shadcn yang digunakan:**
`Table`, `Dialog`, `Button`, `Input`, `Textarea`, `Badge`

### 3.2 — `KelasManager.tsx`

Adaptasi dari `Kelas.tsx` (jadwal-aman).

**Fitur:**
- DataTable kelas (namaKelas, program, tipe, mode, lokasi)
- Filter by program, tipe, mode
- Dialog create/edit (Select untuk enum fields)
- Delete dengan konfirmasi

**Komponen shadcn:** `Table`, `Dialog`, `Select`, `Input`, `Badge`

### 3.3 — `UjianTable.tsx`

Adaptasi dari `Dashboard.tsx` (jadwal-aman).

**Fitur:**
- DataTable jadwal ujian dengan kolom: tanggal, kelas, mata pelajaran, jam, jumlah pengawas, status konflik
- Filter: range tanggal, kelas, program
- Sort by tanggal
- Pagination
- Tombol: tambah, edit, hapus, lihat penugasan
- Export Excel

**Komponen shadcn:** `Table`, `DatePicker`, `Select`, `Button`, `Badge`

### 3.4 — `UjianForm.tsx`

Form create/edit jadwal ujian (dipakai di Dialog dan halaman detail).

**Fields:**
- `kelasId` — Select dari daftar kelas
- `mataPelajaran` — Input text
- `tanggalUjian` — DatePicker
- `jamMulai` / `jamSelesai` — Input time (HH:MM)
- `catatan` — Textarea (opsional)

### 3.5 — `PenugasanManager.tsx`

Adaptasi dari `JadwalPengawas.tsx` (jadwal-aman).

**Fitur:**
- View penugasan per ujian (list pengawas yang bertugas)
- View jadwal per pengawas (semua ujian yang ditugaskan)
- Assign/unassign pengawas dengan feedback conflict
- `ConflictBadge.tsx` — badge merah jika `konflik = true`
- Export jadwal pengawas ke Excel

### 3.6 — `BebanKerjaChart.tsx`

Adaptasi dari `BebanKerja.tsx` (jadwal-aman). Recharts sudah tersedia.

**Fitur:**
- BarChart: jumlah penugasan per pengawas
- Filter periode: bulan + tahun
- Filter program kelas
- Tabel detail bawah chart

### 3.7 — `UjianImportDialog.tsx`

Adaptasi logika import Excel dari `Dashboard.tsx` (jadwal-aman).

**Fitur:**
- Upload file `.xlsx`
- Preview data sebelum import
- Validasi kolom (kelas, mataPelajaran, tanggal, jam)
- Bulk insert via server action `importUjianFromExcel(rows[])`

### 3.8 — Widget Dashboard

Komponen kecil untuk ditambahkan ke `/dashboard` existing:

```tsx
// src/components/jadwal-ujian/UjianDashboardWidget.tsx
// Menampilkan: ujian hari ini, ujian minggu ini, total pengawas aktif
// Data dari: getStatistikUjian() server action
```

### Checklist Fase 3

- [ ] `PengawasManager.tsx` dengan CRUD dialog
- [ ] `KelasManager.tsx` dengan CRUD dialog + filter
- [ ] `UjianTable.tsx` dengan filter, sort, pagination
- [ ] `UjianForm.tsx` (dipakai di Dialog)
- [ ] `PenugasanManager.tsx` dengan conflict badge
- [ ] `ConflictBadge.tsx`
- [ ] `BebanKerjaChart.tsx` (Recharts)
- [ ] `UjianImportDialog.tsx` (Excel import)
- [ ] `UjianExportButton.tsx` (Excel export)
- [ ] `UjianDashboardWidget.tsx`

---

## Fase 4 — Routes & Pages

**Estimasi:** 1 hari  
**Direktori:** `src/app/(dashboard)/jadwal-ujian/`

### 4.1 — Struktur File

```
src/app/(dashboard)/jadwal-ujian/
├── page.tsx                    ← Daftar jadwal ujian + toolbar import/export
├── [id]/
│   └── page.tsx                ← Detail ujian + manajemen penugasan
├── pengawas/
│   └── page.tsx                ← CRUD pengawas
├── kelas/
│   └── page.tsx                ← CRUD kelas
├── penugasan/
│   └── page.tsx                ← View jadwal per pengawas
└── beban-kerja/
    └── page.tsx                ← Workload analytics
```

### 4.2 — `page.tsx` (Daftar Ujian)

```tsx
// Server Component
// - Fetch ujian list dengan getUjian()
// - Render UjianTable + UjianImportDialog + UjianExportButton
// - PageHeader "Jadwal Ujian" dengan tombol "Tambah Ujian"
```

### 4.3 — `[id]/page.tsx` (Detail Ujian)

```tsx
// Server Component
// - Fetch getUjianById(id)
// - Render detail ujian (tanggal, kelas, jam)
// - Render PenugasanManager (list + assign pengawas)
// - Breadcrumb: Jadwal Ujian > [Mata Pelajaran]
```

### 4.4 — `pengawas/page.tsx`

```tsx
// Server Component
// - Fetch getPengawas()
// - Render PengawasManager
// - PageHeader "Daftar Pengawas"
```

### 4.5 — `kelas/page.tsx`

```tsx
// Server Component
// - Fetch getKelas()
// - Render KelasManager
// - PageHeader "Daftar Kelas"
```

### 4.6 — `penugasan/page.tsx`

```tsx
// Server Component
// - Fetch getPengawas() untuk pilih pengawas
// - Render PenugasanManager dalam mode "per pengawas"
// - Filter: pilih pengawas, filter tanggal
```

### 4.7 — `beban-kerja/page.tsx`

```tsx
// Server Component
// - Fetch getBebanKerja({ bulan, tahun })
// - Render BebanKerjaChart
// - Filter state di client component
```

### Checklist Fase 4

- [ ] Buat folder `src/app/(dashboard)/jadwal-ujian/`
- [ ] `page.tsx` (list ujian)
- [ ] `[id]/page.tsx` (detail + penugasan)
- [ ] `pengawas/page.tsx`
- [ ] `kelas/page.tsx`
- [ ] `penugasan/page.tsx`
- [ ] `beban-kerja/page.tsx`
- [ ] Setiap page punya `PageHeader` yang konsisten dengan halaman lain

---

## Fase 5 — Integrasi Sistem

**Estimasi:** 1–2 hari

### 5.1 — Navigasi

Edit `src/components/layout/navigation.ts` — tambah section baru:

```typescript
{
  title: "Jadwal Ujian",
  items: [
    {
      href: "/jadwal-ujian",
      label: "Jadwal Ujian",
      icon: ClipboardList,   // dari lucide-react
      active: true,
      allowedRoles: ["admin", "staff"],
    },
    {
      href: "/jadwal-ujian/penugasan",
      label: "Jadwal Pengawas",
      icon: UserCheck,
      active: true,
    },
    {
      href: "/jadwal-ujian/beban-kerja",
      label: "Beban Kerja",
      icon: BarChart2,
      active: true,
      allowedRoles: ["admin", "staff"],
    },
    {
      href: "/jadwal-ujian/pengawas",
      label: "Pengawas",
      icon: Users,
      active: true,
      allowedRoles: ["admin"],
    },
    {
      href: "/jadwal-ujian/kelas",
      label: "Kelas",
      icon: BookOpen,
      active: true,
      allowedRoles: ["admin"],
    },
  ],
},
```

### 5.2 — Kalender

Edit `src/server/db/schema.ts` — extend enum `jenis_calendar_event` (atau kolom `type` di `calendarEvents`):

Tambah nilai: `"ujian"` ke type yang ada, sehingga jadwal ujian bisa muncul di halaman `/kalender`.

Di server action kalender, tambah query join ke `jadwal_ujian` untuk mengambil event ujian dan menampilkannya bersama event lain.

### 5.3 — Dashboard Widget

Edit halaman `src/app/(dashboard)/dashboard/page.tsx`:

- Import `UjianDashboardWidget`
- Tambah ke grid statistik existing
- Data dari `getStatistikUjian()` (server action baru)

```tsx
// Di dashboard/page.tsx
const statistikUjian = await getStatistikUjian();

// Di JSX
<UjianDashboardWidget data={statistikUjian} />
```

### 5.4 — Audit Log

Setiap server action di Fase 2 harus memanggil `createAuditLog()` yang sudah ada:

```typescript
await createAuditLog({
  userId: session.user.id,
  action: "CREATE",           // CREATE | UPDATE | DELETE
  entity: "jadwal_ujian",     // atau "pengawas", "kelas", "penugasan_pengawas"
  entityId: ujian.id,
  detail: { mataPelajaran, tanggalUjian },
});
```

### 5.5 — Role-Based Access Control

Menggunakan sistem RBAC existing di Better Auth:

| Role | Pengawas | Kelas | Ujian | Penugasan | Beban Kerja |
|---|---|---|---|---|---|
| admin | CRUD | CRUD | CRUD | CRUD | Read |
| staff | Read | Read | Read/Create | Read/Create | Read |
| pejabat | - | - | Read | Read | Read |
| viewer | - | - | Read | - | - |

Implementasi via `requireRole(["admin", "staff"])` di setiap server action mutasi.

### Checklist Fase 5

- [ ] Update `navigation.ts` dengan section "Jadwal Ujian"
- [ ] Tambah icon baru yang dibutuhkan dari lucide-react
- [ ] Extend kalender: tambah tipe event `ujian`
- [ ] Update `/dashboard` dengan `UjianDashboardWidget`
- [ ] Verify `createAuditLog()` terpanggil di semua mutasi
- [ ] Test RBAC: semua role sesuai tabel di atas
- [ ] Cek bahwa navigasi muncul sesuai role

---

## Fase 6 — Testing & QA

**Estimasi:** 1–2 hari

### 6.1 — Skenario Test Fungsional

#### Manajemen Pengawas
- [ ] Tambah pengawas baru → muncul di tabel
- [ ] Edit nama pengawas → tersimpan
- [ ] Hapus pengawas tanpa penugasan → berhasil
- [ ] Hapus pengawas yang punya penugasan → error yang jelas

#### Manajemen Kelas
- [ ] Tambah kelas dengan semua field → muncul di tabel
- [ ] Filter kelas by program → hanya tampil kelas yang sesuai
- [ ] Hapus kelas yang ada ujian → error yang jelas

#### Jadwal Ujian
- [ ] Tambah ujian dengan kelas, tanggal, jam → muncul di tabel
- [ ] Edit jam ujian → tersimpan
- [ ] Filter ujian by tanggal range → hasil sesuai
- [ ] Export Excel → file terdownload dengan data yang benar
- [ ] Import Excel → data masuk ke DB

#### Penugasan Pengawas
- [ ] Assign pengawas ke ujian → muncul di daftar penugasan
- [ ] Assign pengawas yang sudah bertugas di jam yang sama → `konflik = true`, badge merah
- [ ] Assign pengawas di ujian yang tidak overlap → tidak ada konflik
- [ ] Unassign pengawas → hilang dari daftar

#### Beban Kerja
- [ ] Buka halaman beban kerja → chart muncul
- [ ] Filter bulan/tahun → data chart berubah
- [ ] Pengawas dengan 0 tugas → muncul dengan bar 0

#### Kalender
- [ ] Ujian muncul di halaman kalender pada tanggal yang tepat
- [ ] Klik event ujian di kalender → navigasi ke detail ujian

#### Dashboard
- [ ] Widget "Ujian Hari Ini" menampilkan jumlah yang benar
- [ ] Widget "Ujian Minggu Ini" menampilkan jumlah yang benar

### 6.2 — Skenario Test Keamanan

- [ ] Staff tidak bisa mengakses `/jadwal-ujian/kelas` (redirect atau 403)
- [ ] Viewer tidak bisa create ujian
- [ ] Akses tanpa login → redirect ke `/login`
- [ ] RBAC konsisten antara UI (tombol hidden) dan server action (error jika bypass)

### 6.3 — Skenario Test Data Integrity

- [ ] Delete kelas → semua ujian terkait ikut terhapus (cascade)
- [ ] Delete ujian → semua penugasan ikut terhapus (cascade)
- [ ] Unique constraint: assign pengawas yang sama ke ujian yang sama → error unique

### 6.4 — Test Audit Log

- [ ] Create pengawas → muncul di `/audit-log`
- [ ] Delete ujian → muncul di `/audit-log` dengan detail

### Checklist Fase 6

- [ ] Semua skenario test fungsional lulus
- [ ] Semua skenario test keamanan lulus
- [ ] Data integrity terjaga (cascade delete berjalan)
- [ ] Audit log tercatat untuk semua mutasi
- [ ] Tidak ada regresi di modul existing (surat, sertifikat, kalender)

---

## Checklist Progress

Gunakan tanda `[x]` untuk menandai selesai.

### Fase 1 — Database Schema
- [x] Enum: `program_kelas`, `tipe_kelas`, `mode_kelas`
- [x] Tabel: `pengawas`
- [x] Tabel: `kelas_ujian`
- [x] Tabel: `jadwal_ujian`
- [x] Tabel: `penugasan_pengawas`
- [x] Migration generate & apply (`0012_sloppy_loners.sql`)

### Fase 2 — Server Actions
- [x] `pengawas.ts`
- [x] `kelas.ts`
- [x] `ujian.ts` (termasuk export Excel)
- [x] `penugasan.ts` (termasuk conflict detection)
- [x] `bebanKerja.ts`

### Fase 3 — Komponen UI
- [x] `PengawasManager.tsx` + `PengawasForm.tsx`
- [x] `KelasManager.tsx` + `KelasForm.tsx`
- [x] `UjianTable.tsx`
- [x] `UjianForm.tsx`
- [x] `PenugasanManager.tsx`
- [x] `ConflictBadge.tsx`
- [x] `BebanKerjaChart.tsx`
- [ ] `UjianImportDialog.tsx` ← ditunda ke iterasi berikutnya
- [x] `UjianExportButton.tsx`
- [x] `UjianDashboardWidget.tsx`

### Fase 4 — Routes & Pages
- [x] `/jadwal-ujian/page.tsx`
- [x] `/jadwal-ujian/[id]/page.tsx`
- [x] `/jadwal-ujian/pengawas/page.tsx`
- [x] `/jadwal-ujian/kelas/page.tsx`
- [x] `/jadwal-ujian/penugasan/page.tsx` + `JadwalPengawasView.tsx`
- [x] `/jadwal-ujian/beban-kerja/page.tsx`

### Fase 5 — Integrasi
- [x] Navigasi diupdate (section "Jadwal Ujian" dengan 5 item)
- [ ] Kalender diextend ← ditunda, gunakan `other` type + entitasType marker
- [x] Dashboard widget ditambah (`UjianDashboardWidget` di grid MetricCard)
- [x] Audit log terhubung (semua mutasi memanggil `auditLog`)
- [x] RBAC diterapkan (`requireRole` di setiap action mutasi)

### Fase 6 — Testing & QA
- [ ] Test fungsional semua modul
- [ ] Test keamanan & RBAC
- [ ] Test data integrity
- [ ] Test audit log
- [ ] Test tidak ada regresi

---

## Referensi File Sumber

### Dari `D:\Test Coding APP\jadwal-aman-main\`

| File Sumber | Dipakai Untuk |
|---|---|
| `src/pages/Dashboard.tsx` | Referensi UI `UjianTable.tsx` + logika import/export |
| `src/pages/Pengawas.tsx` | Referensi UI `PengawasManager.tsx` |
| `src/pages/Kelas.tsx` | Referensi UI `KelasManager.tsx` |
| `src/pages/JadwalPengawas.tsx` | Referensi UI `PenugasanManager.tsx` |
| `src/pages/BebanKerja.tsx` | Referensi UI `BebanKerjaChart.tsx` |
| `src/pages/DashboardStats.tsx` | Referensi UI `UjianDashboardWidget.tsx` |
| `supabase/migrations/*.sql` | Referensi struktur tabel (ditranslasi ke Drizzle) |

### Di `D:\Test Coding APP\manajemen-persuratan\`

| File Existing | Dimodifikasi Pada Fase |
|---|---|
| `src/server/db/schema.ts` | Fase 1 |
| `src/components/layout/navigation.ts` | Fase 5 |
| `src/app/(dashboard)/dashboard/page.tsx` | Fase 5 |
| `src/app/(dashboard)/kalender/` | Fase 5 |
| `src/server/actions/auditLog.ts` | Fase 2 (dipakai, tidak diubah) |
| `src/server/actions/auth.ts` | Fase 2 (dipakai, tidak diubah) |
| `drizzle/migrations/` | Fase 1 (tambah file baru) |

---

*Dokumen ini diperbarui seiring progress pengerjaan. Tandai checklist setiap item selesai.*
