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
import {
  createSuratMasuk,
  uploadSuratMasukFile,
  updateSuratMasuk,
  type SuratMasukRow,
} from "@/server/actions/suratMasuk";
import { optionalFileUrlSchema } from "@/lib/validators/fileUrl";
import { getTodayIsoInJakarta } from "@/lib/utils";

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

const JENIS_SURAT_VALUES = JENIS_SURAT.map((item) => item.value) as [
  string,
  ...string[],
];

const formSchema = z.object({
  nomorAgenda: z.string().optional(),
  nomorSuratAsal: z.string().optional(),
  perihal: z.string().min(1, "Perihal wajib diisi"),
  pengirim: z.string().min(1, "Pengirim wajib diisi"),
  pengirimAlamat: z.string().optional(),
  tanggalSurat: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  tanggalDiterima: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  jenisSurat: z.enum(JENIS_SURAT_VALUES),
  isiSingkat: z.string().optional(),
  fileUrl: optionalFileUrlSchema,
});

type FormValues = z.infer<typeof formSchema>;

function todayISO() {
  return getTodayIsoInJakarta();
}

interface SuratMasukFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: SuratMasukRow | null;
  onSuccess?: (row: SuratMasukRow) => void;
}

export function SuratMasukForm({
  open,
  onOpenChange,
  mode,
  initialData,
  onSuccess,
}: SuratMasukFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nomorAgenda: "",
      nomorSuratAsal: "",
      perihal: "",
      pengirim: "",
      pengirimAlamat: "",
      tanggalSurat: todayISO(),
      tanggalDiterima: todayISO(),
      jenisSurat: "undangan",
      isiSingkat: "",
      fileUrl: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initialData) {
      setSelectedFile(null);
      form.reset({
        nomorAgenda: initialData.nomorAgenda ?? "",
        nomorSuratAsal: initialData.nomorSuratAsal ?? "",
        perihal: initialData.perihal,
        pengirim: initialData.pengirim,
        pengirimAlamat: initialData.pengirimAlamat ?? "",
        tanggalSurat: initialData.tanggalSurat,
        tanggalDiterima: initialData.tanggalDiterima,
        jenisSurat: initialData.jenisSurat as FormValues["jenisSurat"],
        isiSingkat: initialData.isiSingkat ?? "",
        fileUrl: initialData.fileUrl ?? "",
      });
      return;
    }

    form.reset({
      nomorAgenda: "",
      nomorSuratAsal: "",
      perihal: "",
      pengirim: "",
      pengirimAlamat: "",
      tanggalSurat: todayISO(),
      tanggalDiterima: todayISO(),
      jenisSurat: "undangan",
      isiSingkat: "",
      fileUrl: "",
    });
    setSelectedFile(null);
  }, [form, initialData, mode, open]);

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      try {
        let uploadedFileUrl = values.fileUrl || undefined;

        if (selectedFile) {
          const dataUrl = await fileToDataUrl(selectedFile);
          const uploadResult = await uploadSuratMasukFile({
            fileName: selectedFile.name,
            contentType: selectedFile.type || "application/octet-stream",
            dataUrl,
          });

          if (!uploadResult.ok) {
            toast.error("Upload file surat masuk gagal.");
            return;
          }

          uploadedFileUrl = uploadResult.data.url;
        }

        const payload = {
          ...values,
          nomorAgenda: values.nomorAgenda || undefined,
          nomorSuratAsal: values.nomorSuratAsal || undefined,
          pengirimAlamat: values.pengirimAlamat || undefined,
          isiSingkat: values.isiSingkat || undefined,
          fileUrl: uploadedFileUrl,
        };

        const result =
          mode === "edit" && initialData
            ? await updateSuratMasuk({ ...payload, id: initialData.id })
            : await createSuratMasuk(payload);

        if (!result.ok) {
          toast.error(result.error);
          return;
        }

        toast.success(
          mode === "edit" ? "Surat masuk berhasil diperbarui." : "Surat masuk berhasil dibuat.",
        );
        onSuccess?.(
          mode === "edit" && initialData
            ? { ...initialData, ...result.data }
            : (result.data as SuratMasukRow),
        );
        router.refresh();
        onOpenChange(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Upload file surat masuk gagal.",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Ubah Surat Masuk" : "Input Surat Masuk"}
          </DialogTitle>
          <DialogDescription>
            Tanggal surat dan tanggal diterima diisi manual sesuai arsip fisik
            atau dokumen sumber.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="surat-masuk-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="nomorAgenda"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nomor Agenda</FormLabel>
                    <FormControl>
                      <Input placeholder="opsional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nomorSuratAsal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nomor Surat Asal</FormLabel>
                    <FormControl>
                      <Input placeholder="opsional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="perihal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Perihal</FormLabel>
                  <FormControl>
                    <Input autoFocus placeholder="Perihal surat masuk" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pengirim"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pengirim</FormLabel>
                  <FormControl>
                    <Input placeholder="Nama instansi / pengirim" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pengirimAlamat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alamat Pengirim</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Alamat pengirim jika tersedia"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-3">
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
                name="tanggalDiterima"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal Diterima</FormLabel>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih jenis" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {JENIS_SURAT.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isiSingkat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Isi Singkat</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Ringkasan isi surat"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fileUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>File Surat</FormLabel>
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
                        {...field}
                        placeholder="Atau isi URL file manual"
                        value={field.value ?? ""}
                      />
                    </div>
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Upload file PDF, DOC, DOCX, atau gambar langsung, atau isi
                    URL manual jika file sudah ada di storage lain.
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
          <Button type="submit" form="surat-masuk-form" disabled={isPending}>
            {isPending
              ? "Menyimpan..."
              : mode === "edit"
                ? "Simpan Perubahan"
                : "Simpan Surat"}
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
