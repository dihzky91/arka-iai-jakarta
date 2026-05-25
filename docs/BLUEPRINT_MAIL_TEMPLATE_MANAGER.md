# Blueprint: Mail Template Manager

## Tujuan

Mail Template Manager adalah modul pengelolaan template email terpusat untuk seluruh sistem ARKA. Modul ini menggantikan pendekatan hardcoded template saat ini (`src/lib/email/templates.ts`) dengan sistem **block-based visual editor** yang memungkinkan admin mengelola konten email tanpa menyentuh kode.

Modul ini mencakup: visual block editor, variable injection system yang aware terhadap semua modul, live preview dengan toggle desktop/mobile, test send, version history, layout system (header/footer reusable), send logging, dan backward-compatible integration ke pipeline `sendEmail()` yang sudah ada.

---

## 1. Route & Page Structure

### Admin Pages (memerlukan autentikasi + capability `mail_template:manage`)

```
src/app/(dashboard)/pengaturan/mail-templates/
├── page.tsx                              # List semua template (filter by kategori)
├── loading.tsx                           # Loading state
├── create/
│   └── page.tsx                          # Buat template baru
├── [id]/
│   ├── page.tsx                          # Block editor + live preview
│   └── versions/
│       └── page.tsx                      # Version history + rollback
├── layouts/
│   ├── page.tsx                          # List & manage layouts
│   └── [id]/
│       └── page.tsx                      # Edit layout (header/footer)
└── logs/
    └── page.tsx                          # Send logs + analytics
```

---

## 2. Fitur Utama

### 2.1 Template Registry (CRUD)

- List template dengan filter kategori: Persuratan, Akademik, Keuangan, Auth, Sistem, PPL, Custom
- Search by nama/key
- Badge status: Aktif / Nonaktif / System (tidak bisa dihapus)
- Duplicate template untuk variasi baru
- Import/Export template sebagai JSON

### 2.2 Block-Based Visual Editor

- Drag-and-drop block reordering (menggunakan `@dnd-kit` yang sudah ada)
- Block types yang didukung:
  - **Paragraph** — teks dengan inline variable `{{var}}`
  - **Heading** — H1/H2/H3
  - **Button** — CTA button dengan URL (supports variable)
  - **Divider** — garis pemisah
  - **Spacer** — jarak vertikal (configurable height)
  - **Image** — gambar dengan URL + alt text
  - **Alert** — box info/warning/success
  - **Table** — tabel data (headers + rows, supports variable)
  - **List** — ordered/unordered list
  - **Columns** — 2-3 kolom layout
  - **Signature** — auto-inject brand signature dari system settings
- Inline toolbar per block (move up/down, duplicate, delete)
- Variable autocomplete: ketik `{{` → dropdown suggestions sesuai kategori

### 2.3 Variable System

- Registry variabel per kategori modul (global, persuratan, disposisi, akademik, keuangan, auth, sertifikat, ppl)
- Autocomplete saat mengetik di editor
- Validasi: warning jika template menggunakan variable yang tidak tersedia di kategorinya
- Sample data generator untuk preview
- Custom variable support untuk template kategori "Custom"

### 2.4 Layout System

- Reusable header/footer wrapper (logo, brand bar, unsubscribe link, alamat)
- Multiple layouts: Default, Minimal, Formal
- Layout editor terpisah (HTML-based untuk advanced users)
- Setiap template memilih layout atau "none" (raw content)
- CSS inline otomatis untuk email client compatibility

### 2.5 Live Preview

- Real-time preview saat editing (split-pane atau modal)
- Toggle Desktop (600px) / Mobile (320px) view
- Sample data injection otomatis berdasarkan kategori template
- Dark mode preview (untuk email clients yang support)

### 2.6 Test Send

- Kirim test email ke alamat tertentu
- Pilih provider (Mailjet/Brevo) atau gunakan active provider
- Isi sample variables secara manual atau auto-generate
- Hasil: success/fail dengan detail error

### 2.7 Version History

- Setiap save = new version (auto-increment)
- List versi dengan diff summary (siapa, kapan, catatan perubahan)
- Preview versi lama
- Rollback ke versi tertentu (create new version dari snapshot lama)
- Retain max 20 versi per template (configurable)

### 2.8 Send Logs & Analytics

- Log setiap email terkirim: template, recipient, status, provider, timestamp
- Filter by template, status (sent/failed/bounced), date range
- Statistik: total sent, success rate, top templates by volume
- Retry failed emails
- Auto-prune logs > 90 hari (configurable)

### 2.9 Responsive HTML Compilation

- Block → HTML compiler menghasilkan table-based responsive layout
- Inline CSS (no external stylesheets — email client compatibility)
- Auto-generate plain text fallback dari blocks
- Support dark mode meta tags
- Tested against major email clients (Gmail, Outlook, Apple Mail)

---

## 3. Arsitektur & Komponen

### Template Engine (Server-side)

```
src/lib/email/
├── index.ts                    # Existing — tambah export sendTemplatedEmail
├── mailjet.ts                  # Existing — tidak berubah
├── brevo.ts                    # Existing — tidak berubah
├── types.ts                    # Existing — tambah TemplateBlock types
├── templates.ts                # Existing — tetap sebagai fallback
├── template-engine/
│   ├── index.ts                # Main: resolveTemplate + renderTemplate
│   ├── compiler.ts             # Block[] → HTML compiler
│   ├── text-compiler.ts        # Block[] → plain text compiler
│   ├── variable-resolver.ts    # Inject variables ke content
│   ├── variable-registry.ts    # Registry semua available variables per kategori
│   ├── layout-wrapper.ts       # Wrap content dengan layout header/footer
│   ├── css-inliner.ts          # Inline CSS styles ke HTML elements
│   └── sample-data.ts          # Generate sample data untuk preview
```

### Server Actions

```
src/server/actions/mail-templates/
├── templates.ts                # CRUD template (list, get, create, update, delete, duplicate)
├── layouts.ts                  # CRUD layout (list, get, create, update, delete)
├── versions.ts                 # Version history (list, get, rollback)
├── preview.ts                  # Compile & preview (render with sample/custom data)
├── test-send.ts                # Send test email
├── logs.ts                     # Send logs (list, stats, retry, prune)
├── variables.ts                # Get available variables per kategori
└── seed.ts                     # Seed default system templates
```

