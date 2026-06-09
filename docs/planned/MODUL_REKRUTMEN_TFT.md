# Blueprint: Modul Rekrutmen TFT (Training for Trainers)

## Ringkasan

Modul untuk mengelola pendaftaran dan penilaian calon instruktur Brevet AB/C melalui program Training for Trainers (TFT). Menggantikan penggunaan Google Form dengan form terintegrasi langsung ke ekosistem ARKA — khususnya modul Instruktur dan Jadwal Otomatis.

---

## Konteks Bisnis

- IAI Jakarta secara berkala mengadakan TFT untuk merekrut calon instruktur baru atau me-refresh instruktur existing.
- Sebelumnya menggunakan Google Form → data di-entry ulang manual ke sistem.
- Penilaian dilakukan oleh penilai profesional/senior menggunakan form kertas yang dicetak, lalu diinput admin setelah selesai.
- Dengan modul ini, seluruh proses (pendaftaran → penilaian → keputusan → convert ke instruktur) terintegrasi dalam satu sistem.

---

## Arsitektur

### Halaman

| Route | Akses | Deskripsi |
|-------|-------|-----------|
| `/jadwal-otomatis/tft` | Admin (login) | Daftar periode TFT |
| `/jadwal-otomatis/tft/[id]` | Admin (login) | Detail periode (tabs: Pendaftar, Penilaian, Hasil) |
| `/jadwal-otomatis/tft/[id]/input-nilai` | Admin (login) | Input nilai spreadsheet-style |
| `/daftar/tft/[slug]` | Publik (tanpa login) | Form pendaftaran untuk calon instruktur |
| `/daftar/tft/[slug]/sukses` | Publik (tanpa login) | Halaman konfirmasi setelah submit |

### Database Schema (5 tabel baru)

```sql
-- Periode TFT yang dibuka admin
CREATE TABLE periode_tft (
  id TEXT PRIMARY KEY,
  judul VARCHAR(300) NOT NULL,           -- "TFT Brevet AB Mei 2024"
  slug VARCHAR(100) NOT NULL UNIQUE,      -- untuk public URL
  deskripsi TEXT,                          -- rich text deskripsi kegiatan
  tanggal_mulai DATE NOT NULL,            -- tanggal pelaksanaan TFT
  tanggal_selesai DATE NOT NULL,
  waktu_mulai VARCHAR(5),                 -- "08:00"
  waktu_selesai VARCHAR(5),               -- "17:00"
  lokasi VARCHAR(300),
  batas_pendaftaran TIMESTAMP,            -- deadline form ditutup otomatis
  status VARCHAR(20) NOT NULL DEFAULT 'draft',  -- draft | buka | tutup | penilaian | selesai
  program VARCHAR(50) NOT NULL,           -- "brevet_ab" | "brevet_c" | "all"
  max_peserta INTEGER,                    -- null = unlimited
  skor_minimum NUMERIC(5,2),             -- threshold kelulusan (misal 70.00), null = manual
  catatan_internal TEXT,                   -- catatan admin
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Pendaftar TFT
CREATE TABLE pendaftar_tft (
  id TEXT PRIMARY KEY,
  periode_id TEXT NOT NULL REFERENCES periode_tft(id) ON DELETE CASCADE,
  nama_lengkap VARCHAR(200) NOT NULL,
  email VARCHAR(150) NOT NULL,
  no_hp VARCHAR(30) NOT NULL,
  pekerjaan TEXT,
  alamat_pekerjaan TEXT,
  alamat_domisili TEXT,
  materi_brevet_ab TEXT[] DEFAULT '{}',    -- array materi AB yang dikuasai
  materi_brevet_c TEXT[] DEFAULT '{}',     -- array materi C yang dikuasai
  bersedia_hadir BOOLEAN NOT NULL DEFAULT true,
  cv_storage_key TEXT,                     -- key di storage ARKA (Cloudinary/local)
  cv_original_name VARCHAR(300),           -- nama file asli untuk display
  status VARCHAR(20) NOT NULL DEFAULT 'baru',  -- baru | review | diterima | ditolak
  skor_akhir NUMERIC(5,2),               -- rata-rata tertimbang dari semua penilai (computed)
  catatan_admin TEXT,                      -- catatan reviewer
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TIMESTAMP,
  instructor_id TEXT REFERENCES instructors(id),  -- link ke instruktur jika diterima
  submitted_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pendaftar_periode ON pendaftar_tft(periode_id);
CREATE INDEX idx_pendaftar_email ON pendaftar_tft(email);
CREATE INDEX idx_pendaftar_status ON pendaftar_tft(status);
CREATE UNIQUE INDEX uniq_pendaftar_periode_email ON pendaftar_tft(periode_id, email);

-- Kriteria penilaian (customizable per periode)
CREATE TABLE kriteria_penilaian_tft (
  id TEXT PRIMARY KEY,
  periode_id TEXT NOT NULL REFERENCES periode_tft(id) ON DELETE CASCADE,
  nama VARCHAR(200) NOT NULL,             -- "Penguasaan Materi"
  deskripsi TEXT,                          -- penjelasan kriteria (tampil di form cetak)
  bobot NUMERIC(5,2) NOT NULL,            -- persen, total semua kriteria harus = 100
  skor_min NUMERIC(5,2) NOT NULL DEFAULT 0,   -- range skor minimum
  skor_max NUMERIC(5,2) NOT NULL DEFAULT 100, -- range skor maximum
  urutan INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_kriteria_periode ON kriteria_penilaian_tft(periode_id);

-- Penilai (profesional/senior eksternal)
CREATE TABLE penilai_tft (
  id TEXT PRIMARY KEY,
  periode_id TEXT NOT NULL REFERENCES periode_tft(id) ON DELETE CASCADE,
  nama VARCHAR(200) NOT NULL,
  jabatan VARCHAR(200),
  instansi VARCHAR(200),
  catatan TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_penilai_periode ON penilai_tft(periode_id);

-- Nilai per peserta per penilai per kriteria
CREATE TABLE nilai_tft (
  id TEXT PRIMARY KEY,
  periode_id TEXT NOT NULL REFERENCES periode_tft(id) ON DELETE CASCADE,
  pendaftar_id TEXT NOT NULL REFERENCES pendaftar_tft(id) ON DELETE CASCADE,
  penilai_id TEXT NOT NULL REFERENCES penilai_tft(id) ON DELETE CASCADE,
  kriteria_id TEXT NOT NULL REFERENCES kriteria_penilaian_tft(id) ON DELETE CASCADE,
  skor NUMERIC(5,2) NOT NULL,
  catatan TEXT,
  input_by TEXT REFERENCES users(id),    -- admin yang input nilai
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(pendaftar_id, penilai_id, kriteria_id)
);

CREATE INDEX idx_nilai_periode ON nilai_tft(periode_id);
CREATE INDEX idx_nilai_pendaftar ON nilai_tft(pendaftar_id);
CREATE INDEX idx_nilai_penilai ON nilai_tft(penilai_id);
```

