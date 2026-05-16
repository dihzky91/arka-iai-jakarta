# Refactor: ProjectDetail.tsx (2448 baris → ~250 baris)

## Tujuan

Pecah `src/components/projects/ProjectDetail.tsx` (2448 baris) menjadi file-file kecil yang fokus.
Setelah refactor, `ProjectDetail.tsx` hanya berisi: state management, `refreshAll()`, `changeStatus()`, tabs layout.
**Jangan ubah behavior, UI, atau logic apapun. Pure move saja.**

---

## Peta Fungsi Saat Ini

| Fungsi / Component | Baris | Target File |
|---|---|---|
| `statusLabel`, `fileSize`, `fileTypeIcon`, `canManage`, `canContribute` | 140–171 | `src/lib/project-display-utils.ts` |
| `Avatar` | 173–202 | `src/components/projects/ProjectAvatar.tsx` |
| `ProjectDetail` (main export) | 204–610 | **TETAP di ProjectDetail.tsx** |
| `CircularProgress` | 611–644 | `src/components/projects/CircularProgress.tsx` |
| `Overview` + `Info` | 646–820 | `src/components/projects/ProjectOverviewSection.tsx` |
| `getCaretPixelPos`, `getMentionContext` | 821–869 | `src/lib/project-display-utils.ts` |
| `CommentSection` + `CommentItem` | 871–1301 | `src/components/projects/CommentSection.tsx` |
| `FileSection` | 1302–1476 | `src/components/projects/FileSection.tsx` |
| `MemberSection` | 1477–1657 | `src/components/projects/MemberSection.tsx` |
| `rupiah`, `minutesLabel`, `dateTimeLocalValue` | 1658–1677 | `src/lib/project-display-utils.ts` |
| `SpeakerPanel` | 1678–1875 | `src/components/projects/SpeakerPanel.tsx` |
| `ExpensePanel` + `SummaryCard` + `BudgetList` + `ExpenseList` + `MoneyForm` | 1876–2189 | `src/components/projects/FinancePanel.tsx` |
| `TimesheetPanel` | 2190–2399 | `src/components/projects/TimesheetPanel.tsx` |
| `RowActions` + `EmptyText` | 2401–2420 | `src/components/projects/shared-ui.tsx` |
| `ActivityLog` | 2424–2448 | `src/components/projects/ActivityLog.tsx` |

---

## Langkah Eksekusi

### STEP 1 — Buat `src/lib/project-display-utils.ts`

Ekstrak fungsi-fungsi pure (non-React) berikut dari `ProjectDetail.tsx`:

```typescript
// Dari baris 140–171
export function statusLabel(status: ProjectStatus): string { ... }
export function fileSize(size: number): string { ... }
export function fileTypeIcon(mimeType: string) { ... }  // return LucideIcon
export function canManage(role: ProjectMemberRole | "admin"): boolean { ... }
export function canContribute(role: ProjectMemberRole | "admin"): boolean { ... }

// Dari baris 821–869
export function getCaretPixelPos(el: HTMLTextAreaElement, pos: number): { top: number; left: number } { ... }
export function getMentionContext(text: string, cursorPos: number): { start: number; query: string } | null { ... }

// Dari baris 1658–1677
export function rupiah(value: number | string | null | undefined): string { ... }
export function minutesLabel(minutes: number | null | undefined): string { ... }
export function dateTimeLocalValue(date: Date | string | null | undefined): string { ... }
```

Import yang dibutuhkan file ini:
```typescript
import { Archive, File, FileImage, FileSpreadsheet, FileText } from "lucide-react";
import type { ProjectMemberRole, ProjectStatus } from "@/lib/project-constants";
```

---

### STEP 2 — Buat `src/components/projects/ProjectAvatar.tsx`

Ekstrak fungsi `Avatar` dari baris 173–202:

```typescript
"use client";

export function Avatar({
  name,
  avatarUrl,
  size = "sm",
}: {
  name: string | null;
  avatarUrl?: string | null;
  size?: "sm" | "md";
}) { ... }
```

Tidak perlu import tambahan selain React.

---

### STEP 3 — Buat `src/components/projects/CircularProgress.tsx`

Ekstrak `CircularProgress` dari baris 611–644:

```typescript
"use client";

export function CircularProgress({ value, size = 80 }: { value: number; size?: number }) { ... }
```

---

### STEP 4 — Buat `src/components/projects/ProjectOverviewSection.tsx`

Ekstrak `Overview` (646–810) dan helper `Info` (812–820).

Import yang dibutuhkan:
```typescript
"use client";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { formatTanggal } from "@/lib/utils";
import { formatSKP } from "@/lib/skp-calculator";
import { PROJECT_TYPE_LABELS } from "@/lib/project-constants";
import {
  type ProjectDetailRow,
  type ProjectTaskRow,
  type ProjectActivityRow,
  type ProjectMemberRow,
  type ProjectFileRow,
  type BrevetSummary,
  type HonorariumSummary,
  type InvoiceKuitansiSummary,
  type ProjectCertificateInfo,
} from "@/server/actions/projects";
import { CircularProgress } from "./CircularProgress";
import { Avatar } from "./ProjectAvatar";
import { BrevetInfoCard } from "./BrevetInfoCard";
import { HonorariumCard } from "./HonorariumCard";
import { CertificateSection } from "./CertificateSection";
import { InvoiceKuitansiSection } from "./InvoiceKuitansiSection";
import { AnnouncementQuickActions } from "./AnnouncementQuickActions";
import { statusLabel } from "@/lib/project-display-utils";
```

Export: `export function Overview(...)` dan `function Info(...)` (Info boleh tetap tidak di-export karena hanya dipakai Overview).

---

### STEP 5 — Buat `src/components/projects/CommentSection.tsx`

Ekstrak `CommentSection` (871–1195) dan `CommentItem` (1196–1301) beserta helper `getCaretPixelPos` dan `getMentionContext` (yang sudah dipindah ke `project-display-utils.ts`).

Import yang dibutuhkan:
```typescript
"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { Bold, Copy, Download, ExternalLink, File, FileImage, FileText, FileSpreadsheet, Archive, Italic, List, Loader2, MoreHorizontal, Paperclip, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { splitMentions } from "@/lib/mention-parser";
import { formatTanggalWaktuJakarta } from "@/lib/utils";
import {
  createComment,
  uploadProjectFile,
  type ProjectCommentRow,
  type ProjectMemberRow,
  type ProjectFileRow,
} from "@/server/actions/projects";
import { Avatar } from "./ProjectAvatar";
import { getCaretPixelPos, getMentionContext, fileTypeIcon, fileSize } from "@/lib/project-display-utils";
```

Export: `export function CommentSection(...)`. `CommentItem` boleh tidak di-export (hanya dipakai oleh `CommentSection`).

---

### STEP 6 — Buat `src/components/projects/FileSection.tsx`

Ekstrak `FileSection` dari baris 1302–1476.

Import yang dibutuhkan:
```typescript
"use client";
import { useRef, useState, useTransition } from "react";
import { Download, ExternalLink, FileUp, ImageIcon, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTanggalWaktuJakarta } from "@/lib/utils";
import {
  deleteProjectFile,
  uploadProjectFile,
  type ProjectFileRow,
} from "@/server/actions/projects";
import { fileTypeIcon, fileSize } from "@/lib/project-display-utils";
```

Export: `export function FileSection(...)`.

---

### STEP 7 — Buat `src/components/projects/MemberSection.tsx`

Ekstrak `MemberSection` dari baris 1477–1657.

Import yang dibutuhkan:
```typescript
"use client";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROJECT_MEMBER_ROLES, type ProjectMemberRole } from "@/lib/project-constants";
import {
  addProjectMembers,
  removeProjectMember,
  searchUsersForInvite,
  updateMemberRole,
  type InviteUserRow,
  type ProjectMemberRow,
} from "@/server/actions/projects";
import { Avatar } from "./ProjectAvatar";
```

