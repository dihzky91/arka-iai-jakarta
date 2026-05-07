# Rencana Revamp Modul Keuangan

## Tujuan
Mendokumentasikan analisis modul keuangan saat ini, masalah utama, dan rencana implementasi revamp agar developer lain dapat memahami konteks dan tahapan kerja.

---

## 1. Ringkasan Kondisi Saat Ini

### Route & Page
- `/keuangan` → `src/app/(dashboard)/keuangan/page.tsx`
  - Tampilan dashboard sederhana: 3 metric card + satu akses cepat.
- `/keuangan/honorarium` → `src/app/(dashboard)/keuangan/honorarium/page.tsx`
  - Daftar batch honorarium + filter + export.
- `/keuangan/honorarium/[batchId]` → `src/app/(dashboard)/keuangan/honorarium/[batchId]/page.tsx`
  - Detail batch memakai shared component `HonorariumBatchDetail`.

### Komponen Utama
- `src/components/keuangan/FinanceBatchList.tsx`
  - Komponen client, filter + tabel HTML manual + export PDF/Excel.
- `src/components/dashboard/KeuanganWidget.tsx`
  - Widget dashboard utama menampilkan metric keuangan kecil.
- `src/components/jadwal-otomatis/HonorariumBatchDetail.tsx`
  - Komponen monolit 1473 baris, dipakai bersama modul jadwal otomatis.

### Alur Status Batch
- `draft` → `dikirim_ke_keuangan` → `diproses_keuangan` → `dibayar` → `locked`

### Temuan Utama
- `HonorariumBatchDetail` terlalu besar dan generik; dipakai untuk dua konteks berbeda.
- Dashboard keuangan terlalu sederhana.
- `FinanceBatchList` masih pakai tabel HTML manual tanpa pagination, sorting, atau fitur lanjutan.
- Tidak ada visual workflow/status pipeline.
- Tidak ada ringkasan keuangan granular dan alert aging batch.
- Tidak ada halaman laporan/rekap terpisah.
- Ada duplikasi metric antara `Dashboard Keuangan` dan `KeuanganWidget` di dashboard utama.

---

## 2. Proposal Revamp

### 2.1 Arsitektur Baru

```
/keuangan
├── page.tsx                    → Dashboard Keuangan (revamped)
├── honorarium/
│   ├── page.tsx                → Antrian Pembayaran (revamped)
│   └── [batchId]/
│       └── page.tsx            → Detail Batch (revamped, keuangan-specific)
└── laporan/
    └── page.tsx                → Laporan & Rekap (BARU)
```

### 2.2 Dashboard Keuangan (Revamped)
Fitur utama:
- Pipeline visual: horizontal stepper/kanban status batch.
- Klik tiap stage untuk filter ke antrian status tersebut.
- Alert batch lama >7 hari pada status `dikirim_ke_keuangan`.
- Ringkasan nominal: outstanding, bulan ini, YTD.
- Chart mini tren pembayaran per bulan.
- Quick action: tombol ke batch tertua di antrian.

### 2.3 Antrian Pembayaran (Revamped)
Fitur utama:
- TanStack Table / DataTable dengan server-side pagination dan sorting.
- Tab "Tabel" | "Kanban" untuk visual pipeline.
- Inline summary: jumlah batch dan outstanding sesuai filter.
- Kolom `Waktu Menunggu` dengan highlight SLA.
- Multi-select + bulk action `Tandai Diproses`.

### 2.4 Detail Batch (Revamped)
Pisahkan ke komponen kecil khusus modul keuangan:

```
components/keuangan/batch-detail/
├── BatchHeader.tsx
├── BatchStatusStepper.tsx
├── BatchReconciliation.tsx
├── BatchPaymentProofs.tsx
├── BatchInstructorRecap.tsx
├── BatchSessionItems.tsx
├── BatchDeductions.tsx
├── BatchAuditTrail.tsx
└── BatchActions.tsx
```

Perbedaan kunci dari versi jadwal otomatis:
- Status stepper visual di atas halaman.
- Aksi keuangan prominent: proses / bayar ditempatkan jelas.
- Potongan read-only untuk staf keuangan.
- Rekonsiliasi visual dengan progress/gauge.
- Upload bukti bayar drag & drop.

### 2.5 Laporan & Rekap (BARU)
Halaman baru untuk:
- Rekap bulanan per instruktur.
- Export laporan periodik.
- Filter periode, status, instruktur.

### 2.6 Workflow yang Lebih Jelas
```
┌─────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌────────┐    ┌────────┐
│  DRAFT  │───▶│ DIKIRIM KEUANGAN │───▶│ DIPROSES KEUANGAN│───▶│ DIBAYAR │───▶│ LOCKED │
│ (admin) │    │  (antrian masuk)  │    │ (keuangan proses)│    │(dibayar)│    │(final) │
└─────────┘    └──────────────────┘    └─────────────────┘    └────────┘    └────────┘
                    ▲                          ▲                    ▲
                    │                          │                    │
               admin submit              keuangan:process      keuangan:pay
                                                                    │
                                                              + upload bukti
                                                              + rekonsiliasi
                                                                    │
                                                              keuangan:pay
                                                              → lock batch
```

Problem yang harus ditangani:
- Tidak ada SLA / timeout alert.
- Tidak ada notifikasi otomatis ke admin saat batch dibayar.
- Reopen hanya oleh admin; seharusnya keuangan juga bisa dengan alasan.

---

## 3. Prioritas Implementasi

