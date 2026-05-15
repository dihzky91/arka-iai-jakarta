# Modul Penilaian Kinerja Karyawan

> Dokumen perencanaan untuk digitalisasi sistem penilaian kinerja karyawan IAI Wilayah DKI Jakarta ke dalam sistem ARKA.

---

## 1. Latar Belakang

Saat ini penilaian kinerja karyawan dilakukan secara manual menggunakan file Excel per periode. Setiap tahun terdapat 4 periode penilaian:

| Kuartal | Periode |
|---------|---------|
| Q1 | Januari – Maret |
| Q2 | April – Juni |
| Q3 | Juli – September |
| Q4 | Oktober – Desember |

Penilaian terdiri dari 2 komponen utama:
1. **Penilaian Pelaksanaan Tugas** — kriteria berbeda per jabatan/karyawan
2. **Penilaian Perilaku** — kriteria relatif seragam (11 item standar)

Setiap item memiliki **Nilai (0–100)** dan **Bobot (desimal)**, menghasilkan **Nilai Terbobot = Nilai × Bobot**. Total bobot per komponen idealnya = 1.0.

---

## 2. Tujuan

- Menghilangkan ketergantungan pada file Excel manual
- Menyediakan kalkulasi otomatis (nilai terbobot, total)
- Menyimpan histori penilaian per karyawan lintas periode
- Mempermudah rekap dan perbandingan antar periode/divisi
- Menyediakan workflow approval (penilai → review → finalisasi)
- Integrasi dengan data kepegawaian yang sudah ada di ARKA

---

## 3. Struktur Data dari Template Excel

### 3.1 Divisi yang Dinilai

- Staff Akuntansi & PPL
- Div Teknis
- Div PPL & Keanggotaan
- Div Umum

### 3.2 Komponen Penilaian Tugas (Contoh)

| No | Keterangan | Nilai | Bobot | Nilai Terbobot | Keterangan |
|----|-----------|-------|-------|----------------|------------|
| 1 | Mentaati peraturan organisasi... | 100 | 0.1 | 10 | |
| 2 | Menghitung semua pajak... | 100 | 0.1 | 10 | |
| ... | ... | ... | ... | ... | |

- Kriteria **berbeda per jabatan/karyawan**
- Jumlah item bervariasi (8–14 item)
- Bobot bervariasi (0.05 – 0.2)

### 3.3 Komponen Penilaian Perilaku (Standar)

| No | Keterangan | Nilai | Bobot | Nilai Terbobot |
|----|-----------|-------|-------|----------------|
| 1 | Loyalitas dan kesungguhan terhadap pekerjaannya | | 0.1–0.2 | |
| 2 | Komitmen dan tanggung jawab terhadap tugas | | 0.1–0.2 | |
| 3 | Disiplin dan kepatuhan terhadap peraturan kerja | | 0.1 | |
| 4 | Sikap profesional dalam bekerja | | 0.1 | |
| 5 | Kejujuran dan kepercayaan | | 0.1–0.2 | |
| 6 | Kecakapan dalam menjalankan tugas | | 0.05–0.1 | |
| 7 | Kerjasama, koordinasi dalam tim dan antar tim | | 0.05–0.1 | |
| 8 | Komunikasi dengan pengurus dan karyawan | | 0.05–0.1 | |
| 9 | Bekerja secara efektif dalam jadwal kerja... | | 0.05 | |
| 10 | Prestasi kerja baik kualitas maupun kuantitas | | 0.05 | |
| 11 | Kemampuan dan kreativitas | | 0.1 | |

> Catatan: Bobot perilaku juga bervariasi per karyawan/jabatan.

---

## 4. Kebutuhan Fungsional

### 4.1 Master Template Kriteria

- CRUD template kriteria penilaian tugas per jabatan
- Template perilaku standar (bisa di-adjust bobotnya per karyawan)
- Validasi total bobot = 1.0
- Assign template ke karyawan tertentu
- Duplikasi template untuk jabatan serupa