---

## Progress Checklist

> Terakhir di-audit: 9 Juni 2026

### Phase 1: Pendaftaran

#### 1.1 Database & Backend

| Item | Status | Keterangan |
|------|--------|------------|
| DB migration (periode_tft, pendaftar_tft) | ✅ Selesai | `0064_tft_rekrutmen.sql` |
| Drizzle schema (5 tabel + enums + indexes) | ✅ Selesai | Semua constraint sesuai blueprint |
| Zod validator schemas | ✅ Selesai | `tft.schema.ts` |
| Server actions: CRUD Periode | ✅ Selesai | create, update, delete, status, get; UI edit sudah tersambung |
| Server actions: Pendaftar | ✅ Selesai | submit, list, review, convert, delete |
| Validasi submit (max peserta, duplikat email, batas waktu, materi) | ✅ Selesai | |

#### 1.2 Admin UI

| Item | Status | Keterangan |
|------|--------|------------|
| List periode (grid cards + create + delete) | ✅ Selesai | |
| Detail periode (tabs + status flow buttons) | ✅ Selesai | |
| Tabel pendaftar + review approve/reject | ✅ Selesai | |
| Convert ke Instruktur | ✅ Selesai | |
| Copy link form publik | ✅ Selesai | |
| Edit periode dialog/form | ✅ Selesai | `updatePeriodeTft` sudah tersambung ke UI |
| Field lanjutan di Create | ⚠️ Partial | Waktu, batas pendaftaran, max, skor min, catatan, deskripsi textarea sudah; TipTap belum |
| Download CV per pendaftar | ✅ Selesai | Link authenticated `/api/files/...` |
| Export pendaftar ke Excel | ✅ Selesai | Client-side export via `xlsx` |
| Bulk actions | ⚠️ Partial | "Terima yang lulus" sudah; multi-select approve/reject dan ZIP CV belum |

#### 1.3 Form Publik

| Item | Status | Keterangan |
|------|--------|------------|
| Route + Form lengkap + validasi + CV upload | ✅ Selesai | |
| Success state (inline) | ✅ Selesai | |
| Pesan status kontekstual (draft/tutup/penuh = beda pesan) | ✅ Selesai | |
| Rate limiting | ✅ Selesai | 5 submit/IP/jam via existing IP bucket |

#### 1.4 Integrasi Instruktur

| Item | Status |
|------|--------|
| Convert → instructor + expertise | ✅ Selesai |

---

### Phase 2: Penilaian

