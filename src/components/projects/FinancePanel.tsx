"use client";
import { useState, useTransition } from "react";
import { ExternalLink, MoreHorizontal, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatTanggal } from "@/lib/utils";
import {
  createProjectBudgetItem,
  createProjectExpense,
  deleteProjectBudgetItem,
  deleteProjectExpense,
  updateProjectBudgetItem,
  updateProjectExpense,
  uploadProjectFile,
  type ProjectBudgetItemRow,
  type ProjectExpenseRow,
  type ProjectFinancialSummary,
} from "@/server/actions/projects";
import { rupiah } from "@/lib/project-display-utils";
import { RowActions, EmptyText } from "./shared-ui";

export function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : "text-foreground";
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function BudgetList({ projectId, rows, canManage: canManageProp, onRefresh, pending }: { projectId: string; rows: ProjectBudgetItemRow[]; canManage: boolean; onRefresh: () => void; pending: boolean }) {
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

  function removeBudget(row: ProjectBudgetItemRow) {
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
        {canManageProp ? <Button size="sm" onClick={openCreate} disabled={isPending || pending}><Plus className="h-4 w-4" />Tambah</Button> : null}
      </div>
      {rows.map((row) => (
        <div key={row.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3">
          <div>
            <p className="font-medium">{row.kategori}</p>
            <p className="text-sm text-muted-foreground">{row.deskripsi ?? "-"}</p>
            <p className="mt-1 text-sm font-semibold">{rupiah(row.jumlahRencana)}</p>
          </div>
          {canManageProp ? <RowActions onEdit={() => openEdit(row)} onDelete={() => removeBudget(row)} /> : null}
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

function ExpenseList({ projectId, rows, canManage: canManageProp, onRefresh, pending }: { projectId: string; rows: ProjectExpenseRow[]; canManage: boolean; onRefresh: () => void; pending: boolean }) {
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

  function removeExpense(row: ProjectExpenseRow) {
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
        {canManageProp ? <Button size="sm" onClick={openCreate} disabled={isPending || pending}><Plus className="h-4 w-4" />Tambah</Button> : null}
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
          {canManageProp ? <RowActions onEdit={() => openEdit(row)} onDelete={() => removeExpense(row)} /> : null}
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

export function ExpensePanel({
  projectId,
  budgetItems,
  expenses,
  summary,
  canManage: canManageProp,
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
          <table className="w-full min-w-140 text-sm">
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
        <BudgetList projectId={projectId} rows={budgetItems} canManage={canManageProp} onRefresh={onRefresh} pending={pending} />
        <ExpenseList projectId={projectId} rows={expenses} canManage={canManageProp} onRefresh={onRefresh} pending={pending} />
      </div>
    </div>
  );
}
