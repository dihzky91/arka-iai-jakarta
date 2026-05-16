# Modul Saldo Cuti Karyawan

> Dokumen perencanaan untuk penerapan sistem saldo cuti karyawan IAI Wilayah DKI Jakarta ke dalam sistem ARKA.

---

## 1. Latar Belakang

Setiap karyawan berhak atas jatah cuti tahunan yang diberikan oleh organisasi. Saat ini belum ada mekanisme pencatatan saldo cuti secara digital di sistem ARKA — pengajuan cuti sudah berjalan, namun belum ada validasi terhadap kuota yang tersedia.

**Status Integrasi DingTalk:** Sistem ARKA sudah memiliki kode integrasi DingTalk untuk pengajuan cuti (`submit-leave.ts`, `sync-leave.ts`), namun **saat ini belum aktif/terkoneksi**. Oleh karena itu, modul saldo cuti ini dirancang untuk berjalan **mandiri di ARKA** — seluruh proses pengajuan dan approval dilakukan langsung di sistem tanpa ketergantungan pada DingTalk. Jika di kemudian hari integrasi DingTalk diaktifkan, modul saldo cuti tetap kompatibel (saldo tetap divalidasi dan diupdate terlepas dari sumber approval).

Kebutuhan utama:
- Setiap karyawan mendapat **12 hari cuti tahunan**
- **Cuti bersama** yang ditetapkan pemerintah **mengurangi jatah cuti tahunan** seluruh karyawan
- Terdapat **Cuti Kompensasi** (paid leave) sebanyak **2 hari per tahun** — kuota terpisah dari cuti tahunan
- Saldo cuti **di-reset setiap awal tahun** (tidak ada carry-over)

> **Catatan Penamaan:** Istilah "Cuti Berbayar" diganti menjadi **"Cuti Kompensasi"** — lebih formal dan halus, merujuk pada hak cuti tambahan yang diberikan sebagai bentuk kompensasi organisasi kepada karyawan.

---

## 2. Tujuan

- Mencatat dan mengelola saldo cuti setiap karyawan per tahun
- Memvalidasi ketersediaan saldo sebelum pengajuan cuti diproses
- Mengelola cuti bersama nasional dan dampaknya terhadap saldo karyawan
- Menyediakan visibilitas saldo cuti secara real-time bagi karyawan dan admin
- Mereset saldo secara otomatis setiap pergantian tahun

---

## 3. Jenis Cuti & Kuota

| Jenis | Kuota/Tahun | Mengurangi Cuti Tahunan? | Keterangan |
|-------|-------------|--------------------------|------------|
| **Cuti Tahunan** | 12 hari | — | Hak dasar setiap karyawan |
| **Cuti Bersama** | Sesuai SKB Pemerintah | Ya | Ditetapkan admin, otomatis potong saldo seluruh karyawan |
| **Cuti Kompensasi** | 2 hari | Tidak | Kuota terpisah, hak tambahan dari organisasi |
| Cuti Sakit | Sesuai kebutuhan | Tidak | Tidak mengurangi saldo (dengan surat dokter) |
| Cuti Melahirkan | Sesuai regulasi | Tidak | Tidak mengurangi saldo |
| Cuti Menikah | 3 hari | Tidak | Tidak mengurangi saldo |
| Cuti Kematian | 2 hari | Tidak | Tidak mengurangi saldo |

> Hanya **Cuti Tahunan** dan **Cuti Kompensasi** yang memiliki saldo terbatas dan perlu dikelola.

---

## 4. Alur Bisnis

### 4.1 Inisialisasi Saldo Awal Tahun

1. Setiap **1 Januari** (atau via tombol admin), sistem membuat record saldo untuk seluruh karyawan aktif:
   - Cuti Tahunan: 12 hari
   - Cuti Kompensasi: 2 hari
2. Karyawan yang masuk **tengah tahun** mendapat kuota prorata berdasarkan bulan masuk (opsional, bisa dikonfigurasi admin).
3. Saldo tahun sebelumnya **tidak dibawa** ke tahun baru (reset penuh).

