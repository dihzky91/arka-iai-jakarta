# Blueprint Adopsi Fitur RisersCRM ke Manajemen Surat

## Status Implementasi Terkini (28 April 2026)

Ringkasan progres setelah eksekusi Fase 0:

| Fase | Status |
|------|--------|
| Fase 0 - Fondasi Akses | Selesai secara implementasi codebase |
| Fase 1 - Announcement | Selesai (MVP + enhancement) |
| Fase 2 - Invitation Lifecycle | Selesai secara implementasi codebase |
| Fase 3 - Dashboard Preference | Dipindah ke `docs/planned/DASHBOARD_PREFERENCE_PROJECT_CENTRIC.md` |
| Fase 4 - Menu Dinamis + Extension | Selesai (capability-based nav live) |

Fase 0 yang sudah live:

- Tabel `roles` dan `role_capabilities`.
- Kolom `is_super_admin` dan `role_id` di `users`.
- Kolom `role_id` di `user_invitations`.
- Registry capability statis di `src/lib/rbac/capabilities.ts`.
- Guard `requireCapability` dan `requirePermission` berbasis capability DB.
- Backward compatibility lewat `users.role` lama dan fallback `PERMISSION_MATRIX` selama transisi data.
- Super admin melewati semua capability check.
- UI `Pengaturan > Role` untuk CRUD role dan assign capability.
- UI `Pengaturan > Manajemen User` untuk invite user dengan dynamic role, edit role/divisi, dan super admin flag.
- Sidebar mulai difilter menggunakan capability (`requiredCapability`) dengan fallback role lama.
- Migration `0024_dynamic_roles.sql` untuk seed role sistem (`staff`, `pejabat`, `viewer`), seed capability, dan backfill user lama.

Catatan transisi:

- `users.role` masih dipertahankan sebagai compatibility field untuk Better Auth session dan beberapa UI lama.
- Status akun tetap memakai `isActive` + `activatedAt`; belum diubah menjadi enum 3-state agar tidak membuat breaking migration pada flow login existing.

---

### Detail Fase 4 — Selesai

Yang sudah live:

- `navigation.ts` — semua nav item punya `requiredCapability`.
- `Sidebar` — filter `capabilitySet.has(requiredCapability)`, super admin bypass semua.
- `DashboardShell` — terima `userCapabilities[]` + `isSuperAdmin` dari layout.
- `layout.tsx` — fetch `getCurrentUserAccess()` tiap request, capabilities di-pass ke shell.
- Fallback hybrid: item tanpa `requiredCapability` fallback ke `allowedRoles` selama transisi.

Yang di-defer (tidak diimplementasi, dianggap tidak perlu saat ini):

- Extension registry (`registerNavItem`, `registerDashboardWidget`, event hooks) — defer karena tidak ada rencana modul plugin eksternal.

---

### Hotfix pasca Fase 0

- `permissionToCapability` di `src/server/actions/auth.ts` diekspor sebagai non-async function di file `"use server"` → Next.js error 500 di semua halaman dashboard. Fix: hapus `export`, jadikan internal helper. (28 April 2026)

## Tujuan

Dokumen ini menjadi acuan implementasi bertahap fitur-fitur bernilai dari RisersCRM ke sistem `manajemen-surat` tanpa mengubah identitas UI/UX yang sudah berjalan.

Target utama:

1. Meningkatkan kontrol akses (security dan governance).
2. Memperkuat komunikasi internal (announcement).
3. Mematangkan manajemen anggota internal (team member lifecycle).
4. Menjaga maintainability saat sistem tumbuh (extension points).

---

## Prinsip UI/UX (Wajib Dipertahankan)

Semua implementasi baru harus mengikuti pola UI/UX existing:

1. Tetap memakai layout dashboard saat ini (`Sidebar`, `Header`, `PageWrapper`, `DashboardShell`).
2. Tetap memakai komponen UI existing (`src/components/ui/*`) dan style token yang sama.
3. Tidak membuat visual language baru (warna, spacing, radius, hierarchy tetap konsisten).
4. Interaksi tetap mengikuti pola sekarang:
   - `Card` untuk blok konten
   - `Table/DataTable` untuk listing
   - `Dialog` untuk aksi CRUD
   - `Tabs` untuk detail halaman kompleks
   - `Badge` untuk status
