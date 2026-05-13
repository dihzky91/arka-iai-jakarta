"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
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
import { formatTanggal } from "@/lib/utils";
import {
  createProjectMilestone,
  updateProjectMilestone,
  toggleProjectMilestone,
  deleteProjectMilestone,
  type ProjectMilestoneRow,
} from "@/server/actions/projects";
import { EmptyText } from "./shared-ui";

const milestoneFormSchema = z.object({
  title: z.string().trim().min(1, "Judul milestone wajib diisi.").max(255),
  targetDate: z.string().optional(),
});

type MilestoneFormValues = z.infer<typeof milestoneFormSchema>;

export function MilestoneSection({
  projectId,
  milestones,
  canManage,
  onRefresh,
  pending,
}: {
  projectId: string;
  milestones: ProjectMilestoneRow[];
  canManage: boolean;
  onRefresh: () => void;
  pending: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<ProjectMilestoneRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<MilestoneFormValues>({
    resolver: zodResolver(milestoneFormSchema),
    defaultValues: {
      title: "",
      targetDate: "",
    },
  });

  function openCreate() {
    setEditingMilestone(null);
    form.reset({ title: "", targetDate: "" });
    setDialogOpen(true);
  }

  function openEdit(milestone: ProjectMilestoneRow) {
    setEditingMilestone(milestone);
    form.reset({
      title: milestone.title,
      targetDate: milestone.targetDate ?? "",
    });
    setDialogOpen(true);
  }

  function submit(values: MilestoneFormValues) {
    startTransition(async () => {
      const payload = {
        title: values.title,
        targetDate: values.targetDate || null,
      };

      const result = editingMilestone
        ? await updateProjectMilestone(editingMilestone.id, { ...payload, id: editingMilestone.id })
        : await createProjectMilestone(projectId, payload);

      if (result.ok) {
        toast.success(editingMilestone ? "Milestone diperbarui." : "Milestone dibuat.");
        setDialogOpen(false);
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function toggle(milestone: ProjectMilestoneRow) {
    startTransition(async () => {
      const result = await toggleProjectMilestone(milestone.id);
      if (result.ok) {
        toast.success(
          milestone.isCompleted ? "Milestone dibuka kembali." : "Milestone diselesaikan.",
        );
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove(milestone: ProjectMilestoneRow) {
    if (!window.confirm(`Hapus milestone "${milestone.title}"?`)) return;
    startTransition(async () => {
      const result = await deleteProjectMilestone(milestone.id);
      if (result.ok) {
        toast.success("Milestone dihapus.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const completedCount = milestones.filter((m) => m.isCompleted).length;

  return (
    <section className="space-y-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold">Milestones</h2>
          <Badge variant="outline">
            {completedCount}/{milestones.length} selesai
          </Badge>
        </div>
        {canManage ? (
          <Button type="button" size="sm" onClick={openCreate} disabled={isPending || pending}>
            <Plus className="h-4 w-4" />
            Tambah Milestone
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        {milestones.map((milestone) => {
          return (
            <div
              key={milestone.id}
              className={`flex items-center gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/30 ${
                milestone.isCompleted ? "bg-muted/50" : ""
              }`}
            >
              <button
                type="button"
                className="flex-shrink-0"
                onClick={() => toggle(milestone)}
                disabled={!canManage || isPending || pending}
              >
                {milestone.isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p
                  className={`font-medium ${
                    milestone.isCompleted ? "text-muted-foreground line-through" : ""
                  }`}
                >
                  {milestone.title}
                </p>
                {milestone.targetDate ? (
                  <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <CalendarDays className="h-3 w-3" />
                    {formatTanggal(milestone.targetDate)}
                  </div>
                ) : null}
              </div>
              {canManage ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon-sm" disabled={isPending || pending}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(milestone)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => remove(milestone)}
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
        {milestones.length === 0 ? (
          <EmptyText
            icon={CalendarDays}
            title="Belum ada milestone"
            text="Buat milestone untuk menandai target penting dan memantau progres project."
            action={
              canManage ? (
                <Button type="button" size="sm" onClick={openCreate} disabled={isPending || pending}>
                  <Plus className="h-4 w-4" />
                  Tambah Milestone
                </Button>
              ) : null
            }
          />
        ) : null}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingMilestone ? "Edit Milestone" : "Tambah Milestone"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="milestone-title">Judul</Label>
              <Input
                id="milestone-title"
                {...form.register("title")}
                placeholder="Nama milestone"
              />
              {form.formState.errors.title ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.title.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="milestone-date">Target Tanggal</Label>
              <Input
                id="milestone-date"
                type="date"
                {...form.register("targetDate")}
              />
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
                {editingMilestone ? "Simpan" : "Buat Milestone"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
