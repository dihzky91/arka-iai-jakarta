"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatTanggal } from "@/lib/utils";
import { PROJECT_TASK_STATUSES, type ProjectTaskStatus } from "@/lib/project-constants";
import {
  createProjectTask,
  updateProjectTask,
  deleteProjectTask,
  type ProjectTaskRow,
  type ProjectMemberRow,
  type ProjectMilestoneRow,
} from "@/server/actions/projects";

const taskFormSchema = z.object({
  title: z.string().trim().min(1, "Judul task wajib diisi.").max(255),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  status: z.enum(PROJECT_TASK_STATUSES),
  dueDate: z.string().optional(),
  milestoneId: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

function taskStatusLabel(status: ProjectTaskStatus) {
  const labels: Record<ProjectTaskStatus, string> = {
    todo: "To Do",
    in_progress: "In Progress",
    done: "Done",
  };
  return labels[status];
}

function taskStatusIcon(status: ProjectTaskStatus) {
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "in_progress") return <Clock className="h-4 w-4 text-blue-500" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
}

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false;
  const today = new Date().toISOString().split("T")[0] ?? "";
  return dueDate < today;
}

export function TaskSection({
  projectId,
  tasks,
  members,
  milestones,
  canManage,
  currentUserId,
  onRefresh,
  pending,
}: {
  projectId: string;
  tasks: ProjectTaskRow[];
  members: ProjectMemberRow[];
  milestones: ProjectMilestoneRow[];
  canManage: boolean;
  currentUserId: string;
  onRefresh: () => void;
  pending: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTaskRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      assigneeId: "",
      status: "todo",
      dueDate: "",
      milestoneId: "",
    },
  });

  function openCreate() {
    setEditingTask(null);
    form.reset({
      title: "",
      description: "",
      assigneeId: "",
      status: "todo",
      dueDate: "",
      milestoneId: "",
    });
    setDialogOpen(true);
  }

  function openEdit(task: ProjectTaskRow) {
    setEditingTask(task);
    form.reset({
      title: task.title,
      description: task.description ?? "",
      assigneeId: task.assigneeId ?? "",
      status: task.status,
      dueDate: task.dueDate ?? "",
      milestoneId: task.milestoneId ?? "",
    });
    setDialogOpen(true);
  }

  function submit(values: TaskFormValues) {
    startTransition(async () => {
      const payload = {
        title: values.title,
        description: values.description || null,
        assigneeId: values.assigneeId || null,
        status: values.status,
        dueDate: values.dueDate || null,
        milestoneId: values.milestoneId || null,
      };

      const result = editingTask
        ? await updateProjectTask(editingTask.id, { ...payload, id: editingTask.id })
        : await createProjectTask(projectId, payload);

      if (result.ok) {
        toast.success(editingTask ? "Task diperbarui." : "Task dibuat.");
        setDialogOpen(false);
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function toggleStatus(task: ProjectTaskRow) {
    const nextStatus: ProjectTaskStatus = task.status === "done" ? "todo" : "done";
    startTransition(async () => {
      const result = await updateProjectTask(task.id, {
        id: task.id,
        title: task.title,
        description: task.description,
        assigneeId: task.assigneeId,
        status: nextStatus,
        dueDate: task.dueDate,
        milestoneId: task.milestoneId,
      });
      if (result.ok) {
        toast.success(nextStatus === "done" ? "Task diselesaikan." : "Task dibuka kembali.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove(task: ProjectTaskRow) {
    if (!window.confirm(`Hapus task "${task.title}"?`)) return;
    startTransition(async () => {
      const result = await deleteProjectTask(task.id);
      if (result.ok) {
        toast.success("Task dihapus.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const todoTasks = tasks.filter((t) => t.status === "todo");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const doneTasks = tasks.filter((t) => t.status === "done");

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">Tasks</h2>
          <div className="flex gap-1.5">
            <Badge variant="outline">{todoTasks.length} To Do</Badge>
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
              {inProgressTasks.length} In Progress
            </Badge>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              {doneTasks.length} Done
            </Badge>
          </div>
        </div>
        {canManage ? (
          <Button type="button" size="sm" onClick={openCreate} disabled={isPending || pending}>
            <Plus className="h-4 w-4" />
            Tambah Task
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        {tasks.map((task) => {
          const canEdit =
            canManage ||
            task.assigneeId === currentUserId ||
            task.createdBy === currentUserId;
          return (
            <div
              key={task.id}
              className={`flex items-start gap-3 rounded-lg border border-border p-3 transition-colors ${
                task.status === "done" ? "bg-muted/50" : ""
              }`}
            >
              <button
                type="button"
                className="mt-0.5 flex-shrink-0"
                onClick={() => toggleStatus(task)}
                disabled={isPending || pending}
              >
                {taskStatusIcon(task.status)}
              </button>
              <div className="min-w-0 flex-1">
                <p
                  className={`font-medium ${
                    task.status === "done" ? "text-muted-foreground line-through" : ""
                  }`}
                >
                  {task.title}
                </p>
                {task.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {task.assigneeName ? (
                    <Badge variant="secondary" className="text-xs">
                      {task.assigneeName}
                    </Badge>
                  ) : null}
                  {task.dueDate ? (
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        isOverdue(task.dueDate) && task.status !== "done"
                          ? "border-red-300 bg-red-50 text-red-700"
                          : ""
                      }`}
                    >
                      <CalendarDays className="mr-1 h-3 w-3" />
                      {formatTanggal(task.dueDate)}
                    </Badge>
                  ) : null}
                  {task.milestoneId ? (
                    <Badge variant="outline" className="text-xs">
                      {milestones.find((m) => m.id === task.milestoneId)?.title ?? "Milestone"}
                    </Badge>
                  ) : null}
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      task.status === "done"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : task.status === "in_progress"
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : ""
                    }`}
                  >
                    {taskStatusLabel(task.status)}
                  </Badge>
                </div>
              </div>
              {canEdit ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon-sm" disabled={isPending || pending}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(task)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => remove(task)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Hapus
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          );
        })}
        {tasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Belum ada task.
          </p>
        ) : null}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit Task" : "Tambah Task"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Judul</Label>
              <Input id="task-title" {...form.register("title")} placeholder="Nama task" />
              {form.formState.errors.title ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.title.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-desc">Deskripsi</Label>
              <Textarea
                id="task-desc"
                {...form.register("description")}
                placeholder="Deskripsi task (opsional)"
                rows={3}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Assignee</Label>
                <Select
                  value={form.watch("assigneeId") || "__none__"}
                  onValueChange={(value) =>
                    form.setValue("assigneeId", value === "__none__" ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih anggota" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Tidak di-assign</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.userId} value={member.userId}>
                        {member.namaLengkap ?? member.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as ProjectTaskStatus)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_TASK_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {taskStatusLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="task-due">Due Date</Label>
                <Input id="task-due" type="date" {...form.register("dueDate")} />
              </div>
              <div className="space-y-2">
                <Label>Milestone</Label>
                <Select
                  value={form.watch("milestoneId") || "__none__"}
                  onValueChange={(value) =>
                    form.setValue("milestoneId", value === "__none__" ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih milestone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Tanpa milestone</SelectItem>
                    {milestones.map((milestone) => (
                      <SelectItem key={milestone.id} value={milestone.id}>
                        {milestone.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {editingTask ? "Simpan" : "Buat Task"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
