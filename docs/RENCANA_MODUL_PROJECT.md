# Rencana Implementasi Modul Project

> **Referensi:** Rise CRM (`/projects/view/23`) — halaman detail project dengan tab Overview, Comments, Files, Members.
>
> **Tech Stack:** Next.js 16 + PostgreSQL (Neon) + Drizzle ORM + Better Auth + shadcn/ui + Tailwind CSS v4

---

## 1. Tujuan

Modul Project = **ruang kolaborasi tim** untuk perencanaan & persiapan kegiatan (workshop, seminar, lokakarya, pelatihan). Beda dengan modul `events`/`sertifikat` — events untuk eksekusi kegiatan yang sudah berjalan.

| Project | Events / Sertifikat | 
|---|---|
| Perencanaan, diskusi, file sharing | Eksekusi kegiatan, peserta, sertifikat |
| Belum tentu jadi event | Pasti sudah / akan terjadi |
| Bisa lintas divisi | Terikat program |
| Opsional link ke eventId | Bisa dirujuk dari project |

---

## 2. Database Schema

### 2.1 `projects` — Data utama project

```typescript
export const projectTypeEnum = pgEnum("project_type", [
  "Workshop",
  "Seminar",
  "Lokakarya",
  "Pelatihan",
  "Lainnya",
]);

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  type: projectTypeEnum("type").notNull(),
  description: text("description"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  price: numeric("price", { precision: 15, scale: 2 }),
  status: varchar("status", { length: 50 }).notNull().default("not_started"),

  // SKP
  skpMode: varchar("skp_mode", { length: 20 }).notNull().default("auto"),
  skp: numeric("skp", { precision: 5, scale: 2 }),
  halfDaySkp: varchar("half_day_skp", { length: 5 }),

  // Relasi opsional ke event
  eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),

  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});
```

**Status enum:** `not_started` | `in_progress` | `on_hold` | `completed` | `cancelled`

**SKP Mode:** `auto` = hitung dari durasi tanggal, `manual` = override user

**Half Day SKP:** `"2"` | `"4"` | `null` — hanya berlaku jika setengah hari

---

### 2.2 `project_labels` — Daftar label

```typescript
export const projectLabels = pgTable("project_labels", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }).notNull().default("#6B7280"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

---

### 2.3 `project_to_labels` — Many-to-many project ↔ label

```typescript
export const projectToLabels = pgTable("project_to_labels", {
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  labelId: uuid("label_id").notNull().references(() => projectLabels.id, { onDelete: "cascade" }),
}, (t) => ({
  pk: primaryKey({ columns: [t.projectId, t.labelId] }),
}));
```

---

### 2.4 `project_members` — Anggota project (invitation-based)

Tidak ada klasifikasi divisi di level project. Divisi ada di setting global (`users.divisiId`). Project tinggal invite user spesifik.

```typescript
export const projectMembers = pgTable("project_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 50 }).notNull().default("member"),
  addedBy: uuid("added_by").notNull().references(() => users.id),
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (t) => ({
  unq: uniqueIndex("project_member_unique").on(t.projectId, t.userId),
}));
```

**Member role:** `owner` | `manager` | `member` | `viewer`

---

### 2.5 `project_comments` — Komentar ber-thread

```typescript
export const projectComments = pgTable("project_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  parentId: uuid("parent_id").references((): AnyPgColumn => projectComments.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isInternal: boolean("is_internal").default(false),
  isEdited: boolean("is_edited").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});
