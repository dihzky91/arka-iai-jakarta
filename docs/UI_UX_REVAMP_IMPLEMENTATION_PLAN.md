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

- [ ] Dashboard page.
- [ ] Layout aplikasi.
- [ ] Card component.
- [ ] Button component.
- [ ] Badge component.
- [ ] Tabs component.
- [ ] Form/Input component.
- [ ] Halaman project/detail jika terkait.
- [ ] Inkonsistensi `MetricCard` (hardcoded `bg-white`) vs widget lain (memakai `bg-card`).
- [ ] `UjianDashboardWidget` yang belum memakai `MetricCard`.
- [ ] `Input` component yang tidak memakai design tokens.
- [ ] Dark mode support per komponen dashboard.

Output tahap ini:

- [ ] Daftar file yang perlu disentuh.
- [ ] Komponen yang bisa dipakai ulang.
- [ ] Komponen yang perlu dibuat baru.

### Tahap 2: Rapikan Design Tokens

Perbaiki dasar visual tanpa mengubah flow.

Yang dicek:

- [ ] Color palette.
- [ ] Border radius.
- [ ] Shadow.
- [ ] Spacing.
- [ ] Font weight.
- [ ] Background surface.
- [ ] Border style.
- [ ] Standarisasi penggunaan `bg-card` / `text-foreground` menggantikan hardcoded warna (`bg-white`, `text-slate-900`).
- [ ] Audit dark mode readiness seluruh komponen dashboard.
- [ ] Seragamkan `Input` agar memakai `border-input` dan `bg-background` dari token system.
- [ ] Evaluasi apakah `--border` token (saat ini slate-300) perlu dilunakkan ke ~slate-200 agar `Card` base tidak terasa berat.

Target:

- [ ] UI terasa lebih soft, premium, dan konsisten.
- [ ] Tidak ada dominasi border yang terlalu berat (slate-300 di `Card` base dan `border-border`).
- [ ] Semua komponen dashboard mendukung dark mode.

### Tahap 3: Revamp Dashboard Shell

Perbaiki area utama dashboard:

- [ ] Header dashboard.
- [ ] Greeting.
- [ ] Tab navigation.
- [ ] Grid layout.
- [ ] Responsive behavior.
- [ ] Spacing antar section.

Sidebar tetap dipertahankan.

### Tahap 4: Revamp Tab Ujian dan Ringkasan

Mulai dari tab yang terlihat dan paling berdampak.

Prioritas pertama:

- [ ] Tab Ujian — paling kosong saat ini, hanya 4 kartu angka tanpa konten tambahan.
- [ ] Tab Ringkasan — sudah paling lengkap, perlu polish saja.

Perbaikan spesifik Tab Ujian:

- [ ] Migrasi `UjianDashboardWidget` dari `Card` base ke `MetricCard` (konsistensi visual).
- [ ] Tambahkan panel jadwal ujian terdekat.
- [ ] Tambahkan panel pengawas aktif.
- [ ] Tambahkan panel ujian yang butuh perhatian.
- [ ] Tambahkan aksi cepat: buat ujian, atur pengawas, lihat kalender.
- [ ] Tambahkan empty state fungsional saat tidak ada ujian.

Perbaikan spesifik Tab Ringkasan:

- [ ] Pastikan `MetricCard` dan `AntreanPersuratanCard` sudah memakai design tokens (bukan hardcoded warna).
- [ ] Polish spacing dan visual hierarchy.

Alasan:

- Tab Ujian adalah wajah utama yang paling kosong — dampak perbaikan paling terasa.
- Tab Ringkasan sudah cukup baik, bisa jadi pola referensi.
- Kedua tab bisa menjadi template untuk tab lain.

### Tahap 5: Buat Komponen Dashboard Reusable

Komponen yang sudah ada (perlu distandarisasi, bukan dibuat baru):

- [ ] `MetricCard` — sudah ada di `src/components/dashboard/MetricCard.tsx`, perlu hapus hardcoded `bg-white`/`text-slate-900` dan gunakan design tokens.
- [ ] `DashboardSection` — sudah ada di `src/components/dashboard/DashboardSection.tsx`, mungkin perlu polish.

