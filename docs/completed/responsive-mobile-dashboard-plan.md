# Rencana Responsive Mobile Dashboard

> **Status:** Perencanaan
> **Cakupan:** Shell dashboard, sidebar, header, tabel, form, chart, dan halaman padat data
> **Prioritas:** Tinggi
> **Dibuat:** 2026-04-27
> **Update Terakhir:** 2026-04-27 - eksekusi tahap shell dashboard dimulai

---

## Ringkasan

Tujuan dokumen ini adalah mendokumentasikan rencana implementasi responsive mobile untuk dashboard agar pengalaman penggunaan di layar kecil menjadi lebih efisien, terutama pada area navigasi sidebar, header, tabel data, filter, form, dan chart.

Kondisi saat ini:

- Sidebar masih tampil sebagai blok penuh di atas konten pada mobile.
- Header belum dioptimalkan untuk tombol navigasi mobile.
- Beberapa halaman padat data masih berorientasi desktop.
- Tabel shared belum memiliki strategi mobile yang konsisten.

Target hasil:

- Sidebar mobile berubah menjadi drawer atau sheet.
- Header mobile lebih ringkas dan tetap fungsional.
- Konten utama tetap nyaman dipakai di lebar layar kecil.
- Tidak ada overflow horizontal yang tidak disengaja.
- Pola responsive terdokumentasi dan bisa dipakai ulang di modul lain.

---

## Referensi Komponen Saat Ini

File utama yang menjadi acuan implementasi:

- `src/app/(dashboard)/layout.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/Header.tsx`
- `src/components/layout/PageWrapper.tsx`
- `src/components/ui/data-table.tsx`
- `src/components/surat-masuk/SuratMasukDetailWorkspace.tsx`
- `src/components/jadwal-ujian/UjianTable.tsx`
- `src/components/surat-keluar/SuratKeluarManager.tsx`
- `src/components/dashboard/StatsCharts.tsx`
- `src/styles/globals.css`

---

## Sasaran UX Mobile

### 1. Navigasi lebih efisien

- Pengguna dapat membuka dan menutup navigasi dari header.
- Sidebar tidak lagi memakan ruang vertikal utama pada mobile.
- Pergantian halaman terasa cepat dan tidak membingungkan.

### 2. Konten tetap terbaca

- Judul halaman, tombol aksi, filter, dan status tetap mudah dilihat.
- Form dan workspace detail tetap nyaman disentuh.
- Chart dan tabel tetap usable tanpa merusak layout.

### 3. Pola komponen konsisten

- Semua halaman dashboard mengikuti aturan responsive yang sama.
- Shared component bisa dipakai ulang tanpa styling per halaman yang berlebihan.

---

## Tahapan Implementasi

## Fase 1 - Foundation Responsive

**Tujuan:** menyiapkan fondasi layout dan spacing agar shell dashboard mobile-first.

### Ruang Lingkup

- Audit breakpoint yang dipakai di dashboard.
- Rapikan padding halaman utama untuk mobile.
- Tetapkan pola responsive untuk container, card spacing, dan section gap.
- Tambahkan utility atau pola class yang dibutuhkan di level global jika memang perlu.

### File Fokus

- `src/app/(dashboard)/layout.tsx`
- `src/styles/globals.css`
- `src/components/layout/PageWrapper.tsx`

### Checklist Fase 1

- [ ] Audit breakpoint utama pada dashboard
- [ ] Identifikasi area dengan padding terlalu besar di mobile
- [ ] Rapikan spacing global untuk shell dashboard
- [ ] Standarkan pola stack mobile untuk header section dan action area
- [ ] Dokumentasikan aturan responsive dasar yang akan dipakai ulang

---

## Fase 2 - Sidebar dan Header Mobile

**Tujuan:** mengubah shell navigasi menjadi lebih optimal untuk layar kecil.

### Ruang Lingkup

- Ubah sidebar dari blok statis mobile menjadi drawer atau sheet.
- Tambahkan tombol hamburger pada header.
- Pastikan sidebar tetap sticky dan expanded pada desktop.
- Tambahkan overlay dan perilaku auto-close saat navigasi berpindah.
- Pastikan badge, active state, dan role-based item tetap bekerja.

### File Fokus

- `src/components/layout/Sidebar.tsx`
- `src/components/layout/Header.tsx`
- `src/app/(dashboard)/layout.tsx`
- `src/components/layout/navigation.ts`