5. Mobile responsiveness wajib mengikuti standar yang sudah ada di halaman dashboard/modul aktif.

Catatan: fokus blueprint ini adalah peningkatan kapabilitas backend + product flow, bukan redesign UI.

---

## Hierarki Akses

Sistem menggunakan dua layer akses yang berbeda:

### Layer 1 — Super Admin

- `is_super_admin = true` di tabel `users`.
- Full access ke seluruh sistem, semua capability check dilewati.
- Hanya super admin lain yang bisa assign/revoke status super admin.
- Super admin tidak bisa revoke diri sendiri jika tidak ada super admin lain.
- Ini adalah `admin` yang sudah ada saat ini — hanya berganti istilah internal.

### Layer 2 — Dynamic Role

- Semua user non-super-admin punya `role_id` yang menunjuk ke tabel `roles`.
- Role dibuat dan dikelola oleh super admin (CRUD bebas).
- Setiap role punya set capability yang di-assign.
- Guard di server action cek capability, bukan nama role — sehingga nama role bisa berubah tanpa merusak logika.

---

## Ruang Lingkup Prioritas

### Prioritas 1 (Impact Tinggi, Risiko Rendah-Menengah)

1. Fondasi akses: dynamic roles + capability guard + divisi.
2. Modul Announcement (targeting by role/divisi + read/unread).
3. Invitation flow untuk team member.

### Prioritas 2 (Impact Tinggi, Risiko Menengah)

1. Dashboard preference per user.
2. Menu dinamis berbasis capability.

### Prioritas 3 (Impact Menengah-Tinggi, Risiko Menengah-Tinggi)

1. Extension points internal (registry/hook ringan).
2. Fondasi modular rollout (feature flag + migration discipline).

### Prioritas 4 (Opsional Strategis, Effort Besar)

1. Paket project management lanjutan (kanban/gantt/timesheet/dependency, dll).

---

## Blueprint Fase Implementasi

## Fase 0 — Fondasi Akses (Prerequisite Semua Fase)

Fase ini wajib selesai sebelum fase lain dimulai karena hampir semua fitur bergantung pada role, capability, dan divisi.

### Deliverable

#### 0.1 — Tabel Fondasi

Buat tiga tabel baru:

```
divisi
  id, nama, kode, created_at

roles
  id, nama, kode, is_system (bool), created_by, created_at
  -- is_system = true: tidak bisa dihapus (seed data)
  -- Seed: staff, pejabat, viewer

role_capabilities
  role_id → FK roles
  capability (enum, statis di kode)
```

Tambah kolom ke `users`:

```
users
  + is_super_admin (bool, default false)
  + role_id (FK ke roles, nullable untuk super admin)
  + divisi_id (FK ke divisi, nullable)
```

#### 0.2 — Capability Enum (Statis di Kode)

```ts
const CAPABILITIES = [
  // surat-masuk
  "surat_masuk:view",
  "surat_masuk:create",
  "surat_masuk:edit",
  "surat_masuk:delete",
  // surat-keluar
  "surat_keluar:view",
  "surat_keluar:create",
  "surat_keluar:edit",
  "surat_keluar:delete",
  // disposisi
  "disposisi:view",
  "disposisi:create",
  "disposisi:sign",
  // pegawai
  "pegawai:view",
  "pegawai:manage",
  // pejabat
  "pejabat:view",
  "pejabat:manage",
  // sertifikat
  "sertifikat:view",
  "sertifikat:manage",
  // jadwal-ujian
  "jadwal_ujian:view",
  "jadwal_ujian:manage",
  // pengaturan
  "settings:view",
  "settings:manage",
  // roles & divisi
  "roles:manage",
  "divisi:manage",
  // announcement
  "announcement:view",
  "announcement:create",
  "announcement:manage",
  // users
  "users:invite",
  "users:manage",
] as const

type Capability = typeof CAPABILITIES[number]
```

#### 0.3 — Guard Functions

```ts
// Super admin lewati semua check
// User biasa cek capability via role
requireCapability(user, "surat_masuk:create")

// Backward-compatible, tetap ada selama transisi
requireRole("pejabat")
```

#### 0.4 — UI Manajemen Role & Divisi (Super Admin Only)

1. Halaman manajemen `Divisi` — CRUD nama/kode divisi.
2. Halaman manajemen `Role` — CRUD role + assign capabilities per role via checkbox matrix.
3. Integrasi ke modul `Pengaturan` existing.