| Item | Status | Keterangan |
|------|--------|------------|
| DB + server actions (kriteria, penilai, nilai) | ✅ Selesai | |
| Input nilai spreadsheet UI | ✅ Selesai | Per-penilai, weighted total, save |
| Recalculate skor_akhir | ✅ Selesai | |
| Tab Hasil — ranking table | ✅ Selesai | |
| PDF functions (`exportFormPenilaianPdf`, `exportRekapHasilPdf`) | ✅ Selesai | Code ada |
| CRUD Kriteria di UI | ✅ Selesai | Tambah/edit/hapus + copy dari periode lain |
| CRUD Penilai di UI | ✅ Selesai | Tambah/edit/hapus |
| Tombol cetak PDF | ✅ Selesai | Form penilaian per penilai + rekap hasil |
| Bulk "Terima semua yang lulus" | ✅ Selesai | Convert peserta lulus yang belum jadi instruktur |
| Export rekap Excel | ✅ Selesai | Client-side export via `xlsx` |

---

### Phase 3: Notifikasi

| Item | Status |
|------|--------|
| Semua item | ❌ Belum dimulai |

---

### Ringkasan Progress

| Phase | Backend | Frontend | Overall |
|-------|---------|----------|---------|
| Phase 1 | ~95% | ~70% | ~80% |
| Phase 2 | ~100% | ~40% | ~60% |
| Phase 3 | 0% | 0% | 0% |

---

## Fitur Detail

### Phase 1: Pendaftaran

#### 1.1 Admin: Kelola Periode TFT

**Lokasi:** Sub-menu di Jadwal Otomatis → "TFT / Rekrutmen"

**CRUD Periode:**
- Judul, slug (auto-generate dari judul, bisa diedit)
- Tanggal & waktu pelaksanaan TFT
- Lokasi
- Program target (Brevet AB / Brevet C / Semua)
- Batas pendaftaran (timestamp — form otomatis tutup)
- Max peserta (opsional)
- Skor minimum kelulusan (opsional)
- Status: draft → buka → tutup → penilaian → selesai
- Deskripsi (rich text via TipTap — info yang ditampilkan di form publik)

**Aksi:**
- Buka/Tutup pendaftaran
- Copy link form publik
- Lihat statistik (jumlah pendaftar, status breakdown)

#### 1.2 Admin: Review Pendaftar

**Lokasi:** Tab "Pendaftar" di detail periode TFT

**Tabel pendaftar dengan kolom:**
- Nama, Email, No HP
- Materi dikuasai (badge/chip)
- Bersedia hadir (Ya/Tidak)
- CV (link download/view)
- Status (badge: Baru / Review / Diterima / Ditolak)
- Skor akhir (setelah penilaian)
- Tanggal submit

**Aksi per pendaftar:**
- View detail (dialog/drawer)
- Download CV
- Ubah status: Terima / Tolak (dengan catatan opsional)
- Terima → opsi "Tambahkan ke Instruktur" (create entry di tabel `instructors` + `instructor_expertise`)

**Aksi bulk:**
- Export ke Excel (semua / filtered)
- Download semua CV (ZIP)
- Bulk approve / reject (select multiple)

#### 1.3 Publik: Form Pendaftaran

**URL:** `arka.iai-jakarta.or.id/daftar/tft/{slug}`

**Desain:**
- Clean, single page form (tanpa login)
- Header: Logo IAI + Judul TFT + Deskripsi dari admin
- Responsive (mobile-friendly)
- Styling fixed (tidak terpengaruh tema dashboard admin)
- Validasi real-time (Zod + react-hook-form)

**Fields:**

| Field | Tipe | Wajib | Keterangan |
|-------|------|-------|------------|
| Nama Lengkap | text | ✓ | |
| No. HP (WhatsApp) | text | ✓ | Validasi format nomor |
| E-mail | email | ✓ | Unique per periode |
| Pekerjaan | textarea | ✓ | |
| Alamat Pekerjaan | textarea | ✓ | |
| Alamat Domisili | text | ✓ | |
| Materi Brevet AB dikuasai | checkbox multi | ✓* | Dari master Materi Ujian |
| Materi Brevet C dikuasai | checkbox multi | ✓* | Dari master Materi Ujian |
| Bersedia hadir TFT | radio (Ya/Tidak) | ✓ | |
| Upload CV | file (PDF) | ✓ | Maks 10MB, storage ARKA |

*Wajib minimal salah satu terisi (AB atau C), tergantung program target periode.

**Behaviour:**
- Cek status periode: jika `tutup` atau melewati batas pendaftaran → "Pendaftaran telah ditutup"
- Cek max peserta: jika penuh → "Kuota pendaftaran telah penuh"
- Cek duplikasi email per periode → "Email sudah terdaftar untuk periode ini"
- Setelah submit → redirect ke halaman sukses
- Opsi: kirim email konfirmasi ke pendaftar (via template Mailjet)

#### 1.4 Integrasi dengan Modul Instruktur

Saat admin approve pendaftar dan pilih "Tambahkan ke Instruktur":

1. Buat entry di `instructors` (nama, email, phone)
2. Buat entry di `instructor_expertise` untuk setiap materi yang dikuasai
3. Update `pendaftar_tft.instructor_id` → link ke record instruktur baru
4. Instruktur langsung muncul di modul Jadwal Otomatis untuk penugasan

---

### Phase 2: Penilaian

