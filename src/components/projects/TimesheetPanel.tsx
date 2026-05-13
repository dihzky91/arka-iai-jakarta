"use client";
import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { Clock, Play, Plus, Square } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createProjectTimesheet,
  deleteProjectTimesheet,
  startProjectTimer,
  stopProjectTimer,
  updateProjectTimesheet,
  type ProjectTimesheetRow,
  type ProjectTimesheetSummary,
} from "@/server/actions/projects";
import { minutesLabel, dateTimeLocalValue } from "@/lib/project-display-utils";
import { RowActions, EmptyText } from "./shared-ui";
import { SummaryCard } from "./FinancePanel";

export function TimesheetPanel({
  projectId,
  timesheets,
  summary,
  canManage: canManageProp,
  canContribute: canContributeProp,
  currentUserId,
  onRefresh,
  pending,
}: {
  projectId: string;
  timesheets: ProjectTimesheetRow[];
  summary: ProjectTimesheetSummary;
  canManage: boolean;
  canContribute: boolean;
  currentUserId: string;
  onRefresh: () => void;
  pending: boolean;
}) {
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectTimesheetRow | null>(null);
  const [form, setForm] = useState({ startTime: "", endTime: "", durationMinutes: "", description: "" });
  const [isPending, startTransition] = useTransition();

  function start() {
    startTransition(async () => {
      const result = await startProjectTimer(projectId, { description });
      if (result.ok) {
        setDescription("");
        toast.success("Timer dimulai.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function stop() {
    startTransition(async () => {
      const result = await stopProjectTimer(projectId, { description });
      if (result.ok) {
        setDescription("");
        toast.success("Timer dihentikan.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function openCreate() {
    const now = dateTimeLocalValue(new Date());
    setEditing(null);
    setForm({ startTime: now, endTime: now, durationMinutes: "", description: "" });
    setOpen(true);
  }

  function openEdit(row: ProjectTimesheetRow) {
    setEditing(row);
    setForm({
      startTime: dateTimeLocalValue(row.startTime),
      endTime: dateTimeLocalValue(row.endTime),
      durationMinutes: row.durationMinutes ? String(row.durationMinutes) : "",
      description: row.description ?? "",
    });
    setOpen(true);
  }

  function submit() {
    startTransition(async () => {
      const payload = {
        startTime: form.startTime,
        endTime: form.endTime || null,
        durationMinutes: form.durationMinutes ? Number(form.durationMinutes) : null,
        description: form.description || null,
      };
      const result = editing
        ? await updateProjectTimesheet(editing.id, payload)
        : await createProjectTimesheet(projectId, payload);
      if (result.ok) {
        toast.success(editing ? "Timesheet diperbarui." : "Timesheet ditambahkan.");
        setOpen(false);
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function removeTimesheet(row: ProjectTimesheetRow) {
    if (!window.confirm("Hapus timesheet ini?")) return;
    startTransition(async () => {
      const result = await deleteProjectTimesheet(row.id);
      if (result.ok) {
        toast.success("Timesheet dihapus.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const activeTimer = summary.activeTimer;

  return (
    <section className="space-y-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Total Jam Kerja" value={minutesLabel(summary.totalMinutes)} />
        <SummaryCard label="Timer Aktif" value={activeTimer ? "Berjalan" : "Tidak ada"} />
        <SummaryCard label="Kontributor" value={`${summary.byUser.length} user`} />
      </div>
      {canContributeProp ? (
        <div className="rounded-xl border border-border/60 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi kerja" />
            {activeTimer ? (
              <Button onClick={stop} disabled={isPending || pending} variant="destructive">
                <Square className="h-4 w-4" />
                Stop Timer
              </Button>
            ) : (
              <Button onClick={start} disabled={isPending || pending}>
                <Play className="h-4 w-4" />
                Start Timer
              </Button>
            )}
            <Button onClick={openCreate} disabled={isPending || pending} variant="outline">
              <Plus className="h-4 w-4" />
              Manual
            </Button>
          </div>
          {activeTimer ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Dimulai {formatDistanceToNow(new Date(activeTimer.startTime), { addSuffix: true, locale: id })}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
        <div className="space-y-3">
          {timesheets.map((row) => {
            const canEditRow = canManageProp || row.userId === currentUserId;
            return (
              <div key={row.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3 transition-colors hover:bg-muted/30">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{row.userName ?? "User"}</p>
                    {!row.endTime ? (
                      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-300">
                        Aktif
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{row.description ?? "-"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(row.startTime).toLocaleString("id-ID")} - {row.endTime ? new Date(row.endTime).toLocaleString("id-ID") : "berjalan"}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold">
                    <Clock className="h-4 w-4" />
                    {row.endTime ? minutesLabel(row.durationMinutes) : "Timer aktif"}
                  </p>
                </div>
                {canEditRow ? <RowActions onEdit={() => openEdit(row)} onDelete={() => removeTimesheet(row)} /> : null}
              </div>
            );
          })}
          {timesheets.length === 0 ? (
            <EmptyText
              icon={Clock}
              title="Belum ada timesheet"
              text="Mulai timer atau tambah timesheet manual untuk mencatat waktu kerja project."
              action={
                canContributeProp ? (
                  <Button onClick={openCreate} disabled={isPending || pending} size="sm">
                    <Plus className="h-4 w-4" />
                    Tambah Manual
                  </Button>
                ) : null
              }
            />
          ) : null}
        </div>
        <div className="rounded-xl border border-border/60 p-4">
          <h3 className="text-sm font-semibold">Total per User</h3>
          <div className="mt-3 space-y-2">
            {summary.byUser.map((row) => (
              <div key={row.userId} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{row.userName ?? "User"}</span>
                <span className="font-medium">{minutesLabel(row.totalMinutes)}</span>
              </div>
            ))}
            {summary.byUser.length === 0 ? <p className="text-xs text-muted-foreground">Belum ada jam selesai.</p> : null}
          </div>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Timesheet" : "Tambah Timesheet Manual"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Mulai</Label>
                <Input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Selesai</Label>
                <Input type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Durasi menit override</Label>
              <Input type="number" min={0} value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Batal</Button>
            <Button onClick={submit} disabled={!form.startTime || isPending}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
