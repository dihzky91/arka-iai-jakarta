"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Search,
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
import { HtmlEditor } from "@/components/ui/html-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatSKP } from "@/lib/skp-calculator";
import { formatTanggal } from "@/lib/utils";
import {
  PROJECT_STATUSES,
  PROJECT_TYPES,
  type ProjectStatus,
  type ProjectType,
} from "@/lib/project-constants";
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
  type ProjectLabelRow,
  type ProjectListResult,
  type ProjectListRow,
} from "@/server/actions/projects";

type EventOption = { id: number; title: string; date: string };

const formSchema = z
  .object({
    title: z.string().trim().min(1, "Judul wajib diisi."),
    type: z.enum(PROJECT_TYPES),
    description: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    price: z.coerce.number().optional().nullable(),
    status: z.enum(PROJECT_STATUSES),
    skpMode: z.enum(["auto", "manual"]),
    skp: z.coerce.number().optional().nullable(),
    halfDaySkp: z.enum(["none", "2", "4"]),
    eventId: z.string().optional(),
    labelIds: z.array(z.string()).optional(),
  })
  .refine(
    (data) => !data.startDate || !data.endDate || data.endDate >= data.startDate,
    {
      message: "Tanggal selesai tidak boleh sebelum tanggal mulai.",
      path: ["endDate"],
    },
  );

type FormValues = z.infer<typeof formSchema>;

type Filters = {
  search: string;
  type: ProjectType | "all";
  status: ProjectStatus | "all";
  labelId: string | "all";
};

const defaultFilters: Filters = {
  search: "",
  type: "all",
  status: "all",
  labelId: "all",
};

function statusLabel(status: ProjectStatus) {
  const labels: Record<ProjectStatus, string> = {
    not_started: "Belum mulai",
    in_progress: "Berjalan",
    on_hold: "Tertunda",
    completed: "Selesai",
    cancelled: "Dibatalkan",
  };
  return labels[status];
}

function statusClass(status: ProjectStatus) {
  const classes: Record<ProjectStatus, string> = {
    not_started: "border-slate-200 bg-slate-50 text-slate-700",
    in_progress: "border-blue-200 bg-blue-50 text-blue-700",
    on_hold: "border-amber-200 bg-amber-50 text-amber-700",
    completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
    cancelled: "border-red-200 bg-red-50 text-red-700",
  };
  return classes[status];
}

function toFormValues(project?: ProjectListRow): FormValues {
  return {
    title: project?.title ?? "",
    type: project?.type ?? "Workshop",
    description: project?.description ?? "",
    startDate: project?.startDate ?? "",
    endDate: project?.endDate ?? "",
    price: project?.price ? Number(project.price) : null,
    status: project?.status ?? "not_started",
    skpMode: (project?.skpMode as "auto" | "manual" | undefined) ?? "auto",
    skp: project?.skp ? Number(project.skp) : null,
    halfDaySkp: (project?.halfDaySkp as "2" | "4" | null) ?? "none",
    eventId: "",
    labelIds: project?.labels.map((label) => label.id) ?? [],
  };
}

