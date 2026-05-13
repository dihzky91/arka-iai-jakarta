# Rencana Implementasi Lanjutan Revamp UI/UX ARKA

Dokumen ini berisi rencana implementasi lanjutan untuk merapikan UI/UX ARKA setelah struktur sidebar dianggap sudah sesuai. Fokus utama revamp ini adalah area konten utama, dashboard, pola data, form, empty state, dan konsistensi visual aplikasi.

> **Terakhir diperbarui:** 13 Mei 2026 — Ditambahkan temuan kroscek codebase, checklist per tahapan, dan catatan inkonsistensi.

---

## 1. Prinsip Utama

Revamp ARKA tidak diarahkan menjadi tampilan dekoratif atau landing page. ARKA harus terasa seperti aplikasi kerja modern yang bersih, cepat dibaca, mudah digunakan, dan tetap kuat untuk proses administrasi yang kompleks.

Target rasa produk:

- Modern, tapi tetap formal dan dapat dipercaya.
- Ringan secara visual, tapi tidak kosong.
- Mudah dipahami oleh pengguna baru.
- Efisien untuk pengguna yang bekerja setiap hari.
- Kuat untuk modul yang kompleks seperti persuratan, ujian, sertifikat, keuangan, dan project.

Sidebar tidak menjadi fokus perubahan karena struktur dan tampilannya sudah disukai.

---

## 2. Masalah Yang Terlihat Saat Ini

Berdasarkan tampilan dashboard saat ini, beberapa hal yang perlu diperbaiki:

- Area utama terlalu kosong setelah kartu statistik.
- Kartu statistik terasa terlalu besar, kaku, dan kurang informatif.
- **Border terlalu berat** pada kartu di tab Persuratan, Ujian, dan Analitik Persuratan — `Card` base component memakai `border` yang resolve ke `--border` (slate-300), terasa gelap/tebal dibanding kartu di RingkasanTab yang sudah memakai `border-slate-100`.
- Tab dashboard terlalu datar dan belum memberi rasa workspace aktif.
- Dashboard belum cukup membantu pengguna mengambil keputusan.
- Belum terlihat jelas kekuatan aplikasi ARKA selain angka ringkas.
- Visual hierarchy masih bisa diperkuat: mana informasi utama, mana aksi, mana insight.

### 2.1 Inkonsistensi Visual yang Ditemukan saat Kroscek

- **`UjianDashboardWidget`** memakai `Card` + `CardContent` dasar (border slate-300), sedangkan widget lain (Persuratan, Kepegawaian, Keuangan, Sertifikat) sudah memakai `MetricCard` (border-slate-100). Tab Ujian terlihat berbeda dari tab lain.
- **`MetricCard`** punya hardcoded `bg-white` dan `text-slate-900` yang tidak support dark mode. Widget lain memakai `bg-card` dan `text-foreground` yang responsif terhadap tema.
- **`AntreanPersuratanCard`** di DashboardContent juga hardcoded `bg-white`, `text-slate-900`, `border-slate-100` — tidak konsisten dengan design token system.
- **`Input`** component memakai style custom (`border-slate-200/60`, `bg-slate-50/50`) yang tidak memakai design tokens (`border-input`, `bg-background`), inkonsisten dengan form system.
- **`StatCard`** di StatsCharts (Analitik Persuratan) memakai `Card` base tanpa icon, tone, atau hint — jauh lebih sederhana dari `MetricCard` yang dipakai di tab lain.
- **Dark mode** belum tercakup — beberapa komponen dashboard tidak punya `dark:` variants.

---

## 3. Arah Desain Baru

ARKA akan diarahkan menjadi **Modern Operational Workspace**.

Karakter visual:

- Bersih dan profesional.
- Banyak ruang napas, tetapi tidak membiarkan halaman terasa kosong.
- Card lebih halus dengan border dan shadow yang ringan.
- Informasi penting muncul lebih cepat.
- Aksi utama mudah ditemukan.
- Dashboard terasa hidup karena ada ringkasan, aktivitas, prioritas, dan insight.

---

## 4. Scope Yang Tidak Diubah

Bagian berikut tidak menjadi target utama perubahan:

- Struktur sidebar utama.
- Pola navigasi sidebar yang sudah ada.
- Logic backend.
- Behavior bisnis yang sudah berjalan.
- Data model, kecuali memang diperlukan untuk tampilan baru.

---

## 5. Scope Yang Akan Direvamp

### 5.1 Dashboard Main Area

Dashboard akan diubah dari sekadar kumpulan kartu angka menjadi pusat aktivitas.

Komponen yang akan ditambahkan atau dirapikan:

- Greeting section yang lebih ringkas dan premium.
- KPI cards yang lebih padat dan elegan.
- Quick action area.
- Panel aktivitas terbaru.
- Panel prioritas hari ini.
- Panel jadwal atau deadline terdekat.
- Empty state yang tetap terlihat matang saat data masih sedikit.

Tujuannya: saat admin masuk, dia langsung tahu apa yang perlu diperhatikan dan apa aksi berikutnya.