### 4.2 Manajemen Periode

- Buat periode penilaian (kuartal + tahun)
- Buka/tutup periode (hanya periode terbuka yang bisa diinput)
- Histori periode sebelumnya tetap bisa dilihat

### 4.3 Input Penilaian

- Form input nilai per karyawan per periode
- Penilai = atasan langsung / admin / manajer
- Auto-calculate nilai terbobot per item
- Auto-calculate total per komponen
- Kolom keterangan per item (opsional)
- Status workflow: Draft → Submitted → Reviewed → Finalized

### 4.4 Approval Workflow

- Penilai mengisi dan submit
- Reviewer (manajer/direktur) bisa review dan finalisasi
- Karyawan bisa melihat hasil penilaian setelah finalisasi
- Catatan/komentar dari reviewer

### 4.5 Rekap & Laporan

- Dashboard ringkasan per divisi
- Perbandingan antar periode (chart trend per karyawan)
- Ranking karyawan per periode
- Export ke PDF (format mirip template Excel asli)
- Export ke Excel
- Filter: per divisi, per periode, per karyawan

### 4.6 Integrasi

- Link ke data absensi (referensi saat menilai kedisiplinan)
- Notifikasi ke karyawan saat penilaian selesai
- Audit log untuk semua perubahan

---

## 5. Desain Database

### 5.1 Enum Baru

```typescript
export const statusPenilaianEnum = pgEnum("status_penilaian", [
  "draft",
  "submitted",
  "reviewed",
  "finalized",
]);

export const tipePenilaianTemplateEnum = pgEnum("tipe_penilaian_template", [
  "tugas",
  "perilaku",
]);

export const statusPeriodePenilaianEnum = pgEnum("status_periode_penilaian", [
  "open",
  "closed",
]);
```

### 5.2 Tabel

#### `penilaian_periode`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | serial | PK |
| nama | varchar(100) | Contoh: "Q1 2026" |
| tahun | integer | 2026 |
| kuartal | integer | 1–4 |
| tanggalMulai | date | Awal periode |
| tanggalSelesai | date | Akhir periode |
| status | enum | open / closed |
| createdBy | text | FK → users.id |
| createdAt | timestamp | |
| updatedAt | timestamp | |

#### `penilaian_template`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | serial | PK |
| nama | varchar(200) | Nama template |
| tipe | enum | tugas / perilaku |
| divisiId | integer (nullable) | FK → divisi.id |
| jabatan | varchar(150) (nullable) | Filter jabatan |
| isDefault | boolean | Template default perilaku |
| createdBy | text | FK → users.id |
| createdAt | timestamp | |
| updatedAt | timestamp | |

#### `penilaian_template_item`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | serial | PK |
| templateId | integer | FK → penilaian_template.id |
| nomor | integer | Urutan tampil |
| keterangan | text | Deskripsi kriteria |
| bobot | numeric(4,3) | Contoh: 0.100 |
| createdAt | timestamp | |

#### `penilaian_kinerja`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | text (uuid) | PK |
| periodeId | integer | FK → penilaian_periode.id |
| userId | text | FK → users.id (karyawan dinilai) |
| penilaiId | text | FK → users.id (yang menilai) |
| templateTugasId | integer | FK → penilaian_template.id |
| templatePerilakuId | integer | FK → penilaian_template.id |
| totalNilaiTugas | numeric(5,2) | Kalkulasi otomatis |
| totalNilaiPerilaku | numeric(5,2) | Kalkulasi otomatis |
| nilaiAkhir | numeric(5,2) | Rata-rata atau formula custom |
| status | enum | draft/submitted/reviewed/finalized |
| catatan | text (nullable) | Catatan umum |
| reviewedBy | text (nullable) | FK → users.id |
| reviewedAt | timestamp (nullable) | |
| finalizedAt | timestamp (nullable) | |
| createdAt | timestamp | |
| updatedAt | timestamp | |

