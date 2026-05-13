"use client";

import { CheckCircle2, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  createTemplate,
  deleteTemplate,
  setDefaultTemplate,
  type TemplateRow,
} from "@/server/actions/sertifikat/templates";
import { EmptyState } from "@/components/ui/empty-state";
import { TemplateEditor } from "./TemplateEditor";

const categories = ["Workshop", "Brevet AB", "Brevet C", "BFA", "Lainnya"] as const;

export function TemplateManager({ templates }: { templates: TemplateRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof categories)[number] | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editorTemplate, setEditorTemplate] = useState<TemplateRow | null>(null);
  const [nama, setNama] = useState("");
  const [kategori, setKategori] = useState<(typeof categories)[number]>("Workshop");
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  const visibleTemplates = useMemo(
    () => templates.filter((template) => template.isActive && (filter === "all" || template.kategori === filter)),
    [filter, templates],
  );

  function resetDialog() {
    setNama("");
    setKategori("Workshop");
    setFile(null);
  }

  function submitCreate() {
    if (!file) {
      toast.error("Gambar template wajib diunggah.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append("image", file);
      const result = await createTemplate({ nama, kategori, formData });
      if (result.ok) {
        toast.success("Template berhasil ditambahkan.");
        setDialogOpen(false);
        resetDialog();
        setEditorTemplate(result.data);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function removeTemplate(template: TemplateRow) {
    if (!window.confirm(`Hapus template "${template.nama}"?`)) return;
    startTransition(async () => {
      const result = await deleteTemplate(template.id);
      if (result.ok) {
        toast.success("Template berhasil dihapus.");
        if (editorTemplate?.id === template.id) setEditorTemplate(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function markDefault(template: TemplateRow) {
    startTransition(async () => {
      const result = await setDefaultTemplate(template.id);
      if (result.ok) {
        toast.success("Default template berhasil diperbarui.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
          <SelectTrigger className="w-full md:w-64">
            <SelectValue placeholder="Filter kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Tambah Template
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleTemplates.map((template) => (
          <Card key={template.id} className="rounded-xl transition-all hover:border-primary/20 hover:shadow-md">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{template.nama}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {template.imageWidth} x {template.imageHeight} px
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant="secondary">{template.kategori}</Badge>
                  {template.isDefault ? (
                    <Badge className="bg-green-600 text-white">Default</Badge>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="aspect-[10/7] overflow-hidden rounded-md border border-border/60 bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={template.imageUrl} alt={template.nama} className="h-full w-full object-contain" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditorTemplate(template)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={Boolean(template.isDefault) || isPending}
                  onClick={() => markDefault(template)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Set Default
                </Button>
                <Button type="button" variant="destructive" size="sm" onClick={() => removeTemplate(template)}>
                  <Trash2 className="h-4 w-4" />
                  Hapus
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {visibleTemplates.length === 0 ? (
        <EmptyState
          icon={ImagePlus}
          title="Belum ada template sertifikat"
          description={
            filter === "all"
              ? "Tambahkan template gambar untuk mulai mengatur layout sertifikat."
              : "Tidak ada template aktif pada kategori ini."
          }
          action={
            <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Tambah Template
            </Button>
          }
        />
      ) : null}

      {editorTemplate ? (
        <div className="space-y-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Editor Template</h2>
              <p className="text-sm text-muted-foreground">{editorTemplate.nama}</p>
            </div>
            <Button type="button" variant="outline" onClick={() => setEditorTemplate(null)}>
              Tutup
            </Button>
          </div>
          <TemplateEditor template={editorTemplate} />
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Template</DialogTitle>
            <DialogDescription>
              Unggah gambar PNG/JPG maksimal 2 MB dengan dimensi 1000 sampai 3000 piksel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Template</Label>
              <Input value={nama} onChange={(event) => setNama(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={kategori} onValueChange={(value) => setKategori(value as typeof kategori)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Gambar Template</Label>
              <Input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button type="button" onClick={submitCreate} disabled={isPending || !nama.trim() || !file}>
              Simpan dan Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
