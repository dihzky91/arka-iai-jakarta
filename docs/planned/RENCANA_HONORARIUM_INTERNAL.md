# Rencana Implementasi Honorarium Internal

## Status
Draft implementasi internal (tanpa keterlibatan instruktur di sistem)

Checkpoint terakhir: 29 April 2026 (Asia/Jakarta) - workflow status keuangan inti sudah jalan (`draft -> dikirim_ke_keuangan -> diproses_keuangan -> dibayar -> locked`) + halaman detail batch.

---

## 1. Tujuan

- Mengubah proses honorarium dari manual (Excel/PDF/print) menjadi workflow digital internal.
- Menyediakan data honorarium yang siap direview dan diproses keuangan tanpa input ulang.
- Menjaga akurasi, audit trail, dan konsistensi per periode pembayaran.

---

## 2. Koreksi Scope (Penting)

Sistem ini hanya untuk internal:

- Instruktur tidak login ke sistem.
- Instruktur tidak approve di sistem.
- Konfirmasi ketersediaan instruktur tetap dilakukan admin via WA/komunikasi offline, lalu admin mengupdate status di sistem.

Peran sistem:

- Operasional menyusun dan finalisasi draft honorarium.
- Keuangan menerima, verifikasi, dan menandai pembayaran.

---

## 3. Peran dan Hak Akses

### 3.1 Operasional (Admin Jadwal)
- Menjaga data kelas, assignment, dan status konfirmasi WA.
- Generate draft honorarium per periode.
- Melakukan koreksi sebelum dikirim ke keuangan.

### 3.2 Keuangan
- Menerima dokumen honorarium dari operasional.
- Verifikasi nominal.
- Tandai status pembayaran (`diproses` / `dibayar`).
- Upload atau isi referensi bukti pembayaran.

### 3.3 Auditor atau Pimpinan (opsional read-only)
- Melihat ringkasan, histori perubahan, dan jejak audit.

---

## 4. Aturan Bisnis Utama

### 4.1 Dasar sesi yang dibayar
- Hanya sesi yang memenuhi kriteria layak bayar, contoh:
  - `class_session.status = completed`
  - `session_assignment.availability_status = accepted`

### 4.2 Pengajar yang dibayar
- Jika ada substitusi: bayar ke `actual_instructor_id`.
- Jika tidak ada substitusi: bayar ke `planned_instructor_id`.

### 4.3 Level honorarium
- Level keahlian standar:
  - `Basic`
  - `Middle`
  - `Senior`
- Level dipakai dalam penentuan rate.

### 4.4 Hirarki rate
- Prioritas rate:
  1. Override rate per instruktur + program + materi block
  2. Rate standar per level + program + materi block
  3. Fallback rate standar per level + program

### 4.5 Cut-off periode
- Periode honorarium wajib eksplisit (`tanggal_awal` - `tanggal_akhir`).
- Aturan sesi lintas bulan harus baku (berdasarkan `scheduled_date` atau `completed_at`, pilih satu dan konsisten).

---

## 5. Workflow End-to-End (Internal)

1. Operasional pilih periode honorarium.
2. Sistem generate draft:
- daftar sesi layak bayar,
- instruktur penerima,
- rate terpakai,
- subtotal per instruktur.
3. Operasional review dan koreksi valid.
4. Operasional kirim ke keuangan.
5. Keuangan review dan proses bayar:
- `diproses`
- `dibayar` (isi tanggal bayar + referensi transfer).
6. Periode dikunci (`locked`) setelah dibayar/final.

---

## 6. Status Dokumen Honorarium

- `draft`
- `dikirim_ke_keuangan`
- `diproses_keuangan`
- `dibayar`
- `locked`

Catatan:
- Perubahan data hanya boleh di status `draft`.
- Setelah `locked`, perubahan via mekanisme revisi resmi.

---

## 7. Struktur Data yang Disarankan

### 7.1 Header dokumen honorarium
`honorarium_batches`
- `id`
- `periode_awal`, `periode_akhir`
- `nomor_dokumen`
- `status`
- `generated_by`, `paid_by`
- `submitted_at`, `paid_at`, `locked_at`
- `catatan_internal`

