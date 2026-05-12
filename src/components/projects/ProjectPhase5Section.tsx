"use client";

import { useMemo, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { Clock, ExternalLink, Loader2, Pencil, Play, Plus, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatTanggal } from "@/lib/utils";
import {
  createProjectBudgetItem,
  createProjectExpense,
  createProjectSpeaker,
  createProjectTimesheet,
  deleteProjectBudgetItem,
  deleteProjectExpense,
  deleteProjectSpeaker,
  deleteProjectTimesheet,
  startProjectTimer,
  stopProjectTimer,
  updateProjectBudgetItem,
  updateProjectExpense,
  updateProjectSpeaker,
  updateProjectTimesheet,
  uploadProjectFile,
  type ProjectBudgetItemRow,
  type ProjectExpenseRow,
  type ProjectFinancialSummary,
  type ProjectMemberRow,
  type ProjectSpeakerRow,
  type ProjectTimesheetRow,
  type ProjectTimesheetSummary,
} from "@/server/actions/projects";

function rupiah(value: number | string | null | undefined) {
  return `Rp ${Number(value ?? 0).toLocaleString("id-ID")}`;
}

function minutesLabel(minutes: number | null | undefined) {
  const total = Number(minutes ?? 0);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins} menit`;
  if (mins === 0) return `${hours} jam`;
  return `${hours} jam ${mins} menit`;
}

function dateTimeLocalValue(date: Date | string | null | undefined) {
  if (!date) return "";
  const parsed = new Date(date);
  const offset = parsed.getTimezoneOffset() * 60000;
  return new Date(parsed.getTime() - offset).toISOString().slice(0, 16);
}

export function ProjectPhase5Section({
  projectId,
  members,
  speakers,
  budgetItems,
  expenses,
  financialSummary,
  timesheets,
  timesheetSummary,
  canManage,
  canContribute,
  currentUserId,
  onRefresh,
  pending,
}: {
  projectId: string;
  members: ProjectMemberRow[];
  speakers: ProjectSpeakerRow[];
  budgetItems: ProjectBudgetItemRow[];
  expenses: ProjectExpenseRow[];
  financialSummary: ProjectFinancialSummary;
  timesheets: ProjectTimesheetRow[];
  timesheetSummary: ProjectTimesheetSummary;
  canManage: boolean;
  canContribute: boolean;
  currentUserId: string;
  onRefresh: () => void;
  pending: boolean;
}) {
  return (
    <Tabs defaultValue="speakers" className="space-y-4">
      <TabsList className="flex w-full justify-start gap-1 overflow-x-auto">
        <TabsTrigger value="speakers">Narasumber</TabsTrigger>
        <TabsTrigger value="expenses">Expenses</TabsTrigger>
        <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
      </TabsList>
      <TabsContent value="speakers">
        <SpeakerPanel
          projectId={projectId}
          members={members}
          speakers={speakers}
          canManage={canManage}
          onRefresh={onRefresh}
          pending={pending}
        />
      </TabsContent>
      <TabsContent value="expenses">
        <ExpensePanel
          projectId={projectId}
          budgetItems={budgetItems}
          expenses={expenses}
          summary={financialSummary}
          canManage={canManage}
          onRefresh={onRefresh}
          pending={pending}
        />
      </TabsContent>
      <TabsContent value="timesheets">
        <TimesheetPanel
          projectId={projectId}
          timesheets={timesheets}
          summary={timesheetSummary}
          canManage={canManage}
          canContribute={canContribute}
          currentUserId={currentUserId}
          onRefresh={onRefresh}
          pending={pending}
        />
      </TabsContent>
    </Tabs>
  );
}

function SpeakerPanel({
  projectId,
  members,
  speakers,
  canManage,
  onRefresh,
  pending,
}: {
  projectId: string;
  members: ProjectMemberRow[];
  speakers: ProjectSpeakerRow[];
  canManage: boolean;
  onRefresh: () => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectSpeakerRow | null>(null);
  const [form, setForm] = useState({
    userId: "",
    nama: "",
    email: "",
    topik: "",
    durasiMenit: "",
    skp: "",
    isExternal: false,
  });
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setForm({ userId: "", nama: "", email: "", topik: "", durasiMenit: "", skp: "", isExternal: false });
    setOpen(true);
  }

  function openEdit(row: ProjectSpeakerRow) {
    setEditing(row);
    setForm({
      userId: row.userId ?? "",
      nama: row.nama,
      email: row.email ?? "",
      topik: row.topik ?? "",
      durasiMenit: row.durasiMenit ? String(row.durasiMenit) : "",
      skp: row.skp ? String(row.skp) : "",
      isExternal: row.isExternal,
    });
    setOpen(true);
  }

  function chooseMember(userId: string) {
    const member = members.find((item) => item.userId === userId);
    setForm((current) => ({
      ...current,
      userId,
      nama: member?.namaLengkap ?? current.nama,
      email: member?.email ?? current.email,
      isExternal: false,
    }));
  }

  function submit() {
    startTransition(async () => {
      const payload = {
        userId: form.userId || null,
        nama: form.nama,
        email: form.email || null,
        topik: form.topik || null,
        durasiMenit: form.durasiMenit ? Number(form.durasiMenit) : null,
        skp: form.skp ? Number(form.skp) : null,
        isExternal: form.isExternal,
      };
      const result = editing
        ? await updateProjectSpeaker(editing.id, payload)
        : await createProjectSpeaker(projectId, payload);
      if (result.ok) {
        toast.success(editing ? "Narasumber diperbarui." : "Narasumber ditambahkan.");
        setOpen(false);
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove(row: ProjectSpeakerRow) {
    if (!window.confirm(`Hapus narasumber "${row.nama}"?`)) return;
    startTransition(async () => {
      const result = await deleteProjectSpeaker(row.id);
      if (result.ok) {
        toast.success("Narasumber dihapus.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <section className="space-y-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Narasumber</h2>
        {canManage ? (
          <Button size="sm" onClick={openCreate} disabled={isPending || pending}>
            <Plus className="h-4 w-4" />
            Tambah
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {speakers.map((speaker) => (
          <div key={speaker.id} className="rounded-xl border border-border/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{speaker.nama}</h3>
                  <Badge variant="outline">{speaker.isExternal ? "Eksternal" : "Internal"}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{speaker.email ?? "-"}</p>
                <p className="mt-2 text-sm">{speaker.topik ?? "Topik belum diisi"}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{speaker.durasiMenit ? `${speaker.durasiMenit} menit` : "Durasi -"}</span>
                  <span>{speaker.skp ? `${speaker.skp} SKP` : "SKP -"}</span>
                </div>
              </div>
              {canManage ? (
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(speaker)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => remove(speaker)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {speakers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Belum ada narasumber.
        </p>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Narasumber" : "Tambah Narasumber"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>User internal</Label>
              <Select value={form.userId || "manual"} onValueChange={(value) => (value === "manual" ? setForm((current) => ({ ...current, userId: "", isExternal: true })) : chooseMember(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih user internal atau input manual" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Input manual / eksternal</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.userId} value={member.userId}>
                      {member.namaLengkap ?? member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Topik</Label>
              <Input value={form.topik} onChange={(e) => setForm({ ...form, topik: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Durasi menit</Label>
              <Input type="number" min={0} value={form.durasiMenit} onChange={(e) => setForm({ ...form, durasiMenit: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>SKP</Label>
              <Input type="number" min={0} step="0.5" value={form.skp} onChange={(e) => setForm({ ...form, skp: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Batal</Button>
            <Button onClick={submit} disabled={!form.nama.trim() || isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ExpensePanel({
  projectId,
  budgetItems,
  expenses,
  summary,
  canManage,
  onRefresh,
  pending,
}: {
  projectId: string;
  budgetItems: ProjectBudgetItemRow[];
  expenses: ProjectExpenseRow[];
  summary: ProjectFinancialSummary;
  canManage: boolean;
  onRefresh: () => void;
  pending: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Total Anggaran" value={rupiah(summary.totalBudget)} />
        <SummaryCard label="Total Pengeluaran" value={rupiah(summary.totalExpenses)} />
        <SummaryCard label="Selisih" value={rupiah(summary.delta)} tone={summary.delta >= 0 ? "good" : "bad"} />
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <h3 className="text-base font-semibold">Budget vs Actuals</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2">Kategori</th>
                <th className="py-2">Budget</th>
                <th className="py-2">Actual</th>
                <th className="py-2">Delta</th>
              </tr>
            </thead>
            <tbody>
              {summary.byCategory.map((row) => (
                <tr key={row.kategori} className="border-t border-border/60">
                  <td className="py-2 font-medium">{row.kategori}</td>
                  <td className="py-2">{rupiah(row.budget)}</td>
                  <td className="py-2">{rupiah(row.actual)}</td>
                  <td className="py-2">
                    <Badge variant="outline" className={row.delta >= 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}>
                      {rupiah(row.delta)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {summary.byCategory.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Belum ada data budget atau expense.
            </p>
          ) : null}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <BudgetList projectId={projectId} rows={budgetItems} canManage={canManage} onRefresh={onRefresh} pending={pending} />
        <ExpenseList projectId={projectId} rows={expenses} canManage={canManage} onRefresh={onRefresh} pending={pending} />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : "text-foreground";
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function BudgetList({ projectId, rows, canManage, onRefresh, pending }: { projectId: string; rows: ProjectBudgetItemRow[]; canManage: boolean; onRefresh: () => void; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectBudgetItemRow | null>(null);
  const [form, setForm] = useState({ kategori: "", deskripsi: "", jumlahRencana: "" });
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setForm({ kategori: "", deskripsi: "", jumlahRencana: "" });
    setOpen(true);
  }

  function openEdit(row: ProjectBudgetItemRow) {
    setEditing(row);
    setForm({ kategori: row.kategori, deskripsi: row.deskripsi ?? "", jumlahRencana: String(row.jumlahRencana) });
    setOpen(true);
  }

  function submit() {
    startTransition(async () => {
      const payload = { ...form, jumlahRencana: Number(form.jumlahRencana || 0) };
      const result = editing ? await updateProjectBudgetItem(editing.id, payload) : await createProjectBudgetItem(projectId, payload);
      if (result.ok) {
        toast.success(editing ? "Budget diperbarui." : "Budget ditambahkan.");
        setOpen(false);
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove(row: ProjectBudgetItemRow) {
    if (!window.confirm(`Hapus budget "${row.kategori}"?`)) return;
    startTransition(async () => {
      const result = await deleteProjectBudgetItem(row.id);
      if (result.ok) {
        toast.success("Budget dihapus.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <section className="space-y-3 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Budget Planning</h3>
        {canManage ? <Button size="sm" onClick={openCreate} disabled={isPending || pending}><Plus className="h-4 w-4" />Tambah</Button> : null}
      </div>
      {rows.map((row) => (
        <div key={row.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3">
          <div>
            <p className="font-medium">{row.kategori}</p>
            <p className="text-sm text-muted-foreground">{row.deskripsi ?? "-"}</p>
            <p className="mt-1 text-sm font-semibold">{rupiah(row.jumlahRencana)}</p>
          </div>
          {canManage ? <RowActions onEdit={() => openEdit(row)} onDelete={() => remove(row)} /> : null}
        </div>
      ))}
      {rows.length === 0 ? <EmptyText text="Belum ada budget." /> : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Budget" : "Tambah Budget"}</DialogTitle></DialogHeader>
          <MoneyForm form={form} setForm={setForm} amountKey="jumlahRencana" amountLabel="Jumlah rencana" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Batal</Button>
            <Button onClick={submit} disabled={!form.kategori.trim() || isPending}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ExpenseList({ projectId, rows, canManage, onRefresh, pending }: { projectId: string; rows: ProjectExpenseRow[]; canManage: boolean; onRefresh: () => void; pending: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectExpenseRow | null>(null);
  const [form, setForm] = useState({ kategori: "", keterangan: "", jumlah: "", tanggal: today, buktiUrl: "" });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setForm({ kategori: "", keterangan: "", jumlah: "", tanggal: today, buktiUrl: "" });
    setProofFile(null);
    setOpen(true);
  }

  function openEdit(row: ProjectExpenseRow) {
    setEditing(row);
    setForm({ kategori: row.kategori, keterangan: row.keterangan ?? "", jumlah: String(row.jumlah), tanggal: row.tanggal, buktiUrl: row.buktiUrl ?? "" });
    setProofFile(null);
    setOpen(true);
  }

  function submit() {
    startTransition(async () => {
      let buktiUrl = form.buktiUrl;
      if (proofFile) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(proofFile);
        });
        const uploadResult = await uploadProjectFile(projectId, {
          fileName: proofFile.name,
          contentType: proofFile.type,
          dataUrl,
        });
        if (!uploadResult.ok) {
          toast.error(uploadResult.error);
          return;
        }
        buktiUrl = uploadResult.data?.fileUrl ?? buktiUrl;
      }

      const payload = { ...form, buktiUrl, jumlah: Number(form.jumlah || 0) };
      const result = editing ? await updateProjectExpense(editing.id, payload) : await createProjectExpense(projectId, payload);
      if (result.ok) {
        toast.success(editing ? "Expense diperbarui." : "Expense ditambahkan.");
        setOpen(false);
        setProofFile(null);
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove(row: ProjectExpenseRow) {
    if (!window.confirm(`Hapus expense "${row.kategori}"?`)) return;
    startTransition(async () => {
      const result = await deleteProjectExpense(row.id);
      if (result.ok) {
        toast.success("Expense dihapus.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <section className="space-y-3 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Expenses Aktual</h3>
        {canManage ? <Button size="sm" onClick={openCreate} disabled={isPending || pending}><Plus className="h-4 w-4" />Tambah</Button> : null}
      </div>
      {rows.map((row) => (
        <div key={row.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">{row.kategori}</p>
              <Badge variant="outline">{formatTanggal(row.tanggal)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{row.keterangan ?? "-"}</p>
            <p className="mt-1 text-sm font-semibold">{rupiah(row.jumlah)}</p>
            {row.buktiUrl ? (
              <a href={row.buktiUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Bukti <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
          {canManage ? <RowActions onEdit={() => openEdit(row)} onDelete={() => remove(row)} /> : null}
        </div>
      ))}
      {rows.length === 0 ? <EmptyText text="Belum ada expense." /> : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Expense" : "Tambah Expense"}</DialogTitle></DialogHeader>
          <MoneyForm form={form} setForm={setForm} amountKey="jumlah" amountLabel="Jumlah" showDate showProof />
          <div className="space-y-2">
            <Label>Upload Bukti</Label>
            <Input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              onChange={(event) => setProofFile(event.target.files?.[0] ?? null)}
            />
            {proofFile ? <p className="text-xs text-muted-foreground">{proofFile.name}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Batal</Button>
            <Button onClick={submit} disabled={!form.kategori.trim() || isPending}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function MoneyForm<T extends Record<string, string>>({
  form,
  setForm,
  amountKey,
  amountLabel,
  showDate,
  showProof,
}: {
  form: T;
  setForm: (form: T) => void;
  amountKey: keyof T;
  amountLabel: string;
  showDate?: boolean;
  showProof?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Kategori</Label>
        <Input value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>{amountLabel}</Label>
        <Input type="number" min={0} value={form[amountKey]} onChange={(e) => setForm({ ...form, [amountKey]: e.target.value })} />
      </div>
      {showDate ? (
        <div className="space-y-2">
          <Label>Tanggal</Label>
          <Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
        </div>
      ) : null}
      <div className="space-y-2">
        <Label>Deskripsi / Keterangan</Label>
        <Textarea value={form.deskripsi ?? form.keterangan ?? ""} onChange={(e) => setForm({ ...form, deskripsi: e.target.value, keterangan: e.target.value })} />
      </div>
      {showProof ? (
        <div className="space-y-2">
          <Label>URL Bukti</Label>
          <Input value={form.buktiUrl} onChange={(e) => setForm({ ...form, buktiUrl: e.target.value })} placeholder="https://..." />
        </div>
      ) : null}
    </div>
  );
}

function TimesheetPanel({
  projectId,
  timesheets,
  summary,
  canManage,
  canContribute,
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
  const canTouchOwn = canContribute;

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

  function remove(row: ProjectTimesheetRow) {
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
      {canTouchOwn ? (
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
            const canEditRow = canManage || row.userId === currentUserId;
            return (
              <div key={row.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{row.userName ?? "User"}</p>
                    {!row.endTime ? <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Aktif</Badge> : null}
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
                {canEditRow ? <RowActions onEdit={() => openEdit(row)} onDelete={() => remove(row)} /> : null}
              </div>
            );
          })}
          {timesheets.length === 0 ? <EmptyText text="Belum ada timesheet." /> : null}
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

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button variant="ghost" size="icon-sm" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onDelete}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}