#### 2.1 Admin: Setup Kriteria Penilaian

**Lokasi:** Tab "Penilaian" di detail periode TFT → section "Kriteria"

**Fitur:**
- CRUD kriteria penilaian — fully customizable per periode
- Setiap kriteria: nama, deskripsi, bobot (%), range skor (default 0-100), urutan
- Validasi: total bobot semua kriteria harus = 100%
- Bisa copy kriteria dari periode TFT sebelumnya (template)
- Warning jika edit/hapus kriteria yang sudah ada nilainya

**Aturan:**
- Kriteria bisa ditambah/edit/hapus selama belum ada nilai diinput
- Jika sudah ada nilai: edit nama/deskripsi tetap boleh, hapus butuh konfirmasi (akan hapus nilai terkait)
- Urutan drag & drop (opsional) atau input angka manual

**Contoh kriteria (editable oleh admin):**

| Kriteria | Bobot | Range Skor |
|----------|-------|------------|
| Penguasaan Materi | 30% | 0-100 |
| Cara Penyampaian | 25% | 0-100 |
| Interaksi dengan Peserta | 20% | 0-100 |
| Penampilan & Sikap | 15% | 0-100 |
| Ketepatan Waktu | 10% | 0-100 |

#### 2.2 Admin: Kelola Penilai

**Lokasi:** Tab "Penilaian" di detail periode TFT → section "Penilai"

**CRUD penilai:**
- Nama
- Jabatan
- Instansi
- Catatan (opsional)

Penilai ini adalah orang eksternal (profesional/senior) yang **tidak login ke ARKA**. Admin yang input nilainya.

#### 2.3 Admin: Cetak Form Penilaian (PDF)

**Aksi:** Tombol "Cetak Form Penilaian" di tab Penilaian

**Output PDF berisi:**
- Header: logo IAI, judul TFT, tanggal pelaksanaan, lokasi
- Info penilai: nama, jabatan, instansi (pre-filled)
- Tabel penilaian:
  - Baris: daftar peserta (nama)
  - Kolom: setiap kriteria + kolom catatan
  - Cell kosong untuk diisi manual oleh penilai
- Footer: tanda tangan penilai, tanggal

**Opsi cetak:**
- Per penilai (1 PDF per penilai) — default
- Semua penilai dalam 1 PDF (dengan page break)
- Pilih peserta tertentu (filter yang bersedia hadir saja)

#### 2.4 Admin: Input Nilai

**Lokasi:** `/jadwal-otomatis/tft/[id]/input-nilai`

**UI:** Spreadsheet-like grid

```
Penilai: [Dropdown pilih penilai]      Status: 8/15 peserta sudah dinilai

┌────────────────┬────────────┬─────────────┬───────────┬───────┬───────┬───────┐
│ Peserta        │ Penguasaan │ Penyampaian │ Interaksi │ Sikap │ Waktu │ Total │
│                │ (30%)      │ (25%)       │ (20%)     │ (15%) │ (10%) │       │
├────────────────┼────────────┼─────────────┼───────────┼───────┼───────┼───────┤
│ Budi Santoso   │ [85]       │ [78]        │ [80]      │ [90]  │ [85]  │ 83.2  │
│ Siti Rahayu    │ [70]       │ [65]        │ [72]      │ [80]  │ [75]  │ 71.5  │
│ Ahmad Fauzi    │ [  ]       │ [  ]        │ [  ]      │ [  ]  │ [  ]  │  —    │
└────────────────┴────────────┴─────────────┴───────────┴───────┴───────┴───────┘

[Simpan Draft]  [Finalisasi Penilai Ini]
```

**Behaviour:**
- Pilih penilai dulu → tampilkan grid khusus penilai tersebut
- Input skor per cell (angka, validasi range sesuai kriteria)
- Total per peserta dihitung otomatis (weighted average berdasarkan bobot)
- Auto-save per cell atau save draft manual
- "Finalisasi" → lock nilai penilai ini (bisa di-unlock jika perlu koreksi)
- Tab navigation & keyboard-friendly (biar cepat input dari kertas)
- Catatan per peserta (opsional, kolom expandable)

#### 2.5 Admin: Rekap & Hasil

**Lokasi:** Tab "Hasil" di detail periode TFT

**Tampilan:**
- Tabel ranking peserta berdasarkan skor akhir (rata-rata dari semua penilai)
- Kolom: Ranking, Nama, Skor per Penilai, Rata-rata Akhir, Status
- Highlight peserta di atas/bawah threshold kelulusan (jika diset)
- Breakdown skor per kriteria (expandable row)

**Aksi:**
- Set threshold kelulusan → otomatis tandai siapa yang lulus/tidak
- Bulk action: "Terima semua yang lulus" → update status + convert ke instruktur
- Override manual: approve/reject individual terlepas dari skor
- Export rekap ke Excel
- Cetak rekap hasil (PDF) — untuk arsip

**Cetak Hasil PDF:**
- Daftar peserta + skor akhir + status kelulusan
- Detail breakdown per kriteria per penilai
- Ditandatangani oleh: (slot tanda tangan penyelenggara)

