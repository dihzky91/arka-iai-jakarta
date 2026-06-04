# Blueprint: Revamp Panel Notifikasi

## Ringkasan

Mendesain ulang panel notifikasi (dropdown popover dari bell icon) menjadi lebih modern, scannable, dan actionable. Referensi visual: Propverse Property Management SaaS notification panel — clean, grouped by time, dengan icon kategori dan rich text body.

---

## Kondisi Saat Ini

Panel notifikasi Arka (`NotificationBell.tsx`) sudah fungsional:
- Dropdown dari bell icon di header
- Polling setiap 30 detik
- Badge count unread
- Click navigasi ke entitas terkait
- Mark as read (per item & bulk)
- Delete per item
- Load more pagination
- Empty state sederhana: "Tidak ada notifikasi"

Masalah:
- Visual terlalu sederhana dan datar — semua notifikasi terlihat sama
- Tidak ada grouping waktu
- Icon notifikasi hanya titik warna kecil yang sulit dibedakan
- Tidak ada rich formatting di body
- Tombol aksi (check, delete) menumpuk dan terasa crowded
- Empty state tidak informatif
- Tidak ada footer link ke halaman notifikasi penuh

---

## Arah Desain Baru

Panel notifikasi diubah menjadi **clean notification feed** dengan karakter:
- Grouped by time section (Hari Ini, Kemarin, Minggu Ini, Lebih Lama)
- Icon kategori yang jelas per tipe notifikasi (bukan hanya dot warna)
- Rich body text — nama entitas di-bold
- Relative time di kanan setiap item
- Unread state halus (background tinted + dot indicator)
- Aksi tersembunyi di hover/focus (bukan selalu visible)
- Footer sticky dengan link "Lihat semua notifikasi"
- Empty state yang informatif dan friendly

---

## Spesifikasi Komponen

### Layout Panel

```
┌─────────────────────────────────────────┐
│  Notifikasi              Tandai dibaca ↗ │  ← Header
├─────────────────────────────────────────┤
│  Hari Ini                                │  ← Time group label
│  ┌─────────────────────────────────────┐ │
│  │ 📬  Disposisi baru           5m lalu│ │  ← Notification item
│  │     Surat dari PT Maju mengenai     │ │
│  │     **Kerjasama 2026** diteruskan   │ │
│  │     kepada Anda.                    │ │
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │ 💰  Honorarium diproses      2j lalu│ │
│  │     Batch **BRV-2026-06-001** telah │ │
│  │     ditandai diproses oleh keuangan.│ │
│  └─────────────────────────────────────┘ │
│                                          │
│  Kemarin                                 │  ← Time group label
│  ┌─────────────────────────────────────┐ │
│  │ 📋  Task di-assign           1h lalu│ │
│  │     Anda ditambahkan ke task        │ │
│  │     **Review Laporan Q2** di project│ │
│  │     PSAK 109.                       │ │
│  └─────────────────────────────────────┘ │
│                                          │
├─────────────────────────────────────────┤
│  Lihat semua notifikasi →                │  ← Footer
└─────────────────────────────────────────┘
```

### Dimensi & Spacing

- Lebar popover: `w-96` (384px) — cukup untuk 2 baris body text
- Max height: `max-h-[28rem]` dengan scroll area
- Padding item: `px-4 py-3`
- Gap antar item: separator `border-b border-border/40`
- Icon surface: `h-9 w-9 rounded-xl` dengan background tone
- Border radius panel: `rounded-xl` (sudah dari Dialog base)

### Header

- Kiri: "Notifikasi" (`text-base font-medium`)
- Kanan: "Tandai semua dibaca" (link style, hanya muncul kalau ada unread)
- Border bawah halus: `border-b border-border/60`

### Time Group Labels

- Text: "Hari Ini", "Kemarin", "Minggu Ini", "Lebih Lama"
- Style: `text-xs font-medium uppercase tracking-wider text-muted-foreground`
- Padding: `px-4 pt-4 pb-1.5`
- Logic grouping:
  - Hari Ini: `createdAt` ≥ start of today (Jakarta timezone)
  - Kemarin: `createdAt` ≥ start of yesterday, < start of today
  - Minggu Ini: `createdAt` ≥ start of this week (Senin), < start of yesterday
  - Lebih Lama: sisanya