export function ProjectManager({
  initialProjectList,
  labels,
  eventOptions,
}: {
  initialProjectList: ProjectListResult;
  labels: ProjectLabelRow[];
  eventOptions: EventOption[];
}) {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [data, setData] = useState(initialProjectList);
  const [editingProject, setEditingProject] = useState<ProjectListRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: toFormValues(),
  });
  const labelIds = form.watch("labelIds");

  function fetchProjects(overrides: Partial<Filters & { page?: number }> = {}) {
    startTransition(async () => {
      const next = { ...filters, ...overrides };
      const result = await listProjects({
        search: next.search || undefined,
        type: next.type !== "all" ? next.type : undefined,
        status: next.status !== "all" ? next.status : undefined,
        labelId: next.labelId !== "all" ? next.labelId : undefined,
        page: overrides.page ?? 1,
      });
      setData(result);
      setFilters(next);
    });
  }

  function openCreate() {
    setEditingProject(null);
    form.reset(toFormValues());
    setDialogOpen(true);
  }

  function openEdit(project: ProjectListRow) {
    setEditingProject(project);
    form.reset(toFormValues(project));
    setDialogOpen(true);
  }

  function toggleLabel(labelId: string) {
    const current = form.getValues("labelIds") ?? [];
    form.setValue(
      "labelIds",
      current.includes(labelId)
        ? current.filter((item) => item !== labelId)
        : [...current, labelId],
    );
  }

  function submit(values: FormValues) {
    startTransition(async () => {
      const payload = {
        ...values,
        labelIds: values.labelIds ?? [],
        description: values.description || null,
        startDate: values.startDate || null,
        endDate: values.endDate || null,
        price: values.price ?? null,
        skp: values.skp ?? null,
        halfDaySkp: values.halfDaySkp === "none" ? null : values.halfDaySkp,
        eventId: values.eventId ? Number(values.eventId) : null,
      };

      const result = editingProject
        ? await updateProject(editingProject.id, payload)
        : await createProject(payload);

      if (result.ok) {
        toast.success(editingProject ? "Project diperbarui." : "Project dibuat.");
        setDialogOpen(false);
        fetchProjects();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove(project: ProjectListRow) {
    if (!window.confirm(`Hapus project "${project.title}"?`)) return;
    startTransition(async () => {
      const result = await deleteProject(project.id);
      if (result.ok) {
        toast.success("Project dihapus.");
        fetchProjects();
      } else {
        toast.error(result.error);
      }
    });
  }

  const hasProjects = data.rows.length > 0;
  const selectedLabels = useMemo(
    () => new Set(labelIds ?? []),
    [labelIds],
  );

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_repeat(3,minmax(0,220px))_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Cari project"
              value={filters.search}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, search: event.target.value }))
              }
              onKeyDown={(event) => event.key === "Enter" && fetchProjects()}
            />
          </div>
          <Select
            value={filters.type}
            onValueChange={(value) => fetchProjects({ type: value as Filters["type"] })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Tipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua tipe</SelectItem>
              {PROJECT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.status}
            onValueChange={(value) =>
              fetchProjects({ status: value as Filters["status"] })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              {PROJECT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.labelId}
            onValueChange={(value) => fetchProjects({ labelId: value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Label" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua label</SelectItem>
              {labels.map((label) => (
                <SelectItem key={label.id} value={label.id}>
                  {label.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>SKP</TableHead>
              <TableHead>Tim</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((project) => (
              <TableRow key={project.id}>
                <TableCell className="min-w-[260px]">
                  <div>
                    <Link
                      href={`/projects/${project.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {project.title}
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {project.labels.map((label) => (
                        <Badge
                          key={label.id}
                          variant="outline"
                          style={{ borderColor: label.color, color: label.color }}
                        >
                          {label.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{project.type}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusClass(project.status)}>
                    {statusLabel(project.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{project.progress}%</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    {formatTanggal(project.startDate)} - {formatTanggal(project.endDate)}
                  </span>
                </TableCell>
                <TableCell>{formatSKP(project.skp)}</TableCell>
                <TableCell>{project.memberCount} anggota</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button asChild variant="outline" size="icon-sm">
                      <Link href={`/projects/${project.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => openEdit(project)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => remove(project)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!hasProjects ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Belum ada project yang sesuai filter.
          </div>
        ) : null}
      </div>

      {data.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Halaman {data.page} dari {data.totalPages} ({data.total} total)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1 || isPending}
              onClick={() => fetchProjects({ page: data.page - 1 })}
            >
              Sebelumnya
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= data.totalPages || isPending}
              onClick={() => fetchProjects({ page: data.page + 1 })}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingProject ? "Edit Project" : "New Project"}
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-5" onSubmit={form.handleSubmit(submit)}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Judul</Label>
                <Input {...form.register("title")} />
                <FormError message={form.formState.errors.title?.message} />
              </div>
              <div className="space-y-2">
                <Label>Tipe</Label>
                <Select
                  value={form.watch("type")}
                  onValueChange={(value) => form.setValue("type", value as ProjectType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <HtmlEditor
                value={form.watch("description") ?? ""}
                onChange={(value) => form.setValue("description", value)}
                placeholder="Tulis deskripsi project..."
                minHeight={170}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Mulai</Label>
                <Input type="date" {...form.register("startDate")} />
              </div>
              <div className="space-y-2">
                <Label>Selesai</Label>
                <Input type="date" {...form.register("endDate")} />
                <FormError message={form.formState.errors.endDate?.message} />
              </div>
              <div className="space-y-2">
                <Label>Biaya</Label>
                <Input type="number" min={0} {...form.register("price")} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(value) =>
                    form.setValue("status", value as ProjectStatus)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mode SKP</Label>
                <Select
                  value={form.watch("skpMode")}
                  onValueChange={(value) =>
                    form.setValue("skpMode", value as "auto" | "manual")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Otomatis</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>SKP Manual</Label>
                <Input
                  type="number"
                  min={0}
                  disabled={form.watch("skpMode") === "auto"}
                  {...form.register("skp")}
                />
              </div>
              <div className="space-y-2">
                <Label>Setengah Hari</Label>
                <Select
                  value={form.watch("halfDaySkp")}
                  onValueChange={(value) =>
                    form.setValue("halfDaySkp", value as "none" | "2" | "4")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak</SelectItem>
                    <SelectItem value="2">2 SKP</SelectItem>
                    <SelectItem value="4">4 SKP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Link Event</Label>
              <Select
                value={form.watch("eventId") || "none"}
                onValueChange={(value) =>
                  form.setValue("eventId", value === "none" ? "" : value)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Opsional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tanpa event</SelectItem>
                  {eventOptions.map((event) => (
                    <SelectItem key={event.id} value={String(event.id)}>
                      {event.title} - {formatTanggal(event.date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Label</Label>
              <div className="flex flex-wrap gap-2">
                {labels.map((label) => {
                  const selected = selectedLabels.has(label.id);
                  return (
                    <button
                      key={label.id}
                      type="button"
                      onClick={() => toggleLabel(label.id)}
                      className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted"
                      style={{
                        borderColor: selected ? label.color : undefined,
                        color: selected ? label.color : undefined,
                      }}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: label.color }}
                      />
                      {label.name}
                    </button>
                  );
                })}
                {labels.length === 0 ? (
                  <span className="text-sm text-muted-foreground">
                    Belum ada label.
                  </span>
                ) : null}
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
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}
