# ARKA

**Aplikasi Ruang Kerja Administrasi**

ARKA adalah platform internal IAI Wilayah DKI Jakarta untuk mendukung digitalisasi administrasi, persuratan, kepegawaian, kegiatan, sertifikat, evaluasi, dan tata kelola operasional organisasi.

Aplikasi ini dibangun menggunakan **Next.js App Router**, **TypeScript**, **PostgreSQL**, **Drizzle ORM**, dan **Better Auth**.

## Current Condition

ARKA saat ini sudah berada pada tahap operasional aktif untuk beberapa modul utama. Sistem tidak lagi hanya berfokus pada persuratan dan kepegawaian, tetapi sudah berkembang menjadi platform administrasi internal yang mencakup:

- Persuratan dan arsip
- Kepegawaian
- Sertifikat dan kegiatan
- Jadwal kegiatan dan ujian
- Absensi
- Cuti
- Penilaian kinerja
- Evaluasi PPL
- Keuangan
- Project/task management
- Pengumuman internal
- Notifikasi
- Audit log
- Pengaturan sistem

## Modul Utama

### 1. Persuratan & Arsip

- Surat Keluar dengan workflow bertahap
- Surat Masuk dan disposisi
- Surat Keputusan
- Surat MOU
- Nomor Surat otomatis dan manual
- Pejabat penandatangan
- Arsip surat
- Export CSV
- Verifikasi publik melalui QR Code

### 2. Kepegawaian

- Data pegawai
- Divisi
- Kelengkapan profil pegawai
- QR Contact pegawai berbasis vCard
- Riwayat pendidikan, pekerjaan, kesehatan, keluarga, dan integritas

### 3. Sertifikat & Kegiatan

- Manajemen event/kegiatan
- Template sertifikat
- Editor visual template sertifikat
- Import peserta via CSV/XLSX
- Generate QR peserta
- Generate PDF sertifikat
- Pengiriman email
- Penandatangan sertifikat
- Analitik kegiatan
- Verifikasi publik sertifikat
- Revokasi sertifikat
- Soft delete data sertifikat

### 4. Jadwal & Kalender

- Jadwal otomatis Brevet
- Jadwal ujian
- Kalender kegiatan
- Pengelolaan agenda internal

### 5. Absensi & Cuti

- Manajemen absensi
- Pengajuan dan pengelolaan cuti
- Integrasi data kepegawaian

### 6. Evaluasi & Penilaian

- Evaluasi PPL berbasis token publik
- Penilaian kinerja pegawai
- Template penilaian
- Rekap hasil evaluasi

### 7. Keuangan & Project

- Modul keuangan internal
- Project/task management
- Monitoring pekerjaan internal

### 8. Sistem Internal

- Pengumuman internal
- Notifikasi dan preferensi pengguna
- Audit log aktivitas
- Pengaturan sistem
- Role-based access control

## Verifikasi Publik

Beberapa dokumen dan sertifikat dapat diverifikasi melalui halaman publik:

- `/verifikasi/surat-keluar/[id]`
- `/verifikasi/surat-keputusan/[id]`
- `/verifikasi/surat-mou/[id]`
- `/verifikasi/[noSertifikat]`
- `/evaluasi/[token]`

Seluruh halaman internal tetap dilindungi autentikasi.

## Tech Stack

| Kategori | Teknologi |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| UI | Tailwind CSS, shadcn/ui, Radix UI |
| Auth | Better Auth |
| Database | PostgreSQL / Neon |
| ORM | Drizzle ORM + Drizzle Kit |
| Form | React Hook Form + Zod |
| Table | TanStack Table |
| Chart | Recharts |
| PDF | @react-pdf/renderer, pdf-lib, jspdf |
| QR | qrcode |
| File Import | papaparse, xlsx, jszip |
| Upload | Cloudinary / Local Storage |
| Email | Mailjet |
| Editor | Tiptap |
| Testing | Vitest |
| Runtime | Node.js >= 20 |

## Struktur Project

```txt
src/
  app/              # App Router: auth, dashboard, api, verifikasi, evaluasi
  components/       # Komponen UI dan komponen per modul
  server/           # Server actions, auth, database
  lib/              # Helper, validator, QR, PDF, email, storage, utils
  assets/           # Asset internal
  styles/           # Global CSS
  proxy.ts          # Route protection

docs/               # Dokumentasi teknis dan rencana pengembangan
drizzle/            # Database migrations
scripts/            # Utility script dan seeding
public/             # Public assets
Menjalankan Lokal
npm install
cp .env.example .env.local
npm run dev

Aplikasi berjalan di:

http://localhost:6700
Scripts
npm run dev
npm run build
npm run start
npm run typecheck
npm run lint
npm run format
npm run test
npm run db:generate
npm run db:migrate
npm run db:push
npm run db:studio
Environment

Minimal environment yang perlu disiapkan:

DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_APP_NAME=

STORAGE_PROVIDER=local

Untuk production, storage dapat diarahkan ke Cloudinary:

STORAGE_PROVIDER=cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
Status Pengembangan

Status saat ini:

Modul inti sudah berjalan dan aktif dikembangkan.
Struktur aplikasi sudah menggunakan pendekatan modular.
Autentikasi dan proteksi route internal sudah tersedia.
Verifikasi publik tersedia untuk dokumen dan sertifikat.
Beberapa modul pendukung seperti absensi, cuti, penilaian kinerja, evaluasi, keuangan, dan project sudah masuk ke struktur aplikasi.

Fokus lanjutan:

Hardening RBAC
Validasi storage end-to-end
Polishing UI/UX
Optimasi performa tabel dan query
Finalisasi deployment production
Penyempurnaan dokumentasi teknis