Komponen yang perlu dibuat baru:

- [ ] `DashboardEmptyState` — buat dari pola inline yang sudah ada di `ListPanel` dan widget lain. Saat ini empty state ditulis inline di tiap widget.
- [ ] `DashboardActivityList` — buat dari `ListPanel` (PersuratanWidget) dan `AntreanPersuratanCard` (DashboardContent). Saat ini ada 2 pola berbeda.
- [ ] `QuickActionButton` — buat versi reusable. Saat ini ada `QuickAction` (PersuratanWidget) dan `QuickActionsCard` (RingkasanTab) dengan pola berbeda.
- [ ] `ModuleTabContent` — buat wrapper konsisten per tab agar pola layout (KPI → insight → aktivitas → quick action) seragam.
- [ ] `DashboardInsightCard` — buat baru untuk panel insight/prioritas.

Komponen ini dibuat agar tab lain mudah mengikuti pola yang sama.

### Tahap 6: Revamp Data List dan Empty State

Setelah dashboard utama rapi, lanjut ke tampilan daftar.

Yang diperbaiki:

- [ ] List project.
- [ ] List surat.
- [ ] List ujian.
- [ ] List sertifikat.
- [ ] Aktivitas terbaru.
- [ ] Empty state tiap modul.
- [ ] `StatCard` di StatsCharts (Analitik Persuratan) — migrasi ke `MetricCard` atau buat versi yang konsisten.

### Tahap 7: Polish Interaction

Tambahkan interaksi ringan:

- [ ] Hover state — pastikan konsisten di seluruh list row dan card.
- [ ] Active state — pastikan pressed state terlihat pada button dan link utama.
- [ ] Loading skeleton — sudah ada base `Skeleton` dan dashboard skeleton. Pastikan skeleton ada di **setiap halaman modul** yang belum memilikinya.
- [ ] Toast feedback — `sonner` sudah terinstall dan dipakai di 96+ file. Fokus ke **konsistensi penggunaan**, bukan implementasi dari nol.
- [ ] Smooth tab transition — `framer-motion` sudah terinstall (`^12.38.0`) dan sudah dipakai di `MetricCard`. Implementasi transisi tab langsung, bukan "bila sudah ada".

Animasi dipakai seperlunya agar aplikasi terasa responsif, bukan ramai.

### Tahap 8: Verifikasi

Verifikasi akhir:

- [ ] TypeScript compile.
- [ ] Tidak ada layout pecah.
- [ ] Tampilan desktop aman.
- [ ] Tampilan mobile/tablet aman.
- [ ] Tidak ada teks saling tabrak.
- [ ] Sidebar tetap sesuai kondisi yang disukai.
- [ ] Dark mode tampil benar di seluruh halaman dashboard.
- [ ] Tidak ada hardcoded warna (`bg-white`, `text-slate-900`) di komponen yang seharusnya pakai token.
- [ ] Semua tab dashboard punya pola layout yang konsisten (KPI → insight → aktivitas → quick action).
- [ ] `UjianDashboardWidget` sudah memakai `MetricCard` (tidak lagi `Card` base).
- [ ] `Input` component sudah memakai design tokens.

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

Catatan batas scope:

- Sidebar tidak diubah.
- Logic backend, data model, dan behavior bisnis tidak diubah.
- Project Detail belum disentuh pada putaran ini karena prioritas dokumen saat ini adalah dashboard main area, tab Ujian, token visual, dan konsistensi dashboard.

Titik lanjut saat pindah laptop:

- Lanjut dari Tahap 6 dan 7 untuk memperluas reusable empty state/list/action ke modul lain di luar dashboard.
- Review tampilan langsung di browser untuk desktop, tablet, dan mobile.
- Jika ingin meneruskan scope dashboard dulu, lanjutkan ke `DashboardSection`, `DashboardActivityList`, dan penyamaan pola `QuickAction` lama di `PersuratanWidget`.
- Jika ingin masuk scope berikutnya, baru lanjut ke form/dialog polish dan halaman detail kompleks seperti Project Detail.

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
