# Production Hardening Plan

> Dokumen ini merangkum 4 poin perbaikan keamanan & reliability yang harus diselesaikan sebelum melanjutkan development fitur baru.

**Status:** � Poin 1 & 2 selesai  
**Prioritas:** Tinggi — blocking production readiness  
**Estimasi total:** 2–3 hari kerja

---

## Daftar Perbaikan

| # | Poin | Risiko | Effort | Status |
|---|------|--------|--------|--------|
| 1 | RBAC Audit — permission guard consistency | Unauthorized access | ~4 jam | ✅ Selesai |
| 2 | Storage Production Safety | Data loss di serverless | ~2 jam | ✅ Selesai |
| 3 | Transaction Consistency | Data orphan / inkonsisten | ~4 jam | ✅ Selesai |
| 4 | Rate Limiting Auth & Upload | Brute force, abuse | ~4 jam | ✅ Selesai |

---

## 1. RBAC Audit — Permission Guard Consistency

### Masalah

Beberapa server action tidak menggunakan permission guard yang memadai:

- `src/server/actions/notifications.ts` — fungsi `createNotification`, `markNotificationAsRead`, `deleteNotification` menerima `userId` langsung tanpa verifikasi bahwa caller = owner.
- Beberapa query read-only hanya pakai `requireSession()` tanpa cek apakah user berhak melihat data tersebut (contoh: `getPegawaiById` bisa diakses siapa saja yang login).

### Rencana

1. **Audit semua file di `src/server/actions/`** — buat checklist:
   - [ ] Setiap fungsi mutasi (create/update/delete) WAJIB pakai `requirePermission()` atau `requireCapability()`
   - [ ] Setiap fungsi read yang mengandung data sensitif pegawai lain harus cek scope (self vs admin)

2. **Fix `notifications.ts`:**
   - `markNotificationAsRead` dan `deleteNotification` harus verifikasi `session.user.id === notification.userId`
   - `createNotification` tetap internal-only, tapi tambahkan JSDoc `@internal` dan pastikan tidak di-export ke client

3. **Fix read actions yang terlalu terbuka:**
   - `getPegawaiById`: tambah logic — staff hanya bisa lihat data sendiri, admin/pejabat bisa lihat semua
   - Pattern: buat helper `requireSelfOrPermission(userId, module, action)`

4. **Tambah lint rule (opsional):**
   - ESLint custom rule atau comment convention yang menandai setiap server action sudah di-audit

### File yang perlu diubah

```
src/server/actions/notifications.ts
src/server/actions/pegawai.ts (getPegawaiById, listKeluarga, dll)
src/server/actions/auth.ts (tambah helper requireSelfOrPermission)
```

### Definition of Done

- [x] Semua server action mutasi sudah pakai permission guard
- [x] Notification actions verifikasi ownership (session-based, bukan userId param)
- [x] Read actions sensitif punya scope check (pegawai sub-entity, statistics, search, calendar)
- [x] `backfillCalendarEvents()` dilindungi `requirePermission("pengaturan", "manage")`
- [x] `listDisposisiTimeline()` dilindungi `requirePermission("disposisi", "view")`
- [x] `statistics.ts` semua fungsi dilindungi `requireSession()`
- [x] `search.ts` semua fungsi dilindungi `requireSession()`

---

## 2. Storage Production Safety

### Masalah

- `env.STORAGE_PROVIDER` default ke `"local"` kalau env kosong
- Di serverless/ephemeral (Vercel, AWS Lambda), local storage = file hilang setiap cold start
- `HostedStorageProvider` belum diimplementasi (langsung throw)

### Rencana

1. **Tambah validasi di `src/lib/storage/index.ts`:**
   ```typescript
   // Di production, WAJIB pakai provider non-local
   if (process.env.NODE_ENV === "production" && kind === "local") {
     throw new Error(
       "STORAGE_PROVIDER tidak boleh 'local' di production. " +
       "Set STORAGE_PROVIDER=cloudinary atau provider lain."
     );
   }
   ```

