"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Plus,
  ArrowLeft,
  Star,
  Trash2,
  Pencil,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createLayout,
  updateLayout,
  deleteLayout,
} from "@/server/actions/mail-templates/layouts";
import type { EmailLayout } from "@/server/db/schema";

interface Props {
  initialLayouts: EmailLayout[];
}

export function LayoutListPage({ initialLayouts }: Props) {
  const router = useRouter();
  const [layouts, setLayouts] = useState(initialLayouts);
  const [editingLayout, setEditingLayout] = useState<EmailLayout | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    try {
      await deleteLayout(id);
      setLayouts((prev) => prev.filter((l) => l.id !== id));
      toast.success("Layout dihapus");
    } catch {
      toast.error("Gagal menghapus layout");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/pengaturan/mail-templates">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Kembali
          </Link>
        </Button>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Layout Baru
        </Button>
      </div>

      {/* Layout List */}
      <div className="space-y-2">
        {layouts.map((layout) => (
          <div
            key={layout.id}
            className="rounded-xl border border-border/60 bg-card shadow-sm p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">{layout.name}</h3>
                  {layout.isDefault && (
                    <Badge variant="default" className="text-[10px]">
                      <Star className="mr-0.5 h-2.5 w-2.5" />
                      Default
                    </Badge>
                  )}
                </div>
                {layout.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {layout.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() =>
                    setPreviewId(previewId === layout.id ? null : layout.id)
                  }
                >
                  {previewId === layout.id ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setEditingLayout(layout)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => handleDelete(layout.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Preview */}
            {previewId === layout.id && (
              <div className="mt-3 rounded border bg-white overflow-auto max-h-[300px]">
                <div className="text-xs">
                  {layout.headerHtml && (
                    <div className="border-b p-2">
                      <p className="text-[10px] text-muted-foreground mb-1 font-medium">HEADER:</p>
                      <div dangerouslySetInnerHTML={{ __html: layout.headerHtml }} />
                    </div>
                  )}
                  <div className="p-3 text-center text-muted-foreground italic">
                    — konten template —
                  </div>
                  {layout.footerHtml && (
                    <div className="border-t p-2">
                      <p className="text-[10px] text-muted-foreground mb-1 font-medium">FOOTER:</p>
                      <div dangerouslySetInnerHTML={{ __html: layout.footerHtml }} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Dialog */}
      {showCreate && (
        <LayoutFormDialog
          onClose={() => setShowCreate(false)}
          onSaved={(layout) => {
            setLayouts((prev) => [...prev, layout]);
            setShowCreate(false);
          }}
        />
      )}

      {/* Edit Dialog */}
      {editingLayout && (
        <LayoutFormDialog
          layout={editingLayout}
          onClose={() => setEditingLayout(null)}
          onSaved={(updated) => {
            setLayouts((prev) =>
              prev.map((l) => (l.id === updated.id ? updated : l)),
            );
            setEditingLayout(null);
          }}
        />
      )}
    </div>
  );
}

// ─── LAYOUT FORM DIALOG ───────────────────────────────────────────────────────

function LayoutFormDialog({
  layout,
  onClose,
  onSaved,
}: {
  layout?: EmailLayout;
  onClose: () => void;
  onSaved: (layout: EmailLayout) => void;
}) {
  const [name, setName] = useState(layout?.name ?? "");
  const [description, setDescription] = useState(layout?.description ?? "");
  const [headerHtml, setHeaderHtml] = useState(layout?.headerHtml ?? "");
  const [footerHtml, setFooterHtml] = useState(layout?.footerHtml ?? "");
  const [isDefault, setIsDefault] = useState(layout?.isDefault ?? false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Nama layout wajib diisi");
      return;
    }
    setIsSaving(true);
    try {
      if (layout) {
        const result = await updateLayout(layout.id, {
          name,
          description: description || undefined,
          headerHtml: headerHtml || undefined,
          footerHtml: footerHtml || undefined,
          isDefault,
        });
        if (result) {
          toast.success("Layout diperbarui");
          onSaved(result);
        }
      } else {
        const result = await createLayout({
          name,
          description: description || undefined,
          headerHtml: headerHtml || undefined,
          footerHtml: footerHtml || undefined,
          isDefault,
        });
        if (result) {
          toast.success("Layout dibuat");
          onSaved(result);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {layout ? "Edit Layout" : "Buat Layout Baru"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nama</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama layout"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Deskripsi</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Deskripsi singkat"
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Header HTML</Label>
            <Textarea
              value={headerHtml}
              onChange={(e) => setHeaderHtml(e.target.value)}
              placeholder="<tr><td>...header...</td></tr>"
              rows={5}
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Gunakan {'{{app.name}}'}, {'{{app.logo_url}}'}, dll. Wrapper &lt;table&gt; sudah disediakan.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Footer HTML</Label>
            <Textarea
              value={footerHtml}
              onChange={(e) => setFooterHtml(e.target.value)}
              placeholder="<tr><td>...footer...</td></tr>"
              rows={5}
              className="font-mono text-xs"
            />
          </div>

          <label className="flex items-center gap-2">
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            <span className="text-xs">Jadikan default layout</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
