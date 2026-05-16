# Rencana Implementasi Revamp Modul Administrasi

**Tanggal**: 2026-05-07
**Scope**: Modul Pegawai, Divisi, Pejabat, Invitations, System Settings, System Config, Nomor Surat
**Status**: ✅ Semua fase selesai (Fase 1, 2, 3)

---

## Ringkasan Eksekutif

Berdasarkan review menyeluruh terhadap modul-modul administrasi di codebase, ditemukan **9 temuan**:

- **3 kritis** — bug & keamanan yang perlu segera diperbaiki
- **3 penting** — gap arsitektur & konsistensi
- **3 opsional** — UX improvement

Implementasi dipecah menjadi **3 fase** berdasarkan prioritas dan dependency.

---

## Prinsip Implementasi

1. **Minimal upstream fix** — perbaiki di server action / schema, hindari workaround di UI.
2. **Backward-compatible** — tidak break data existing; gunakan default value untuk field baru.
3. **Audit-first untuk operasi destruktif** — semua state-mutating action kritis wajib menulis `auditLog`.
4. **Tidak hapus tes existing** — tambah regression test untuk setiap fix.
5. **Konsisten dengan pola yang sudah ada** — ikuti gaya `deleteKelasOtomatis` (validate-then-delete) dan `writeAuditLog` (`@d:\Test Coding APP\arka-iai-jakarta\src\server\lib\audit.ts`).
6. **Capability-based authorization** — gunakan `requirePermission` / `requireCapability`, bukan legacy role string check.

---

# FASE 1 — Kritis (Estimasi: 2–3 hari)

## 1.1 Fix `deletePegawai` — Orphan Account Row

**File**: `@d:\Test Coding APP\arka-iai-jakarta\src\server\actions\pegawai.ts:241-284`

### Masalah

```@d:\Test Coding APP\arka-iai-jakarta\src\server\actions\pegawai.ts:261-272
await db.delete(pegawaiKeluarga).where(eq(pegawaiKeluarga.userId, parsed.id));
await db.delete(pegawaiPendidikan).where(eq(pegawaiPendidikan.userId, parsed.id));
await db
  .delete(pegawaiRiwayatPekerjaan)
  .where(eq(pegawaiRiwayatPekerjaan.userId, parsed.id));
await db.delete(pegawaiBiodata).where(eq(pegawaiBiodata.userId, parsed.id));
await db.delete(pegawaiKelengkapan).where(eq(pegawaiKelengkapan.userId, parsed.id));
await db.delete(pegawaiKesehatan).where(eq(pegawaiKesehatan.userId, parsed.id));
await db
  .delete(pegawaiPernyataanIntegritas)
  .where(eq(pegawaiPernyataanIntegritas.userId, parsed.id));
await db.delete(users).where(eq(users.id, parsed.id));
```

- Row di tabel `account` (Better Auth) **tidak dihapus** saat pegawai di-delete.
- `account.userId` merujuk user yang sudah tidak ada → orphan data.
- Potensi FK violation atau akun "hantu" yang bisa dieksploitasi untuk login.
- Juga tidak menghapus `userInvitations` yang mungkin masih ada untuk email yang sama.

### Rencana

**Step 1.1.a** — Tambah penghapusan `account` dan `userInvitations` sebelum hapus `users`:

```ts
// Hapus auth account terkait
await db.delete(account).where(eq(account.userId, parsed.id));

// Hapus invitation records terkait email
await db.delete(userInvitations).where(eq(userInvitations.email, target.email));

// Baru kemudian hapus sub-entitas + users (existing code)
await db.delete(pegawaiKeluarga).where(eq(pegawaiKeluarga.userId, parsed.id));
// ... dst
await db.delete(users).where(eq(users.id, parsed.id));
```

**Step 1.1.b** — Tambah import `userInvitations` dari schema (sudah ada di `invitations.ts`, tinggal tambah di import `pegawai.ts`).