2. **Tambah env validation di `src/lib/env.ts`:**
   ```typescript
   // Untuk production, paksa critical env vars
   if (process.env.NODE_ENV === "production") {
     if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL wajib di production");
     if (!process.env.BETTER_AUTH_SECRET) throw new Error("BETTER_AUTH_SECRET wajib di production");
     if (!process.env.BETTER_AUTH_URL) throw new Error("BETTER_AUTH_URL wajib di production");
     if (!process.env.STORAGE_PROVIDER || process.env.STORAGE_PROVIDER === "local") {
       throw new Error("STORAGE_PROVIDER wajib non-local di production");
     }
   }
   ```

3. **Hapus atau implementasi `HostedStorageProvider`:**
   - Jika tidak akan dipakai → hapus dari kode, jangan biarkan dead code yang throw
   - Jika akan dipakai → implementasi atau ganti dengan provider yang jelas (S3, R2, dll)

### File yang perlu diubah

```
src/lib/env.ts
src/lib/storage/index.ts
src/lib/storage/providers/hosted.ts (hapus atau implementasi)
```

### Definition of Done

- [x] App crash saat start di production tanpa env kritis (DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL)
- [x] Storage provider local ditolak di production (throw error eksplisit)
- [x] Provider tidak dikenali ditolak di production
- [ ] Hapus atau implementasi `HostedStorageProvider` (low priority — sudah throw error yang jelas)

---

## 3. Transaction Consistency

### Masalah

Operasi multi-step yang melibatkan beberapa INSERT/DELETE/UPDATE tidak dibungkus dalam database transaction. Jika gagal di tengah jalan, data jadi inkonsisten.

**Kasus kritis:**

| Fungsi | Operasi | Risiko |
|--------|---------|--------|
| `deletePegawai` | 8+ DELETE berurutan | Gagal di tengah = orphan records |
| `createPegawai` (legacy) | INSERT user + INSERT account + send email | User tanpa account, atau account tanpa user |
| `inviteUser` | INSERT invitation + INSERT user + INSERT account | Partial records |

### Rencana

1. **Wrap `deletePegawai` dalam transaction:**
   ```typescript
   await db.transaction(async (tx) => {
     await tx.delete(pegawaiKeluarga).where(...);
     await tx.delete(pegawaiPendidikan).where(...);
     await tx.delete(pegawaiRiwayatPekerjaan).where(...);
     await tx.delete(pegawaiBiodata).where(...);
     await tx.delete(pegawaiKelengkapan).where(...);
     await tx.delete(pegawaiKesehatan).where(...);
     await tx.delete(pegawaiPernyataanIntegritas).where(...);
     await tx.delete(account).where(...);
     await tx.delete(userInvitations).where(...);
     await tx.delete(users).where(...);
   });
   // Audit log SETELAH transaction sukses (di luar tx)
   ```

2. **Wrap `createPegawai` legacy flow:**
   ```typescript
   const row = await db.transaction(async (tx) => {
     const [user] = await tx.insert(users).values({...}).returning();
     await tx.insert(account).values({...});
     return user;
   });
   // Email dikirim SETELAH transaction sukses (side effect di luar tx)
   ```

3. **Wrap `inviteUser`:**
   ```typescript
   const result = await db.transaction(async (tx) => {
     const [invitation] = await tx.insert(userInvitations).values({...}).returning();
     const [user] = await tx.insert(users).values({...}).returning();
     await tx.insert(account).values({...});
     return { invitation, user };
   });
   // Email di luar transaction
   ```

4. **Prinsip umum:**
   - Side effects (email, revalidatePath, audit log) SELALU di luar transaction
   - Semua DB writes dalam satu logical operation WAJIB dalam satu transaction
   - Buat helper jika perlu: `withTransaction(fn)` yang handle error logging

### File yang perlu diubah

```
src/server/actions/pegawai.ts (deletePegawai, createPegawai)
src/server/actions/invitations.ts (inviteUser)
```

### Definition of Done