### 5.2 Stat Cards

Kartu statistik akan dibuat lebih modern dan informatif.

Perubahan:

- Border berat (slate-300 dari `Card` base / `border-border`) diganti menjadi border halus seperti `border-slate-100` atau `border-border/50`, konsisten dengan `MetricCard` yang sudah soft.
- Shadow dibuat soft.
- Ukuran kartu dibuat lebih proporsional.
- Icon dibuat lebih menyatu dengan konteks.
- Warna badge atau icon mengikuti kategori data.
- Tambahkan micro-copy kecil jika berguna, misalnya `+2 minggu ini` atau `Tidak ada ujian hari ini`.

Contoh kartu:

- Ujian Hari Ini
- Ujian Minggu Ini
- Ujian Bulan Ini
- Total Pengawas

Kartu tetap harus ringkas, tetapi tidak terasa kosong.

### 5.3 Tab Dashboard

Tab seperti Ringkasan, Persuratan, Kepegawaian, Sertifikat, Keuangan, Ujian, dan Analitik Persuratan akan dibuat lebih nyaman.

Perubahan:

- Active tab dibuat lebih jelas, tetapi tetap halus.
- Spacing diperbaiki agar tidak terasa seperti garis panjang kosong.
- Pada layar kecil, tab dibuat horizontal scroll.
- Setiap tab punya konten yang terasa lengkap, bukan hanya empat kartu lalu kosong.

Masalah spesifik per tab (ditemukan saat kroscek):

- **Tab Ujian**: Hanya menampilkan 4 kartu angka via `UjianDashboardWidget` (Card base, border slate-300). Tidak ada jadwal terdekat, pengawas aktif, ujian butuh perhatian, atau aksi cepat. Perlu konten tambahan dan migrasi ke `MetricCard`.
- **Tab Analitik Persuratan**: `StatCard` dan `Card` chart memakai border slate-300. `StatCard` jauh lebih sederhana dari `MetricCard` — perlu diseragamkan.
- **Tab Persuratan**: `ListPanel` dan list items memakai `border-border` (slate-300). Perlu dilunakkan ke `border-border/60` atau `border-slate-200`.

### 5.4 Layout Konten Per Tab

Setiap tab dashboard akan memakai pola layout konsisten:

1. Header kecil konteks tab.
2. KPI ringkas.
3. Area insight atau aktivitas.
4. Area quick action.
5. Data terbaru atau daftar prioritas.

Contoh untuk tab Ujian:

- KPI ujian.
- Jadwal ujian terdekat.
- Pengawas yang aktif.
- Ujian yang butuh perhatian.
- Aksi cepat: buat ujian, atur pengawas, lihat kalender.

### 5.5 Empty State

Area kosong besar akan diganti dengan empty state yang fungsional.

Contoh:

- Jika belum ada ujian hari ini, tampilkan pesan singkat.
- Sertakan aksi relevan jika user punya permission.
- Hindari halaman terasa belum selesai.

Empty state harus membantu, bukan hanya menjadi dekorasi.

### 5.6 Data Display

Tabel atau list akan dibuat lebih mudah discan.

Pola baru:

- List row dengan ikon atau avatar.
- Judul utama jelas.
- Metadata kecil di bawah judul.
- Badge status di kanan.
- Action button konsisten.
- Hover state halus.

Pola ini cocok untuk persuratan, project, ujian, sertifikat, dan aktivitas.

### 5.7 Form dan Dialog

Form akan dibuat lebih ringan dan percaya diri.

Perubahan:

- Label lebih jelas.
- Input lebih modern.
- Focus state konsisten.
- Error state mudah terlihat.
- Dialog tidak terlalu padat.
- Primary action selalu jelas.
- Loading state pada submit.

Tujuannya: pengguna merasa mudah memasukkan data tanpa takut salah.

### 5.8 Visual System

Akan dibuat sistem visual global agar semua halaman terasa satu keluarga.

Elemen yang distandarkan:

- Page header.
- Section header.
- KPI card.
- Data card.
- List row.
- Badge status.
- Empty state.
- Button action.
- Dialog.
- Form field.
- Loading skeleton.

---

## 6. Rencana Tahapan Implementasi

### Tahap 1: Audit UI Existing

Cek komponen utama yang sudah ada:

- [x] Dashboard page.
- [x] Layout aplikasi.
- [x] Card component.
- [x] Button component.
- [x] Badge component.
- [x] Tabs component.
- [x] Form/Input component.
- [x] Halaman project/detail jika terkait.
- [x] Inkonsistensi `MetricCard` (hardcoded `bg-white`) vs widget lain (memakai `bg-card`).
- [x] `UjianDashboardWidget` yang belum memakai `MetricCard`.
- [x] `Input` component yang tidak memakai design tokens.
- [x] Dark mode support per komponen dashboard.

Output tahap ini:

- [x] Daftar file yang perlu disentuh.
- [x] Komponen yang bisa dipakai ulang.
- [x] Komponen yang perlu dibuat baru.

