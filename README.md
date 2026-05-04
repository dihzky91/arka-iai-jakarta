# ARKA

**Aplikasi Ruang Kerja Administrasi**

Platform internal untuk layanan, kolaborasi, dan tata kelola **IAI Wilayah Jakarta**.
Dibangun dengan **Next.js App Router** untuk mendukung operasional organisasi secara end-to-end.

## Modul

**Persuratan & Arsip**

- Surat Keluar — workflow 5 tahap (draft → persetujuan → reviu → pengarsipan → selesai)
- Surat Masuk + Disposisi berantai (chain/tree)
- Surat Keputusan (SK)
- Surat MOU
- Nomor Surat — counter atomik otomatis + nomor manual
- Pejabat Penandatangan

**Kepegawaian**

- Data Pegawai — 7 tab (profil, kelengkapan, keluarga, pendidikan, pekerjaan, kesehatan, integritas)
- Divisi
- QR Contact Pegawai (vCard)

**Sertifikat & Kegiatan**

- Event / Kegiatan — CRUD + filter + server-side pagination
- Template Sertifikat — drag-drop editor visual (react-rnd)
- Peserta — import bulk CSV/XLSX, QR per peserta, PDF, email
- Penandatangan (signatories)
- Analitik — charts (recharts)
- Verifikasi publik sertifikat via QR
- Revokasi sertifikat + soft delete

**Fitur Lain**

- Jadwal Otomatis Brevet
- Jadwal Ujian
- Kalender Kegiatan
- Pengumuman Internal
- Pengaturan Sistem
- Notifikasi & preferensi
- Audit Log sistem
- Export CSV arsip surat
- Bulk nomor surat

**Verifikasi Publik (QR)**

- `/verifikasi/surat-keluar/[id]`
- `/verifikasi/surat-keputusan/[id]`
- `/verifikasi/surat-mou/[id]`
- `/verifikasi/[noSertifikat]`

## Tech Stack

| Kategori  | Teknologi                                                     |
| --------- | ------------------------------------------------------------- |
| Framework | Next.js 16 (App Router), React 19, TypeScript strict          |
| Database  | PostgreSQL (Neon), Drizzle ORM + Drizzle Kit                  |
| Auth      | Better Auth (session-based, RBAC: admin/pejabat/staff/viewer) |
| UI        | Tailwind CSS, shadcn/ui, Radix UI, Lucide Icons, Sonner       |
| Form      | React Hook Form + Zod                                         |
| Table     | TanStack Table (server-side pagination, filter, sorting)      |
| Charts    | Recharts                                                      |
| PDF       | @react-pdf/renderer, pdf-lib, jspdf + jspdf-autotable         |
| QR        | qrcode                                                        |
| File      | papaparse (CSV), xlsx (XLSX), jszip (ZIP)                     |
| Upload    | Cloudinary (production) / local storage (development)         |
| Email     | Mailjet (node-mailjet)                                        |
| Editor    | Tiptap (WYSIWYG)                                              |
| Date      | date-fns                                                      |

## Status

Operasional aktif. Modul utama sudah live dan digunakan. Lanjutan: validasi storage end-to-end, polish UI, hardening RBAC, deploy final.

Dokumen arsitektur lengkap: [SYSTEM.md](./SYSTEM.md).

## Struktur

```
src/
  app/              # App Router — (auth), (dashboard), verifikasi
  components/       # UI komponen per modul
  server/           # Server Actions + DB config + Auth config
  lib/              # Validator, PDF, QR, email, env, utils
  styles/           # Global CSS
docs/               # Dokumentasi lanjutan
drizzle/            # Migrations
scripts/            # Seed, schema utility
```

## Menjalankan Lokal

```bash
npm install
cp .env.example .env.local
# isi DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL
npm run dev          # http://localhost:6700
```

Jika akses via port-forward/reverse proxy (contoh `*.devtunnels.ms`), isi juga:

```bash
SERVER_ACTIONS_ALLOWED_ORIGINS=*.devtunnels.ms
NEXT_ALLOWED_DEV_ORIGINS=*.devtunnels.ms
```

## Scripts

```bash
npm run dev          # next dev --port 6700
npm run build        # next build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run format       # prettier --write .
npm run db:generate  # drizzle-kit generate
npm run db:migrate   # drizzle-kit push --force
npm run db:push      # drizzle-kit push
npm run db:studio    # drizzle-kit studio
```

## Environment

Lihat [.env.example](./.env.example). Storage provider dikonfigurasi via env:

```bash
STORAGE_PROVIDER=local        # development (disarankan)
STORAGE_PROVIDER=cloudinary   # production
STORAGE_PROVIDER=hosted       # placeholder
```

## Catatan

- Zona waktu aplikasi: **Asia/Jakarta**
- Backdate dokumen: **diizinkan** untuk kebutuhan administrasi organisasi
- Seluruh route internal dilindungi autentikasi — hanya halaman verifikasi publik yang dapat diakses tanpa login
