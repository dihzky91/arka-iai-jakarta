"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  createTemplate,
  updateTemplate,
} from "@/server/actions/penilaianKinerja";
import type { TemplateRow } from "@/server/actions/penilaianKinerja";

const formSchema = z.object({
  nama: z.string().min(1, "Nama template wajib diisi").max(200),
  tipe: z.enum(["tugas", "perilaku"]),
  jabatan: z.string().max(150).optional(),
  isDefault: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: TemplateRow;
  defaultTipe?: "tugas" | "perilaku";
}

export function TemplateFormDialog({
  open,
  onOpenChange,
  editData,
  defaultTipe = "tugas",
}: TemplateFormDialogProps) {
  const router = useRouter();
  const isEdit = !!editData;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nama: editData?.nama ?? "",
      tipe: editData?.tipe ?? defaultTipe,
      jabatan: editData?.jabatan ?? "",
      isDefault: editData?.isDefault ?? false,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        nama: editData?.nama ?? "",
        tipe: editData?.tipe ?? defaultTipe,
        jabatan: editData?.jabatan ?? "",
        isDefault: editData?.isDefault ?? false,
      });
    }
  }, [open, editData, defaultTipe, form]);

  async function onSubmit(values: FormValues) {
    try {
      if (isEdit) {
        await updateTemplate({ id: editData.id, ...values });
        toast.success("Template berhasil diperbarui");
      } else {
        await createTemplate(values);
        toast.success("Template berhasil dibuat");
      }
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error(isEdit ? "Gagal memperbarui template" : "Gagal membuat template");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Template" : "Buat Template Baru"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nama">Nama Template</Label>
            <Input
              id="nama"
              placeholder="Contoh: Staff Akuntansi & PPL"
              {...form.register("nama")}
            />
            {form.formState.errors.nama && (
              <p className="text-sm text-destructive">
                {form.formState.errors.nama.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipe">Tipe</Label>
            <Select
              value={form.watch("tipe")}
              onValueChange={(v) =>
                form.setValue("tipe", v as "tugas" | "perilaku")
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih tipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tugas">Pelaksanaan Tugas</SelectItem>
                <SelectItem value="perilaku">Perilaku</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jabatan">Jabatan (opsional)</Label>
            <Input
              id="jabatan"
              placeholder="Contoh: Staff Akuntansi, Pajak & PPL"
              {...form.register("jabatan")}
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="isDefault"
              checked={form.watch("isDefault")}
              onCheckedChange={(v: boolean) => form.setValue("isDefault", v)}
            />
            <Label htmlFor="isDefault">Jadikan template default</Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting
                ? "Menyimpan..."
                : isEdit
                  ? "Simpan"
                  : "Buat"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
