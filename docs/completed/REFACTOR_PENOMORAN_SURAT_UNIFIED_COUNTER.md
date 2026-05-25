# Refactor Penomoran Surat — Unified Counter per Bulan

## Status
Selesai diimplementasikan

Audit implementasi: 24 Mei 2026 (Asia/Jakarta) — lint bersih; typecheck tidak ada error baru.

---

## 1. Latar Belakang & Masalah

### Kondisi Saat Ini (Salah)
- Counter **terpisah per jenis surat** — unique constraint: `(tahun, bulan, jenis_surat)`
- Format nomor: `{counter}/{prefix}/{bulanRomawi}/{tahun}` → contoh: `12/IAI-DKIJKT/IV/2026`
- "Prefix" di sistem = prefix organisasi, disimpan per counter row
- Staff harus ingat/setting prefix sebelum generate

### Realita Logbook Manual (Yang Benar)
- Counter **satu urutan per bulan** — semua jenis surat pakai nomor urut yang sama
- Format nomor: `{counter}/{kode_jenis}/{prefix_organisasi}/{bulanRomawi}/{tahun}`
- Contoh: `01/DE/IAI-DKIJKT/VI/2026`, `02/K/IAI-DKIJKT/VI/2026`
- Segmen ke-2 = **kode jenis** (DE, K, dll) — bervariasi per surat
- Segmen ke-3 = **prefix organisasi** (IAI-DKIJKT) — tetap/jarang berubah, di-setting sekali
- Counter reset ke 1 setiap awal bulan baru

### Gap yang Harus Diperbaiki
| # | Masalah | Solusi |
|---|---------|--------|
| 1 | Counter terpisah per jenis | Unified: satu counter per bulan |
| 2 | Format nomor tidak ada segmen kode jenis | Tambah kode jenis di segmen ke-2 |
| 3 | Prefix = organisasi, padahal yang bervariasi = kode jenis | Pisahkan konsep: kode jenis (dinamis) vs prefix organisasi (setting global) |

---

## 2. Desain Baru

### 2.1 Format Nomor Surat

```
{counter}/{kodeJenis}/{prefixOrganisasi}/{bulanRomawi}/{tahun}
```

Contoh:
- `01/DE/IAI-DKIJKT/VI/2026`
- `02/K/IAI-DKIJKT/VI/2026`
- `03/P/IAI-DKIJKT/VI/2026`

### 2.2 Konsep

| Konsep | Penjelasan | Siapa yang atur |
|--------|-----------|-----------------|
| Counter | Nomor urut, satu sequence per bulan, reset tiap bulan baru | Otomatis (sistem) |
| Kode Jenis | Singkatan jenis surat (DE, K, P, dll) | Admin — configurable via tabel master |
| Prefix Organisasi | Identitas organisasi (IAI-DKIJKT) | Admin — setting global di System Settings |

### 2.3 Kode Jenis Surat (Master Data — Configurable)

Tabel baru `kode_jenis_surat` — admin bisa CRUD:

| Jenis Surat (enum existing) | Kode Default | Keterangan |
|------------------------------|-------------|------------|
| undangan | (ditentukan admin) | Misal: DE, U, dll |
| permohonan | (ditentukan admin) | Misal: P |
| keputusan | (ditentukan admin) | Misal: K |
| pemberitahuan | (ditentukan admin) | Misal: PB |
| edaran | (ditentukan admin) | Misal: E |
| balasan | (ditentukan admin) | Misal: B |
| keterangan | (ditentukan admin) | Misal: KT |
| tugas | (ditentukan admin) | Misal: T |
| mou | (ditentukan admin) | Misal: MOU |
| invoice | (ditentukan admin) | Misal: INV |
| lainnya | (ditentukan admin) | Misal: L |

Admin bisa mengubah kode kapan saja. Perubahan hanya berlaku untuk nomor surat baru — nomor yang sudah tergenerate tidak berubah.

---

## 3. Perubahan Database

### 3.1 Tabel Baru: `kode_jenis_surat`

```sql
CREATE TABLE kode_jenis_surat (
  id SERIAL PRIMARY KEY,
  jenis_surat jenis_surat NOT NULL UNIQUE,  -- FK ke enum existing
  kode VARCHAR(20) NOT NULL,                 -- "DE", "K", "P", dll
  keterangan VARCHAR(200),                   -- deskripsi opsional
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed default (admin bisa ubah nanti)
INSERT INTO kode_jenis_surat (jenis_surat, kode, keterangan) VALUES
  ('undangan', 'U', 'Undangan'),
  ('permohonan', 'P', 'Permohonan'),
  ('keputusan', 'K', 'Keputusan'),
  ('pemberitahuan', 'PB', 'Pemberitahuan'),
  ('edaran', 'E', 'Edaran'),
  ('balasan', 'B', 'Balasan'),
  ('keterangan', 'KT', 'Keterangan'),
  ('tugas', 'T', 'Tugas'),
  ('mou', 'MOU', 'MOU'),
  ('invoice', 'INV', 'Invoice'),
  ('lainnya', 'L', 'Lainnya');
```

