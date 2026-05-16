# Rencana Sistem Penjadwalan Otomatis — Multi-Program (Brevet AB, Brevet C, BFA)

## Status
Implementasi bertahap — Phase 4 selesai

---

## 1. Konteks & Scope

### Tiga Program Pelatihan

| Program | Total Sesi | Pertemuan Materi | Pertemuan Ujian | Total Pertemuan |
|---|---|---|---|---|
| Brevet AB | 60 | 31 | 4 | **35** |
| Brevet C | 30 | 15 | 3 | **18** |
| BFA (Basic Financial Accounting) | 40 | 20 | 5 | **25** |

Setiap pertemuan materi = 2 sesi berurutan dalam 1 hari.

### Jenis Kelas & Jadwal Aktif

| Jenis | Hari Aktif | Slot Waktu |
|---|---|---|
| Weekend Pagi | Sabtu & Minggu | 08.00 – 12.30 |
| Weekend Siang | Sabtu & Minggu | 13.00 – 17.15 |
| Weekday Selasa-Kamis | Selasa & Kamis | 17.15 – 21.30 |
| Weekday Senin-Rabu-Jumat | Senin, Rabu, Jumat | 17.15 – 21.30 |

### Perbedaan Penting Antar Program

| Aspek | Brevet AB | Brevet C | BFA |
|---|---|---|---|
| Slot ujian per hari | 2 (08.00–10.15 & 10.30–12.45) | 1–2 slot | 1 (08.00–10.15) |
| Mixed day (sesi + ujian 1 hari) | **Ya** (sesi 23 + ujian) | Tidak | Tidak |
| Blok tanpa ujian di akhir | Tidak | **Ya** (Tax Planning) | Tidak |
| Ujian selalu hari terpisah | Hampir semua | Ya | Ya |

---

## 2. Kurikulum Template (Fixed per Program)

Urutan materi 100% tetap per program. Disimpan sebagai seed data di DB dengan `program_id`.

### 2A. Brevet AB — 60 Sesi + 5 Ujian Events

| Blok | Sesi | Materi | Sesi per Blok |
|---|---|---|---|
| 1 | 1–2 | Pengantar Hukum Pajak | 2 |
| 2 | 3–4 | KUP A | 2 |
| 3 | 5–12 | PPh Orang Pribadi | 8 |
| **UJIAN** | — | KUP A & PPh OP *(hari terpisah, 2 slot)* | — |
| 4 | 13–20 | PPh Pemotongan Pemungutan | 8 |
| 5 | 21–22 | Pajak Bumi & Bangunan | 2 |
| 6 | 23 | Bea Meterai | 1 |
| **UJIAN** | — | PPh Potput *(mixed day: sisip di hari sesi 23, slot 2)* | — |
| 7 | 24–31 | PPN A | 8 |
| **UJIAN** | — | PBB, BM & PPN A *(hari terpisah, 2 slot)* | — |
| 8 | 32–35 | KUP B | 4 |
| 9 | 36–43 | PPh Badan | 8 |
| **UJIAN** | — | KUP B & PPh Badan *(hari terpisah, 2 slot)* | — |
| 10 | 44–45 | Pemeriksaan Pajak | 2 |
| 11 | 46–49 | PPN B | 4 |
| 12 | 50–56 | Akuntansi Perpajakan | 7 |
| **UJIAN** | — | PPN B & Akuntansi Perpajakan *(hari terpisah, 2 slot)* | — |
| 13 | 57–60 | Simulasi e-SPT & Manajemen Perpajakan | 4 |

**Catatan ujian Brevet AB:**
- Ujian 1, 3, 4, 5: hari terpisah — 2 subject per hari, 2 slot waktu
- Ujian 2: **mixed day** — sesi 23 slot 1, ujian PPh Potput slot 2 (hari yang sama)

---

### 2B. Brevet C — 30 Sesi + 3 Ujian Events

