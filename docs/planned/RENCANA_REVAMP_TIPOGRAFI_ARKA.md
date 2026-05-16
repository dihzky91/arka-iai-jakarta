# Rencana Revamp Tipografi ARKA

Dokumen ini menjadi acuan untuk merapikan tipografi ARKA secara bertahap. Fokus utamanya adalah mengurangi kesan "semua teks bold", memperjelas hierarki informasi, dan menjaga tampilan tetap nyaman untuk aplikasi operasional yang banyak berisi tabel, formulir, dashboard, dan daftar data.

---

## 1. Latar Belakang

Kondisi saat ini menunjukkan tipografi ARKA terasa terlalu berat secara global. Dari audit awal, penyebabnya bukan hanya satu komponen, tetapi kombinasi dari:

- Override global untuk kelas Tailwind `font-medium`, `font-semibold`, `font-bold`, dan `font-extrabold` di `src/styles/globals.css`.
- Penggunaan `font-medium` dan `font-semibold` yang sangat luas di komponen UI, layout, dashboard, tabel, badge, dan modul-modul fitur.
- Komponen shared seperti `Button`, `Badge`, `CardTitle`, `Label`, `Tabs`, dan `Table` memakai bobot medium sebagai default.
- Banyak nilai statistik, label, nama data, dan judul kecil memakai bobot yang sama, sehingga hierarki visual menjadi datar.

Audit singkat pemakaian kelas font di `src`:

| Kelas | Jumlah Pemakaian |
| --- | ---: |
| `font-medium` | 433 |
| `font-semibold` | 194 |
| `font-bold` | 56 |
| `font-normal` | 30 |
| `font-extrabold` | 3 |

---

## 2. Tujuan

- Membuat teks utama lebih ringan dan mudah dibaca.
- Menjaga judul, angka penting, dan status tetap punya penekanan yang jelas.
- Mengurangi ketergantungan pada override global `!important`.
- Membuat sistem tipografi konsisten di seluruh aplikasi.
- Menghindari perubahan besar yang berisiko merusak layout modul.

---

## 3. Prinsip Desain Tipografi

### 3.1 Hirarki Bobot

Usulan standar bobot:

| Peran Teks | Bobot Disarankan | Catatan |
| --- | ---: | --- |
| Body text | 400 | Default untuk paragraf, deskripsi, isi tabel, isi form |
| Secondary text | 400 | Dibantu warna `muted-foreground`, bukan bobot lebih berat |
| Label form | 400-450 | Tidak perlu selalu medium |
| Button text | 450-500 | Tetap jelas, tapi tidak terlalu tebal |
| Table header | 450-500 | Cukup untuk membedakan dari isi tabel |
| Card title kecil | 450-500 | Tergantung ukuran dan konteks |
| Page title | 500-550 | Tetap dominan tanpa terasa berat |
| Metric/stat number | 550-600 | Boleh lebih kuat karena menjadi fokus visual |
| Badge/status | 450-500 | Warna dan background status harus ikut membawa penekanan |
| Critical emphasis | 600 | Hanya untuk angka/aksi/status yang memang penting |

### 3.2 Penekanan Tidak Selalu Dengan Bold

Penekanan bisa memakai:

- Ukuran teks.
- Warna foreground atau muted.
- Spacing.
- Kontras background.
- Ikon/status badge.
- Posisi dan layout.

Bold dipakai seperlunya, bukan menjadi default.

### 3.3 Sistem Font

Font yang sudah dipakai:

- `Inter` untuk UI/body.
- `Outfit` untuk heading, branding, dan beberapa display text.

Rekomendasi:

- Tetap gunakan `Inter` sebagai font utama aplikasi.
- Gunakan `Outfit` hanya untuk brand, heading tertentu, dan angka statistik besar jika benar-benar membantu karakter visual.
- Hindari campuran font yang terlalu sering dalam satu komponen.

---

## 4. Area Yang Perlu Dirapikan

### 4.1 Global CSS

File utama:

- `src/styles/globals.css`

Catatan audit:

- File font lama `inter-latin-variable.woff2` dan `outfit-latin-variable.woff2` ternyata static Black (`usWeightClass: 900`), bukan variable font.
- `body` dan heading global terlihat terlalu berat karena semua weight dirender dari sumber font Black.
- Ada override global lama untuk `.font-bold`, `.font-extrabold`, `.font-semibold`, dan `.font-medium` dengan `!important`.