### 4.2 Pengelolaan Cuti Bersama

1. Admin menginput tanggal-tanggal cuti bersama berdasarkan SKB Pemerintah.
2. Saat disimpan, sistem **otomatis mengurangi** `sisaCuti` seluruh karyawan aktif.
3. Jika admin menghapus tanggal cuti bersama → saldo seluruh karyawan **dikembalikan**.
4. Contoh: 3 hari cuti bersama → sisa cuti tahunan = 12 - 3 = **9 hari** yang bisa diajukan mandiri.

**Batas Maksimal Pemotongan (Override):**

Terdapat konfigurasi `maksimalPotongCutiBersama` yang membatasi berapa hari cuti bersama yang boleh memotong saldo cuti tahunan karyawan. Default: **2 hari**.

| Skenario | Cuti Bersama Pemerintah | Maks Potong | Yang Memotong Saldo | Sisa Cuti |
|----------|------------------------|-------------|---------------------|-----------|
| Normal | 2 hari | 2 | 2 hari | 10 |
| Banyak | 5 hari | 2 | 2 hari saja | 10 |
| Disesuaikan | 5 hari | 3 | 3 hari saja | 9 |

> **Rasional:** Pemerintah bisa menetapkan cuti bersama dalam jumlah banyak (4–7 hari per tahun). Jika seluruhnya memotong saldo, karyawan hanya tersisa sedikit jatah cuti mandiri. Dengan batas maksimal, organisasi tetap mengikuti cuti bersama namun hanya sebagian yang mengurangi hak cuti karyawan — sisanya dianggap sebagai "libur tambahan" dari organisasi.

**Mekanisme:**
- Admin mengatur nilai `maksimalPotongCutiBersama` di halaman konfigurasi (default: 2).
- Saat admin menambah tanggal cuti bersama, sistem mengecek: jika total cuti bersama tahun ini sudah mencapai batas maksimal, tanggal baru **tetap tercatat** sebagai cuti bersama (karyawan tetap libur) namun **tidak memotong saldo**.
- Kolom `memotongSaldo` (boolean) di tabel `cuti_bersama` menandai mana yang memotong dan mana yang tidak.
- Admin bisa mengatur ulang mana yang memotong saldo dan mana yang tidak (override manual).

### 4.3 Pengajuan Cuti Tahunan (Flow Mandiri di ARKA)

> **Catatan:** Integrasi DingTalk untuk approval cuti saat ini belum aktif. Seluruh proses pengajuan dan persetujuan dilakukan langsung di ARKA oleh admin/atasan.

1. Karyawan membuka form pengajuan cuti → sistem menampilkan **sisa saldo**.
2. Jika saldo tidak mencukupi → form menolak pengajuan (validasi client + server).
3. Karyawan submit pengajuan → status menjadi `diajukan`.
4. Admin/atasan menyetujui atau menolak di halaman approval ARKA.
5. Jika pengajuan **disetujui** → `cutiTerpakai` bertambah, `sisaCuti` berkurang.
6. Jika pengajuan **ditolak** → tidak ada perubahan saldo.
7. Jika pengajuan **dibatalkan** setelah disetujui → saldo dikembalikan.

**Kompatibilitas DingTalk (masa depan):**
- Jika integrasi DingTalk diaktifkan kembali, flow approval bisa dialihkan ke DingTalk.
- Saldo tetap divalidasi dan diupdate di sisi ARKA, terlepas dari sumber approval (ARKA langsung atau callback DingTalk).
- Fungsi `syncCutiDariDingTalk` yang sudah ada akan ditambah logic update saldo saat status berubah.

### 4.4 Pengajuan Cuti Kompensasi

1. Karyawan memilih jenis "Cuti Kompensasi" di form pengajuan.
2. Sistem mengecek saldo cuti kompensasi (maks 2 hari/tahun).
3. Tidak mengurangi saldo cuti tahunan.
4. Flow approval sama dengan cuti tahunan (langsung di ARKA).

### 4.5 Reset Tahunan