---

## Notifikasi (Opsional - Phase 3)

| Event | Channel | Penerima |
|-------|---------|----------|
| Pendaftar baru masuk | In-app notif | Admin |
| Konfirmasi pendaftaran | Email | Pendaftar |
| Diterima sebagai instruktur | Email | Pendaftar |
| Ditolak | Email | Pendaftar (opsional) |

---

## Pilihan Materi (Sync dari Master Data)

List checkbox materi di form publik diambil langsung dari tabel `materi_ujian` yang sudah ada, filtered by program:
- Brevet AB: KUP A, PPH OP, PPH POTPUT, P3B/BM/BPHTB, PPN A, KUP B, PPH BADAN, PEMERIKSAAN APAJAK, PPN B, AKUNTANSI PERPAJAKAN, E-SPT
- Brevet C: KUP C, PAJAK INTERNASIONAL, PPH OP C, PPH POTPUT C, PPH BADAN C, AKUNTANSI PERPAJAKAN C, TAX PLANNING

Jika admin menambah materi baru di master data, form publik otomatis ter-update.

---

## Keamanan

- Form publik: rate-limited (max 5 submit per IP per jam) via existing rate-limiter
- File upload: validasi MIME type (PDF only), max size 10MB
- Slug: tidak predictable (generate random suffix jika judul generik)
- Data pendaftar: hanya accessible oleh user dengan permission `tft.manage`
- CV file: di-serve via authenticated route (`/api/files/...`)
- Input nilai: hanya user dengan permission `tft.manage` atau `tft.input_nilai`

---

## UI/UX Notes

- Form publik memiliki **styling fixed sendiri** — tidak terpengaruh oleh color preference/tema yang diatur admin di Pengaturan ARKA
- Default branding: logo IAI + warna biru primary ARKA sebagai baseline, tapi ini hardcoded di form publik, bukan dynamic dari theme system
- Jika admin mengganti tema/warna di dashboard internal, form publik **tetap sama** — konsisten untuk semua periode
- Admin panel (review pendaftar, input nilai) tetap mengikuti tema dashboard aktif seperti halaman lain
- Status pendaftar ditampilkan sebagai badge berwarna:
  - Baru → gray
  - Review → amber
  - Diterima → green
  - Ditolak → red
- Input nilai: desain spreadsheet-like yang efisien, keyboard-navigable (Tab antar cell)

---

## Progress Checklist

> Terakhir di-audit: 9 Juni 2026

### Phase 1: Pendaftaran

#### 1.1 Database & Backend

| Item | Status | Keterangan |
|------|--------|------------|
| DB migration (periode_tft, pendaftar_tft) | ✅ Selesai | `0064_tft_rekrutmen.sql` |
| Drizzle schema (5 tabel + enums + indexes) | ✅ Selesai | `schema.ts` — semua constraint sesuai blueprint |
| Zod validator schemas | ✅ Selesai | `tft.schema.ts` — create, update, submit, review, nilai |
| Server action: `createPeriodeTft` | ✅ Selesai | Slug uniqueness check |
| Server action: `updatePeriodeTft` | ✅ Selesai | Sudah terhubung ke UI edit periode |
| Server action: `deletePeriodeTft` | ✅ Selesai | Cascade delete |
| Server action: `updateStatusPeriodeTft` | ✅ Selesai | draft → buka → tutup → penilaian → selesai |
| Server action: `getPeriodeTftBySlug` | ✅ Selesai | Public (no auth) |
| Server action: `submitPendaftaranTft` | ✅ Selesai | Validasi: status, batas waktu, max peserta, duplikat email, materi, CV upload |
| Server action: `reviewPendaftar` | ✅ Selesai | Approve/reject + catatan |
| Server action: `convertToInstructor` | ✅ Selesai | Create instructor + expertise |
| Server action: `deletePendaftar` | ✅ Selesai | + delete CV dari storage |

#### 1.2 Admin UI

| Item | Status | Keterangan |
|------|--------|------------|
| Route `/jadwal-otomatis/tft` (list) | ✅ Selesai | Grid cards + create + delete |
| Route `/jadwal-otomatis/tft/[id]` (detail) | ✅ Selesai | Tabs: Pendaftar, Penilaian, Hasil |
| Create dialog (data dasar) | ✅ Selesai | Judul, slug, program, tanggal, lokasi |
| Delete dialog | ✅ Selesai | Konfirmasi sebelum hapus |
| Tombol status (Buka/Tutup/Penilaian/Selesai) | ✅ Selesai | Kondisional per status |
| Copy link form publik | ✅ Selesai | |
| Statistik pendaftar (per status) | ✅ Selesai | Baru/Review/Diterima/Ditolak |
| Tabel pendaftar | ✅ Selesai | Nama, email, HP, materi, hadir, status, skor, aksi |
| Review pendaftar (approve/reject dialog) | ✅ Selesai | + catatan opsional |
| Convert ke Instruktur (tombol) | ✅ Selesai | |
| Edit periode dialog/form (full fields) | ✅ Selesai | Action sudah tersambung ke UI |
| Field lanjutan di Create | ⚠️ Partial | Waktu, batas pendaftaran, max peserta, skor minimum, catatan, deskripsi textarea sudah; TipTap belum |
| Download CV per pendaftar | ✅ Selesai | `cvStorageKey` ditautkan ke `/api/files/...` |
| Export pendaftar ke Excel | ✅ Selesai | Tombol export di tab Pendaftar |
| Bulk actions (bulk approve, bulk reject, download semua CV ZIP) | ⚠️ Partial | Bulk "Terima yang lulus" sudah; multi-select dan ZIP belum |
| **TipTap editor untuk deskripsi** | ❌ Belum | `deskripsi` di-render HTML di form publik tapi tidak ada editor admin |