| Blok | Sesi | Materi | Sesi per Blok |
|---|---|---|---|
| 1 | 1–8 | Perpajakan Internasional | 8 |
| 2 | 9–12 | PPh Pemotongan & Pemungutan | 4 |
| **UJIAN** | — | Perpajakan Internasional + PPh PotPut C *(2 slot)* | — |
| 3 | 13–16 | PPh Badan C | 4 |
| 4 | 17–20 | Transfer Pricing | 4 |
| **UJIAN** | — | PPh Badan C + Transfer Pricing *(2 slot)* | — |
| 5 | 21–24 | Akuntansi Pajak C | 4 |
| **UJIAN** | — | Akuntansi Pajak C *(1 slot saja)* | — |
| 6 | 25–30 | Tax Planning | 6 |
| *(tanpa ujian)* | — | Kelas selesai setelah sesi 30 | — |

**Catatan ujian Brevet C:**
- Ujian 1 & 2: hari terpisah — 2 subject per hari, 2 slot waktu
- Ujian 3: hari terpisah — 1 subject, 1 slot waktu
- Blok Tax Planning: **tidak ada ujian**

---

### 2C. BFA — 40 Sesi + 5 Ujian Events

| Blok | Sesi | Materi Detail | Sesi per Blok |
|---|---|---|---|
| 1 | 1–6 | Dasar-Dasar Akuntansi *(Konsep, Persamaan, Lap. Keuangan, Closing Entry, Latihan)* | 6 |
| **UJIAN** | — | Evaluasi Dasar-Dasar Akuntansi *(1 slot)* | — |
| 2 | 7–16 | Akuntansi Kas, Piutang, Persediaan *(Kas, Piutang, Persediaan Dagang, Industri, Latihan)* | 10 |
| **UJIAN** | — | Evaluasi Kas, Piutang, Persediaan *(1 slot)* | — |
| 3 | 17–20 | Akuntansi Aset *(Aset Tetap, Aset Tidak Berwujud)* | 4 |
| **UJIAN** | — | Evaluasi Akuntansi Aset *(1 slot)* | — |
| 4 | 21–30 | Akuntansi Kewajiban & Ekuitas *(Kewajiban JP, Obligasi, Ekuitas, Lap. Perubahan Ekuitas, Latihan)* | 10 |
| **UJIAN** | — | Evaluasi Kewajiban & Ekuitas *(1 slot)* | — |
| 5 | 31–40 | Laporan Keuangan & Analisis *(Neraca, L/R, Arus Kas, Analisa Ratio, Latihan)* | 10 |
| **UJIAN** | — | Evaluasi Laporan Keuangan & Analisis *(1 slot)* | — |

**Catatan ujian BFA:**
- Semua ujian: hari terpisah — 1 subject per hari, **1 slot waktu saja** (08.00–10.15)
- Tidak ada mixed day

---

## 3. Database Schema

