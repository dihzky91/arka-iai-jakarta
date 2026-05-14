"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { createLabel, deleteProjectLabel, type ProjectLabelRow } from "@/server/actions/projects";

const PRESET_COLORS = [
  "#EF4444", "#F97316", "#F59E0B", "#EAB308",
  "#84CC16", "#22C55E", "#10B981", "#14B8A6",
  "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1",
  "#8B5CF6", "#A855F7", "#D946EF", "#EC4899",
  "#F43F5E", "#6B7280", "#374151", "#1F2937",
];

const LABEL_GROUPS = [
  { value: "__none__", label: "Tanpa grup" },
  { value: "Program", label: "Program" },
  { value: "Priority", label: "Priority" },
  { value: "Tahun", label: "Tahun" },
  { value: "Divisi", label: "Divisi" },
  { value: "Kategori", label: "Kategori" },
];

export function LabelManager({
  labels,
  onRefresh,
}: {
  labels: ProjectLabelRow[];
  onRefresh: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6B7280");
  const [newGroup, setNewGroup] = useState("__none__");
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setNewName("");
    setNewColor("#6B7280");
    setNewGroup("__none__");
    setDialogOpen(true);
  }

  function submit() {
    if (!newName.trim()) {
      toast.error("Nama label wajib diisi.");
      return;
    }
    startTransition(async () => {
      const result = await createLabel(
        newName.trim(),
        newColor,
        newGroup === "__none__" ? null : newGroup,
      );
      if (result.ok) {
        toast.success("Label berhasil dibuat.");
        setDialogOpen(false);
        onRefresh();
      } else {
        toast.error("Gagal membuat label.");
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteProjectLabel(id);
      if (result.ok) {
        toast.success("Label berhasil dihapus.");
        onRefresh();
      } else {
        toast.error(result.error ?? "Gagal menghapus label.");
      }
    });
  }

  const grouped = labels.reduce<Record<string, ProjectLabelRow[]>>((acc, label) => {
    const key = label.group ?? "";
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(label);
    return acc;
  }, {} as Record<string, ProjectLabelRow[]>);

  const ungrouped = grouped[""] ?? [];
  const groups = Object.keys(grouped).filter((g) => g !== "");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Label Manager</h3>
        <Button type="button" size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Label Baru
        </Button>
      </div>

      {ungrouped.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {ungrouped.map((label) => (
            <LabelChip key={label.id} label={label} onRemove={remove} />
          ))}
        </div>
      ) : null}

      {groups.map((group) => (
        <div key={group} className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {group}
          </p>
          <div className="flex flex-wrap gap-2">
            {(grouped[group] ?? []).map((label) => (
              <LabelChip key={label.id} label={label} onRemove={remove} />
            ))}
          </div>
        </div>
      ))}

      {labels.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada label.</p>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Label Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nama label"
              />
            </div>
            <div className="space-y-2">
              <Label>Warna</Label>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-7 w-7 rounded-md border-2 transition-transform ${
                      newColor === color ? "scale-110 border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewColor(color)}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="h-8 w-12 cursor-pointer p-0"
                />
                <Input
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="w-28 font-mono text-sm"
                  maxLength={7}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Grup</Label>
              <Select value={newGroup} onValueChange={setNewGroup}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LABEL_GROUPS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button type="button" disabled={isPending || !newName.trim()} onClick={submit}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Buat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LabelChip({
  label,
  onRemove,
}: {
  label: ProjectLabelRow;
  onRemove: (id: string) => void;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
      style={{ borderColor: label.color, color: label.color }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: label.color }}
      />
      {label.name}
      <button
        type="button"
        className="ml-0.5 rounded-full p-0.5 text-current opacity-60 hover:opacity-100"
        onClick={() => {
          if (window.confirm(`Hapus label "${label.name}"?`)) onRemove(label.id);
        }}
      >
        <Trash2 className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}
