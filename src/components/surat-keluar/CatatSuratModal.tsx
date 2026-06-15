"use client";

import { useEffect, useState, useTransition } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Copy, Check, ClipboardList, Hash } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  catatSuratCepat,
  catatSuratManual,
  getNextCounter,
  getSaranKodeSurat,
} from "@/server/actions/suratKeluar";
import { formatBulanRomawi } from "@/lib/utils";

// ─── Schema ───────────────────────────────────────────────────────────────────

const formSchema = z
  .object({
    perihal: z.string().min(1, "Perihal wajib diisi"),
    tujuan: z.string().min(1, "Tujuan wajib diisi"),
    tujuanAlamat: z.string().optional(),
    tanggalSurat: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
    kodeSurat: z.string().max(20).optional(),
    isiSingkat: z.string().optional(),
    isManual: z.boolean(),
    nomorManual: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.isManual) {
      if (!data.nomorManual?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Nomor surat wajib diisi untuk mode manual.",
          path: ["nomorManual"],
        });
      }
    } else {
      if (!data.kodeSurat?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Kode surat wajib diisi.",
          path: ["kodeSurat"],
        });
      }
    }
  });

type FormValues = z.infer<typeof formSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

interface CatatSuratModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CatatSuratModal({ open, onOpenChange }: CatatSuratModalProps) {
  const [isPending, startTransition] = useTransition();
  const [successNomor, setSuccessNomor] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [nextCounter, setNextCounter] = useState<number | null>(null);
  const [prefixOrganisasi, setPrefixOrganisasi] = useState("IAI-DKIJKT");
  const [saranKode, setSaranKode] = useState<
    { kode: string; keterangan: string | null }[]
  >([]);

