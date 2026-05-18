"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, FileText, Plus } from "lucide-react";
import {
  createProjectFromTemplate,
  listProjectTemplates,
  type ProjectTemplateRow,
} from "@/server/actions/projects";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface ProjectTemplateListProps {
  initialTemplates: ProjectTemplateRow[];
}

export function ProjectTemplateList({ initialTemplates }: ProjectTemplateListProps) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [isPending, startTransition] = useTransition();
  const [createDialog, setCreateDialog] = useState<ProjectTemplateRow | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const router = useRouter();

  const refresh = () => {
    startTransition(async () => {
      const updated = await listProjectTemplates();
      setTemplates(updated);
    });
  };

  const handleCreate = async () => {
    if (!createDialog || !newTitle.trim()) return;
    startTransition(async () => {
      const result = await createProjectFromTemplate(createDialog.id, {
        title: newTitle.trim(),
      });
      if ("id" in result) {
        toast.success("Project berhasil dibuat dari template!");
        setCreateDialog(null);
        setNewTitle("");
        router.push(`/projects/${result.id}`);
      } else {
        toast.error("Gagal membuat project dari template.");
      }
    });
  };

  if (templates.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Belum ada template"
        description="Tandai project sebagai template dari halaman detail project untuk membuatnya muncul di sini."
      />
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id} className="group relative transition-shadow hover:shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold">{template.title}</h3>
                  <Badge variant="outline" className="mt-1.5 text-xs capitalize">
                    {template.type.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>
              {template.description && (
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                  {template.description?.replace(/<[^>]*>/g, "").slice(0, 120)}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {format(new Date(template.createdAt), "d MMM yyyy", { locale: localeId })}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCreateDialog(template);
                    setNewTitle(`${template.title} (Copy)`);
                  }}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Gunakan
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!createDialog} onOpenChange={(open) => !open && setCreateDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Project dari Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="project-title">Judul Project</Label>
              <Input
                id="project-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Masukkan judul project baru"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Template: <strong>{createDialog?.title}</strong> — Tasks, milestones, dan struktur akan di-copy.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(null)}>
              Batal
            </Button>
            <Button onClick={handleCreate} disabled={isPending || !newTitle.trim()}>
              <Plus className="mr-1.5 h-4 w-4" />
              Buat Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
