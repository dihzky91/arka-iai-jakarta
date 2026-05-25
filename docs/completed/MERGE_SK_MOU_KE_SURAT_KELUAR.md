# Merge Surat Keputusan & MOU ke Surat Keluar

## Status
Selesai diimplementasikan

Audit implementasi: 24 Mei 2026 (Asia/Jakarta) — lint bersih; typecheck tidak ada error baru.

---

## 1. Latar Belakang

### Kondisi Saat Ini
- Jenis "Keputusan" dan "MOU" **sudah ada** di dropdown form surat keluar
- Tapi ada **menu terpisah** di sidebar Administrasi: "Surat Keputusan" dan "Surat MOU"
- Menu terpisah ini punya tabel database sendiri (`surat_keputusan`, `surat_mou`) dengan field lebih detail
- Penomoran SK dan MOU di menu terpisah = **input manual** (tidak ikut counter unified)
- Ini menyebabkan **duplikasi**: user bisa catat SK di dua tempat berbeda

### Realita Organisasi
- SK dan MOU **ikut urutan nomor surat keluar** (satu logbook, satu counter per bulan)
- Tidak ada alasan untuk memisahkan mereka dari surat keluar
- Yang membedakan hanya: SK/MOU punya field tambahan (tentang, tanggal berlaku, pihak kedua, dll)

### Tujuan
- Menghilangkan duplikasi — satu sumber kebenaran untuk semua surat keluar
- SK dan MOU ikut counter unified dan workflow yang sama
- Field tambahan ditampilkan kondisional di form surat keluar
- Tetap mudah dicari via filter cepat

---

## 2. Pendekatan: A + B

**A: Merge ke surat keluar** — Tambah field-field SK/MOU sebagai kolom opsional di `surat_keluar`. Form tampilkan field tambahan secara kondisional berdasarkan jenis.

**B: Filter cepat** — Di halaman surat keluar, sediakan tab/chip filter untuk "Semua / Keputusan / MOU" supaya tetap gampang dicari tanpa perlu menu terpisah.

---

## 3. Mapping Field

### Field yang Perlu Ditambahkan ke `surat_keluar`

| Field Baru | Asal | Tipe | Nullable | Keterangan |
|-----------|------|------|----------|------------|
| `tentang` | SK | text | ✅ | Hanya terisi jika jenis = keputusan |
| `tanggal_berlaku` | SK, MOU | date | ✅ | Tanggal mulai berlaku |
| `tanggal_berakhir` | SK, MOU | date | ✅ | Tanggal berakhir |
| `pihak_kedua` | MOU | varchar(200) | ✅ | Nama pihak kedua MOU |
| `pihak_kedua_alamat` | MOU | text | ✅ | Alamat pihak kedua |
| `nilai_kerjasama` | MOU | text | ✅ | Nilai kerjasama MOU |

### Mapping Field Existing

| Field SK/MOU | Mapping ke Surat Keluar |
|-------------|------------------------|
| `nomorSK` / `nomorMOU` | → `nomorSurat` (ikut counter unified) |
| `perihal` | → `perihal` (sudah ada) |
| `tanggalSK` / `tanggalMOU` | → `tanggalSurat` (sudah ada) |
| `pejabatId` | → `pejabatId` (sudah ada) |
| `fileUrl` | → `fileDraftUrl` (sudah ada) |
| `qrCodeUrl` | → `qrCodeUrl` (sudah ada) |
| `dibuatOleh` | → `dibuatOleh` (sudah ada) |

### Field SK yang Perlu Penyesuaian

| Field SK | Catatan |
|----------|---------|
| `tentang` | Di SK ini wajib. Di surat keluar jadi opsional tapi **wajib jika jenis = keputusan** (validasi di Zod) |

### Field MOU yang Perlu Penyesuaian

| Field MOU | Catatan |
|-----------|---------|
| `pihakKedua` | Di MOU ini wajib. Di surat keluar jadi opsional tapi **wajib jika jenis = mou** (validasi di Zod) |
| `tujuan` (surat keluar) | Untuk MOU, `tujuan` = `pihakKedua`. Bisa auto-fill |

---

## 4. Perubahan Database

### 4.1 Migration: Tambah Kolom ke `surat_keluar`