#### 1.3 Form Publik

| Item | Status | Keterangan |
|------|--------|------------|
| Route `/daftar/tft/[slug]` | ✅ Selesai | |
| Semua field form (nama, HP, email, pekerjaan, alamat, materi, hadir, CV) | ✅ Selesai | |
| Validasi client-side | ✅ Selesai | Per-field validation |
| Validasi server-side | ✅ Selesai | Max peserta, duplikat email, batas waktu, program materi |
| Upload CV (PDF, 10MB) | ✅ Selesai | Storage provider |
| Status closed (rendering) | ✅ Selesai | Pesan "Pendaftaran Ditutup" |
| Success state (inline) | ✅ Selesai | Rendered inline setelah submit |
| Pesan status kontekstual (draft → "belum dibuka", kuota penuh → "kuota penuh") | ✅ Selesai | Draft, tutup, lewat batas, penuh, penilaian/selesai beda pesan |
| **Halaman sukses terpisah** (`/daftar/tft/[slug]/sukses`) | ❌ Belum | Inline saja (low priority) |
| Rate limiting (5 submit/IP/jam) | ✅ Selesai | `submitPendaftaranTft` memakai existing IP bucket |

#### 1.4 Integrasi Instruktur

| Item | Status | Keterangan |
|------|--------|------------|
| Convert pendaftar → instructor + expertise | ✅ Selesai | |
| Update `instructor_id` di pendaftar | ✅ Selesai | |

---

### Phase 2: Penilaian

#### 2.1 Database & Backend

| Item | Status | Keterangan |
|------|--------|------------|
| DB migration (kriteria, penilai, nilai) | ✅ Selesai | Termasuk dalam `0064_tft_rekrutmen.sql` |
| CRUD kriteria server actions | ✅ Selesai | create, update, delete, forceDelete, copyFromPeriode |
| CRUD penilai server actions | ✅ Selesai | create, update, delete |
| Save nilai (upsert per cell) | ✅ Selesai | + auto recalculate skor_akhir |
| Get nilai by penilai | ✅ Selesai | |
| Get all nilai | ✅ Selesai | |
| Recalculate skor akhir (weighted avg) | ✅ Selesai | Per penilai → avg across penilai |

#### 2.2 Admin UI: Penilaian

| Item | Status | Keterangan |
|------|--------|------------|
| Tab "Penilaian" — tampil daftar kriteria | ✅ Selesai | Read-only display |
| Tab "Penilaian" — tampil daftar penilai | ✅ Selesai | Read-only display |
| Route `/jadwal-otomatis/tft/[id]/input-nilai` | ✅ Selesai | |
| Input nilai spreadsheet-style grid | ✅ Selesai | Per-penilai dropdown, weighted total, save |
| Tombol CRUD kriteria di UI (tambah/edit/hapus) | ✅ Selesai | |
| Tombol CRUD penilai di UI (tambah/edit/hapus) | ✅ Selesai | |
| Validasi total bobot = 100% di UI | ✅ Selesai | Warning visual jika total belum 100% |
| Copy kriteria dari periode lain (UI) | ✅ Selesai | Dropdown periode sumber + tombol salin |
| Tombol "Cetak Form Penilaian" (PDF) | ✅ Selesai | Tombol per penilai |
| Opsi cetak (per penilai / semua / filter peserta) | ⚠️ Partial | Per penilai sudah; semua/filter peserta belum |
| **Finalisasi per penilai** (lock/unlock nilai) | ❌ Belum | |

#### 2.3 Admin UI: Hasil

| Item | Status | Keterangan |
|------|--------|------------|
| Tab "Hasil" — ranking table | ✅ Selesai | Sorted by skor_akhir, threshold highlight |
| Tombol "Cetak Rekap Hasil" (PDF) | ✅ Selesai | |
| Bulk "Terima semua yang lulus" | ✅ Selesai | Convert peserta lulus yang belum jadi instruktur |
| Export rekap ke Excel | ✅ Selesai | |
| **Breakdown skor per kriteria** (expandable row) | ❌ Belum | |
| Skor per penilai (kolom terpisah) | ✅ Selesai | Kolom dinamis per penilai di tab Hasil |

