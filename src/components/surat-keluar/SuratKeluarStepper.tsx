"use client";

import { useEffect, useMemo, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Send,
  Eye,
  Archive,
  CheckCircle2,
  XCircle,
  Hash,
  AlertCircle,
  Copy,
  QrCode,
  ExternalLink,
  Download,
  ScanQrCode,
  Building2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatTanggal, formatTanggalWaktuJakarta } from "@/lib/utils";
import {
  ajukanPersetujuan,
  mulaiReviu,
  setujuiSurat,
  tolakSurat,
  selesaikanSurat,
  batalkanSurat,
  assignNomorSuratKeluar,
  checkNomorSuratKeluarAvailability,
  setManualNomorSuratKeluar,
  generateQrSuratKeluar,
  stampQrToSuratKeluarPdf,
  uploadSuratKeluarFinal,
  lanjutkanSimpegKePengarsipan,
} from "@/server/actions/suratKeluar";
import type { SuratKeluarRow } from "@/server/actions/suratKeluar";

const STEPS = [
  { key: "draft", label: "Draft Surat", icon: FileText },
  {
    key: "permohonan_persetujuan",
    label: "Permohonan Persetujuan",
    icon: Send,
  },
  { key: "reviu", label: "Proses Reviu", icon: Eye },
  { key: "pengarsipan", label: "Pengarsipan", icon: Archive },
  { key: "selesai", label: "Selesai", icon: CheckCircle2 },
] as const;

function stepIndex(status: string): number {
  return STEPS.findIndex((s) => s.key === status);
}