Rencana:

- Evaluasi ulang kebutuhan override global.
- Hindari `!important` untuk kelas utility Tailwind jika tidak benar-benar diperlukan.
- Buat token tipografi atau class utilitas yang lebih semantik bila dibutuhkan, misalnya `text-ui-label`, `text-ui-title`, atau cukup lewat pola komponen shared.

### 4.2 Komponen UI Shared

File prioritas:

- `src/components/ui/button.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/table.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/alert-dialog.tsx`

Rencana:

- Turunkan default bobot teks pada komponen dasar yang muncul di banyak tempat.
- Pastikan perubahan tidak membuat tombol, tab aktif, badge status, dan header tabel kehilangan keterbacaan.
- Gunakan warna, background, border, dan state aktif sebagai pembeda visual, bukan hanya font-weight.

### 4.3 Layout Utama

File prioritas:

- `src/components/layout/Sidebar.tsx`
- `src/components/layout/Header.tsx`
- `src/components/layout/PageWrapper.tsx`

Rencana:

- Sidebar: bedakan item aktif dengan warna/background, bukan bobot berat.
- Header: judul halaman cukup medium-light, nama user tidak perlu terlalu dominan.
- Page title: tetap jelas, tetapi tidak perlu terasa bold.

### 4.4 Dashboard dan Statistik

File prioritas:

- `src/components/dashboard/MetricCard.tsx`
- `src/components/dashboard/DashboardHeader.tsx`
- `src/components/dashboard/QuickActionButton.tsx`
- Widget dashboard lainnya.

Rencana:

- Angka statistik tetap menjadi elemen paling kuat.
- Label metric dibuat lebih ringan, mengandalkan uppercase, tracking, dan warna muted.
- Hindari semua teks dalam card statistik terasa sama-sama penting.

### 4.5 Modul Data Berat

Modul prioritas setelah shared components stabil:

- Jadwal otomatis.
- Surat masuk/keluar/MOU/SK.
- Keuangan.
- Sertifikat.
- Pegawai.
- Penilaian kinerja.

Rencana:

- Fokus pada tabel, list item, dialog konfirmasi, form, dan detail view.
- Nama entitas boleh medium, metadata harus normal/muted.
- Nomor dokumen atau kode boleh memakai mono dan medium, tapi jangan semua teks di sekitarnya ikut berat.

---

## 5. Tahapan Implementasi

### Tahap 1: Baseline dan Global Cleanup

- [x] Catat kondisi visual sebelum perubahan pada dashboard, sidebar, tabel, form, dan detail page.
- [x] Review ulang override `.font-*` di `globals.css`.
- [x] Tentukan apakah override global tetap dipertahankan, disederhanakan, atau dihapus bertahap.
- [x] Pastikan body text dan heading global punya default yang stabil.

Output:

- Tipografi global lebih netral.
- Tidak ada perubahan visual ekstrem pada satu tahap.

Catatan eksekusi:

- Override selector `.font-medium`, `.font-semibold`, `.font-bold`, dan `.font-extrabold` dengan `!important` dihapus dari `globals.css`.
- Audit metadata font menemukan akar masalah utama: file `inter-latin-variable.woff2` dan `outfit-latin-variable.woff2` berisi static Black weight (`usWeightClass: 900`) dan tidak memiliki table `fvar`.
- Font aktif diganti ke static Google Fonts yang benar:
  - Inter: `400`, `500`, `600`, `700`
  - Outfit: `400`, `500`, `600`, `700`
- Bobot font global sekarang kembali memakai token standar:
  - `normal`: 400
  - `medium`: 500
  - `semibold`: 600
  - `bold`: 700
  - `extrabold`: 700
- `body` memakai `var(--font-weight-normal)`.
- Heading global memakai `var(--font-weight-semibold)`.
- Heading pada editor pengumuman memakai token `var(--font-weight-bold)` agar konsisten dengan baseline baru.
- Cache `.next` perlu dibersihkan setelah penggantian sumber font agar Next tidak memakai build artefact lama.

### Tahap 2: Shared Components

- [x] Rapikan bobot default `Button`.
- [x] Rapikan bobot default `Badge`.
- [x] Rapikan `CardTitle` dan `CardDescription`.
- [x] Rapikan `Label`.
- [x] Rapikan `TableHead`, `TableCell`, dan table wrapper.
- [x] Rapikan `TabsTrigger`.
- [x] Rapikan title dialog dan alert dialog.