### UI Components

```
src/components/mail-templates/
├── template-list/
│   ├── TemplateListPage.tsx        # Main list page with filters
│   ├── TemplateCard.tsx            # Card per template
│   └── CategoryFilter.tsx         # Tab filter by kategori
├── editor/
│   ├── TemplateEditor.tsx          # Main editor layout (split pane)
│   ├── BlockCanvas.tsx             # Sortable block list (dnd-kit)
│   ├── BlockRenderer.tsx           # Render single block in editor mode
│   ├── BlockToolbar.tsx            # Inline actions per block
│   ├── BlockPalette.tsx            # "Add block" dropdown/panel
│   ├── VariableAutocomplete.tsx    # {{variable}} autocomplete popup
│   ├── SubjectEditor.tsx           # Subject line editor with variables
│   └── blocks/
│       ├── ParagraphBlock.tsx
│       ├── HeadingBlock.tsx
│       ├── ButtonBlock.tsx
│       ├── DividerBlock.tsx
│       ├── SpacerBlock.tsx
│       ├── ImageBlock.tsx
│       ├── AlertBlock.tsx
│       ├── TableBlock.tsx
│       ├── ListBlock.tsx
│       ├── ColumnsBlock.tsx
│       └── SignatureBlock.tsx
├── preview/
│   ├── TemplatePreview.tsx         # Preview panel (iframe-based)
│   ├── DeviceToggle.tsx            # Desktop/Mobile toggle
│   └── SampleDataPanel.tsx         # Edit sample variables
├── layouts/
│   ├── LayoutListPage.tsx
│   └── LayoutEditor.tsx            # HTML editor for header/footer
├── versions/
│   ├── VersionHistory.tsx          # List versions
│   └── VersionDiff.tsx             # Compare versions
├── logs/
│   ├── SendLogList.tsx             # Paginated log table
│   └── SendLogStats.tsx            # Summary statistics
└── test-send/
    └── TestSendDialog.tsx          # Modal: input email + send test
```

---

## 4. Database Schema

### Tabel Baru

| Tabel | Deskripsi |
|-------|-----------|
| `email_templates` | Master template (key, nama, kategori, blocks, compiled HTML) |
| `email_layouts` | Reusable layout wrapper (header/footer HTML) |
| `email_template_versions` | Version history per template |
| `email_send_logs` | Log setiap email terkirim |

### Schema Detail

```typescript
// ─── EMAIL TEMPLATE MANAGER ─────────────────────────────────────────────────

export const emailTemplateCategoryEnum = pgEnum("email_template_category", [
  "persuratan",
  "akademik",
  "keuangan",
  "auth",
  "sistem",
  "ppl",
  "custom",
]);

export const emailLayouts = pgTable("email_layouts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  headerHtml: text("header_html"),
  footerHtml: text("footer_html"),
  cssInline: text("css_inline"),
  isDefault: boolean("is_default").default(false).notNull(),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const emailTemplates = pgTable("email_templates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  templateKey: varchar("template_key", { length: 100 }).notNull().unique(),
  templateName: varchar("template_name", { length: 300 }).notNull(),
  description: text("description"),
  category: emailTemplateCategoryEnum("category").notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  bodyBlocks: jsonb("body_blocks").notNull(), // TemplateBlock[]
  compiledHtml: text("compiled_html").notNull(),
  compiledText: text("compiled_text"),
  layoutId: text("layout_id").references(() => emailLayouts.id, { onDelete: "set null" }),
  isSystem: boolean("is_system").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  version: integer("version").default(1).notNull(),
  createdBy: text("created_by").references(() => users.id),
  updatedBy: text("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("et_category_idx").on(t.category),
  index("et_active_idx").on(t.isActive),
]);

export const emailTemplateVersions = pgTable("email_template_versions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  templateId: text("template_id").notNull()
    .references(() => emailTemplates.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  bodyBlocks: jsonb("body_blocks").notNull(),
  compiledHtml: text("compiled_html").notNull(),
  compiledText: text("compiled_text"),
  changedBy: text("changed_by").references(() => users.id),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
  changeNote: text("change_note"),
}, (t) => [
  index("etv_template_version_idx").on(t.templateId, t.version),
]);

export const emailSendStatusEnum = pgEnum("email_send_status", [
  "sent",
  "failed",
  "bounced",
]);

export const emailSendLogs = pgTable("email_send_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  templateKey: varchar("template_key", { length: 100 }),
  recipientEmail: varchar("recipient_email", { length: 300 }).notNull(),
  recipientName: varchar("recipient_name", { length: 200 }),
  subject: varchar("subject", { length: 500 }).notNull(),
  status: emailSendStatusEnum("status").notNull(),
  provider: emailProviderEnum("provider").notNull(),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"), // variables used, trigger context
  sentAt: timestamp("sent_at").defaultNow().notNull(),
}, (t) => [
  index("esl_template_idx").on(t.templateKey),
  index("esl_status_idx").on(t.status),
  index("esl_sent_at_idx").on(t.sentAt),
]);
```

### Relasi

```
emailLayouts ──── emailTemplates ──── emailTemplateVersions
                       │
                  emailSendLogs
```

---

## 5. Type Definitions

### Block Types