#### `penilaian_kinerja_detail`

| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | serial | PK |
| penilaianId | text | FK → penilaian_kinerja.id |
| templateItemId | integer | FK → penilaian_template_item.id |
| tipe | enum | tugas / perilaku |
| nilai | integer | 0–100 |
| bobot | numeric(4,3) | Snapshot bobot saat penilaian |
| nilaiTerbobot | numeric(5,2) | Kalkulasi: nilai × bobot |
| keterangan | text (nullable) | Catatan per item |

### 5.3 ERD

```
penilaian_periode
       │
       │ 1:N
       ▼
penilaian_kinerja ──────► users (userId = karyawan)
       │                  users (penilaiId = penilai)
       │                  penilaian_template (tugas)
       │                  penilaian_template (perilaku)
       │
       │ 1:N
       ▼
penilaian_kinerja_detail ──► penilaian_template_item
```

---

## 6. Capabilities (RBAC)

### 6.1 Capabilities Baru

```typescript
"penilaian_kinerja:view"      // Lihat penilaian (milik sendiri)
"penilaian_kinerja:view_all"  // Lihat semua penilaian (admin/manajer)
"penilaian_kinerja:create"    // Buat/input penilaian
"penilaian_kinerja:edit"      // Edit penilaian draft
"penilaian_kinerja:approve"   // Review & finalisasi
"penilaian_kinerja:manage"    // Kelola template & periode
"penilaian_kinerja:export"    // Export laporan
```

### 6.2 Mapping ke Role Default

| Capability | admin | pejabat | staff | viewer |
|-----------|-------|---------|-------|--------|
| view | ✓ | ✗ | ✗ | ✗ |
| view_all | ✓ | ✗ | ✗ | ✗ |
| create | ✓ | ✗ | ✗ | ✗ |
| edit | ✓ | ✗ | ✗ | ✗ |
| approve | ✓ | ✗ | ✗ | ✗ |
| manage | ✓ | ✗ | ✗ | ✗ |
| export | ✓ | ✗ | ✗ | ✗ |

> **Catatan Penting:** Modul penilaian kinerja bersifat **rahasia**. Tidak ada role default yang memiliki akses. Akses diberikan secara eksplisit melalui dynamic role assignment di panel admin kepada user tertentu (manajer, direktur) yang bertanggung jawab atas operasional dan evaluasi karyawan. Karyawan yang dinilai **tidak dapat** melihat hasil penilaiannya di sistem.

---

## 7. Struktur File

```
src/
├── app/(dashboard)/penilaian-kinerja/
│   ├── page.tsx                    # List semua penilaian
│   ├── [id]/page.tsx               # Detail penilaian
│   ├── input/page.tsx              # Form input penilaian
│   ├── template/page.tsx           # Kelola template kriteria
│   ├── periode/page.tsx            # Kelola periode
│   └── rekap/page.tsx              # Dashboard & laporan
├── components/penilaian-kinerja/
│   ├── PenilaianTable.tsx          # Tabel list penilaian
│   ├── PenilaianForm.tsx           # Form input nilai
│   ├── PenilaianDetail.tsx         # Detail view + approval
│   ├── TemplateManager.tsx         # CRUD template
│   ├── TemplateForm.tsx            # Form template kriteria
│   ├── TemplateItemEditor.tsx      # Editor item + bobot
│   ├── PeriodeManager.tsx          # CRUD periode
│   ├── RekapDashboard.tsx          # Charts & summary
│   ├── RekapChart.tsx              # Recharts components
│   └── ExportPenilaian.tsx         # Export PDF/Excel
├── server/actions/
│   └── penilaianKinerja.ts         # Server actions
├── lib/
│   ├── validators/
│   │   └── penilaianKinerja.schema.ts  # Zod schemas
│   └── pdf/
│       └── penilaianKinerja.ts     # PDF generator
```

