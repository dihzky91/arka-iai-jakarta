# Integrasi DingTalk — Absensi & Cuti Karyawan

## Status
Draft perencanaan

Checkpoint terakhir: 3 Mei 2026 (Asia/Jakarta) — Dokumentasi awal dibuat.

---

## 1. Tujuan

- Mengintegrasikan DingTalk Open Platform ke sistem ARKA untuk pencatatan absensi karyawan.
- Menyinkronkan data kehadiran (check-in/out) dari DingTalk ke database lokal.
- Mendukung pengajuan cuti dari ARKA yang ter-sync ke DingTalk.
- Menyediakan mapping antara pegawai ARKA dan akun DingTalk.

---

## 2. Lingkup Integrasi

### 2.1 Yang Termasuk (In Scope)

| Fitur | Arah Data | Keterangan |
|-------|-----------|------------|
| Absensi karyawan harian | DingTalk → ARKA | Pull data check-in/out |
| Pengajuan cuti | ARKA → DingTalk | Push pengajuan dari form ARKA |
| Data cuti/izin | DingTalk → ARKA | Pull status approval & riwayat |
| Mapping user | ARKA ↔ DingTalk | Kolom `dingtalk_user_id` di tabel `users` |

### 2.2 Yang Tidak Termasuk (Out of Scope)

- Integrasi DingTalk untuk notifikasi/chat
- Login DingTalk OAuth ke ARKA
- Manajemen attendance group dari ARKA
- Hardware attendance machine management

---

## 3. Setup DingTalk Open Platform

### 3.1 Registrasi Aplikasi

1. Buka **https://open-dev.dingtalk.com/**
2. Login dengan akun DingTalk admin organisasi
3. Navigasi ke **App Development** (应用开发) → **Create App** (创建应用)
4. Pilih tipe: **Internal Enterprise App** (企业内部应用)
5. Isi informasi:
   - Nama: `ARKA Integration`
   - Deskripsi: `Integrasi absensi dan cuti untuk sistem manajemen persuratan`
   - Icon: upload logo organisasi
6. Setelah app dibuat, catat kredensial:
   - **AppKey** (Client ID)
   - **AppSecret** (Client Secret)

### 3.2 Konfigurasi Permission

Di app console → **Permission Management** (权限管理), aktifkan scope berikut:

| Scope | Label | Fungsi |
|-------|-------|--------|
| `Attendance:attendance` | Attendance Read/Write | Akses data absensi |
| `Attendance:record` | Attendance Records | Catatan clock-in/out |
| `Attendance:report` | Attendance Reports | Laporan kehadiran |
| `Leave:leave` | Leave Management | Pengajuan & data cuti |
| `Contact:contact:readonly` | Contact Read | Mapping user ID |

### 3.3 Publish & Approval

1. Submit versi app untuk review
2. Admin organisasi melakukan approval
3. Setelah approved, app dapat mengakses API

### 3.4 IP Whitelist

Tambahkan IP server development/production di **Security Settings** (安全设置):
- Development: IP lokal atau VPN IP
- Production: IP server hosting ARKA

---

## 4. Arsitektur Integrasi

### 4.1 Alur Data

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   DingTalk   │────▶│  ARKA Sync Layer  │────▶│  PostgreSQL  │
│  Open API    │◀────│  (Server Actions) │◀────│  Database    │
└─────────────┘     └──────────────────┘     └─────────────┘
       │                      │
       │                      ▼
       │              ┌──────────────┐
       └──────────────│   Next.js UI │
                      └──────────────┘
```

### 4.2 Struktur File Baru

```
src/
├── lib/dingtalk/
│   ├── client.ts            # HTTP client + error handling
│   ├── auth.ts              # Token management (get, cache, refresh)
│   ├── attendance.ts        # Attendance API wrapper
│   └── leave.ts             # Leave API wrapper
├── server/actions/dingtalk/
│   ├── sync-attendance.ts   # Pull absensi dari DingTalk
│   ├── sync-leave.ts        # Pull data cuti dari DingTalk
│   ├── submit-leave.ts      # Push pengajuan cuti ke DingTalk
│   └── config.ts            # CRUD konfigurasi DingTalk
├── app/(dashboard)/
│   ├── absensi/page.tsx     # Halaman absensi karyawan
│   └── cuti/page.tsx        # Halaman pengajuan cuti
└── components/
    ├── absensi/
    │   ├── AbsensiManager.tsx
    │   ├── AbsensiCalendar.tsx
    │   └── AbsensiStats.tsx
    └── cuti/
        ├── CutiManager.tsx
        ├── CutiForm.tsx
        └── CutiApproval.tsx