**Step 1.1.c** — Tambah test kasus:
- Delete pegawai → account row ikut terhapus
- Delete pegawai → userInvitations untuk email tersebut ikut terhapus
- Pegawai tanpa account → tetap bisa dihapus tanpa error

### Acceptance Criteria
- [ ] `deletePegawai` menghapus row di tabel `account`
- [ ] `deletePegawai` menghapus row di tabel `userInvitations`
- [ ] Tidak ada orphan `account` row setelah delete pegawai
- [ ] Audit log tetap tercatat

---

## 1.2 Proteksi Delete Pegawai — Cek Referensi Sebelum Hard Delete

**File**: `@d:\Test Coding APP\arka-iai-jakarta\src\server\actions\pegawai.ts:241-284`

### Masalah

`deletePegawai` langsung hard-delete semua sub-entitas tanpa memeriksa apakah pegawai masih terikat di entitas lain:
- **Pejabat Penandatangan**: `pejabatPenandatangan.userId` bisa merujuk pegawai yang dihapus
- **Surat Keluar**: `suratKeluar.pejabatId` → pejabat yang dihapus → surat kehilangan referensi penandatangan
- **Honorarium Items**: `honorariumItems.pengajarId` → pegawai yang dihapus → perhitungan honorarium rusak
- **Kelas Pelatihan**: peserta/pengajar yang terikat pegawai
- **Disposisi**: pegawai bisa jadi penerima disposisi

Ini mirip dengan masalah yang sudah di-fix di modul pelatihan (Fase 1.1 di `revamp-modul-program-pelatihan.md`).

### Rencana

**Step 1.2.a** — Tambah validasi pra-delete sebelum hard delete:

```ts
export async function deletePegawai(data: unknown) {
  const parsed = pegawaiDeleteSchema.parse(data);
  const session = await requirePermission("pegawai", "delete");

  if (session.user.id === parsed.id) {
    return { ok: false as const, error: "Akun yang sedang aktif tidak dapat dihapus." };
  }

  const [target] = await db
    .select({ id: users.id, namaLengkap: users.namaLengkap, email: users.email })
    .from(users)
    .where(eq(users.id, parsed.id));

  if (!target) {
    return { ok: false as const, error: "Pegawai tidak ditemukan." };
  }

  // ── Validasi referensi ──

  // 1. Cek pejabat penandatangan aktif
  const [activePejabat] = await db
    .select({ id: pejabatPenandatangan.id })
    .from(pejabatPenandatangan)
    .where(
      and(
        eq(pejabatPenandatangan.userId, parsed.id),
        eq(pejabatPenandatangan.isActive, true),
      ),
    )
    .limit(1);

  // 2. Cek honorarium items (pengajar)
  const [{ count: honorariumCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(honorariumItems)
    .where(eq(honorariumItems.pengajarId, parsed.id));

  // 3. Cek peserta kelas pelatihan aktif
  const [{ count: pesertaCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pesertaKelas)
    .where(eq(pesertaKelas.userId, parsed.id));

  if (activePejabat) {
    return {
      ok: false as const,
      error: "Pegawai masih tercatat sebagai pejabat penandatangan aktif. Nonaktifkan pejabat terlebih dahulu, atau gunakan Nonaktifkan Pegawai.",
    };
  }

  if (Number(honorariumCount) > 0) {
    return {
      ok: false as const,
      error: `Pegawai memiliki ${honorariumCount} record honorarium. Hapus permanen diblokir. Gunakan Nonaktifkan Pegawai.`,
    };
  }

  if (Number(pesertaCount) > 0) {
    return {
      ok: false as const,
      error: `Pegawai terdaftar sebagai peserta di ${pesertaCount} kelas pelatihan. Hapus permanen diblokir. Gunakan Nonaktifkan Pegawai.`,
    };
  }

  // ── Jika aman, lanjut hard delete ──
  // ... (existing delete code + fix dari 1.1)
}
```