---

## 8. Fase Implementasi

### Fase 1: Schema & Foundation (1–2 hari)

- [x] Tambah enum baru di `schema.ts`
- [x] Tambah tabel `penilaian_periode`, `penilaian_template`, `penilaian_template_item`, `penilaian_kinerja`, `penilaian_kinerja_detail`
- [x] Generate migration (`npm run db:generate`)
- [x] Push schema (`npm run db:push`)
- [x] Tambah capabilities di `src/lib/rbac/capabilities.ts`
- [x] Tambah permission mapping di `src/server/actions/auth.ts`
- [x] Tambah navigasi sidebar

### Fase 2: Master Template Kriteria (2–3 hari)

- [x] Zod schema untuk template CRUD
- [x] Server actions: `createTemplate`, `updateTemplate`, `deleteTemplate`, `listTemplates`
- [x] Server actions: `addTemplateItem`, `updateTemplateItem`, `deleteTemplateItem`
- [x] Halaman `/penilaian-kinerja/template`
- [x] Komponen `TemplateManager`, `TemplateForm`, `TemplateItemEditor`
- [x] Validasi total bobot = 1.0
- [x] Seed template perilaku standar (11 item default)

### Fase 3: Manajemen Periode & Input Penilaian (3–4 hari)

- [x] Server actions: `createPeriode`, `updatePeriode`, `closePeriode`
- [x] Halaman `/penilaian-kinerja/periode`
- [x] Server actions: `createPenilaian`, `updatePenilaian`, `submitPenilaian`
- [x] Server actions: `getPenilaianDetail`, `listPenilaian`
- [x] Halaman `/penilaian-kinerja/input` (form input)
- [x] Halaman `/penilaian-kinerja/[id]` (detail)
- [x] Komponen `PenilaianForm` dengan kalkulasi real-time
- [x] Komponen `PenilaianTable` (TanStack Table)
- [x] Workflow status: Draft → Submitted → Reviewed → Finalized

### Fase 4: Dashboard & Laporan (2–3 hari)

- [x] Server actions: `getRekapPerDivisi`, `getRekapPerKaryawan`, `getTrendPenilaian`
- [x] Halaman `/penilaian-kinerja/rekap`
- [x] Chart perbandingan antar periode (Recharts)
- [x] Ranking karyawan per periode
- [x] Export PDF (format mirip template Excel)
- [x] Export Excel (xlsx)
- [x] Filter per divisi, periode, karyawan

### Fase 5: Integrasi & Polish (1–2 hari)

- [x] Notifikasi ke karyawan saat penilaian di-finalisasi
- [x] Link referensi ke data absensi
- [x] Audit log untuk semua mutasi
- [x] Seed data template perilaku standar
- [x] Testing end-to-end
- [x] Polish UI & responsiveness

---

## 9. Estimasi Total

| Fase | Durasi | Prioritas |
|------|--------|-----------|
| Fase 1: Schema & Foundation | 1–2 hari | Tinggi |
| Fase 2: Master Template | 2–3 hari | Tinggi |
| Fase 3: Input Penilaian | 3–4 hari | Tinggi |
| Fase 4: Dashboard & Laporan | 2–3 hari | Sedang |
| Fase 5: Integrasi & Polish | 1–2 hari | Rendah |
| **Total** | **~10–14 hari** | |

---

## 10. Catatan Teknis

- Nilai terbobot dihitung di client (real-time preview) dan disimpan di server (snapshot)
- Bobot di-snapshot ke `penilaian_kinerja_detail` agar perubahan template tidak mengubah histori
- Periode yang sudah closed tidak bisa diubah kecuali oleh admin
- Karyawan hanya bisa melihat penilaian miliknya sendiri setelah status `finalized`
- Format `nilaiAkhir` bisa dikonfigurasi: rata-rata kedua komponen atau formula custom (misal 60% tugas + 40% perilaku)
