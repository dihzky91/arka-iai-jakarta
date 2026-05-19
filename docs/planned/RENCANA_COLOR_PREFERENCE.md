# Rencana Implementasi: Color Preference (8 Preset)

## Ringkasan

Fitur yang memungkinkan setiap user memilih tema warna preferensi mereka dari 8 preset yang tersedia. Color picker ditempatkan langsung di **dropdown profil topbar** agar mudah diakses kapan saja tanpa navigasi ke halaman settings — mirip pendekatan INTRA/RisersCRM.

---

## Color Preset

| # | ID | Nama | Nuansa | Mode |
|---|-----|------|--------|------|
| 1 | `ocean` | Ocean | Biru | Light |
| 2 | `emerald` | Emerald | Hijau | Light |
| 3 | `violet` | Violet | Ungu | Light |
| 4 | `rose` | Rose | Merah/pink | Light |
| 5 | `amber` | Amber | Orange/warm | Light |
| 6 | `teal` | Teal | Cyan/turquoise | Light |
| 7 | `midnight` | Midnight | Indigo deep | Dark |
| 8 | `obsidian` | Obsidian | Neutral slate | Dark |

- **Ocean** adalah default (warna biru yang sudah ada sekarang)
- Preset 1–6 adalah light mode dengan aksen warna berbeda
- Preset 7–8 adalah dark mode — user yang mau dark tinggal pilih salah satu ini
- Tidak ada toggle dark/light terpisah — sudah terintegrasi dalam preset

---

## Arsitektur

### Yang Berubah (Scope)

- **Sidebar**: background color mengikuti tema
- **Primary/accent color**: tombol, tab aktif, link, badge
- **Ring/focus color**: outline saat focus
- **Header avatar**: background warna mengikuti tema

### Yang Tidak Berubah

- Layout, typography, spacing — semua tetap
- Konten, icon, gambar — tidak terpengaruh
- Komponen card, border — tetap neutral

---

## Tahapan Implementasi

### Fase 1: Infrastruktur CSS & Theme Definition

**File baru:**
- `src/lib/color-themes.ts` — Definisi 8 preset (nama, label, hex preview, CSS variable overrides)

**File diubah:**
- `src/styles/globals.css` — Tambah CSS class per tema (`.theme-ocean`, `.theme-emerald`, dst) yang override CSS variables (`--primary`, `--ring`, `--sidebar-*`, dll)
- `src/app/layout.tsx` — Wrap dengan `ThemeProvider` dari next-themes (sudah terinstall), konfigurasi `attribute="class"` dan `themes` list

**Detail CSS per tema:**
Setiap tema class akan override minimal:
```css
.theme-emerald {
  --primary: hsl(152 69% 40%);
  --primary-foreground: hsl(0 0% 100%);
  --ring: hsl(152 69% 40%);
  --sidebar-bg: hsl(152 40% 18%);
  --sidebar-foreground: hsl(152 20% 95%);
  --sidebar-accent: hsl(152 50% 25%);
}
```

### Fase 2: Database & Server Actions

**File baru:**
- `drizzle/migrations/00XX_user_color_theme.sql` — Migration untuk tambah kolom
- `src/server/actions/color-theme.ts` — Server actions (`getUserColorTheme`, `setUserColorTheme`)

**File diubah:**
- `src/server/db/schema.ts` — Tambah kolom `colorTheme` di tabel `users` (varchar, default `'ocean'`)

**Schema migration:**
```sql
ALTER TABLE "users" ADD COLUMN "color_theme" varchar(20) DEFAULT 'ocean';
```

> Alasan pakai kolom di `users` langsung (bukan tabel baru): ini cuma 1 field, relasi 1:1, dan sering diakses saat load session.

### Fase 3: Theme Applicator (Client-side)

**File baru:**
- `src/components/theme/ThemeApplicator.tsx` — Client component yang:
  - Membaca colorTheme dari session/context
  - Apply class ke `<html>` element (misal `theme-emerald dark`)
  - Handle transisi smooth saat ganti tema

