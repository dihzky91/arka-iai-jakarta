"use client";

import { AlertTriangle, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectCentricData } from "@/server/actions/statistics";

interface TasksOverviewWidgetProps {
  stats: ProjectCentricData["taskStats"];
}

export function TasksOverviewWidget({ stats }: TasksOverviewWidgetProps) {
  const total = stats.todo + stats.inProgress + stats.done;

  return (
    <section className="rounded-[24px] border border-border/60 bg-card p-5 text-card-foreground shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">Semua Task</h3>
        </div>
        {stats.overdue > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300">
            <AlertTriangle className="h-3 w-3" />
            {stats.overdue} terlambat
          </div>
        )}
      </div>

      {total === 0 ? (
        <div className="mt-5 flex flex-col items-center justify-center py-6 text-center">
          <ClipboardList className="h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">
            Belum ada task yang di-assign
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {/* Status counts */}
          <div className="flex flex-wrap gap-3">
            <TaskStatusBadge label="To Do" count={stats.todo} tone="slate" />
            <TaskStatusBadge label="In Progress" count={stats.inProgress} tone="blue" />
            <TaskStatusBadge label="Done" count={stats.done} tone="emerald" />
          </div>

          {/* Completion ratio */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Selesai</span>
              <span className="font-medium text-foreground">
                {total > 0 ? Math.round((stats.done / total) * 100) : 0}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/60">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{
                  width: `${total > 0 ? Math.round((stats.done / total) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function TaskStatusBadge({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "slate" | "blue" | "emerald";
}) {
  const toneStyles = {
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "rounded-full px-2.5 py-1 text-xs font-medium",
          toneStyles[tone],
        )}
      >
        {label}
      </span>
      <span className="text-lg font-semibold text-foreground">{count}</span>
    </div>
  );
}
