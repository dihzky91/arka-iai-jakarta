# Tasks: Dashboard Project-Centric Default View (Fase A)

## Task 1: Create `getProjectCentricData` server action
- [ ] Add `ProjectCentricData` interface to `src/server/actions/statistics.ts`
- [ ] Implement `getProjectCentricData(userId)` with parallel queries:
  - Count overdue tasks (assigned to user, status != done, due_date < today)
  - Count open tasks (assigned to user, status != done)
  - Count today's calendar events (from calendar_events table)
  - Get project stats (count by status for user's projects via project_members)
  - Get task stats (count by status for user's tasks)
  - Get 5 most recent open tasks with project title (JOIN projects)
  - Get upcoming events within 7 days (calendar_events + project start dates)
- [ ] Wrap in `unstable_cache` with 60s revalidation and dashboard tag
- [ ] Export the cached version

## Task 2: Update dashboard page to fetch project-centric data
- [ ] In `src/app/(dashboard)/dashboard/page.tsx`:
  - Determine `isProjectCentric` flag: `!isSuperAdmin && capabilities.includes("projects:view")`
  - Conditionally call `getProjectCentricData(userId)` only when eligible
  - Pass `projectData` prop to `DashboardContent`

## Task 3: Create `ProjectCentricRingkasan` component
- [ ] Create `src/components/dashboard/ProjectCentricRingkasan.tsx`
- [ ] Layout: Quick Stats Row (4 MetricCards) + 2-col grid (ProjectsOverview + TasksOverview) + 2-col grid (MyTasks + UpcomingEvents) + Pengumuman section
- [ ] Use existing MetricCard with compact prop for Quick Stats:
  - Terlambat (AlertTriangle, red tone)
  - Task Saya (ClipboardList, blue tone)
  - Event Hari Ini (CalendarDays, emerald tone)
  - Belum Dibaca (Bell, amber tone)
- [ ] Responsive: 1 col mobile, 2 col sm, 4 col xl for stats; 1 col mobile, 2 col lg for widgets

## Task 4: Create `ProjectsOverviewWidget` component
- [ ] Create `src/components/dashboard/ProjectsOverviewWidget.tsx`
- [ ] Show 3 status counts: Open (blue badge), Completed (green badge), Hold (amber badge)
- [ ] Show progress bar with average progress percentage
- [ ] Link "Lihat Projects →" to `/projects`
- [ ] Use rounded-[24px] card style consistent with existing dashboard cards
- [ ] Empty state if all counts are 0

## Task 5: Create `TasksOverviewWidget` component
- [ ] Create `src/components/dashboard/TasksOverviewWidget.tsx`
- [ ] Show 3 status counts: To Do, In Progress, Done
- [ ] Show overdue warning badge (red) if overdue > 0
- [ ] Use rounded-[24px] card style
- [ ] Empty state if no tasks

## Task 6: Create `MyTasksWidget` component
- [ ] Create `src/components/dashboard/MyTasksWidget.tsx`
- [ ] Use `DashboardActivityList` wrapper pattern
- [ ] Each task item: status icon + title (truncated) + project name (muted) + due date badge
- [ ] Due date badge turns red if overdue
- [ ] Link to project detail page
- [ ] Empty state: "Tidak ada task terbuka" with appropriate icon

## Task 7: Create `UpcomingEventsWidget` component
- [ ] Create `src/components/dashboard/UpcomingEventsWidget.tsx`
- [ ] Use `DashboardActivityList` wrapper pattern
- [ ] Each event: calendar icon + title + formatted date + type badge
- [ ] Date formatting: "Hari ini", "Besok", or "20 Mei" format
- [ ] Link to `/kalender`
- [ ] Empty state: "Tidak ada event mendatang"

## Task 8: Integrate into `DashboardContent` and `RingkasanTab`
- [ ] Add `projectData: ProjectCentricData | null` prop to `DashboardContentProps`
- [ ] Pass `projectData` to `RingkasanTab`
- [ ] In `RingkasanTab`: if `projectData !== null` → render `ProjectCentricRingkasan`
- [ ] Else → render existing admin layout (MetricCards + AntreanPersuratan + ProfileCard + QuickActions)
- [ ] Keep ProfileCard and QuickActionsCard in right sidebar for project-centric view too

## Task 9: Verify build and type-check
- [ ] Run `npm run typecheck` — zero errors
- [ ] Run `npm run build` — successful build
- [ ] Run `npm run lint` — no new lint errors
- [ ] Verify dashboard renders correctly for both admin and staff roles (manual check via existing test accounts)
