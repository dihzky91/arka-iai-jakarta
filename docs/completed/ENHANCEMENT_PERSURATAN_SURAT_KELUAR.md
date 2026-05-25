# Enhancement Persuratan — Surat Keluar

## Status
Selesai diimplementasikan

Audit implementasi: 21 Mei 2026 (Asia/Jakarta) - lint bersih; typecheck masih tertahan error existing di test PPL.

Checkpoint terakhir: 21 Mei 2026 (Asia/Jakarta) — Dokumentasi awal dibuat.

---

## 1. Tujuan

- Menambahkan **flag "Diproses di SIMPEG IAI"** untuk surat keluar yang workflow-nya berjalan di SIMPEG pusat, sementara Arka tetap menjadi sumber kebenaran penomoran dan arsip digital (pengganti logbook manual).
- Menambahkan **email notifikasi** ke reviewer/pejabat saat surat diajukan untuk persetujuan, ditolak (revisi), atau selesai.
- Menyediakan **halaman review dedicated** yang bisa diakses langsung dari link di email, agar reviewer bisa langsung melihat detail surat dan mengambil keputusan (setuju/revisi) tanpa harus navigasi dashboard.

---

## 2. Konteks

### 2.1 Posisi Arka dalam Ekosistem Persuratan IAI Jakarta

- **Arka** = logbook digital surat keluar IAI Wilayah DKI Jakarta. Semua surat keluar tercatat di sini (nomor, perihal, tujuan, tanggal, file).
- **SIMPEG IAI** = sistem persuratan pusat. Surat keluar resmi yang sifatnya ke luar (permohonan narasumber, undangan kegiatan, dll) diproses melalui SIMPEG.
- **Alur**: Admin generate nomor surat di Arka → nomor tersebut dipakai saat input ke SIMPEG → SIMPEG yang memproses pengiriman resmi.
- Sebelum Arka ada, pencatatan dilakukan di buku logbook manual.

### 2.2 Kondisi Saat Ini

- Notifikasi surat keluar hanya **in-app** (bell notification). Belum ada email.
- Semua surat keluar melewati workflow 5 tahap yang sama, termasuk surat yang sebenarnya diproses di SIMPEG.
- Reviewer harus buka dashboard → cari surat → review di stepper. Tidak ada shortcut dari email.

---

## 3. Scope Enhancement

### 3.1 Flag SIMPEG (In Scope)

| Item | Detail |
|------|--------|
| Field baru di schema | `prosesViaSimpeg` (boolean, default false) |
| Form surat keluar | Toggle/checkbox "Diproses di SIMPEG IAI" |
| Efek jika aktif | Skip workflow review (step 2-3), surat bisa langsung ke tahap pengarsipan |
| Badge di tabel & detail | Label "Surat ini diproses di SIMPEG IAI" |
| Nomor surat | Tetap di-generate dari Arka (sumber kebenaran penomoran) |
| Stepper | Tampilkan info bahwa review dilakukan di SIMPEG, bukan di Arka |

### 3.2 Email Notifikasi (In Scope)

| Event | Penerima | Isi Email |
|-------|----------|-----------|
| `ajukanPersetujuan` | Pejabat/reviewer | Info surat + link ke halaman review |
| `tolakSurat` (revisi) | Pembuat surat | Info revisi + catatan reviewer |
| `selesaikanSurat` | Pembuat surat | Konfirmasi surat selesai + nomor surat |

Catatan:
- Email hanya dikirim jika preference user `pref.email` aktif (gunakan `checkNotificationPreference` yang sudah ada).
- Surat dengan flag `prosesViaSimpeg = true` **tidak mengirim email review** (karena review-nya di SIMPEG).

### 3.3 Halaman Review Dedicated (In Scope)

| Item | Detail |
|------|--------|
| Route | `/surat-keluar/review/[id]` |
| Akses | Authenticated (user harus login, role pejabat/admin) |
| Layout | Full-page, bukan modal/stepper |
| Panel kiri | Metadata surat: pembuat, perihal, tujuan, alamat, tanggal, isi singkat |
| Panel kanan | PDF viewer/preview dari file draft |
| Aksi | Tombol "Setujui" dan "Minta Revisi" (dengan textarea catatan) |
| Setelah aksi | Redirect ke halaman surat keluar + toast konfirmasi |