```

---

## 5. Database Schema

### 5.1 Perubahan Tabel `users`

```sql
ALTER TABLE users ADD COLUMN dingtalk_user_id TEXT;
CREATE INDEX idx_users_dingtalk_user_id ON users(dingtalk_user_id);
```

### 5.2 Tabel `absensi_karyawan`

```sql
CREATE TABLE absensi_karyawan (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tanggal               DATE NOT NULL,
  jam_masuk             TIMESTAMPTZ,
  jam_pulang            TIMESTAMPTZ,
  status                VARCHAR(20) NOT NULL DEFAULT 'hadir',
  -- Status: hadir, terlambat, alpha, cuti, dinas_luar, izin, sakit
  keterlambatan_menit   INTEGER DEFAULT 0,
  sumber                VARCHAR(20) NOT NULL DEFAULT 'dingtalk',
  -- Sumber: dingtalk, manual
  dingtalk_record_id    TEXT,
  catatan               TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: satu record per user per hari per sumber
CREATE UNIQUE INDEX uniq_absensi_user_tanggal_sumber
  ON absensi_karyawan(user_id, tanggal, sumber);

CREATE INDEX idx_absensi_tanggal ON absensi_karyawan(tanggal);
CREATE INDEX idx_absensi_user_id ON absensi_karyawan(user_id);
```

### 5.3 Tabel `pengajuan_cuti`

```sql
CREATE TABLE pengajuan_cuti (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jenis_cuti            VARCHAR(50) NOT NULL,
  -- Jenis: tahunan, sakit, melahirkan, menikah, kematian, lainnya
  tanggal_mulai         DATE NOT NULL,
  tanggal_selesai       DATE NOT NULL,
  jumlah_hari           INTEGER NOT NULL,
  alasan                TEXT,
  status                VARCHAR(20) NOT NULL DEFAULT 'draft',
  -- Status: draft, diajukan, disetujui, ditolak, dibatalkan
  dingtalk_process_id   TEXT,
  dingtalk_form_code    TEXT,
  approved_by           TEXT REFERENCES users(id),
  approved_at           TIMESTAMPTZ,
  rejected_reason       TEXT,
  lampiran_url          TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cuti_user_id ON pengajuan_cuti(user_id);
CREATE INDEX idx_cuti_status ON pengajuan_cuti(status);
CREATE INDEX idx_cuti_tanggal ON pengajuan_cuti(tanggal_mulai, tanggal_selesai);
```

### 5.4 Tabel `dingtalk_config`

```sql
CREATE TABLE dingtalk_config (
  id                    SERIAL PRIMARY KEY,
  app_key               TEXT NOT NULL,
  app_secret            TEXT NOT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  sync_interval_menit   INTEGER NOT NULL DEFAULT 60,
  last_sync_at          TIMESTAMPTZ,
  last_sync_status      VARCHAR(20),
  -- Status: success, partial, failed
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 6. DingTalk API Reference

### 6.1 Authentication

```
POST https://api.dingtalk.com/v1.0/oauth2/accessToken
Content-Type: application/json

{
  "appKey": "<APP_KEY>",
  "appSecret": "<APP_SECRET>"
}

Response:
{
  "accessToken": "token_string",
  "expireIn": 7200
}
```

- Token berlaku 2 jam, cache dan refresh otomatis sebelum expire
- Header untuk semua request: `x-acs-dingtalk-access-token: {accessToken}`

### 6.2 Attendance Records (Absensi)

```
POST https://api.dingtalk.com/v1.0/attendance/records
x-acs-dingtalk-access-token: {token}
Content-Type: application/json

{
  "userIdList": ["user_id_1", "user_id_2"],
  "checkDateFrom": "2026-05-01 00:00:00",
  "checkDateTo": "2026-05-02 00:00:00"
}

Response:
{
  "recordList": [
    {
      "recordId": "string",
      "userId": "string",
      "workDate": "2026-05-01",
      "checkType": "OnDuty",
      "planCheckTime": "2026-05-01 09:00:00",
      "userCheckTime": "2026-05-01 08:55:00",
      "locationResult": "Normal",
      "sourceType": "DING_ATM"
    }
  ]
}
```

**Rate limit:** Maksimal rentang 7 hari per request, ~40 req/detik.

### 6.3 Attendance Reports (Laporan)

```
POST https://api.dingtalk.com/v1.0/attendance/reports
x-acs-dingtalk-access-token: {token}
Content-Type: application/json

{
  "userIdList": ["user_id_1"],
  "startDate": "2026-05-01",
  "endDate": "2026-05-31"
}
```

**Rate limit:** Maksimal rentang 30 hari per request.

### 6.4 Leave — Submit Pengajuan Cuti

```
POST https://api.dingtalk.com/v1.0/attendance/approvals/create
x-acs-dingtalk-access-token: {token}
Content-Type: application/json

{
  "originatorUserId": "user_id",
  "formComponentValues": [
    { "name": "请假类型", "value": "年假" },
    { "name": "开始时间", "value": "2026-05-10 09:00" },
    { "name": "结束时间", "value": "2026-05-12 18:00" },
    { "name": "请假事由", "value": "Keperluan keluarga" }
  ]
}

Response:
{
  "processInstanceId": "process_id_string"
}
```

### 6.5 Leave — Query Status

```
POST https://api.dingtalk.com/v1.0/attendance/approvals/{processInstanceId}
x-acs-dingtalk-access-token: {token}
```

### 6.6 Rate Limits Summary

| API | Limit |
|-----|-------|
| Access Token | 2000 request/hari per app |
| Attendance Read | ~40 request/detik |
| Attendance Write | ~20 request/detik |
| Batch User IDs | Maksimal 50 per request |
| Rentang query absensi | 7 hari per request |
| Rentang query laporan | 30 hari per request |

---

## 7. Implementasi per Fase

### Fase 1 — Foundation & Auth

**File:** `src/lib/dingtalk/client.ts`

```typescript
// HTTP client dengan:
// - Base URL: https://api.dingtalk.com
// - Auto-attach access token header
// - Error handling (timeout, rate limit, auth error)
// - Retry logic dengan exponential backoff
```

**File:** `src/lib/dingtalk/auth.ts`

```typescript
// Token management:
// - getAccessToken() — fetch baru jika expired
// - Cache di memory (token expire 7200 detik)
// - Refresh 5 menit sebelum expire
// - Graceful degradation jika DingTalk down
```

**Env variables baru:**

```env
DINGTALK_APP_KEY=your_app_key
DINGTALK_APP_SECRET=your_app_secret
DINGTALK_BASE_URL=https://api.dingtalk.com
```

**File:** `src/lib/env.ts` — tambah validasi env vars DingTalk.

---

### Fase 2 — Database & Schema

**File:** `src/server/db/schema.ts` — tambah tabel:

- `absensiKaryawan` (Drizzle pgTable)
- `pengajuanCuti` (Drizzle pgTable)
- `dingtalkConfig` (Drizzle pgTable)
- Kolom `dingtalkUserId` di tabel `users`

**File:** `src/lib/validators/dingtalk.schema.ts` — Zod schemas:

- `absensiSyncSchema` — validasi parameter sync
- `pengajuanCutiCreateSchema` — validasi form cuti
- `pengajuanCutiUpdateSchema` — validasi update cuti
- `dingtalkConfigSchema` — validasi konfigurasi

**Drizzle migration:** Generate dan apply migration.

---

### Fase 3 — API Wrapper

**File:** `src/lib/dingtalk/attendance.ts`

```typescript
// Fungsi:
// - getAttendanceRecords(userIds, dateFrom, dateTo)
//   → batch per 50 user, per 7 hari
//   → return normalized records
// - getAttendanceReport(userIds, startDate, endDate)
//   → return report data
// - parseAttendanceStatus(record)
//   → map DingTalk status ke status lokal
```

**File:** `src/lib/dingtalk/leave.ts`

```typescript
// Fungsi:
// - submitLeaveRequest(userId, formData)
//   → POST ke DingTalk approval API
//   → return processInstanceId
// - getLeaveStatus(processInstanceId)
//   → query status approval
// - getLeaveRecords(userIds, dateFrom, dateTo)
//   → pull data cuti yang sudah ada
```

---

### Fase 4 — Server Actions

**File:** `src/server/actions/dingtalk/sync-attendance.ts`

```typescript
// Server Actions:
// - syncAbsensiDariDingTalk(tanggalMulai, tanggalSelesai)
//   1. Ambil semua user dengan dingtalk_user_id
//   2. Batch request ke DingTalk (50 user per batch)
//   3. Transform response ke format lokal
//   4. Upsert ke tabel absensi_karyawan
//   5. Return summary (berhasil, gagal, duplikat)
//
// - syncAbsensiPerUser(userId, tanggalMulai, tanggalSelesai)
//   → Sync untuk satu user saja
```

**File:** `src/server/actions/dingtalk/submit-leave.ts`

```typescript
// Server Actions:
// - ajukanCutiKeDingTalk(pengajuanCutiId)
//   1. Ambil data pengajuan_cuti dari DB
//   2. Map ke format DingTalk approval
//   3. POST ke DingTalk API
//   4. Update record dengan dingtalk_process_id
//   5. Update status ke 'diajukan'
//
// - updateStatusCutiDariDingTalk(pengajuanCutiId)
//   1. Query status dari DingTalk
//   2. Update status lokal (disetujui/ditolak)
```

**File:** `src/server/actions/dingtalk/config.ts`

```typescript
// Server Actions:
// - getDingtalkConfig() — ambil konfigurasi
// - updateDingtalkConfig(data) — update kredensial
// - testDingtalkConnection() — test API connectivity
// - getDingtalkSyncStatus() — status sync terakhir
```

---

### Fase 5 — UI Pages

**Halaman Absensi** (`src/app/(dashboard)/absensi/page.tsx`)

| Komponen | Fungsi |
|----------|--------|
| `AbsensiManager` | Tabel utama dengan filter tanggal, user, status |
| `AbsensiCalendar` | View kalender kehadiran per bulan |
| `AbsensiStats` | Statistik (hadir, terlambat, alpha, cuti) |
| Sync Button | Trigger manual sync dari DingTalk |
| Export | Export CSV/Excel rekap absensi |

**Halaman Cuti** (`src/app/(dashboard)/cuti/page.tsx`)

| Komponen | Fungsi |
|----------|--------|
| `CutiManager` | Tabel pengajuan cuti dengan filter status |
| `CutiForm` | Form pengajuan cuti baru (jenis, tanggal, alasan) |
| `CutiApproval` | Approval workflow untuk pejabat |
| Status Badge | Visual status: draft, diajukan, disetujui, ditolak |

**Sidebar Navigation:**

Tambah menu baru di sidebar:
- `Absensi Karyawan` (icon: `Clock`) — akses: semua role
- `Pengajuan Cuti` (icon: `CalendarOff`) — akses: semua role (submit), pejabat/admin (approval)

**Halaman Pengaturan — Tab DingTalk:**

| Field | Tipe | Keterangan |
|-------|------|------------|
| App Key | Input text | Kredensial DingTalk |
| App Secret | Input password | Kredensial DingTalk |
| Status Koneksi | Badge | Connected / Disconnected |
| Test Connection | Button | Tes API connectivity |
| Sync Interval | Number input | Interval auto-sync (menit) |
| Last Sync | Info | Timestamp + status sync terakhir |
| Mapping Pegawai | Table | User ARKA ↔ DingTalk User ID |

---

## 8. Mapping Pegawai ARKA ↔ DingTalk

### 8.1 Opsi Mapping

| Opsi | Metode | Keterangan |
|------|--------|------------|
| **Manual** | Admin input `dingtalk_user_id` per pegawai | Paling sederhana, cocok untuk awal |
| **By Email** | Match email ARKA = email DingTalk | Otomatis, perlu konsistensi email |
| **By Phone** | Match nomor telepon | Alternatif jika email beda |

### 8.2 Rekomendasi

Gunakan **kombinasi manual + by email**:

1. Tambah kolom `dingtalk_user_id` di tabel `users`
2. Di halaman Pengaturan > DingTalk, tampilkan tabel mapping
3. Fitur "Auto Match" — cari match berdasarkan email
4. Admin bisa override manual jika tidak match

---

## 9. Error Handling & Edge Cases

### 9.1 Error Scenarios

| Scenario | Penanganan |
|----------|------------|
| DingTalk API down | Graceful degradation, tampilkan data lokal |
| Token expired | Auto-refresh sebelum request |
| Rate limit (429) | Exponential backoff, retry maksimal 3x |
| User tidak punya DingTalk ID | Skip user, log warning |
| Data duplikat | Upsert berdasarkan unique constraint |
| Network timeout | Retry dengan timeout 30 detik |

### 9.2 Logging

Semua operasi sync dicatat di `audit_log`:
- `dingtalk_sync_started` — sync dimulai
- `dingtalk_sync_completed` — sync selesai (dengan summary)
- `dingtalk_sync_failed` — sync gagal (dengan error detail)
- `dingtalk_leave_submitted` — pengajuan cuti terkirim
- `dingtalk_leave_status_updated` — status cuti berubah

---

## 10. Testing Strategy

### 10.1 Unit Tests

- Token caching & refresh logic
- Response parsing & normalization
- Date range batching (7 hari per request)
- User ID batch splitting (50 per batch)

### 10.2 Integration Tests

- Mock DingTalk API responses
- Sync flow end-to-end
- Leave submission flow
- Error handling (timeout, rate limit, invalid token)

### 10.3 Manual Testing

- Test connection di halaman Pengaturan
- Sync absensi untuk 1 user
- Sync absensi untuk range tanggal
- Submit cuti dari form ARKA
- Verify data tersimpan di database

---

## 11. Checklist Implementasi

### Fase 1 — Foundation
- [ ] Tambah env vars DingTalk di `.env.example`
- [ ] Update `src/lib/env.ts` dengan validasi DingTalk
- [ ] Buat `src/lib/dingtalk/client.ts`
- [ ] Buat `src/lib/dingtalk/auth.ts`

### Fase 2 — Database
- [ ] Tambah `dingtalkUserId` di schema `users`
- [ ] Buat schema `absensiKaryawan`
- [ ] Buat schema `pengajuanCuti`
- [ ] Buat schema `dingtalkConfig`
- [ ] Generate & apply Drizzle migration
- [ ] Buat Zod validators

### Fase 3 — API Wrapper
- [x] Buat `src/lib/dingtalk/attendance.ts`
- [x] Buat `src/lib/dingtalk/leave.ts`

### Fase 4 — Server Actions
- [x] Buat `src/server/actions/dingtalk/sync-attendance.ts`
- [x] Buat `src/server/actions/dingtalk/sync-leave.ts`
- [x] Buat `src/server/actions/dingtalk/submit-leave.ts`
- [x] Buat `src/server/actions/dingtalk/config.ts`
- [x] Tambah audit logging

### Fase 5 — UI
- [x] Tambah sidebar menu Absensi & Cuti
- [x] Buat halaman Absensi (manager, calendar, stats)
- [x] Buat halaman Cuti (manager, form, approval)
- [x] Buat tab DingTalk di Pengaturan
- [x] Buat fitur mapping pegawai (via `getDingtalkUserMappings` / `updateDingtalkUserMapping`)
- [ ] Tambah notification types baru (cuti disetujui/ditolak)

### Fase 6 — Testing & Polish
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing end-to-end
- [ ] Error handling review
- [ ] Documentation update

---

## 12. Referensi

| Resource | URL |
|----------|-----|
| DingTalk Open Platform | https://open-dev.dingtalk.com/ |
| Attendance API Docs | https://open.dingtalk.com/document/orgapp/attendance-overview |
| Leave API Docs | https://open.dingtalk.com/document/orgapp/leave-overview |
| Access Token | https://open.dingtalk.com/document/orgapp/obtain-orgapp-token |
| Rate Limiting | https://open.dingtalk.com/document/orgapp/how-to-process-api-throttling |
| DingTalk Node.js SDK | https://github.com/nicoly/dingtalk-api |
