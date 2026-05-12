"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatTanggal } from "@/lib/utils";
import { type ProjectTaskStatus } from "@/lib/project-constants";
import { type ProjectTaskRow, type ProjectMilestoneRow } from "@/server/actions/projects";

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false;
  const today = new Date().toISOString().split("T")[0] ?? "";
  return dueDate < today;
}

function taskStatusIcon(status: ProjectTaskStatus) {
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "in_progress") return <Clock className="h-4 w-4 text-blue-500" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
}

export function KanbanCard({
  task,
  milestones,
  canEdit,
  pending,
  onEdit,
  onDelete,
  onToggleStatus,
  isDragging = false,
}: {
  task: ProjectTaskRow;
  milestones: ProjectMilestoneRow[];
  canEdit: boolean;
  pending: boolean;
  onEdit: (task: ProjectTaskRow) => void;
  onDelete: (task: ProjectTaskRow) => void;
  onToggleStatus: (task: ProjectTaskRow) => void;
  isDragging?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id, disabled: !canEdit });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow ${
        isDragging ? "shadow-lg ring-2 ring-primary/30" : ""
      } ${task.status === "done" ? "bg-muted/40" : ""}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 shrink-0"
          onClick={() => onToggleStatus(task)}
          disabled={pending}
        >
          {taskStatusIcon(task.status)}
        </button>
        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-medium leading-snug ${
              task.status === "done" ? "text-muted-foreground line-through" : ""
            }`}
          >
            {task.title}
          </p>
          {task.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {task.description}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {task.assigneeName ? (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {task.assigneeName}
              </Badge>
            ) : null}
            {task.dueDate ? (
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${
                  isOverdue(task.dueDate) && task.status !== "done"
                    ? "border-red-300 bg-red-50 text-red-700"
                    : ""
                }`}
              >
                <CalendarDays className="mr-0.5 h-2.5 w-2.5" />
                {formatTanggal(task.dueDate)}
              </Badge>
            ) : null}
            {task.milestoneId ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {milestones.find((m) => m.id === task.milestoneId)?.title ?? "Milestone"}
              </Badge>
            ) : null}
          </div>
        </div>
        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={pending}
                className="shrink-0"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(task)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(task)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}
