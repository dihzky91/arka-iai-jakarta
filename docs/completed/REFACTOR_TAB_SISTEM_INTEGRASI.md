# Refactor Tab "Sistem & Integrasi" — Halaman Pengaturan

## Latar Belakang

Tab "Sistem & Integrasi" di halaman Pengaturan saat ini mencampur dua concern:
1. **Konfigurasi** — setting yang bisa diubah admin dari UI
2. **Status monitoring** — info read-only dari environment variable

Akibatnya, halaman terasa seperti dashboard informasi, bukan panel kontrol.
Admin harus scroll melewati banyak card read-only untuk menemukan yang actionable.

---

## Kondisi Saat Ini

### Komponen yang Actionable ✏️
| Komponen | Fungsi |
|----------|--------|
| `KonfigurasiSistemCard` | Default deadline, kill switch email, pilih provider, kontak keuangan |
| `TestConnectionCard` | Test koneksi email, storage, database, DingTalk |
| `WhatsappBotStatusCard` | Status + panduan setup WA bot |
| `WhatsappTemplateSettingsCard` | Edit template pesan WA |

### Komponen Read-Only 👁️ (tidak bisa diubah dari UI)
| Komponen/Section | Konten |
|------------------|--------|
| Summary Cards (3x) | Storage, Cloudinary, Hardening — duplikat info di bawah |
| SettingsCard "Storage File" | Provider, batas file, base URL, direktori lokal |
| SettingsCard "Integrasi Eksternal" | Status Cloudinary, Mailjet, Brevo |
| SettingsCard "Sistem" | Environment, timezone, database, auth secret |
| Card "Catatan Pengelolaan" | Teks penjelasan batas UI vs env |
| Card "Tipe File Diizinkan" | Daftar MIME types |

---

## Rencana Refactor

### Prinsip
1. **Actionable first** — yang bisa diubah tampil paling atas, tanpa perlu scroll
2. **Status sebagai supporting info** — collapsible, tidak mengambil ruang dominan
3. **Hapus duplikasi** — summary cards dihilangkan karena redundan
4. **Catatan jadi kontekstual** — inline hint, bukan card terpisah

### Struktur Baru Tab "Sistem & Integrasi"

```
┌─────────────────────────────────────────────────────┐
│  SECTION 1: Konfigurasi Aplikasi                    │
│  ┌──────────────────────┐ ┌──────────────────────┐  │
│  │ KonfigurasiSistemCard│ │ TestConnectionCard   │  │
│  │ (deadline, email,    │ │ (test email, storage,│  │
│  │  provider, finance)  │ │  database, dingtalk) │  │
│  └──────────────────────┘ └──────────────────────┘  │
├─────────────────────────────────────────────────────┤
│  SECTION 2: WhatsApp                                │
│  ┌──────────────────────────────────────────────┐   │
│  │ WhatsappBotStatusCard (status + setup guide) │   │
│  └──────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────┐   │
│  │ WhatsappTemplateSettingsCard (edit template)  │   │
│  └──────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  SECTION 3: Status Infrastruktur (collapsible)      │
│  [▸ Lihat Status Infrastruktur]                     │
│                                                     │
│  Saat dibuka:                                       │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐      │
│  │ Storage    │ │ Integrasi  │ │ Runtime    │      │
│  │ provider,  │ │ Cloudinary,│ │ env, tz,   │      │
│  │ batas, dir │ │ email stats│ │ db, auth   │      │
│  └────────────┘ └────────────┘ └────────────┘      │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ MIME types (inline badges, tanpa card header) │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ℹ️ Info: Perubahan env (secret, DB URL, API key)   │
│     dilakukan via file .env atau panel hosting.     │
└─────────────────────────────────────────────────────┘
```

---

## Detail Perubahan

### 1. Hapus Summary Cards
**File:** `SistemStatusSection.tsx`
**Aksi:** Hapus section `SummaryCard` (Storage/Cloudinary/Hardening). Info ini sudah ada di SettingsCard di bawahnya.

### 2. Bungkus Status Read-Only dalam Collapsible
**File:** `SistemStatusSection.tsx`
**Aksi:** Wrap ketiga `SettingsCard` (Storage, Integrasi, Sistem) + MIME types + Catatan dalam komponen collapsible menggunakan `Collapsible` dari shadcn/ui.

