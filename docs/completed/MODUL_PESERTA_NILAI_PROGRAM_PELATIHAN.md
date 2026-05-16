# Modul Peserta & Nilai — Program Pelatihan

> **Status:** ✅ SELESAI — Implementasi + Post-review Bug Fixes
> **Depends on:** Integrasi Jadwal Otomatis → Ujian selesai (lihat `INTEGRASI_JADWAL_OTOMATIS_UJIAN.md`)
> **Target program:** Brevet AB, Brevet C, BFA
> **Dibuat:** 2026-04-30
> **Implementasi selesai:** 2026-05-01 (DeepSeek agent)
> **Bug fixes selesai:** 2026-05-02 (post-review Claude Sonnet 4.6)

---

## Daftar Isi

1. [Konteks & Tujuan](#1-konteks--tujuan)
2. [Business Rules](#2-business-rules)
3. [Gap Analysis Schema](#3-gap-analysis-schema)
4. [Target Arsitektur](#4-target-arsitektur)
5. [Fase 1 — Schema & Migration](#fase-1--schema--migration)
6. [Fase 2 — Server Actions & Logic](#fase-2--server-actions--logic)
7. [Fase 3 — UI](#fase-3--ui)
8. [Navigasi (Opsi B)](#navigasi-opsi-b)
9. [Out of Scope](#out-of-scope)
10. [Checklist Progress](#checklist-progress)

---

## 1. Konteks & Tujuan

### Kondisi Sekarang

Seluruh pencatatan peserta, absensi, dan nilai program pelatihan dilakukan **manual di Excel**. Alur saat ini:

```
Peserta ikut kelas pelatihan
        ↓
Absensi dicatat di Excel (per sesi, per peserta)
        ↓
Peserta ikut ujian
        ↓
Nilai dicatat di Excel (per mata ujian, per peserta)
        ↓
Rekap dihitung manual
        ↓
Data diserahkan ke admin → sertifikat diterbitkan sistem pusat
```

### Masalah

- Rawan human error (typo, formula salah, file versi berbeda)
- Tidak ada validasi otomatis status kelulusan
- Ujian susulan dan perbaikan tidak terlacak sistematis
- Export ke pusat = rekap ulang dari Excel

### Tujuan

Digitalisasi seluruh alur di atas ke dalam sistem. Output akhir: rekap otomatis dengan status per peserta yang siap di-export untuk dikirim ke pusat.

---

## 2. Business Rules

### 2.1 Kehadiran Pelatihan

```
Total sesi = jumlah classSessions (isExamDay = false) pada kelas tersebut
Sesi hadir = jumlah absensi peserta dengan status hadir
Persentase = (sesi hadir / total sesi) × 100

IF persentase < 60% → status akhir = "Telah Mengikuti" (alasan: kehadiran)
```

Sesi yang dibatalkan (status = cancelled) **tidak dihitung** dalam total sesi.  
Sesi makeup (makeupSessions) yang dihadiri **dihitung** sebagai pengganti sesi asli.

### 2.2 Kehadiran Ujian

Dicatat terpisah per jadwal ujian. Peserta tidak hadir ujian tanpa ujian susulan yang valid = nilai otomatis tidak ada (bukan D — kosong, pending).

### 2.3 Nilai Ujian

- Skala nilai: **A, B, C, D** (per mata pelajaran per jadwal ujian)
- Nilai D pada satu atau lebih mata pelajaran → peserta dapat mengajukan **ujian perbaikan**
- Jika tidak mengajukan perbaikan dalam batas waktu → status akhir = "Telah Mengikuti" (alasan: nilai)

### 2.4 Ujian Susulan

Peserta tidak dapat hadir ujian pada hari H → dapat mengajukan ujian susulan:

```
1. Peserta/admin input permohonan susulan + tanggal usulan
2. Admin review → setujui tanggal pelaksanaan
3. Peserta ikut ujian susulan
4. Nilai diinput seperti ujian biasa
5. Status absensi ujian original → "susulan" (bukan tidak hadir)
```

> Berbeda dengan `makeupSessions` di schema — itu untuk pergeseran sesi instruktur (force majeure kelas), bukan ujian susulan peserta.

### 2.5 Ujian Perbaikan

Peserta mendapat nilai D → dapat mengajukan perbaikan:

```
1. Identifikasi: nilai D pada mata pelajaran X
2. Ajukan permohonan ujian perbaikan
3. Admin setujui jadwal perbaikan
4. Peserta ikut ujian perbaikan
5. Nilai baru diinput → menggantikan nilai D
6. Jika nilai baru ≥ C → mata pelajaran itu lolos
```

### 2.6 Kalkulasi Status Akhir

```
IF kehadiran_pelatihan < 60%:
    → "Telah Mengikuti" (alasan: kehadiran)

ELSE IF ada nilai D AND tidak ada perbaikan yang selesai untuk mata pelajaran tersebut:
    → "Telah Mengikuti" (alasan: nilai)

ELSE IF semua nilai ≥ C (atau perbaikan selesai):
    → "Lulus"

ELSE:
    → "Dalam Proses" (nilai belum semua diinput)
```

Status disimpan di DB (cached), dikalkulasi ulang setiap kali:
- Absensi diubah
- Nilai diinput/diubah
- Ujian perbaikan selesai

---

## 3. Gap Analysis Schema

### Yang sudah ada (relevan)

| Table | Kegunaan | Cukup? |
|-------|----------|--------|
| `kelasPelatihan` | Kelas pelatihan | Ya |
| `classSessions` | Sesi pelatihan + ujian | Ya — dipakai sebagai basis absensi pelatihan |
| `jadwalUjian` | Jadwal ujian (post-integrasi) | Ya — dipakai sebagai basis absensi & nilai ujian |
| `makeupSessions` | Makeup sesi instruktur | **Bukan untuk peserta** — tidak bisa dipakai |
| `participants` | Peserta event sertifikat DKI | **Konteks berbeda** — tidak bisa dipakai |

### Yang belum ada (perlu dibuat)

| Kebutuhan | Status |
|-----------|--------|
| Daftar peserta per kelas pelatihan | ❌ Belum ada |
| Absensi per sesi per peserta | ❌ Belum ada |
| Absensi ujian per jadwal ujian per peserta | ❌ Belum ada |
| Nilai per mata pelajaran per ujian per peserta | ❌ Belum ada |
| Ujian susulan peserta | ❌ Belum ada |
| Ujian perbaikan peserta | ❌ Belum ada |
| Status akhir per peserta | ❌ Belum ada |

---

## 4. Target Arsitektur

```
kelasPelatihan
    └─ pesertaKelas (enrollment)
          │
          ├─ absensiPelatihan
          │     └─ FK → classSessions (isExamDay = false)
          │
          ├─ absensiUjian
          │     └─ FK → jadwalUjian
          │
          ├─ nilaiUjian
          │     ├─ FK → jadwalUjian
          │     └─ mataPelajaran + nilai (A/B/C/D)
          │
          ├─ ujianSusulanPeserta
          │     └─ FK → jadwalUjian (original)
          │
          ├─ ujianPerbaikanPeserta
          │     └─ FK → nilaiUjian (nilai D yang diperbaiki)
          │
          └─ statusAkhirPeserta (computed + cached)
                ├─ lulus
                └─ telah_mengikuti (+ alasan)
```

---

## Fase 1 — Schema & Migration

### 5 Tabel Baru

#### 1. `peserta_kelas` — Enrollment

```typescript
export const pesertaKelas = pgTable("peserta_kelas", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  kelasId: text("kelas_id")
    .notNull()
    .references(() => kelasPelatihan.id, { onDelete: "cascade" }),
  nama: varchar("nama", { length: 200 }).notNull(),
  nomorPeserta: varchar("nomor_peserta", { length: 50 }),  // dari IAI Pusat jika ada
  email: varchar("email", { length: 150 }),
  telepon: varchar("telepon", { length: 30 }),
  catatan: text("catatan"),
  statusEnrollment: varchar("status_enrollment", { length: 20 })
    .default("aktif").notNull(), // aktif | mengundurkan_diri
  statusAkhir: varchar("status_akhir", { length: 30 }),    // lulus | telah_mengikuti | null (belum final)
  alasanStatus: varchar("alasan_status", { length: 50 }),  // kehadiran | nilai | null
  statusComputedAt: timestamp("status_computed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

#### 2. `absensi_pelatihan` — Kehadiran per Sesi

```typescript
export const absensiPelatihan = pgTable(
  "absensi_pelatihan",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    pesertaId: text("peserta_id")
      .notNull()
      .references(() => pesertaKelas.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => classSessions.id, { onDelete: "cascade" }),
    hadir: boolean("hadir").notNull(),
    catatan: text("catatan"),
    inputBy: text("input_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uniq_absensi_peserta_session").on(t.pesertaId, t.sessionId),
    index("absensi_pelatihan_peserta_idx").on(t.pesertaId),
  ],
);
```

#### 3. `absensi_ujian` — Kehadiran per Jadwal Ujian

```typescript
export const absensiUjian = pgTable(
  "absensi_ujian",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    pesertaId: text("peserta_id")
      .notNull()
      .references(() => pesertaKelas.id, { onDelete: "cascade" }),
    jadwalUjianId: text("jadwal_ujian_id")
      .notNull()
      .references(() => jadwalUjian.id, { onDelete: "cascade" }),
    // hadir | tidak_hadir | susulan (punya ujianSusulanPeserta)
    status: varchar("status", { length: 20 }).notNull().default("hadir"),
    catatan: text("catatan"),
    inputBy: text("input_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uniq_absensi_ujian_peserta").on(t.pesertaId, t.jadwalUjianId),
  ],
);
```

#### 4. `nilai_ujian` — Nilai per Mata Pelajaran

```typescript
export const nilaiUjian = pgTable(
  "nilai_ujian",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    pesertaId: text("peserta_id")
      .notNull()
      .references(() => pesertaKelas.id, { onDelete: "cascade" }),
    jadwalUjianId: text("jadwal_ujian_id")
      .notNull()
      .references(() => jadwalUjian.id, { onDelete: "cascade" }),
    mataPelajaran: varchar("mata_pelajaran", { length: 100 }).notNull(),
    nilai: varchar("nilai", { length: 2 }).notNull(), // A | B | C | D
    isPerbaikan: boolean("is_perbaikan").default(false).notNull(), // nilai hasil ujian perbaikan
    perbaikanDariId: text("perbaikan_dari_id"), // FK ke nilaiUjian yang di-replace (self-ref)
    inputBy: text("input_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uniq_nilai_peserta_ujian_mapel").on(
      t.pesertaId, t.jadwalUjianId, t.mataPelajaran, t.isPerbaikan
    ),
    index("nilai_ujian_peserta_idx").on(t.pesertaId),
  ],
);
```

#### 5. `ujian_susulan_peserta` — Ujian Susulan

```typescript
export const ujianSusulanPeserta = pgTable("ujian_susulan_peserta", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  pesertaId: text("peserta_id")
    .notNull()
    .references(() => pesertaKelas.id, { onDelete: "cascade" }),
  jadwalUjianOriginalId: text("jadwal_ujian_original_id")
    .notNull()
    .references(() => jadwalUjian.id),
  tanggalUsulan: date("tanggal_usulan"),
  tanggalDisepakati: date("tanggal_disepakati"),
  jamMulai: varchar("jam_mulai", { length: 5 }),
  jamSelesai: varchar("jam_selesai", { length: 5 }),
  // pending | disetujui | selesai | dibatalkan
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  alasanPermohonan: text("alasan_permohonan"),
  catatanAdmin: text("catatan_admin"),
  approvedBy: text("approved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

### Checklist Fase 1

- [ ] Tambah 5 tabel baru di `schema.ts`
- [ ] Generate migration Drizzle
- [ ] Jalankan migration di dev
- [ ] Verifikasi foreign keys correct

---

## Fase 2 — Server Actions & Logic

Lokasi: `src/server/actions/jadwal-otomatis/peserta/`

### 2.1 Enrollment

**`enrollPeserta(kelasId, data[])`**
- Bulk insert `pesertaKelas`
- Validasi: kelas harus ada + status aktif

**`getPesertaByKelas(kelasId)`**
- Fetch semua peserta + summary status (kehadiran %, nilai summary)

**`updateStatusEnrollment(pesertaId, status)`**
- Ubah status ke `mengundurkan_diri`

### 2.2 Absensi Pelatihan

**`inputAbsensiPelatihan(sessionId, absensiList[])`**
- Bulk upsert `absensiPelatihan` untuk semua peserta dalam satu sesi
- Trigger `recomputeStatusPeserta` untuk peserta yang berubah

**`getAbsensiByKelas(kelasId)`**
- Matrix: rows = peserta, cols = sesi, value = hadir/tidak
- Sertakan hitungan % kehadiran per peserta

**`getAbsensiBySession(sessionId)`**
- List peserta + status hadir untuk satu sesi (untuk input sheet)

### 2.3 Absensi Ujian

**`inputAbsensiUjian(jadwalUjianId, absensiList[])`**
- Bulk upsert `absensiUjian`
- Jika status = `tidak_hadir`, tidak auto-buat susulan — tunggu permohonan

**`getAbsensiUjianByKelas(kelasId)`**
- Matrix per jadwal ujian

### 2.4 Nilai Ujian

**`inputNilaiUjian(jadwalUjianId, nilaiList[])`**
- Bulk upsert `nilaiUjian` (isPerbaikan = false)
- Per peserta per mata pelajaran
- Trigger `recomputeStatusPeserta`

**`getNilaiByKelas(kelasId)`**
- Matrix: rows = peserta, cols = mata pelajaran, value = nilai
- Highlight nilai D yang belum ada perbaikan

### 2.5 Ujian Susulan

**`ajukanUjianSusulan(pesertaId, jadwalUjianId, data)`**
- Buat record `ujianSusulanPeserta` status pending
- Update `absensiUjian.status` = `susulan`

**`approveUjianSusulan(susulanId, tanggalDisepakati)`**
- Update status → disetujui
- Notifikasi (jika ada)

**`selesaikanUjianSusulan(susulanId)`**
- Update status → selesai
- Nilai diinput via `inputNilaiUjian` seperti biasa

### 2.6 Ujian Perbaikan

**`inputNilaiPerbaikan(pesertaId, jadwalUjianId, mataPelajaran, nilaiBarу)`**
- Insert `nilaiUjian` dengan `isPerbaikan = true`, `perbaikanDariId` → id nilai D asli
- Trigger `recomputeStatusPeserta`

### 2.7 Status Kalkulasi (Core Logic)

**`recomputeStatusPeserta(pesertaId)`**

```typescript
// Pseudocode
async function recomputeStatusPeserta(pesertaId: string) {
  const kelas = await getKelasByPeserta(pesertaId);

  // Hitung kehadiran pelatihan
  const totalSesi = await countSesiAktif(kelas.id); // isExamDay=false, status!=cancelled
  const hadirSesi = await countAbsensiHadir(pesertaId);
  const pctKehadiran = (hadirSesi / totalSesi) * 100;

  if (pctKehadiran < 60) {
    return updateStatus(pesertaId, "telah_mengikuti", "kehadiran");
  }

  // Cek nilai
  const nilaiD = await getNilaiD(pesertaId); // nilai = D, isPerbaikan = false
  for (const nilai of nilaiD) {
    const adaPerbaikan = await checkPerbaikanSelesai(pesertaId, nilai.mataPelajaran);
    if (!adaPerbaikan) {
      return updateStatus(pesertaId, "telah_mengikuti", "nilai");
    }
  }

  // Cek semua nilai sudah masuk (semua jadwal ujian sudah ada nilainya)
  const allNilaiLengkap = await checkAllNilaiMasuk(pesertaId, kelas.id);
  if (!allNilaiLengkap) {
    return updateStatus(pesertaId, null, null); // dalam proses
  }

  return updateStatus(pesertaId, "lulus", null);
}
```

### 2.8 Export Rekap

**`exportRekapKelas(kelasId)`**
- Return data untuk export Excel:
  - Nama peserta, nomor peserta
  - % kehadiran
  - Nilai per mata ujian (termasuk perbaikan)
  - Status akhir (Lulus / Telah Mengikuti)
  - Alasan jika Telah Mengikuti

### Checklist Fase 2

- [ ] Enrollment actions
- [ ] Absensi pelatihan actions + bulk input
- [ ] Absensi ujian actions
- [ ] Nilai ujian actions
- [ ] Ujian susulan flow (ajukan → approve → selesai)
- [ ] Nilai perbaikan action
- [ ] `recomputeStatusPeserta` core logic
- [ ] Export rekap (format Excel-ready)

---

## Fase 3 — UI

Peserta & Nilai **tidak jadi route terpisah** — masuk sebagai tab di halaman detail kelas pelatihan.

### 3.1 Struktur Tab di `/jadwal-otomatis/[id]`

```
[Informasi Kelas] [Jadwal Sesi] [Instruktur] [Peserta & Nilai] [Jadwal Ujian]
```

### 3.2 Tab: Peserta & Nilai

Sub-navigasi di dalam tab:

```
[Daftar Peserta] [Absensi Pelatihan] [Absensi & Nilai Ujian] [Status & Rekap]
```

---

#### Sub-tab: Daftar Peserta

```
┌──────────────────────────────────────────────────────────────┐
│  Peserta Kelas — Brevet AB 238              [+ Tambah] [Import CSV]  │
├──────────────────────────────────────────────────────────────┤
│  No │ Nama Peserta        │ No Peserta  │ Status Akhir │ Aksi │
│  1  │ Ahmad Fauzi         │ BP-238-001  │ Dalam Proses │ •••  │
│  2  │ Budi Santoso        │ BP-238-002  │ Lulus        │ •••  │
│  3  │ Citra Dewi          │ BP-238-003  │ Telah Mengikuti (nilai) │ ••• │
└──────────────────────────────────────────────────────────────┘
```

---

#### Sub-tab: Absensi Pelatihan

Matrix view — input massal per sesi:

```
┌───────────────┬─────┬─────┬─────┬─────┬─────┬──────────┐
│ Peserta       │ S1  │ S2  │ S3  │ ... │ S31 │ Kehadiran│
├───────────────┼─────┼─────┼─────┼─────┼─────┼──────────┤
│ Ahmad Fauzi   │  ✓  │  ✓  │  -  │     │  ✓  │  87%     │
│ Budi Santoso  │  ✓  │  ✓  │  ✓  │     │  ✓  │  100%    │
│ Citra Dewi    │  ✓  │  -  │  -  │     │  -  │  55% ⚠️  │
└───────────────┴─────┴─────┴─────┴─────┴─────┴──────────┘

[Edit per Sesi]  klik header sesi → buka input sheet satu sesi
```

---

#### Sub-tab: Absensi & Nilai Ujian

Per jadwal ujian, tampilkan:

```
Ujian 1 — 15 Jun 2026 (PPh OP, KUP A)
┌─────────────────┬────────┬──────────┬──────────┬────────────┐
│ Peserta         │ Hadir  │ PPh OP   │ KUP A    │ Aksi       │
├─────────────────┼────────┼──────────┼──────────┼────────────┤
│ Ahmad Fauzi     │ Hadir  │ B        │ A        │            │
│ Budi Santoso    │ Hadir  │ A        │ A        │            │
│ Citra Dewi      │ Tidak  │ —        │ —        │ [Susulan]  │
└─────────────────┴────────┴──────────┴──────────┴────────────┘

Nilai D → tampil badge merah + link [Perbaikan]
```

---

#### Sub-tab: Status & Rekap

```
┌──────────────────────────────────────────────────────────┐
│  Rekap Status Kelas Brevet AB 238                        │
│                                                          │
│  Lulus              : 18 peserta (72%)                   │
│  Telah Mengikuti    :  7 peserta (28%)                   │
│    - Kehadiran < 60%:  3 peserta                         │
│    - Nilai D        :  4 peserta                         │
│  Dalam Proses       :  0 peserta                         │
│                                                          │
│  [Export Rekap Excel]  ← untuk dikirim ke pusat          │
└──────────────────────────────────────────────────────────┘
```

### 3.3 Format Export Excel

Kolom output rekap yang dikirim ke pusat:

| No | Nama | No Peserta | % Hadir | Nilai Ujian (per mapel) | Status | Keterangan |
|----|------|-----------|---------|------------------------|--------|-----------|
| 1  | Ahmad Fauzi | BP-238-001 | 87% | PPh OP: B, KUP A: A, ... | Lulus | |
| 2  | Citra Dewi | BP-238-003 | 55% | - | Telah Mengikuti | Kehadiran < 60% |

### Checklist Fase 3

- [ ] Tab "Peserta & Nilai" di halaman detail kelas
- [ ] Sub-tab Daftar Peserta + form tambah + import CSV
- [ ] Sub-tab Absensi Pelatihan — matrix view + input per sesi
- [ ] Sub-tab Absensi & Nilai Ujian — per jadwal ujian
- [ ] Input nilai bulk per jadwal ujian
- [ ] Flow ujian susulan (dialog permohonan → approval → selesai)
- [ ] Flow ujian perbaikan (dari nilai D → input nilai baru)
- [ ] Sub-tab Status & Rekap dengan summary
- [ ] Export Excel rekap

---

## Navigasi (Opsi B)

Update sidemenu dari dua item terpisah menjadi satu group:

### Sebelum

```
├─ Jadwal Otomatis
├─ Jadwal Ujian
```

### Sesudah

```
▼ Program Pelatihan
  ├─ Jadwal Kelas           (rename dari "Jadwal Otomatis")
  ├─ Jadwal Ujian
  └─ Honorarium
```

- Peserta & Nilai = **tab di dalam** halaman detail kelas, bukan item nav terpisah
- Modul `/sertifikat` tetap di luar group ini — konteks berbeda (event DKI Jakarta)

### Checklist Navigasi

- [ ] Tambah group "Program Pelatihan" di sidemenu
- [ ] Rename label "Jadwal Otomatis" → "Jadwal Kelas"
- [ ] Route `/jadwal-otomatis` **tidak berubah** — hanya label UI yang berubah

---

## Out of Scope

| Item | Alasan |
|------|--------|
| Integrasi ke sistem sertifikat pusat | Batasan dari pusat, tidak boleh dihubungkan |
| Generate sertifikat Brevet/BFA dari sistem ini | Pusat yang terbitkan |
| Portal peserta (self-service lihat nilai) | Fase berikutnya jika diperlukan |
| Notifikasi otomatis ke peserta | Nice-to-have, bisa ditambah setelah core selesai |
| Pembayaran / pendaftaran online | Beda scope — manajemen registrasi |
| Link peserta ke data pegawai (`pegawaiBiodata`) | Peserta eksternal, bukan pegawai IAI DKI |

---

## Checklist Progress

### Pre-requisite
- [x] Integrasi Jadwal Otomatis → Ujian selesai (Fase 1 & 2 dari `INTEGRASI_JADWAL_OTOMATIS_UJIAN.md`)

### Fase 1 — Schema
- [x] 5 tabel baru di schema.ts (`pesertaKelas`, `absensiPelatihan`, `absensiUjian`, `nilaiUjian`, `ujianSusulanPeserta`)
- [x] Generate & run migration (`0032_bored_stark_industries.sql`)

### Fase 2 — Server Actions
- [x] Enrollment (`enrollment.ts`)
- [x] Absensi pelatihan (`absensi-pelatihan.ts`)
- [x] Absensi ujian (`absensi-ujian.ts`)
- [x] Nilai ujian (`nilai-ujian.ts`)
- [x] Ujian susulan (`ujian-susulan.ts`)
- [x] Ujian perbaikan (`inputNilaiPerbaikan` di `nilai-ujian.ts`)
- [x] `recomputeStatusPeserta` (`recompute-status.ts`)
- [x] Export rekap (`export-rekap.ts`)

### Fase 3 — UI
- [x] Tab Peserta & Nilai (`PesertaDanNilaiTab.tsx`)
- [x] 4 sub-tab (Daftar Peserta, Absensi Pelatihan, Absensi & Nilai Ujian, Status & Rekap)
- [x] Export Excel (xlsx dynamic import)

### Navigasi
- [x] Label "Jadwal Kelas" sudah ada di sidemenu (tidak perlu perubahan)

---

## Post-Review Bug Fixes (2026-05-02)

Setelah implementasi selesai, dilakukan kroscek menyeluruh. Ditemukan **5 CRITICAL**, **14 WARNING**, **13 MINOR**. Semua CRITICAL dan sebagian besar WARNING telah diperbaiki:

### CRITICAL Fixed

| # | File | Bug | Fix |
|---|------|-----|-----|
| C1 | `enrollment.ts` | `getPesertaByKelas` pakai `with: { absensiPelatihan, absensiUjian, nilaiUjian }` tanpa `relations()` → throw runtime | Hapus `with` clause; data absensi/nilai diload terpisah per sub-tab |
| C2 | `ujian-susulan.ts` | `&&` (JS operator) alih-alih `and()` Drizzle → WHERE clause hanya filter kolom kedua → update kena semua peserta di jadwal yang sama (data corruption) | Ganti ke `and(eq(...), eq(...))` + import `and` |
| C3 | `ujian-susulan.ts` | State transitions tidak di-enforce — `selesaikan` bisa dipanggil dari `pending`, `batal` bisa kena `selesai` | Tambah kondisi status di WHERE: `approve` hanya dari `pending`, `selesaikan` hanya dari `disetujui`, `batalkan` dari `pending\|disetujui` |
| C4 | `PesertaDanNilaiTab.tsx` + semua mutation actions | Client kirim literal `"system"` sebagai `userId` → FK violation ke `users(id)` → semua mutation gagal | Hapus `userId` param dari semua action signatures; resolve `session.user.id` di dalam server action via `requirePermission` |
| C5 | `PesertaDanNilaiTab.tsx` | `loadPeserta()` dipanggil langsung di render body → infinite re-render loop | Pindah ke `useEffect(() => { loadPeserta(); }, [loadPeserta])` |

### WARNING Fixed

| # | File | Bug | Fix |
|---|------|-----|-----|
| W1 | `recompute-status.ts`, `export-rekap.ts` | `hadirSesi` hitung semua absensi tanpa filter sesi cancelled/exam-day → persentase bisa inflasi | `hadirSesi` kini JOIN `classSessions` + filter `isExamDay=false` + `status != 'cancelled'` + `kelasId` |
| W2 | `recompute-status.ts` | `totalSesi === 0` → divide-by-zero, pct=0, peserta salah masuk `telah_mengikuti` sebelum ada sesi | Guard: jika `totalSesi === 0`, set `statusAkhir = null` (dalam proses) |
| W5 | `nilai-ujian.ts` | `inputNilaiPerbaikan` plain `INSERT` tanpa conflict target → throw jika re-run untuk mapel yang sama | Tambah `onConflictDoUpdate` dengan target yang sama (`pesertaId, jadwalUjianId, mataPelajaran, isPerbaikan`) |
| W6 | `absensi-pelatihan.ts` | Loop insert sequential, tanpa atomicity → partial failure bisa tinggalkan data inconsistent | Wrap semua insert dalam `db.transaction()` |
| W8 | `absensi-pelatihan.ts`, `absensi-ujian.ts`, `nilai-ujian.ts` | `inArray(col, [])` → SQL invalid jika `pesertaList` kosong | Guard: early return `{ ..., list: [] }` jika `pesertaList.length === 0` |
| W10 | `enrollment.ts` | `deletePeserta` hard delete → cascade hapus semua absensi/nilai historis | `deletePeserta` kini soft delete via `updateStatusEnrollment("mengundurkan_diri")` |
| W11 | `PesertaDanNilaiTab.tsx` | `prompt()` untuk input nilai perbaikan & tanggal susulan → tidak accessible, no validation, crash di webview | Ganti dengan inline form state: `perbaikanEdit` (select A/B/C + confirm/cancel), `susulanEdit` (date input + confirm/cancel) |
| W12 | semua actions | `revalidatePath` inconsistent: beberapa pakai route tidak exist (`/jadwal-ujian/...`), `ujian-susulan.ts` tidak revalidate sama sekali | Standarisasi ke `/jadwal-otomatis/${kelasId}`; lookup chain `jadwalUjianId → kelasUjian → kelasPelatihanId`; susulan lookup dari `pesertaId → pesertaKelas.kelasId` |
| W14 | `absensi-ujian.ts` | `inputAbsensiUjian` tidak panggil `recomputeStatusPeserta` | Tambah loop recompute setelah upsert |
| M6 | `absensi-ujian.ts` | `inputAbsensiUjian` tidak validasi `jadwalUjianId` exists → FK violation opaque | Tambah lookup + early return `{ ok: false, error: "Jadwal ujian tidak ditemukan." }` |

### Tidak Difix (Accepted Risk)

| # | Alasan |
|---|--------|
| W3 | `lulus` bisa granted sebelum semua sesi selesai — **by design**, status dihitung dari data yang sudah ada |
| W4 | Unique index `(pesertaId, jadwalUjianId, mataPelajaran, isPerbaikan)` batasi 1 perbaikan per mapel — W5 fix via `onConflictDoUpdate` sudah cukup untuk use case saat ini |
| M12/M13 | Kolom status pakai `varchar` bukan `pgEnum` — perlu migration baru, defer ke refactor berikutnya |

### Files Changed

```
src/server/actions/jadwal-otomatis/peserta/enrollment.ts
src/server/actions/jadwal-otomatis/peserta/absensi-pelatihan.ts
src/server/actions/jadwal-otomatis/peserta/absensi-ujian.ts
src/server/actions/jadwal-otomatis/peserta/nilai-ujian.ts
src/server/actions/jadwal-otomatis/peserta/ujian-susulan.ts
src/server/actions/jadwal-otomatis/peserta/recompute-status.ts
src/server/actions/jadwal-otomatis/peserta/export-rekap.ts
src/components/jadwal-otomatis/PesertaDanNilaiTab.tsx
```

`tsc --noEmit` clean setelah semua fix.