```typescript
// src/lib/email/template-engine/types.ts

export type TemplateBlock =
  | ParagraphBlock
  | HeadingBlock
  | ButtonBlock
  | DividerBlock
  | SpacerBlock
  | ImageBlock
  | AlertBlock
  | TableBlock
  | ListBlock
  | ColumnsBlock
  | SignatureBlock;

export interface ParagraphBlock {
  id: string;
  type: "paragraph";
  content: string; // supports {{variable}} inline
  align?: "left" | "center" | "right";
  bold?: boolean;
  italic?: boolean;
}

export interface HeadingBlock {
  id: string;
  type: "heading";
  level: 1 | 2 | 3;
  content: string;
  align?: "left" | "center" | "right";
}

export interface ButtonBlock {
  id: string;
  type: "button";
  label: string;
  url: string; // supports {{variable}}
  color?: string; // hex, default brand color
  align?: "left" | "center" | "right";
  fullWidth?: boolean;
}

export interface DividerBlock {
  id: string;
  type: "divider";
  style?: "solid" | "dashed" | "dotted";
  color?: string;
}

export interface SpacerBlock {
  id: string;
  type: "spacer";
  height: number; // px, 8-64
}

export interface ImageBlock {
  id: string;
  type: "image";
  src: string; // URL or {{variable}}
  alt: string;
  width?: number; // px, max 600
  align?: "left" | "center" | "right";
  linkUrl?: string;
}

export interface AlertBlock {
  id: string;
  type: "alert";
  variant: "info" | "warning" | "success" | "error";
  content: string;
  icon?: boolean; // show icon prefix
}

export interface TableBlock {
  id: string;
  type: "table";
  headers: string[];
  rows: string[][]; // supports {{variable}} per cell
  striped?: boolean;
}

export interface ListBlock {
  id: string;
  type: "list";
  items: string[]; // supports {{variable}} per item
  ordered?: boolean;
}

export interface ColumnsBlock {
  id: string;
  type: "columns";
  columns: {
    width: "1/2" | "1/3" | "2/3";
    blocks: TemplateBlock[];
  }[];
}

export interface SignatureBlock {
  id: string;
  type: "signature";
  // Auto-populated from system settings (app name, logo)
}
```

### Variable Registry Types

```typescript
export type VariableCategory =
  | "global"
  | "persuratan"
  | "disposisi"
  | "akademik"
  | "keuangan"
  | "auth"
  | "sertifikat"
  | "ppl"
  | "sistem";

export interface VariableDefinition {
  key: string;           // e.g. "surat.perihal"
  label: string;         // e.g. "Perihal surat"
  category: VariableCategory;
  sampleValue: string;   // e.g. "Undangan Rapat Koordinasi"
  description?: string;
}

export interface TemplateVariable {
  [key: string]: string; // runtime values passed to renderer
}
```

---

## 6. Variable Registry

### Global Variables (tersedia di semua template)

| Variable | Label | Sample Value |
|----------|-------|--------------|
| `{{app.name}}` | Nama aplikasi | ARKA |
| `{{app.url}}` | URL aplikasi | https://arka.iai-jakarta.or.id |
| `{{app.logo_url}}` | URL logo | https://... |
| `{{recipient.nama}}` | Nama penerima | Budi Santoso |
| `{{recipient.email}}` | Email penerima | budi@example.com |
| `{{current.date}}` | Tanggal hari ini | 24 Mei 2026 |
| `{{current.year}}` | Tahun sekarang | 2026 |
| `{{org.nama}}` | Nama organisasi | IAI Wilayah DKI Jakarta |

### Persuratan Variables

| Variable | Label | Sample Value |
|----------|-------|--------------|
| `{{surat.perihal}}` | Perihal surat | Undangan Rapat Koordinasi |
| `{{surat.nomor}}` | Nomor surat | 001/IAI-DKIJKT/SK/V/2026 |
| `{{surat.tujuan}}` | Tujuan surat | Ketua IAI Pusat |
| `{{surat.pengirim}}` | Nama pengirim/pembuat | Ahmad Fauzi |
| `{{surat.tanggal}}` | Tanggal surat | 20 Mei 2026 |
| `{{surat.url}}` | Link ke detail surat | https://arka.../surat-keluar/xxx |
| `{{surat.review_url}}` | Link reviu surat | https://arka.../surat-keluar/review/xxx |
| `{{pejabat.nama}}` | Nama pejabat | Dr. Hendra Wijaya |
| `{{catatan.revisi}}` | Catatan revisi | Mohon perbaiki format penomoran |

### Disposisi Variables

| Variable | Label | Sample Value |
|----------|-------|--------------|
| `{{disposisi.dari}}` | Pengirim disposisi | Ketua IAI Jakarta |
| `{{disposisi.instruksi}}` | Instruksi | Mohon ditindaklanjuti |
| `{{disposisi.batas_waktu}}` | Batas waktu | 30 Mei 2026 |
| `{{disposisi.sisa_hari}}` | Sisa hari deadline | 5 |
| `{{disposisi.url}}` | Link inbox disposisi | https://arka.../disposisi |

### Akademik Variables

| Variable | Label | Sample Value |
|----------|-------|--------------|
| `{{kelas.nama}}` | Nama kelas/pelatihan | Brevet Pajak AB Batch 12 |
| `{{kelas.periode}}` | Periode kelas | Mei - Juli 2026 |
| `{{instruktur.nama}}` | Nama instruktur | Ir. Siti Rahayu |
| `{{jadwal.tanggal}}` | Tanggal jadwal | Senin, 26 Mei 2026 |
| `{{jadwal.waktu}}` | Waktu | 09:00 - 12:00 WIB |
| `{{jadwal.ruangan}}` | Ruangan | Ruang 301 |
| `{{jadwal.materi}}` | Materi | PPh Pasal 21 |
| `{{evaluasi.url}}` | Link kuesioner evaluasi | https://arka.../evaluasi/xxx |

### Keuangan Variables

| Variable | Label | Sample Value |
|----------|-------|--------------|
| `{{honorarium.jumlah}}` | Jumlah honorarium | Rp 2.400.000 |
| `{{honorarium.periode}}` | Periode | Mei 2026 |
| `{{honorarium.status}}` | Status pembayaran | Sudah Ditransfer |
| `{{batch.nama}}` | Nama batch | Batch Mei 2026 - Brevet AB |
| `{{keuangan.url}}` | Link detail keuangan | https://arka.../keuangan/xxx |

### Auth Variables

| Variable | Label | Sample Value |
|----------|-------|--------------|
| `{{auth.reset_url}}` | Link reset password | https://arka.../reset/xxx |
| `{{auth.invite_url}}` | Link aktivasi akun | https://arka.../activate/xxx |
| `{{auth.inviter_name}}` | Nama yang mengundang | Admin ARKA |
| `{{auth.expiry}}` | Masa berlaku link | 1 jam |

### Sertifikat Variables

| Variable | Label | Sample Value |
|----------|-------|--------------|
| `{{sertifikat.nomor}}` | Nomor sertifikat | SERT/001/IAI/2026 |
| `{{sertifikat.program}}` | Nama program | Brevet Pajak AB |
| `{{sertifikat.download_url}}` | Link download | https://arka.../sertifikat/xxx |
| `{{sertifikat.tanggal}}` | Tanggal terbit | 24 Mei 2026 |