1. Setiap awal tahun, admin menjalankan "Generate Saldo Tahun Baru".
2. Saldo tahun sebelumnya ditutup (read-only sebagai histori).
3. Saldo baru dibuat dengan kuota penuh (12 + 2).

### 4.6 Perubahan Flow Pengajuan Cuti (Tanpa DingTalk)

Karena DingTalk belum terkoneksi, flow pengajuan cuti disesuaikan:

| Langkah | Sebelumnya (DingTalk) | Sekarang (ARKA Mandiri) |
|---------|----------------------|------------------------|
| Submit | Draft → kirim ke DingTalk → `diajukan` | Draft → langsung `diajukan` |
| Approval | Callback dari DingTalk | Admin approve di halaman ARKA |
| Notifikasi | Via DingTalk | Via sistem ARKA (toast/badge) |

**Perubahan pada `CutiForm.tsx`:**
- Hapus auto-kirim ke DingTalk setelah submit
- Langsung set status `diajukan` saat karyawan submit
- Tampilkan sisa saldo sebelum submit

**Perubahan pada `CutiManager.tsx`:**
- Hapus tombol "Kirim" (ke DingTalk) di daftar cuti
- Tambah widget saldo cuti di atas tabel
- Tab approval tetap digunakan oleh admin

---

## 5. Desain Database

### 5.1 Enum Baru/Update

```typescript
// Update enum existing — tambah "kompensasi"
export const jenisCutiEnum = pgEnum("jenis_cuti", [
  "tahunan",
  "kompensasi",   // ← BARU (sebelumnya tidak ada)
  "sakit",
  "melahirkan",
  "menikah",
  "kematian",
  "lainnya",
]);
```

### 5.2 Tabel Baru

#### `saldo_cuti_tahunan` — Saldo cuti tahunan per karyawan per tahun

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | serial | PK |
| userId | text | FK → users.id |
| tahun | integer | Tahun berlaku (2026) |
| kuotaAwal | integer | Default 12 |
| cutiTerpakai | integer | Jumlah hari cuti yang sudah diambil karyawan |
| cutiBersamaTerpakai | integer | Jumlah hari cuti bersama yang memotong saldo |
| sisaCuti | integer | Computed: kuotaAwal - cutiTerpakai - cutiBersamaTerpakai |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**Constraint:** UNIQUE(userId, tahun)

#### `saldo_cuti_kompensasi` — Saldo cuti kompensasi per karyawan per tahun

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | serial | PK |
| userId | text | FK → users.id |
| tahun | integer | Tahun berlaku |
| kuota | integer | Default 2 |
| terpakai | integer | Jumlah hari yang sudah diambil |
| sisa | integer | Computed: kuota - terpakai |
| createdAt | timestamp | |
| updatedAt | timestamp | |

**Constraint:** UNIQUE(userId, tahun)

#### `cuti_bersama` — Master data cuti bersama nasional

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | serial | PK |
| tahun | integer | Tahun berlaku |
| tanggal | date | Tanggal cuti bersama |
| keterangan | varchar(200) | Deskripsi (misal: "Cuti Bersama Idul Fitri") |
| memotongSaldo | boolean | Apakah memotong saldo cuti tahunan (default: true) |
| createdBy | text | FK → users.id (admin yang input) |
| createdAt | timestamp | |

**Constraint:** UNIQUE(tanggal)

#### `konfigurasi_cuti` — Pengaturan global modul cuti

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | serial | PK |
| tahun | integer | Tahun berlaku |
| kuotaCutiTahunan | integer | Default 12 |
| kuotaCutiKompensasi | integer | Default 2 |
| maksimalPotongCutiBersama | integer | Batas maks cuti bersama yang memotong saldo (default: 2) |
| updatedBy | text | FK → users.id |
| updatedAt | timestamp | |

**Constraint:** UNIQUE(tahun)

### 5.3 Schema Drizzle