### Tahap 2: Rapikan Design Tokens

Perbaiki dasar visual tanpa mengubah flow.

Yang dicek:

- [x] Color palette.
- [x] Border radius.
- [x] Shadow.
- [x] Spacing.
- [x] Font weight.
- [x] Background surface.
- [x] Border style.
- [x] Standarisasi penggunaan `bg-card` / `text-foreground` menggantikan hardcoded warna (`bg-white`, `text-slate-900`).
- [x] Audit dark mode readiness seluruh komponen dashboard.
- [x] Seragamkan `Input` agar memakai `border-input` dan `bg-background` dari token system.
- [x] Evaluasi apakah `--border` token (saat ini slate-300) perlu dilunakkan ke ~slate-200 agar `Card` base tidak terasa berat.

Target:

- [x] UI terasa lebih soft, premium, dan konsisten.
- [x] Tidak ada dominasi border yang terlalu berat (slate-300 di `Card` base dan `border-border`).
- [x] Semua komponen dashboard mendukung dark mode.

### Tahap 3: Revamp Dashboard Shell

Perbaiki area utama dashboard:

- [x] Header dashboard.
- [x] Greeting.
- [x] Tab navigation.
- [x] Grid layout.
- [x] Responsive behavior.
- [x] Spacing antar section.

Sidebar tetap dipertahankan.

### Tahap 4: Revamp Tab Ujian dan Ringkasan

Mulai dari tab yang terlihat dan paling berdampak.

Prioritas pertama:

- [x] Tab Ujian — paling kosong saat ini, hanya 4 kartu angka tanpa konten tambahan.
- [x] Tab Ringkasan — sudah paling lengkap, perlu polish saja.

Perbaikan spesifik Tab Ujian:

- [x] Migrasi `UjianDashboardWidget` dari `Card` base ke `MetricCard` (konsistensi visual).
- [x] Tambahkan panel jadwal ujian terdekat.
- [x] Tambahkan panel pengawas aktif.
- [x] Tambahkan panel ujian yang butuh perhatian.
- [x] Tambahkan aksi cepat: buat ujian, atur pengawas, lihat kalender.
- [x] Tambahkan empty state fungsional saat tidak ada ujian.

Perbaikan spesifik Tab Ringkasan:

- [x] Pastikan `MetricCard` dan `AntreanPersuratanCard` sudah memakai design tokens (bukan hardcoded warna).
- [x] Polish spacing dan visual hierarchy.

Alasan:

- Tab Ujian adalah wajah utama yang paling kosong — dampak perbaikan paling terasa.
- Tab Ringkasan sudah cukup baik, bisa jadi pola referensi.
- Kedua tab bisa menjadi template untuk tab lain.

### Tahap 5: Buat Komponen Dashboard Reusable

Komponen yang sudah ada (perlu distandarisasi, bukan dibuat baru):

- [x] `MetricCard` — sudah ada di `src/components/dashboard/MetricCard.tsx`, perlu hapus hardcoded `bg-white`/`text-slate-900` dan gunakan design tokens.
- [x] `DashboardSection` — sudah ada di `src/components/dashboard/DashboardSection.tsx` dan sudah dipolish ringan pada header, icon surface, link detail, serta spacing.

Komponen yang perlu dibuat baru:

- [x] `DashboardEmptyState` — buat dari pola inline yang sudah ada di `ListPanel` dan widget lain. Saat ini empty state ditulis inline di tiap widget.
- [x] `DashboardActivityList` — buat dari `ListPanel` (PersuratanWidget) dan `AntreanPersuratanCard` (DashboardContent). Saat ini ada 2 pola berbeda.
- [x] `QuickActionButton` — buat versi reusable. Saat ini ada `QuickAction` (PersuratanWidget) dan `QuickActionsCard` (RingkasanTab) dengan pola berbeda.
- [x] `ModuleTabContent` — buat wrapper konsisten per tab agar pola layout (KPI → insight → aktivitas → quick action) seragam.
- [x] `DashboardInsightCard` — buat baru untuk panel insight/prioritas.

Komponen ini dibuat agar tab lain mudah mengikuti pola yang sama.

### Tahap 6: Revamp Data List dan Empty State

Setelah dashboard utama rapi, lanjut ke tampilan daftar.

Yang diperbaiki:

