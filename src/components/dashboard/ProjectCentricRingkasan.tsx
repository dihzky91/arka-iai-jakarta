"use client";

import {
  AlertTriangle,
  Bell,
  CalendarDays,
  ClipboardList,
} from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ProjectsOverviewWidget } from "@/components/dashboard/ProjectsOverviewWidget";
import { TasksOverviewWidget } from "@/components/dashboard/TasksOverviewWidget";
import { MyTasksWidget } from "@/components/dashboard/MyTasksWidget";
import { UpcomingEventsWidget } from "@/components/dashboard/UpcomingEventsWidget";
import type { ProjectCentricData } from "@/server/actions/statistics";

interface ProjectCentricRingkasanProps {
  data: ProjectCentricData;
  userName: string | null;
}

export function ProjectCentricRingkasan({
  data,
  userName,
}: ProjectCentricRingkasanProps) {
  return (
    <div className="space-y-6">
      {/* Quick Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          compact
          label="Terlambat"
          value={String(data.overdueTasks)}
          hint="task melewati deadline"
          icon={AlertTriangle}
          tone="red"
        />
        <MetricCard
          compact
          label="Task Saya"
          value={String(data.myOpenTasks)}
          hint="belum selesai"
          href="/projects"
          icon={ClipboardList}
          tone="blue"
        />
        <MetricCard
          compact
          label="Event Hari Ini"
          value={String(data.eventsToday)}
          hint="agenda hari ini"
          href="/kalender"
          icon={CalendarDays}
          tone="emerald"
        />
        <MetricCard
          compact
          label="Belum Dibaca"
          value={String(data.unreadAnnouncements)}
          hint="pengumuman baru"
          href="/pengumuman"
          icon={Bell}
          tone="amber"
        />
      </div>

      {/* Projects Overview + Tasks Overview */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ProjectsOverviewWidget stats={data.projectStats} />
        <TasksOverviewWidget stats={data.taskStats} />
      </div>

      {/* My Tasks + Upcoming Events */}
      <div className="grid gap-4 lg:grid-cols-2">
        <MyTasksWidget tasks={data.myTasks} />
        <UpcomingEventsWidget events={data.upcomingEvents} />
      </div>
    </div>
  );
}