### 7.2 Detail per sesi
`honorarium_items`
- `id`
- `batch_id`
- `assignment_id`
- `kelas_id`, `program_id`
- `scheduled_date`
- `paid_instructor_id`
- `expertise_level_snapshot` (`basic/middle/senior`)
- `rate_snapshot`
- `amount`

### 7.3 Snapshot total per instruktur (opsional performa)
`honorarium_recaps`
- `batch_id`
- `instructor_id`
- `total_sessions`
- `gross_amount`
- `deductions`
- `net_amount`

### 7.4 Audit log
`honorarium_audit_logs`
- `id`, `batch_id`, `actor_id`, `action`, `payload`, `created_at`

---

## 8. Snapshot dan Auditability

Prinsip:

- Nominal final harus immutable per batch.
- Jika master rate berubah besok, batch yang sudah `locked` tidak ikut berubah.

Saat generate:

- Simpan `rate_snapshot`, `level_snapshot`, dan `rule_source` (override atau rate standar atau fallback).

---

## 9. Integrasi Dengan Modul yang Sudah Ada

Sumber data existing:

- `class_sessions`
- `session_assignments`
- `instructor_rates`
- `instructor_expertise` (level Basic/Middle/Senior)

Integrasi minimum:

- Tombol `Generate Honorarium` di modul honorarium.
- Filter berdasarkan periode, program, kelas, instruktur.
- Tabel detail + rekap internal.

---

## 9.1 Basis Hitungan Honorarium (Tarif 2024)

Sumber: template internal "Kenaikan Honor Pengajar tahun 2024".

### Matriks Tarif

#### Junior
| Komponen | Brevet AB | E-SPT | Brevet C | BFA |
|---|---:|---:|---:|---:|
| Honor per sesi | 275000 | 400000 | 425000 | 275000 |
| Transport Online | 40000 | 40000 | 55000 | 40000 |
| Transport Offline | 60000 | 60000 | 85000 | 85000 |

#### Middle
| Komponen | Brevet AB | E-SPT | Brevet C | BFA |
|---|---:|---:|---:|---:|
| Honor per sesi | 290000 | 400000 | 425000 | 285000 |
| Transport Online | 40000 | 40000 | 55000 | 40000 |
| Transport Offline | 60000 | 60000 | 85000 | 85000 |

#### Senior
| Komponen | Brevet AB | E-SPT | Brevet C | BFA |
|---|---:|---:|---:|---:|
| Honor per sesi | 375000 | 450000 | 525000 | 300000 |
| Transport Online | 50000 | 50000 | 75000 | 50000 |
| Transport Offline | 75000 | 75000 | 100000 | 100000 |

### Rumus Hitung Sistem (per item sesi)

`total_item = honor_per_sesi + transport`

Dengan:
- `honor_per_sesi` diambil dari `program + level (Basic/Middle/Senior)`.
- `transport` diambil dari:
  - `Transport Online` jika mode kelas `online`.
  - `Transport Offline` jika mode kelas `offline`.

### Aturan Berlaku Tarif

- Berlaku mulai: **3 Februari 2024**.
- Catatan template: mulai angkatan 189 RP Offline - Bekasi.
- Implementasi sistem:
  - simpan `effective_from`,
  - siapkan field scope aturan (angkatan/lokasi/mode) agar tarif historis tetap akurat.

### Prioritas Penerapan Tarif di Sistem

1. Override khusus per instruktur (jika ada kebijakan manual)
2. Tarif matriks standar (berdasarkan tabel di atas)
3. Jika data tarif tidak ditemukan maka item ditandai `rate_missing` dan tidak bisa submit ke keuangan

---

## 10. Format Pelaporan ke Keuangan

### 10.1 Mode utama
- Keuangan review langsung di sistem (tanpa print).

### 10.2 Mode fallback
- Export Excel format template lama (untuk kebutuhan eksternal atau audit tertentu).
- Export PDF hanya opsional.

Tujuan:
- Workflow utama paperless, tetapi tetap kompatibel dengan kebiasaan lama saat diperlukan.

---

## 11. Kontrol dan Governance

- Lock periode setelah pembayaran.
- Reopen periode hanya oleh role tertentu + alasan wajib.
- Semua action penting tercatat di audit log.