- [x] List project.
- [x] List surat.
- [x] List ujian.
- [x] List sertifikat.
- [x] Aktivitas terbaru.
- [x] Empty state tiap modul.
  - [x] Empty state project detail: activity, notes, files, comments, invoice/kuitansi, brevet, milestone, task, speaker, budget, expense, timesheet, member.
  - [x] Empty state table global via `DataTable` untuk manager berbasis tabel.
  - [x] Empty state list ujian dan batch sertifikat.
  - [x] Empty state sertifikat lanjutan: kegiatan, peserta, pencarian global peserta, template, penandatangan, sampah, dan laporan tahunan.
  - [x] Empty state keuangan: dashboard prioritas, antrian honorarium, laporan honorarium, potongan, audit trail, dan bukti pembayaran batch.
  - [x] Empty state jadwal otomatis/pelatihan utama: laporan honorarium, detail batch, detail instruktur, detail jadwal, master data, kontak keuangan, WhatsApp, peserta/nilai, absensi, rekap, dan tanggal eksklusi.
  - [x] Empty state pengumuman: inbox, pembaca, lampiran form, dan list kelola berbasis `DataTable`.
  - [x] Empty state pegawai/pengaturan utama: direktori pegawai, keluarga, pendidikan, pekerjaan, manajemen user, undangan, konfigurasi DingTalk, dan mapping pegawai.
  - [x] Empty state cuti, absensi, kalender, dan audit log: daftar cuti, approval cuti, absensi bulanan, calendar event, dan filter audit log.
  - [x] Empty state modul lain di luar project sudah diaudit; surface utama memakai `EmptyState`, `EmptyText`, atau empty state global `DataTable`. Sisa teks inline kecil diperlakukan sebagai microcopy lokal, bukan empty state utama.
- [x] `StatCard` di StatsCharts (Analitik Persuratan) — migrasi ke `MetricCard` atau buat versi yang konsisten.

### Tahap 7: Polish Interaction

Tambahkan interaksi ringan:

- [x] Hover state — pastikan konsisten di seluruh list row dan card.
  - [x] Project list row sudah punya hover state halus.
  - [x] Project detail list rows/cards di task, milestone, timesheet, member, file, dan kanban sudah punya hover/border state lebih halus.
  - [x] `DataTable`, `UjianTable`, dan `BatchTable` punya row hover/border yang lebih halus.
  - [x] List/card sertifikat lanjutan punya hover/border state lebih halus pada kegiatan, peserta global, template, penandatangan, sampah, dan laporan tahunan.
  - [x] List/card keuangan punya hover/border state lebih halus pada dashboard prioritas, antrian, kanban, laporan, dan detail batch.
  - [x] List/card jadwal otomatis/pelatihan utama punya hover/border state lebih halus pada honorarium, detail instruktur, detail jadwal, master data, kontak keuangan, WhatsApp, peserta/nilai, absensi, dan rekap.
  - [x] List/card pengumuman dan pegawai/pengaturan utama punya hover/border state lebih halus pada inbox, lampiran, pembaca, direktori pegawai, tab riwayat, manajemen user, undangan, dan mapping DingTalk.
  - [x] List/card cuti, absensi, kalender, dan audit log punya hover/border state lebih halus pada table row, calendar day/event card, dan audit rows.
  - [x] `TableRow` base global memakai `border-border/60`, `hover:bg-muted/30`, dan selected state token sehingga table berbasis UI global ikut konsisten.
- [x] Active state — pastikan pressed state terlihat pada button dan link utama.
  - [x] Project detail tabs sudah mengikuti active state dashboard yang lebih jelas.
  - [x] `Button` base global punya pressed state `active:scale-[0.98]` dengan disabled override, sehingga button utama punya feedback tekan yang konsisten.
- [x] Loading skeleton — sudah ada base `Skeleton` dan dashboard skeleton. Pastikan skeleton ada di **setiap halaman modul** yang belum memilikinya.
  - [x] `RouteLoadingSkeleton` reusable ditambahkan untuk pola module loading berbasis table, cards, dan detail.
  - [x] Batch route loading ditambahkan untuk project list/detail, sertifikat, keuangan, jadwal ujian, jadwal otomatis, pegawai, pengumuman, dan surat masuk.
  - [x] Batch route loading top-level lanjutan ditambahkan untuk absensi, audit log, cuti, disposisi, divisi, kalender, nomor surat, pejabat, pengaturan, surat keluar, surat keputusan, dan surat MOU.
  - [x] Batch route loading subroute/detail ditambahkan untuk seluruh halaman sertifikat, keuangan honorarium/laporan, jadwal otomatis, dan jadwal ujian.
- [x] Toast feedback — `sonner` sudah terinstall dan dipakai di 96+ file. Fokus ke **konsistensi penggunaan**, bukan implementasi dari nol.
  - [x] Audit awal toast dilakukan: `Toaster` global sudah ada di `src/app/layout.tsx`, tetapi pemakaian `toast.success/error/info/warning` masih tersebar langsung di banyak komponen.
  - [x] Standar wording sukses/gagal, deskripsi error, dan action feedback sudah didokumentasikan sebagai guideline. Migrasi toast dilakukan bertahap saat file terkait disentuh, bukan mass replace.
- [x] Smooth tab transition — `framer-motion` sudah terinstall (`^12.38.0`) dan sudah dipakai di `MetricCard`. Implementasi transisi tab langsung, bukan "bila sudah ada".

Animasi dipakai seperlunya agar aplikasi terasa responsif, bukan ramai.

### Tahap 8: Verifikasi

Verifikasi akhir:

