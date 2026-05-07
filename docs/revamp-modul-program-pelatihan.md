# Rencana Implementasi Revamp Modul Program Pelatihan

**Tanggal**: 2026-05-07
**Scope**: Modul `jadwal-otomatis` (Program Pelatihan)
**Status**: Fase 3 — selesai

---

## Ringkasan Eksekutif

Berdasarkan kroscek terhadap codebase, dari 10 temuan analisis awal:

- **8 valid** — perlu diperbaiki
- **1 valid dengan koreksi nuansa** (#1: ancaman = cascade destruction + FK `honorariumItems`, bukan constraint violation umum)
- **1 tidak akurat** (#8: `recomputeStatusPeserta` sudah auto-trigger di 4 titik)

Implementasi dipecah menjadi **3 fase** berdasarkan prioritas dan dependency.

---

## Prinsip Implementasi

1. **Minimal upstream fix** — perbaiki di server action / schema, hindari workaround di UI.
2. **Backward-compatible** — tidak break data existing; gunakan default value untuk field baru.
3. **Audit-first untuk operasi destruktif** — semua state-mutating action kritis wajib menulis `auditLog`.
4. **Tidak hapus tes existing** — tambah regression test untuk setiap fix.
5. **Konsisten dengan pola yang sudah ada** — ikuti gaya `bulkDeletePesertaIfClean` (validate-then-delete) dan `writeAuditLog` (`@d:\Test Coding APP\arka-iai-jakarta\src\server\lib\audit.ts`).

---

# FASE 1 — Kritis (Estimasi: 1–2 hari)

## 1.1 Proteksi Delete Kelas + Soft Delete via Status `cancelled`

**File**: `@d:\Test Coding APP\arka-iai-jakarta\src\server\actions\jadwal-otomatis\kelasOtomatis.ts:439-446`

### Masalah

```@d:\Test Coding APP\arka-iai-jakarta\src\server\actions\jadwal-otomatis\kelasOtomatis.ts:439-446
export async function deleteKelasOtomatis(id: string) {
  await requirePermission("jadwalUjian", "configure");
  await db.delete(kelasPelatihan).where(eq(kelasPelatihan.id, id));
  revalidatePath("/jadwal-otomatis");
  return { ok: true as const };
}
```

- Cascade delete akan **menghancurkan** semua peserta, absensi, nilai, sessions
- `honorariumItems.kelasId` **tidak punya** `onDelete cascade` → akan FK violation kalau ada honorarium

### Rencana

**Step 1.1.a** — Tambah validasi pra-delete:

```ts
export async function deleteKelasOtomatis(id: string) {
  const session = await requirePermission("jadwalUjian", "configure");

  // 1. Cek peserta
  const [{ count: pesertaCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pesertaKelas)
    .where(eq(pesertaKelas.kelasId, id));

  // 2. Cek honorarium items (HARD blocker karena tanpa cascade)
  const [{ count: honorariumCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(honorariumItems)
    .where(eq(honorariumItems.kelasId, id));

  // 3. Cek kelas ujian terkait
  const [{ count: kelasUjianCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(kelasUjian)
    .where(eq(kelasUjian.kelasPelatihanId, id));

  if (honorariumCount > 0) {
    return {
      ok: false as const,
      error: "Kelas sudah masuk perhitungan honorarium. Hapus permanen diblokir. Gunakan Batalkan Kelas.",
    };
  }

  if (pesertaCount > 0 || kelasUjianCount > 0) {
    return {
      ok: false as const,
      error: `Kelas memiliki ${pesertaCount} peserta dan ${kelasUjianCount} kelas ujian terkait. Hapus permanen diblokir.`,
      blockers: { pesertaCount, kelasUjianCount },
    };
  }

  await db.delete(kelasPelatihan).where(eq(kelasPelatihan.id, id));
  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_KELAS_PELATIHAN",
    entitasType: "kelas_pelatihan",
    entitasId: id,
  });

  revalidatePath("/jadwal-otomatis");
  return { ok: true as const };
}
```

**Step 1.1.b** — Update UI `KelasOtomatisTable.tsx` (`handleDeleteConfirm`) untuk menampilkan pesan error dari server (bukan generic "Gagal menghapus kelas").

**Step 1.1.c** — Tambah test kasus:
- Delete kelas tanpa peserta → sukses
- Delete kelas dengan peserta → diblokir
- Delete kelas dengan honorarium → diblokir

### Acceptance Criteria
- [x] Delete kelas dengan honorarium menampilkan error spesifik
- [x] Delete kelas dengan peserta menampilkan error spesifik
- [x] Delete sukses menulis audit log

---

## 1.2 Transisi Status Kelas (`active` → `completed` / `cancelled`)

**File baru**: tambah action di `@d:\Test Coding APP\arka-iai-jakarta\src\server\actions\jadwal-otomatis\kelasOtomatis.ts`

### Rencana

**Step 1.2.a** — Tambah validator schema di `@d:\Test Coding APP\arka-iai-jakarta\src\lib\validators\jadwalOtomatis.schema.ts`:

```ts
export const kelasOtomatisUpdateStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["active", "completed", "cancelled"]),
  reason: z.string().trim().max(500).optional(),
});
export type KelasOtomatisUpdateStatusInput = z.infer<typeof kelasOtomatisUpdateStatusSchema>;
```

**Step 1.2.b** — Tambah server action `updateKelasOtomatisStatus`:

- Validasi transisi yang diizinkan:
  - `active` → `completed` (jika semua sesi non-exam-day sudah past atau status `completed`)
  - `active` → `cancelled` (boleh kapan saja, tapi block jika ada honorarium paid)
  - `cancelled` → `active` (re-activate, dengan konfirmasi)
  - `completed` → `active` (revert, dengan konfirmasi + audit log alasan)
- Tulis `auditLog` dengan `aksi: "UPDATE_STATUS_KELAS_PELATIHAN"` + payload `{ from, to, reason }`

**Step 1.2.c** — UI di `KelasOtomatisTable.tsx`:
- Tambah dropdown action: "Tandai Selesai", "Batalkan Kelas", "Aktifkan Ulang"
- Dialog konfirmasi dengan input `reason` (wajib untuk cancel/revert)

**Step 1.2.d** — Filter `listKelasOtomatis` agar opsional bisa exclude `cancelled` (default: tampilkan semua dengan badge).

### Acceptance Criteria
- [x] Bisa ubah status active → completed
- [x] Bisa ubah status active → cancelled
- [x] Audit log mencatat transisi + reason
- [x] Badge UI di table mencerminkan status terkini

---

## 1.3 Edit Kelas Lengkap

**File**: `@d:\Test Coding APP\arka-iai-jakarta\src\server\actions\jadwal-otomatis\kelasOtomatis.ts`

### Rencana

**Step 1.3.a** — Tambah validator `kelasOtomatisUpdateMetadataSchema`:

```ts
export const kelasOtomatisUpdateMetadataSchema = z.object({
  id: z.string().min(1),
  namaKelas: z.string().min(1).max(200),
  mode: z.enum(["offline", "online"]),
  angkatan: z.number().int().positive().nullable().optional(),
  certificateClassCode: z.string().max(2).nullable().optional(),
  lokasi: z.string().max(300).nullable().optional(),
  // programId & classTypeId TIDAK termasuk - mengubah ini = generate ulang schedule
});
```

**Step 1.3.b** — Tambah action `updateKelasOtomatisMetadata` (manage permission). Tidak menyentuh `programId` / `classTypeId` / `startDate` (sudah ada action terpisah). Tulis audit log.

**Step 1.3.c** — UI: konversi dropdown action "Ubah Tanggal Mulai" jadi dialog "Edit Kelas" dengan tabs:
- **Tab Metadata**: nama, mode, angkatan, certificate code, lokasi
- **Tab Tanggal Mulai**: existing flow (pakai `updateKelasOtomatisStartDate`)
- **Tab Kontak Keuangan**: existing flow (pakai `updateKelasFinanceContactOverride`)
- **Tab Excluded Dates**: lihat #2.1

### Acceptance Criteria
- [x] Dialog edit menampilkan semua field non-destruktif
- [x] Save metadata tidak men-trigger regenerate schedule
- [x] Audit log mencatat perubahan field

---

# FASE 2 — Penting (Estimasi: 3–5 hari)

## 2.1 Manajemen Excluded Dates Pasca-Buat

**File**: `@d:\Test Coding APP\arka-iai-jakarta\src\server\actions\jadwal-otomatis\kelasOtomatis.ts`

### Rencana

**Step 2.1.a** — Tambah action:

```ts
export async function addExcludedDateToKelas(input: { kelasId, date, reason })
export async function removeExcludedDateFromKelas(input: { kelasId, date })
export async function listExcludedDatesByKelas(kelasId: string)
```

**Step 2.1.b** — Setelah add/remove excluded date, **panggil ulang `generateSchedule`** untuk re-generate sessions. Pastikan blok jika kelas sudah punya `honorariumItems` (mirip `updateKelasOtomatisStartDate:484-489`).

**Step 2.1.c** — UI tab "Excluded Dates" di dialog edit kelas (lihat 1.3.c) — reuse komponen dari `FormBuatKelasOtomatis.tsx:349-390`.

### Acceptance Criteria
- [x] Bisa add excluded date pasca-buat
- [x] Bisa remove excluded date pasca-buat
- [x] Schedule otomatis ter-regenerate
- [x] Diblokir jika sudah ada honorarium

---

## 2.2 UI Manajemen Master Data (Programs, ClassTypes, Curriculum)

**Estimasi: 2–3 hari** (terbesar di fase ini)

### Rencana

**Step 2.2.a** — Server actions di `programs.ts`:
- `createProgram(input)` — manage permission
- `updateProgram(id, input)` — manage permission
- `archiveProgram(id)` — soft delete via `isActive: false` (programs sudah punya field ini)

**Step 2.2.b** — Server actions di `classTypes.ts`:
- `createClassType`, `updateClassType`, `archiveClassType`

**Step 2.2.c** — Server actions baru `curriculum.ts`:
- `getCurriculumByProgram(programId)` — return template + exam points
- `upsertCurriculumTemplate(input)`
- `upsertCurriculumExamPoints(input)`

**Step 2.2.d** — UI baru di `/jadwal-otomatis/master-data`:
- Tab Program: list + create/edit/archive
- Tab Class Type: list + create/edit/archive
- Tab Curriculum: select program → edit template + exam points

**Step 2.2.e** — Audit log untuk semua operasi.

### Acceptance Criteria
- [x] Onboarding program baru bisa dilakukan tanpa developer
- [x] Edit class type tersedia di UI
- [x] Edit curriculum template per program tersedia

---

## 2.3 Pecah Monolith Komponen

**Files**:
- `@d:\Test Coding APP\arka-iai-jakarta\src\components\jadwal-otomatis\PesertaDanNilaiTab.tsx` (1671 baris)
- `@d:\Test Coding APP\arka-iai-jakarta\src\components\jadwal-otomatis\JadwalDetail.tsx` (988 baris)

### Rencana

**Step 2.3.a** — Pecah `PesertaDanNilaiTab.tsx` menjadi:

```
src/components/jadwal-otomatis/peserta-tab/
├── index.tsx                       (orchestrator, ~150 baris)
├── PesertaListSection.tsx          (CRUD + filter)
├── PesertaImportDialog.tsx         (paste bulk + form)
├── PesertaMoveDialog.tsx           (move antar kelas)
├── AbsensiPelatihanSection.tsx
├── AbsensiUjianSection.tsx
├── NilaiUjianSection.tsx
├── NilaiPerbaikanSection.tsx
├── UjianSusulanSection.tsx
└── ExportRekapButton.tsx
```

**Step 2.3.b** — Pecah `JadwalDetail.tsx` per mode (full / readonly / preview).

**Step 2.3.c** — Tidak mengubah behavior, hanya restructure. Pastikan props & state masih flow benar.

### Acceptance Criteria
- [x] Tidak ada file > 500 baris di folder (types/utils/sub-components diekstrak ke subdirektori)
- [x] Semua existing flow masih berfungsi (regression test manual)
- [x] Type-check dan build pass

---

## 2.4 Audit Log untuk Operasi Kritis Kelas Pelatihan

**Sudah tercakup di**: 1.1 (delete), 1.2 (status), 1.3 (edit metadata), 2.1 (excluded dates), 2.2 (master data).

**Tambahan** — Step 2.4.a: tambah `writeAuditLog` di `createKelasOtomatis` (`@d:\Test Coding APP\arka-iai-jakarta\src\server\actions\jadwal-otomatis\kelasOtomatis.ts:169-240`):

```ts
await writeAuditLog({
  userId: session.user.id,
  aksi: "CREATE_KELAS_PELATIHAN",
  entitasType: "kelas_pelatihan",
  entitasId: id,
  payload: { namaKelas, programId, classTypeId, startDate },
});
```

### Acceptance Criteria
- [x] Semua operasi state-mutating di modul pelatihan menulis audit log
- [x] Konsisten dengan pola di `integrasi.ts:175`

---

# FASE 3 — Opsional (Estimasi: 1–2 hari)

## 3.1 Auto-Trigger Recompute Status pada Perubahan Status Sesi

**Status temuan**: ❌ TIDAK AKURAT untuk kasus umum — sudah auto-trigger.

**Yang masih kurang**: setelah `cancelSession` / `markSessionCompleted` (force majeure flow).

### Rencana

**Step 3.1.a** — Identifikasi lokasi: `@d:\Test Coding APP\arka-iai-jakarta\src\server\actions\jadwal-otomatis\forceMajeure.ts`

**Step 3.1.b** — Setelah perubahan status sesi, query semua peserta di kelas tersebut dan panggil `recomputeStatusPeserta` untuk masing-masing (best-effort dengan try/catch, sama seperti pola di `absensi-pelatihan.ts:53-58`).

### Acceptance Criteria
- [x] Cancel sesi men-trigger recompute untuk semua peserta kelas

---

## 3.2 Tampilkan Default Finance Contact di Form Buat Kelas

**File**: `@d:\Test Coding APP\arka-iai-jakarta\src\components\jadwal-otomatis\FormBuatKelasOtomatis.tsx:299-347`

### Rencana

**Step 3.2.a** — Page server `/jadwal-otomatis/buat` query `systemSettings.financeContactName` & `financeWhatsappNumber`.

**Step 3.2.b** — Pass sebagai prop `defaultFinanceContact` ke `FormBuatKelasOtomatis`.

**Step 3.2.c** — Tampilkan sebagai placeholder atau hint:

```
Override Nomor WA Keuangan (opsional)
[Input]
Default global: 6281xxxxxxxxx (Tim Keuangan Pusat)
```

### Acceptance Criteria
- [x] User melihat nilai default sebelum memutuskan override

---

## 3.3 Pisahkan Permission `pelatihan` vs `jadwalUjian`

**Effort**: Sedang–Besar (sentuh banyak file). **Rekomendasi**: tunda kecuali ada kebutuhan bisnis konkret.

### Rencana (jika dijalankan)

**Step 3.3.a** — Tambah permission key `"jadwalPelatihan"` di sistem permission.

**Step 3.3.b** — Migrasi seluruh `requirePermission("jadwalUjian", ...)` di `src/server/actions/jadwal-otomatis/**` ke `"jadwalPelatihan"`. Sekitar 30+ titik.

**Step 3.3.c** — Update role mapping default agar role yang punya `jadwalUjian` otomatis dapat `jadwalPelatihan` (backward-compatible).

**Step 3.3.d** — Update UI permission management.

### Acceptance Criteria
- [x] Role bisa diberi akses pelatihan tanpa akses ujian (dan sebaliknya)
- [x] Tidak break user existing

---

# Urutan Eksekusi yang Disarankan

1. **Sprint 1 (Kritis)**: 1.1 → 1.2 → 1.3 → 2.4
2. **Sprint 2 (Penting — UX)**: 2.1 → 2.3 (pecah PesertaDanNilaiTab dulu, JadwalDetail kedua)
3. **Sprint 3 (Penting — Master Data)**: 2.2
4. **Sprint 4 (Opsional)**: 3.2 → 3.1 → 3.3 (skip 3.3 jika tidak ada kebutuhan)

---

# Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Cascade delete sudah merusak data sebelum proteksi terpasang | Deploy 1.1 secepatnya; sementara non-aktifkan tombol delete di UI |
| Pecah monolith memperkenalkan regression | Lakukan setelah Sprint 1 stabil; siapkan checklist manual smoke test |
| Master data UI mengubah seed flow | Pastikan migration tidak menghapus data existing; gunakan upsert |
| Permission split membingungkan user | Siapkan dokumentasi & default mapping yang konservatif |

---

# Tracking

Buat issue/task per sub-step (1.1.a, 1.1.b, dst). Definition of Done = AC tercentang + audit log terverifikasi + manual smoke test pass.
