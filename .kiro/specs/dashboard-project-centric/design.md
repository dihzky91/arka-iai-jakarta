# Design: Dashboard Project-Centric Default View (Fase A)

## Overview

Mengubah tampilan default tab "Ringkasan" di dashboard agar staff/pejabat yang punya `projects:view` melihat project-centric layout (terinspirasi Rise CRM), sementara SuperAdmin/Admin tetap melihat overview semua modul seperti sekarang.

## Architecture

### Data Flow

```
DashboardPage (server component)
  ├── getCurrentUserAccess() → capabilities, isSuperAdmin
  ├── getSession() → userId, userName
  ├── getRoleDashboardData() → existing metrics (persuratan, kepegawaian, dll)
  ├── getProjectCentricData(userId) → NEW: project stats, tasks, events [hanya jika eligible]
  └── DashboardContent (client component)
       └── DashboardTabs
            └── RingkasanTab
                 ├── [if superAdmin/admin] → AdminRingkasan (existing layout)
                 └── [if staff + projects:view] → ProjectCentricRingkasan (NEW)
```

### Eligibility Logic

```typescript
const isProjectCentric = !isSuperAdmin && capabilities.includes("projects:view");
```

SuperAdmin selalu melihat admin overview. Non-admin yang punya `projects:view` melihat project-centric. Non-admin tanpa `projects:view` tetap melihat layout existing (metric cards sesuai capability).

## New Server Action: `getProjectCentricData`

File: `src/server/actions/statistics.ts`

```typescript
export interface ProjectCentricData {
  // Quick Stats
  overdueTasks: number;
  myOpenTasks: number;
  eventsToday: number;
  unreadAnnouncements: number;
  
  // Projects Overview
  projectStats: {
    open: number;       // status: not_started, in_progress
    completed: number;  // status: completed
    hold: number;       // status: on_hold
    totalProgress: number; // average progress across active projects
  };
  
  // Tasks Overview
  taskStats: {
    todo: number;
    inProgress: number;
    done: number;
    overdue: number;
  };
  
  // My Tasks (5 terbaru, sorted by due date)
  myTasks: {
    id: string;
    title: string;
    projectTitle: string;
    status: "todo" | "in_progress" | "done";
    dueDate: string | null;
    isOverdue: boolean;
  }[];
  
  // Upcoming Events (7 hari ke depan)
  upcomingEvents: {
    id: string;
    title: string;
    startDate: string;
    type: string; // project start, calendar event, ujian
  }[];
}

export async function getProjectCentricData(userId: string): Promise<ProjectCentricData>
```

### Query Strategy

1. **overdueTasks** — `SELECT count(*) FROM project_tasks WHERE assignee_id = :userId AND status != 'done' AND due_date < today`
2. **myOpenTasks** — `SELECT count(*) FROM project_tasks WHERE assignee_id = :userId AND status != 'done'`
3. **eventsToday** — Use existing `getCalendarEvents` with today's date range
4. **unreadAnnouncements** — Use existing `countUnreadAnnouncements()`
5. **projectStats** — `SELECT status, count(*) FROM projects WHERE id IN (user's projects) GROUP BY status`
6. **taskStats** — `SELECT status, count(*) FROM project_tasks WHERE assignee_id = :userId GROUP BY status` + overdue count
7. **myTasks** — `SELECT ... FROM project_tasks JOIN projects WHERE assignee_id = :userId AND status != 'done' ORDER BY due_date ASC LIMIT 5`
8. **upcomingEvents** — Combine: project start dates within 7 days + calendar events within 7 days

All queries run in parallel via `Promise.all`.

## New Components

### 1. `ProjectCentricRingkasan`

File: `src/components/dashboard/ProjectCentricRingkasan.tsx`

Top-level layout component for the project-centric view.

```tsx
interface ProjectCentricRingkasanProps {
  data: ProjectCentricData;
  userName: string | null;
}
```

Layout:
```
┌─────────────────────────────────────────────────────────────┐
│ Quick Stats Row (4 cards, grid sm:2 xl:4)                   │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────┐ ┌────────────────────────────┐ │
│ │ Projects Overview        │ │ Semua Task                 │ │
│ │ (card with status counts │ │ (card with status counts   │ │
│ │  + progress bar)         │ │  + overdue warning)        │ │
│ └──────────────────────────┘ └────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────┐ ┌────────────────────────────┐ │
│ │ Task Saya (list 5 items) │ │ Event Mendatang            │ │
│ │                          │ │ (list upcoming 7 days)     │ │
│ └──────────────────────────┘ └────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Pengumuman Terbaru (if unread > 0)                          │
└─────────────────────────────────────────────────────────────┘
```