---

## 12. Rencana Implementasi Bertahap

### Phase A - Fondasi Internal
- Schema `honorarium_batches`, `honorarium_items`, `honorarium_audit_logs`.
- Generate draft dari data sesi.
- Rekap per instruktur.

### Phase B - Workflow Internal ke Keuangan
- Submit batch ke keuangan.
- Status flow lengkap tanpa supervisor.
- Hak akses dan guard status.

### Phase C - Keuangan dan Pembayaran
- Inbox atau halaman keuangan.
- Status `diproses`/`dibayar`.
- Bukti pembayaran/reference number.

### Phase D - Finalisasi Paperless dan Fallback
- Lock batch.
- Export Excel template lama otomatis.
- Dashboard ringkasan honorarium.

### 12.1 Checklist Eksekusi (Tracking)

#### A. Fondasi Internal
- [x] Tambah schema `honorarium_batches`.
- [x] Tambah schema `honorarium_items` (snapshot rate/level/amount).
- [x] Tambah schema `honorarium_audit_logs`.
- [x] Tambah schema `honorarium_rate_rules` (master tarif standar + effective date).
- [x] Buat action `generateHonorariumBatch()` dari periode.
- [x] Terapkan filter sesi layak bayar (`completed` + `accepted`) saat generate draft.
- [x] Terapkan fallback rate dari master tarif (`program + level + mode + tanggal berlaku`).
- [x] Tampilkan daftar batch internal di halaman honorarium.
- [x] Tambah halaman detail batch (header + item + audit trail).

#### B. Workflow Internal ke Keuangan
- [x] Aksi kirim ke keuangan (`draft -> dikirim_ke_keuangan`).
- [x] Guard status: batch terkunci edit ketika sudah dikirim ke keuangan.
- [x] Catat audit log untuk semua transisi status.

#### C. Serah ke Keuangan dan Pembayaran
- [x] Aksi proses bayar (`-> diproses_keuangan`).
- [x] Aksi selesai bayar (`-> dibayar`) + tanggal bayar + referensi transfer.
- [x] Tampilan queue keuangan (filter status + periode).
- [x] Rekap total gross/net per batch untuk keuangan.

#### D. Finalisasi dan Governance
- [x] Aksi lock batch (`-> locked`) setelah pembayaran final.
- [x] Mekanisme reopen terbatas role (admin) + alasan wajib.
- [x] Validasi kelengkapan data sebelum lock.
- [x] Nomor dokumen honorarium konsisten dan unik per batch.
- [x] Laporan audit perubahan per batch.
- [x] Deductions dan perhitungan `net_amount` riil (PPh 21, PPh 23, other).

#### E. Output dan Integrasi
- [x] Export Excel sesuai template keuangan (fallback) — 3 sheet (Ringkasan, Potongan, Detail Sesi).
- [x] Export PDF opsional (jika diperlukan pimpinan/audit).
- [x] Notifikasi internal saat status berubah (operasional/keuangan).
- [x] Rekonsiliasi total batch vs total pembayaran.

### 12.2 Checkpoint Lintas Device

#### Selesai dikerjakan
- [x] Fondasi data: `honorarium_batches`, `honorarium_items`, `honorarium_audit_logs`.
- [x] Master tarif standar: `honorarium_rate_rules` + seed tarif 2024.
- [x] Generate draft batch honorarium dari periode.
- [x] Validasi sesi layak bayar (`completed + accepted`).
- [x] Perhitungan rate prioritas: override instruktur -> matriks standar -> missing.
- [x] Blok generate jika ada `rate_missing`.
- [x] UI daftar batch internal + tombol generate draft.
- [x] Detail report tampilkan komponen `honor`, `transport`, dan `sumber rate`.
- [x] Halaman detail batch honorarium (header, item, audit trail, aksi status per state).
- [x] Workflow status batch keuangan (`draft -> dikirim_ke_keuangan -> diproses_keuangan -> dibayar -> locked`).
- [x] Audit trail untuk transisi status batch.

#### Selesai dikerjakan
- [x] Deductions dan perhitungan `net_amount` riil (`honorarium_deductions` + UI CRUD).
- [x] Mekanisme reopen batch terbatas role (admin only) + alasan wajib (mandatory reason).
- [x] Export Excel template keuangan (fallback) — 3 sheet (Ringkasan, Potongan, Detail Sesi).