```sql
-- Master program pelatihan
programs
├── id
├── code              -- "BREVET_AB" | "BREVET_C" | "BFA"
├── name              -- "Brevet AB", "Brevet C", "BFA"
├── total_sessions    -- 60 | 30 | 40
├── total_meetings    -- 35 | 18 | 25
└── is_active

-- Template kurikulum per program (seed data, jarang berubah)
curriculum_template
├── id
├── program_id        -- FK → programs
├── session_number    -- 1–60 / 1–30 / 1–40
├── materi_block      -- nama blok (untuk grouping instruktur)
├── materi_name       -- detail judul materi
└── slot              -- 1 (slot pertama) atau 2 (slot kedua)

-- Definisi titik ujian per program
curriculum_exam_points
├── id
├── program_id            -- FK → programs
├── after_session_number  -- ujian disisipkan setelah sesi ke-berapa
├── is_mixed_day          -- true = ujian di hari yang sama dengan sesi terakhir (Brevet AB ujian 2)
├── exam_slot_count       -- 1 atau 2 (berapa slot ujian per hari)
├── exam_subjects[]       -- array nama ujian ["UJIAN KUP A", "UJIAN PPh OP"]
└── has_exam              -- false untuk Tax Planning Brevet C

-- Master libur nasional
national_holidays
├── id
├── date              -- DATE
├── name
└── year

-- Kelas (extend tabel existing)
classes (existing + extend)
├── ... (existing fields)
├── program_id        -- FK → programs  ← BARU
├── class_type        -- weekend_pagi | weekend_siang | weekday_selasa_kamis | weekday_senin_rabu_jumat
├── start_date        -- DATE
└── end_date          -- DERIVED: MAX(scheduled_date) dari class_sessions

-- Tanggal eksklusi per kelas
class_excluded_dates
├── id
├── class_id
├── date
└── reason

-- Sesi kelas yang di-generate
class_sessions
├── id
├── class_id
├── session_number    -- 1–60/30/40, null untuk hari ujian
├── is_exam_day       -- boolean
├── exam_subjects[]   -- null kalau bukan hari ujian
├── scheduled_date    -- DATE
├── time_slot_start   -- TIME
├── time_slot_end     -- TIME
├── materi_name       -- dari curriculum_template
├── status            -- scheduled | cancelled | makeup | completed
└── created_at

-- Assignment instruktur per sesi
session_assignments
├── id
├── session_id
├── planned_instructor_id   -- assign saat jadwal dibuat
├── actual_instructor_id    -- null jika tidak ada penggantian
├── substitution_reason
└── updated_at

-- Data instruktur
instructors
├── id
├── name
├── email
├── phone
└── is_active

-- Keahlian per instruktur (many-to-many)
instructor_expertise
├── id
├── instructor_id
├── program_id        -- instruktur bisa qualified di program berbeda
└── materi_block      -- harus match curriculum_template.materi_block

-- Ketidaktersediaan instruktur
instructor_unavailability
├── id
├── instructor_id
├── date
└── reason
```

---

## 4. Algoritma Generate Jadwal

### Input
```
class_id, program_id, class_type, start_date, excluded_dates[]
```

### Pseudocode

```
function generateSchedule(class_id, program_id, class_type, start_date, excluded_dates):

  active_days     = getActiveDays(class_type)
  all_exclusions  = national_holidays ∪ excluded_dates
  curriculum      = getCurriculumTemplate(program_id)   -- parameterized
  exam_points     = getExamPoints(program_id)
  session_queue   = buildSessionQueue(curriculum, exam_points)
  -- queue: [pair, pair, ..., exam, pair, mixed, pair, ...]

  current_date = start_date
  results = []

  for each item in session_queue:
    date = findNextActiveDate(current_date, active_days, all_exclusions)

    if item.type == 'session_pair':
      results.push(session_1 at date slot_1)
      results.push(session_2 at date slot_2)
      current_date = date + 1 day

    else if item.type == 'exam_day':
      results.push(exam at date)
      current_date = date + 1 day

    else if item.type == 'mixed':
      -- Khusus Brevet AB ujian ke-2
      results.push(session at date slot_1)
      results.push(exam at date slot_2)
      current_date = date + 1 day

    else if item.type == 'single_session':
      -- Sesi ganjil di akhir periode (edge case)
      results.push(session at date slot_1)
      current_date = date + 1 day

  return results
```

### Catatan Khusus
- `buildSessionQueue` membaca `curriculum_exam_points.is_mixed_day` untuk tentukan tipe item
- Jika `has_exam = false` (Tax Planning Brevet C) → tidak ada item exam setelah blok itu
- Exam day ikut pola hari aktif kelas (tidak pindah ke hari lain secara otomatis)

---

## 5. Manajemen Libur & Eksklusi

### Dua Layer Eksklusi