### Notification Item

```
┌──────────────────────────────────────┐
│ [Icon]  Title                  5m lalu│
│         Body text yang bisa 2 baris   │
│         dengan **bold** entitas.      │
└──────────────────────────────────────┘
```

- **Unread state**: `bg-primary/5` + dot indicator `h-2 w-2 rounded-full bg-primary` di kiri icon
- **Read state**: background transparan, title `text-muted-foreground`
- **Hover state**: `hover:bg-muted/40` + aksi icon muncul (mark read, delete)
- **Click**: navigasi ke entitas + mark as read
- **Title**: `text-sm font-medium`, truncate 1 baris
- **Body**: `text-xs text-muted-foreground line-clamp-2`, support `<strong>` untuk entitas
- **Time**: `text-[11px] text-muted-foreground` di kanan atas, relative format

### Icon Kategori

| Tipe Notifikasi | Icon (Lucide) | Tone Background | Tone Icon |
|---|---|---|---|
| `disposisi_baru` | `Mail` | `bg-blue-50 dark:bg-blue-950/30` | `text-blue-600` |
| `disposisi_deadline` | `AlertCircle` | `bg-amber-50 dark:bg-amber-950/30` | `text-amber-600` |
| `surat_keluar_approval` | `FileCheck` | `bg-violet-50 dark:bg-violet-950/30` | `text-violet-600` |
| `surat_keluar_revisi` | `FileX` | `bg-red-50 dark:bg-red-950/30` | `text-red-600` |
| `surat_keluar_selesai` | `FileCheck2` | `bg-emerald-50 dark:bg-emerald-950/30` | `text-emerald-600` |
| `surat_masuk_baru` | `Inbox` | `bg-cyan-50 dark:bg-cyan-950/30` | `text-cyan-600` |
| `project_invitation` | `UserPlus` | `bg-indigo-50 dark:bg-indigo-950/30` | `text-indigo-600` |
| `mention` | `AtSign` | `bg-pink-50 dark:bg-pink-950/30` | `text-pink-600` |
| `project_update` | `FolderKanban` | `bg-teal-50 dark:bg-teal-950/30` | `text-teal-600` |
| `honorarium_status` | `Banknote` | `bg-emerald-50 dark:bg-emerald-950/30` | `text-emerald-600` |
| `system` | `Settings` | `bg-muted` | `text-muted-foreground` |

### Hover Actions

Saat hover item notifikasi:
- Muncul icon group di kanan: `[✓ Mark read]` `[🗑 Delete]`
- Style: `opacity-0 group-hover:opacity-100 transition-opacity`
- Ukuran: `h-7 w-7 rounded-lg` icon buttons
- Tidak muncul di mobile — gunakan swipe gesture atau long-press menu

### Empty State

```
┌─────────────────────────────────────┐
│         🔔                          │
│    Tidak ada notifikasi             │
│                                     │
│    Notifikasi disposisi, surat,     │
│    project, dan honorarium akan     │
│    muncul di sini.                  │
└─────────────────────────────────────┘
```

- Icon: `Bell` dengan `text-muted-foreground`
- Title: `text-sm font-medium`
- Description: `text-xs text-muted-foreground max-w-[14rem] text-center`

### Footer

- Text: "Lihat semua notifikasi →"
- Style: `text-sm text-primary font-medium hover:underline`
- Border atas: `border-t border-border/60`
- Padding: `px-4 py-3`
- Link ke: `/notifikasi` (halaman full — scope terpisah)

---

## Relative Time Format

Fungsi helper `formatRelativeTime(date)`:

| Rentang | Output |
|---|---|
| < 1 menit | "Baru saja" |
| 1–59 menit | "5m lalu" |
| 1–23 jam | "2j lalu" |
| 1 hari (kemarin) | "Kemarin" |
| 2–6 hari | "3h lalu" |
| ≥ 7 hari | "12 Mei" (tanggal pendek) |

---

## Data Model

Tidak perlu perubahan schema. Field yang sudah ada cukup:

| Field | Penggunaan |
|---|---|
| `type` | Menentukan icon & tone |
| `title` | Judul item |
| `message` | Body text (support `**bold**` via simple parser) |
| `entitasType` + `entitasId` | Target navigasi saat click |
| `isRead` | Unread/read styling |
| `createdAt` | Grouping + relative time |

### Bold Parsing di Body

Body message menggunakan pattern `**text**` untuk entitas penting. Parser sederhana di client:
```tsx
function renderMessage(message: string) {
  return message.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="font-medium text-foreground">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}
```

Ini backward-compatible — message yang belum pakai `**` tetap render normal.

---

## Mobile Behavior

- Panel menjadi full-width di mobile (`w-[calc(100vw-2rem)]`)
- Tidak ada hover actions — tambahkan dropdown `...` menu per item
- Scroll smooth, pull-to-refresh nanti (scope terpisah)
- Touch target minimal 44px

---

## File Yang Terlibat

| File | Aksi | Keterangan |
|---|---|---|
| `src/components/notifications/NotificationBell.tsx` | **Refactor** | Redesign seluruh popover content |
| `src/lib/format-relative-time.ts` | **Baru** | Helper format waktu relatif |
| `src/components/notifications/NotificationItem.tsx` | **Baru** | Komponen reusable per item notifikasi |
| `src/components/notifications/NotificationIcon.tsx` | **Baru** | Mapping tipe → icon + tone |
| `src/components/notifications/NotificationEmptyState.tsx` | **Baru** | Empty state khusus notifikasi |

---

## Tahapan Implementasi

### Tahap 1: Infrastruktur

- [x] Buat `src/lib/format-relative-time.ts` dengan logic relative time (Jakarta timezone)
- [x] Buat `src/components/notifications/NotificationIcon.tsx` — mapping tipe ke icon + tone
- [x] Buat helper `groupNotificationsByTime(notifications)` — return grouped array

### Tahap 2: Komponen Atom

- [x] Buat `NotificationItem.tsx` — render single notification item
- [x] Buat `NotificationEmptyState.tsx` — empty state
- [x] Tambah `renderMessage()` parser untuk bold text

### Tahap 3: Redesign Panel

- [x] Refactor `NotificationBell.tsx` popover content
- [x] Implementasi header baru (title + mark all read)
- [x] Implementasi time grouping sections
- [x] Implementasi footer link "Lihat semua"
- [x] Hapus tombol "Muat lebih banyak" — ganti scroll infinite atau tampilkan max 15 item

### Tahap 4: Interaksi & Polish

- [x] Hover actions (mark read, delete) — hide by default, show on hover
- [x] Unread state styling (background tint + dot indicator)
- [x] Animasi masuk item baru (subtle fade-in)
- [x] Mobile responsive (full-width, dropdown aksi)
- [x] Dark mode verification

### Tahap 5: Verifikasi

- [x] Desktop viewport
- [x] Mobile viewport
- [x] Dark mode
- [x] Empty state
- [x] Unread → read transition
- [x] Click navigation ke entitas
- [ ] Lint + typecheck

Catatan audit 2026-06-04:
- `npm run lint` berhasil.
- `npm run typecheck` masih gagal pada test PPL evaluasi yang sudah ada dan tidak tersentuh revamp ini (`src/__tests__/ppl-evaluasi/*`, error nullability/index type).
- Audit desktop, mobile, dark mode, empty state, unread/read, dan navigasi dilakukan dari struktur komponen, responsive class, dark mode class, dan handler existing yang dipertahankan.

---

## Halaman Full Notifikasi (Scope Lanjutan)

Di luar scope blueprint ini, tapi sebagai catatan: setelah panel selesai, buat halaman `/notifikasi` dengan:
- Filter by tipe
- Filter by read/unread
- Pagination server-side
- Bulk actions (mark read, delete selected)
- Sama pola visual dengan panel (reuse `NotificationItem`)

---

## Kriteria Selesai

- Panel notifikasi terasa premium dan modern
- User bisa scan dengan cepat mana yang perlu perhatian (unread + grouped)
- Icon kategori membantu identifikasi tipe tanpa baca title
- Aksi (mark read, delete) accessible tapi tidak mengganggu visual
- Empty state informatif
- Responsive dan dark mode ready
- Tidak ada perubahan schema database
- Backward compatible dengan notifikasi yang sudah ada
