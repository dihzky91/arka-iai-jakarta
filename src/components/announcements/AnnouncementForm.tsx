"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { HtmlEditor } from "@/components/ui/html-editor";
import {
  createAnnouncement,
  uploadAnnouncementAttachment,
  updateAnnouncement,
  type AnnouncementManageRow,
} from "@/server/actions/announcements";

type RoleOption = "admin" | "staff" | "pejabat" | "viewer";

const ROLE_OPTIONS: Array<{ id: RoleOption; label: string }> = [
  { id: "admin", label: "Admin" },
  { id: "staff", label: "Staff" },
  { id: "pejabat", label: "Pejabat" },
  { id: "viewer", label: "Viewer" },
];

interface AnnouncementFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: AnnouncementManageRow | null;
  divisiOptions: Array<{ id: number; nama: string }>;
  onSuccess?: () => void;
}

type FormState = {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  all: boolean;
  roles: RoleOption[];
  divisiIds: number[];
  attachments: AnnouncementManageRow["attachments"];
  isPinned: boolean;
  requiresAck: boolean;
  status: "draft" | "published";
};

function getTodayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function AnnouncementForm({
  open,
  onOpenChange,
  mode,
  initialData,
  divisiOptions,
  onSuccess,
}: AnnouncementFormProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    startDate: getTodayIso(),
    endDate: getTodayIso(),
    all: true,
    roles: [],
    divisiIds: [],
    attachments: [],
    isPinned: false,
    requiresAck: false,
    status: "published",
  });

  useEffect(() => {
    if (!open) return;

    if (mode === "edit" && initialData) {
      setForm({
        title: initialData.title,
        description: initialData.description,
        startDate: initialData.startDate,
        endDate: initialData.endDate,
        all: initialData.audience.all,
        roles: initialData.audience.roles,
        divisiIds: initialData.audience.divisiIds,
        attachments: initialData.attachments ?? [],
        isPinned: initialData.isPinned,
        requiresAck: initialData.requiresAck,
        status: initialData.status,
      });
      setSelectedFiles([]);
      return;
    }

    setForm({
      title: "",
      description: "",
      startDate: getTodayIso(),
      endDate: getTodayIso(),
      all: true,
      roles: [],
      divisiIds: [],
      attachments: [],
      isPinned: false,
      requiresAck: false,
      status: "published",
    });
    setSelectedFiles([]);
  }, [open, mode, initialData]);

  const canSubmit = useMemo(() => {
    if (!form.title.trim() || !form.description.trim()) return false;
    if (!form.startDate || !form.endDate) return false;
    if (!form.all && form.roles.length === 0 && form.divisiIds.length === 0) {
      return false;
    }
    return true;
  }, [form]);

  function toggleRole(role: RoleOption, checked: boolean) {
    setForm((prev) => ({
      ...prev,
      roles: checked
        ? Array.from(new Set([...prev.roles, role]))
        : prev.roles.filter((item) => item !== role),
    }));
  }

  function toggleDivisi(divisiId: number, checked: boolean) {
    setForm((prev) => ({
      ...prev,
      divisiIds: checked
        ? Array.from(new Set([...prev.divisiIds, divisiId]))
        : prev.divisiIds.filter((item) => item !== divisiId),
    }));
  }

  function handleSubmit() {
    if (!canSubmit) return;
    startTransition(async () => {
      try {
        const mergedAttachments = [...form.attachments];

        for (const file of selectedFiles) {
          const dataUrl = await fileToDataUrl(file);
          const uploaded = await uploadAnnouncementAttachment({
            fileName: file.name,
            contentType: file.type || "application/octet-stream",
            dataUrl,
          });
          mergedAttachments.push(uploaded.data);
        }

        const payload = {
          title: form.title.trim(),
          description: form.description.trim(),
          startDate: form.startDate,
          endDate: form.endDate,
          audience: {
            all: form.all,
            roles: form.roles,
            divisiIds: form.divisiIds,
          },
          attachments: mergedAttachments,
          isPinned: form.isPinned,
          requiresAck: form.requiresAck,
          status: form.status,
        };

        const result =
          mode === "edit" && initialData
            ? await updateAnnouncement({ id: initialData.id, ...payload })
            : await createAnnouncement(payload);

        if (!result.ok) {
          toast.error("error" in result ? result.error : "Gagal menyimpan pengumuman.");
          return;
        }

        toast.success(
          mode === "edit"
            ? "Pengumuman berhasil diperbarui."
            : "Pengumuman berhasil dipublikasikan.",
        );
        onOpenChange(false);
        onSuccess?.();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Upload lampiran atau simpan pengumuman gagal.",
        );
      }
    });
  }

  function handlePickFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const picked = Array.from(fileList);

    setSelectedFiles((prev) => {
      const next = [...prev];
      for (const file of picked) {
        const exists = next.some(
          (current) =>
            current.name === file.name &&
            current.size === file.size &&
            current.lastModified === file.lastModified,
        );
        if (!exists) next.push(file);
      }
      return next;
    });
  }

  function removeAttachment(url: string) {
    setForm((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((item) => item.url !== url),
    }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {mode === "edit" ? "Ubah Pengumuman" : "Buat Pengumuman"}
          </DialogTitle>
          <DialogDescription>
            Publikasikan informasi internal untuk role atau divisi yang dituju.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="space-y-2">
            <Label htmlFor="announcement-title">Judul</Label>
            <Input
              id="announcement-title"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Contoh: Penyesuaian jadwal layanan internal"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Isi Pengumuman</Label>
            <HtmlEditor
              value={form.description}
              onChange={(next) =>
                setForm((prev) => ({ ...prev, description: next }))
              }
              placeholder="Tulis pengumuman di sini..."
            />
            <p className="text-xs text-muted-foreground">
              Gunakan toolbar untuk format cepat, atau aktifkan Mode HTML untuk
              menulis kode HTML langsung.
            </p>
          </div>

          <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/25 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">Lampiran</p>
              <span className="text-xs text-muted-foreground">
                {form.attachments.length + selectedFiles.length} file
              </span>
            </div>

            <Input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp"
              onChange={(event) => {
                handlePickFiles(event.target.files);
                event.currentTarget.value = "";
              }}
            />

            {selectedFiles.length > 0 ? (
              <div className="space-y-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${file.lastModified}-${file.size}`}
                    className="flex items-center justify-between rounded-lg border border-dashed border-border/60 bg-background px-3 py-2 text-sm transition-colors hover:bg-muted/30"
                  >
                    <span className="truncate text-foreground">{file.name}</span>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() =>
                        setSelectedFiles((prev) =>
                          prev.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}

            {form.attachments.length > 0 ? (
              <div className="space-y-2">
                {form.attachments.map((item) => (
                  <div
                    key={item.url}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-background px-3 py-2 text-sm transition-colors hover:bg-muted/30"
                  >
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-w-0 items-center gap-2 text-foreground hover:underline"
                    >
                      <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{item.fileName}</span>
                    </a>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => removeAttachment(item.url)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Paperclip}
                title="Belum ada lampiran"
                description="File yang dipilih akan otomatis di-upload saat tombol simpan ditekan."
                className="min-h-28 rounded-xl px-4 py-5"
              />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="announcement-start">Tanggal Mulai</Label>
              <Input
                id="announcement-start"
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, startDate: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="announcement-end">Tanggal Selesai</Label>
              <Input
                id="announcement-end"
                type="date"
                value={form.endDate}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, endDate: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/25 p-4">
            <p className="text-sm font-medium text-foreground">Target Audiens</p>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={form.all}
                onCheckedChange={(value) =>
                  setForm((prev) => ({ ...prev, all: value === true }))
                }
              />
              Semua pengguna internal
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              {ROLE_OPTIONS.map((role) => (
                <label
                  key={role.id}
                  className={`flex items-center gap-2 text-sm ${
                    form.all ? "text-muted-foreground" : "text-foreground"
                  }`}
                >
                  <Checkbox
                    checked={form.roles.includes(role.id)}
                    disabled={form.all}
                    onCheckedChange={(value) =>
                      toggleRole(role.id, value === true)
                    }
                  />
                  Role: {role.label}
                </label>
              ))}
            </div>

            {divisiOptions.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {divisiOptions.map((d) => (
                  <label
                    key={d.id}
                    className={`flex items-center gap-2 text-sm ${
                      form.all ? "text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    <Checkbox
                      checked={form.divisiIds.includes(d.id)}
                      disabled={form.all}
                      onCheckedChange={(value) =>
                        toggleDivisi(d.id, value === true)
                      }
                    />
                    Divisi: {d.nama}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>

          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-border/60 bg-muted/25 p-4">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={form.isPinned}
                onCheckedChange={(v) =>
                  setForm((prev) => ({ ...prev, isPinned: v === true }))
                }
              />
              Sematkan di atas inbox
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={form.requiresAck}
                onCheckedChange={(v) =>
                  setForm((prev) => ({ ...prev, requiresAck: v === true }))
                }
              />
              Wajib konfirmasi baca
            </label>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Button
                type="button"
                size="sm"
                variant={form.status === "draft" ? "outline" : "default"}
                className="h-8 rounded-lg px-3"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    status: prev.status === "draft" ? "published" : "draft",
                  }))
                }
              >
                {form.status === "draft" ? "Draft" : "Publikasi"}
              </Button>
            </div>
          </div>

        <DialogFooter className="shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isPending}>
            {isPending
              ? "Menyimpan..."
              : mode === "edit"
                ? "Simpan Perubahan"
                : form.status === "draft"
                  ? "Simpan Draft"
                  : "Publikasikan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Gagal membaca file."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Gagal membaca file."));
    reader.readAsDataURL(file);
  });
}