```
Layer 1: national_holidays (global)
  → Admin isi sekali per tahun
  → Berlaku untuk semua kelas semua program

Layer 2: class_excluded_dates (per kelas)
  → Admin isi saat bikin jadwal
  → Bisa ditambah sewaktu-waktu
```

### UI Flow Input Libur
1. Admin pilih program + class_type + start_date
2. Kalender periode tampil — national holidays auto-highlight merah
3. Admin klik tanggal tambahan yang mau dieksklusi
4. Klik "Generate Jadwal" → preview muncul
5. Konfirmasi → tersimpan

---

## 6. Force Majeure & Makeup

### Alur Pembatalan

```
1. Admin pilih sesi → "Batalkan Sesi" → input alasan
2. Status → 'cancelled'
3. Sistem tanya: perlu makeup?
4. Jika ya → admin input tanggal makeup
5. Sistem validasi:
   ├── Tidak bentrok national_holidays
   ├── Tidak bentrok kelas lain di ruang yang sama
   └── Instruktur available (cek instructor_unavailability)
6. Sesi makeup ter-insert, status = 'makeup'
7. End date kelas auto-update → MAX(scheduled_date)
```

### Aturan Makeup
- Tanggal makeup = **manual input admin**
- Nomor sesi tetap (sesi 15 cancel → makeup tetap bernomor 15)
- Instruktur makeup bisa beda → tercatat di `actual_instructor_id`

---

## 7. Manajemen Instruktur

### Data & Keahlian
- Profil instruktur + daftar `materi_block` per `program_id` yang bisa diajar
- Assign per blok materi saat jadwal dibuat → auto-expand ke semua sesi dalam blok
- Satu materi → satu instruktur utama, bisa ada substitusi per sesi

### Conflict Detection
```
Cek saat assign ke blok:
  → Instruktur punya sesi lain di tanggal-tanggal blok ini (lintas kelas)
  → instructor_unavailability di tanggal tersebut
Jika conflict → warning + daftar tanggal yang bentrok
```

### Auto-suggest Instruktur
```
Filter saat assign blok:
  1. instructor_expertise.materi_block = blok yang dipilih
  2. instructor_expertise.program_id = program kelas ini
  3. Tidak conflict di semua tanggal sesi blok
  4. is_active = true
Output: shortlist qualified + available
```

### Substitusi Darurat
```
1. Instruktur A berhalangan di sesi X
2. Admin: "Ganti Instruktur" di sesi X
3. Sistem filter: qualified di materi + available di tanggal itu + tidak conflict
4. Admin pilih pengganti
5. actual_instructor_id update, planned_instructor_id tetap
```

### Histori Mengajar
```sql
SELECT s.*, c.class_name, p.name as program, sa.planned_instructor_id, sa.actual_instructor_id
FROM session_assignments sa
JOIN class_sessions s ON sa.session_id = s.id
JOIN classes c ON s.class_id = c.id
JOIN programs p ON c.program_id = p.id
WHERE sa.planned_instructor_id = :instructor_id
   OR sa.actual_instructor_id = :instructor_id
ORDER BY s.scheduled_date DESC
```

---

## 8. Honorarium Tracking (Phase 4)

- Bayar ke `actual_instructor_id` jika ada, fallback ke `planned_instructor_id`
- Rate bisa berbeda per `materi_block` atau per instruktur
- Output: laporan honorarium per periode / per instruktur / per program

---

## 9. UI/UX Flow Utama

### A. Buat Kelas Baru + Generate Jadwal
```
Form kelas
→ pilih program (Brevet AB / C / BFA)
→ pilih class_type (Weekend Pagi / Siang / Weekday)
→ input start_date
→ kalender eksklusi (holidays auto-highlight, admin tambah manual)
→ "Generate Jadwal" → preview tabel semua sesi + tanggal + hari ujian
→ konfirmasi → jadwal tersimpan
```

### B. Assign Instruktur
```
Buka jadwal kelas → tab "Instruktur"
→ list blok materi (sesuai program)
→ per blok: klik "Assign" → auto-suggest instruktur muncul
→ pilih → konfirmasi
```

