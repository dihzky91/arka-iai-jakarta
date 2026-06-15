# Simplifikasi Surat Keluar — Mode Logbook & Penomoran Bebas Kode

## Status
Planned

---

## 1. Latar Belakang & Masalah

### Feedback Staff (Uji Coba Juni 2026)

Staff merasa proses pencatatan surat keluar di Arka **terlalu ribet** dibandingkan logbook manual yang selama ini dipakai. Dua keluhan utama:

| # | Keluhan | Penjelasan |
|---|---------|-----------|
| 1 | Proses bukan seperti logbook | Staff expect: buka → isi perihal/tujuan/tanggal → dapat nomor → selesai. Kenyataannya: harus isi form lengkap, pilih jenis, aktifkan toggle "Catat Saja", baru bisa selesaikan langsung. |
| 2 | Harus setup jenis surat & kode dulu | Sebelum bisa generate nomor, admin harus setup kode per jenis surat. Padahal kode setelah counter itu sifatnya bebas — bukan selalu mengikuti jenis surat. |

### Analisis Kondisi Saat Ini

**Mode Catat Saja sudah ada**, tapi:
- Tersembunyi sebagai toggle di bagian bawah form
- Staff tidak tahu harus mengaktifkan ini
- Form tetap menampilkan semua field (pejabat, divisi, dll) yang tidak relevan untuk pencatatan sederhana

**Penomoran saat ini:**
- Counter sudah unified (1 per bulan) ✓
- Tapi segmen kode di nomor surat **wajib** dari tabel `kode_jenis_surat` — harus di-setup admin dulu
- Jika kode belum di-setup → generate gagal
- Padahal di SIMPEG IAI, nomor surat (segmen setelah counter) diisi manual bebas ("nomor surat mundur")
- Kode itu bukan selalu jenis surat — bisa kode kegiatan, kode divisi, singkatan proyek, dll

---

## 2. Perubahan Konsep Penomoran

### 2.1 Format Nomor Surat

```
{counter}/{kode_bebas}/{prefix_organisasi}/{bulanRomawi}/{tahun}
```

| Segmen | Sumber | Contoh |
|--------|--------|--------|
| counter | Otomatis (sistem) — berurut per bulan | 01, 02, 03 |
| kode_bebas | **Diisi user** saat catat surat (free-text) | DE, K, PPL-B12, MOU |
| prefix_organisasi | Otomatis dari system_settings | IAI-DKIJKT |
| bulanRomawi | Otomatis dari tanggal surat | I, II, ... XII |
| tahun | Otomatis dari tanggal surat | 2026 |

Contoh nomor yang dihasilkan:
- `01/DE/IAI-DKIJKT/VI/2026`
- `02/K/IAI-DKIJKT/VI/2026`
- `03/PPL-B12/IAI-DKIJKT/VI/2026`
- `04/MOU/IAI-DKIJKT/VI/2026`

### 2.2 Perbedaan dengan Sistem Sekarang

| Aspek | Sekarang | Setelah Perubahan |
|-------|----------|-------------------|
| Segmen kode | Wajib dari tabel master per jenis surat | Free-text, user isi sendiri |
| Setup admin | Wajib sebelum bisa generate | Tidak perlu |
| Kode terikat jenis | Ya (undangan=U, permohonan=P, dll) | Tidak — bebas apa saja |
| Tabel `kode_jenis_surat` | Sumber kebenaran (wajib) | Jadi **suggestion/autocomplete** saja |
| Generate gagal jika kode belum ada | Ya | Tidak — selama user isi kode |

### 2.3 Peran Tabel `kode_jenis_surat` Setelah Perubahan

Tabel ini **tidak dihapus**, tapi berubah fungsi:
- **Sebelum**: sumber wajib untuk segmen kode di nomor surat
- **Sesudah**: daftar **saran kode** (autocomplete) saat user mengetik di field kode

Benefit:
- Staff yang sudah terbiasa tetap bisa pilih dari list (cepat)
- Staff yang butuh kode custom tetap bisa ketik bebas
- Admin bisa menambah saran kode baru kapan saja (opsional)

---

## 3. Desain Perubahan UI

### 3.1 Dua Tombol Aksi di Halaman Surat Keluar

