"use client";
import { useRef, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { Download, ExternalLink, FileUp, ImageIcon, Loader2, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteProjectFile,
  uploadProjectFile,
  type ProjectFileRow,
} from "@/server/actions/projects";
import { fileTypeIcon, fileSize } from "@/lib/project-display-utils";

export function FileSection({
  projectId,
  files,
  canUpload,
  onRefresh,
  pending,
}: {
  projectId: string;
  files: ProjectFileRow[];
  canUpload: boolean;
  onRefresh: () => void;
  pending: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function upload(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      startTransition(async () => {
        const result = await uploadProjectFile(projectId, {
          fileName: file.name,
          contentType: file.type,
          dataUrl: String(reader.result),
        });
        if (result.ok) {
          toast.success("File diupload.");
          if (fileInputRef.current) fileInputRef.current.value = "";
          onRefresh();
        } else {
          toast.error(result.error);
        }
      });
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(event: React.DragEvent) {
    event.preventDefault();
    setDragOver(false);
  }

  function remove(file: ProjectFileRow) {
    if (!window.confirm(`Hapus file "${file.fileName}"?`)) return;
    startTransition(async () => {
      const result = await deleteProjectFile(file.id);
      if (result.ok) {
        toast.success("File dihapus.");
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <section className="space-y-4 rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      {canUpload ? (
        <div
          className={`relative rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground/30"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Label className="flex cursor-pointer flex-col items-center gap-2 text-sm">
            {isPending || pending ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <FileUp className="h-5 w-5 text-muted-foreground" />
            )}
            <span className="font-medium text-foreground">
              {dragOver ? "Lepaskan file di sini" : "Klik atau seret file ke sini untuk upload"}
            </span>
            <span className="text-xs text-muted-foreground">PDF, Excel, Word, Gambar, ZIP — max 20 MB</span>
            <Input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(event) => upload(event.target.files?.[0] ?? null)}
            />
          </Label>
        </div>
      ) : null}

      {previewUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}

      <div className="space-y-2">
        {files.map((file) => {
          const Icon = fileTypeIcon(file.mimeType);
          const isImage = file.mimeType.startsWith("image/");
          return (
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-xl border border-border/60 p-3 transition-colors hover:bg-accent/30"
            >
              {isImage ? (
                <button
                  type="button"
                  className="shrink-0"
                  onClick={() => setPreviewUrl(file.fileUrl)}
                >
                  <img
                    src={file.fileUrl}
                    alt={file.fileName}
                    className="h-10 w-10 rounded-md border border-border object-cover"
                  />
                </button>
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {fileSize(file.fileSize)} &middot; {file.uploaderName ?? "User"} &middot;{" "}
                  {formatDistanceToNow(new Date(file.uploadedAt), { addSuffix: true, locale: id })}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button asChild variant="ghost" size="icon-sm">
                  <a href={file.fileUrl} target="_blank" rel="noreferrer">
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
                {canUpload ? (
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(file)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
        {files.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Belum ada file.
          </p>
        ) : null}
      </div>
    </section>
  );
}