### Checklist Fase 2

- [ ] Tambah trigger hamburger di header mobile
- [ ] Refactor sidebar menjadi drawer untuk mobile
- [ ] Pertahankan mode desktop sidebar di breakpoint besar
- [ ] Tambah overlay dan close interaction yang jelas
- [ ] Auto-close drawer saat route berubah
- [ ] Verifikasi unread badge dan active menu tetap benar
- [ ] Verifikasi menu tetap sesuai RBAC

---

## Fase 3 - Shared Components Responsive

**Tujuan:** memperkuat komponen umum agar halaman lain ikut membaik tanpa banyak duplikasi.

### Ruang Lingkup

- Perbarui `PageWrapper` agar title, description, dan action lebih rapi di mobile.
- Tingkatkan `DataTable` agar aman untuk layar sempit.
- Siapkan pola tombol aksi yang bisa wrap dengan baik.
- Audit elemen form, card, dan dialog trigger yang sering dipakai lintas halaman.

### File Fokus

- `src/components/layout/PageWrapper.tsx`
- `src/components/ui/data-table.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/button.tsx`

### Checklist Fase 3

- [ ] `PageWrapper` mendukung stack vertikal di mobile
- [ ] Action area bisa wrap atau full-width dengan rapi
- [ ] `DataTable` dibungkus `overflow-x-auto`
- [ ] Tetapkan `min-width` tabel bila diperlukan
- [ ] Pastikan pagination dan search tetap nyaman di mobile
- [ ] Audit shared card spacing untuk layar kecil
- [ ] Audit pola button group pada card header

---

## Fase 4 - Halaman Prioritas Tinggi

**Tujuan:** menerapkan optimasi ke halaman yang paling sering dipakai dan paling padat konten.

### Ruang Lingkup

Prioritas halaman:

- Dashboard
- Surat Masuk
- Surat Keluar
- Jadwal Ujian
- Pengaturan

Jenis penyesuaian:

- Filter bar diubah menjadi stack vertikal saat mobile.
- Toolbar aksi dibuat wrap dan tetap mudah disentuh.
- Workspace 2 kolom diturunkan menjadi 1 kolom pada mobile.
- Tabel padat diberi fallback horizontal scroll atau card presentation bila perlu.

### File Fokus

- `src/components/dashboard/StatsCharts.tsx`
- `src/components/surat-masuk/SuratMasukDetailWorkspace.tsx`
- `src/components/surat-keluar/SuratKeluarManager.tsx`
- `src/components/jadwal-ujian/UjianTable.tsx`
- halaman dashboard terkait lainnya

### Checklist Fase 4

- [ ] Dashboard summary dan chart tetap nyaman di mobile
- [ ] Workspace detail surat masuk rapi di 1 kolom mobile
- [ ] Toolbar surat keluar wrap tanpa tabrakan layout
- [ ] Filter jadwal ujian stack dengan baik di mobile
- [ ] Tabel prioritas tinggi aman dari overflow yang merusak
- [ ] CTA utama tetap terlihat pada setiap halaman prioritas

---

## Fase 5 - Chart, Tabel, dan Data Density Review

**Tujuan:** menyelesaikan area yang paling rawan rusak di layar kecil.

### Ruang Lingkup

- Sesuaikan tinggi chart di mobile.
- Sederhanakan legend atau posisi label chart.
- Tinjau kembali kolom tabel yang terlalu padat.
- Putuskan kapan memakai horizontal scroll dan kapan memakai card list mobile.

### Fokus Teknis

- Recharts container height
- Label truncation
- Table min width
- Optional mobile variant untuk data table tertentu

### Checklist Fase 5

- [ ] Tinggi chart mobile disesuaikan
- [ ] Legend chart tidak menabrak area visual
- [ ] Label sumbu tidak pecah berlebihan
- [ ] Tabel dengan kolom banyak punya fallback yang jelas
- [ ] Halaman dengan data density tinggi diuji ulang satu per satu

---

## Fase 6 - QA Responsive dan Regression Check

**Tujuan:** memastikan hasil implementasi stabil dan tidak merusak alur existing.

### Breakpoint Uji Minimum

- `360px`
- `390px`
- `768px`
- `1024px`

### Skenario Pengujian