```typescript
// ─── SALDO CUTI ──────────────────────────────────────────────────────────────

export const saldoCutiTahunan = pgTable(
  "saldo_cuti_tahunan",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tahun: integer("tahun").notNull(),
    kuotaAwal: integer("kuota_awal").notNull().default(12),
    cutiTerpakai: integer("cuti_terpakai").notNull().default(0),
    cutiBersamaTerpakai: integer("cuti_bersama_terpakai").notNull().default(0),
    sisaCuti: integer("sisa_cuti").notNull().default(12),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    uniqUserTahun: uniqueIndex("uniq_saldo_cuti_user_tahun").on(t.userId, t.tahun),
    idxTahun: index("idx_saldo_cuti_tahun").on(t.tahun),
  }),
);

export const saldoCutiKompensasi = pgTable(
  "saldo_cuti_kompensasi",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tahun: integer("tahun").notNull(),
    kuota: integer("kuota").notNull().default(2),
    terpakai: integer("terpakai").notNull().default(0),
    sisa: integer("sisa").notNull().default(2),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    uniqUserTahun: uniqueIndex("uniq_cuti_kompensasi_user_tahun").on(t.userId, t.tahun),
  }),
);

export const cutiBersama = pgTable(
  "cuti_bersama",
  {
    id: serial("id").primaryKey(),
    tahun: integer("tahun").notNull(),
    tanggal: date("tanggal").notNull(),
    keterangan: varchar("keterangan", { length: 200 }).notNull(),
    memotongSaldo: boolean("memotong_saldo").notNull().default(true),
    createdBy: text("created_by").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    uniqTanggal: uniqueIndex("uniq_cuti_bersama_tanggal").on(t.tanggal),
    idxTahun: index("idx_cuti_bersama_tahun").on(t.tahun),
  }),
);

export const konfigurasiCuti = pgTable(
  "konfigurasi_cuti",
  {
    id: serial("id").primaryKey(),
    tahun: integer("tahun").notNull(),
    kuotaCutiTahunan: integer("kuota_cuti_tahunan").notNull().default(12),
    kuotaCutiKompensasi: integer("kuota_cuti_kompensasi").notNull().default(2),
    maksimalPotongCutiBersama: integer("maksimal_potong_cuti_bersama").notNull().default(2),
    updatedBy: text("updated_by").references(() => users.id),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    uniqTahun: uniqueIndex("uniq_konfigurasi_cuti_tahun").on(t.tahun),
  }),
);
```

### 5.4 ERD

```
users
  │
  │ 1:N
  ├──► saldo_cuti_tahunan (per tahun)
  │
  │ 1:N
  ├──► saldo_cuti_kompensasi (per tahun)
  │
  │ 1:N
  ├──► pengajuan_cuti (existing, validasi terhadap saldo)
  │
  │
cuti_bersama (master, mempengaruhi saldo_cuti_tahunan — dibatasi oleh konfigurasi)
  │
  │
konfigurasi_cuti (setting per tahun: kuota, maks potong cuti bersama)
```

---

## 6. Kebutuhan Fungsional

### 6.1 Manajemen Saldo (Admin)

- Generate saldo awal tahun untuk seluruh karyawan aktif
- Lihat & edit saldo per karyawan (koreksi manual jika diperlukan)
- Konfigurasi kuota default (12 cuti tahunan, 2 cuti kompensasi)
- Opsi prorata untuk karyawan baru (opsional)

### 6.2 Manajemen Cuti Bersama (Admin)

- CRUD tanggal cuti bersama per tahun
- Saat tambah → cek batas maksimal pemotongan:
  - Jika belum mencapai batas → `memotongSaldo = true`, otomatis kurangi saldo karyawan
  - Jika sudah mencapai batas → `memotongSaldo = false`, tercatat sebagai libur tapi tidak potong saldo
- Admin bisa toggle `memotongSaldo` secara manual (override per tanggal)
- Saat hapus tanggal yang `memotongSaldo = true` → kembalikan saldo karyawan
- Konfigurasi `maksimalPotongCutiBersama` bisa diubah per tahun
- Import dari daftar SKB pemerintah (opsional, fase lanjutan)

### 6.3 Validasi Pengajuan Cuti (Integrasi)