```

---

### 2.6 `project_comment_mentions` — Tracking @mention

```typescript
export const projectCommentMentions = pgTable("project_comment_mentions", {
  id: uuid("id").defaultRandom().primaryKey(),
  commentId: uuid("comment_id").notNull().references(() => projectComments.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  isRead: boolean("is_read").default(false),
}, (t) => ({
  unq: uniqueIndex("mention_unique").on(t.commentId, t.userId),
}));
```

---

### 2.7 `project_files` — File per project

```typescript
export const projectFiles = pgTable("project_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  fileUrl: varchar("file_url", { length: 1000 }).notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type", { length: 255 }).notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});
```

---

### 2.8 `project_activity_log` — Log aktivitas

```typescript
export const projectActivityLog = pgTable("project_activity_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**Action values:** `created` | `updated` | `status_changed` | `member_added` | `member_removed` | `comment_added` | `file_uploaded` | `file_deleted`

---

### Entity Relationship Diagram

```
projects ──1:N── project_members ──N:1── users
    │
    ├──1:N── project_comments ──N:1── users
    │            │
    │            └──1:N── project_comment_mentions ──N:1── users
    │
    ├──1:N── project_files ──N:1── users
    │
    ├──1:N── project_to_labels ──N:1── project_labels
    │
    ├──1:N── project_activity_log ──N:1── users
    │
    └──N:1── events (opsional)
```

---

## 3. Logika Perhitungan SKP

### Aturan

| Durasi | SKP |
|---|---|
| 1 hari penuh | 8 SKP |
| 2 hari | 16 SKP |
| 3 hari | 24 SKP |
| n hari | n × 8 SKP |
| Setengah hari | 2 atau 4 SKP (pilih manual) |

> 1 SKP = 50 menit

### Kalkulasi Otomatis

```typescript
// src/lib/skp-calculator.ts

import { differenceInCalendarDays } from "date-fns";

export function calculateSKP(
  startDate: Date,
  endDate: Date,
  halfDaySkp?: number | null
): number {
  if (halfDaySkp != null) {
    return halfDaySkp;
  }

  const days = differenceInCalendarDays(endDate, startDate) + 1;
  return Math.max(days, 1) * 8;
}

export function formatSKP(skp: number | null | undefined): string {
  if (skp == null) return "-";
  return `${skp} SKP`;
}
```

### Penerapan di Server Action

```typescript
// Saat create/update project:
if (data.skpMode === "auto" && data.startDate && data.endDate) {
  data.skp = String(calculateSKP(data.startDate, data.endDate, data.halfDaySkp));
}
// Jika "manual" → pakai nilai dari input user langsung
```

---

## 4. Alur Invitation Membership

### Flow

```
1. Creator buka modal "Add Members" di halaman detail project
2. Search user by namaLengkap / email → tampilkan list user + divisi sebagai info
3. Pilih satu atau beberapa user → pilih role → simpan ke project_members
4. Trigger notifikasi tipe "project_invitation" ke setiap user yang diundang
5. User dapat notifikasi → klik → langsung ke halaman project
```

### Aturan Akses per Role

| Role | View | Edit Project | Manage Members | Comment | Upload File |
|---|---|---|---|---|---|
| **owner** | ✓ | ✓ | ✓ (semua) | ✓ | ✓ |
| **manager** | ✓ | ✓ | ✓ (kecuali owner) | ✓ | ✓ |
| **member** | ✓ | — | — | ✓ | ✓ |
| **viewer** | ✓ | — | — | — | — |

- Hanya member project yang bisa di-@mention
- Owner tidak bisa dihapus/di-demote oleh manager
- Creator otomatis jadi owner

---

## 5. Sistem @Mention

### Flow

```
1. User mengetik "@" di textarea komentar
2. Muncul popover menampilkan list member project (nama + divisi + avatar)
3. Filter real-time saat user mengetik nama setelah "@"
4. Pilih user dengan klik / Enter → insert "@NamaLengkap" di posisi kursor
5. Submit komentar → parse teks cari pola @NamaLengkap
6. Cocokkan nama dengan member project → simpan ke project_comment_mentions
7. Trigger notifikasi tipe "mention" ke setiap user yang di-mention
```

### Regex Parser

```typescript
// src/lib/mention-parser.ts

const MENTION_REGEX = /@([a-zA-Z0-9_\s]+?)(?=\s|$|@)/g;

export function parseMentions(content: string): string[] {
  const matches = content.matchAll(MENTION_REGEX);
  return [...matches].map((m) => m[1].trim());
}

export function renderMentions(content: string): string {
  return content.replace(MENTION_REGEX, (match, name) => {
    return `<span class="mention-tag">${match}</span>`;
  });
}
```

### UI Mention Popover

```
┌─ Textarea ────────────────────────────────────────┐
│ Mohon disiapkan materi oleh @Ani                 │
│                              ┌──────────────────┐ │
│                              │ 👤 Ani Wijaya     │ │
│                              │    Administrasi   │ │
│                              │ 👤 Anita Sari     │ │
│                              │    Keuangan       │ │
│                              └──────────────────┘ │
└────────────────────────────────────────────────────┘
```

### Notifikasi Mention

| Tipe | Pesan |
|---|---|
| `mention` | "**{author}** mention Anda di project **{projectTitle}**" |

Link notifikasi → `/projects/{projectId}?tab=comments` langsung ke tab komentar.

---

## 6. File per Project

### Upload

```typescript
// src/server/actions/projects.ts

export async function uploadProjectFile(projectId: string, file: File) {
  const session = await requireSession();
  await requireProjectMember(projectId, session.user.id);

  const provider = getStorageProvider();
  const buffer = Buffer.from(file.base64, "base64");
  const result = await provider.upload({
    buffer,
    originalName: file.name,
    mimeType: file.type,
    folder: `projects/${projectId}`,
  });

  await db.insert(projectFiles).values({
    projectId,
    userId: session.user.id,
    fileName: file.name,
    fileUrl: result.url,
    fileSize: file.size,
    mimeType: file.type,
  });

  await logProjectActivity(projectId, session.user.id, "file_uploaded", `Uploaded ${file.name}`);
}
```

### Batasan

- Max 20 MB per file (configurable via `STORAGE_MAX_FILE_MB`)
- MIME: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, JPG, PNG, WebP, ZIP
- Preview inline untuk gambar (lightbox)
- Download via existing file serving API (`/api/files/[...path]`)

---

## 7. RBAC Capabilities

Tambahkan ke `src/lib/rbac/capabilities.ts`:

```typescript
export const CAPABILITIES = {
  // ... existing ...

  // Projects
  "projects:view":             { label: "View Projects",              module: "Projects" },
  "projects:create":           { label: "Create Projects",            module: "Projects" },
  "projects:edit":             { label: "Edit Projects",              module: "Projects" },
  "projects:delete":           { label: "Delete Projects",            module: "Projects" },
  "projects:comment":          { label: "Comment on Projects",        module: "Projects" },
  "projects:upload":           { label: "Upload Files to Projects",   module: "Projects" },
  "projects:manage_members":   { label: "Manage Project Members",     module: "Projects" },
} as const;
```

### Matrix Akses Default per Role

| Role | view | create | edit | delete | comment | upload | manage_members |
|---|---|---|---|---|---|---|---|
| superadmin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| staff | ✓ | ✓ | ✓ (punya sendiri) | (punya sendiri) | ✓ | ✓ | ✓ (project sendiri) |
| pejabat | ✓ | — | — | — | ✓ | ✓ | — |
| viewer | ✓ | — | — | — | — | — | — |

---

## 8. UI & Halaman

### 8.1 List Project — `/projects`

```
┌─────────────────────────────────────────────────┐
│  Projects                        [+ New Project] │
│  ┌─────────────────────────────────────────────┐ │
│  │ 🔍 Search...  │ Type ▼ │ Status ▼ │ Label ▼ │ │
│  └─────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────┐ │
│  │ Title              │ Type     │ Status │ SKP │ │
│  │ ─────────────────────────────────────────── │ │
│  │ Workshop PPh Badan │ Workshop │ Active │ 16  │ │
│  │ Seminar Pajak 2026 │ Seminar  │ Done   │ 8   │ │
│  │ Lokakarya Brevet   │ Lokakarya│ Draft  │ -   │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 8.2 Modal Create / Edit Project

```
┌──────────────────────────────────────┐
│  New Project                     [×] │
│  ─────────────────────────────────── │
│                                      │
│  Title:        [________________]    │
│  Type:         [Dropdown ▼      ]    │
│  Description:  ┌────────────────┐    │
│                │ TipTap Editor  │    │
│                │ (rich text)    │    │
│                └────────────────┘    │
│  Start Date:   [📅 __/__/____  ]    │
│  End Date:     [📅 __/__/____  ]    │
│  Price:        [Rp __________  ]    │
│                                      │
│  Labels:       [Workshop ×] [+Add]   │
│                                      │
│  ─────────── SKP ────────────────── │
│  Mode:         ○ Auto   ● Manual     │
│                                      │
│  ┌ Auto ──────────────────────────┐ │
│  │ Calculated: 16 SKP (2 hari)    │ │
│  │ ☐ Setengah Hari → [2 ▼ / 4]   │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌ Manual ────────────────────────┐ │
│  │ SKP: [_____]                   │ │
│  └────────────────────────────────┘ │
│                                      │
│  ─────────────────────────────────── │
│              [Cancel]    [Save]      │
└──────────────────────────────────────┘
```

### 8.3 Halaman Detail Project — `/projects/[id]`

Layout tab seperti Rise CRM:

```
┌──────────────────────────────────────────────────────┐
│  ← Back to Projects                                  │
│                                                      │
│  Workshop PPh Badan              [Edit]  [••• More]  │
│  Status: ● In Progress · SKP: 16 · Rp 5.000.000     │
│  Labels: [Workshop] [PPh] [Badan]                    │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ [Overview] [Comments] [Files] [Members] [Log]  │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  (tab content di bawah)                              │
└──────────────────────────────────────────────────────┘
```

---

### 8.3.1 Tab Overview

```
┌─ Project Details ────────────────────────────────┐
│                                                   │
│  Type:            Workshop                        │
│  Start Date:      12 Mei 2026                     │
│  End Date:        13 Mei 2026                     │
│  Duration:        2 hari                          │
│  SKP:             16 (auto-calculated)            │
│  Price:           Rp 5.000.000                    │
│  Created by:      Budi Santoso                    │
│  Created at:      1 Mei 2026, 10:30 WIB           │
│                                                   │
│  ── Description ──────────────────────────────── │
│  (rendered rich text content)                     │
│                                                   │
└───────────────────────────────────────────────────┘
```

### 8.3.2 Tab Comments

```
┌─ Comments ───────────────────────────────────────┐
│  ┌──────────────────────────────────────────────┐ │
│  │ [textarea — ketik @ untuk mention]           │ │
│  │                                       [Send] │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│  ┌─ Budi Santoso · 1 jam lalu ─────────────────┐  │
│  │ Mohon disiapkan materi sesi pagi.           │  │
│  │ @AniWijaya tolong bantu slide presentasi.   │  │
│  │                              [Reply] [Edit] │  │
│  └─────────────────────────────────────────────┘  │
│    └─ Ani Wijaya · 30 menit lalu ─────────────┐   │
│       Baik, saya siapkan slide-nya.           │   │
│       File saya kirim di tab Files.           │   │
│                                [Reply] [Edit] │   │
│       └───────────────────────────────────────┘   │
└───────────────────────────────────────────────────┘
```

### 8.3.3 Tab Files

```
┌─ Files ──────────────────────────────────────────┐
│  [+ Upload File]  [Drag & drop area]              │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │ 📄 Materi Workshop PPh.pdf                  │  │
│  │    2.4 MB · Uploaded by Budi · 1 jam lalu  │  │
│  │    [Download] [Delete]                      │  │
│  │ ─────────────────────────────────────────── │  │
│  │ 📊 Slide Presentasi.pptx                   │  │
│  │    5.1 MB · Uploaded by Ani · 30 mnt lalu  │  │
│  │    [Download] [Delete]                      │  │
│  └─────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘
```

### 8.3.4 Tab Members

```
┌─ Members ────────────────────────────────────────┐
│  [+ Add Member]                                   │
│                                                   │
│  ┌─────────────────────────────────────────────┐  │
│  │ 👤 Budi Santoso    Owner    · Keuangan      │  │
│  │ 👤 Ani Wijaya      Manager  · Administrasi  │  │
│  │ 👤 Candra Putra    Member   · IT            │  │
│  │ 👤 Dewi Lestari    Viewer   · Hukum         │  │
│  └─────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘
```

### 8.3.5 Modal Add Member

```
┌──────────────────────────────────────┐
│  Add Members                    [×]  │
│  ─────────────────────────────────── │
│  Search: [cari nama/email...    ]    │
│  ┌────────────────────────────────┐  │
│  │ ☐ Ahmad Fauzi  · Keuangan     │  │
│  │ ☐ Cici Amelia  · Administrasi │  │
│  │ ☐ Doni Saputra · IT           │  │
│  └────────────────────────────────┘  │
│                                      │
│  Role: [Member ▼]                    │
│                                      │
│              [Cancel]  [Add]         │
└──────────────────────────────────────┘
```

### 8.3.6 Tab Activity Log

```
┌─ Activity Log ────────────────────────────────────┐
│  ┌──────────────────────────────────────────────┐  │
│  │ 10:30  Ani Wijaya    uploaded a file         │  │
│  │        Slide Presentasi.pptx                 │  │
│  │ ──────────────────────────────────────────── │  │
│  │ 10:15  Ani Wijaya    commented               │  │
│  │        "Baik, saya siapkan slide-nya..."     │  │
│  │ ──────────────────────────────────────────── │  │
│  │ 09:00  Budi Santoso  commented               │  │
│  │        "Mohon disiapkan materi..."           │  │
│  │ ──────────────────────────────────────────── │  │
│  │ 08:30  Budi Santoso  created the project     │  │
│  └──────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────┘
```

---

## 9. Server Actions

Lokasi: `src/server/actions/projects.ts`

### Projects CRUD

| Action | Deskripsi | Auth Check |
|---|---|---|
| `listProjects(filters)` | List project dengan filter/search | `projects:view` + membership |
| `getProjectById(id)` | Detail project + cek membership | Member project |
| `createProject(data)` | Buat project + auto-add creator sbg owner | `projects:create` |
| `updateProject(id, data)` | Update project + log aktivitas | Owner/Manager |
| `deleteProject(id)` | Delete project | Owner only |
| `updateProjectStatus(id, status)` | Ganti status + log | Owner/Manager |

### Members

| Action | Deskripsi | Auth Check |
|---|---|---|
| `addProjectMembers(projectId, users)` | Tambah member + notifikasi + log | Owner/Manager |
| `removeProjectMember(projectId, userId)` | Hapus member + log | Owner/Manager |
| `updateMemberRole(projectId, userId, role)` | Ganti role + log | Owner |
| `getProjectMembers(projectId)` | List member (untuk mention popup) | Member project |
| `searchUsersForInvite(query, projectId)` | Cari user yang belum jadi member | Owner/Manager |

### Comments

| Action | Deskripsi | Auth Check |
|---|---|---|
| `createComment(projectId, data)` | Simpan komentar + parse mention + notifikasi | Member project |
| `updateComment(commentId, content)` | Edit komentar | Author only |
| `deleteComment(commentId)` | Hapus komentar | Author / Owner |
| `listComments(projectId)` | List komentar ber-thread | Member project |

### Files

| Action | Deskripsi | Auth Check |
|---|---|---|
| `uploadProjectFile(projectId, file)` | Upload via storage provider | Member project |
| `deleteProjectFile(fileId)` | Hapus file | Uploader / Owner |
| `listProjectFiles(projectId)` | List file | Member project |

### Activity Log

| Action | Deskripsi | Auth Check |
|---|---|---|
| `listProjectActivity(projectId)` | Log aktivitas | Member project |

### Labels

| Action | Deskripsi | Auth Check |
|---|---|---|
| `listLabels()` | List semua label | `projects:view` |
| `createLabel(name, color)` | Buat label baru | `projects:create` |

### Zod Validation Schema

```typescript
// src/server/actions/projects.ts

const projectSchema = z.object({
  title: z.string().min(1, "Judul wajib diisi").max(255),
  type: z.enum(["Workshop", "Seminar", "Lokakarya", "Pelatihan", "Lainnya"]),
  description: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  price: z.number().optional().nullable(),
  status: z.enum(["not_started", "in_progress", "on_hold", "completed", "cancelled"]).optional(),
  skpMode: z.enum(["auto", "manual"]).default("auto"),
  skp: z.number().optional().nullable(),
  halfDaySkp: z.enum(["2", "4"]).optional().nullable(),
  labelIds: z.array(z.string().uuid()).optional(),
});
```

---

## 10. Notifikasi

Gunakan tabel `notifications` yang sudah ada. Tipe baru:

| Tipe | Trigger | Pesan Template |
|---|---|---|
| `project_invitation` | User di-invite ke project | "Anda diundang ke project **{title}** oleh **{inviter}**" |
| `mention` | User di-@mention di komentar | "**{author}** mention Anda di project **{title}**" |
| `project_update` | Komentar/file baru di project yg diikuti | "**{author}** menambahkan {activity} di **{title}**" |

### Link Notifikasi

Semua notifikasi project mengarah ke halaman detail project:

```
/projects/{projectId}?tab=comments   → untuk mention & komentar baru
/projects/{projectId}?tab=files      → untuk file baru
/projects/{projectId}                → untuk invitation
```

---

## 11. Sidebar Navigation

Tambahkan item di `src/components/dashboard/Sidebar.tsx`:

```typescript
{
  label: "Projects",
  href: "/projects",
  icon: FolderKanban,
  allowedRoles: ["admin", "staff", "pejabat"],
  requiredCapability: "projects:view",
}
```

---

## 12. Struktur File

```
src/
├── app/(dashboard)/projects/
│   ├── page.tsx                          # List project (DataTable)
│   └── [id]/
│       └── page.tsx                      # Detail project (tabbed)
│
├── components/projects/
│   ├── ProjectManager.tsx                # DataTable + filter + create button
│   ├── ProjectForm.tsx                   # Modal form (react-hook-form + zod)
│   ├── ProjectDetail.tsx                 # Layout tab + header info
│   ├── ProjectOverview.tsx               # Tab: overview details
│   ├── CommentSection.tsx                # Tab: comments + mention popup
│   ├── CommentItem.tsx                   # Single comment (render mention + reply)
│   ├── FileSection.tsx                   # Tab: file list + upload
│   ├── MemberSection.tsx                 # Tab: member list + invite
│   ├── AddMemberModal.tsx                # Modal: search & invite
│   ├── ActivityLog.tsx                   # Tab: activity timeline
│   └── MentionPopover.tsx                # Popover: @mention user picker
│
├── lib/
│   ├── skp-calculator.ts                 # Kalkulasi SKP otomatis
│   └── mention-parser.ts                 # Parse @mention dari text
│
└── server/
    ├── actions/
    │   └── projects.ts                   # Semua server actions
    └── db/
        └── schema.ts                     # + 8 tabel baru
```

---

## 13. Urutan Implementasi

| # | Task | Detail |
|---|---|---|
| 1 | **Schema DB** | Tambah 8 tabel + enum ke `schema.ts` |
| 2 | **Generate + Push Migration** | `npx drizzle-kit generate` → `npx drizzle-kit push` |
| 3 | **SKP Calculator** | Utility function di `src/lib/skp-calculator.ts` |
| 4 | **Mention Parser** | Utility function di `src/lib/mention-parser.ts` |
| 5 | **RBAC Capabilities** | Tambah 7 capabilities ke `src/lib/rbac/capabilities.ts` |
| 6 | **Server Actions** | Semua aksi di `src/server/actions/projects.ts` |
| 7 | **ProjectManager** | List page + DataTable + filter |
| 8 | **ProjectForm** | Modal create/edit dengan SKP section |
| 9 | **ProjectDetail** | Tabbed layout header |
| 10 | **CommentSection** | Komentar + mention popover + notifikasi |
| 11 | **FileSection** | Upload + list + download |
| 12 | **MemberSection + AddMemberModal** | Invite + role management |
| 13 | **ActivityLog** | Timeline aktivitas |
| 14 | **Route setup** | `page.tsx` untuk list & detail |
| 15 | **Sidebar** | Tambah item "Projects" |
| 16 | **Test & Verify** | Manual testing semua flow |

---

## 14. Dependencies

**Tidak ada dependency baru.** Semua pakai existing:

| Kebutuhan | Existing |
|---|---|
| Form handling | `react-hook-form` + `zod` |
| Rich text editor | TipTap (`src/components/ui/html-editor.tsx`) |
| Date handling | `date-fns` |
| DataTable | `@tanstack/react-table` + `src/components/ui/data-table.tsx` |
| Dialog / Modal | shadcn/ui `Dialog` |
| Popover | shadcn/ui `Popover` |
| Toast | `sonner` |
| File storage | `src/lib/storage/` |
| Auth | Better Auth (`requireSession`) |
| Notifications | tabel `notifications` |

---

## 15. Catatan Penting

1. **Divisi tidak under project.** Divisi = setting global (`users.divisiId`). Di project hanya tampil sebagai info saat invite member (biar tahu orangnya dari divisi mana).
2. **SKP default auto-calculated** dari rentang tanggal, tapi bisa di-override manual untuk kasus khusus (misal: workshop yang SKP-nya sudah ditentukan oleh asosiasi).
3. **Hanya member project yang bisa di-@mention.** Bukan semua user sistem.
4. **File disimpan di folder terpisah** per project: `projects/{projectId}/` — sudah didukung existing storage provider.
5. **Soft delete** untuk comments dan files disarankan (tambah kolom `deletedAt`) untuk audit trail, tapi bisa juga hard delete karena sudah ada `project_activity_log`.
6. **Relasi ke events opsional** — project bisa tetap berdiri sendiri tanpa harus terhubung ke event.