- [x] TypeScript compile.
- [x] Production build (`npm run build`) berhasil tanpa dependency network Google Fonts.
- [x] Font utama (`Inter`, `Outfit`) sudah self-hosted via `next/font/local`, sehingga build tidak lagi bergantung ke Google Fonts.
- [ ] Tidak ada layout pecah.
- [ ] Tampilan desktop aman.
- [ ] Tampilan mobile/tablet aman.
- [ ] Tidak ada teks saling tabrak.
- [x] Sidebar tetap sesuai kondisi yang disukai.
- [x] Dark mode tampil benar di seluruh halaman dashboard.
- [x] Tidak ada hardcoded warna (`bg-white`, `text-slate-900`) di komponen yang seharusnya pakai token.
- [x] Semua tab dashboard punya pola layout yang konsisten (KPI → insight → aktivitas → quick action).
- [x] `UjianDashboardWidget` sudah memakai `MetricCard` (tidak lagi `Card` base).
- [x] `Input` component sudah memakai design tokens.

---

## 7. Urutan Prioritas

Urutan kerja yang disarankan (disesuaikan setelah kroscek):

1. Dashboard main area.
2. Tab Ujian — **paling kosong**, dampak perbaikan paling besar.
3. Tab Ringkasan — sudah paling lengkap, cukup polish.
4. Tab Analitik Persuratan — `StatCard` dan `Card` chart perlu diseragamkan.
5. Global card/list/badge style — termasuk migrasi border dan dark mode.
6. Empty state.
7. Form/dialog polish.
8. Halaman detail yang kompleks seperti Project Detail.

---

## 8. Hasil Yang Diharapkan

Setelah revamp, ARKA harus terasa:

- Lebih modern.
- Lebih mudah dipahami.
- Lebih cepat digunakan.
- Lebih profesional.
- Lebih kuat sebagai aplikasi operasional.
- Tidak kosong meski data sedikit.
- Tidak ramai meski data banyak.
- Konsisten secara visual antar tab dan antar modul.
- Mendukung dark mode dengan baik.

Tujuan akhirnya: pengguna membuka ARKA dan langsung merasa bahwa aplikasi ini rapi, matang, dan bisa diandalkan untuk pekerjaan harian.

---

## 9. Catatan Eksekusi 13 Mei 2026

Implementasi yang sudah dilakukan pada putaran ini:

- `UjianDashboardWidget` dimigrasikan dari `Card` base ke `MetricCard`.
- Tab Ujian ditambah pola konten lengkap: KPI, insight prioritas, ringkasan jadwal terdekat, aksi cepat, dan empty state fungsional.
- Komponen reusable dashboard ditambahkan:
  - `DashboardEmptyState`
  - `DashboardInsightCard`
  - `QuickActionButton`
  - `ModuleTabContent`
- `MetricCard` sudah memakai design tokens (`bg-card`, `text-foreground`, `border-border/60`) dan dark mode variants.
- `Input` component sudah memakai design tokens (`border-input`, `bg-background`, `text-foreground`).
- `Card` base dilunakkan dari `border` default menjadi `border-border/60`.
- Ringkasan dashboard dipolish agar `AntreanPersuratanCard` dan `QuickActionsCard` tidak memakai hardcoded surface utama seperti `bg-white` dan `text-slate-900`.
- Tab Analitik Persuratan: summary cards diseragamkan ke pola `MetricCard`.
- Border widget Persuratan, Kepegawaian, Keuangan, Sertifikat, dan LazyStatsCharts dilunakkan ke `border-border/60`.
- Dashboard tab navigation dipolish dengan active state yang lebih jelas, horizontal scroll, dan transisi `framer-motion`.
- Token dark mode ditambahkan di `globals.css`.

Verifikasi:

- `npm run typecheck` berhasil.
- `npm run lint` berhasil.

### Catatan Eksekusi Lanjutan 13 Mei 2026

Implementasi lanjutan setelah kroscek pindah laptop:

- Tahap 6 dimulai dari modul project.
- `EmptyText` di `src/components/projects/shared-ui.tsx` dipoles menjadi empty state reusable dengan icon, title, deskripsi, action, token surface, dan border halus.
- Project list (`ProjectManager`) dipoles:
  - filter container dan table wrapper memakai `border-border/60`;
  - row tabel punya hover state halus;
  - empty state project list memakai pola reusable dan aksi `New Project`;
  - status badge project ditambah dark mode variants.
- Project detail (`ProjectDetail`) dipoles:
  - header memakai border halus;
  - tab utama dan tab admin mengikuti pola line tabs dashboard dengan horizontal scroll dan active state yang lebih jelas.
- Activity log project memakai empty state reusable yang lebih informatif.
- Notes project memakai empty state reusable dengan aksi tambah catatan saat user punya permission.
- Scope project detail diperluas:
  - `FileSection`, `CommentSection`, `InvoiceKuitansiSection`, dan `BrevetInfoCard` memakai empty state reusable.
  - `MilestoneSection`, `TaskSection`, `SpeakerPanel`, `FinancePanel`, `TimesheetPanel`, dan `MemberSection` memakai empty state reusable dengan action relevan jika user punya permission.
  - Border dan hover state list/card project dilunakkan ke `border-border/60`, `bg-muted/30`, dan token dark mode pada badge yang disentuh.
  - Kanban board/card dipoles dengan border lebih halus, hover shadow, dan dark variants pada warna kolom/status.