function hasRomanMonthSegment(value: string) {
  return /\/(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\//i.test(value);
}

function getNomorFormatHint(value: string, tanggalSurat: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const year = tanggalSurat.slice(0, 4);
  const warnings: string[] = [];

  if (!trimmed.includes("/")) {
    warnings.push("Gunakan pemisah '/' agar konsisten dengan format nomor surat.");
  }

  if (!hasRomanMonthSegment(trimmed)) {
    warnings.push("Segmen bulan Romawi belum terdeteksi.");
  }

  if (year && !trimmed.includes(year)) {
    warnings.push(`Tahun surat ${year} belum tercantum di nomor.`);
  }

  return warnings.join(" ");
}

export const JENIS_SURAT_LABEL: Record<string, string> = {
  undangan: "Undangan",
  pemberitahuan: "Pemberitahuan",
  permohonan: "Permohonan",
  keputusan: "Keputusan",
  mou: "MOU",
  balasan: "Balasan",
  edaran: "Edaran",
  keterangan: "Keterangan",
  tugas: "Tugas",
  invoice: "Invoice",
  lainnya: "Lainnya",
};

export const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "bg-secondary text-secondary-foreground border-border",
  },
  permohonan_persetujuan: {
    label: "Menunggu Persetujuan",
    className:
      "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  },
  reviu: {
    label: "Proses Reviu",
    className:
      "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  },
  pengarsipan: {
    label: "Pengarsipan",
    className:
      "bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800",
  },
  selesai: {
    label: "Selesai",
    className:
      "bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
  },
  dibatalkan: {
    label: "Dibatalkan",
    className:
      "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  },
};

interface SuratKeluarStepperProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: SuratKeluarRow;
  role: string | null;
  onEditClick: () => void;
}

export function SuratKeluarStepper({
  open,
  onOpenChange,
  row,
  role,
  onEditClick,
}: SuratKeluarStepperProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showTolakForm, setShowTolakForm] = useState(false);
  const [showQrPreview, setShowQrPreview] = useState(false);
  const [catatanReviu, setCatatanReviu] = useState("");
  const [finalFile, setFinalFile] = useState<File | null>(null);
  const [manualNomorSurat, setManualNomorSurat] = useState(row.nomorSurat ?? "");
  const [nomorAvailability, setNomorAvailability] = useState<{
    state: "idle" | "checking" | "available" | "duplicate";
    message: string;
  }>({
    state: "idle",
    message: "",
  });
  const [qrPlacement, setQrPlacement] = useState<
    "bottom-right" | "bottom-left" | "top-right" | "top-left"
  >("bottom-right");

  const status = row.status ?? "draft";
  const isAdmin = role === "admin";
  const isPejabat = role === "pejabat" || role === "admin";
  const currentStep = stepIndex(status);
  const isSimpeg = row.prosesViaSimpeg;
  const isCancelled = status === "dibatalkan";
  const verificationUrl = useMemo(() => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/verifikasi/surat-keluar/${row.id}`;
    }
    return `/verifikasi/surat-keluar/${row.id}`;
  }, [row.id]);
  const archiveChecklist = [
    {
      label: "Nomor surat sudah dibuat",
      done: Boolean(row.nomorSurat),
    },
    {
      label: "QR verifikasi sudah dibuat",
      done: Boolean(row.qrCodeUrl),
    },
    {
      label: "Dokumen final sudah diunggah",
      done: Boolean(row.fileFinalUrl),
    },
  ];
  const isArchiveChecklistComplete = archiveChecklist.every((item) => item.done);
  const nomorFormatHint = useMemo(
    () => getNomorFormatHint(manualNomorSurat, row.tanggalSurat),
    [manualNomorSurat, row.tanggalSurat],
  );

  useEffect(() => {
    setManualNomorSurat(row.nomorSurat ?? "");
    setNomorAvailability({ state: "idle", message: "" });
  }, [row.id, row.nomorSurat]);

  useEffect(() => {
    const trimmed = manualNomorSurat.trim();
    const currentNomor = row.nomorSurat?.trim() ?? "";

    if (!trimmed || trimmed === currentNomor) {
      setNomorAvailability({ state: "idle", message: "" });
      return;
    }

    setNomorAvailability({ state: "checking", message: "Memeriksa nomor surat..." });

    const timeout = window.setTimeout(async () => {
      try {
        const result = await checkNomorSuratKeluarAvailability({
          id: row.id,
          nomorSurat: trimmed,
        });

        if (!result.ok) {
          setNomorAvailability({
            state: "duplicate",
            message: "Gagal memeriksa nomor surat.",
          });
          return;
        }

        setNomorAvailability({
          state: result.available ? "available" : "duplicate",
          message: result.message,
        });
      } catch {
        setNomorAvailability({
          state: "duplicate",
          message: "Gagal memeriksa nomor surat.",
        });
      }
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [manualNomorSurat, row.id, row.nomorSurat]);

  function runAction(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      try {
        const res = await action();
        if (!res.ok) {
          toast.error(res.error ?? "Terjadi kesalahan.");
          return;
        }

        toast.success("Status surat berhasil diperbarui.");
        router.refresh();
        onOpenChange(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Terjadi kesalahan.");
      }
    });
  }

  function handleTolak() {
    if (!catatanReviu.trim()) {
      toast.error("Catatan reviu wajib diisi sebelum menolak.");
      return;
    }

    runAction(() => tolakSurat({ id: row.id, catatanReviu }));
    setShowTolakForm(false);
    setCatatanReviu("");
  }

  function handleGenerateNomor() {
    runAction(() => assignNomorSuratKeluar({ id: row.id }));
  }

  function handleSaveManualNomor() {
    if (!manualNomorSurat.trim()) {
      toast.error("Nomor surat manual wajib diisi.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await setManualNomorSuratKeluar({
          id: row.id,
          nomorSurat: manualNomorSurat,
        });

        if (!res.ok) {
          toast.error(res.error ?? "Gagal menyimpan nomor surat manual.");
          return;
        }

        toast.success(
          "Nomor surat manual disimpan. QR verifikasi dan file final perlu diperbarui.",
        );
        setFinalFile(null);
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Gagal menyimpan nomor surat manual.",
        );
      }
    });
  }

  function handleGenerateQr() {
    startTransition(async () => {
      try {
        const res = await generateQrSuratKeluar({ id: row.id });
        if (!res.ok) {
          toast.error(res.error ?? "Generate QR verifikasi gagal.");
          return;
        }

        toast.success("QR verifikasi surat berhasil dibuat.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Generate QR verifikasi gagal.");
      }
    });
  }

  function handleUploadFinal() {
    if (!finalFile) {
      toast.error("Pilih file final terlebih dahulu.");
      return;
    }

    startTransition(async () => {
      try {
        const dataUrl = await fileToDataUrl(finalFile);
        const res = await uploadSuratKeluarFinal({
          id: row.id,
          fileName: finalFile.name,
          contentType: finalFile.type || "application/octet-stream",
          dataUrl,
        });

        if (!res.ok) {
          toast.error(res.error ?? "Upload file final gagal.");
          return;
        }

        toast.success("File final surat berhasil diunggah.");
        setFinalFile(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload file final gagal.");
      }
    });
  }

  async function handleCopyVerificationLink() {
    try {
      await navigator.clipboard.writeText(verificationUrl);
      toast.success("Link verifikasi berhasil disalin.");
    } catch {
      toast.error("Gagal menyalin link verifikasi.");
    }
  }

  function handlePreviewVerificationPage() {
    window.open(verificationUrl, "_blank", "noopener,noreferrer");
  }

  function isPdfFile(file: File | null) {
    if (!file) return false;
    return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  }

  function handleDownloadQr() {
    if (!row.qrCodeUrl) {
      toast.error("QR verifikasi belum tersedia.");
      return;
    }

    const link = document.createElement("a");
    const fileStem = (row.nomorSurat ?? row.id).replace(/[^a-zA-Z0-9-_]+/g, "-");
    link.href = row.qrCodeUrl;
    link.download = `qr-verifikasi-${fileStem}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleStampQrPdf() {
    if (!finalFile) {
      toast.error("Pilih file PDF terlebih dahulu.");
      return;
    }

    if (!isPdfFile(finalFile)) {
      toast.error("Fitur ini hanya mendukung file PDF.");
      return;
    }

    if (!row.qrCodeUrl) {
      toast.error("Generate QR verifikasi terlebih dahulu.");
      return;
    }

    startTransition(async () => {
      try {
        const dataUrl = await fileToDataUrl(finalFile);
        const res = await stampQrToSuratKeluarPdf({
          id: row.id,
          fileName: finalFile.name,
          contentType: finalFile.type || "application/pdf",
          dataUrl,
          placement: qrPlacement,
        });

        if (!res.ok) {
          toast.error(res.error ?? "Gagal membubuhkan QR ke PDF.");
          return;
        }

        toast.success("QR berhasil dibubuhkan ke PDF dan file final diperbarui.");
        setFinalFile(null);
        router.refresh();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Gagal membubuhkan QR ke PDF.",
        );
      }
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
        <DialogHeader>
          <DialogTitle>Detail Surat Keluar</DialogTitle>
          <DialogDescription>{row.perihal}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-x-4 gap-y-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-2 sm:p-4">
          <div>
            <span className="text-muted-foreground">Tujuan</span>
            <p className="font-medium">{row.tujuan}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Tanggal Surat</span>
            <p className="font-medium">{formatTanggal(row.tanggalSurat)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Jenis Surat</span>
            <p className="font-medium">
              {JENIS_SURAT_LABEL[row.jenisSurat] ?? row.jenisSurat}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Divisi</span>
            <p className="font-medium">{row.divisiNama ?? "-"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Pembuat</span>
            <p className="font-medium">{row.dibuatOlehNama ?? "-"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Proses</span>
            <p className="font-medium">
              {isSimpeg ? "SIMPEG IAI" : "Workflow Arka"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Draft Surat</span>
            {row.fileDraftUrl ? (
              <a
                href={row.fileDraftUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary underline underline-offset-2"
              >
                Buka draft
              </a>
            ) : (
              <p className="font-medium">Belum dilampirkan</p>
            )}
          </div>
          <div>
            <span className="text-muted-foreground">Lampiran</span>
            {row.lampiranUrl ? (
              <a
                href={row.lampiranUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary underline underline-offset-2"
              >
                Buka lampiran
              </a>
            ) : (
              <p className="font-medium">Belum dilampirkan</p>
            )}
          </div>
          <div>
            <span className="text-muted-foreground">File Final</span>
            {row.fileFinalUrl ? (
              <a
                href={row.fileFinalUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary underline underline-offset-2"
              >
                Buka file final
              </a>
            ) : (
              <p className="font-medium">Belum diunggah</p>
            )}
          </div>
          {row.tujuanAlamat ? (
            <div className="col-span-2">
              <span className="text-muted-foreground">Alamat Tujuan</span>
              <p className="font-medium">{row.tujuanAlamat}</p>
            </div>
          ) : null}
          {row.isiSingkat ? (
            <div className="col-span-2">
              <span className="text-muted-foreground">Isi Singkat</span>
              <p className="font-medium">{row.isiSingkat}</p>
            </div>
          ) : null}
          {row.nomorSurat ? (
            <div className="col-span-2">
              <span className="text-muted-foreground">Nomor Surat</span>
              <p className="font-mono font-medium text-primary">
                {row.nomorSurat}
              </p>
            </div>
          ) : null}
        </div>

        {row.catatanReviu && status === "draft" ? (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Catatan Reviu</p>
              <p className="mt-0.5">{row.catatanReviu}</p>
            </div>
          </div>
        ) : null}

        {isSimpeg ? (
          <div className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Surat ini diproses di SIMPEG IAI</p>
              <p className="mt-0.5">
                Tahap persetujuan dilakukan di SIMPEG. Arka tetap mencatat nomor
                surat dan arsip digital.
              </p>
            </div>
          </div>
        ) : null}

        {!isCancelled ? (
          <div className="relative grid grid-cols-2 gap-3 sm:flex sm:items-start sm:justify-between sm:gap-2">
            {STEPS.map((step, idx) => {
              const isDone = currentStep > idx;
              const isCurrent = currentStep === idx;
              const Icon = step.icon;

              return (
                <div
                  key={step.key}
                  className="relative flex flex-col items-center gap-1 sm:flex-1"
                >
                  {idx < STEPS.length - 1 ? (
                    <div
                      className={cn(
                        "absolute left-1/2 top-4 hidden h-0.5 w-full sm:block",
                        isDone ? "bg-primary" : "bg-border",
                      )}
                    />
                  ) : null}

                  <div
                    className={cn(
                      "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-background",
                      isDone
                        ? "border-primary bg-primary text-primary-foreground"
                        : isCurrent
                          ? "border-primary text-primary"
                          : "border-border text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <span
                    className={cn(
                      "text-center text-[11px] leading-tight",
                      isCurrent
                        ? "font-semibold text-primary"
                        : isDone
                          ? "text-muted-foreground"
                          : "text-muted-foreground/60",
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            <XCircle className="h-4 w-4 shrink-0" />
            <span className="font-medium">Surat ini ditandai tidak berlaku.</span>
          </div>
        )}

        <div className="space-y-3 rounded-lg border bg-card p-3 sm:p-4">
          <p className="text-sm font-medium text-muted-foreground">
            Aksi tersedia
          </p>

          {status === "draft" && (
            <div className="space-y-3">
              <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium text-foreground">Nomor Surat</p>
                </div>
                {row.nomorSurat ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
                    <Hash className="h-4 w-4 text-primary" />
                    <span className="font-mono text-sm font-medium">
                      {row.nomorSurat}
                    </span>
                    <Badge
                      variant="outline"
                      className="ml-auto text-xs text-green-600"
                    >
                      Nomor Aktif
                    </Badge>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Generate nomor surat di awal, seperti pencatatan di logbook manual.
                    </p>
                    <Input
                      value={manualNomorSurat}
                      onChange={(event) => setManualNomorSurat(event.target.value)}
                      placeholder="Isi manual nomor surat jika tidak ingin generate otomatis"
                    />
                    <div className="grid gap-2 sm:flex sm:flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleGenerateNomor}
                        disabled={isPending}
                        className="w-full sm:w-auto"
                      >
                        <Hash className="mr-1.5 h-3.5 w-3.5" />
                        Generate Otomatis
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSaveManualNomor}
                        disabled={
                          isPending ||
                          !manualNomorSurat.trim() ||
                          nomorAvailability.state === "duplicate" ||
                          nomorAvailability.state === "checking"
                        }
                        className="w-full sm:w-auto"
                      >
                        Gunakan Nomor Manual
                      </Button>
                    </div>
                    {nomorAvailability.state !== "idle" ? (
                      <p
                        className={cn(
                          "text-xs",
                          nomorAvailability.state === "available"
                            ? "text-green-700 dark:text-green-300"
                            : nomorAvailability.state === "checking"
                              ? "text-muted-foreground"
                              : "text-red-700 dark:text-red-300",
                        )}
                      >
                        {nomorAvailability.message}
                      </p>
                    ) : null}
                    {nomorFormatHint ? (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        {nomorFormatHint}
                      </p>
                    ) : null}
                  </>
                )}
              </div>

              <div className="grid gap-2 sm:flex sm:flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onEditClick();
                }}
                className="w-full sm:w-auto"
              >
                Edit Surat
              </Button>
              {!row.fileDraftUrl ? (
                <p className="basis-full text-xs text-amber-700 dark:text-amber-300">
                  Draft surat belum dilampirkan. Tambahkan URL draft bila
                  dokumen sudah tersedia sebelum diajukan.
                </p>
              ) : null}
              {isSimpeg ? (
                <Button
                  size="sm"
                  onClick={() =>
                    runAction(() => lanjutkanSimpegKePengarsipan({ id: row.id }))
                  }
                  disabled={isPending}
                  className="w-full sm:w-auto"
                >
                  <Archive className="mr-1.5 h-3.5 w-3.5" />
                  Lanjut ke Pengarsipan
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => runAction(() => ajukanPersetujuan({ id: row.id }))}
                  disabled={isPending}
                  className="w-full sm:w-auto"
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Ajukan Persetujuan
                </Button>
              )}
              {isAdmin ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => runAction(() => batalkanSurat({ id: row.id }))}
                  disabled={isPending}
                  className="w-full sm:w-auto"
                >
                  Tandai Tidak Berlaku
                </Button>
              ) : null}
            </div>
            </div>
          )}

          {status === "permohonan_persetujuan" && (
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              {isPejabat ? (
                <Button
                  size="sm"
                  onClick={() => runAction(() => mulaiReviu({ id: row.id }))}
                  disabled={isPending}
                  className="w-full sm:w-auto"
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" />
                  Mulai Reviu
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Menunggu pejabat memulai proses reviu.
                </p>
              )}
              {isAdmin ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => runAction(() => batalkanSurat({ id: row.id }))}
                  disabled={isPending}
                  className="w-full sm:w-auto"
                >
                  Tandai Tidak Berlaku
                </Button>
              ) : null}
            </div>
          )}

          {status === "reviu" && (
            <div className="space-y-3">
              {isPejabat ? (
                <>
                  {!showTolakForm ? (
                    <div className="grid gap-2 sm:flex sm:flex-wrap">
                      <Button
                        size="sm"
                        onClick={() => runAction(() => setujuiSurat({ id: row.id }))}
                        disabled={isPending}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        Setujui
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setShowTolakForm(true)}
                        disabled={isPending}
                        className="w-full sm:w-auto"
                      >
                        Tolak / Minta Revisi
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                          Alasan revisi wajib diisi
                        </p>
                        <p className="text-xs text-amber-800 dark:text-amber-200">
                          Catatan ini akan dikirim ke pembuat surat dan surat akan
                          kembali ke status Draft untuk diperbaiki.
                        </p>
                      </div>
                      <Textarea
                        placeholder="Contoh: perihal perlu diperjelas, lampiran belum lengkap, format penandatangan belum sesuai."
                        rows={3}
                        value={catatanReviu}
                        onChange={(e) => setCatatanReviu(e.target.value)}
                      />
                      <div className="grid gap-2 sm:flex">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={handleTolak}
                          disabled={isPending}
                          className="w-full sm:w-auto"
                        >
                          Kirim Penolakan
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowTolakForm(false);
                            setCatatanReviu("");
                          }}
                          className="w-full sm:w-auto"
                        >
                          Batal
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Pejabat sedang meninjau surat ini.
                </p>
              )}
            </div>
          )}

          {status === "pengarsipan" && (
            <div className="space-y-3">
              {isPejabat ? (
                <div className="space-y-2">
                  <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                        1
                      </div>
                      <p className="text-sm font-medium text-foreground">Nomor Surat</p>
                    </div>
                    {row.nomorSurat ? (
                      <>
                      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
                        <Hash className="h-4 w-4 text-primary" />
                        <span className="font-mono text-sm font-medium">
                          {row.nomorSurat}
                        </span>
                        <Badge
                          variant="outline"
                          className="ml-auto text-xs text-green-600"
                        >
                          Nomor Aktif
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Ubah ke Nomor Manual
                        </p>
                        <Input
                          value={manualNomorSurat}
                          onChange={(event) => setManualNomorSurat(event.target.value)}
                          placeholder="Isi manual nomor surat untuk backdate/koreksi"
                        />
                        <div className="grid gap-2 sm:flex sm:flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleSaveManualNomor}
                            disabled={
                              isPending ||
                              !manualNomorSurat.trim() ||
                              nomorAvailability.state === "duplicate" ||
                              nomorAvailability.state === "checking"
                            }
                            className="w-full sm:w-auto"
                          >
                            Gunakan Nomor Manual
                          </Button>
                        </div>
                        {nomorAvailability.state !== "idle" ? (
                          <p
                            className={cn(
                              "text-xs",
                              nomorAvailability.state === "available"
                                ? "text-green-700 dark:text-green-300"
                                : nomorAvailability.state === "checking"
                                  ? "text-muted-foreground"
                                  : "text-red-700 dark:text-red-300",
                            )}
                          >
                            {nomorAvailability.message}
                          </p>
                        ) : null}
                        {nomorFormatHint ? (
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            {nomorFormatHint}
                          </p>
                        ) : null}
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Menyimpan nomor manual akan mereset QR verifikasi dan file
                          final agar tidak mismatch dengan nomor sebelumnya.
                        </p>
                      </div>
                      </>
                    ) : (
                      <>
                      <p className="text-xs text-muted-foreground">
                        Pilih salah satu: generate otomatis dari counter sistem atau isi
                        manual untuk kebutuhan backdate/koreksi.
                      </p>
                      <Input
                        value={manualNomorSurat}
                        onChange={(event) => setManualNomorSurat(event.target.value)}
                        placeholder="Isi manual nomor surat jika tidak ingin generate otomatis"
                      />
                      <div className="grid gap-2 sm:flex sm:flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleGenerateNomor}
                          disabled={isPending}
                          className="w-full sm:w-auto"
                        >
                          <Hash className="mr-1.5 h-3.5 w-3.5" />
                          Generate Otomatis
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleSaveManualNomor}
                          disabled={
                            isPending ||
                            !manualNomorSurat.trim() ||
                            nomorAvailability.state === "duplicate" ||
                            nomorAvailability.state === "checking"
                          }
                          className="w-full sm:w-auto"
                        >
                          Gunakan Nomor Manual
                        </Button>
                      </div>
                      {nomorAvailability.state !== "idle" ? (
                        <p
                          className={cn(
                            "text-xs",
                            nomorAvailability.state === "available"
                              ? "text-green-700 dark:text-green-300"
                              : nomorAvailability.state === "checking"
                                ? "text-muted-foreground"
                                : "text-red-700 dark:text-red-300",
                          )}
                        >
                          {nomorAvailability.message}
                        </p>
                      ) : null}
                      {nomorFormatHint ? (
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          {nomorFormatHint}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        Gunakan input manual untuk kasus backdate, koreksi, atau
                        penyesuaian nomor surat existing.
                      </p>
                      </>
                    )}
                  </div>

                  <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                        2
                      </div>
                      <p className="text-sm font-medium text-foreground">QR Verifikasi</p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          QR akan mengarah ke halaman verifikasi publik surat.
                        </p>
                      </div>
                      {row.qrCodeUrl ? (
                        <img
                          src={row.qrCodeUrl}
                          alt="QR verifikasi surat"
                          className="h-20 w-20 rounded-md border bg-white p-1"
                        />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed text-muted-foreground">
                          <QrCode className="h-5 w-5" />
                        </div>
                      )}
                    </div>

                    <div className="grid gap-2 sm:flex sm:flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleGenerateQr}
                        disabled={isPending}
                        className="w-full sm:w-auto"
                      >
                        <QrCode className="mr-1.5 h-3.5 w-3.5" />
                        {row.qrCodeUrl ? "Generate Ulang QR" : "Generate QR"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(verificationUrl, "_blank", "noopener,noreferrer")}
                        className="w-full sm:w-auto"
                      >
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Preview Halaman Verifikasi
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopyVerificationLink}
                        className="w-full sm:w-auto"
                      >
                        <Copy className="mr-1.5 h-3.5 w-3.5" />
                        Salin Link Verifikasi
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowQrPreview(true)}
                        disabled={!row.qrCodeUrl}
                        className="w-full sm:w-auto"
                      >
                        <ScanQrCode className="mr-1.5 h-3.5 w-3.5" />
                        Preview QR
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDownloadQr}
                        disabled={!row.qrCodeUrl}
                        className="w-full sm:w-auto"
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Download QR PNG
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                        3
                      </div>
                      <p className="text-sm font-medium text-foreground">File Final</p>
                    </div>
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setFinalFile(event.target.files?.[0] ?? null)
                      }
                    />
                    {finalFile ? (
                      <p className="text-xs text-foreground">
                        File dipilih: {finalFile.name}
                      </p>
                    ) : null}
                    <div className="grid gap-2 sm:flex sm:flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleUploadFinal}
                        disabled={isPending || !finalFile}
                        className="w-full sm:w-auto"
                      >
                        Upload File Final
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleStampQrPdf}
                        disabled={isPending || !finalFile || !isPdfFile(finalFile) || !row.qrCodeUrl}
                        className="w-full sm:w-auto"
                      >
                        Tempel QR ke PDF & Upload
                      </Button>
                    </div>
                    <div className="space-y-2 rounded-md border bg-background/80 p-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Posisi QR pada PDF
                      </p>
                      <Select
                        value={qrPlacement}
                        onValueChange={(value) =>
                          setQrPlacement(
                            value as "bottom-right" | "bottom-left" | "top-right" | "top-left",
                          )
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bottom-right">Kanan bawah</SelectItem>
                          <SelectItem value="bottom-left">Kiri bawah</SelectItem>
                          <SelectItem value="top-right">Kanan atas</SelectItem>
                          <SelectItem value="top-left">Kiri atas</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        QR ditempel pada halaman terakhir PDF. Gunakan opsi ini jika
                        ingin hasil akhir langsung siap upload tanpa edit manual.
                      </p>
                      {finalFile && !isPdfFile(finalFile) ? (
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          File yang dipilih bukan PDF, jadi hanya bisa diupload biasa.
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Checklist Pengarsipan
                    </p>
                    <div className="space-y-1.5 text-sm">
                      {archiveChecklist.map((item) => (
                        <div key={item.label} className="flex items-center gap-2">
                          {item.done ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-amber-600" />
                          )}
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => runAction(() => selesaikanSurat({ id: row.id }))}
                    disabled={isPending || !isArchiveChecklistComplete}
                    className="w-full bg-green-600 hover:bg-green-700 sm:w-auto"
                    title={
                      !isArchiveChecklistComplete
                        ? "Lengkapi checklist pengarsipan terlebih dahulu"
                        : undefined
                    }
                  >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Selesaikan Pengarsipan
                  </Button>
                  {isAdmin ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => runAction(() => batalkanSurat({ id: row.id }))}
                      disabled={isPending}
                      className="w-full sm:w-auto"
                    >
                      Tandai Tidak Berlaku
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Proses pengarsipan sedang berlangsung.
                  </p>
                  {isAdmin ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => runAction(() => batalkanSurat({ id: row.id }))}
                      disabled={isPending}
                      className="w-full sm:w-auto"
                    >
                      Tandai Tidak Berlaku
                    </Button>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {status === "selesai" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-medium">
                  Surat telah selesai diarsipkan.
                </span>
              </div>
              <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Verifikasi Publik
                </p>
                <div className="grid gap-2 sm:flex sm:flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handlePreviewVerificationPage}
                    className="w-full sm:w-auto"
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Preview Halaman Verifikasi
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyVerificationLink}
                    className="w-full sm:w-auto"
                  >
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Salin Link Verifikasi
                  </Button>
                </div>
                <p className="break-all text-xs text-muted-foreground">
                  {verificationUrl}
                </p>
              </div>
              {isAdmin ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => runAction(() => batalkanSurat({ id: row.id }))}
                  disabled={isPending}
                  className="w-full sm:w-auto"
                >
                  Tandai Tidak Berlaku
                </Button>
              ) : null}
            </div>
          )}

          {status === "dibatalkan" && (
            <p className="text-sm text-muted-foreground">
              Surat ini ditandai tidak berlaku dan tidak dapat diproses lebih lanjut.
            </p>
          )}

          {row.catatanReviu && status !== "reviu" ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="font-medium">Catatan Revisi</p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                Dicatat pada {formatTanggalWaktuJakarta(row.catatanReviuAt)}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{row.catatanReviu}</p>
            </div>
          ) : null}
        </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showQrPreview} onOpenChange={setShowQrPreview}>
        <DialogContent className="max-w-[calc(100vw-1rem)] p-4 sm:max-w-md sm:p-6">
          <DialogHeader>
            <DialogTitle>Preview QR Verifikasi</DialogTitle>
            <DialogDescription>
              Gunakan QR ini untuk ditempel ke dokumen final sebelum diunggah.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-muted/20 p-4 sm:p-6">
            {row.qrCodeUrl ? (
              <img
                src={row.qrCodeUrl}
                alt="QR verifikasi surat"
                className="h-auto w-full max-w-72 rounded-xl border bg-white p-3 shadow-sm"
              />
            ) : (
              <div className="flex h-64 w-full max-w-72 items-center justify-center rounded-xl border border-dashed text-muted-foreground sm:h-72">
                QR belum tersedia
              </div>
            )}
            <div className="grid w-full gap-2 sm:flex sm:flex-wrap sm:justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={handleDownloadQr}
                disabled={!row.qrCodeUrl}
                className="w-full sm:w-auto"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download QR PNG
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyVerificationLink}
                className="w-full sm:w-auto"
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Salin Link Verifikasi
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
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