  const today = new Date().toISOString().split("T")[0]!;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      perihal: "",
      tujuan: "",
      tujuanAlamat: "",
      tanggalSurat: today,
      kodeSurat: "",
      isiSingkat: "",
      isManual: false,
      nomorManual: "",
    },
  });

  const isManual = form.watch("isManual");
  const kodeSurat = form.watch("kodeSurat");
  const tanggalSurat = form.watch("tanggalSurat");

  // Fetch suggestions and next counter on open
  useEffect(() => {
    if (!open) return;
    setSuccessNomor(null);
    setCopied(false);
    form.reset({
      perihal: "",
      tujuan: "",
      tujuanAlamat: "",
      tanggalSurat: today,
      kodeSurat: "",
      isiSingkat: "",
      isManual: false,
      nomorManual: "",
    });

    void getSaranKodeSurat().then((rows) => setSaranKode(rows));
    void getNextCounter(today).then((res) => {
      setNextCounter(res.nextCounter);
      setPrefixOrganisasi(res.prefixOrganisasi);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Refresh counter preview when date changes
  useEffect(() => {
    if (!open || !tanggalSurat || !/^\d{4}-\d{2}-\d{2}$/.test(tanggalSurat))
      return;
    void getNextCounter(tanggalSurat).then((res) => {
      setNextCounter(res.nextCounter);
      setPrefixOrganisasi(res.prefixOrganisasi);
    });
  }, [tanggalSurat, open]);

  // Preview nomor surat
  const previewNomor = (() => {
    if (isManual || !tanggalSurat || !nextCounter) return null;
    const [yearStr, monthStr] = tanggalSurat.split("-");
    const bulan = parseInt(monthStr ?? "1", 10);
    const tahun = parseInt(yearStr ?? "2026", 10);
    const bulanRomawi = formatBulanRomawi(bulan);
    const counterStr = String(nextCounter).padStart(2, "0");

    if (kodeSurat?.trim()) {
      return `${counterStr}/${kodeSurat.trim()}/${prefixOrganisasi}/${bulanRomawi}/${tahun}`;
    }
    return `${counterStr}/___/${prefixOrganisasi}/${bulanRomawi}/${tahun}`;
  })();

  function handleCopy() {
    if (!successNomor) return;
    void navigator.clipboard.writeText(successNomor);
    setCopied(true);
    toast.success("Nomor surat disalin ke clipboard.");
    setTimeout(() => setCopied(false), 2000);
  }

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      try {
        if (values.isManual) {
          const result = await catatSuratManual({
            perihal: values.perihal,
            tujuan: values.tujuan,
            tujuanAlamat: values.tujuanAlamat,
            tanggalSurat: values.tanggalSurat,
            nomorSurat: values.nomorManual!,
            isiSingkat: values.isiSingkat,
          });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          setSuccessNomor(result.nomorSurat);
        } else {
          const result = await catatSuratCepat({
            perihal: values.perihal,
            tujuan: values.tujuan,
            tujuanAlamat: values.tujuanAlamat,
            tanggalSurat: values.tanggalSurat,
            kodeSurat: values.kodeSurat!,
            isiSingkat: values.isiSingkat,
          });
          if (!result.ok) {
            toast.error("Gagal mencatat surat.");
            return;
          }
          setSuccessNomor(result.nomorSurat);
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Terjadi kesalahan.",
        );
      }
    });
  }

  // ─── Success State ────────────────────────────────────────────────────────
  if (successNomor) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Surat Berhasil Dicatat
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <p className="text-xs text-muted-foreground">Nomor Surat</p>
              <p className="mt-1 font-mono text-lg font-semibold text-primary">
                {successNomor}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCopy}
                variant="outline"
                className="flex-1"
              >
                {copied ? (
                  <Check className="mr-1.5 h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="mr-1.5 h-4 w-4" />
                )}
                {copied ? "Tersalin!" : "Copy Nomor"}
              </Button>
              <Button
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Tutup
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ─── Form State ───────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Catat Surat Keluar
          </DialogTitle>
          <DialogDescription>
            Pencatatan cepat seperti logbook manual. Isi data minimal, langsung
            dapat nomor surat.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 pt-2"
          >
            <FormField
              control={form.control}
              name="perihal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Perihal *</FormLabel>
                  <FormControl>
                    <Input placeholder="Mis. Surat Penawaran PPL" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tujuan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tujuan *</FormLabel>
                  <FormControl>
                    <Input placeholder="Mis. PTPN V" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tujuanAlamat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alamat Tujuan</FormLabel>
                  <FormControl>
                    <Input placeholder="Opsional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tanggalSurat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal Surat *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Nomor Surat Section */}
            <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Nomor Surat</p>
              </div>

              <FormField
                control={form.control}
                name="isManual"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="text-xs text-muted-foreground font-normal cursor-pointer">
                      Input nomor manual penuh (untuk backdate/koreksi)
                    </FormLabel>
                  </FormItem>
                )}
              />

              {isManual ? (
                <FormField
                  control={form.control}
                  name="nomorManual"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nomor Surat Lengkap</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Mis. 03/DE/IAI-DKIJKT/V/2026"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <>
                  <FormField
                    control={form.control}
                    name="kodeSurat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kode Surat *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Mis. DE, K, PPL-B12"
                            {...field}
                            className="font-mono uppercase"
                            onChange={(e) =>
                              field.onChange(e.target.value.toUpperCase())
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Saran Kode Chips */}
                  {saranKode.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {saranKode.map((item) => (
                        <button
                          key={item.kode}
                          type="button"
                          onClick={() =>
                            form.setValue("kodeSurat", item.kode, {
                              shouldValidate: true,
                            })
                          }
                          className="inline-flex items-center rounded-full border bg-background px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
                          title={item.keterangan ?? item.kode}
                        >
                          {item.kode}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {/* Preview */}
                  {previewNomor ? (
                    <div className="rounded-md border bg-background px-3 py-2">
                      <p className="text-xs text-muted-foreground">Preview nomor:</p>
                      <p className="font-mono text-sm font-medium text-primary">
                        {previewNomor}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        * Nomor final bisa berbeda jika ada pencatatan bersamaan
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <FormField
              control={form.control}
              name="isiSingkat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Isi Singkat</FormLabel>
                  <FormControl>
                    <Input placeholder="Opsional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Menyimpan..." : "Simpan & Catat Nomor"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