```
┌─────────────────────┐  ┌──────────────────────┐
│ 📋 Catat Surat      │  │ + Surat Workflow     │
│   (Pencatatan cepat) │  │   (Dengan approval)  │
└─────────────────────┘  └──────────────────────┘
```

- **Catat Surat** (primary) → Modal ringkas, langsung dapat nomor, status langsung "selesai"
- **Surat Workflow** (secondary/outline) → Form lengkap existing untuk surat yang perlu approval

### 3.2 Modal "Catat Surat" (Quick Log)

```
┌──────────────────────────────────────────────────────┐
│  Catat Surat Keluar                             [X]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Perihal *            [___________________________]  │
│  Tujuan *             [___________________________]  │
│  Alamat Tujuan        [___________________________]  │
│  Tanggal Surat *      [____/____/________]           │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ Nomor Surat                                    │  │
│  │                                                │  │
│  │ Counter (otomatis)  Kode *       Prefix        │  │
│  │ ┌────┐              ┌────────┐   IAI-DKIJKT   │  │
│  │ │ 05 │       /      │ DE ▾   │ /  /VI/2026    │  │
│  │ └────┘              └────────┘                 │  │
│  │                                                │  │
│  │ Preview: 05/DE/IAI-DKIJKT/VI/2026              │  │
│  │                                                │  │
│  │ Saran kode: [DE] [K] [P] [MOU] [INV]          │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  Isi Singkat          [___________________________]  │
│                                                      │
│  ── atau ──                                          │
│  □ Input nomor manual penuh (untuk backdate)         │
│    [_______________________________________]         │
│                                                      │
│              [Batal]  [Simpan & Catat Nomor]         │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Penjelasan:**
- **Counter**: otomatis dari sistem (read-only, preview)
- **Kode**: free-text input dengan autocomplete dari tabel `kode_jenis_surat`
- **Preview nomor**: ditampilkan real-time saat user mengetik kode
- **Saran kode**: chips/tags yang bisa diklik (dari tabel master)
- **Input manual penuh**: checkbox toggle untuk kasus backdate — user isi seluruh nomor sendiri

### 3.3 Perilaku Modal

1. User buka modal → counter berikutnya langsung di-fetch dan ditampilkan (preview)
2. User isi perihal, tujuan, tanggal (wajib)
3. User isi/pilih kode (wajib) — ketik bebas atau pilih dari saran
4. Preview nomor update real-time
5. Klik "Simpan & Catat Nomor"
6. Sistem: allocate counter (atomic) → simpan surat status "selesai" → return nomor final
7. Modal tampilkan **success state**: nomor surat + tombol Copy
8. Tabel refresh

**Mode manual (backdate):**
1. User centang "Input nomor manual penuh"
2. Field kode dan preview hilang, diganti satu input text penuh
3. User isi nomor lengkap sendiri (misal: `03/DE/IAI-DKIJKT/V/2026`)
4. Sistem: simpan surat tanpa allocate counter (nomor manual, counter tidak terpengaruh)

---

## 4. Perubahan Backend

### 4.1 Update `allocateNomorSurat` — Terima Kode dari User

```typescript
// src/lib/nomor-surat.ts

type AllocateNomorSuratInput = {
  tahun: number;
  bulan: number;
  kodeSurat: string;            // FREE-TEXT dari user (bukan lagi dari tabel master)
  prefixOrganisasi: string;
  jumlah?: number;
};

// Format output tetap sama:
// "{counter}/{kodeSurat}/{prefixOrganisasi}/{bulanRomawi}/{tahun}"
```

Perubahan utama: parameter `kodeJenis` rename jadi `kodeSurat` dan sumbernya bukan lagi lookup tabel, melainkan langsung dari input user.

### 4.2 Update `resolveNomorSuratParams` → Simplifikasi

```typescript
// src/lib/nomor-surat-helpers.ts

// SEBELUM: lookup kode dari tabel kode_jenis_surat (wajib)
// SESUDAH: hanya ambil prefix organisasi (kode dari user)

export async function resolveNomorSuratPrefix(): Promise<{
  prefixOrganisasi: string;
}> {
  const [settingsRow] = await db
    .select({ prefixOrganisasi: systemSettings.prefixOrganisasi })
    .from(systemSettings)
    .limit(1);

  return {
    prefixOrganisasi: settingsRow?.prefixOrganisasi ?? "IAI-DKIJKT",
  };
}
```

### 4.3 Server Action Baru: `catatSuratCepat`

```typescript
// src/server/actions/suratKeluar.ts