Export: `export function MemberSection(...)`.

---

### STEP 8 — Buat `src/components/projects/SpeakerPanel.tsx`

Ekstrak `SpeakerPanel` dari baris 1678–1875.

Import yang dibutuhkan:
```typescript
"use client";
import { useState, useTransition } from "react";
import { MoreHorizontal, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createProjectSpeaker,
  deleteProjectSpeaker,
  updateProjectSpeaker,
  type ProjectMemberRow,
  type ProjectSpeakerRow,
} from "@/server/actions/projects";
import { RowActions } from "./shared-ui";
import { EmptyText } from "./shared-ui";
import { minutesLabel } from "@/lib/project-display-utils";
```

Export: `export function SpeakerPanel(...)`.

---

### STEP 9 — Buat `src/components/projects/FinancePanel.tsx`

Ekstrak komponen berikut dari `ProjectDetail.tsx`:
- `ExpensePanel` (baris 1876–1940)
- `SummaryCard` (baris 1942–1950)
- `BudgetList` (baris 1952–2027)
- `ExpenseList` (baris 2028–2144)
- `MoneyForm` (baris 2145–2189)

Import yang dibutuhkan:
```typescript
"use client";
import { useState, useTransition } from "react";
import { MoreHorizontal, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createProjectBudgetItem,
  createProjectExpense,
  deleteProjectBudgetItem,
  deleteProjectExpense,
  updateProjectBudgetItem,
  updateProjectExpense,
  type ProjectBudgetItemRow,
  type ProjectExpenseRow,
  type ProjectFinancialSummary,
} from "@/server/actions/projects";
import { rupiah } from "@/lib/project-display-utils";
import { RowActions, EmptyText } from "./shared-ui";
```

Export: `export function ExpensePanel(...)`. `SummaryCard`, `BudgetList`, `ExpenseList`, `MoneyForm` boleh tidak di-export (hanya dipakai internal `FinancePanel.tsx`).

---

### STEP 10 — Buat `src/components/projects/TimesheetPanel.tsx`

Ekstrak `TimesheetPanel` dari baris 2190–2399.

Import yang dibutuhkan:
```typescript
"use client";
import { useState, useTransition } from "react";
import { Pencil, Play, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createProjectTimesheet,
  deleteProjectTimesheet,
  startProjectTimer,
  stopProjectTimer,
  updateProjectTimesheet,
  type ProjectTimesheetRow,
  type ProjectTimesheetSummary,
} from "@/server/actions/projects";
import { minutesLabel, dateTimeLocalValue } from "@/lib/project-display-utils";
import { RowActions, EmptyText } from "./shared-ui";
```

Export: `export function TimesheetPanel(...)`.

---

### STEP 11 — Buat `src/components/projects/shared-ui.tsx`

Ekstrak `RowActions` (2401–2412) dan `EmptyText` (2414–2420):

```typescript
"use client";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) { ... }
export function EmptyText({ text }: { text: string }) { ... }
```

---

### STEP 12 — Buat `src/components/projects/ActivityLog.tsx`

Ekstrak `ActivityLog` dari baris 2424–2448:

```typescript
"use client";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { type ProjectActivityRow } from "@/server/actions/projects";

export function ActivityLog({ rows }: { rows: ProjectActivityRow[] }) { ... }
```

---

### STEP 13 — Update `ProjectDetail.tsx`

Setelah semua file baru dibuat, hapus semua fungsi yang sudah dipindah dari `ProjectDetail.tsx` dan tambahkan import dari file-file baru:

```typescript
// Hapus dari ProjectDetail.tsx:
// - statusLabel, fileSize, fileTypeIcon, canManage, canContribute (→ project-display-utils.ts)
// - Avatar (→ ProjectAvatar.tsx)
// - CircularProgress (→ CircularProgress.tsx)
// - Overview + Info (→ ProjectOverviewSection.tsx)
// - getCaretPixelPos, getMentionContext (→ project-display-utils.ts)
// - CommentSection + CommentItem (→ CommentSection.tsx)
// - FileSection (→ FileSection.tsx)
// - MemberSection (→ MemberSection.tsx)
// - rupiah, minutesLabel, dateTimeLocalValue (→ project-display-utils.ts)
// - SpeakerPanel (→ SpeakerPanel.tsx)
// - ExpensePanel + SummaryCard + BudgetList + ExpenseList + MoneyForm (→ FinancePanel.tsx)
// - TimesheetPanel (→ TimesheetPanel.tsx)
// - RowActions + EmptyText (→ shared-ui.tsx)
// - ActivityLog (→ ActivityLog.tsx)

// Tambahkan import baru di ProjectDetail.tsx:
import { canManage, canContribute, statusLabel } from "@/lib/project-display-utils";
import { Overview } from "./ProjectOverviewSection";
import { CommentSection } from "./CommentSection";
import { FileSection } from "./FileSection";
import { MemberSection } from "./MemberSection";
import { SpeakerPanel } from "./SpeakerPanel";
import { ExpensePanel } from "./FinancePanel";
import { TimesheetPanel } from "./TimesheetPanel";
import { ActivityLog } from "./ActivityLog";
```

Setelah selesai, `ProjectDetail.tsx` hanya berisi:
- Import statements (~50 baris)
- `ProjectDetail` component dengan state, `refreshAll`, `changeStatus`, tabs JSX (~200 baris)
- **Total target: ≤270 baris**

---

## Aturan Penting

1. **Jangan ubah logic apapun** — pure extract/move saja
2. **Semua `"use client"` directive** harus ada di setiap file component baru
3. **Urutan eksekusi**: Step 1 → 2 → 3 → ... → 13 (karena ada dependency antar file)
4. **Verifikasi setelah selesai**: jalankan `pnpm tsc --noEmit` untuk pastikan tidak ada type error
5. **Tidak perlu buat test** — cukup pastikan TypeScript compile clean
6. File `Avatar` di ProjectDetail.tsx dipakai oleh `CommentSection`, `MemberSection`, dan `ProjectOverviewSection` — pastikan semua import dari `./ProjectAvatar`
7. `RowActions` dan `EmptyText` dipakai oleh `SpeakerPanel`, `FinancePanel`, dan `TimesheetPanel` — import dari `./shared-ui`
8. `rupiah` dipakai oleh `FinancePanel` — import dari `@/lib/project-display-utils`

---

## Hasil Akhir Struktur File

```
src/
├── lib/
│   └── project-display-utils.ts        (NEW — pure utils)
└── components/projects/
    ├── ProjectDetail.tsx                (REFACTORED — ~270 baris)
    ├── ProjectAvatar.tsx                (NEW)
    ├── CircularProgress.tsx             (NEW)
    ├── ProjectOverviewSection.tsx       (NEW)
    ├── CommentSection.tsx               (NEW)
    ├── FileSection.tsx                  (NEW)
    ├── MemberSection.tsx                (NEW)
    ├── SpeakerPanel.tsx                 (NEW)
    ├── FinancePanel.tsx                 (NEW)
    ├── TimesheetPanel.tsx               (NEW)
    ├── shared-ui.tsx                    (NEW)
    ├── ActivityLog.tsx                  (NEW)
    │
    │   (file-file ini sudah ada, tidak diubah):
    ├── TaskSection.tsx
    ├── MilestoneSection.tsx
    ├── BrevetInfoCard.tsx
    ├── NoteSection.tsx
    ├── HonorariumCard.tsx
    ├── InvoiceKuitansiSection.tsx
    ├── CertificateSection.tsx
    └── AnnouncementQuickActions.tsx
```