- Scope list di luar project dimulai:
  - `EmptyState` global ditambahkan di `src/components/ui/empty-state.tsx`.
  - `DataTable` memakai empty state global, wrapper `border-border/60`, shadow ringan, dan hover row halus. Ini otomatis memperbaiki list berbasis DataTable seperti surat masuk/keluar, disposisi, materi/pengawas/kelas ujian, dan manager serupa.
  - `UjianTable` memakai empty state global dengan action `Tambah Ujian`, border halus, dan hover row.
  - `BatchTable` sertifikat memakai empty state global dengan action `Generate Batch`, border halus, hover row, dan dark variants untuk status badge.
- Scope sertifikat lanjutan:
  - `TemplateManager` memakai empty state global dengan action `Tambah Template`, border halus, dan hover card.
  - `SignatoryManager` memakai empty state global dengan action `Tambah Penandatangan` dan hover row.
  - `TrashManager` memakai empty state global untuk tab kegiatan dan peserta, plus border/hover row halus.
  - `EventManager` memakai empty state global untuk list kegiatan dan pilihan penandatangan, border halus, hover card/row, dan action `Tambah Kegiatan`.
  - `ParticipantManager`, `GlobalParticipantSearch`, dan `YearlyReportView` memakai empty state global dan dark variants pada status/summary yang disentuh.
  - `ParticipantRevisionsTimeline` memakai empty state global, timeline border lebih halus, dan dark variant pada tone status.
  - `TemplateEditor` dipoles pada editor chrome, border, panel properti, dan state field tanpa mengubah kanvas sertifikat.
  - `GenerateBatchForm` dipoles pada card/header, mode segmented control, preview, dan panel form dengan border/token surface yang lebih halus.
- Scope keuangan:
  - Dashboard keuangan prioritas antrian memakai empty state global dan border/hover yang lebih halus.
  - `FinanceBatchList` memakai empty state global untuk table dan kanban kosong, border halus, hover row/card, dan kanban card hover shadow.
  - `FinanceReportView` memakai empty state global untuk rekap instruktur dan detail batch, border halus, dan hover row.
  - Detail batch keuangan (`BatchDeductions`, `BatchAuditTrail`, `BatchPaymentProofs`, `BatchStatusStepper`) memakai empty state global, border halus, hover item, dan dark variant pada status stepper.
- Scope jadwal otomatis/pelatihan:
  - `HonorariumReport` memakai empty state global untuk batch kosong, ringkasan instruktur/program, detail sesi, dan kanban kosong; border table/card dilunakkan dan row/card diberi hover state halus.
  - Detail batch pelatihan (`PelatihanBatchDeductions`, `PelatihanBatchPaymentProofs`) memakai empty state global, border halus, dan hover item.
  - `InstrukturDetail`, `JadwalDetail`, dan `MasterDataTabs` memakai empty state global pada area kosong utama, plus border/hover row/card yang lebih halus.
  - `ProgramFinanceContactsCard`, `WhatsAppClassActions`, `PesertaDanNilaiTab`, `AbsensiPelatihanSection`, `NilaiUjianSection`, `RekapSection`, dan tanggal eksklusi di `KelasOtomatisTable` memakai empty state global atau pola border/hover yang konsisten.
- Scope pengumuman:
  - `AnnouncementManager` memakai empty state global pada inbox kosong, border header/card dilunakkan, dan inbox/lampiran punya hover state lebih halus.
  - `AnnouncementReadersDialog` memakai empty state global untuk loading/kosong dan list pembaca diberi hover/border halus.
  - `AnnouncementForm` memakai empty state global untuk lampiran kosong dan border lampiran/target/status dilunakkan.
- Scope pegawai/pengaturan:
  - `PegawaiManager` memakai empty state global untuk hasil pencarian kosong, border direktori/detail dilunakkan, dan tab/detail card diberi hover/active state lebih jelas.
  - `KeluargaTab`, `PendidikanTab`, dan `PekerjaanTab` memakai empty state global dengan action relevan, plus list row hover/border halus.
  - `ManajemenUserCard` memakai empty state global untuk user/undangan kosong dan row hover halus.
  - `DingtalkConfigCard` memakai empty state global untuk konfigurasi/mapping kosong dan row mapping hover halus.
- Scope cuti, absensi, kalender, dan audit log:
  - `CutiManager` dan `CutiApproval` memakai empty state global untuk table kosong, wrapper table border halus, dan row hover state.
  - `AbsensiCalendar` memakai empty state global untuk absensi kosong, wrapper table border halus, hover row, dan calendar day hover/token border.
  - `CalendarDashboard` dimigrasikan dari hardcoded `bg-white`, `text-slate-*`, dan `border-slate-*` ke design tokens, plus empty state global untuk tanggal/event kosong.
  - `AuditLogManager` memakai empty state global untuk filter kosong, wrapper table border halus, dan row hover state.
