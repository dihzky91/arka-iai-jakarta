"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { Building2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateSystemSettings,
  type SystemSettingsRow,
} from "@/server/actions/systemSettings";

interface Props {
  initial: SystemSettingsRow;
  isAdmin: boolean;
}

export function IdentitasSistemCard({ initial, isAdmin }: Props) {
  const [isPending, startTransition] = useTransition();
  const [logoPreview, setLogoPreview] = useState<string | null>(
    initial.logoUrl,
  );
  const [faviconPreview, setFaviconPreview] = useState<string | null>(
    initial.faviconUrl,
  );
  const [isDirty, setIsDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const markDirty = useCallback(() => setIsDirty(true), []);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateSystemSettings(formData);
      if (result.ok) {
        toast.success("Identitas sistem berhasil disimpan.");
        setIsDirty(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card className="rounded-[24px]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              Identitas Sistem
              {isDirty && (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  Belum disimpan
                </span>
              )}
            </CardTitle>
            <CardDescription>
              Nama, singkatan, logo, dan favicon yang tampil di seluruh
              aplikasi.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!isAdmin ? (
          <div className="rounded-2xl border border-border bg-muted/35 p-4 text-sm text-muted-foreground">
            Hanya admin yang dapat mengubah identitas sistem.
          </div>
        ) : (
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="namaSistem">Nama Sistem</Label>
                <Input
                  id="namaSistem"
                  name="namaSistem"
                  defaultValue={initial.namaSistem}
                  placeholder="contoh: ARKA"
                  maxLength={200}
                  required
                  onChange={markDirty}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="singkatan">
                  Singkatan{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (opsional)
                  </span>
                </Label>
                <Input
                  id="singkatan"
                  name="singkatan"
                  defaultValue={initial.singkatan ?? ""}
                  placeholder="contoh: ARKA"
                  maxLength={20}
                  onChange={markDirty}
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <FileUploadField
                label="Logo"
                name="logo"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                hint="PNG, JPG, WebP, atau SVG"
                preview={logoPreview}
                onPreviewChange={(url) => {
                  setLogoPreview(url);
                  markDirty();
                }}
              />
              <FileUploadField
                label="Favicon"
                name="favicon"
                accept="image/x-icon,image/png,image/svg+xml"
                hint="ICO, PNG, atau SVG"
                preview={faviconPreview}
                onPreviewChange={(url) => {
                  setFaviconPreview(url);
                  markDirty();
                }}
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isPending} variant={isDirty ? "default" : "outline"}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isDirty ? "Simpan Perubahan" : "Simpan"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function FileUploadField({
  label,
  name,
  accept,
  hint,
  preview,
  onPreviewChange,
}: {
  label: string;
  name: string;
  accept: string;
  hint: string;
  preview: string | null;
  onPreviewChange: (url: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/30">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={`${label} preview`}
              className="h-full w-full object-contain"
            />
          ) : (
            <Upload className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <Input
          type="file"
          name={name}
          accept={accept}
          className="w-full text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPreviewChange(URL.createObjectURL(file));
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