**File diubah:**
- `src/app/(dashboard)/layout.tsx` — Render `ThemeApplicator` dengan initial theme dari server
- `src/components/layout/DashboardShell.tsx` — Pass `colorTheme` prop

### Fase 4: UI — Color Picker di Dropdown Profil

**File diubah:**
- `src/components/layout/Header.tsx` — Tambah row color swatches di dalam `DropdownMenuContent`, antara info profil dan tombol "Keluar"

**UI Design:**
```
┌─────────────────────────────┐
│  [A] Administrator          │
│       IAI Jakarta           │
├─────────────────────────────┤
│  👤 Peran      Super Admin  │
│  🛡️ Status     TERVERIFIKASI│
├─────────────────────────────┤
│  🎨 Tema                    │
│  ● ● ● ● ● ● ● ●          │
│  (8 color dots)             │
├─────────────────────────────┤
│  ↪ Keluar                   │
└─────────────────────────────┘
```

- 8 dot/circle kecil (w-5 h-5) dengan warna representatif masing-masing tema
- Dot aktif punya ring/border putih + check icon kecil
- Klik dot → langsung apply tema (optimistic update) + save ke server (background)
- Tooltip pada hover menampilkan nama tema

---

## Flow User

1. User klik avatar/nama di topbar → dropdown terbuka
2. Di section "Tema", terlihat 8 dot warna
3. User klik dot hijau (Emerald) → tema langsung berubah (instant, no page reload)
4. Preferensi tersimpan di database → persist antar session/device
5. Saat login berikutnya, tema otomatis di-apply dari server

---

## File Lengkap yang Terlibat

| File | Aksi | Keterangan |
|------|------|------------|
| `src/lib/color-themes.ts` | **Baru** | Definisi 8 preset + helper |
| `src/styles/globals.css` | Ubah | Tambah 8 theme class CSS |
| `src/app/layout.tsx` | Ubah | Wrap ThemeProvider |
| `src/server/db/schema.ts` | Ubah | Tambah kolom `color_theme` di users |
| `drizzle/migrations/00XX_user_color_theme.sql` | **Baru** | DB migration |
| `src/server/actions/color-theme.ts` | **Baru** | Get/set server actions |
| `src/components/theme/ThemeApplicator.tsx` | **Baru** | Apply theme client-side |
| `src/app/(dashboard)/layout.tsx` | Ubah | Load & pass initial theme |
| `src/components/layout/DashboardShell.tsx` | Ubah | Pass colorTheme ke children |
| `src/components/layout/Header.tsx` | Ubah | Tambah color picker di dropdown |

---

## Checklist Implementasi

### Fase 1: Infrastruktur CSS & Theme Definition

- [x] Buat file `src/lib/color-themes.ts` dengan definisi 8 preset (id, label, hex preview, cssClass)
- [x] Definisikan CSS variables baru untuk sidebar (`--sidebar-bg`, `--sidebar-foreground`, `--sidebar-accent`) di `:root`
- [x] Tambah class `.theme-ocean` di `globals.css` (default, sama dengan current)
- [x] Tambah class `.theme-emerald` di `globals.css`
- [x] Tambah class `.theme-violet` di `globals.css`
- [x] Tambah class `.theme-rose` di `globals.css`
- [x] Tambah class `.theme-amber` di `globals.css`
- [x] Tambah class `.theme-teal` di `globals.css`
- [x] Tambah class `.theme-midnight` di `globals.css` (dark mode)
- [x] Tambah class `.theme-obsidian` di `globals.css` (dark mode)
- [x] Install/setup `ThemeProvider` dari next-themes di `src/app/layout.tsx`
- [x] Konfigurasi `attribute="class"`, `themes` list, dan `defaultTheme="ocean"`
- [x] Verifikasi tidak ada flash of unstyled content (FOUC) saat load

### Fase 2: Database & Server Actions