### PPL Variables

| Variable | Label | Sample Value |
|----------|-------|--------------|
| `{{ppl.kegiatan}}` | Nama kegiatan PPL | Workshop PSAK 73 |
| `{{ppl.tanggal}}` | Tanggal kegiatan | 28 Mei 2026 |
| `{{ppl.skp}}` | Jumlah SKP | 8 SKP |
| `{{ppl.lokasi}}` | Lokasi | Hotel Mulia, Jakarta |
| `{{ppl.narasumber}}` | Nama narasumber | Prof. Andi Kusuma |

---

## 7. Default System Templates (Seed)

Template bawaan yang di-seed saat pertama deploy. Ditandai `isSystem: true` (tidak bisa dihapus, tapi bisa diedit).

| # | Template Key | Kategori | Deskripsi |
|---|-------------|----------|-----------|
| 1 | `auth_invite` | Auth | Undangan aktivasi akun pegawai baru |
| 2 | `auth_reset_password` | Auth | Reset kata sandi |
| 3 | `surat_keluar_review` | Persuratan | Request reviu surat keluar ke pejabat |
| 4 | `surat_keluar_revisi` | Persuratan | Notifikasi revisi diperlukan |
| 5 | `surat_keluar_selesai` | Persuratan | Surat selesai diproses & diarsipkan |
| 6 | `disposisi_baru` | Persuratan | Disposisi baru diterima |
| 7 | `disposisi_deadline` | Persuratan | Reminder deadline disposisi mendekati |
| 8 | `jadwal_instruktur` | Akademik | Notifikasi jadwal mengajar ke instruktur |
| 9 | `jadwal_perubahan` | Akademik | Notifikasi perubahan jadwal |
| 10 | `honorarium_status` | Keuangan | Update status pembayaran honorarium |
| 11 | `honorarium_batch_ready` | Keuangan | Batch honorarium siap diproses |
| 12 | `sertifikat_ready` | Akademik | Sertifikat siap diunduh |
| 13 | `evaluasi_link` | PPL | Link kuesioner evaluasi PPL |
| 14 | `ppl_reminder` | PPL | Reminder kegiatan PPL mendatang |
| 15 | `pengumuman_broadcast` | Sistem | Pengumuman umum ke semua user |
| 16 | `project_invitation` | Sistem | Undangan bergabung ke project |

### Default Layouts (Seed)

| # | Layout Name | Deskripsi |
|---|-------------|-----------|
| 1 | Default | Logo ARKA di header, footer dengan alamat + tahun |
| 2 | Minimal | Tanpa header, footer hanya "— ARKA" |
| 3 | Formal | Header dengan garis biru, footer lengkap dengan kontak |

---

## 8. Alur Utama

### Alur Admin: Kelola Template

1. Admin buka `/pengaturan/mail-templates` → lihat list template
2. Klik template → masuk block editor
3. Edit subject (dengan variable autocomplete)
4. Tambah/edit/reorder blocks di canvas
5. Live preview update real-time di panel kanan
6. Toggle desktop/mobile preview
7. Klik "Test Send" → masukkan email → terima test email
8. Klik "Simpan" → version auto-increment, snapshot disimpan ke `emailTemplateVersions`

### Alur Admin: Buat Template Baru

1. Klik "+ Template" → form: key, nama, kategori, layout
2. Redirect ke editor kosong
3. Tambah blocks dari palette
4. Sisipkan variables dari autocomplete
5. Preview + test send
6. Simpan → template aktif dan siap digunakan sistem

### Alur Admin: Rollback Versi

1. Buka template → klik "Lihat Riwayat Versi"
2. List versi dengan timestamp + author
3. Klik versi → preview konten versi tersebut
4. Klik "Rollback ke Versi Ini" → create new version dari snapshot lama
5. Template aktif sekarang menggunakan konten versi yang di-rollback

### Alur Sistem: Kirim Email (Runtime)

```
Trigger (e.g. surat keluar disubmit)
    │
    ▼
sendTemplatedEmail("surat_keluar_review", { to, toName, variables })
    │
    ├─ 1. Lookup template by key dari DB
    │     └─ Fallback: jika tidak ada di DB, gunakan hardcoded template lama
    │
    ├─ 2. Check isActive — skip jika nonaktif
    │
    ├─ 3. Resolve variables:
    │     ├─ Inject global vars (app.name, current.date, etc.)
    │     └─ Inject context vars (surat.perihal, recipient.nama, etc.)
    │
    ├─ 4. Compile subject (replace {{vars}} di subject string)
    │
    ├─ 5. Compile body:
    │     ├─ Iterate blocks → replace {{vars}} di content
    │     ├─ Render blocks → HTML fragments
    │     └─ Wrap dengan layout (header + content + footer)
    │
    ├─ 6. Generate plain text fallback
    │
    ├─ 7. Call existing sendEmail({ to, subject, htmlBody, textBody })
    │
    └─ 8. Log ke emailSendLogs (template, recipient, status, provider)
```

### Alur Backward Compatibility

```typescript
// Existing code tetap jalan tanpa perubahan:
const email = buildSuratKeluarReviewEmail({ ... });
sendEmail({ to, ...email });

// Tapi secara bertahap di-migrate ke:
await sendTemplatedEmail("surat_keluar_review", {
  to: pejabat.email,
  toName: pejabat.namaLengkap,
  variables: { "recipient.nama": pejabat.namaLengkap, ... },
});

// sendTemplatedEmail internally:
// 1. Try DB template → if found & active, use it
// 2. If not found → fallback to hardcoded buildXxxEmail()
// 3. If DB template inactive → skip (no email sent)
```

---

## 9. API: sendTemplatedEmail