- Scope dashboard reusable:
  - `DashboardActivityList` ditambahkan sebagai wrapper reusable untuk pola list aktivitas dengan title, deskripsi, link detail, dan empty state global.
  - `PersuratanWidget` dan `AntreanPersuratanCard` mulai memakai `DashboardActivityList` sehingga pola list aktivitas dashboard tidak lagi duplikatif.
  - `DashboardSection` dipolish ringan dan aksi cepat di `PersuratanWidget` diseragamkan ke `QuickActionButton`.
- Scope loading skeleton:
  - `RouteLoadingSkeleton` ditambahkan di `src/components/ui/route-loading-skeleton.tsx` untuk reusable skeleton halaman modul.
  - Route loading batch pertama ditambahkan untuk `projects`, `projects/[id]`, `sertifikat`, `keuangan`, `jadwal-ujian`, `jadwal-otomatis`, `pegawai`, `pengumuman`, dan `surat-masuk`.
  - Route loading batch kedua ditambahkan untuk `absensi`, `audit-log`, `cuti`, `disposisi`, `divisi`, `kalender`, `nomor-surat`, `pejabat`, `pengaturan`, `surat-keluar`, `surat-keputusan`, dan `surat-mou`.
  - Route loading batch ketiga ditambahkan untuk seluruh subroute sertifikat, keuangan honorarium/laporan, jadwal otomatis, dan jadwal ujian.
- Scope toast feedback:
  - Audit awal menemukan `Toaster` global sudah terpasang.
  - Standar wording toast ditetapkan:
    - Success: `[Objek] berhasil [aksi].`
    - Error dari server: gunakan `result.error` jika sudah user-friendly.
    - Error fallback: `Gagal [aksi] [objek].`
    - Warning: `[Objek] tersimpan, tetapi [efek samping] gagal.`
    - Info: kalimat netral untuk kondisi tanpa aksi, misalnya `Tidak ada data untuk diekspor.` atau `Pilih batch terlebih dahulu.`
  - Verba aksi distandarkan: `dibuat`, `diperbarui`, `disimpan`, `dihapus`, `dikirim`, `diunggah`, `diekspor`, `diimpor`, `disinkronkan`, dan `diduplikat`.
  - Pemakaian masih langsung lewat `toast.success`, `toast.error`, `toast.info`, dan `toast.warning`; migrasi wording dilakukan bertahap saat file terkait disentuh, bukan mass replace.

Verifikasi lanjutan:

- `npm run typecheck` berhasil.
- `npm run lint` berhasil.
- `npm run build` berhasil. Setelah font dipindah ke local `.woff2`, build tidak lagi membutuhkan akses network ke Google Fonts. Build masih menyisakan warning Turbopack terkait tracing `src/app/api/files/[...path]/route.ts`, tetapi tidak menggagalkan build.
- QA visual desktop 14 Mei 2026 menemukan bobot font terasa terlalu tebal pada header/sidebar/table dan status jadwal belum punya pembeda warna yang jelas. Penyesuaian dilakukan pada bobot title navigasi/header/page, table header, tanggal jadwal, serta warna semantik status WA dan status sesi.

Catatan batas scope:

- Sidebar tidak diubah.
- Logic backend, data model, dan behavior bisnis tidak diubah.
- Project Detail sudah mulai disentuh pada putaran lanjutan ini, terbatas pada polish UI/UX list, tabs, border, empty state, hover state, dan dark mode class. Logic backend, data model, dan behavior bisnis tetap tidak diubah.

Titik lanjut saat pindah laptop:

- Lanjut dari Tahap 6 dan 7 untuk memperluas reusable empty state/list/action ke modul lain di luar dashboard dan di luar project.
- Review tampilan langsung di browser untuk desktop, tablet, dan mobile.
- Jika ingin meneruskan scope dashboard dulu, lanjutkan audit minor reusable dashboard lain karena `DashboardSection` dan pola `QuickAction` lama di `PersuratanWidget` sudah dirapikan.
- Jika ingin masuk scope berikutnya, baru lanjut ke form/dialog polish dan halaman detail kompleks seperti Project Detail.

### Audit Sisa Checklist 13 Mei 2026

Hasil audit setelah putaran project, sertifikat, keuangan, dan table global:

- Checklist parent yang masih kosong memang belum layak ditutup, bukan sekadar lupa checklist.
- Tahap 5 tidak lagi menyisakan `DashboardSection`; komponen ini sudah dipolish ringan. `DashboardActivityList` sudah diekstrak sebagai komponen reusable dari pola aktivitas yang sebelumnya tersebar.
- Tahap 6 `Empty state tiap modul` sudah bisa ditutup untuk surface utama. Audit akhir menunjukkan mayoritas modul memakai `EmptyState`, `EmptyText`, atau empty state global `DataTable`; sisa teks inline kecil adalah microcopy lokal/toast/placeholder dan dapat dipoles opportunistic.
  - Jadwal otomatis/pelatihan utama sudah dipoles pada putaran lanjutan ini. Sisa minor masih perlu audit susulan pada form/dialog pendukung dan komponen yang memakai `DataTable` hanya jika perlu polish khusus.
  - Pengumuman dan pegawai/pengaturan utama sudah dipoles pada putaran lanjutan ini. Sisa minor pengaturan masih perlu audit susulan pada kartu info statis/toggle yang bukan empty state utama.
  - Cuti/absensi/kalender/audit log utama sudah dipoles pada putaran lanjutan ini.
  - Sertifikat minor yang sudah disentuh: `ParticipantRevisionsTimeline`, `TemplateEditor`, dan `GenerateBatchForm`. Sisa sertifikat lebih mengarah ke beberapa area detail batch dan form/dialog pendukung.
