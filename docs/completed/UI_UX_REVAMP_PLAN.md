# Rencana Implementasi: Revamp UI/UX ARKA ("Clean Modern SaaS")

Dokumen ini merupakan panduan teknis dan desain untuk merombak antarmuka pengguna (UI) dan pengalaman pengguna (UX) pada sistem ARKA, mengacu pada standar aplikasi *SaaS (Software as a Service)* tingkat *enterprise* yang modern, bersih, dan dinamis.

---

## 1. Visi & Objektif Desain
Mengubah ARKA dari tampilan dashboard tradisional yang terkesan kaku menjadi *workspace* digital yang memanjakan mata, responsif, dan terasa premium (*Aesthetic-driven design*).

## 2. Typography & General Styling (Vibe)
- **Primary Font (UI/Body):** Menggunakan `Inter`. Font ini sangat optimal untuk antarmuka pengguna, tabel, dan daftar list karena tingkat legibilitasnya yang tinggi pada ukuran kecil.
- **Secondary Font (Heading/Display):** Menggunakan `Outfit`. Memberikan sentuhan geometris dan ramah (*friendly*) pada judul halaman, angka statistik, dan elemen *branding*.
- **Whitespace & Breathing Room:** Memperbesar ukuran *padding* dan *margin* antar komponen agar antarmuka tidak terasa sesak.
- **Bentuk & Sudut:** Mengubah semua *border-radius* komponen utama (kartu, modal, input) menjadi `rounded-2xl` atau `rounded-3xl` untuk menghilangkan kesan tajam dan kaku.
- **Efek Material:** Menerapkan efek *Glassmorphism* (`backdrop-blur`) transparan pada elemen *sticky* seperti Topbar dan Navigasi untuk memberikan ilusi kedalaman ruang (*depth*).

## 3. Design System & Colors
- **Background & Surface:** Mengandalkan spektrum abu-abu netral (`slate-50` untuk latar belakang utama aplikasi, `white` solid untuk elemen kartu/kontainer).
- **Text:** `slate-900` untuk heading dan teks utama yang membutuhkan penekanan, `slate-500` untuk teks pendukung/sub-teks.
- **Primary Brand (Accent):** Menggunakan biru solid (`Blue-600` Tailwind) sebagai warna identitas utama untuk tombol aksi (*primary buttons*), *focus ring*, dan penanda status aktif.
- **Elevasi (Shadow & Border):** Menghindari bayangan hitam yang tebal/berat. Menggunakan *soft shadow* yang hampir transparan untuk memberikan *lift*, dikombinasikan dengan border sangat tipis (`border-slate-100` atau `border-slate-200`) sebagai pemisah struktur visual.

## 4. Navigasi & Struktur Layout (Dual-Tier Sidebar)
Sesuai dengan keputusan untuk menangani navigasi *nested* yang kompleks, kita akan menerapkan pola **Dual-Tier Sidebar** (Sidebar Dua Tingkat):
- **Tier 1 (Main Module Strip):** Sidebar statis di sisi paling kiri yang sangat ramping. Hanya berisi *Icon* besar untuk modul-modul utama (Dashboard, Persuratan, Kepegawaian, dll).
- **Tier 2 (Sub-menu Panel):** Panel yang akan meluncur (*slide-out*) di sebelah Tier 1 ketika sebuah modul diklik. Panel ini berisi daftar teks sub-menu dari modul tersebut.
- **Keuntungan UX:** Meminimalisir kekacauan visual (visual noise) saat pengguna hanya butuh satu modul, serta memberikan ruang tengah (*workspace*) yang jauh lebih luas.
- **Profil User:** Mengadopsi desain "ID Card" profil di bagian bawah atau atas sidebar dengan warna latar belakang biru (*brand color*) untuk menonjolkan identitas *user* yang sedang *login*.

## 5. Interactions & Animations (Performance Safe)
Efek interaksi ini sepenuhnya berjalan di sisi *Client* (Browser) sehingga **tidak akan memberatkan server atau *query* pada arsitektur *serverless***.
- **Transisi Halaman:** Mengintegrasikan pustaka `framer-motion`. Saat pengguna berpindah menu, konten halaman baru akan masuk dengan efek *fade-in* dan *slide-up* yang instan (durasi ~0.2s).
- **Micro-interactions:** Elemen interaktif seperti baris list, kartu statistik, dan tombol akan merespons kejadian *hover* (contoh: *scale-up* 1%, atau pergeseran ikon).
- **Feedback Visual:** Memberikan status *loading skeleton* yang estetik saat memuat data, serta *toast notification* modern untuk aksi sukses/gagal.

## 6. Pola Komponen Spesifik
- **Data Display (List > Table):** 
  - Sebisa mungkin menghindari tabel tradisional bercorak garis-garis yang kaku.
  - Menerapkan "List Item Layout": Setiap entri data adalah baris dengan *padding* lebar, memiliki *avatar/icon* di sisi kiri, dan badge status di kanan.
  - Status menggunakan desain "Soft Pill Badges" (latar belakang pastel transparan dengan warna font yang pekat).
- **Dashboard Stat Cards (Bento Grid):** 
  - Mengubah susunan kartu statistik menjadi pola *Bento Grid* dengan rasio yang asimetris (bervariasi ukurannya) agar menarik secara visual.
  - Menyematkan *watermark* ikon berukuran besar dengan opasitas sangat rendah di sudut kanan bawah kartu.
- **Kalender:** Desain minimalis tanpa garis *grid* yang tebal. Indikator acara hanya berupa *dots* (titik) berwarna-warni, dengan highlight melingkar menggunakan warna *brand* untuk menandai tanggal hari ini.
- **Form & Input Field:** Kotak *input* modern dengan gaya *borderless* pada posisi *idle* (mengandalkan kontras warna latar `slate-50`), namun akan memunculkan *ring* (cincin fokus) berwarna biru terang ketika sedang aktif diketik.

---

## 7. Checklist Tahapan Eksekusi
Berikut adalah daftar tugas untuk melacak progres implementasi desain baru ini:

- [x] **Tahap 1: Setup & Konfigurasi Dasar**
  - [x] Menambahkan *font* `Inter` dan `Outfit` ke dalam project (Google Fonts / next/font).
  - [x] Memperbarui konfigurasi palet warna dan radius di `tailwind.config.ts`.
  - [x] Menginstal dan mengkonfigurasi `framer-motion`.

- [x] **Tahap 2: Struktur Navigasi (Dual-Tier Sidebar)**
  - [x] Merombak `Sidebar.tsx` menjadi *Tier 1* (Icon Module Strip).
  - [x] Membuat komponen *Tier 2* (Slide-out Sub-menu Panel) dengan animasi `framer-motion`.
  - [x] Mengimplementasikan *Profile Card* dengan latar belakang *brand color* di navigasi.

- [x] **Tahap 3: Revamp Halaman Dashboard Utama**
  - [x] Mengubah layout *Stat Cards* menjadi sistem *Bento Grid*.
  - [x] Menambahkan elemen *watermark icon* pada kartu statistik.
  - [x] Memperhalus tampilan kalender kecil di dashboard (hilangkan garis kaku, gunakan dot indikator).

- [x] **Tahap 4: Polishing Komponen Global (List & Form)**
  - [x] Mengonversi desain tabel standar menjadi "List Item Layout" dengan *padding* luas.
  - [x] Memperbarui desain *Input/Form* menjadi gaya *borderless* dengan *ring focus* biru.
  - [x] Memperbarui desain *Badge/Status* menjadi "Soft Pill Badges".

---
*Dokumen ini dibuat secara otomatis sebagai pedoman tahap eksekusi.*