```typescript
// src/lib/email/template-engine/index.ts

export interface SendTemplatedEmailOptions {
  to: string;
  toName?: string;
  variables: Record<string, string>;
  attachments?: EmailPayload["attachments"];
  // Override: gunakan compiled HTML custom (bypass DB template)
  overrideHtml?: string;
}

/**
 * Kirim email menggunakan template dari DB.
 * Fallback ke hardcoded template jika DB template tidak ditemukan.
 */
export async function sendTemplatedEmail(
  templateKey: string,
  options: SendTemplatedEmailOptions,
): Promise<{ success: boolean; logId?: string; error?: string }> {
  // 1. Lookup template
  const template = await getTemplateByKey(templateKey);

  if (!template) {
    // Fallback ke hardcoded
    const fallback = getFallbackTemplate(templateKey, options.variables);
    if (fallback) {
      await sendEmail({ to: options.to, toName: options.toName, ...fallback });
      return { success: true };
    }
    return { success: false, error: `Template "${templateKey}" not found` };
  }

  if (!template.isActive) {
    return { success: false, error: `Template "${templateKey}" is inactive` };
  }

  // 2. Resolve variables
  const allVars = {
    ...getGlobalVariables(),
    "recipient.nama": options.toName ?? options.to,
    "recipient.email": options.to,
    ...options.variables,
  };

  // 3. Compile
  const subject = resolveVariables(template.subject, allVars);
  const htmlBody = compileBlocksToHtml(template.bodyBlocks, allVars, template.layoutId);
  const textBody = compileBlocksToText(template.bodyBlocks, allVars);

  // 4. Send
  try {
    await sendEmail({
      to: options.to,
      toName: options.toName,
      subject,
      htmlBody,
      textBody,
      attachments: options.attachments,
    });

    // 5. Log success
    const logId = await logEmailSend({
      templateKey,
      recipientEmail: options.to,
      recipientName: options.toName,
      subject,
      status: "sent",
      metadata: { variables: allVars },
    });

    return { success: true, logId };
  } catch (err) {
    // Log failure
    await logEmailSend({
      templateKey,
      recipientEmail: options.to,
      recipientName: options.toName,
      subject,
      status: "failed",
      errorMessage: err instanceof Error ? err.message : "Unknown error",
      metadata: { variables: allVars },
    });

    return { success: false, error: err instanceof Error ? err.message : "Send failed" };
  }
}
```

---

## 10. HTML Compilation Strategy

### Email Client Compatibility

Email HTML harus menggunakan pendekatan table-based layout karena CSS support di email clients sangat terbatas. Compiler menghasilkan:

```html
<!-- Outer wrapper -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" 
       style="background-color:#f4f4f5;">
  <tr>
    <td align="center" style="padding:24px 16px;">
      <!-- Content container (max 600px) -->
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
             style="background-color:#ffffff;border-radius:8px;">
        
        <!-- Layout: Header -->
        <tr><td style="padding:24px 32px;border-bottom:2px solid #1d4ed8;">
          <img src="{{app.logo_url}}" alt="ARKA" width="120"/>
        </td></tr>
        
        <!-- Content Blocks -->
        <tr><td style="padding:32px;">
          <!-- Each block rendered here -->
        </td></tr>
        
        <!-- Layout: Footer -->
        <tr><td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;
                       font-size:12px;color:#64748b;">
          © {{current.year}} {{app.name}} • {{org.nama}}
        </td></tr>
        
      </table>
    </td>
  </tr>
</table>
```

### Block → HTML Mapping

| Block Type | HTML Output |
|-----------|-------------|
| Paragraph | `<p style="...">content</p>` |
| Heading | `<h1/h2/h3 style="...">content</h1/h2/h3>` |
| Button | `<table><tr><td><a style="...">label</a></td></tr></table>` (bulletproof button) |
| Divider | `<hr style="..."/>` |
| Spacer | `<div style="height:Xpx;"></div>` |
| Image | `<img src="..." alt="..." width="..." style="..."/>` |
| Alert | `<table style="background:color;border-left:4px solid accent;"><tr><td>content</td></tr></table>` |
| Table | `<table style="..."><thead>...</thead><tbody>...</tbody></table>` |
| List | `<ul/ol style="..."><li>...</li></ul/ol>` |
| Columns | Nested `<table>` with `<td width="50%">` |
| Signature | Auto-generated brand block |

### Dark Mode Support

```html
<head>
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    @media (prefers-color-scheme: dark) {
      .email-body { background-color: #1a1a2e !important; }
      .email-content { background-color: #16213e !important; color: #e0e0e0 !important; }
    }
  </style>
</head>
```

---

## 11. Integrasi ke Sistem Existing

### Migration Path (Bertahap)

Migrasi dari hardcoded ke DB-driven dilakukan bertahap tanpa breaking change:

**Phase 1: Foundation** (tanpa mengubah existing code)
- Deploy schema + seed default templates
- Implement `sendTemplatedEmail()` dengan fallback
- Build admin UI

**Phase 2: Gradual Migration** (per modul)
- Ganti `buildInviteEmail()` → `sendTemplatedEmail("auth_invite", ...)`
- Ganti `buildResetPasswordEmail()` → `sendTemplatedEmail("auth_reset_password", ...)`
- Ganti `buildSuratKeluarReviewEmail()` → `sendTemplatedEmail("surat_keluar_review", ...)`
- dst.

**Phase 3: New Templates** (fitur baru langsung pakai DB)
- Template baru (jadwal, honorarium, sertifikat, PPL) langsung via DB
- Hardcoded `templates.ts` tetap ada sebagai fallback safety net

### Perubahan di Notification System

```typescript
// src/server/actions/notifications.ts — contoh perubahan

// SEBELUM:
if (pref.email) {
  const email = buildSuratKeluarReviewEmail({ ... });
  void sendEmail({ to: pejabat.email, toName: pejabat.namaLengkap, ...email });
}

// SESUDAH:
if (pref.email) {
  void sendTemplatedEmail("surat_keluar_review", {
    to: pejabat.email,
    toName: pejabat.namaLengkap,
    variables: {
      "recipient.nama": pejabat.namaLengkap,
      "surat.perihal": perihal,
      "surat.pengirim": pengirimNama,
      "surat.tujuan": tujuan ?? "",
      "surat.review_url": `${appUrl}/surat-keluar/review/${suratId}`,
    },
  });
}
```

### RBAC Integration

Tambah capabilities baru:

```typescript
// src/lib/rbac/capabilities.ts
"mail_template:view"    // Lihat list template & logs
"mail_template:manage"  // CRUD template, layout, test send
"mail_template:logs"    // Akses send logs

// Default assignment:
// admin → view + manage + logs
// pejabat → view
// staff → (none)
```