#### 0.5 — Audit Semua Server Action

Semua endpoint sensitif memakai `requireCapability` di atas `requireRole`.

### Dampak UI

Perubahan hanya pada visibilitas menu/tombol berdasarkan capability user. Tidak ada perubahan visual besar.

### Kriteria Selesai

1. Super admin bisa CRUD role dan assign capabilities.
2. Super admin bisa CRUD divisi.
3. User bisa diberi role + divisi saat invite atau via edit profil.
4. Guard capability berjalan di semua modul existing.
5. Tidak ada regresi pada akses user existing.

---

## Fase 1 — Modul Announcement Internal

Bergantung pada Fase 0 karena targeting menggunakan role dan divisi dari database.

### Fitur Utama

1. CRUD announcement.
2. Active window (`startDate`, `endDate`).
3. Audience targeting:
   - Semua user internal (`all`)
   - Role tertentu (`role:{role_id}`)
   - Divisi tertentu (`divisi:{divisi_id}`)
4. Attachment opsional.
5. Read/unread tracking per user (tabel terpisah, bukan comma-separated).
6. Counter unread di header/notifikasi.

Catatan: RisersCRM menyimpan read tracking sebagai comma-separated di kolom `read_by` (FIND_IN_SET). Implementasi ini menggunakan tabel terpisah `announcement_reads` — lebih proper untuk PostgreSQL dan query yang lebih efisien.

Catatan targeting: RisersCRM aslinya target by user type (staff/client) dan client group. Targeting by role/divisi adalah enhancement yang lebih relevan untuk konteks internal organisasi manajemen-surat.

### Desain UI/UX

1. Halaman baru di dashboard: `Pengumuman`.
2. Daftar announcement menggunakan tabel + badge status aktif/nonaktif.
3. Detail announcement dengan tampilan card dan metadata publish.
4. Composer announcement memakai dialog/form pattern yang sudah dipakai modul lain.
5. Dropdown target audience di form composer menampilkan daftar role + divisi dari database.

### Kriteria Selesai

1. Pengumuman tampil sesuai audience targeting (role/divisi/all).
2. User bisa menandai terbaca otomatis saat membuka detail.
3. Unread count sinkron di UI.

---

## Fase 2 — Team Member Invitation & Lifecycle

### Fitur Utama

1. Invite user via email (token + expiry 24 jam).
2. Form invite: pilih email, role (dari tabel `roles`), divisi (dari tabel `divisi`).
3. Aktivasi akun awal lewat set password.
4. Status akun (`active`/`inactive`) yang dapat dikontrol super admin.
5. Guard agar non-super-admin tidak bisa eskalasi privilege.
6. Resend invite untuk token kadaluarsa.

Catatan: RisersCRM menggunakan tabel `verification` dengan `type="invitation"` untuk membedakan invite dari reset password. Pola ini diadopsi — satu tabel untuk semua token verification dengan type berbeda.

### Desain UI/UX

1. Integrasi ke modul `Pengaturan` > `Manajemen User`.
2. Gunakan komponen existing:
   - Dialog untuk form invite (email + role + divisi).
   - Table untuk daftar akun + status badge.
   - Badge status akun (`active`/`inactive`/`pending`).

### Kriteria Selesai

1. Alur undang → aktivasi → login berjalan end-to-end.
2. Token kadaluarsa ditolak dengan pesan yang jelas.
3. Role/capability escalation terlindungi.
4. Super admin bisa resend invite.

---

## Fase 3 — Dashboard Preference Per User

> **⚠️ DIPINDAHKAN**: Fase ini telah diperluas dan dipindahkan ke dokumen terpisah:  
> **`docs/planned/DASHBOARD_PREFERENCE_PROJECT_CENTRIC.md`**  
> 
> Dokumen baru mencakup:
> - Dashboard Preference (show/hide, reorder widget) — scope asli Fase 3
> - Project-Centric Default View untuk staff (terinspirasi Rise CRM)
> - Role-based dashboard preset (admin bisa set default per role)
> - Logika penentuan default view berdasarkan capability
>
> Lihat dokumen tersebut untuk detail implementasi lengkap.

---

## Fase 4 — Menu Dinamis + Extension Points Internal

### Fitur Utama