- Buka dan tutup sidebar mobile.
- Navigasi antar halaman melalui drawer.
- Gunakan search, notifikasi, dan logout di mobile.
- Uji halaman dengan tabel besar.
- Uji dialog, dropdown, dan select di layar kecil.
- Uji halaman detail dengan banyak card dan action button.

### Checklist Fase 6

- [ ] Sidebar mobile berfungsi stabil
- [ ] Tidak ada overflow horizontal yang tidak disengaja
- [ ] Header mobile tetap usable
- [ ] Search, notification, dan logout tetap bisa dipakai
- [ ] Dialog dan dropdown tidak keluar viewport
- [ ] Tabel tetap bisa dipakai pada layar kecil
- [ ] Chart tetap terbaca di mobile
- [ ] Tidak ada regresi di desktop layout

---

## Acceptance Criteria

- Sidebar mobile tampil sebagai drawer atau sheet, bukan blok penuh di atas konten.
- Header memiliki trigger navigasi mobile yang jelas.
- Shell dashboard nyaman dipakai pada layar kecil tanpa kehilangan fitur penting.
- Shared table dan page wrapper memiliki perilaku responsive yang konsisten.
- Halaman prioritas tinggi tidak mengalami layout break pada breakpoint utama.

---

## Checklist Progress

Gunakan tanda `[x]` untuk item yang sudah selesai.

### Fase 1 - Foundation Responsive

- [x] Audit breakpoint utama pada dashboard
- [x] Rapikan spacing global untuk shell dashboard
- [x] Standarkan pola stack mobile untuk section header
- [ ] Dokumentasikan aturan responsive dasar

### Fase 2 - Sidebar dan Header Mobile

- [x] Tambah hamburger trigger
- [x] Refactor sidebar mobile menjadi drawer
- [x] Pertahankan sidebar desktop
- [x] Tambah overlay dan auto-close saat route berubah
- [x] Verifikasi active state, badge, dan RBAC

### Fase 3 - Shared Components Responsive

- [x] Update `PageWrapper`
- [x] Update `DataTable`
- [ ] Audit shared card spacing
- [x] Audit button group dan pagination mobile

### Fase 4 - Halaman Prioritas Tinggi

- [x] Dashboard
- [x] Surat Masuk
- [x] Surat Keluar
- [x] Jadwal Ujian
- [x] Pengaturan

### Fase 5 - Chart, Tabel, dan Data Density Review

- [ ] Chart mobile tuning
- [ ] Legend dan axis cleanup
- [ ] Tabel padat diberi fallback
- [ ] Review halaman high-density

### Fase 6 - QA Responsive dan Regression Check

- [ ] Uji `360px`
- [ ] Uji `390px`
- [ ] Uji `768px`
- [ ] Uji `1024px`
- [ ] Verifikasi mobile flow end-to-end
- [ ] Verifikasi desktop tidak regress

---

## Catatan Implementasi

- Implementasi sebaiknya dimulai dari shell dashboard terlebih dahulu sebelum masuk ke halaman individual.
- Untuk tabel yang sangat padat, tidak semua kasus harus dipaksa menjadi full table di mobile; beberapa bisa memakai pendekatan card list atau detail drawer.
- Dokumentasi ini bisa diperbarui selama pengerjaan berlangsung dengan menandai checklist progres dan menambahkan keputusan teknis penting.
- Eksekusi awal sudah mencakup `DashboardShell` client wrapper, sidebar mobile drawer, header mobile dengan hamburger trigger, perapihan `PageWrapper`, dan penguatan `DataTable` untuk layar sempit.
- Dashboard sudah dioptimasi untuk mobile pada area metric cards, widget ujian, summary cards, chart, work queue, quick action, dan recent activity list.
- Surat Masuk sudah dioptimasi pada summary cards, toolbar manager, dialog detail, workspace 2 kolom, timeline disposisi, dan tombol aksi utama.
- Surat Keluar sudah dioptimasi pada toolbar manager, dialog bulk action, stepper detail, panel aksi workflow, preview QR, dan tombol-tombol pengarsipan di mobile.
- Jadwal Ujian sudah dioptimasi pada toolbar utama, area filter, manager master data, dan dialog aksi agar lebih nyaman di layar kecil.
- Pengaturan sudah dioptimasi pada tabs mobile, card settings, area upload/avatar, toggle preferensi, summary system cards, dan tombol aksi form.