- Default state: **collapsed**
- Label trigger: "Lihat Status Infrastruktur"
- Saat open: tampilkan card-card status seperti sekarang

### 3. Ubah "Catatan Pengelolaan" Jadi Inline Info
**File:** `SistemStatusSection.tsx`
**Aksi:** Ganti card "Catatan Pengelolaan" menjadi satu baris `Alert` kecil di dalam collapsible section:

```
ℹ️ Perubahan secret (DB URL, API key) tetap dilakukan via file .env atau panel hosting.
```

### 4. MIME Types Masuk ke Collapsible (Tanpa Card Header Besar)
**File:** `SistemStatusSection.tsx`
**Aksi:** Render MIME badges langsung sebagai bagian dari collapsible content, dengan label kecil "Tipe file diizinkan:" — tanpa wrapper Card/CardHeader yang besar.

### 5. Pindahkan Actionable Cards ke Atas (Sudah Benar)
Layout saat ini sudah menempatkan `KonfigurasiSistemCard` + `TestConnectionCard` di atas.
Pastikan urutan tetap: Konfigurasi → Test → WA Status → WA Template → (collapsible status).

---

## File yang Terpengaruh

| File | Perubahan |
|------|-----------|
| `src/components/pengaturan/SistemStatusSection.tsx` | Refactor utama: hapus summary cards, wrap read-only dalam collapsible, ubah catatan jadi inline |
| `src/components/pengaturan/PengaturanTabs.tsx` | Tidak perlu diubah |
| `src/app/(dashboard)/pengaturan/page.tsx` | Tidak perlu diubah (data fetching tetap sama) |

---

## Yang TIDAK Berubah
- Semua 8 tab lainnya tetap sama
- Data fetching dan server actions tidak berubah
- Fungsionalitas konfigurasi (save, test, dll) tetap identik
- Permission check tetap sama

---

## Acceptance Criteria
- [x] Summary cards (Storage/Cloudinary/Hardening) dihapus
- [x] Card read-only (Storage File, Integrasi, Sistem) dibungkus collapsible, default collapsed
- [x] Card "Catatan Pengelolaan" diganti inline info/alert di dalam collapsible
- [x] MIME types tampil ringkas di dalam collapsible tanpa card header besar
- [x] Actionable cards (Konfigurasi, Test, WA) tetap langsung terlihat tanpa scroll
- [x] Tidak ada perubahan fungsionalitas — hanya reorganisasi layout
- [x] Mobile responsive tetap terjaga

---

## Audit Implementasi

**Tanggal:** 3 Juni 2026

### Perubahan yang dilakukan:
| Item | Status | Detail |
|------|--------|--------|
| Hapus `SummaryCard` component | ✅ Done | Komponen dan 3 cards (Storage/Cloudinary/Hardening) dihapus |
| Hapus import `Cloud`, `ShieldCheck` | ✅ Done | Unused icons removed |
| Tambah `"use client"` directive | ✅ Done | Diperlukan untuk `useState` pada collapsible |
| Tambah `useState`, `ChevronDown` imports | ✅ Done | Untuk collapsible toggle |
| Wrap status cards dalam collapsible | ✅ Done | Button toggle dengan animasi rotate chevron |
| Card "Catatan Pengelolaan" → inline note | ✅ Done | Satu paragraf dengan icon Info, di dalam collapsible |
| Card "Tipe File Diizinkan" → inline badges | ✅ Done | Label + badges tanpa Card wrapper |
| Preserve `SettingsCard` + `StatusRow` | ✅ Done | Tetap ada di dalam collapsible, tidak dihapus |
| TypeScript compile | ✅ Pass | 0 errors terkait file ini (26 errors pre-existing di test files) |
| LSP diagnostics | ✅ Pass | No diagnostics pada file yang diubah |

### Yang dipertahankan (tidak berubah):
- KonfigurasiSistemCard — tetap di atas
- TestConnectionCard — tetap di atas
- WhatsappBotStatusCard — tetap terlihat langsung
- WhatsappTemplateSettingsCard — tetap terlihat langsung
- Semua data fetching di page.tsx — tidak berubah
- Props interface — tidak berubah
- Permission logic — tidak berubah

### Dependency baru: Tidak ada
- Collapsible diimplementasikan dengan native `useState` + button
- Tidak perlu install package tambahan