**Step 1.2.b** — Tambah opsi soft-delete di UI: tombol "Nonaktifkan" yang set `isActive: false` (sudah ada `toggleUserStatus` di `invitations.ts`, tapi belum ada tombol di halaman pegawai). Tambahkan tombol "Nonaktifkan Pegawai" di dropdown action pegawai.

**Step 1.2.c** — Tambah test kasus:
- Delete pegawai tanpa referensi → sukses
- Delete pegawai dengan pejabat aktif → diblokir
- Delete pegawai dengan honorarium → diblokir
- Delete pegawai dengan peserta kelas → diblokir

### Acceptance Criteria
- [ ] Delete pegawai dengan referensi pejabat aktif menampilkan error spesifik
- [ ] Delete pegawai dengan honorarium menampilkan error spesifik
- [ ] Delete pegawai dengan peserta kelas menampilkan error spesifik
- [ ] Delete sukses (tanpa referensi) menulis audit log + menghapus account row
- [ ] UI menyediakan opsi "Nonaktifkan Pegawai" sebagai alternatif

---

## 1.3 Audit Log untuk Sub-entitas Pegawai

**File**: `@d:\Test Coding APP\arka-iai-jakarta\src\server\actions\pegawai.ts`

### Masalah

Fungsi CRUD untuk sub-entitas pegawai **tidak menulis `writeAuditLog`**:

| Fungsi | Audit Log? |
|---|---|
| `createKeluarga` | ❌ |
| `updateKeluarga` | ❌ |
| `deleteKeluarga` | ❌ |
| `createPendidikan` | ❌ |
| `updatePendidikan` | ❌ |
| `deletePendidikan` | ❌ |
| `createPekerjaan` | ❌ |
| `updatePekerjaan` | ❌ |
| `deletePekerjaan` | ❌ |
| `upsertKesehatan` | ❌ |
| `upsertIntegritas` | ❌ |
| `upsertKelengkapan` | ❌ |
| `upsertBiodata` | ❌ |

Ini berbeda dengan modul lain (divisi, pejabat, roles, pelatihan) yang sudah konsisten menulis audit log.

### Rencana

**Step 1.3.a** — Tambah `writeAuditLog` di setiap fungsi mutasi sub-entitas. Contoh pola:

```ts
export async function createKeluarga(data: unknown) {
  const parsed = keluargaCreateSchema.parse(data);
  const session = await requireSession();
  // ... authorization check ...

  const [row] = await db.insert(pegawaiKeluarga).values(parsed).returning();

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_PEGAWAI_KELUARGA",
    entitasType: "pegawai_keluarga",
    entitasId: String(row!.id),
    detail: { userId: parsed.userId, hubungan: parsed.hubungan, namaAnggota: parsed.namaAnggota },
  });

  revalidatePath("/pegawai");
  return { ok: true as const, data: row! };
}
```

**Step 1.3.b** — Gunakan konvensi aksi yang konsisten:
- `CREATE_PEGAWAI_KELUARGA`, `UPDATE_PEGAWAI_KELUARGA`, `DELETE_PEGAWAI_KELUARGA`
- `CREATE_PEGAWAI_PENDIDIKAN`, `UPDATE_PEGAWAI_PENDIDIKAN`, `DELETE_PEGAWAI_PENDIDIKAN`
- `CREATE_PEGAWAI_PEKERJAAN`, `UPDATE_PEGAWAI_PEKERJAAN`, `DELETE_PEGAWAI_PEKERJAAN`
- `UPSERT_PEGAWAI_KESEHATAN`, `UPSERT_PEGAWAI_INTEGRITAS`, `UPSERT_PEGAWAI_KELENGKAPAN`, `UPSERT_PEGAWAI_BIODATA`

