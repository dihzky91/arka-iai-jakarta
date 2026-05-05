"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Hash, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  generateBatch,
  type CertificateBatchClassOption,
} from "@/server/actions/sertifikat/nomor/batches";
import type { ClassType, Program } from "@/server/db/schema";
import { cn, getTodayIsoInJakarta } from "@/lib/utils";

const formSchema = z
  .object({
    sourceMode: z.enum(["existing", "manual"]),
    useCustomAngkatanFormat: z.boolean().default(false),
    kelasId: z.string().optional(),
    overrideAngkatan: z.number().int().min(1).max(999).optional(),
    overrideCertificateClassCode: z.enum(["01", "02", "03"]).optional(),
    manualNamaKelas: z.string().trim().optional(),
    manualProgramId: z.string().optional(),
    manualClassTypeId: z.string().optional(),
    manualMode: z.enum(["offline", "online"]),
    manualStartDate: z.string().optional(),
    manualAngkatan: z.number().int().min(1).max(999).optional(),
    manualCertificateClassCode: z.enum(["01", "02", "03"]).optional(),
    quantity: z.coerce
      .number()
      .int("Jumlah harus bilangan bulat.")
      .min(1, "Minimal 1 sertifikat.")
      .max(1000, "Maksimal 1000 per batch."),
    notes: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.sourceMode === "existing") {
      if (!value.kelasId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["kelasId"],
          message: "Kelas wajib dipilih.",
        });
      }
      return;
    }

    const requiredManualFields: Array<[keyof FormValues, string]> = [
      ["manualNamaKelas", "Nama kelas wajib diisi."],
      ["manualProgramId", "Program wajib dipilih."],
      ["manualClassTypeId", "Tipe kelas wajib dipilih."],
      ["manualStartDate", "Tanggal mulai wajib diisi."],
      ["manualAngkatan", "Angkatan wajib diisi."],
      ["manualCertificateClassCode", "Kode kelas sertifikat wajib dipilih."],
    ];

    for (const [field, message] of requiredManualFields) {
      if (!value[field]) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [field], message });
      }
    }
  });

type FormValues = z.input<typeof formSchema>;

interface GenerateBatchFormProps {
  classes: CertificateBatchClassOption[];
  programs: Program[];
  classTypes: ClassType[];
  lastSerial: number;
}

function FormError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-destructive">{message}</p> : null;
}

function setOptionalNumber(value: string) {
  return value ? Number(value) : undefined;
}

function previewNumbers(
  angkatan: number | null | undefined,
  classTypeCode: string | null | undefined,
  quantity: number | undefined,
  lastSerial: number,
  useCustomAngkatanFormat: boolean,
) {
  if (!angkatan || !classTypeCode || !quantity) return null;
  const angkatanPrefix = useCustomAngkatanFormat
    ? String(angkatan)
    : String(angkatan).padStart(3, "0");
  const start = lastSerial + 1;
  const end = lastSerial + quantity;
  return {
    first: `${angkatanPrefix}${classTypeCode}.${start}`,
    last: `${angkatanPrefix}${classTypeCode}.${end}`,
    start,
    end,
  };
}