#### Belum dikerjakan (next)
- [x] Semua item inti sudah selesai.

#### Langkah pertama saat resume di device lain
1. Pull/update branch terbaru.
2. Jalankan migrasi DB terbaru (minimal sampai `0036_honorarium_rate_rules.sql`).
3. Jalankan app dan cek modul `/jadwal-otomatis/honorarium`.
4. Lanjut hardening/opsional sesuai kebutuhan operasional.

---

## 13. Kriteria Sukses (Acceptance Criteria)

- Admin dapat generate honorarium periode tanpa hitung manual di luar sistem.
- Keuangan dapat memproses dan menandai pembayaran langsung di sistem.
- Batch final memiliki snapshot nominal yang tidak berubah.
- Jejak audit tersedia untuk seluruh perubahan penting.

---

## 14. Risiko dan Mitigasi

### Risiko
- Perbedaan pemahaman sesi layak bayar.
- Rate tidak lengkap.
- Koreksi manual terlambat setelah lock.

### Mitigasi
- Definisikan aturan layak bayar tertulis sejak awal.
- Validasi pre-submit: blok submit jika rate belum lengkap.
- Fitur revisi resmi (bukan edit langsung batch locked).

---

## 15. SOP Operasional Singkat

1. Admin update status sesi dan status WA.
2. Admin generate batch honorarium periode.
3. Admin review + kirim ke keuangan.
4. Keuangan proses pembayaran dan lock batch.

---

## 16. Catatan Implementasi Lanjutan (Opsional)

- Integrasi notifikasi internal (in-app/email) saat status berubah.
- Rekonsiliasi otomatis total batch vs total transfer.
- Multi-entitas pembayaran (jika nanti ada rekening/kanal berbeda).

---

## 17. Handover Status Terakhir (29 April 2026, Asia/Jakarta)

### Ringkasan progres saat sesi ini berhenti
- Implementasi honorarium sudah sampai workflow internal-keuangan inti sampai lock batch.
- Halaman detail batch sudah tersedia di `/jadwal-otomatis/honorarium/[batchId]` dengan header, item, rekap instruktur, audit trail, dan action button sesuai status.
- Action status yang sudah aktif: `submit to finance`, `mark in process`, `mark paid` (tanggal bayar + referensi transfer), `lock`, dan `reopen` (admin only + alasan wajib).
- **Deductions**: Tabel `honorarium_deductions` + CRUD di halaman detail batch (hanya saat status draft). Net amount sekarang real = gross - deductions.
- **Export Excel**: Tombol Excel di header detail batch, 3 sheet (Ringkasan, Potongan, Detail Sesi).
- **Reopen**: Khusus admin, input alasan wajib, mengembalikan batch ke draft dari status apa pun.
- Audit log status transisi sudah dicatat di `honorarium_audit_logs` (termasuk `deduction_added`, `deduction_removed`, `batch_reopened`, `batch_exported_excel`).
- Queue batch keuangan di halaman utama sudah bisa difilter berdasarkan status dan periode.
- Rekap gross/net per batch sudah menampilkan nilai riil dengan deductions.
- Dokumen ini tetap jadi acuan lintas agent untuk fase lanjutan.

### Status git saat ini
- Working tree berisi banyak perubahan lokal (modifikasi + file baru), termasuk migrasi sampai `0036_honorarium_rate_rules.sql` dan modul honorarium.
- Commit dan push **belum dilakukan**.
- Percobaan commit terakhir gagal karena hak akses `.git/index.lock` (permission denied) di environment agent.
- Aksi lanjutan yang tertunda: `git add -A`, `git commit`, lalu `git push origin main` setelah izin akses tersedia.

### Titik lanjut paling aman untuk agent berikutnya
1. Jalankan migrasi DB: `0037_honorarium_deductions.sql` (buat tabel honorarium_deductions).
2. Verifikasi app tetap jalan setelah migrasi.
3. Lanjutkan hardening/opsional (monitoring & penyempurnaan UX rekonsiliasi) bila diperlukan.
4. Commit dan push seluruh perubahan.


