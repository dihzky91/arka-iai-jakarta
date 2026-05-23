"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  createSuratKeluar,
  updateSuratKeluar,
  uploadSuratKeluarDraft,
  uploadSuratKeluarLampiran,
} from "@/server/actions/suratKeluar";
import type { SuratKeluarRow, PejabatOption, DivisiOption } from "@/server/actions/suratKeluar";
import { optionalFileUrlSchema } from "@/lib/validators/fileUrl";
import { getTodayIsoInJakarta } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const JENIS_SURAT = [
  { value: "undangan", label: "Undangan" },
  { value: "pemberitahuan", label: "Pemberitahuan" },
  { value: "permohonan", label: "Permohonan" },
  { value: "keputusan", label: "Keputusan" },
  { value: "mou", label: "MOU" },
  { value: "balasan", label: "Balasan" },
  { value: "edaran", label: "Edaran" },
  { value: "keterangan", label: "Keterangan" },
  { value: "tugas", label: "Tugas" },
  { value: "lainnya", label: "Lainnya" },
] as const;

const JENIS_SURAT_VALUES = JENIS_SURAT.map((j) => j.value) as [
  string,
  ...string[],
];

// ─── Form schema (string IDs, transformed before submitting) ──────────────────

const formSchema = z.object({
  perihal: z.string().min(1, "Perihal wajib diisi"),
  tujuan: z.string().min(1, "Tujuan wajib diisi"),
  tujuanAlamat: z.string().optional(),
  tanggalSurat: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  jenisSurat: z.enum(JENIS_SURAT_VALUES as [string, ...string[]]),
  isiSingkat: z.string().optional(),
  prosesViaSimpeg: z.boolean().optional(),
  lampiranUrl: optionalFileUrlSchema,
  fileDraftUrl: optionalFileUrlSchema,
  pejabatId: z.string().optional(),
  divisiId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

interface SuratKeluarFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: SuratKeluarRow | null;
  pejabatList: PejabatOption[];
  divisiList: DivisiOption[];
}

function todayISO() {
  return getTodayIsoInJakarta();
}

export function SuratKeluarForm({
  open,
  onOpenChange,
  mode,
  initialData,
  pejabatList,
  divisiList,
}: SuratKeluarFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedLampiran, setSelectedLampiran] = useState<File | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      perihal: "",
      tujuan: "",
      tujuanAlamat: "",
      tanggalSurat: todayISO(),
      jenisSurat: "undangan",
      isiSingkat: "",
      prosesViaSimpeg: false,
      lampiranUrl: "",
      fileDraftUrl: "",
      pejabatId: "__none__",
      divisiId: "__none__",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initialData) {
      setSelectedFile(null);
      setSelectedLampiran(null);
      form.reset({
        perihal: initialData.perihal,
        tujuan: initialData.tujuan,
        tujuanAlamat: initialData.tujuanAlamat ?? "",
        tanggalSurat: initialData.tanggalSurat,
        jenisSurat: initialData.jenisSurat,
        isiSingkat: initialData.isiSingkat ?? "",
        prosesViaSimpeg: initialData.prosesViaSimpeg,
        lampiranUrl: initialData.lampiranUrl ?? "",
        fileDraftUrl: initialData.fileDraftUrl ?? "",
        pejabatId: initialData.pejabatId ? String(initialData.pejabatId) : "__none__",
        divisiId: initialData.divisiId ? String(initialData.divisiId) : "__none__",
      });
    } else {
      setSelectedFile(null);
      setSelectedLampiran(null);
      form.reset({
        perihal: "",
        tujuan: "",
        tujuanAlamat: "",
        tanggalSurat: todayISO(),
        jenisSurat: "undangan",
        isiSingkat: "",
        prosesViaSimpeg: false,
        lampiranUrl: "",
        fileDraftUrl: "",
        pejabatId: "__none__",
        divisiId: "__none__",
      });
    }
  }, [open, mode, initialData, form]);

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      try {
        let uploadedDraftUrl = values.fileDraftUrl || undefined;
        let uploadedLampiranUrl = values.lampiranUrl || undefined;

        if (selectedFile) {
          const dataUrl = await fileToDataUrl(selectedFile);
          const uploadResult = await uploadSuratKeluarDraft({
            fileName: selectedFile.name,
            contentType: selectedFile.type || "application/octet-stream",
            dataUrl,
          });

          if (!uploadResult.ok) {
            toast.error("Upload draft surat gagal.");
            return;
          }

          uploadedDraftUrl = uploadResult.data.url;
        }

        if (selectedLampiran) {
          const dataUrl = await fileToDataUrl(selectedLampiran);
          const uploadResult = await uploadSuratKeluarLampiran({
            fileName: selectedLampiran.name,
            contentType: selectedLampiran.type || "application/octet-stream",
            dataUrl,
          });

          if (!uploadResult.ok) {
            toast.error("Upload lampiran surat gagal.");
            return;
          }

          uploadedLampiranUrl = uploadResult.data.url;
        }

        const payload = {
          ...values,
          pejabatId:
            values.pejabatId && values.pejabatId !== "__none__"
              ? parseInt(values.pejabatId)
              : undefined,
          divisiId:
            values.divisiId && values.divisiId !== "__none__"
              ? parseInt(values.divisiId)
              : undefined,
          prosesViaSimpeg: Boolean(values.prosesViaSimpeg),
          tujuanAlamat: values.tujuanAlamat || undefined,
          isiSingkat: values.isiSingkat || undefined,
          lampiranUrl: uploadedLampiranUrl,
          fileDraftUrl: uploadedDraftUrl,
        };

        const res =
          mode === "edit" && initialData
            ? await updateSuratKeluar({ ...payload, id: initialData.id })
            : await createSuratKeluar(payload);

        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success(
          mode === "edit" ? "Surat keluar diperbarui." : "Surat keluar dibuat.",
        );
        router.refresh();
        onOpenChange(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Upload surat keluar gagal.",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Ubah Surat Keluar" : "Buat Surat Keluar"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Perbarui data surat. Hanya bisa diubah saat status Draft."
              : "Isi data surat keluar baru. Tanggal surat dapat diisi bebas (termasuk backdate)."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="surat-keluar-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            {/* Perihal */}
            <FormField
              control={form.control}
              name="perihal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Perihal</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="mis. Undangan Rapat Koordinasi"
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tujuan */}
            <FormField
              control={form.control}
              name="tujuan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tujuan</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="mis. Direktur Eksekutif IAI DKI Jakarta"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tujuan Alamat */}
            <FormField
              control={form.control}
              name="tujuanAlamat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Alamat Tujuan{" "}
                    <span className="text-muted-foreground font-normal">
                      (opsional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Alamat lengkap penerima surat..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tanggal Surat + Jenis Surat */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="tanggalSurat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal Surat</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="jenisSurat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jenis Surat</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih jenis" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {JENIS_SURAT.map((j) => (
                          <SelectItem key={j.value} value={j.value}>
                            {j.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Isi Singkat */}
            <FormField
              control={form.control}
              name="isiSingkat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Isi Singkat{" "}
                    <span className="text-muted-foreground font-normal">
                      (opsional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ringkasan isi surat..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="prosesViaSimpeg"
              render={({ field }) => (
                <FormItem className="flex items-start justify-between gap-4 rounded-lg border bg-muted/30 p-3">
                  <div className="space-y-1">
                    <FormLabel>Diproses di SIMPEG IAI</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Aktifkan jika review dan pengiriman resmi dilakukan di SIMPEG pusat.
                    </p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={Boolean(field.value)}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lampiranUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Lampiran{" "}
                    <span className="text-muted-foreground font-normal">
                      (opsional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      <Input
                        type="file"
                        accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
                        onChange={(event) =>
                          setSelectedLampiran(event.target.files?.[0] ?? null)
                        }
                      />
                      <Input
                        placeholder="Atau isi URL lampiran manual"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </div>
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Upload lampiran PDF, DOC, DOCX, atau gambar langsung, atau
                    isi URL manual bila file sudah ada di storage lain.
                  </p>
                  {selectedLampiran ? (
                    <p className="text-xs text-foreground">
                      Lampiran dipilih: {selectedLampiran.name}
                    </p>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fileDraftUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Draft Surat{" "}
                    <span className="text-muted-foreground font-normal">
                      (opsional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <div className="space-y-3">
                      <Input
                        type="file"
                        accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
                        onChange={(event) =>
                          setSelectedFile(event.target.files?.[0] ?? null)
                        }
                      />
                      <Input
                        placeholder="Atau isi URL draft manual"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </div>
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Upload draft PDF, DOC, DOCX, atau gambar langsung, atau isi
                    URL manual jika draft sudah ada di storage lain.
                  </p>
                  {selectedFile ? (
                    <p className="text-xs text-foreground">
                      File dipilih: {selectedFile.name}
                    </p>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Pejabat + Divisi */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="pejabatId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Pejabat{" "}
                      <span className="text-muted-foreground font-normal">
                        (opsional)
                      </span>
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih pejabat" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">— Tidak dipilih —</SelectItem>
                        {pejabatList.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.namaJabatan}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="divisiId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Divisi Pengirim{" "}
                      <span className="text-muted-foreground font-normal">
                        (opsional)
                      </span>
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih divisi" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">— Tidak dipilih —</SelectItem>
                        {divisiList.map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.nama}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button
            type="submit"
            form="surat-keluar-form"
            disabled={isPending}
          >
            {isPending
              ? "Menyimpan..."
              : mode === "edit"
                ? "Simpan Perubahan"
                : "Buat Surat"}
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