### 3.4 Yang Tidak Termasuk (Out of Scope)

- Integrasi API langsung ke SIMPEG (sinkronisasi data otomatis)
- Token-based access (tanpa login) untuk halaman review
- Mail template editor di UI (admin edit template dari dashboard)
- Perubahan format/logika penomoran surat

---

## 4. Perubahan Teknis

### 4.1 Database

```sql
-- Migration: tambah kolom prosesViaSimpeg
ALTER TABLE surat_keluar ADD COLUMN proses_via_simpeg BOOLEAN NOT NULL DEFAULT false;
```

### 4.2 Schema Drizzle

```typescript
// Di src/server/db/schema.ts (tabel suratKeluar)
prosesViaSimpeg: boolean("proses_via_simpeg").notNull().default(false),
```

### 4.3 Validator (Zod)

```typescript
// suratKeluarCreateSchema & suratKeluarUpdateSchema
prosesViaSimpeg: z.boolean().optional().default(false),
```

### 4.4 Email Templates

File: `src/lib/email/templates.ts`

Tambah 3 template baru:
- `buildSuratKeluarReviewEmail` — untuk ajukan persetujuan
- `buildSuratKeluarRevisiEmail` — untuk notifikasi revisi
- `buildSuratKeluarSelesaiEmail` — untuk notifikasi selesai

Isi email review (referensi dari sistem pusat):
- Sapaan: "Yth. [Nama Pejabat]"
- Body: "Mohon perkenan untuk mereviu draft surat keluar berikut:"
- Detail: Pembuat, Perihal, Tujuan
- CTA: Link "Reviu Surat Keluar" → `/surat-keluar/review/[id]`
- Footer: branding organisasi

### 4.5 Notifications

File: `src/server/actions/notifications.ts`

Update `notifySuratKeluarApproval`, `notifySuratKeluarRevisi`, `notifySuratKeluarSelesai`:
- Tambah pengecekan `pref.email`
- Jika aktif, fetch email user → kirim via `sendEmail()`

### 4.6 Server Actions

File: `src/server/actions/suratKeluar.ts`

- `createSuratKeluar` / `updateSuratKeluar`: handle field `prosesViaSimpeg`
- `ajukanPersetujuan`: skip jika `prosesViaSimpeg = true` (atau disable tombol di UI)
- Guard transisi: jika `prosesViaSimpeg`, izinkan langsung ke pengarsipan dari draft

### 4.7 Komponen UI

| File | Perubahan |
|------|-----------|
| `SuratKeluarForm.tsx` | Tambah toggle "Diproses di SIMPEG IAI" |
| `SuratKeluarStepper.tsx` | Kondisional: jika SIMPEG, tampilkan info banner, hide tombol ajukan persetujuan |
| `SuratKeluarManager.tsx` | Badge "SIMPEG" di kolom status atau kolom terpisah |
| `src/app/(dashboard)/surat-keluar/review/[id]/page.tsx` | Halaman review baru |
| `src/components/surat-keluar/SuratKeluarReviewPage.tsx` | Komponen review full-page |

---

## 5. Alur Kerja Setelah Enhancement

### 5.1 Surat Internal (workflow penuh di Arka)

```
Draft → Ajukan Persetujuan → [Email ke reviewer] → Reviewer buka link
→ Halaman Review → Setujui/Revisi → Pengarsipan → Selesai
```

### 5.2 Surat via SIMPEG

```
Draft (flag SIMPEG aktif) → Generate Nomor di Arka → Input nomor ke SIMPEG
→ Pengarsipan di Arka (upload file final jika ada) → Selesai
```

Keterangan: Step review/approval di-skip karena dilakukan di SIMPEG.

---

## 6. Desain Halaman Review