Output:

- Perubahan terasa menyeluruh karena komponen dasar dipakai lintas modul.
- UI mulai lebih ringan tanpa perlu edit ratusan file.

Catatan eksekusi:

- `Button` dan `Badge` tetap memakai `font-medium` karena token Tahap 1 sudah menurunkannya ke bobot 450; ini menjaga aksi dan status tetap terbaca.
- `CardTitle` memakai `font-medium`, sementara `CardDescription` tetap normal dengan warna muted.
- `Label` diturunkan dari `font-medium` ke `font-normal` agar form tidak terasa berat.
- `TableFooter` diturunkan ke `font-normal`; `TableHead` tetap `font-medium` agar header tabel masih mudah dipindai.
- `TabsTrigger` memakai `font-normal` secara default dan naik ke `font-medium` hanya saat aktif.
- `DialogTitle` dan `AlertDialogTitle` diturunkan dari `font-semibold` ke `font-medium`.

### Tahap 3: Layout Shell

- [x] Rapikan tipografi sidebar desktop.
- [x] Rapikan tipografi sidebar mobile.
- [x] Rapikan header topbar.
- [x] Rapikan `PageWrapper`.
- [x] Pastikan state aktif navigasi masih jelas.

Output:

- Area navigasi terasa lebih tenang.
- Judul halaman dan menu punya hierarki yang lebih baik.

Catatan eksekusi:

- Sidebar desktop: item nonaktif/pasif memakai `font-normal`, item aktif tetap `font-medium` dengan background dan warna primary sebagai penanda utama.
- Sidebar desktop: avatar role dan label role diturunkan dari `font-semibold` ke `font-medium`.
- Sidebar mobile: nama aplikasi dan heading section diturunkan dari `font-semibold` ke `font-medium`.
- Sidebar mobile: item menu default memakai `font-normal`; item aktif naik ke `font-medium` dengan background primary ringan.
- Header topbar: nama pengguna diturunkan dari `font-medium` ke `font-normal`; judul halaman tetap `font-medium` ringan.
- `PageWrapper`: judul halaman tetap `font-medium` dengan `tracking-tight`; deskripsi diberi `leading-6` agar lebih nyaman dibaca.

### Tahap 4: Dashboard

- [x] Rapikan `MetricCard`.
- [x] Rapikan quick actions.
- [x] Rapikan dashboard widgets.
- [x] Pastikan angka utama tetap kuat.
- [x] Pastikan label dan hint tidak bersaing dengan angka utama.

Output:

- Dashboard lebih mudah dipindai.
- Stat utama tetap menonjol tanpa membuat semua teks terlihat bold.

Catatan eksekusi:

- `MetricCard`: label dan hint diturunkan ke `font-normal`; delta badge ke `font-medium`; angka utama tetap `font-semibold`.
- `QuickActionButton`: label aksi turun dari `font-semibold` ke `font-medium`.
- `DashboardHeader`, `DashboardActivityList`, `DashboardSection`, `ModuleTabContent`, `DashboardInsightCard`, dan `DashboardEmptyState`: judul kecil turun ke `font-medium`.
- Widget persuratan, keuangan, kepegawaian, dan sertifikat: judul section serta nama item turun ke `font-medium`.
- `DashboardContent` profile/quick-action card: label, role, badge, dan avatar diringankan; penekanan masih dibantu warna dan layout.
- Bobot `font-semibold` dipertahankan untuk angka utama/statistik agar fokus visual dashboard tetap jelas.

### Tahap 5: Modul Prioritas

- [x] Audit modul keuangan.
- [x] Audit modul jadwal otomatis.
- [x] Audit modul persuratan.
- [x] Audit modul sertifikat.
- [x] Audit modul pegawai.
- [x] Audit modul penilaian kinerja.

Output:

- Modul yang paling sering digunakan memiliki ritme teks yang konsisten.
- Tabel dan form lebih ringan dibaca.

Catatan eksekusi:

- Keuangan: judul kecil, status stepper, label audit, dan item batch diturunkan ke `font-medium`; angka nominal/progress tetap `font-semibold`.
- Jadwal otomatis: heading kecil, rekap peserta, header grup absensi, dan indikator sesi diturunkan satu tingkat; angka rekap dan total honorarium tetap `font-semibold`.
- Persuratan: kode dokumen mono dan label statistik diturunkan; nilai statistik tetap `font-semibold`; stepper surat keluar diringankan pada badge angka dan nomor dokumen.
- Sertifikat: label analitik, heading editor/rekap, angka kartu, dan total tabel diturunkan satu tingkat; total penting tetap `font-semibold`.
- Pegawai: avatar inisial dan label statistik diturunkan agar daftar pegawai terasa lebih ringan.
- Penilaian kinerja: heading halaman dan angka rekap diturunkan dari `font-bold` ke `font-medium/semibold`; nilai skor penting tetap memakai `font-semibold`.
- Sisa `font-semibold` di modul prioritas dipertahankan untuk angka, nilai total, skor, progress, nominal, dan status kritis.

### Tahap 6: Final Polish dan QA Visual

- [x] Cek desktop viewport.
- [x] Cek mobile viewport.
- [x] Cek dark mode jika digunakan.
- [x] Cek halaman login dan verifikasi publik.
- [x] Cek state loading, empty, error, dialog, dan toast.
- [x] Jalankan lint/typecheck/test sesuai workflow project.

Output:

- Tipografi stabil di seluruh aplikasi.
- Tidak ada text overflow, layout shift, atau penurunan keterbacaan.

Catatan eksekusi:

- Audit final seluruh `src` memastikan tidak ada lagi `font-bold`, `font-extrabold`, atau `font-black`.
- Audit `globals.css` memastikan tidak ada override `.font-*` global dan tidak ada `!important`.
- Halaman login, reset password, error boundary, dan verifikasi publik diringankan agar konsisten dengan dashboard.
- Widget tambahan di kalender, absensi, cuti, pengaturan, project brevet, dan jadwal ujian diringankan dari `font-bold` ke `font-semibold` atau `font-medium`.
- Cek desktop/mobile/dark dilakukan melalui audit source responsive classes, dark classes, dan build route coverage; screenshot browser otomatis belum dijalankan pada tahap ini.
- `npm run lint` berhasil.
- `npm run typecheck` berhasil.
- `npm run build` berhasil. Ada warning Turbopack lama terkait trace `src/app/api/files/[...path]/route.ts` -> `next.config.ts`, bukan error build.
- `npm run test` default sempat gagal karena Vitest worker pool timeout sebelum test berjalan. Rerun dengan `npx vitest run --maxWorkers=1 --no-fileParallelism` berhasil: 3 file, 16 test passed.

---

## 6. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Menghapus override global terlalu cepat | Banyak halaman berubah drastis | Lakukan bertahap, mulai dari shared components |
| Teks tombol/status menjadi kurang jelas | UX aksi utama melemah | Gunakan warna, icon, background, dan state aktif |
| Tabel kehilangan hierarki | Data sulit dipindai | Header tetap medium, isi tabel normal, entitas utama medium-light |
| Terlalu banyak edit lokal | Risiko regresi tinggi | Prioritaskan komponen shared sebelum file fitur |
| Desain tidak konsisten antar modul | UI terasa tambalan | Gunakan checklist modul dan pola bobot standar |

---

## 7. Kriteria Selesai

Revamp tipografi dianggap selesai jika:

- Teks body dan isi tabel tidak lagi terasa bold.
- Judul halaman tetap jelas tanpa tampak terlalu berat.
- Tombol, badge, tab aktif, dan status tetap mudah dikenali.
- Angka statistik tetap menjadi fokus visual.
- Tidak ada override global yang memaksa seluruh utility font-weight secara agresif tanpa alasan jelas.
- Modul prioritas sudah dicek di desktop dan mobile.
- Lint/typecheck/test relevan berjalan tanpa error.

---

## 8. Catatan Implementasi

- Jangan lakukan perubahan massal otomatis ke semua `font-medium` atau `font-semibold` tanpa review konteks.
- Hindari refactor visual di luar tipografi kecuali diperlukan untuk menjaga hierarki teks.
- Jika ada perubahan pada shared component, uji minimal dashboard, satu halaman tabel, satu halaman form, dan satu dialog.
- Perubahan harus kecil, mudah direview, dan bisa dihentikan per tahap jika ada efek visual yang tidak diinginkan.