- [x] `deletePegawai` atomic — semua atau tidak sama sekali
- [x] `createPegawai` legacy flow atomic
- [x] `inviteUser` atomic
- [x] Side effects (email, audit) di luar transaction
- [x] Tidak ada operasi multi-step kritis lain yang terlewat pada target audit poin 3

---

## 4. Rate Limiting — Auth & Upload

### Masalah

- Login endpoint (Better Auth `/api/auth/[...all]`) tidak punya rate limit → brute force risk
- Reset password tidak punya rate limit → email bombing
- Upload tidak punya rate limit → storage abuse
- Rate limiter existing = in-memory only, reset setiap deploy

### Rencana

1. **Rate limit di proxy level untuk auth routes:**

   Tambah IP-based rate limiting di `src/proxy.ts`:
   ```typescript
   // Rate limit untuk /api/auth/sign-in dan /api/auth/forget-password
   const AUTH_RATE_LIMIT_ROUTES = [
     "/api/auth/sign-in/email",
     "/api/auth/forget-password",
   ];
   ```

   Implementasi in-memory bucket (sama seperti pattern di `/api/verifikasi`):
   - Login: max 10 attempts per IP per menit
   - Reset password: max 5 requests per IP per 5 menit

2. **Rate limit untuk upload di server action level:**

   Tambah policy baru di `src/lib/rate-limit/user-bucket.ts`:
   ```typescript
   export const RATE_LIMIT_POLICIES = {
     ...existing,
     file_upload: { limit: 30, windowMs: 60_000 },        // 30 upload/menit
     file_upload_heavy: { limit: 10, windowMs: 60_000 },  // 10 large file/menit
   };
   ```

   Apply di setiap server action yang handle upload (surat keluar, pegawai dokumen, dll).

3. **Catatan untuk production nanti:**
   - In-memory rate limiter cukup untuk single-instance deployment
   - Kalau scale ke multi-instance, migrate ke Redis-backed (sudah ada comment di code)
   - Vercel/serverless: pertimbangkan Vercel KV atau Upstash Redis

4. **Tambah rate limit di Better Auth config (jika supported):**
   - Cek apakah Better Auth punya plugin rate limiting
   - Jika tidak, handle di proxy level (poin 1)

### File yang perlu diubah

```
src/app/api/auth/[...all]/route.ts (tambah auth rate limiting)
src/lib/rate-limit/user-bucket.ts (tambah policies)
src/lib/rate-limit/ip-bucket.ts (auth IP policies)
src/lib/rate-limit/upload-guard.ts (upload guard helper)
src/server/actions/suratKeluar.ts (apply upload rate limit)
src/server/actions/suratMasuk.ts, suratKeputusan.ts, suratMou.ts (apply upload rate limit)
src/server/actions/announcements.ts, project-content.ts, profile.ts, systemSettings.ts, systemConfig.ts
src/server/actions/jadwal-otomatis/honorarium.ts
src/server/actions/sertifikat/ (sudah ada, review coverage)
```

### Definition of Done

- [x] Login dibatasi 10 attempt/menit per IP
- [x] Reset password dibatasi 5 request/5 menit per IP
- [x] Upload dibatasi per user (30/menit)
- [x] Response 429 dengan pesan yang jelas untuk auth POST
- [x] Existing rate limit policies tidak terganggu

---

## Urutan Pengerjaan (Rekomendasi)

```
Hari 1:
  ├── Poin 2: Storage & Env Safety (2 jam) — paling cepat, impact tinggi
  └── Poin 3: Transaction Consistency (4 jam) — kritis untuk data integrity

Hari 2:
  ├── Poin 4: Rate Limiting (4 jam) — security layer
  └── Poin 1: RBAC Audit (4 jam) — paling teliti, butuh review per-file

Buffer: +1 hari untuk testing & edge cases
```

---

## Catatan

- Semua perubahan ini backward-compatible — tidak mengubah behavior yang sudah benar
- Tidak ada breaking change untuk frontend/UI
- Setelah 4 poin ini selesai, production readiness naik dari ~6.5 ke ~8/10
- Sisa gap ke 10/10: monitoring/alerting, backup strategy, load testing — tapi itu bisa paralel dengan development fitur