```sql
ALTER TABLE surat_keluar
  ADD COLUMN IF NOT EXISTS tentang TEXT,
  ADD COLUMN IF NOT EXISTS tanggal_berlaku DATE,
  ADD COLUMN IF NOT EXISTS tanggal_berakhir DATE,
  ADD COLUMN IF NOT EXISTS pihak_kedua VARCHAR(200),
  ADD COLUMN IF NOT EXISTS pihak_kedua_alamat TEXT,
  ADD COLUMN IF NOT EXISTS nilai_kerjasama TEXT;
```

### 4.2 Migration: Migrasi Data dari Tabel Lama

```sql
-- Migrasi Surat Keputusan → surat_keluar
INSERT INTO surat_keluar (
  id, nomor_surat, perihal, tujuan, tanggal_surat, jenis_surat,
  tentang, tanggal_berlaku, tanggal_berakhir,
  pejabat_id, file_draft_url, qr_code_url, dibuat_oleh,
  status, created_at, updated_at
)
SELECT
  id,
  nomor_sk,
  perihal,
  '(Surat Keputusan)' AS tujuan,  -- SK tidak punya tujuan eksplisit
  tanggal_sk,
  'keputusan',
  tentang,
  tanggal_berlaku,
  tanggal_berakhir,
  pejabat_id,
  file_url,
  qr_code_url,
  dibuat_oleh,
  'selesai',  -- SK existing dianggap sudah selesai
  created_at,
  updated_at
FROM surat_keputusan
ON CONFLICT (id) DO NOTHING;

-- Migrasi Surat MOU → surat_keluar
INSERT INTO surat_keluar (
  id, nomor_surat, perihal, tujuan, tanggal_surat, jenis_surat,
  pihak_kedua, pihak_kedua_alamat, tanggal_berlaku, tanggal_berakhir, nilai_kerjasama,
  pejabat_id, file_draft_url, qr_code_url, dibuat_oleh,
  status, created_at, updated_at
)
SELECT
  id,
  nomor_mou,
  perihal,
  pihak_kedua AS tujuan,  -- Pihak kedua = tujuan
  tanggal_mou,
  'mou',
  pihak_kedua,
  pihak_kedua_alamat,
  tanggal_berlaku,
  tanggal_berakhir,
  nilai_kerjasama,
  pejabat_id,
  file_url,
  qr_code_url,
  dibuat_oleh,
  'selesai',  -- MOU existing dianggap sudah selesai
  created_at,
  updated_at
FROM surat_mou
ON CONFLICT (id) DO NOTHING;
```

### 4.3 Tabel Lama: Soft Deprecate

Tidak langsung drop — biarkan dulu untuk safety net. Drop di migration berikutnya setelah validasi data.

```sql
-- Rename tabel lama (soft deprecate, bisa di-drop nanti)
-- ALTER TABLE surat_keputusan RENAME TO _deprecated_surat_keputusan;
-- ALTER TABLE surat_mou RENAME TO _deprecated_surat_mou;
```

---

## 5. Perubahan Schema Drizzle

### 5.1 Tambah Kolom di `suratKeluar`

```typescript
export const suratKeluar = pgTable("surat_keluar", {
  // ... existing fields ...

  // Field tambahan untuk SK
  tentang: text("tentang"),

  // Field tambahan untuk SK & MOU
  tanggalBerlaku: date("tanggal_berlaku"),
  tanggalBerakhir: date("tanggal_berakhir"),

  // Field tambahan untuk MOU
  pihakKedua: varchar("pihak_kedua", { length: 200 }),
  pihakKeduaAlamat: text("pihak_kedua_alamat"),
  nilaiKerjasama: text("nilai_kerjasama"),
});
```

---

## 6. Perubahan Validator (Zod)

### 6.1 Update `suratKeluarCreateSchema`

