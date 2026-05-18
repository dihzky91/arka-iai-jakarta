"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CalendarDays, CheckCircle2, Circle, Clock, FolderKanban } from "lucide-react";
import type { GlobalTaskRow } from "@/server/actions/projects";
import { listMyTasks } from "@/server/actions/projects";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

type TaskStatus = "todo" | "in_progress" | "done";

const COLUMNS: { status: TaskStatus; label: string; icon: typeof Circle; color: string }[] = [
  {
    status: "todo",
    label: "To Do",
    icon: Circle,
    color: "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/30",
  },
  {
    status: "in_progress",
    label: "In Progress",
    icon: Clock,
    color: "border-blue-200 bg-blue-50 dark:border-blue-900/70 dark:bg-blue-950/25",
  },
  {
    status: "done",
    label: "Done",
    icon: CheckCircle2,
    color: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/25",
  },
];

interface GlobalKanbanBoardProps {
  initialTasks: GlobalTaskRow[];
}

export function GlobalKanbanBoard({ initialTasks }: GlobalKanbanBoardProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [isPending, startTransition] = useTransition();

  const refresh = () => {
    startTransition(async () => {
      const updated = await listMyTasks();
      setTasks(updated);
    });
  };

  const getTasksByStatus = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status);

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="Belum ada task"
        description="Kamu belum memiliki task yang di-assign. Task akan muncul di sini saat kamu ditugaskan di project."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={refresh} disabled={isPending}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const columnTasks = getTasksByStatus(col.status);
          const Icon = col.icon;
          return (
            <div key={col.status} className={`rounded-xl border p-4 ${col.color}`}>
              <div className="mb-3 flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <h3 className="text-sm font-semibold">{col.label}</h3>
                <Badge variant="secondary" className="ml-auto text-xs">
                  {columnTasks.length}
                </Badge>
              </div>

              <div className="space-y-2">
                {columnTasks.map((task) => (
                  <Card key={task.id} className="shadow-sm">
                    <CardContent className="p-3">
                      <p className="text-sm font-medium leading-tight">{task.title}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Link
                          href={`/projects/${task.projectId}`}
                          className="text-xs text-muted-foreground hover:text-primary hover:underline"
                        >
                          {task.projectTitle}
                        </Link>
                      </div>
                      {task.dueDate && (
                        <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarDays className="h-3 w-3" />
                          {task.dueDate}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {columnTasks.length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    Tidak ada task
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