### C. Force Majeure
```
Buka jadwal kelas → klik sesi
→ "Batalkan Sesi" → input alasan
→ prompt makeup? → input tanggal → validasi → simpan
```

### D. Histori Instruktur
```
Master Instruktur → klik instruktur
→ tab "Histori Mengajar"
→ list: program, kelas, tanggal, materi, status (planned / substitusi)
```

---

## 10. Rencana Implementasi

### Phase 1 — Core Scheduling
- [ ] Schema: `programs`, `curriculum_template`, `curriculum_exam_points`, `national_holidays`, `class_excluded_dates`, `class_sessions`
- [ ] Extend tabel `classes`: tambah `program_id`, `class_type`, `start_date`
- [ ] Seed program: Brevet AB, Brevet C, BFA
- [ ] Seed kurikulum Brevet AB (60 sesi + 5 exam events)
- [ ] Seed kurikulum Brevet C (30 sesi + 3 exam events)
- [ ] Seed kurikulum BFA (40 sesi + 5 exam events)
- [ ] Algoritma generate jadwal (parameterized by program_id)
- [ ] UI: form buat kelas + kalender eksklusi + preview jadwal
- [ ] UI: view jadwal kelas (tabel sesi + hari ujian)

### Phase 2 — Instruktur
- [ ] Schema: `instructors`, `instructor_expertise`, `instructor_unavailability`, `session_assignments`
- [ ] UI: master instruktur + expertise per program
- [ ] Auto-suggest instruktur per blok materi
- [ ] Conflict detection lintas kelas
- [ ] Histori mengajar per instruktur

### Phase 3 — Force Majeure & Makeup
- [ ] Flow pembatalan sesi + input makeup
- [ ] Validasi tanggal makeup (holiday + conflict)
- [ ] End date re-derive otomatis

### Phase 4 — Honorarium & Reporting
- [x] Rate instruktur per materi_block
- [x] Laporan honorarium per periode / per instruktur
- [x] Export jadwal ke PDF (replace proses Excel manual)

---

## 11. Dependency & Integrasi

- Extend tabel `classes` yang sudah ada (tambah `program_id`, `class_type`, `start_date`)
- RBAC existing → guard fitur ini dengan capability `manage_schedule`
- PDF export → replace proses Excel → PDF manual saat ini
- Room/ruang tracking (jika ada) → conflict detection makeup lebih akurat

---

## 12. Update Implementasi (29 April 2026)

### 12A. Form Instruktur
- Form tambah instruktur sekarang wajib punya minimal 1 keahlian.
- Setiap keahlian menyimpan: `program`, `materi_block`, dan `level` (`basic`, `middle`, `senior`).

### 12B. Konteks Alokasi Instruktur
- Master instruktur menampilkan ringkasan:
  - jumlah keahlian,
  - beban 7 hari,
  - beban 30 hari,
  - jumlah kelas aktif.
- Detail instruktur menampilkan kelas aktif, sesi terdekat, dan jumlah sesi menunggu konfirmasi WA.

### 12C. Rekomendasi Saat Assign
- Saat admin pilih blok materi, sistem menampilkan rekomendasi instruktur berbasis skor:
  - 50% kecocokan keahlian + level,
  - 25% beban 7 hari,
  - 15% histori materi sejenis,
  - 10% rotasi beban 30 hari.
- Output rekomendasi menampilkan skor, beban, kelas aktif, dan histori sejenis.

### 12D. Konfirmasi Ketersediaan via WA
- `session_assignments` menyimpan status ketersediaan:
  - `pending_wa_confirmation`,
  - `accepted`,
  - `rejected`,
  - `no_response`.
- Status default setelah assign/substitusi adalah `pending_wa_confirmation`.
- Admin melakukan kontak real-time via WA, lalu update status konfirmasi di tabel jadwal.