### Navigation Integration

```typescript
// Tambah di src/components/layout/navigation.ts
// Di bawah group "Pengaturan":
{
  title: "Mail Templates",
  href: "/pengaturan/mail-templates",
  icon: Mail,
  capability: "mail_template:view",
}
```

---

## 12. UI Wireframe Detail

### Template List Page

```
┌─────────────────────────────────────────────────────────────────────┐
│  📧 Mail Templates                                    [+ Template]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  🔍 [Search template...                    ]                        │
│                                                                      │
│  [Semua] [Persuratan] [Akademik] [Keuangan] [Auth] [Sistem] [PPL]  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ 📄 Reviu Surat Keluar                                      │     │
│  │    Key: surat_keluar_review • Persuratan • 🔒 System       │     │
│  │    Notifikasi ke pejabat untuk mereviu draft surat keluar   │     │
│  │    v3 • Diubah 2 hari lalu oleh Admin    ● Aktif  [⋮]     │     │
│  ├────────────────────────────────────────────────────────────┤     │
│  │ 📄 Undangan Aktivasi Akun                                   │     │
│  │    Key: auth_invite • Auth • 🔒 System                      │     │
│  │    Email undangan untuk pegawai baru set password            │     │
│  │    v1 • Diubah 1 minggu lalu oleh System  ● Aktif  [⋮]    │     │
│  ├────────────────────────────────────────────────────────────┤     │
│  │ 📄 Notifikasi Jadwal Instruktur                             │     │
│  │    Key: jadwal_instruktur • Akademik                        │     │
│  │    Pemberitahuan jadwal mengajar ke instruktur              │     │
│  │    v5 • Diubah hari ini oleh Admin        ● Aktif  [⋮]    │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  Menampilkan 16 template                                            │
└─────────────────────────────────────────────────────────────────────┘
```

### Block Editor Page

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Kembali   Reviu Surat Keluar   [Riwayat] [Test Send] [Simpan]  │
├─────────────────────────────────────────────────────────────────────┤
│  Subject: [Reviu Surat: {{surat.perihal}}                        ] │
│  Layout:  [Default ▼]    Kategori: Persuratan    Status: ● Aktif   │
├────────────────────────────────┬────────────────────────────────────┤
│                                │                                     │
│  ── EDITOR ──                  │  ── PREVIEW ──     [Desktop|Mobile]│
│                                │                                     │
│  ┌─ Paragraph ─────────────┐  │  ┌──────────────────────────────┐  │
│  │ Yth. {{recipient.nama}}, │  │  │  [ARKA Logo]                 │  │
│  │                    [⋮]   │  │  │  ─────────────────────────── │  │
│  └──────────────────────────┘  │  │                              │  │
│                                │  │  Yth. Dr. Hendra Wijaya,     │  │
│  ┌─ Paragraph ─────────────┐  │  │                              │  │
│  │ Mohon perkenan untuk     │  │  │  Mohon perkenan untuk        │  │
│  │ mereviu draft surat      │  │  │  mereviu draft surat keluar: │  │
│  │ keluar berikut:    [⋮]   │  │  │                              │  │
│  └──────────────────────────┘  │  │  Pembuat: Ahmad Fauzi        │  │
│                                │  │  Perihal: Undangan Rapat...   │  │
│  ┌─ Table ──────────────────┐  │  │  Tujuan: Ketua IAI Pusat     │  │
│  │ Pembuat | {{surat...}}   │  │  │                              │  │
│  │ Perihal | {{surat...}}   │  │  │  ┌────────────────────────┐  │  │
│  │ Tujuan  | {{surat...}}   │  │  │  │  Reviu Surat Keluar    │  │  │
│  │                    [⋮]   │  │  │  └────────────────────────┘  │  │
│  └──────────────────────────┘  │  │                              │  │
│                                │  │  ─────────────────────────── │  │
│  ┌─ Button ─────────────────┐  │  │  © 2026 ARKA • IAI Jakarta  │  │
│  │ Label: Reviu Surat Keluar│  │  └──────────────────────────────┘  │
│  │ URL: {{surat.review_url}}│  │                                     │
│  │ Color: #1d4ed8     [⋮]   │  │  ── VARIABLES (Persuratan) ──      │
│  └──────────────────────────┘  │  ┌──────────────────────────────┐  │
│                                │  │ {{recipient.nama}}            │  │
│  ┌─ Signature ──────────────┐  │  │ {{surat.perihal}}            │  │
│  │ [Auto: brand signature]  │  │  │ {{surat.pengirim}}           │  │
│  │                    [⋮]   │  │  │ {{surat.tujuan}}             │  │
│  └──────────────────────────┘  │  │ {{surat.review_url}}         │  │
│                                │  │ {{pejabat.nama}}             │  │
│  [+ Tambah Block ▼]           │  │ [Klik untuk insert]           │  │
│                                │  └──────────────────────────────┘  │
├────────────────────────────────┴────────────────────────────────────┤
│  Version 3 • Terakhir disimpan oleh Admin • 24 Mei 2026 14:30      │
└─────────────────────────────────────────────────────────────────────┘
```

### Send Logs Page

```
┌─────────────────────────────────────────────────────────────────────┐
│  📊 Email Send Logs                                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─ Summary ────────────────────────────────────────────────────┐   │
│  │  Total: 1,247  │  ✅ Sent: 1,198 (96%)  │  ❌ Failed: 49    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Filter: [Template ▼] [Status ▼] [Dari: ___] [Sampai: ___]         │
│                                                                      │
│  ┌──────────┬──────────────────┬────────────────┬────────┬──────┐  │
│  │ Waktu    │ Template         │ Penerima       │ Status │ Act  │  │
│  ├──────────┼──────────────────┼────────────────┼────────┼──────┤  │
│  │ 14:30    │ surat_keluar_    │ budi@mail.com  │ ✅ Sent│ [👁] │  │
│  │ 14:25    │ auth_invite      │ siti@mail.com  │ ✅ Sent│ [👁] │  │
│  │ 14:20    │ disposisi_baru   │ andi@mail.com  │ ❌ Fail│ [🔄] │  │
│  │ 13:55    │ honorarium_      │ rudi@mail.com  │ ✅ Sent│ [👁] │  │
│  └──────────┴──────────────────┴────────────────┴────────┴──────┘  │
│                                                                      │
│  [← Prev] Halaman 1 dari 25 [Next →]                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 13. Dependensi Library