### 2. Quick Stats Row

Reuses existing `MetricCard` component with `compact` prop:

| Card | Icon | Tone | Value | Hint |
|------|------|------|-------|------|
| Terlambat | AlertTriangle | red | overdueTasks | "task melewati deadline" |
| Task Saya | ClipboardList | blue | myOpenTasks | "belum selesai" |
| Event Hari Ini | CalendarDays | emerald | eventsToday | "agenda hari ini" |
| Belum Dibaca | Bell | amber | unreadAnnouncements | "pengumuman baru" |

### 3. `ProjectsOverviewWidget`

File: `src/components/dashboard/ProjectsOverviewWidget.tsx`

Card showing project status breakdown + average progress bar.

```tsx
interface ProjectsOverviewWidgetProps {
  stats: ProjectCentricData["projectStats"];
}
```

Content:
- 3 status badges: Open (blue), Completed (green), Hold (amber)
- Progress bar showing `totalProgress`%
- Link "Lihat Projects →" to `/projects`

### 4. `TasksOverviewWidget`

File: `src/components/dashboard/TasksOverviewWidget.tsx`

Card showing task status breakdown + overdue warning.

```tsx
interface TasksOverviewWidgetProps {
  stats: ProjectCentricData["taskStats"];
}
```

Content:
- 3 status badges: To Do, In Progress, Done
- Overdue warning badge (red) if > 0
- Link "Lihat semua task →" to `/projects` (filtered)

### 5. `MyTasksWidget`

File: `src/components/dashboard/MyTasksWidget.tsx`

Uses `DashboardActivityList` pattern. Shows 5 most recent open tasks.

```tsx
interface MyTasksWidgetProps {
  tasks: ProjectCentricData["myTasks"];
}
```

Each item shows:
- Checkbox icon (unchecked for todo, half for in_progress)
- Task title (truncated)
- Project name (muted)
- Due date badge (red if overdue)

### 6. `UpcomingEventsWidget`

File: `src/components/dashboard/UpcomingEventsWidget.tsx`

Uses `DashboardActivityList` pattern. Shows events in next 7 days.

```tsx
interface UpcomingEventsWidgetProps {
  events: ProjectCentricData["upcomingEvents"];
}
```

Each item shows:
- Calendar icon
- Event title
- Date (formatted: "20 Mei" or "Besok")
- Type badge (project/calendar/ujian)

## Modified Files

### `src/app/(dashboard)/dashboard/page.tsx`

Add conditional fetch for project-centric data:

```typescript
const isProjectCentric = !isSuperAdmin && capabilities.includes("projects:view");
const projectData = isProjectCentric && userId
  ? await getProjectCentricData(userId)
  : null;

return <DashboardContent data={data} projectData={projectData} userName={userName} />;
```

### `src/components/dashboard/DashboardContent.tsx`

- Add `projectData` prop to `DashboardContentProps`
- Pass to `RingkasanTab`
- In `RingkasanTab`: if `projectData` is not null → render `ProjectCentricRingkasan`, else render existing admin layout

### `src/server/actions/statistics.ts`

- Add `ProjectCentricData` interface
- Add `getProjectCentricData(userId)` server action
- Add cached version for performance

## Design Decisions

1. **No new DB tables** — All data comes from existing tables (project_tasks, projects, project_members, calendar_events, announcements).
2. **Server-side rendering** — Data fetched in page.tsx (RSC), passed to client components. No client-side fetching needed.
3. **Reuse existing components** — MetricCard, DashboardActivityList, EmptyState all reused.
4. **Progressive** — If projectData is null (admin or no projects:view), falls back to existing layout. Zero breaking changes.
5. **Cache** — `getProjectCentricData` wrapped in `unstable_cache` with 60s revalidation, same pattern as existing dashboard metrics.

## Styling

- Follow existing ARKA design language: rounded-[24px] cards, border-border/60, shadow-sm
- Follow typography revamp: font-normal for body, font-medium for labels, font-semibold for numbers
- Responsive: 1 col mobile, 2 col tablet, 4 col desktop for stats row
- Use existing tone system from MetricCard