- Cek saldo sebelum pengajuan dibuat (client-side warning)
- Cek saldo sebelum pengajuan disimpan (server-side validation)
- Update saldo saat status berubah:
  - `disetujui` (oleh admin di ARKA) → kurangi saldo
  - `dibatalkan` (setelah disetujui) → kembalikan saldo
  - `ditolak` → tidak ada perubahan saldo
- **Catatan DingTalk:** Jika di masa depan DingTalk aktif dan `syncCutiDariDingTalk` mengubah status menjadi `disetujui`, logic update saldo yang sama akan dipanggil.

### 6.4 Tampilan Saldo (Karyawan)

- Widget ringkasan saldo di halaman cuti
- Riwayat penggunaan cuti per tahun
- Informasi cuti bersama yang sudah memotong saldo

### 6.5 Reset Tahunan

- Tombol admin: "Generate Saldo Tahun [X]"
- Validasi: tidak bisa generate jika sudah ada record untuk tahun tersebut
- Saldo tahun lama tetap tersimpan sebagai histori (read-only)

---

## 7. Capabilities (RBAC)

### 7.1 Capabilities Baru

```typescript
"saldo_cuti:view"          // Lihat saldo cuti milik sendiri
"saldo_cuti:view_all"      // Lihat saldo seluruh karyawan (admin/HR)
"saldo_cuti:manage"        // Generate saldo, kelola cuti bersama, koreksi manual
```

### 7.2 Mapping ke Role Default

| Capability | admin | staff |
|-----------|-------|-------|
| saldo_cuti:view | ✓ | ✓ |
| saldo_cuti:view_all | ✓ | ✗ |
| saldo_cuti:manage | ✓ | ✗ |

---

## 8. Struktur File

```
src/
├── app/(dashboard)/cuti/
│   ├── page.tsx                        # Existing — tambah widget saldo
│   ├── saldo/page.tsx                  # Halaman detail saldo karyawan
│   └── kelola/
│       ├── page.tsx                    # Admin: kelola saldo & cuti bersama
│       └── cuti-bersama/page.tsx       # Admin: CRUD cuti bersama + konfigurasi
├── components/cuti/
│   ├── CutiManager.tsx                 # Existing — integrasi widget saldo
│   ├── CutiForm.tsx                    # Existing — tambah validasi saldo
│   ├── SaldoCutiWidget.tsx             # BARU: widget ringkasan saldo
│   ├── SaldoCutiDetail.tsx             # BARU: detail & riwayat saldo
│   ├── CutiBersamaManager.tsx          # BARU: CRUD cuti bersama (admin)
│   ├── KonfigurasiCutiForm.tsx         # BARU: form konfigurasi (kuota, maks potong)
│   ├── GenerateSaldoForm.tsx           # BARU: form generate saldo tahunan
│   └── KelolaSaldoTable.tsx            # BARU: tabel saldo semua karyawan
├── server/actions/
│   ├── cuti.ts                         # Existing — tambah validasi saldo
│   └── saldoCuti.ts                    # BARU: server actions saldo cuti
├── lib/validators/
│   └── saldoCuti.schema.ts             # BARU: Zod schemas
```

---

## 9. Desain UI

### 9.1 Widget Saldo Cuti (Halaman Cuti Karyawan)

```
┌─────────────────────────────────────────────────────────┐
│  Saldo Cuti Tahun 2026                                  │
├───────────────────┬───────────────────┬─────────────────┤
│  Cuti Tahunan     │  Cuti Kompensasi  │  Cuti Bersama   │
│  ████████░░ 9/12  │  ██░░░░░░░░ 1/2   │  3 hari         │
│  Sisa: 9 hari     │  Sisa: 1 hari     │  (memotong      │
│                   │                   │   cuti tahunan)  │
└───────────────────┴───────────────────┴─────────────────┘
```

### 9.2 Halaman Admin: Kelola Cuti Bersama

