"use client";

import Link from "next/link";
import { CheckCircle2, Circle, Clock, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardActivityList } from "@/components/dashboard/DashboardActivityList";
import type { ProjectCentricData } from "@/server/actions/statistics";

interface MyTasksWidgetProps {
  tasks: ProjectCentricData["myTasks"];
}

export function MyTasksWidget({ tasks }: MyTasksWidgetProps) {
  return (
    <DashboardActivityList
      title="Task Saya"
      description="Task yang di-assign ke Anda."
      detailHref="/projects"
      detailLabel="Lihat semua"
      hasItems={tasks.length > 0}
      emptyIcon={ClipboardList}
      emptyTitle="Tidak ada task terbuka"
      emptyDescription="Task yang di-assign ke Anda akan muncul di sini."
    >
      {tasks.map((task) => (
        <Link
          key={task.id}
          href={`/projects/${task.projectId}`}
          className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3.5 transition-colors hover:bg-muted/40"
        >
          <div className="mt-0.5 shrink-0">
            {task.status === "in_progress" ? (
              <Clock className="h-4.5 w-4.5 text-blue-500" />
            ) : (
              <Circle className="h-4.5 w-4.5 text-muted-foreground/60" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {task.title}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {task.projectTitle}
            </p>
          </div>
          {task.dueDate && (
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                task.isOverdue
                  ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {formatDueDate(task.dueDate)}
            </span>
          )}
        </Link>
      ))}
    </DashboardActivityList>
  );
}

function formatDueDate(dateStr: string): string {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  if (dateStr === todayStr) return "Hari ini";
  if (dateStr === tomorrowStr) return "Besok";
  if (dateStr < todayStr) return "Terlambat";

  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}