| Prioritas | Item | Effort |
|---|---|---|
| P1 | Pecah `HonorariumBatchDetail` jadi sub-komponen keuangan | Medium |
| P1 | Buat `BatchStatusStepper` visual pipeline | Small |
| P1 | Dashboard keuangan: pipeline visual + alert + ringkasan nominal | Medium |
| P2 | Ganti tabel HTML → DataTable (TanStack Table) di `FinanceBatchList` | Medium |
| P2 | Batch aging & SLA alert | Small |
| P2 | Upload bukti bayar: drag & drop | Small |
| P3 | Halaman Laporan & Rekap terpisah | Large |
| P3 | Chart tren pembayaran di dashboard | Medium |
| P3 | Kanban view option | Large |
| P3 | Multi-select bulk action | Medium |

---

## 4. Rencana Kerja Detil

### 4.1 Tahap 1: Foundation dan refactor struktur
1. Buat route baru `src/app/(dashboard)/keuangan/laporan/page.tsx`.
2. Bangun `src/components/keuangan/batch-detail/` dengan komponen ringkas.
3. Buat versi `HonorariumBatchDetailKeuangan` yang khusus keuangan, sementara modul jadwal otomatis tetap memakai versi lama.
4. Perbarui route `/keuangan/honorarium/[batchId]` agar memakai komponen baru.

### 4.2 Tahap 2: Dashboard Keuangan revamp
1. Tambahkan status pipeline di `src/app/(dashboard)/keuangan/page.tsx`.
2. Ambil data counts per status menggunakan `listHonorariumBatches({ financeOnly: true })` atau endpoint API baru khusus metrics.
3. Tambahkan ringkasan `outstanding`, `bulan ini`, `YTD`.
4. Tambahkan chart mini per bulan menggunakan `recharts`.
5. Tambahkan quick action ke batch tertua di status `dikirim_ke_keuangan`.
6. Tambahkan alert untuk batch >7 hari di status `dikirim_ke_keuangan`.

### 4.3 Tahap 3: Antrian Pembayaran revamp
1. Perluas server action `listHonorariumBatches` untuk mendukung pagination, sorting, filters, aging.
2. Ubah `FinanceBatchList` ke TanStack Table / DataTable.
3. Tambahkan summary informasi batch/nominal di atas tabel.
4. Buat kolom `Waktu Menunggu` dan highlight SLA.
5. Tambahkan tab view: `Tabel` dan `Kanban`.
6. Tambahkan multi-select + bulk action untuk batch yang eligible diproses.

### 4.4 Tahap 4: Detail Batch Keuangan
1. Desain `BatchHeader` dengan informasi batch dan status stepper.
2. Desain `BatchStatusStepper` untuk visual progress status.
3. Desain `BatchReconciliation` dengan status pembayaran dan selisih.
4. Desain `BatchPaymentProofs` dengan drag & drop upload.
5. Desain `BatchInstructorRecap`, `BatchSessionItems`, `BatchDeductions`, `BatchAuditTrail`, `BatchActions`.
6. Hidungkan komponen yang hanya read-only bagi keuangan.
7. Pastikan `canProcess`, `canPay`, `canManage` memetakan action sesuai capability.

### 4.5 Tahap 5: Laporan & Rekap
1. Buat halaman rekap bulanan/instruktur di `src/app/(dashboard)/keuangan/laporan/page.tsx`.
2. Reuse `getFinanceHonorariumRecap` dan `exportFinanceHonorariumRecapExcel`.
3. Tambahkan filter periode, status, instruktur.
4. Tambahkan export PDF / Excel.

---

## 5. Catatan Teknis dan Dependencies

### Server-side
- `src/server/actions/jadwal-otomatis/honorarium.ts`
  - `listHonorariumBatches` perlu perluasan untuk paging/sorting/aging.
  - `getFinanceHonorariumRecap` sudah dapat jadi basis laporan.
- `src/server/actions/statistics.ts`
  - `getKeuanganMetrics()` berisi count status dan total dibayar.
  - Pertimbangkan menambah `getKeuanganDashboardMetrics()` khusus outstanding/trend.

### Frontend
- `src/app/(dashboard)/keuangan/page.tsx` perlu diupdate dari card sederhana ke dashboard baru.
- `src/components/keuangan/FinanceBatchList.tsx` perlu migrasi ke TanStack Table.
- `src/components/jadwal-otomatis/HonorariumBatchDetail.tsx` perlu disarikan ke komponen baru di `src/components/keuangan/batch-detail/`.
- `recharts` dapat digunakan untuk chart; jika belum terpasang, tambahkan dependency.

### UX
- Pastikan keuangan-specific detail batch tidak menampilkan form potongan/edit yang hanya untuk admin/jadwal otomatis.
- Pastikan batch aging / SLA highlight mudah dibaca.
- Buat quick action untuk mempercepat workflow staf keuangan.

---

## 6. Checklist Developer

- [ ] Buat file dokumen baru: `docs/REVAMP_KEUANGAN.md`.
- [x] Buat route `keuangan/laporan`.
- [x] Refactor batch detail ke komponen terpisah.
- [ ] Implement dashboard pipeline visual.
- [ ] Upgrade `FinanceBatchList` ke TanStack Table.
- [ ] Tambahkan aging/SLA alert.
- [ ] Implement drag & drop payment proof upload.
- [ ] Tambahkan laporan & ekspor.
- [ ] Pastikan permissions/capabilities keuangan masih valid.

---

## 7. Rekomendasi Lanjutan

- Pertimbangkan menambah notifikasi otomatis ke admin saat batch `dibayar` selesai.
- Pertimbangkan menambah kemampuan reopen batch oleh role keuangan dengan alasan.
- Pertimbangkan implementasi `kanban` pada dashboard keuangan atau antrian untuk visual pipeline lebih kuat.
- Pertimbangkan pembagian `dashboard` dan `modul laporan` untuk memisahkan insight dan operasi.