```
┌─────────────────────────────────────────────────────────────────┐
│  Konfigurasi Cuti Tahun 2026                        [Simpan]    │
├─────────────────────────────────────────────────────────────────┤
│  Kuota Cuti Tahunan: [12]  Kuota Kompensasi: [2]                │
│  Maks Potong Cuti Bersama: [2] hari                             │
│  ⓘ Cuti bersama yang melebihi batas ini tetap berlaku sebagai   │
│    libur, namun tidak memotong saldo cuti karyawan.             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Cuti Bersama Tahun 2026                            [+ Tambah]  │
├──────────────┬──────────────────────────┬────────────┬──────────┤
│  Tanggal     │  Keterangan              │  Potong?   │  Aksi    │
├──────────────┼──────────────────────────┼────────────┼──────────┤
│  2026-03-31  │  Cuti Bersama Idul Fitri │  ✓ Ya      │  [Hapus] │
│  2026-04-01  │  Cuti Bersama Idul Fitri │  ✓ Ya      │  [Hapus] │
│  2026-12-24  │  Cuti Bersama Natal      │  ✗ Tidak   │  [Hapus] │
│  2026-12-31  │  Cuti Bersama Tahun Baru │  ✗ Tidak   │  [Hapus] │
└──────────────┴──────────────────────────┴────────────┴──────────┘
│  Total: 4 hari │ Memotong saldo: 2 hari │ Libur saja: 2 hari   │
│  Sisa cuti tahunan karyawan: 10 hari                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Fase Implementasi

### Fase 1: Schema & Foundation (1 hari)

- [x] Tambah value `"kompensasi"` ke `jenisCutiEnum`
- [x] Tambah tabel `saldo_cuti_tahunan`, `saldo_cuti_kompensasi`, `cuti_bersama`, `konfigurasi_cuti`
- [x] Generate migration & push schema
- [x] Tambah capabilities `saldo_cuti:view`, `saldo_cuti:view_all`, `saldo_cuti:manage`
- [x] Zod schemas untuk validasi

### Fase 2: Server Actions Saldo Cuti (1–2 hari)

- [x] `generateSaldoTahunan(tahun)` — buat saldo untuk seluruh karyawan aktif
- [x] `getSaldoCuti(userId, tahun)` — ambil saldo karyawan
- [x] `getAllSaldoCuti(tahun)` — ambil saldo seluruh karyawan (admin)
- [x] `koreksiSaldo(userId, tahun, field, value)` — koreksi manual admin
- [x] `getKonfigurasiCuti(tahun)` — ambil konfigurasi tahun berjalan
- [x] `updateKonfigurasiCuti(tahun, data)` — update kuota & maks potong
- [x] `createCutiBersama(tanggal, keterangan)` — tambah + cek batas maks + potong saldo jika belum melebihi batas
- [x] `deleteCutiBersama(id)` — hapus + kembalikan saldo jika `memotongSaldo = true`
- [x] `toggleMemotongSaldo(id, value)` — override manual per tanggal cuti bersama
- [x] `listCutiBersama(tahun)` — daftar cuti bersama per tahun

### Fase 3: Integrasi dengan Flow Pengajuan Cuti (1–2 hari)

- [x] Refactor `ajukanCuti` — langsung set status `diajukan` (tanpa DingTalk)
- [x] Tambah fungsi `approveCutiInternal` untuk approval langsung di ARKA
- [x] Validasi saldo di `ajukanCuti` (server action)
- [x] Update saldo saat `approveCuti` mengubah status ke `disetujui`
- [x] Kembalikan saldo saat status berubah ke `dibatalkan`
- [x] Update `CutiForm.tsx` — hapus auto-kirim DingTalk, tampilkan saldo
- [x] Update `CutiManager.tsx` — hapus tombol "Kirim", tambah widget saldo
- [x] Pastikan `CutiApproval.tsx` berfungsi untuk approval internal

### Fase 4: UI Komponen (2 hari)

- [x] `SaldoCutiWidget.tsx` — card ringkasan saldo (progress bar)
- [x] Integrasi widget ke `CutiManager.tsx`
- [x] `CutiBersamaManager.tsx` — CRUD cuti bersama (admin)
- [x] `GenerateSaldoForm.tsx` — form generate saldo tahunan (admin)
- [x] `KelolaSaldoTable.tsx` — tabel saldo semua karyawan (admin)
- [x] Halaman `/cuti/kelola` dan `/cuti/kelola/cuti-bersama`

### Fase 5: Testing & Polish (1 hari)

- [x] Validasi edge cases (saldo habis, batal setelah approve, karyawan baru)
- [x] Pastikan reset tahunan berjalan benar
- [x] UI responsiveness
- [x] Navigasi sidebar untuk menu admin

---

## 11. Estimasi Total

| Fase | Durasi | Prioritas |
|------|--------|-----------|
| Fase 1: Schema & Foundation | 1 hari | Tinggi |
| Fase 2: Server Actions | 1–2 hari | Tinggi |
| Fase 3: Integrasi Flow Cuti (tanpa DingTalk) | 1–2 hari | Tinggi |
| Fase 4: UI Komponen | 2 hari | Sedang |
| Fase 5: Testing & Polish | 1 hari | Sedang |
| **Total** | **~6–8 hari** | |

---

## 12. Catatan Teknis

- **Saldo `sisaCuti` disimpan sebagai kolom terpisah** (bukan computed on-the-fly) untuk performa query dan kemudahan reporting.
- **Update saldo dilakukan dalam transaction** bersama perubahan status pengajuan cuti untuk menjaga konsistensi data.
- **Cuti bersama mempengaruhi saldo secara batch** — saat admin menambah/hapus cuti bersama, query UPDATE dijalankan ke seluruh record `saldo_cuti_tahunan` tahun tersebut.
- **Histori saldo tahun lalu tetap tersimpan** — berguna untuk audit dan laporan tahunan.
- **Tidak ada carry-over** — saldo hangus di akhir tahun, sesuai kebijakan organisasi.
- **Cuti sakit, melahirkan, menikah, kematian** tidak memiliki saldo terbatas dan tidak mempengaruhi kuota cuti tahunan maupun kompensasi.
- **DingTalk tidak digunakan untuk approval** — seluruh flow approval berjalan di ARKA. File `submit-leave.ts` dan `sync-leave.ts` tetap dipertahankan untuk kompatibilitas masa depan, namun tidak dipanggil dalam flow aktif.
- **Fungsi `kirimCutiKeDingTalk`** di `CutiForm.tsx` akan dihapus dari flow submit. Tombol "Kirim" di `CutiManager.tsx` juga dihapus.

---

## 13. Kompatibilitas DingTalk (Masa Depan)

Jika integrasi DingTalk diaktifkan kembali di kemudian hari:

| Komponen | Penyesuaian |
|----------|-------------|
| `submit-leave.ts` | Dipanggil kembali setelah submit, status tetap `diajukan` |
| `sync-leave.ts` | Tambah logic: saat status berubah ke `disetujui`, panggil `updateSaldoCuti` |
| `approveCuti` | Bisa dipanggil dari callback DingTalk atau manual admin |
| Saldo validasi | Tetap berjalan di sisi ARKA, tidak bergantung pada DingTalk |

Arsitektur saldo cuti dirancang **agnostik terhadap sumber approval** — baik approval datang dari admin ARKA maupun callback DingTalk, logic update saldo yang sama akan dieksekusi.

---

## 14. Pertimbangan Masa Depan (Opsional)

- Carry-over saldo (jika kebijakan berubah)
- Prorata otomatis berdasarkan `tanggalMasuk` karyawan
- Notifikasi saldo menipis (sisa ≤ 2 hari)
- Import cuti bersama dari API kalender pemerintah
- Laporan penggunaan cuti per divisi (analytics)

---

## 15. Export PDF Surat Cuti

### 15.1 Konsep

Setiap pengajuan cuti yang berstatus **disetujui** dapat di-export menjadi dokumen PDF surat cuti resmi. PDF di-generate langsung dari data sistem tanpa perlu upload template — layout surat di-hardcode sesuai format standar organisasi.

Approver juga dapat **preview surat** sebelum menyetujui pengajuan.

### 15.2 Format Surat

Berdasarkan template fisik yang digunakan saat ini:

```
Jakarta, [tanggal pengajuan]