| Library | Kegunaan | Status |
|---------|----------|--------|
| `@dnd-kit/core` + `@dnd-kit/sortable` | Drag-and-drop block reordering | ✅ Sudah ada |
| `lucide-react` | Icons (Mail, Eye, Send, History, etc.) | ✅ Sudah ada |
| `zod` | Validation schema untuk template & blocks | ✅ Sudah ada |
| `react-hook-form` | Form handling di editor | ✅ Sudah ada |
| `sonner` | Toast notifications | ✅ Sudah ada |
| `nanoid` | Generate unique IDs untuk blocks | ✅ Sudah ada |
| `date-fns` | Format tanggal di variables & logs | ✅ Sudah ada |
| `node-mailjet` / Brevo API | Email sending (existing pipeline) | ✅ Sudah ada |

**Tidak ada library baru yang perlu ditambahkan.** Semua kebutuhan sudah ter-cover oleh dependencies existing.

---

## 14. Validators (Zod Schemas)

```typescript
// src/lib/validators/mail-templates.ts

import { z } from "zod";

export const templateBlockSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("paragraph"),
    content: z.string().min(1),
    align: z.enum(["left", "center", "right"]).optional(),
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("heading"),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    content: z.string().min(1),
    align: z.enum(["left", "center", "right"]).optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("button"),
    label: z.string().min(1).max(100),
    url: z.string().min(1),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    fullWidth: z.boolean().optional(),
  }),
  z.object({ id: z.string(), type: z.literal("divider"), style: z.enum(["solid", "dashed", "dotted"]).optional(), color: z.string().optional() }),
  z.object({ id: z.string(), type: z.literal("spacer"), height: z.number().min(8).max(64) }),
  z.object({ id: z.string(), type: z.literal("image"), src: z.string().min(1), alt: z.string(), width: z.number().max(600).optional(), align: z.enum(["left", "center", "right"]).optional(), linkUrl: z.string().optional() }),
  z.object({ id: z.string(), type: z.literal("alert"), variant: z.enum(["info", "warning", "success", "error"]), content: z.string().min(1), icon: z.boolean().optional() }),
  z.object({ id: z.string(), type: z.literal("table"), headers: z.array(z.string()), rows: z.array(z.array(z.string())), striped: z.boolean().optional() }),
  z.object({ id: z.string(), type: z.literal("list"), items: z.array(z.string().min(1)).min(1), ordered: z.boolean().optional() }),
  z.object({ id: z.string(), type: z.literal("columns"), columns: z.array(z.object({ width: z.enum(["1/2", "1/3", "2/3"]), blocks: z.array(z.lazy(() => templateBlockSchema)) })).min(2).max(3) }),
  z.object({ id: z.string(), type: z.literal("signature") }),
]);

export const createTemplateSchema = z.object({
  templateKey: z.string().min(3).max(100).regex(/^[a-z][a-z0-9_]*$/),
  templateName: z.string().min(3).max(300),
  description: z.string().max(1000).optional(),
  category: z.enum(["persuratan", "akademik", "keuangan", "auth", "sistem", "ppl", "custom"]),
  subject: z.string().min(3).max(500),
  bodyBlocks: z.array(templateBlockSchema).min(1),
  layoutId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateTemplateSchema = createTemplateSchema.partial().extend({
  changeNote: z.string().max(500).optional(),
});

export const createLayoutSchema = z.object({
  name: z.string().min(3).max(200),
  description: z.string().max(500).optional(),
  headerHtml: z.string().max(10000).optional(),
  footerHtml: z.string().max(10000).optional(),
  cssInline: z.string().max(20000).optional(),
  isDefault: z.boolean().optional(),
});

export const testSendSchema = z.object({
  templateId: z.string(),
  recipientEmail: z.string().email(),
  variables: z.record(z.string()).optional(),
});
```

---

## 15. Catatan Teknis

### Performance

- Template lookup di-cache menggunakan React `cache()` (per-request dedup)
- Compiled HTML disimpan di DB — tidak perlu re-compile setiap send
- Re-compile hanya saat admin save template (compile-on-save, not compile-on-send)
- Variable injection tetap runtime (karena values berubah per email)
- Send logs auto-prune via cron (sama seperti notification prune existing)

### Security

- HTML output di-sanitize: user-provided variables di-escape (`escapeHtml()`)
- Layout HTML hanya bisa diedit oleh admin (capability `mail_template:manage`)
- Template key harus lowercase alphanumeric + underscore (prevent injection)
- Test send rate-limited: max 5 test emails per menit per user

### Email Client Compatibility

- Table-based layout (bukan div/flexbox)
- Inline CSS (bukan `<style>` block — kecuali dark mode fallback)
- Max width 600px untuk content area
- Bulletproof buttons (VML fallback untuk Outlook)
- Alt text wajib untuk semua images
- Plain text fallback selalu di-generate

### Backward Compatibility

- `templates.ts` (hardcoded) TIDAK dihapus — tetap sebagai fallback
- `sendTemplatedEmail()` gracefully fallback jika DB template tidak ada
- Existing `sendEmail()` API tidak berubah sama sekali
- Migration bisa dilakukan per-modul tanpa downtime

### Scalability

- Arsitektur mendukung penambahan block type baru tanpa migrasi DB (blocks = JSONB)
- Variable registry extensible — modul baru tinggal register variables
- Layout system memungkinkan branding update sekali untuk semua template
- Send logs bisa di-extend untuk webhook/analytics di masa depan

---

## 16. Checklist Implementasi

### Phase 1: Foundation