1. Menu berbasis capability: item menu tampil/sembunyi sesuai capability user (bukan hardcode role).
2. Extension points internal — adopsi pola hook RisersCRM (WordPress-style):
   - `registerNavItem` — tambah item sidebar
   - `registerDashboardWidget` — tambah widget dashboard
   - `onDataInsert` / `onDataUpdate` — event listener post-action
3. Nav tetap hybrid: base nav dari kode + filter extensibility untuk modul tambahan.

Catatan: RisersCRM menggunakan nav hardcoded di `Left_menu.php` + plugin bisa extend via `app_filter_staff_left_menu` filter. Ini bukan full registry — ini hybrid. Implementasi di sini mengikuti pola yang sama, bukan full dynamic registry.

### Desain UI/UX

Output tetap memakai sidebar/header existing. Perubahan di arsitektur, bukan tampilan.

### Kriteria Selesai

1. Menu tampil/sembunyi sesuai capability user secara otomatis.
2. Modul baru dapat "plug in" ke menu/widget tanpa edit hardcoded panjang.
3. Tidak ada perubahan visual yang mengganggu pengguna aktif.

---

## Desain Data Tingkat Tinggi

### Tabel Baru

```
divisi
  id, nama, kode, created_at

roles
  id, nama, kode, is_system, created_by, created_at

role_capabilities
  role_id, capability

user_invitations
  id, email, role_id, divisi_id, token, expired_at, used_at, invited_by

announcements
  id, title, content, start_date, end_date, attachment_url
  created_by, created_at, deleted

announcement_targets
  announcement_id, target_type ("all"|"role"|"divisi"), target_id (nullable)

announcement_reads
  announcement_id, user_id, read_at

user_dashboard_preferences
  user_id, widget_key, visible, sort_order

feature_flags (opsional — tidak ada di RisersCRM, ini addition)
  key, enabled, description
```

### Kolom Tambahan ke Tabel Existing

```
users
  + is_super_admin (bool)
  + role_id (FK roles, nullable)
  + divisi_id (FK divisi, nullable)
  + status ("active"|"inactive"|"pending")
```

Catatan: Semua implementasi mengikuti standar schema saat ini (Drizzle + PostgreSQL). Soft delete mengikuti pola existing (`deletedAt` timestamp atau `deleted` bool — sesuaikan dengan konvensi yang sudah ada di codebase).

---

## Strategi Rollout

1. Fase 0 wajib selesai 100% sebelum fase lain dimulai.
2. Gunakan feature flag per fase setelah Fase 0 agar rollout aman.
3. Rilis bertahap per modul (jangan big-bang).
4. Tambah audit log untuk aksi admin penting:
   - Buat/ubah/hapus role
   - Buat/ubah divisi
   - Publish announcement
   - Invite user
   - Aktivasi/nonaktifkan akun
   - Ubah capability role

---

## Risiko dan Mitigasi

1. Risiko regresi akses saat migrasi ke dynamic role.
   - Mitigasi: jalankan parallel guard (`requireRole` + `requireCapability`) selama transisi, hapus `requireRole` setelah semua termigrasi.
2. Risiko kompleksitas capability membesar.
   - Mitigasi: capability naming convention `{modul}:{action}` + dokumentasi matrix.
3. Risiko mismatch UI behavior.
   - Mitigasi: semua halaman baru wajib reuse komponen/pola existing.
4. Risiko deliverability email invite.
   - Mitigasi: fallback resend invite + log pengiriman.
5. Risiko super admin terkunci (tidak ada super admin aktif).
   - Mitigasi: sistem cegah revoke status super admin terakhir yang aktif.

---

## Definition of Done Global

1. Seluruh fitur baru lolos typecheck dan test kritikal.
2. Tidak ada breaking UX terhadap user aktif.
3. Semua guard akses terdokumentasi.
4. Ada panduan operasional singkat untuk super admin internal.

---

## Rekomendasi Eksekusi

Urutan implementasi yang disarankan:

1. Fase 0 (fondasi: divisi + dynamic roles + capability guard) — **prerequisite mutlak**
2. Fase 2 (invitation lifecycle — butuh role + divisi sudah ada)
3. Fase 1 (announcement — butuh role + divisi di user untuk targeting)
4. Fase 3 (dashboard preference)
5. Fase 4 (registry + extension points)

Dengan urutan ini, kita dapat value cepat tanpa mengorbankan konsistensi UI/UX sistem saat ini.
