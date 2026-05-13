"use client";

import { useTransition } from "react";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useState } from "react";
import { toast } from "sonner";
import { type ProjectTaskStatus } from "@/lib/project-constants";
import { type ProjectTaskRow, type ProjectMemberRow, type ProjectMilestoneRow, updateProjectTask } from "@/server/actions/projects";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";

const COLUMNS: { status: ProjectTaskStatus; label: string; color: string }[] = [
  {
    status: "todo",
    label: "To Do",
    color: "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/30",
  },
  {
    status: "in_progress",
    label: "In Progress",
    color: "border-blue-200 bg-blue-50 dark:border-blue-900/70 dark:bg-blue-950/25",
  },
  {
    status: "done",
    label: "Done",
    color: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/25",
  },
];

export function KanbanBoard({
  projectId,
  tasks,
  members,
  milestones,
  canManage,
  currentUserId,
  onRefresh,
  pending,
  onEditTask,
  onDeleteTask,
  onToggleStatus,
  onAddTask,
}: {
  projectId: string;
  tasks: ProjectTaskRow[];
  members: ProjectMemberRow[];
  milestones: ProjectMilestoneRow[];
  canManage: boolean;
  currentUserId: string;
  onRefresh: () => void;
  pending: boolean;
  onEditTask: (task: ProjectTaskRow) => void;
  onDeleteTask: (task: ProjectTaskRow) => void;
  onToggleStatus: (task: ProjectTaskRow) => void;
  onAddTask: (status: ProjectTaskStatus) => void;
}) {
  const [activeTask, setActiveTask] = useState<ProjectTaskRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function getColumnTasks(status: ProjectTaskStatus) {
    return tasks.filter((t) => t.status === status);
  }

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  }

  function resolveColumnStatus(overId: string | number): ProjectTaskStatus | null {
    // Direct drop on a column droppable
    const col = COLUMNS.find((c) => c.status === overId);
    if (col) return col.status;
    // Drop on a task card — resolve from that task's current status
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask) return overTask.status;
    return null;
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const targetStatus = resolveColumnStatus(over.id);
    if (!targetStatus) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    // Permission check
    const canEdit =
      canManage ||
      task.assigneeId === currentUserId ||
      task.createdBy === currentUserId;
    if (!canEdit) {
      toast.error("Anda tidak memiliki izin mengubah task ini.");
      return;
    }

    startTransition(async () => {
      const result = await updateProjectTask(task.id, {
        id: task.id,
        title: task.title,
        description: task.description,
        assigneeId: task.assigneeId,
        status: targetStatus,
        dueDate: task.dueDate,
        milestoneId: task.milestoneId,
      });
      if (result.ok) {
        toast.success(`Task dipindahkan ke ${COLUMNS.find((c) => c.status === targetStatus)?.label ?? targetStatus}.`);
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-x-visible">
        {COLUMNS.map((col) => {
          const columnTasks = getColumnTasks(col.status);
          return (
            <SortableContext
              key={col.status}
              items={columnTasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <KanbanColumn
                status={col.status}
                label={col.label}
                color={col.color}
                count={columnTasks.length}
                canAdd={canManage}
                pending={isPending || pending}
                onAdd={() => onAddTask(col.status)}
              >
                {columnTasks.map((task) => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    milestones={milestones}
                    canEdit={
                      canManage ||
                      task.assigneeId === currentUserId ||
                      task.createdBy === currentUserId
                    }
                    pending={isPending || pending}
                    onEdit={onEditTask}
                    onDelete={onDeleteTask}
                    onToggleStatus={onToggleStatus}
                  />
                ))}
                {columnTasks.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border/60 bg-background/40 p-4 text-center text-sm text-muted-foreground">
                    Tarik task ke sini
                  </div>
                ) : null}
              </KanbanColumn>
            </SortableContext>
          );
        })}
      </div>
      <DragOverlay>
        {activeTask ? (
          <KanbanCard
            task={activeTask}
            milestones={milestones}
            canEdit={false}
            pending={false}
            onEdit={() => {}}
            onDelete={() => {}}
            onToggleStatus={() => {}}
            isDragging
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