const catatSuratCepatSchema = z.object({
  perihal: z.string().min(1, "Perihal wajib diisi"),
  tujuan: z.string().min(1, "Tujuan wajib diisi"),
  tujuanAlamat: z.string().optional(),
  tanggalSurat: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  kodeSurat: z.string().min(1, "Kode surat wajib diisi").max(20),
  isiSingkat: z.string().optional(),
});

export async function catatSuratCepat(data: unknown) {
  const parsed = catatSuratCepatSchema.parse(data);
  const session = await requirePermission("suratKeluar", "create");

  const tanggal = parseIsoDateInJakarta(parsed.tanggalSurat);
  const bulan = tanggal.getMonth() + 1;
  const tahun = tanggal.getFullYear();

  const { prefixOrganisasi } = await resolveNomorSuratPrefix();

  // Allocate counter + generate nomor
  const result = await allocateNomorSurat({
    tahun, bulan, kodeSurat: parsed.kodeSurat, prefixOrganisasi,
  });
  const nomorSurat = result.nomorList[0];

  // Insert surat langsung status "selesai"
  const [row] = await db.insert(suratKeluar).values({
    id: crypto.randomUUID(),
    perihal: parsed.perihal,
    tujuan: parsed.tujuan,
    tujuanAlamat: parsed.tujuanAlamat ?? null,
    tanggalSurat: parsed.tanggalSurat,
    jenisSurat: "lainnya",  // default, karena di mode catat jenis tidak relevan
    isiSingkat: parsed.isiSingkat ?? null,
    catatSaja: true,
    nomorSurat,
    status: "selesai",
    dibuatOleh: session.user.id,
  }).returning();

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CATAT_SURAT_CEPAT",
    entitasType: "surat_keluar",
    entitasId: row!.id,
    detail: { nomorSurat, perihal: parsed.perihal, kodeSurat: parsed.kodeSurat },
  });

  revalidatePath("/surat-keluar");
  revalidateDashboardTag(DASHBOARD_TAGS.persuratan);
  return { ok: true as const, data: row!, nomorSurat };
}
```

### 4.4 Server Action Baru: `catatSuratManual` (Backdate)

```typescript
const catatSuratManualSchema = z.object({
  perihal: z.string().min(1, "Perihal wajib diisi"),
  tujuan: z.string().min(1, "Tujuan wajib diisi"),
  tujuanAlamat: z.string().optional(),
  tanggalSurat: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nomorSurat: z.string().min(1, "Nomor surat wajib diisi"),
  isiSingkat: z.string().optional(),
});

