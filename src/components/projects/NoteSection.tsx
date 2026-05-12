"use client";

import { useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  createProjectNote,
  updateProjectNote,
  deleteProjectNote,
  type ProjectNoteRow,
} from "@/server/actions/projects";

export function NoteSection({
  projectId,
  notes,
  canManage,
  onRefresh,
  pending,
}: {
  projectId: string;
  notes: ProjectNoteRow[];
  canManage: boolean;
  onRefresh: () => void;
  pending: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<ProjectNoteRow | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditingNote(null);
    setFormTitle("");
    setFormContent("");
    setDialogOpen(true);
  }

  function openEdit(note: ProjectNoteRow) {
    setEditingNote(note);
    setFormTitle(note.title);
    setFormContent(note.content ?? "");
    setDialogOpen(true);
  }

  function submit() {
    if (!formTitle.trim()) return;
    startTransition(async () => {
      const data = { title: formTitle.trim(), content: formContent || null };
      const result = editingNote
        ? await updateProjectNote(editingNote.id, data)
        : await createProjectNote(projectId, data);
      if (result.ok) {
        toast.success(editingNote ? "Catatan diperbarui." : "Catatan dibuat.");
        setDialogOpen(false);
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove(note: ProjectNoteRow) {
    if (!window.confirm(`Hapus catatan "${note.title}"?`)) return;
    startTransition(async () => {
      const result = await deleteProjectNote(note.id);
      if (result.ok) {
        toast.success("Catatan dihapus.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Catatan Internal</h2>
        {canManage ? (
          <Button size="sm" onClick={openCreate} disabled={isPending || pending}>
            <Plus className="mr-1 h-4 w-4" />
            Tambah Catatan
          </Button>
        ) : null}
      </div>

      {notes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Belum ada catatan internal.
        </p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-foreground">{note.title}</h3>
                  {note.content ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground line-clamp-3">
                      {note.content}
                    </p>
                  ) : null}
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{note.createdByName ?? "User"}</span>
                    <span>&middot;</span>
                    <span>
                      {formatDistanceToNow(new Date(note.createdAt), {
                        addSuffix: true,
                        locale: id,
                      })}
                    </span>
                    {note.updatedAt > note.createdAt ? (
                      <>
                        <span>&middot;</span>
                        <span>Diedit</span>
                      </>
                    ) : null}
                  </div>
                </div>
                {canManage ? (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(note)}
                      disabled={isPending || pending}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(note)}
                      disabled={isPending || pending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingNote ? "Edit Catatan" : "Catatan Baru"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Judul</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Judul catatan..."
              />
            </div>
            <div className="space-y-2">
              <Label>Isi Catatan</Label>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Tulis catatan internal..."
                className="min-h-30"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={!formTitle.trim() || isPending}
              onClick={submit}
            >
              {isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : null}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