---

### Phase 3: Notifikasi (Opsional)

| Item | Status | Keterangan |
|------|--------|------------|
| Notif in-app: pendaftar baru masuk | ❌ Belum | |
| Email konfirmasi pendaftaran ke pendaftar | ❌ Belum | |
| Email "diterima" ke pendaftar | ❌ Belum | |
| Email "ditolak" ke pendaftar (opsional) | ❌ Belum | |

---

## Phase 4: Enhancement (Baru)

> Fase lanjutan untuk menutup gap yang ditemukan dari audit 9 Juni 2026.

### 4.1 Admin: Form Edit Periode (Prioritas Tinggi)

**Masalah:** Admin tidak bisa mengedit detail periode setelah dibuat. Semua field lanjutan (waktu, batas pendaftaran, max peserta, skor minimum, catatan internal, deskripsi TipTap) juga tidak bisa diisi saat create.

**Solusi:**
- Tambah dialog/drawer "Edit Periode" di `TftDetailView` (atau akses dari list)
- Form lengkap dengan semua field: judul, slug, tanggal mulai/selesai, waktu mulai/selesai, lokasi, batas pendaftaran (datetime-local), max peserta, skor minimum, catatan internal, deskripsi (TipTap rich text)
- Call `updatePeriodeTft()` yang sudah ada
- Perbanyak field di Create dialog juga (minimal: batas pendaftaran, max peserta)

**Estimasi:** 0.5 hari

---

### 4.2 Admin: CRUD Kriteria & Penilai di UI (Prioritas Tinggi)

**Masalah:** Server actions untuk CRUD kriteria dan penilai sudah lengkap, tapi UI hanya menampilkan list (read-only). Admin tidak bisa tambah/edit/hapus dari browser.

**Solusi:**
- Tambah tombol "Tambah Kriteria" + dialog (nama, deskripsi, bobot, range skor, urutan)
- Tombol edit & hapus per kriteria
- Validasi total bobot = 100% secara visual (warning jika belum tepat)
- Tambah tombol "Tambah Penilai" + dialog (nama, jabatan, instansi, catatan)
- Tombol edit & hapus per penilai
- Tombol "Copy Kriteria dari Periode Lain" dengan dropdown pilih periode sumber

**Estimasi:** 1 hari

---

### 4.3 Wiring PDF Export ke UI (Prioritas Sedang)

**Masalah:** Fungsi `exportFormPenilaianPdf()` dan `exportRekapHasilPdf()` sudah ditulis di `pdf-export.ts` tapi tidak ada tombol di UI yang memanggilnya.

**Solusi:**
- Tab "Penilaian": tombol "Cetak Form Penilaian" dengan dropdown pilih penilai
- Tab "Hasil": tombol "Cetak Rekap Hasil (PDF)"
- Opsi cetak: per penilai / semua penilai

**Estimasi:** 0.5 hari

---

### 4.4 CV Download & View (Prioritas Sedang)

**Masalah:** `cvStorageKey` tersimpan tapi admin tidak bisa melihat/download CV dari tabel pendaftar.

**Solusi:**
- Tambah kolom "CV" di tabel pendaftar dengan link download
- Link mengarah ke authenticated route `/api/files/[key]` (sudah ada di ARKA)
- Opsional: preview in-dialog

**Estimasi:** 0.5 hari

---

### 4.5 Pesan Status Kontekstual di Form Publik (Prioritas Sedang)

**Masalah:** Semua kondisi non-"buka" menampilkan pesan generik "Pendaftaran Ditutup". Status `draft` seharusnya tidak bisa diakses publik / tampil pesan berbeda.

**Solusi:**
- `draft` → "Pendaftaran belum dibuka. Silakan cek kembali nanti."
- `tutup` / lewat batas → "Pendaftaran telah ditutup. Terima kasih atas minat Anda."
- Kuota penuh → "Kuota pendaftaran telah penuh."
- `penilaian` / `selesai` → "Periode pendaftaran ini telah selesai."

**Implementasi:** Update logika di `src/app/daftar/tft/[slug]/page.tsx` dan `TftPublicForm.tsx`

**Estimasi:** 0.5 hari

---

### 4.6 Excel Export Pendaftar & Rekap (Prioritas Sedang)

**Masalah:** Tidak ada fitur export data ke Excel.

**Solusi:**
- Tombol "Export Excel" di tab Pendaftar → download .xlsx semua pendaftar (atau filtered)
- Tombol "Export Rekap" di tab Hasil → download .xlsx ranking + skor per kriteria
- Gunakan package `xlsx` yang sudah ter-install

**Estimasi:** 0.5 hari

---

### 4.7 Bulk Actions (Prioritas Rendah)

**Masalah:** Admin harus review satu-satu, tidak bisa multi-select.