- Tahap 7 `Hover state` sudah bisa ditutup untuk surface utama: list/card mayoritas modul sudah dipoles dan `TableRow` base global sudah memakai token border/hover. Sisa form/dialog/kartu info statis yang belum tersentuh dapat dipoles opportunistic saat file terkait dibuka.
- Tahap 7 `Active state` sudah bisa ditutup untuk surface utama: tabs dashboard/project sudah jelas dan `Button` base global punya pressed state. Link khusus yang bukan button tetap dipoles opportunistic saat file terkait dibuka.
- Tahap 7 `Loading skeleton` sudah bisa ditutup untuk route dashboard: semua `page.tsx` di dalam `src/app/(dashboard)` sudah memiliki `loading.tsx` pada folder route masing-masing.
- Tahap 7 `Toast feedback` sudah bisa ditutup sebagai standar dokumentasi: audit awal selesai, `Toaster` global sudah ada, dan guideline wording sukses/gagal/warning/info sudah ditetapkan. Migrasi wording existing dilakukan bertahap saat file terkait disentuh.
- Tahap 8 visual QA belum bisa ditutup karena belum ada review langsung via browser untuk desktop, tablet, dan mobile setelah perubahan lanjutan.
- Verifikasi build produksi sudah berhasil, tetapi ini belum menggantikan browser QA visual untuk desktop, tablet, dan mobile.

Prioritas lanjutan yang disarankan:

1. Audit sisa minor pada form/dialog/kartu info statis bila ingin menutup parent empty/hover sepenuhnya.
2. Tambahkan route/module loading skeleton secara bertahap.
3. Standarkan toast feedback setelah surface visual utama selesai.
4. Jalankan browser QA untuk desktop, tablet, dan mobile sebelum checklist Tahap 8 dicentang.

---

## 10. Lampiran: Peta Komponen Dashboard Saat Ini

Berdasarkan kroscek codebase 13 Mei 2026:

| File | Komponen | Border Style | Dark Mode | Catatan |
|---|---|---|---|---|
| `MetricCard.tsx` | `MetricCard` | `border-slate-100` ✅ | ❌ hardcoded `bg-white` | Perlu migrasi ke design tokens |
| `DashboardSection.tsx` | `DashboardSection` | tanpa border | ✅ pakai token | OK |
| `DashboardHeader.tsx` | `DashboardHeader` | tanpa border | ✅ pakai token | OK |
| `DashboardContent.tsx` | `AntreanPersuratanCard` | `border-slate-100` | ❌ hardcoded `bg-white` | Perlu migrasi |
| `DashboardContent.tsx` | `ProfileCard` | tanpa border | ❌ hardcoded gradient | Perlu evaluasi dark mode |
| `DashboardContent.tsx` | `QuickActionsCard` | `border-slate-100` | ❌ hardcoded `bg-white` | Perlu migrasi |
| `PersuratanWidget.tsx` | `ListPanel` | `border-border` (slate-300) | ✅ pakai `bg-card` | Border perlu dilunakkan |
| `PersuratanWidget.tsx` | List items | `border-border` (slate-300) | ✅ pakai token | Border perlu dilunakkan |
| `KepegawaianWidget.tsx` | List items | `border-border` (slate-300) | ✅ pakai token | Border perlu dilunakkan |
| `KeuanganWidget.tsx` | `StatusItem` | `border-border` (slate-300) | ✅ pakai token | Border perlu dilunakkan |
| `SertifikatWidget.tsx` | List items | `border-border` (slate-300) | ✅ pakai token | Border perlu dilunakkan |
| `UjianDashboardWidget.tsx` | Kartu ujian | `border` (slate-300 via Card) | ⚠️ partial `dark:` | Perlu migrasi ke `MetricCard` |
| `StatsCharts.tsx` | `StatCard` | `border` (slate-300 via Card) | ✅ pakai token | Perlu migrasi ke `MetricCard` |
| `StatsCharts.tsx` | Chart cards | `border` (slate-300 via Card) | ✅ pakai token | Border perlu dilunakkan |
| `card.tsx` (UI) | `Card` base | `border` (→ slate-300) | ✅ pakai `bg-card` | Root cause border berat |
| `input.tsx` (UI) | `Input` | `border-slate-200/60` | ❌ hardcoded | Perlu migrasi ke `border-input` |