**Step 1.3.c** — Untuk self-service (pegawai mengedit data sendiri), audit log tetap mencatat `userId` actor, sehingga bisa dibedakan antara edit oleh admin vs edit oleh pegawai sendiri.

### Acceptance Criteria
- [ ] Semua 13 fungsi mutasi sub-entitas pegawai menulis audit log
- [ ] Aksi konsisten dengan format `CREATE_/UPDATE_/DELETE_/UPSERT_PEGAWAI_{SUB_ENTITAS}`
- [ ] Audit log mencatat userId actor (bisa admin atau pegawai sendiri)

---

# FASE 2 — Penting (Estimasi: 3–4 hari)

## 2.1 Migrasi Legacy Role Check ke Capability-Based Authorization

**File**: `@d:\Test Coding APP\arka-iai-jakarta\src\server\actions\pegawai.ts`

### Masalah

Semua fungsi sub-entitas pegawai menggunakan pola legacy:

```@d:\Test Coding APP\arka-iai-jakarta\src\server\actions\pegawai.ts:302-303
const role = (session.user as { role?: string }).role;
if (role !== "admin" && session.user.id !== parsed.userId) throw new Error("Forbidden");
```

Masalah:
- **Hanya cek string `"admin"`** — super admin dengan `isSuperAdmin: true` tapi `role: "staff"` akan **ditolak**.
- **Tidak menggunakan RBAC capability** yang sudah dibangun (`requirePermission`, `requireCapability`).
- **`throw new Error("Forbidden")`** — error generik, tidak informatif.
- **Tidak konsisten** dengan modul lain yang sudah pakai `requirePermission`.

Pola ini muncul di: `createKeluarga`, `updateKeluarga`, `deleteKeluarga`, `createPendidikan`, `updatePendidikan`, `deletePendidikan`, `createPekerjaan`, `updatePekerjaan`, `deletePekerjaan`, `upsertKesehatan`, `upsertIntegritas`, `upsertKelengkapan`, `upsertBiodata` — **13 titik**.

### Rencana

**Step 2.1.a** — Buat helper khusus untuk otorisasi sub-entitas pegawai yang mengakomodasi dua skenario:
1. **Admin** (punya capability `pegawai:manage`) → boleh edit semua pegawai
2. **Pegawai mengedit data sendiri** → boleh tanpa capability khusus

```ts
/**
 * Otorisasi untuk aksi sub-entitas pegawai.
 * Admin dengan capability pegawai:manage boleh edit siapa saja.
 * Pegawai biasa hanya boleh edit data miliknya sendiri.
 */
async function requirePegawaiSubEntityAccess(
  targetUserId: string,
): Promise<AuthSession> {
  const session = await requireSession();
  const access = await getUserAccess(session.user.id);

  // Super admin atau punya capability pegawai:manage → boleh akses semua
  if (access?.isSuperAdmin) return session;
  if (access?.roleId) {
    const hasCapability = await userHasCapability(access, "pegawai:manage");
    if (hasCapability) return session;
  }

  // Pegawai biasa → hanya boleh edit data sendiri
  if (session.user.id === targetUserId) return session;

  throw new Error("Forbidden: tidak ada akses untuk mengubah data pegawai lain.");
}
```

**Step 2.1.b** — Ganti semua 13 titik legacy check dengan `requirePegawaiSubEntityAccess(parsed.userId)`.

**Step 2.1.c** — Import `getUserAccess` dan `userHasCapability` dari `./auth` (sudah exported).

### Acceptance Criteria
- [ ] Semua 13 fungsi sub-entitas menggunakan `requirePegawaiSubEntityAccess`
- [ ] Super admin dengan role "staff" bisa mengakses data pegawai lain
- [ ] Pegawai biasa hanya bisa mengedit data miliknya sendiri
- [ ] Error message lebih informatif

---

## 2.2 Unifikasi Logika Invite — `createPegawai` vs `inviteUser`

