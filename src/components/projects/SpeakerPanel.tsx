"use client";
import { useState, useTransition } from "react";
import { Loader2, MoreHorizontal, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createProjectSpeaker,
  deleteProjectSpeaker,
  updateProjectSpeaker,
  type ProjectMemberRow,
  type ProjectSpeakerRow,
} from "@/server/actions/projects";
import { RowActions } from "./shared-ui";
import { EmptyText } from "./shared-ui";
import { minutesLabel } from "@/lib/project-display-utils";

export function SpeakerPanel({
  projectId,
  members,
  speakers,
  canManage: canManageProp,
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

  function removeSpeaker(row: ProjectSpeakerRow) {
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
        {canManageProp ? (
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
              {canManageProp ? (
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(speaker)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => removeSpeaker(speaker)}>
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