### 3.2 Ubah Tabel: `nomor_surat_counter`

Ubah unique constraint dari `(tahun, bulan, jenis_surat)` → `(tahun, bulan)`:

```sql
-- Drop old constraint
DROP INDEX nomor_surat_counter_period_uniq;

-- Merge existing counters per bulan (ambil MAX counter per bulan)
-- PENTING: migrasi data dulu sebelum ubah constraint
-- Strategi: buat row baru per (tahun, bulan) dengan counter = SUM semua jenis

-- Hapus kolom jenis_surat dari counter (tidak relevan lagi)
ALTER TABLE nomor_surat_counter DROP COLUMN jenis_surat;

-- Buat unique constraint baru
CREATE UNIQUE INDEX nomor_surat_counter_period_uniq ON nomor_surat_counter (tahun, bulan);
```

**Catatan migrasi**: Karena sebelumnya counter terpisah per jenis, perlu merge. Opsi:
- Ambil SUM counter per (tahun, bulan) sebagai counter unified
- Atau reset dan mulai fresh dari bulan depan (lebih aman, nomor lama sudah tersimpan di field `nomor_surat` masing-masing surat)

### 3.3 Tambah Field di `system_settings`

```sql
ALTER TABLE system_settings
  ADD COLUMN prefix_organisasi VARCHAR(80) NOT NULL DEFAULT 'IAI-DKIJKT';
```

### 3.4 Hapus Kolom `prefix` dari `nomor_surat_counter`

Prefix organisasi sekarang di system_settings (global), bukan per counter row.

```sql
ALTER TABLE nomor_surat_counter DROP COLUMN prefix;
```

---

## 4. Perubahan Kode

### 4.1 Schema Drizzle

```typescript
// Tabel baru
export const kodeJenisSurat = pgTable("kode_jenis_surat", {
  id: serial("id").primaryKey(),
  jenisSurat: jenisSuratEnum("jenis_surat").notNull().unique(),
  kode: varchar("kode", { length: 20 }).notNull(),
  keterangan: varchar("keterangan", { length: 200 }),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Update nomor_surat_counter — hapus jenisSurat & prefix
export const nomorSuratCounter = pgTable(
  "nomor_surat_counter",
  {
    id: serial("id").primaryKey(),
    tahun: integer("tahun").notNull(),
    bulan: integer("bulan").notNull(),
    counter: integer("counter").default(0).notNull(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    uniqPeriod: uniqueIndex("nomor_surat_counter_period_uniq").on(
      t.tahun,
      t.bulan,
    ),
  }),
);

// Update system_settings — tambah prefixOrganisasi
// Di tabel systemSettings:
prefixOrganisasi: varchar("prefix_organisasi", { length: 80 }).notNull().default("IAI-DKIJKT"),
```

### 4.2 `src/lib/nomor-surat.ts` — Refactor

```typescript
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { formatBulanRomawi } from "@/lib/utils";

type DbExecutor = Pick<typeof db, "execute">;

type AllocateNomorSuratInput = {
  tahun: number;
  bulan: number;
  kodeJenis: string;          // "DE", "K", "P" — dari tabel kode_jenis_surat
  prefixOrganisasi: string;   // "IAI-DKIJKT" — dari system_settings
  jumlah?: number;
};

export type AllocateNomorSuratResult = {
  nomorList: string[];
  kodeJenis: string;
  prefixOrganisasi: string;
  bulanRomawi: string;
  tahun: number;
  startCounter: number;
  endCounter: number;
  jumlah: number;
};

export async function allocateNomorSurat(
  input: AllocateNomorSuratInput,
  executor: DbExecutor = db,
): Promise<AllocateNomorSuratResult> {
  const jumlah = input.jumlah ?? 1;

  const upsert = await executor.execute(sql`
    INSERT INTO nomor_surat_counter (tahun, bulan, counter, updated_at)
    VALUES (${input.tahun}, ${input.bulan}, ${jumlah}, NOW())
    ON CONFLICT (tahun, bulan)
    DO UPDATE SET
      counter = nomor_surat_counter.counter + ${jumlah},
      updated_at = NOW()
    RETURNING counter
  `);

  const row = (upsert.rows as { counter: number }[])[0];
  if (!row) {
    throw new Error(
      jumlah > 1 ? "Gagal menggenerate bulk nomor surat" : "Gagal menggenerate nomor surat",
    );
  }

  const endCounter = row.counter;
  const startCounter = endCounter - jumlah + 1;
  const bulanRomawi = formatBulanRomawi(input.bulan);

  const nomorList = Array.from({ length: jumlah }, (_, index) => {
    const counter = startCounter + index;
    return `${counter}/${input.kodeJenis}/${input.prefixOrganisasi}/${bulanRomawi}/${input.tahun}`;
  });

  return {
    nomorList,
    kodeJenis: input.kodeJenis,
    prefixOrganisasi: input.prefixOrganisasi,
    bulanRomawi,
    tahun: input.tahun,
    startCounter,
    endCounter,
    jumlah,
  };
}
```

### 4.3 Caller Updates