**Files**:
- `@d:\Test Coding APP\arka-iai-jakarta\src\server\actions\pegawai.ts:127-193`
- `@d:\Test Coding APP\arka-iai-jakarta\src\server\actions\invitations.ts:137-258`

### Masalah

Dua fungsi yang melakukan hal serupa tapi dengan flow berbeda:

| Aspek | `createPegawai` | `inviteUser` |
|---|---|---|
| Buat `users` row | ✅ | ✅ |
| Buat `account` row | ✅ | ✅ |
| Buat `userInvitations` record | ❌ | ✅ |
| Kirim email aktivasi | ✅ | ✅ |
| Track di Manajemen User | ❌ | ✅ |
| Set `roleId` | ❌ (legacy `role` string) | ✅ |
| Audit log | ✅ (`CREATE_PEGAWAI`) | ✅ (`INVITE_USER`) |

Akibatnya:
- Pegawai yang dibuat via `/pegawai` **tidak muncul** di tab Manajemen User sebagai undangan
- Tidak bisa resend invite dari Manajemen User untuk pegawai yang dibuat via `/pegawai`
- `roleId` tidak diset → user tidak punya role mapping yang benar di sistem RBAC baru

### Rencana

**Step 2.2.a** — Refactor `createPegawai` agar memanggil `inviteUser` secara internal, atau setidaknya membuat `userInvitations` record:

```ts
export async function createPegawai(data: unknown) {
  const parsed = pegawaiCreateSchema.parse(data);
  const session = await requirePermission("pegawai", "create");

  // Cek email duplikat
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.email))
    .limit(1);
  if (existing.length > 0) {
    return { ok: false as const, error: "Email tersebut sudah dipakai oleh pegawai lain." };
  }

  // Delegasikan ke inviteUser untuk konsistensi
  const inviteResult = await inviteUser({
    email: parsed.email,
    namaLengkap: parsed.namaLengkap,
    roleId: parsed.roleId ?? /* default role */, 
    divisiId: parsed.divisiId,
    jabatan: parsed.jabatan,
  });

  if (!inviteResult.ok) {
    return { ok: false as const, error: inviteResult.error };
  }

  // Update field tambahan yang tidak dihandle inviteUser
  if (parsed.emailPribadi || parsed.noHp || parsed.levelJabatan || parsed.jenisPegawai || parsed.tanggalMasuk) {
    await db
      .update(users)
      .set({
        emailPribadi: parsed.emailPribadi,
        noHp: parsed.noHp,
        levelJabatan: parsed.levelJabatan,
        jenisPegawai: parsed.jenisPegawai,
        tanggalMasuk: parsed.tanggalMasuk,
      })
      .where(eq(users.email, parsed.email));
  }

  return { ok: true as const, inviteSent: inviteResult.inviteSent };
}
```

**Step 2.2.b** — Update `pegawaiCreateSchema` untuk menyertakan `roleId` (saat ini hanya punya `role` legacy string).

**Step 2.2.c** — Update UI form buat pegawai untuk menampilkan pilihan role (dari `listRoleOptions`) alih-alih dropdown legacy "admin/staff/pejabat/viewer".

**Step 2.2.d** — Pastikan pegawai yang dibuat via `/pegawai` muncul di tab Manajemen User.

### Acceptance Criteria
- [ ] Pegawai yang dibuat via `/pegawai` memiliki `userInvitations` record
- [ ] Pegawai yang dibuat via `/pegawai` muncul di tab Manajemen User
- [ ] Resend invite bisa dilakukan dari Manajemen User untuk semua pegawai
- [ ] `roleId` terisi dengan benar (bukan hanya legacy `role` string)
- [ ] Form buat pegawai menampilkan pilihan role dari RBAC

---

## 2.3 Paginasi untuk List Pegawai dan Manajemen User