```typescript
export const suratKeluarCreateSchema = z.object({
  perihal: z.string().min(1),
  tujuan: z.string().min(1),
  tujuanAlamat: z.string().optional(),
  tanggalSurat: isoDate,
  jenisSurat: z.enum(jenisSuratValues),
  isiSingkat: z.string().optional(),
  prosesViaSimpeg: z.boolean().optional().default(false),

  // Field kondisional SK
  tentang: z.string().optional(),

  // Field kondisional SK & MOU
  tanggalBerlaku: isoDate.optional(),
  tanggalBerakhir: isoDate.optional(),

  // Field kondisional MOU
  pihakKedua: z.string().optional(),
  pihakKeduaAlamat: z.string().optional(),
  nilaiKerjasama: z.string().optional(),
}).superRefine((data, ctx) => {
  // Validasi kondisional: jika keputusan, tentang wajib
  if (data.jenisSurat === "keputusan" && !data.tentang?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Field 'Tentang' wajib diisi untuk Surat Keputusan.",
      path: ["tentang"],
    });
  }

  // Validasi kondisional: jika mou, pihakKedua wajib
  if (data.jenisSurat === "mou" && !data.pihakKedua?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Field 'Pihak Kedua' wajib diisi untuk Surat MOU.",
      path: ["pihakKedua"],
    });
  }
});
```

---

## 7. Perubahan UI

### 7.1 Form Surat Keluar — Field Kondisional

Saat user pilih jenis surat:

**Jika jenis = "keputusan":**
- Tampilkan field: `tentang` (wajib), `tanggalBerlaku`, `tanggalBerakhir`
- Label "Tujuan" bisa diganti jadi "Ditujukan Kepada" atau auto-fill "(Surat Keputusan)"

**Jika jenis = "mou":**
- Tampilkan field: `pihakKedua` (wajib), `pihakKeduaAlamat`, `tanggalBerlaku`, `tanggalBerakhir`, `nilaiKerjasama`
- Auto-fill `tujuan` = `pihakKedua` (atau sync)

**Jenis lainnya:**
- Form tetap seperti sekarang (tidak ada field tambahan)

### 7.2 Halaman Surat Keluar — Filter Cepat

Tambah tab/chip filter di atas tabel:

```
[ Semua ] [ Keputusan ] [ MOU ] [ Undangan ] [ Permohonan ] ...
```

Atau minimal:
```
[ Semua ] [ SK ] [ MOU ]
```

Ini menggantikan kebutuhan menu terpisah — user bisa langsung filter ke SK atau MOU dari halaman surat keluar.

### 7.3 Tabel Surat Keluar — Kolom Tambahan

Untuk surat jenis keputusan/mou, tampilkan info tambahan di detail/stepper:
- SK: "Tentang: ...", "Berlaku: ... s/d ..."
- MOU: "Pihak Kedua: ...", "Nilai: ...", "Berlaku: ... s/d ..."

### 7.4 Hapus Menu Terpisah

- Hapus menu "Surat Keputusan" dari sidebar Administrasi
- Hapus menu "Surat MOU" dari sidebar Administrasi
- Route `/surat-keputusan` → redirect ke `/surat-keluar?jenis=keputusan`
- Route `/surat-mou` → redirect ke `/surat-keluar?jenis=mou`

### 7.5 Halaman Verifikasi

- `/verifikasi/surat-keputusan/[id]` → redirect ke `/verifikasi/surat-keluar/[id]`
- `/verifikasi/surat-mou/[id]` → redirect ke `/verifikasi/surat-keluar/[id]`
- Halaman verifikasi surat keluar tampilkan info tambahan jika jenis = keputusan/mou

---

## 8. Perubahan Server Actions

### 8.1 Update `createSuratKeluar` / `updateSuratKeluar`

Handle field baru: `tentang`, `tanggalBerlaku`, `tanggalBerakhir`, `pihakKedua`, `pihakKeduaAlamat`, `nilaiKerjasama`.

### 8.2 Deprecate Actions Lama

File-file berikut bisa di-deprecate (hapus setelah migrasi stabil):
- `src/server/actions/suratKeputusan.ts`
- `src/server/actions/suratMou.ts` (jika ada)
- `src/lib/validators/suratKeputusan.schema.ts`
- `src/lib/validators/suratMou.schema.ts`

### 8.3 Update Referensi

- `src/server/actions/pegawai.ts` — cek relasi pegawai ke SK/MOU → ubah ke query `surat_keluar` dengan filter jenis
- `src/server/actions/pejabat.ts` — cek relasi pejabat ke SK/MOU → ubah ke query `surat_keluar` dengan filter jenis
- `src/server/actions/search.ts` — jika ada search SK/MOU terpisah, merge ke search surat keluar
- `src/lib/qr/generateQR.ts` — update jenis verifikasi