export function GenerateBatchForm({
  classes,
  programs,
  classTypes,
  lastSerial,
}: GenerateBatchFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sourceMode: "existing",
      useCustomAngkatanFormat: false,
      kelasId: "",
      overrideAngkatan: undefined,
      overrideCertificateClassCode: undefined,
      manualNamaKelas: "",
      manualProgramId: "",
      manualClassTypeId: "",
      manualMode: "offline",
      manualStartDate: getTodayIsoInJakarta(),
      manualAngkatan: undefined,
      manualCertificateClassCode: undefined,
      quantity: undefined,
      notes: "",
    },
  });

  const sourceMode = form.watch("sourceMode");
  const selectedClassId = form.watch("kelasId");
  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) ?? null,
    [classes, selectedClassId],
  );
  const watchQuantity = form.watch("quantity");
  const useCustomAngkatanFormat = form.watch("useCustomAngkatanFormat") ?? false;

  const preview =
    sourceMode === "existing"
      ? previewNumbers(
          selectedClass?.angkatan ?? form.watch("overrideAngkatan"),
          selectedClass?.certificateClassCode ??
            form.watch("overrideCertificateClassCode"),
          watchQuantity,
          lastSerial,
          useCustomAngkatanFormat,
        )
      : previewNumbers(
          form.watch("manualAngkatan"),
          form.watch("manualCertificateClassCode"),
          watchQuantity,
          lastSerial,
          useCustomAngkatanFormat,
        );

  const needsExistingOverride = Boolean(
    selectedClass && (!selectedClass.angkatan || !selectedClass.certificateClassCode),
  );

  function setMode(mode: "existing" | "manual") {
    form.setValue("sourceMode", mode, { shouldValidate: true });
  }

  function handleSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await generateBatch(values);

      if (result.ok) {
        toast.success(
          `Batch berhasil digenerate! Nomor ${result.data.firstNumber} s/d ${result.data.lastNumber}.`,
        );
        router.push(`/sertifikat/nomor/${result.data.batch.id}`);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card className="rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-primary" />
            Generate Batch Nomor Sertifikat
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  sourceMode === "existing"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Kelas Existing
              </button>
              <button
                type="button"
                onClick={() => setMode("manual")}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  sourceMode === "manual"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Override Manual
              </button>
            </div>

            <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="useCustomAngkatanFormat"
                  checked={useCustomAngkatanFormat}
                  onCheckedChange={(checked) =>
                    form.setValue("useCustomAngkatanFormat", checked === true)
                  }
                />
                <div className="space-y-1">
                  <Label htmlFor="useCustomAngkatanFormat" className="font-medium">
                    Gunakan format angkatan khusus (tanpa 0 di depan)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Default sistem tetap 3 digit (contoh: 50 menjadi 050). Aktifkan opsi ini
                    hanya untuk case khusus agar nomor memakai nilai angkatan apa adanya.
                  </p>
                </div>
              </div>
            </div>

            {sourceMode === "existing" ? (
              <>
                <div className="space-y-1.5">
                  <Label>Kelas Pelatihan</Label>
                  <Select
                    value={form.watch("kelasId")}
                    onValueChange={(value) =>
                      form.setValue("kelasId", value, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih kelas..." />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((kelas) => (
                        <SelectItem key={kelas.id} value={kelas.id}>
                          {kelas.namaKelas} - {kelas.programName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormError message={form.formState.errors.kelasId?.message} />
                </div>

                {selectedClass ? (
                  <div className="grid gap-3 rounded-xl border border-border bg-muted/30 p-4 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Program</p>
                      <p className="font-medium">{selectedClass.programName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tipe Kelas</p>
                      <p className="font-medium">{selectedClass.classTypeName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Angkatan</p>
                      <p className="font-medium">{selectedClass.angkatan ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Kode Sertifikat</p>
                      <p className="font-mono font-medium">
                        {selectedClass.certificateClassCode ?? "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Metode</p>
                      <p className="font-medium capitalize">{selectedClass.mode}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Sumber</p>
                      <p className="font-medium capitalize">{selectedClass.source}</p>
                    </div>
                  </div>
                ) : null}

                {needsExistingOverride ? (
                  <div className="grid gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Override Angkatan</Label>
                      <Input
                        type="number"
                        min={1}
                        max={999}
                        placeholder="mis. 223"
                        value={form.watch("overrideAngkatan") ?? ""}
                        onChange={(event) =>
                          form.setValue("overrideAngkatan", setOptionalNumber(event.target.value), {
                            shouldValidate: true,
                          })
                        }
                      />
                      <FormError message={form.formState.errors.overrideAngkatan?.message} />
                    </div>

                    <div className="space-y-1.5">
                      <Label>Override Kode Sertifikat</Label>
                      <Select
                        value={form.watch("overrideCertificateClassCode") ?? ""}
                        onValueChange={(value) =>
                          form.setValue(
                            "overrideCertificateClassCode",
                            value as "01" | "02" | "03",
                            { shouldValidate: true },
                          )
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih kode" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="01">01 - Kelas pagi</SelectItem>
                          <SelectItem value="02">02 - Kelas siang</SelectItem>
                          <SelectItem value="03">03 - Kelas sore / ekstra</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormError
                        message={form.formState.errors.overrideCertificateClassCode?.message}
                      />
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="space-y-5 rounded-xl border border-border bg-muted/20 p-4">
                <div className="space-y-1.5">
                  <Label>Nama Kelas Real</Label>
                  <Input
                    placeholder="mis. Brevet AB Angkatan 223 Pagi"
                    {...form.register("manualNamaKelas")}
                  />
                  <FormError message={form.formState.errors.manualNamaKelas?.message} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Program</Label>
                    <Select
                      value={form.watch("manualProgramId") ?? ""}
                      onValueChange={(value) =>
                        form.setValue("manualProgramId", value, { shouldValidate: true })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih program" />
                      </SelectTrigger>
                      <SelectContent>
                        {programs.map((program) => (
                          <SelectItem key={program.id} value={program.id}>
                            {program.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormError message={form.formState.errors.manualProgramId?.message} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Tipe Kelas</Label>
                    <Select
                      value={form.watch("manualClassTypeId") ?? ""}
                      onValueChange={(value) =>
                        form.setValue("manualClassTypeId", value, { shouldValidate: true })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih tipe" />
                      </SelectTrigger>
                      <SelectContent>
                        {classTypes.map((classType) => (
                          <SelectItem key={classType.id} value={classType.id}>
                            {classType.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormError message={form.formState.errors.manualClassTypeId?.message} />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Metode</Label>
                    <Select
                      value={form.watch("manualMode")}
                      onValueChange={(value) =>
                        form.setValue("manualMode", value as "offline" | "online")
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="offline">Offline</SelectItem>
                        <SelectItem value="online">Online</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Tanggal Mulai</Label>
                    <Input type="date" {...form.register("manualStartDate")} />
                    <FormError message={form.formState.errors.manualStartDate?.message} />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Angkatan Sertifikat</Label>
                    <Input
                      type="number"
                      min={1}
                      max={999}
                      placeholder="mis. 223"
                      value={form.watch("manualAngkatan") ?? ""}
                      onChange={(event) =>
                        form.setValue("manualAngkatan", setOptionalNumber(event.target.value), {
                          shouldValidate: true,
                        })
                      }
                    />
                    <FormError message={form.formState.errors.manualAngkatan?.message} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Kode Kelas Sertifikat</Label>
                    <Select
                      value={form.watch("manualCertificateClassCode") ?? ""}
                      onValueChange={(value) =>
                        form.setValue(
                          "manualCertificateClassCode",
                          value as "01" | "02" | "03",
                          { shouldValidate: true },
                        )
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pilih kode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="01">01 - Kelas pagi</SelectItem>
                        <SelectItem value="02">02 - Kelas siang</SelectItem>
                        <SelectItem value="03">03 - Kelas sore / ekstra</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormError
                      message={form.formState.errors.manualCertificateClassCode?.message}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Jumlah Sertifikat</Label>
              <Input
                type="number"
                placeholder="Contoh: 30"
                min={1}
                max={1000}
                {...form.register("quantity")}
              />
              <FormError message={form.formState.errors.quantity?.message} />
            </div>

            <div className="space-y-1.5">
              <Label>
                Catatan{" "}
                <span className="font-normal text-muted-foreground">(opsional)</span>
              </Label>
              <Textarea
                placeholder="Keterangan tambahan untuk batch ini..."
                {...form.register("notes")}
              />
            </div>

            {preview ? (
              <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-semibold text-primary">Preview Nomor Sertifikat</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border bg-card p-3">
                    <p className="mb-1 text-xs text-muted-foreground">Nomor Pertama</p>
                    <p className="font-mono text-base font-semibold">{preview.first}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Serial #{preview.start}</p>
                  </div>
                  <div className="rounded-lg border bg-card p-3">
                    <p className="mb-1 text-xs text-muted-foreground">Nomor Terakhir</p>
                    <p className="font-mono text-base font-semibold">{preview.last}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Serial #{preview.end}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Serial global saat ini: <span className="font-mono">{lastSerial}</span>.
                  Batch baru akan menggunakan serial{" "}
                  <span className="font-mono">{preview.start}</span> s/d{" "}
                  <span className="font-mono">{preview.end}</span>.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                Lengkapi kelas, angkatan/kode sertifikat, dan jumlah untuk melihat preview nomor.
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/sertifikat/nomor")}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Generate Batch
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