### 6.1 Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Logo + "Approval Surat Keluar"                             │
├─────────────────────────────┬───────────────────────────────┤
│                             │                               │
│  Yth. [Nama Pejabat]       │  Preview / Download Draft     │
│                             │  ┌─────────────────────────┐  │
│  Pembuat: [nama]            │  │                         │  │
│  Perihal: [perihal]         │  │    PDF Preview          │  │
│  Tujuan: [tujuan]           │  │                         │  │
│  Tanggal: [tanggal]         │  │                         │  │
│  Isi Singkat: [isi]         │  └─────────────────────────┘  │
│                             │                               │
├─────────────────────────────┴───────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌──────────────────────────────────────┐  │
│  │  Setujui    │  │  Minta Revisi                        │  │
│  └─────────────┘  │  [textarea catatan revisi]           │  │
│                    │  [Kirim Revisi]                      │  │
│                    └──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Behavior

- Hanya muncul jika surat berstatus `diajukan` (menunggu review)
- Jika status bukan `diajukan`, tampilkan pesan: "Surat ini sudah diproses" + info status terkini
- Setelah aksi, redirect ke `/surat-keluar` dengan toast

---

## 7. Rencana Implementasi Bertahap

### Phase A — Flag SIMPEG
- [x] Migration: tambah kolom `proses_via_simpeg`
- [x] Update Drizzle schema
- [x] Update Zod validator
- [x] Update form (toggle)
- [x] Update stepper (kondisional skip review)
- [x] Update tabel (badge SIMPEG)
- [x] Guard transisi: izinkan draft → pengarsipan jika SIMPEG

### Phase B — Email Notifikasi
- [x] Buat template `buildSuratKeluarReviewEmail`
- [x] Buat template `buildSuratKeluarRevisiEmail`
- [x] Buat template `buildSuratKeluarSelesaiEmail`
- [x] Update `notifySuratKeluarApproval` — tambah kirim email
- [x] Update `notifySuratKeluarRevisi` — tambah kirim email
- [x] Update `notifySuratKeluarSelesai` — tambah kirim email
- [x] Skip email review jika `prosesViaSimpeg = true`

### Phase C — Halaman Review Dedicated
- [x] Buat route `/surat-keluar/review/[id]/page.tsx`
- [x] Buat komponen `SuratKeluarReviewPage.tsx`
- [x] Implementasi PDF preview (iframe/embed)
- [x] Implementasi aksi setujui + revisi
- [x] Guard: hanya role pejabat/admin yang bisa akses
- [x] Guard: hanya surat berstatus `diajukan`/`reviu` yang bisa di-review
- [x] Redirect + toast setelah aksi

---

## 8. Kriteria Sukses

- Admin bisa membuat surat keluar dengan flag SIMPEG → workflow review di-skip, nomor tetap dari Arka.
- Pejabat menerima email saat ada surat yang perlu di-review → klik link → langsung ke halaman review.
- Pejabat bisa setujui/revisi dari halaman review tanpa navigasi ke dashboard.
- Pembuat surat menerima email saat surat ditolak (revisi) atau selesai.
- Alur existing (in-app notification + stepper) tetap berjalan tanpa perubahan.

---

## 9. Risiko dan Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Email tidak terkirim (provider down) | Fallback: in-app notification tetap jalan, email bersifat tambahan |
| User buka link review tapi surat sudah diproses | Guard status + pesan informatif |
| Confusion antara surat SIMPEG vs internal | Badge visual yang jelas + info di stepper |
| PDF preview gagal (file corrupt/besar) | Fallback: tombol download, jangan block aksi review |

---

## 10. Catatan Tambahan

- Halaman review menggunakan autentikasi standar (session-based), bukan token URL. Alasan: lebih aman, tidak perlu manage token expiry terpisah.
- Jika ke depan ada kebutuhan review tanpa login (misal pejabat yang jarang buka sistem), bisa ditambahkan token-based access sebagai enhancement terpisah.

---

## 11. Audit Implementasi

- [x] `npm run lint` berhasil tanpa error.
- [x] `npm run typecheck` dijalankan; tidak ada error baru pada modul surat keluar. Masih ada error TypeScript existing di `src/__tests__/ppl-evaluasi/*` yang tidak terkait enhancement ini.
- [x] Temuan bug saat audit: tipe `z.default(false)` di form SIMPEG membuat mismatch React Hook Form/Zod. Sudah diperbaiki dengan boolean optional di schema form dan normalisasi payload ke `Boolean(...)`.
- Email template menggunakan pola yang sama dengan `buildDisposisiEmail` yang sudah ada — inline HTML sederhana, bukan template engine terpisah.