---

## 9. Perubahan Komponen

### Hapus (setelah migrasi stabil)
- `src/components/surat-keputusan/SuratKeputusanManager.tsx`
- `src/components/surat-keputusan/SuratKeputusanForm.tsx`
- `src/components/surat-mou/` (semua file)
- `src/app/(dashboard)/surat-keputusan/`
- `src/app/(dashboard)/surat-mou/`

### Update
- `src/components/surat-keluar/SuratKeluarForm.tsx` — tambah field kondisional
- `src/components/surat-keluar/SuratKeluarManager.tsx` — tambah filter cepat
- `src/components/surat-keluar/SuratKeluarStepper.tsx` — tampilkan info SK/MOU di detail
- `src/components/layout/navigation.ts` — hapus menu SK & MOU dari Administrasi

---

## 10. Rencana Implementasi Bertahap

### Phase 1 — Database & Schema
- [x] Migration: tambah kolom baru ke `surat_keluar`
- [x] Migration: migrasi data dari `surat_keputusan` dan `surat_mou`
- [x] Update Drizzle schema
- [x] Update Zod validator dengan field kondisional + superRefine

### Phase 2 — Server Actions
- [x] Update `createSuratKeluar` / `updateSuratKeluar` — handle field baru
- [x] Update `pegawai.ts` — ubah referensi ke surat_keluar
- [x] Update `pejabat.ts` — ubah referensi ke surat_keluar
- [x] Update QR generation — unify jenis verifikasi

### Phase 3 — UI Form & Filter
- [x] Update `SuratKeluarForm.tsx` — field kondisional per jenis
- [x] Update `SuratKeluarManager.tsx` — tambah filter cepat (tab/chip)
- [x] Update `SuratKeluarStepper.tsx` — info tambahan SK/MOU di detail
- [x] Update halaman verifikasi — tampilkan info SK/MOU

### Phase 4 — Cleanup
- [x] Hapus menu SK & MOU dari navigation
- [x] Buat redirect route `/surat-keputusan` → `/surat-keluar?jenis=keputusan`
- [x] Buat redirect route `/surat-mou` → `/surat-keluar?jenis=mou`
- [x] Buat redirect verifikasi lama ke verifikasi surat keluar
- [x] Hapus komponen & actions lama
- [x] Lint + typecheck clean (ESLint OK)

### Phase 5 — Drop Tabel Lama
- [x] Drop tabel `surat_keputusan` (migration 0062)
- [x] Drop tabel `surat_mou` (migration 0062)
- [x] Hapus definisi tabel dari Drizzle schema
- [x] Hapus type exports `SuratKeputusan` & `SuratMou`
- [x] Hapus file actions & komponen lama (`suratKeputusan.ts`, `suratMou.ts`, validators, components)

---

## 11. Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Data SK/MOU lama hilang saat migrasi | Migrasi INSERT ... ON CONFLICT DO NOTHING; tabel lama tidak langsung di-drop |
| Nomor SK/MOU lama format berbeda | Tetap tersimpan di `nomor_surat` as-is; nomor baru ikut counter unified |
| User terbiasa dengan menu terpisah | Redirect otomatis + filter cepat di halaman surat keluar |
| QR verifikasi lama (link ke /verifikasi/surat-keputusan/) | Redirect ke halaman verifikasi surat keluar |
| Form surat keluar jadi terlalu panjang | Field kondisional — hanya muncul sesuai jenis yang dipilih |
| ID collision saat migrasi (SK/MOU id sama dengan surat keluar id) | UUID — kemungkinan collision sangat kecil; ON CONFLICT DO NOTHING sebagai safety |

---

## 12. Catatan

- Setelah merge, **semua surat keluar** (termasuk SK dan MOU) ikut workflow yang sama: Draft → Persetujuan → Reviu → Pengarsipan → Selesai
- SK dan MOU yang dimigrasi langsung berstatus "selesai" (karena sudah tercatat sebelumnya)
- Penomoran SK/MOU baru otomatis ikut counter unified per bulan
- Export CSV surat keluar otomatis mencakup SK dan MOU (bisa filter per jenis)