Kepada Yth.
[Nama Approver]
[Jabatan Approver]
Ikatan Akuntan Indonesia
Wilayah DKI Jakarta
Di Tempat

Dengan hormat,
Saya yang bertanda tangan dibawah ini :

Nama            : [nama karyawan]
Dept.           : [nama divisi]
Tahun Bergabung : [tahun dari tanggalMasuk]

Mengajukan cuti tanggal [tanggal mulai - selesai] untuk keperluan [alasan]

Berikut rangkuman cuti saya :

Cuti tahun [X]                    : [kuotaAwal] hari
Cuti bersama tahun [X]            : [cutiBersamaTerpakai] hari
Cuti yg sudah diambil tahun [X]   : [cutiTerpakai sebelumnya] hari
Cuti yg diambil bulan [bulan ini] : [jumlahHari] hari
Sisa cuti tahun [X]               : [sisaCuti setelah] hari

Demikian saya sampaikan, atas perhatiannya saya ucapkan terima kasih.

Hormat saya,                              Menyetujui,

( [Nama Karyawan] )                       ( [Nama Approver] )
                                          [Jabatan Approver]
                                          ─────────────────────────
                                          Disetujui digital via ARKA
                                          [tanggal approve] · [ID Approval]

Catatan :
No. Telepon yang dapat dihubungi selama cuti : [noHp]
```

### 15.3 Sumber Data

| Field di Surat | Sumber di ARKA |
|----------------|----------------|
| Nama karyawan | `users.namaLengkap` |
| Dept | `divisi.nama` |
| Tahun Bergabung | `users.tanggalMasuk` (ambil tahun) |
| Tanggal cuti | `pengajuanCuti.tanggalMulai` / `tanggalSelesai` |
| Alasan | `pengajuanCuti.alasan` |
| Rangkuman saldo | `saldoCutiTahunan` |
| Nama Approver | `users.namaLengkap` (dari `approvedBy`) |
| Jabatan Approver | `users.jabatan` (dari `approvedBy`) |
| Tanggal approve | `pengajuanCuti.approvedAt` |
| ID Approval | Format: `APR-[tahun]-[5 digit sequential]` |
| No HP | `users.noHp` |

### 15.4 Validasi Persetujuan (Stempel Digital)

Tidak menggunakan tanda tangan gambar. Sebagai gantinya, di area "Menyetujui" tercetak **stempel digital otomatis**:

- Nama & jabatan approver
- Keterangan "Disetujui digital via ARKA"
- Tanggal & waktu persetujuan
- ID Approval unik (bisa di-cross check di sistem)

Approver tidak perlu melakukan langkah tambahan — cukup klik "Setujui" dan stempel otomatis ter-generate.

### 15.5 Alur

1. Karyawan ajukan cuti → status `diajukan`
2. Approver buka halaman approval → klik **"Lihat Surat"** → preview surat cuti di browser
3. Approver review → klik **Setujui** atau **Tolak**
4. Setelah disetujui → tombol **"Cetak PDF"** muncul (bisa diakses karyawan & approver)
5. PDF di-generate dengan stempel digital approval

### 15.6 Implementasi

- [x] Server action: `getDataSuratCuti(pengajuanCutiId)` — kumpulkan semua data untuk surat
- [x] Komponen `PreviewSuratCuti.tsx` — render surat di browser (untuk preview approver)
- [x] PDF generator: `generatePdfSuratCuti(pengajuanCutiId)` — generate PDF via `jspdf`
- [x] Tombol "Lihat Surat" di `CutiApproval.tsx`
- [x] Tombol "Cetak PDF" di `CutiManager.tsx` (hanya status `disetujui`)
- [x] Generate ID Approval unik saat approve (format: `APR-2026-00001`)

### 15.7 Status

> ✅ **Selesai diimplementasi.**
