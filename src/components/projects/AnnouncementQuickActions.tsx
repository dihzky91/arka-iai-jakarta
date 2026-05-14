"use client";

import { useState, useTransition } from "react";
import { Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createAnnouncementFromProject } from "@/server/actions/projects";

type DialogMode = "open_registration" | "training_completed" | null;

export function AnnouncementQuickActions({
  projectId,
  canManage,
  onComplete,
}: {
  projectId: string;
  canManage: boolean;
  onComplete: () => void;
}) {
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!canManage) return null;

  function submit() {
    if (!dialogMode) return;
    startTransition(async () => {
      const result = await createAnnouncementFromProject(
        projectId,
        dialogMode,
        notes || undefined,
      );
      if (result.ok) {
        toast.success("Pengumuman berhasil dibuat dan dipublikasikan.");
        setDialogMode(null);
        setNotes("");
        onComplete();
      } else {
        toast.error(result.error ?? "Gagal membuat pengumuman.");
      }
    });
  }

  return (
    <>
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-300">
            <Megaphone className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold">Pengumuman Cepat</h3>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-start text-xs"
            onClick={() => setDialogMode("open_registration")}
            disabled={isPending}
          >
            <Megaphone className="h-3.5 w-3.5" />
            Umumkan Buka Pendaftaran
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-start text-xs"
            onClick={() => setDialogMode("training_completed")}
            disabled={isPending}
          >
            <Megaphone className="h-3.5 w-3.5" />
            Umumkan Pelatihan Selesai
          </Button>
        </div>
      </div>

      <Dialog
        open={dialogMode !== null}
        onOpenChange={(open) => {
          if (!open) setDialogMode(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "open_registration"
                ? "Umumkan Buka Pendaftaran"
                : "Umumkan Pelatihan Selesai"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pengumuman akan dibuat dengan data project dan dipublikasikan
              langsung ke semua pengguna.
            </p>
            <div className="space-y-2">
              <Label>Catatan tambahan (opsional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Tambahkan informasi tambahan..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogMode(null)}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button onClick={submit} disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Buat & Publikasikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