**Solusi:**
- Checkbox multi-select di tabel pendaftar
- Aksi bulk: "Terima yang dipilih", "Tolak yang dipilih"
- Di tab Hasil: "Terima semua yang lulus" (berdasarkan skor minimum)
- Download semua CV (ZIP) — gunakan JSZip atau server-side archiver

**Estimasi:** 1 hari

---

### 4.8 Rate Limiting Form Publik (Prioritas Rendah)

**Masalah:** Form publik tidak dilindungi rate-limit, rawan spam.

**Solusi:**
- Tambah `rateLimit()` call di `submitPendaftaranTft` (max 5/IP/jam)
- Gunakan rate-limiter yang sudah ada di `@/lib/rate-limit`

**Estimasi:** 0.25 hari

---

### 4.9 TipTap Editor untuk Deskripsi Periode (Prioritas Rendah)

**Masalah:** Field `deskripsi` di-render sebagai HTML di form publik (`dangerouslySetInnerHTML`) tapi tidak ada editor rich text di admin.

**Solusi:**
- Integrasikan TipTap editor (sudah ter-install di ARKA) di form edit periode
- Output HTML disimpan di kolom `deskripsi`

**Estimasi:** 0.5 hari

---

### Ringkasan Phase 4

| Item Enhancement | Status | Keterangan |
|-----------------|--------|------------|
| 4.1 Form Edit Periode | ⚠️ Partial | Form edit/create sudah; TipTap belum |
| 4.2 CRUD Kriteria & Penilai UI | ✅ Selesai | |
| 4.3 Wiring PDF Export ke UI | ✅ Selesai | |
| 4.4 CV Download & View | ✅ Selesai | |
| 4.5 Pesan Status Kontekstual | ✅ Selesai | |
| 4.6 Excel Export | ✅ Selesai | |
| 4.7 Bulk Actions | ⚠️ Partial | Terima yang lulus sudah; multi-select/ZIP belum |
| 4.8 Rate Limiting | ✅ Selesai | |
| 4.9 TipTap Editor Deskripsi | ❌ Belum | Low priority |
| **Sisa Phase 4** | | TipTap, opsi cetak semua/filter, finalisasi penilai, breakdown kriteria, multi-select/ZIP CV |

---

## Estimasi Effort (Updated)

| Komponen | Estimasi | Status |
|----------|----------|--------|
| **Phase 1: Pendaftaran** | | |
| DB migration + schema (periode_tft, pendaftar_tft) | 0.5 hari | ✅ Selesai |
| Server actions (CRUD periode, submit form, approve/reject) | 1 hari | ✅ Selesai |
| Admin UI: list periode + detail pendaftar | 1 hari | ✅ Selesai |
| Public form + validasi + upload | 1 hari | ✅ Selesai |
| Integrasi instruktur + export | 0.5 hari | ⚠️ Partial (convert ✅, export ❌) |
| **Subtotal Phase 1** | **~4 hari** | **~90% selesai** |
| | | |
| **Phase 2: Penilaian** | | |
| DB migration (kriteria, penilai, nilai) | 0.5 hari | ✅ Selesai |
| CRUD kriteria + penilai + copy template | 0.5 hari | ⚠️ Backend ✅, UI ❌ |
| Cetak form penilaian (PDF generation) | 1 hari | ⚠️ Code ✅, UI wiring ❌ |
| Input nilai (spreadsheet-like UI + auto-calc) | 1.5 hari | ✅ Selesai |
| Rekap hasil + ranking + cetak PDF | 1 hari | ⚠️ Ranking ✅, Cetak & bulk ❌ |
| **Subtotal Phase 2** | **~4.5 hari** | **~60% selesai** |
| | | |
| **Phase 3: Notifikasi (Opsional)** | ~1 hari | ❌ Belum dimulai |
| | | |
| **Phase 4: Enhancement** | ~5.25 hari | ❌ Belum dimulai |
| | | |
| **Total keseluruhan** | **~14.75 hari** | |

---

## Dependensi

- Storage system (sudah ada: `@/lib/storage`)
- Materi Ujian master data (sudah ada: `materi_ujian` table)
- Instruktur table (sudah ada: `instructors` + `instructor_expertise`)
- Rate limiter (sudah ada: `@/lib/rate-limit`)
- Email template engine (sudah ada: `@/lib/email/template-engine`)
- TipTap editor (sudah ada — untuk deskripsi periode)
- jsPDF + jspdf-autotable (sudah ada — untuk cetak PDF)
- XLSX export (sudah ada — via `xlsx` package)

---

## Migration Path dari Google Form

1. Deploy modul TFT (Phase 1 dulu)
2. Admin buat periode TFT baru di ARKA
3. Share link publik `/daftar/tft/{slug}` ke calon instruktur (via WhatsApp/email)
4. Data langsung masuk dashboard ARKA — no more manual re-entry
5. (Opsional) Import data pendaftar lama dari Google Sheets via CSV import
6. Deploy Phase 2 (penilaian) sebelum pelaksanaan TFT
7. Admin setup kriteria + penilai → cetak form → pelaksanaan → input nilai → rekap → approve