**Files**:
- `@d:\Test Coding APP\arka-iai-jakarta\src\server\actions\pegawai.ts:62-89`
- `@d:\Test Coding APP\arka-iai-jakarta\src\server\actions\invitations.ts:110-133`

### Masalah

Kedua fungsi menggunakan hard-limit 200 tanpa paginasi:

```@d:\Test Coding APP\arka-iai-jakarta\src\server\actions\pegawai.ts:87-88
.orderBy(desc(users.createdAt))
.limit(200);
```

```@d:\Test Coding APP\arka-iai-jakarta\src\server\actions\invitations.ts:131-132
.orderBy(desc(users.createdAt))
.limit(200);
```

Jika pegawai > 200, data terpotong tanpa indikasi di UI. Tidak ada cara untuk melihat data yang lebih lama.

### Rencana

**Step 2.3.a** — Tambah cursor-based pagination di `listPegawai`:

```ts
export async function listPegawai(cursor?: string, limit = 50): Promise<{
  rows: PegawaiListRow[];
  nextCursor: string | null;
  total: number;
}> {
  await requireSession();

  const [{ count: total }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);

  const rows = await db
    .select({ /* existing select */ })
    .from(users)
    .leftJoin(divisi, eq(users.divisiId, divisi.id))
    .leftJoin(pegawaiBiodata, eq(pegawaiBiodata.userId, users.id))
    .where(cursor ? lt(users.createdAt, new Date(cursor)) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, -1) : rows;
  const nextCursor = hasMore
    ? data[data.length - 1]!.createdAt?.toISOString() ?? null
    : null;

  return { rows: data, nextCursor, total: Number(total) };
}
```

**Step 2.3.b** — Terapkan pola yang sama di `listUsersForManagement`.

**Step 2.3.c** — Update UI untuk mendukung "Load More" atau infinite scroll.

### Acceptance Criteria
- [ ] `listPegawai` mendukung cursor-based pagination
- [ ] `listUsersForManagement` mendukung cursor-based pagination
- [ ] UI menampilkan total count dan tombol "Load More"
- [ ] Tidak ada data yang terpotong secara diam-diam

---

# FASE 3 — Opsional (Estimasi: 2 hari)

## 3.1 Integrasi Divisi & Pejabat ke Tab Pengaturan

### Masalah

Divisi dan Pejabat punya halaman terpisah (`/divisi`, `/pejabat`) di luar tab Pengaturan. Admin harus navigasi ke halaman berbeda untuk mengelola data master yang terkait.

### Rencana

**Step 3.1.a** — Tambah tab "Divisi" dan "Pejabat" di `PengaturanTabs`:

```tsx
interface PengaturanTabsProps {
  // ... existing props
  divisi?: React.ReactNode;
  pejabat?: React.ReactNode;
}
```

**Step 3.1.b** — Buat `DivisiManagerCard` dan `PejabatManagerCard` yang reuse server action yang sama.

**Step 3.1.c** — Halaman `/divisi` dan `/pejabat` tetap ada sebagai shortcut, tapi konten sama (shared component).

### Acceptance Criteria
- [ ] Admin bisa mengelola Divisi dan Pejabat dari halaman Pengaturan
- [ ] Halaman `/divisi` dan `/pejabat` tetap berfungsi

---

## 3.2 Dirty State Indicator di Konfigurasi Sistem

**File**: `@d:\Test Coding APP\arka-iai-jakarta\src\components\pengaturan\KonfigurasiSistemCard.tsx`

### Masalah

Form konfigurasi tidak menunjukkan apakah ada perubahan yang belum disimpan. Tombol "Simpan" selalu aktif bahkan saat tidak ada perubahan.

### Rencana

**Step 3.2.a** — Track dirty state dengan membandingkan current values vs initial values:

```tsx
const isDirty =
  defaultDeadline !== initial.defaultDisposisiDeadlineDays ||
  emailEnabled !== initial.notificationEmailEnabled ||
  (financeContactName || "") !== (initial.financeContactName ?? "") ||
  (financeWhatsappNumber || "") !== (initial.financeWhatsappNumber ?? "");

// Tombol Simpan
<Button type="submit" disabled={isPending || !isDirty} className="w-full sm:w-auto">
```

**Step 3.2.b** — Tambah visual indicator (mis. dot atau teks "Belum disimpan") saat dirty.

### Acceptance Criteria
- [ ] Tombol "Simpan" disabled saat tidak ada perubahan
- [ ] Visual indicator menunjukkan ada perubahan yang belum disimpan

---

## 3.3 Search/Filter di Manajemen User

**File**: `@d:\Test Coding APP\arka-iai-jakarta\src\components\pengaturan\ManajemenUserCard.tsx`

### Masalah

List user ditampilkan tanpa search/filter. Dengan limit 200, mencari user tertentu bisa sulit.

### Rencana

**Step 3.3.a** — Tambah server action `searchUsers(query)` yang mendukung filter berdasarkan nama, email, divisi, role.

**Step 3.3.b** — Tambah search input di `ManajemenUserCard` dengan debounce.

**Step 3.3.c** — Tambah filter dropdown untuk divisi dan role.

### Acceptance Criteria
- [ ] Admin bisa mencari user berdasarkan nama/email
- [ ] Admin bisa memfilter berdasarkan divisi dan role
- [ ] Search bersifat real-time (debounced)

---

# Urutan Eksekusi yang Disarankan

1. **Sprint 1 (Kritis — Bug & Keamanan)**: 1.1 → 1.2 → 1.3
2. **Sprint 2 (Penting — Arsitektur)**: 2.1 → 2.2 → 2.3
3. **Sprint 3 (Opsional — UX)**: 3.1 → 3.2 → 3.3

---

# Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| `deletePegawai` sudah merusak data (orphan account) sebelum fix terpasang | Deploy 1.1 secepatnya; jalankan script cleanup untuk orphan account yang sudah ada |
| Proteksi delete mengecewakan user yang sudah terbiasa hard-delete | Sediakan opsi "Nonaktifkan" yang jelas di UI; komunikasikan perubahan |
| Unifikasi invite bisa break flow pegawai yang sudah ada | Lakukan setelah 1.1–1.3 stabil; pastikan backward-compatible dengan data existing |
| Paginasi mengubah return type `listPegawai` | Update semua consumer; gunakan wrapper jika perlu untuk kompatibilitas sementara |
| Legacy role check removal bisa break akses pegawai yang edit profil sendiri | `requirePegawaiSubEntityAccess` tetap mengizinkan self-service |

---

# Catatan Tambahan

## Orphan Account Cleanup Script

Setelah 1.1 dideploy, perlu menjalankan script satu kali untuk membersihkan orphan account yang sudah terlanjur dibuat:

```sql
-- Cari orphan account (userId tidak ada di tabel users)
SELECT a.id, a."userId", a."providerId"
FROM account a
LEFT JOIN users u ON a."userId" = u.id
WHERE u.id IS NULL;

-- Hapus orphan account
DELETE FROM account
WHERE "userId" NOT IN (SELECT id FROM users);
```

## Dependency dengan Revamp Modul Pelatihan

Beberapa item di rencana ini bergantung pada hasil revamp modul pelatihan:
- **1.2** (validasi referensi pegawai) memerlukan knowledge tentang tabel `pesertaKelas` dan `honorariumItems` yang sudah di-review di revamp pelatihan
- **2.2** (unifikasi invite) memerlukan `roleId` yang sudah benar di schema — ini juga terkait dengan Fase 3.3 revamp pelatihan (pisahkan permission `pelatihan` vs `jadwalUjian`)

---

# Tracking

Buat issue/task per sub-step (1.1.a, 1.1.b, dst). Definition of Done = AC tercentang + audit log terverifikasi + manual smoke test pass.