export async function catatSuratManual(data: unknown) {
  // Similar to catatSuratCepat but:
  // - Tidak allocate counter (nomor dari user)
  // - Validasi duplikasi nomor
  // - Insert dengan nomor manual
}
```

### 4.5 API: Fetch Next Counter (Preview)

```typescript
// Untuk menampilkan preview counter berikutnya di modal (read-only)
export async function getNextCounter(tanggalSurat: string) {
  const tanggal = parseIsoDateInJakarta(tanggalSurat);
  const bulan = tanggal.getMonth() + 1;
  const tahun = tanggal.getFullYear();

  const [row] = await db
    .select({ counter: nomorSuratCounter.counter })
    .from(nomorSuratCounter)
    .where(and(
      eq(nomorSuratCounter.tahun, tahun),
      eq(nomorSuratCounter.bulan, bulan),
    ));

  return { nextCounter: (row?.counter ?? 0) + 1 };
}
```

### 4.6 API: Fetch Saran Kode (Autocomplete)

```typescript
// Ambil daftar kode dari tabel kode_jenis_surat sebagai saran
export async function getSaranKode() {
  const rows = await db
    .select({ kode: kodeJenisSurat.kode, keterangan: kodeJenisSurat.keterangan })
    .from(kodeJenisSurat)
    .orderBy(kodeJenisSurat.kode);

  return rows;
}
```

### 4.7 Update Caller Existing (`assignNomorSuratKeluar`)

Untuk flow workflow yang sudah ada, ada 2 opsi:
1. **Opsi A**: Tetap pakai lookup dari tabel `kode_jenis_surat` berdasarkan jenis surat (backward compatible)
2. **Opsi B**: Tambah field `kodeSurat` di form workflow, user isi saat create surat

**Rekomendasi**: Opsi A untuk saat ini (tidak break flow existing). Jika nanti admin belum setup kode untuk jenis tertentu, fallback ke kode "L" (lainnya) atau minta user isi manual.

---

## 5. Perubahan Frontend

### 5.1 Komponen Baru: `CatatSuratModal.tsx`

File: `src/components/surat-keluar/CatatSuratModal.tsx`

Fitur:
- Form ringkas (perihal, tujuan, alamat, tanggal, kode, isi singkat)
- Input kode dengan combobox/autocomplete (saran dari tabel + free-text)
- Preview nomor surat real-time
- Toggle mode manual (backdate)
- Success state dengan nomor final + tombol copy

### 5.2 Update: `SuratKeluarManager.tsx`

- Tambah tombol "Catat Surat" (primary)
- Rename tombol existing "Surat Keluar" → "Surat Workflow" (secondary/outline)
- Integrasi modal `CatatSuratModal`

### 5.3 Komponen Autocomplete Kode

Reuse pattern combobox dari shadcn/ui:
- Tampilkan saran kode dari tabel master
- User bisa pilih dari list ATAU ketik custom
- Chips di bawah input untuk quick-select kode populer

---

## 6. Alur Pengguna Setelah Perubahan

### 6.1 Pencatatan Harian (Flow Utama — Quick Log)

```
Staff buka halaman Surat Keluar
  → Klik "Catat Surat"
  → Modal terbuka, counter berikutnya tampil (misal: 05)
  → Isi: perihal, tujuan, tanggal
  → Ketik kode: "DE" (atau pilih dari saran)
  → Preview: "05/DE/IAI-DKIJKT/VI/2026"
  → Klik "Simpan & Catat Nomor"
  → Berhasil! Nomor: 05/DE/IAI-DKIJKT/VI/2026 [Copy]
  → Selesai (< 30 detik)
```

### 6.2 Backdate / Nomor Mundur

```
Staff buka halaman Surat Keluar
  → Klik "Catat Surat"
  → Centang "Input nomor manual penuh"
  → Isi: perihal, tujuan, tanggal
  → Ketik nomor lengkap: "03/DE/IAI-DKIJKT/V/2026"
  → Klik "Simpan & Catat Nomor"
  → Berhasil! (counter tidak terpengaruh)
```

### 6.3 Surat dengan Approval (Flow Workflow)

```
Staff buka halaman Surat Keluar
  → Klik "Surat Workflow"
  → Isi form lengkap (perihal, tujuan, jenis, pejabat, divisi, draft)
  → Generate nomor di step Draft (pakai kode dari tabel master berdasarkan jenis)
  → Ajukan Persetujuan → Reviu → Pengarsipan → Selesai
