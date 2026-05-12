"use client";

import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type ProjectTaskStatus } from "@/lib/project-constants";
import type { ReactNode } from "react";

export function KanbanColumn({
  status,
  label,
  color,
  count,
  canAdd,
  pending,
  onAdd,
  children,
}: {
  status: ProjectTaskStatus;
  label: string;
  color: string;
  count: number;
  canAdd: boolean;
  pending: boolean;
  onAdd: () => void;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-w-[260px] flex-col rounded-xl border-2 transition-colors ${
        isOver ? "border-primary/50 bg-primary/5" : color
      }`}
    >
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{label}</h3>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
            {count}
          </span>
        </div>
        {canAdd ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onAdd}
            disabled={pending}
          >
            <Plus className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <div className="flex-1 space-y-2 p-3">{children}</div>
    </div>
  );
}
