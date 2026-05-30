"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTemplate } from "@/server/actions/mail-templates/templates";
import type { EmailLayout } from "@/server/db/schema";

const formSchema = z.object({
  templateKey: z
    .string()
    .min(3, "Minimal 3 karakter")
    .max(100)
    .regex(/^[a-z][a-z0-9_]*$/, "Hanya huruf kecil, angka, dan underscore"),
  templateName: z.string().min(3, "Minimal 3 karakter").max(300),
  description: z.string().max(1000).optional(),
  category: z.enum([
    "persuratan",
    "akademik",
    "keuangan",
    "auth",
    "sistem",
    "ppl",
    "custom",
  ]),
  subject: z.string().min(3, "Minimal 3 karakter").max(500),
  layoutId: z.string().nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  layouts: EmailLayout[];
}

export function CreateTemplateForm({ layouts }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      templateKey: "",
      templateName: "",
      description: "",
      category: "custom",
      subject: "",
      layoutId: null,
    },
  });

  async function onSubmit(data: FormValues) {
    setIsSubmitting(true);
    try {
      const result = await createTemplate({
        ...data,
        description: data.description || undefined,
        bodyBlocks: [
          {
            id: crypto.randomUUID(),
            type: "paragraph",
            content: "Yth. {{recipient.nama}},",
          },
          {
            id: crypto.randomUUID(),
            type: "paragraph",
            content: "Isi konten email di sini.",
          },
          { id: crypto.randomUUID(), type: "signature" },
        ],
      });

      if (result) {
        toast.success("Template berhasil dibuat");
        router.push(`/pengaturan/mail-templates/${result.id}`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal membuat template",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto max-w-2xl space-y-6"
    >
      <div className="rounded-lg border bg-card p-6 space-y-5">
        {/* Template Key */}
        <div className="space-y-2">
          <Label htmlFor="templateKey">Template Key</Label>
          <Input
            id="templateKey"
            placeholder="contoh: jadwal_instruktur"
            {...register("templateKey")}
          />
          {errors.templateKey && (
            <p className="text-xs text-destructive">
              {errors.templateKey.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Identifier unik (huruf kecil, angka, underscore). Digunakan di kode
            untuk memanggil template.
          </p>
        </div>

        {/* Template Name */}
        <div className="space-y-2">
          <Label htmlFor="templateName">Nama Template</Label>
          <Input
            id="templateName"
            placeholder="contoh: Notifikasi Jadwal Instruktur"
            {...register("templateName")}
          />
          {errors.templateName && (
            <p className="text-xs text-destructive">
              {errors.templateName.message}
            </p>
          )}
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label>Kategori</Label>
          <Select
            value={watch("category")}
            onValueChange={(v) =>
              setValue("category", v as FormValues["category"])
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="persuratan">Persuratan</SelectItem>
              <SelectItem value="akademik">Akademik</SelectItem>
              <SelectItem value="keuangan">Keuangan</SelectItem>
              <SelectItem value="auth">Auth</SelectItem>
              <SelectItem value="sistem">Sistem</SelectItem>
              <SelectItem value="ppl">PPL</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Subject */}
        <div className="space-y-2">
          <Label htmlFor="subject">Subject Email</Label>
          <Input
            id="subject"
            placeholder='contoh: Jadwal Mengajar: {{jadwal.materi}} - {{jadwal.tanggal}}'
            {...register("subject")}
          />
          {errors.subject && (
            <p className="text-xs text-destructive">
              {errors.subject.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Mendukung variabel {'{{variable}}'}.
          </p>
        </div>

        {/* Layout */}
        <div className="space-y-2">
          <Label>Layout</Label>
          <Select
            value={watch("layoutId") ?? "none"}
            onValueChange={(v) =>
              setValue("layoutId", v === "none" ? null : v)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih layout" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Tanpa Layout (Default)</SelectItem>
              {layouts.map((layout) => (
                <SelectItem key={layout.id} value={layout.id}>
                  {layout.name}
                  {layout.isDefault ? " (Default)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Deskripsi (opsional)</Label>
          <Textarea
            id="description"
            placeholder="Deskripsi singkat tentang template ini..."
            rows={3}
            {...register("description")}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Batal
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Membuat..." : "Buat Template"}
        </Button>
      </div>
    </form>
  );
}