```

---

## 7. Dampak ke Sistem Existing

### Yang Tidak Berubah
- Tabel `kode_jenis_surat` tetap ada (jadi sumber saran)
- Tabel `nomor_surat_counter` tetap sama (unified per bulan)
- Counter tetap atomic
- Flow workflow existing tetap berfungsi
- Nomor yang sudah tergenerate tidak berubah
- Halaman admin "Nomor Surat" tetap bisa manage kode (sebagai saran)

### Yang Berubah
- `allocateNomorSurat` terima kode dari parameter (bukan lookup tabel)
- Tambah action `catatSuratCepat` dan `catatSuratManual`
- Halaman utama surat keluar punya 2 tombol aksi
- Modal baru untuk pencatatan cepat

### Backward Compatibility
- `assignNomorSuratKeluar` (flow workflow) masih pakai lookup tabel → tidak break
- Surat yang sudah ada tidak terpengaruh
- Admin yang sudah setup kode tetap bermanfaat (jadi autocomplete)

---

## 8. Rencana Implementasi

### Phase 1 — Backend Core
- [x] Refactor `allocateNomorSurat` — rename `kodeJenis` → `kodeSurat`, terima dari param
- [x] Buat `resolveNomorSuratPrefix()` (hanya ambil prefix, tanpa lookup kode)
- [x] Buat schema `catatSuratCepatSchema`
- [x] Buat server action `catatSuratCepat`
- [x] Buat server action `catatSuratManual` (backdate)
- [x] Buat action `getNextCounter` (preview)
- [x] Buat action `getSaranKode` (autocomplete)
- [x] Pastikan `assignNomorSuratKeluar` (flow workflow) tetap backward compatible

### Phase 2 — Frontend Modal
- [x] Buat komponen `CatatSuratModal.tsx`
- [x] Implementasi input kode dengan combobox/autocomplete
- [x] Implementasi preview nomor real-time
- [x] Implementasi toggle mode manual (backdate)
- [x] Implementasi success state (nomor + copy button)
- [x] Update `SuratKeluarManager.tsx` — tambah tombol "Catat Surat"

### Phase 3 — UX Polish
- [x] Rename tombol workflow (label lebih deskriptif)
- [x] Responsif: modal bekerja baik di mobile
- [x] Keyboard shortcut untuk buka modal
- [x] Empty state hint di tabel

### Phase 4 — Validasi
- [x] Lint + typecheck clean
- [x] Test: catat surat dengan kode custom → nomor benar
- [x] Test: catat surat pilih dari saran → nomor benar
- [x] Test: backdate/manual → counter tidak terpengaruh
- [x] Test: flow workflow existing tidak break
- [x] Test: nomor berurut antara catat cepat dan workflow
- [x] Test: duplikasi nomor manual terdeteksi

---

## 9. File yang Perlu Diubah/Dibuat

| File | Aksi | Keterangan |
|------|------|-----------|
| `src/lib/nomor-surat.ts` | Edit | Rename param, terima kode dari caller |
| `src/lib/nomor-surat-helpers.ts` | Edit | Tambah `resolveNomorSuratPrefix`, pertahankan fungsi lama untuk backward compat |
| `src/server/actions/suratKeluar.ts` | Edit | Tambah `catatSuratCepat`, `catatSuratManual`, `getNextCounter`, `getSaranKode` |
| `src/components/surat-keluar/CatatSuratModal.tsx` | Baru | Modal pencatatan cepat |
| `src/components/surat-keluar/SuratKeluarManager.tsx` | Edit | Tambah tombol + integrasi modal |

---

## 10. Risiko & Mitigasi

| Risiko | Mitigasi |
|--------|----------|
| Staff isi kode sembarangan / typo | Autocomplete dari saran kode meminimalkan typo; kode tetap tercatat di nomor surat |
| Kode tidak konsisten antar staff | Saran kode (dari tabel master) membantu konsistensi; admin bisa tambah saran baru |
| Counter preview berbeda dari final (race condition) | Preview = estimasi, final dari atomic allocate. Tampilkan note "nomor final bisa berbeda jika ada pencatatan bersamaan" |
| Backdate manual bisa duplikat | Validasi uniqueness `nomor_surat` sebelum simpan |
| Flow workflow break karena refactor | Pertahankan `assignNomorSuratKeluar` tetap pakai lookup tabel (backward compat) |

---

## 11. Kriteria Sukses

- [ ] Staff bisa mencatat surat keluar dalam < 30 detik
- [ ] Tidak perlu setup apapun terlebih dahulu
- [ ] Kode di nomor surat bisa diisi bebas (bukan terikat jenis surat)
- [ ] Counter tetap berurut otomatis
- [ ] Backdate / nomor mundur bisa dicatat tanpa mengganggu counter
- [ ] Flow workflow existing tidak terganggu
- [ ] Saran kode mempercepat pengisian (tapi tidak wajib dipilih dari sana)

---

## 12. Catatan

- Perubahan ini mengubah **paradigma** penomoran: dari "sistem tentukan kode berdasarkan jenis" menjadi "user tentukan kode secara bebas".
- Tabel `kode_jenis_surat` tetap berguna sebagai **kamus saran** — admin bisa maintain daftar kode yang umum dipakai.
- Halaman admin "Nomor Surat" tetap ada untuk: melihat counter per bulan, generate bulk (jika diperlukan), dan manage saran kode.
- Ke depan jika organisasi berubah aturan penomoran, cukup ubah format di `allocateNomorSurat` — counter logic dan UI catat tetap sama.
