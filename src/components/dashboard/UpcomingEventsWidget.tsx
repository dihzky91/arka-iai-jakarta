"use client";

import { CalendarDays, FolderKanban, GraduationCap, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardActivityList } from "@/components/dashboard/DashboardActivityList";
import type { ProjectCentricData } from "@/server/actions/statistics";

interface UpcomingEventsWidgetProps {
  events: ProjectCentricData["upcomingEvents"];
}

const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  project: {
    label: "Project",
    className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300",
  },
  ujian: {
    label: "Ujian",
    className: "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300",
  },
  calendar: {
    label: "Kalender",
    className: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300",
  },
  disposisi: {
    label: "Disposisi",
    className: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
  },
};

export function UpcomingEventsWidget({ events }: UpcomingEventsWidgetProps) {
  return (
    <DashboardActivityList
      title="Event Mendatang"
      description="Agenda dalam 7 hari ke depan."
      detailHref="/kalender"
      detailLabel="Buka kalender"
      hasItems={events.length > 0}
      emptyIcon={CalendarDays}
      emptyTitle="Tidak ada event mendatang"
      emptyDescription="Event dan jadwal project akan muncul di sini."
    >
      {events.map((event) => {
        const typeInfo = TYPE_CONFIG[event.type] ?? TYPE_CONFIG.calendar;
        return (
          <div
            key={event.id}
            className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3.5 transition-colors hover:bg-muted/40"
          >
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
              {event.type === "project" ? (
                <FolderKanban className="h-4 w-4" />
              ) : event.type === "ujian" ? (
                <GraduationCap className="h-4 w-4" />
              ) : (
                <Calendar className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {event.title}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    typeInfo!.className,
                  )}
                >
                  {typeInfo!.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatEventDate(event.startDate)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </DashboardActivityList>
  );
}

function formatEventDate(isoStr: string): string {
  if (!isoStr) return "";
  const date = new Date(isoStr);
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const dateStr = date.toISOString().slice(0, 10);

  if (dateStr === todayStr) return "Hari ini";
  if (dateStr === tomorrowStr) return "Besok";

  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}