- [ ] Drizzle schema (`emailTemplates`, `emailLayouts`, `emailTemplateVersions`, `emailSendLogs`)
- [ ] Enum `email_template_category`, `email_send_status`
- [ ] Migration files generated & pushed
- [ ] Type definitions (`TemplateBlock`, `VariableDefinition`, etc.)
- [ ] Variable registry (`src/lib/email/template-engine/variable-registry.ts`)
- [ ] Block → HTML compiler (`src/lib/email/template-engine/compiler.ts`)
- [ ] Block → Text compiler (`src/lib/email/template-engine/text-compiler.ts`)
- [ ] Variable resolver (`src/lib/email/template-engine/variable-resolver.ts`)
- [ ] Layout wrapper (`src/lib/email/template-engine/layout-wrapper.ts`)
- [ ] `sendTemplatedEmail()` function dengan fallback logic
- [ ] Seed script: 16 default templates + 3 layouts
- [ ] RBAC capabilities: `mail_template:view`, `mail_template:manage`, `mail_template:logs`

### Phase 2: Admin UI — Template CRUD

- [ ] Template list page (`/pengaturan/mail-templates`)
- [ ] Category filter tabs
- [ ] Search functionality
- [ ] Create template form (`/pengaturan/mail-templates/create`)
- [ ] Template card component (nama, key, kategori, status, version)
- [ ] Duplicate template action
- [ ] Delete template (soft: deactivate for system, hard delete for custom)
- [ ] Toggle active/inactive

### Phase 3: Block Editor

- [ ] Editor layout (split pane: editor | preview)
- [ ] Block canvas with dnd-kit sortable
- [ ] Block palette (add block dropdown)
- [ ] Individual block editors:
  - [ ] ParagraphBlock (textarea + variable autocomplete)
  - [ ] HeadingBlock (level selector + content)
  - [ ] ButtonBlock (label + URL + color picker)
  - [ ] DividerBlock (style selector)
  - [ ] SpacerBlock (height slider)
  - [ ] ImageBlock (URL + alt + width)
  - [ ] AlertBlock (variant + content)
  - [ ] TableBlock (dynamic rows/cols editor)
  - [ ] ListBlock (dynamic items)
  - [ ] ColumnsBlock (nested blocks)
  - [ ] SignatureBlock (auto, no config)
- [ ] Block toolbar (move up/down, duplicate, delete)
- [ ] Subject editor with variable autocomplete
- [ ] Variable autocomplete popup (`{{` trigger)
- [ ] Save action (compile + version + persist)

### Phase 4: Preview & Test

- [ ] Live preview panel (iframe-based)
- [ ] Desktop/Mobile toggle
- [ ] Sample data auto-generation per kategori
- [ ] Custom sample data editor
- [ ] Test send dialog (email input + variable override)
- [ ] Test send server action (rate-limited)

### Phase 5: Version History

- [ ] Version list page (`/pengaturan/mail-templates/[id]/versions`)
- [ ] Version preview (rendered HTML)
- [ ] Rollback action (create new version from old snapshot)
- [ ] Change note per version

### Phase 6: Layout Manager

- [ ] Layout list page (`/pengaturan/mail-templates/layouts`)
- [ ] Layout editor (header/footer HTML + CSS)
- [ ] Set default layout
- [ ] Preview layout with sample content

### Phase 7: Send Logs

- [ ] Send log list page (`/pengaturan/mail-templates/logs`)
- [ ] Filter by template, status, date range
- [ ] Summary statistics (total, success rate, top templates)
- [ ] Log detail view (variables, error message)
- [ ] Retry failed email action
- [ ] Auto-prune cron integration

### Phase 8: Integration Refactor

- [ ] Migrate `buildInviteEmail` → `sendTemplatedEmail("auth_invite")`
- [ ] Migrate `buildResetPasswordEmail` → `sendTemplatedEmail("auth_reset_password")`
- [ ] Migrate `buildSuratKeluarReviewEmail` → `sendTemplatedEmail("surat_keluar_review")`
- [ ] Migrate `buildSuratKeluarRevisiEmail` → `sendTemplatedEmail("surat_keluar_revisi")`
- [ ] Migrate `buildSuratKeluarSelesaiEmail` → `sendTemplatedEmail("surat_keluar_selesai")`
- [ ] Migrate `buildDisposisiEmail` → `sendTemplatedEmail("disposisi_baru")`
- [ ] Add new template calls for jadwal, honorarium, sertifikat, PPL
- [ ] Navigation sidebar entry
- [ ] Verify all notification preferences still respected

### Phase 9: Polish

- [ ] Import/Export template as JSON
- [ ] Keyboard shortcuts di editor (Ctrl+S save, Ctrl+P preview)
- [ ] Empty states & loading skeletons
- [ ] Error boundaries
- [ ] Mobile-responsive admin UI
- [ ] Documentation/help tooltips di editor

---

## 17. Estimasi Timeline

| Phase | Deskripsi | Estimasi |
|-------|-----------|----------|
| Phase 1 | Foundation (schema, engine, seed) | 2 hari |
| Phase 2 | Admin UI — Template CRUD | 1-2 hari |
| Phase 3 | Block Editor | 3-4 hari |
| Phase 4 | Preview & Test Send | 1 hari |
| Phase 5 | Version History | 1 hari |
| Phase 6 | Layout Manager | 1 hari |
| Phase 7 | Send Logs | 1 hari |
| Phase 8 | Integration Refactor | 1-2 hari |
| Phase 9 | Polish | 1 hari |
| **Total** | | **~12-15 hari** |

---

## 18. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|----------|
| Email rendering beda di tiap client | Visual inconsistency | Table-based layout + inline CSS + testing di Litmus/Email on Acid |
| Admin salah edit template → email rusak | User terima email broken | Version history + rollback + test send wajib sebelum save |
| Performance hit dari DB lookup per email | Latency naik | Cache template per-request + compiled HTML pre-stored |
| Variable typo di template | `{{undefined}}` muncul di email | Validation warning di editor + fallback empty string |
| Migration breaking existing emails | Email berhenti terkirim | Fallback ke hardcoded template jika DB template tidak ada |

---

## 19. Future Enhancements (Post-MVP)

- **A/B Testing**: Dua versi template, split traffic, measure open/click rate
- **Scheduled Sends**: Queue email untuk dikirim di waktu tertentu
- **Webhook Integration**: Trigger template dari external system
- **Multi-language**: Template per bahasa (ID/EN) dengan auto-detect
- **Analytics Dashboard**: Open rate, click rate (requires tracking pixel)
- **Conditional Blocks**: Show/hide block berdasarkan variable value
- **Template Marketplace**: Share template antar instance ARKA
- **AI Content Suggestions**: Generate draft content berdasarkan context
