"use client";

import Link from "next/link";
import { ArrowRight, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectCentricData } from "@/server/actions/statistics";

interface ProjectsOverviewWidgetProps {
  stats: ProjectCentricData["projectStats"];
}

export function ProjectsOverviewWidget({ stats }: ProjectsOverviewWidgetProps) {
  const total = stats.open + stats.completed + stats.hold;

  return (
    <section className="rounded-[24px] border border-border/60 bg-card p-5 text-card-foreground shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">
            Projects Overview
          </h3>
        </div>
        <Link
          href="/projects"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Lihat Projects
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {total === 0 ? (
        <div className="mt-5 flex flex-col items-center justify-center py-6 text-center">
          <FolderKanban className="h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">
            Belum ada project aktif
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {/* Status badges */}
          <div className="flex flex-wrap gap-3">
            <StatusBadge label="Open" count={stats.open} tone="blue" />
            <StatusBadge label="Completed" count={stats.completed} tone="emerald" />
            <StatusBadge label="Hold" count={stats.hold} tone="amber" />
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progress Keseluruhan</span>
              <span className="font-medium text-foreground">
                {stats.totalProgress}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/60">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(100, stats.totalProgress)}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function StatusBadge({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "blue" | "emerald" | "amber";
}) {
  const toneStyles = {
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
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