Semua pemanggil `allocateNomorSurat` perlu diupdate:
- `src/server/actions/suratKeluar.ts` — `assignNomorSuratKeluar`, `bulkAssignNomorSuratKeluar`
- `src/server/actions/nomor.ts` — generator manual
- `src/server/actions/invoice.ts` — invoice allocation

Sebelum memanggil `allocateNomorSurat`, caller harus:
1. Lookup `kodeJenis` dari tabel `kode_jenis_surat` berdasarkan `jenisSurat` surat tersebut
2. Ambil `prefixOrganisasi` dari `system_settings`

### 4.4 UI — Halaman Admin Nomor Surat

Perubahan:
- Hapus dropdown "Jenis Surat" dari generator (counter unified)
- Riwayat counter: satu baris per bulan (bukan per jenis)
- Tambah section: "Kode Jenis Surat" — tabel CRUD untuk mapping jenis → kode
- Prefix organisasi pindah ke halaman Pengaturan (system settings)

### 4.5 UI — Halaman Pengaturan (System Settings)

Tambah field:
- "Prefix Organisasi Surat" — input text, default "IAI-DKIJKT"

### 4.6 UI — Stepper Surat Keluar

Tidak banyak berubah — tombol "Generate Otomatis" tetap ada, hanya output format-nya yang berubah.

---

## 5. Alur Generate Nomor Surat (Setelah Refactor)

```
Staff buat surat keluar (jenis: undangan)
  → Klik "Generate Otomatis" di step Draft
  → Sistem lookup kode jenis "undangan" → "DE" (dari tabel kode_jenis_surat)
  → Sistem ambil prefix organisasi → "IAI-DKIJKT" (dari system_settings)
  → allocateNomorSurat({ tahun: 2026, bulan: 6, kodeJenis: "DE", prefixOrganisasi: "IAI-DKIJKT" })
  → Counter bulan 6/2026 increment: 1 → 2
  → Hasil: "02/DE/IAI-DKIJKT/VI/2026"
```

Staff tidak perlu:
- ❌ Ke halaman admin setting prefix dulu
- ❌ Ingat-ingat kode jenis
- ❌ Pilih jenis surat lagi (sudah ada di data surat)

---

## 6. Migrasi Data

### Strategi: Soft Reset

Karena nomor surat yang sudah tergenerate tersimpan di field `surat_keluar.nomor_surat` (string final), counter table hanya untuk tracking nomor berikutnya. Strategi:

1. Untuk bulan berjalan (Mei 2026): hitung total surat keluar yang sudah punya nomor di bulan ini → set counter unified = jumlah tersebut
2. Untuk bulan-bulan lama: tidak perlu dimigrasi (sudah lewat, tidak akan generate nomor baru)
3. Nomor surat existing di `surat_keluar.nomor_surat` **tidak diubah** — tetap format lama

### Script Migrasi

```sql
-- 1. Buat tabel kode_jenis_surat
-- 2. Tambah prefix_organisasi ke system_settings
-- 3. Merge counter: untuk bulan aktif, set counter = SUM semua jenis di bulan itu
-- 4. Drop kolom jenis_surat dan prefix dari nomor_surat_counter
-- 5. Buat ulang unique index
```

---

## 7. Rencana Implementasi

### Phase 1 — Database & Core Logic
- [x] Migration: buat tabel `kode_jenis_surat` + seed
- [x] Migration: tambah `prefix_organisasi` ke `system_settings`
- [x] Migration: merge counter + ubah constraint `nomor_surat_counter`
- [x] Update Drizzle schema
- [x] Refactor `src/lib/nomor-surat.ts`
- [x] Update semua caller (`suratKeluar.ts`, `nomor.ts`, `invoice.ts`)

### Phase 2 — UI Admin
- [x] Halaman Pengaturan: tambah field "Prefix Organisasi Surat"
- [x] Halaman Nomor Surat: simplifikasi (hapus dropdown jenis, satu counter per bulan)
- [x] Halaman Nomor Surat: tambah section CRUD "Kode Jenis Surat"

### Phase 3 — Validasi & Cleanup
- [x] Pastikan stepper surat keluar tetap berfungsi
- [x] Pastikan bulk assign tetap berfungsi
- [x] Pastikan invoice allocation tetap berfungsi
- [x] Lint + typecheck clean

---

## 8. Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Nomor surat lama format berbeda | Tidak diubah — field `nomor_surat` tetap as-is |
| Admin belum setup kode jenis | Seed default saat migrasi; validasi: jika kode belum ada, tolak generate dengan pesan jelas |
| Counter bulan berjalan mismatch setelah merge | Hitung ulang dari data aktual surat yang sudah punya nomor |
| Prefix organisasi kosong | Default "IAI-DKIJKT", field NOT NULL |

---

## 9. Catatan

- Kode jenis surat sengaja **tidak di-hardcode** — admin bisa ubah sesuai kebutuhan organisasi
- Prefix organisasi di system_settings karena sifatnya global dan jarang berubah
- Counter tetap atomic (INSERT ON CONFLICT) untuk menghindari race condition
- Format nomor manual tetap diizinkan (untuk kasus backdate/koreksi) — tidak terpengaruh refactor ini