- [x] Tambah kolom `color_theme` (varchar 20, default 'ocean', NOT NULL) di tabel `users` pada schema
- [x] Buat migration file `drizzle/migrations/0056_user_color_theme.sql`
- [x] Jalankan migration dan verifikasi kolom terbuat (`drizzle-kit push --force`)
- [x] Buat file `src/server/actions/color-theme.ts`
- [x] Implementasi `getUserColorTheme()` — return theme dari session user
- [x] Implementasi `setUserColorTheme(theme: string)` — validasi input + update DB
- [x] Tambah validasi: hanya terima 8 theme ID yang valid
- [x] Verifikasi server action bisa dipanggil dari client

### Fase 3: Theme Applicator (Client-side)

- [x] Buat file `src/components/theme/ThemeApplicator.tsx`
- [x] Komponen membaca initial theme dari prop (server-rendered)
- [x] Apply class ke `<html>` element saat mount (hanya sync sekali via useRef)
- [x] Handle perubahan tema secara reactive (tanpa page reload)
- [x] Tambah CSS transition di `<body>` untuk smooth color change
- [x] Render `ThemeApplicator` di `src/app/(dashboard)/layout.tsx`
- [x] Pass initial `colorTheme` dari server (session) ke DashboardShell → ThemeApplicator
- [x] Verifikasi tema persist setelah navigasi antar halaman
- [x] Verifikasi tema correct saat hard refresh

### Fase 4: UI — Color Picker di Dropdown Profil

- [x] Tambah section "Tema" di `DropdownMenuContent` pada `Header.tsx`
- [x] Render 8 color dot/swatch (w-5 h-5, rounded-full) dengan warna representatif
- [x] Tambah visual indicator pada dot aktif (ring/border + check icon)
- [x] Implementasi onClick handler: optimistic update (langsung apply class)
- [x] Panggil `setUserColorTheme()` server action di background setelah klik
- [x] Tambah tooltip pada hover yang menampilkan nama tema
- [x] Verifikasi dropdown tidak tertutup saat klik dot warna
- [x] Verifikasi tema tersimpan dan persist antar session
- [x] Test responsive: pastikan dot warna terlihat baik di mobile dropdown

### Fase 5: Integrasi & Polish

- [x] Update sidebar component agar gunakan CSS variable `--sidebar-bg` (bukan hardcoded)
- [x] Verifikasi semua 8 tema terlihat baik pada: sidebar, header, tab aktif, tombol, badge
- [x] Verifikasi dark themes (midnight, obsidian) tidak ada teks yang tidak terbaca
- [ ] Verifikasi light themes tidak ada kontras yang terlalu rendah
- [ ] Test pada halaman: Dashboard, Kalender, Pengaturan, Surat Masuk
- [ ] Pastikan chart colors tetap readable di semua tema
- [x] Cleanup: hapus hardcoded color di komponen yang seharusnya pakai CSS variable
- [ ] Final review: build production berhasil tanpa error

---

## Estimasi Effort

| Fase | Estimasi |
|------|----------|
| Fase 1: CSS & Theme Definition | ~2 jam |
| Fase 2: Database & Server Actions | ~1 jam |
| Fase 3: Theme Applicator | ~1 jam |
| Fase 4: UI Color Picker | ~1.5 jam |
| Fase 5: Integrasi & Polish | ~1 jam |
| **Total** | **~6.5 jam** |

---

## Dependensi

- `next-themes` — sudah terinstall (v0.4.6) ✅
- Tidak perlu package tambahan

---

## Catatan Teknis

- **SSR/Hydration**: Gunakan `suppressHydrationWarning` (sudah ada) + next-themes handle flash prevention
- **Sidebar color**: Perlu tambah CSS variable baru (`--sidebar-bg`, `--sidebar-foreground`, `--sidebar-accent`) karena sidebar saat ini pakai warna hardcoded
- **Transition**: Tambah `transition-colors duration-200` di `<body>` agar perpindahan tema smooth
- **Fallback**: Jika user belum set preferensi, default ke `ocean` (biru, sama seperti sekarang)
- **Performance**: Theme class di-apply di `<html>` level, CSS variables cascade ke semua children — tidak ada re-render React
