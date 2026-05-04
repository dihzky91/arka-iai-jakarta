"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Pencil, Plus, Trash2, RotateCcw, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  lockHonorariumBatch,
  markHonorariumBatchInProcess,
  markHonorariumBatchPaid,
  correctHonorariumBatchPayment,
  submitHonorariumBatchToFinance,
  reopenHonorariumBatch,
  addHonorariumDeduction,
  removeHonorariumDeduction,
  exportHonorariumBatchExcel,
  logHonorariumBatchPdfExport,
  uploadHonorariumPaymentProof,
  type getHonorariumBatchDetail,
  type DeductionRow,
  type HonorariumPaymentProofRow,
} from "@/server/actions/jadwal-otomatis/honorarium";
import {
  formatTanggalWaktuJakarta,
  formatTanggalPendek,
  getTodayIsoInJakarta,
} from "@/lib/utils";

type DetailData = NonNullable<
  Awaited<ReturnType<typeof getHonorariumBatchDetail>>
>;

interface HonorariumBatchDetailProps {
  initialData: DetailData;
  initialDeductions: DeductionRow[];
  initialPaymentProofs: HonorariumPaymentProofRow[];
  canManage: boolean;
  isAdmin: boolean;
  canProcess?: boolean;
  canPay?: boolean;
  systemIdentity?: { namaSistem: string; logoUrl: string | null };
}

function formatCurrency(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

function statusLabel(status: string) {
  if (status === "draft") return "Draft";
  if (status === "dikirim_ke_keuangan") return "Dikirim ke Keuangan";
  if (status === "diproses_keuangan") return "Diproses Keuangan";
  if (status === "dibayar") return "Dibayar";
  if (status === "locked") return "Locked";
  return status;
}

function statusVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "locked" || status === "dibayar") return "default";
  if (status === "draft") return "secondary";
  return "outline";
}

function sourceLabel(source: string) {
  if (source === "actual") return "Substitusi";
  if (source === "planned") return "Planned";
  return source;
}

function actionLabel(action: string) {
  if (action === "generated_draft") return "Generate Draft";
  if (action === "submitted_to_finance") return "Kirim ke Keuangan";
  if (action === "finance_processing_started") return "Mulai Proses Keuangan";
  if (action === "finance_paid") return "Tandai Dibayar";
  if (action === "finance_payment_corrected") return "Koreksi Pembayaran";
  if (action === "batch_locked") return "Lock Batch";
  if (action === "batch_reopened") return "Reopen Batch";
  if (action === "deduction_added") return "Tambah Potongan";
  if (action === "deduction_removed") return "Hapus Potongan";
  if (action === "payment_proof_uploaded") return "Upload Bukti Pembayaran";
  if (action === "batch_exported_excel") return "Export Excel";
  if (action === "batch_exported_pdf") return "Export PDF";
  return action;
}

function payloadSummary(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return "-";
  const entries = Object.entries(payload as Record<string, unknown>)
    .filter(([, value]) => value !== null && value !== "")
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value)}`);
  return entries.length > 0 ? entries.join(" | ") : "-";
}

function formatDateTime(value: Date | null) {
  if (!value) return "-";
  return formatTanggalWaktuJakarta(value);
}

function formatDateInputValue(value: Date | null) {
  if (!value) return getTodayIsoInJakarta();
  return getTodayIsoInJakarta(new Date(value));
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-");
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "-";
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Gagal membaca file."));
    };
    reader.onerror = () => reject(new Error("Gagal membaca file."));
    reader.readAsDataURL(file);
  });
}

async function buildLogoDataUrl(logoUrl: string) {
  const response = await fetch(logoUrl);
  if (!response.ok) throw new Error("Logo tidak dapat dimuat.");
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Logo tidak dapat dibaca."));
    };
    reader.onerror = () => reject(new Error("Logo tidak dapat dibaca."));
    reader.readAsDataURL(blob);
  });
}

async function buildLogoImage(logoUrl: string) {
  const dataUrl = await buildLogoDataUrl(logoUrl);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Logo tidak dapat diproses."));
    img.src = dataUrl;
  });
  return { dataUrl, image };
}

export function HonorariumBatchDetail({
  initialData,
  initialDeductions,
  initialPaymentProofs,
  canManage,
  isAdmin,
  canProcess = false,
  canPay = false,
  systemIdentity,
}: HonorariumBatchDetailProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const { batch, items, recaps, auditLogs } = initialData;

  const [paidDate, setPaidDate] = useState(getTodayIsoInJakarta());
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [editPaidDate, setEditPaidDate] = useState(
    formatDateInputValue(batch.paidAt),
  );
  const [editPaymentReference, setEditPaymentReference] = useState(
    initialData.reconciliation.paymentReference ?? "",
  );
  const [editPaymentAmount, setEditPaymentAmount] = useState(
    initialData.reconciliation.paymentAmount === null
      ? ""
      : String(initialData.reconciliation.paymentAmount),
  );
  const [editPaymentReason, setEditPaymentReason] = useState("");

  const [deductions, setDeductions] =
    useState<DeductionRow[]>(initialDeductions);
  const [paymentProofs, setPaymentProofs] =
    useState<HonorariumPaymentProofRow[]>(initialPaymentProofs);
  const [selectedProofFile, setSelectedProofFile] = useState<File | null>(null);
  const [newDeductionInstructor, setNewDeductionInstructor] = useState("");
  const [newDeductionType, setNewDeductionType] = useState("pph21");
  const [newDeductionDesc, setNewDeductionDesc] = useState("");
  const [newDeductionAmount, setNewDeductionAmount] = useState("");

  const [reopenReason, setReopenReason] = useState("");

  const uniqueInstructors = Array.from(
    new Map(recaps.map((r) => [r.instructorId, r.instructorName])),
    ([id, name]) => ({ id, name }),
  );

  function openEditPayment() {
    setEditPaidDate(formatDateInputValue(batch.paidAt));
    setEditPaymentReference(initialData.reconciliation.paymentReference ?? "");
    setEditPaymentAmount(
      initialData.reconciliation.paymentAmount === null
        ? ""
        : String(initialData.reconciliation.paymentAmount),
    );
    setEditPaymentReason("");
    setIsEditingPayment(true);
  }

  function handleSubmitToFinance() {
    if (!confirm("Kirim batch ini ke keuangan?")) return;
    startTransition(async () => {
      try {
        await submitHonorariumBatchToFinance(batch.id);
        toast.success("Batch dikirim ke keuangan.");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal kirim ke keuangan.",
        );
      }
    });
  }

  function handleMarkInProcess() {
    startTransition(async () => {
      try {
        await markHonorariumBatchInProcess(batch.id);
        toast.success("Status batch menjadi diproses keuangan.");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal update status batch.",
        );
      }
    });
  }

  function handleMarkPaid() {
    if (!paymentReference.trim()) {
      toast.error("Referensi transfer wajib diisi.");
      return;
    }
    const parsedAmount = Number.parseFloat(paymentAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Nominal pembayaran wajib diisi dan harus lebih dari 0.");
      return;
    }

    startTransition(async () => {
      try {
        await markHonorariumBatchPaid({
          batchId: batch.id,
          paidDate: paidDate || undefined,
          paymentReference: paymentReference.trim(),
          paymentAmount: parsedAmount,
        });
        toast.success("Batch ditandai sudah dibayar.");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal menandai batch dibayar.",
        );
      }
    });
  }

  function handleCorrectPayment() {
    if (!editPaymentReference.trim()) {
      toast.error("Referensi transfer wajib diisi.");
      return;
    }
    const parsedAmount = Number.parseFloat(editPaymentAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Nominal pembayaran wajib diisi dan harus lebih dari 0.");
      return;
    }
    if (!editPaymentReason.trim()) {
      toast.error("Alasan koreksi wajib diisi.");
      return;
    }

    startTransition(async () => {
      try {
        await correctHonorariumBatchPayment({
          batchId: batch.id,
          paidDate: editPaidDate || undefined,
          paymentReference: editPaymentReference.trim(),
          paymentAmount: parsedAmount,
          reason: editPaymentReason.trim(),
        });
        toast.success("Data pembayaran berhasil dikoreksi.");
        setIsEditingPayment(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal koreksi pembayaran.",
        );
      }
    });
  }

  function handleLockBatch() {
    if (!confirm("Lock batch ini? Setelah lock, batch dianggap final.")) return;
    startTransition(async () => {
      try {
        await lockHonorariumBatch(batch.id);
        toast.success("Batch berhasil di-lock.");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal lock batch.",
        );
      }
    });
  }

  function handleReopen() {
    if (!reopenReason.trim()) {
      toast.error("Alasan reopen wajib diisi.");
      return;
    }
    if (!confirm("Reopen batch ini? Batch akan kembali ke status draft."))
      return;
    startTransition(async () => {
      try {
        await reopenHonorariumBatch({
          batchId: batch.id,
          reason: reopenReason.trim(),
        });
        toast.success("Batch berhasil di-reopen.");
        setReopenReason("");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal reopen batch.",
        );
      }
    });
  }

  function handleAddDeduction() {
    if (!newDeductionInstructor || !newDeductionDesc || !newDeductionAmount) {
      toast.error("Lengkapi semua field potongan.");
      return;
    }
    const amount = Number.parseFloat(newDeductionAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Jumlah potongan harus angka positif.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await addHonorariumDeduction({
          batchId: batch.id,
          instructorId: newDeductionInstructor,
          deductionType: newDeductionType as "pph21" | "pph23" | "other",
          description: newDeductionDesc.trim(),
          amount,
        });
        if (result.ok) {
          toast.success("Potongan berhasil ditambahkan.");
          setNewDeductionInstructor("");
          setNewDeductionType("pph21");
          setNewDeductionDesc("");
          setNewDeductionAmount("");
          router.refresh();
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal tambah potongan.",
        );
      }
    });
  }

  function handleRemoveDeduction(deductionId: string) {
    if (!confirm("Hapus potongan ini?")) return;
    startTransition(async () => {
      try {
        await removeHonorariumDeduction({ deductionId });
        toast.success("Potongan berhasil dihapus.");
        setDeductions((prev) => prev.filter((d) => d.id !== deductionId));
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal hapus potongan.",
        );
      }
    });
  }

  function handleExportExcel() {
    startTransition(async () => {
      try {
        const result = await exportHonorariumBatchExcel(batch.id);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        const binaryStr = atob(result.data.xlsxBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.data.fileName;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Excel berhasil diekspor.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal export Excel.",
        );
      }
    });
  }

  function handleExportPdf() {
    startTransition(async () => {
      try {
        const { default: jsPDF } = await import("jspdf");
        const { default: autoTable } = await import("jspdf-autotable");

        const doc = new jsPDF({
          orientation: "landscape",
          unit: "mm",
          format: "a4",
        });
        const pageWidth = doc.internal.pageSize.getWidth();
        const exportedAt = new Date();
        const totalNet = deductionSummary.reduce(
          (sum, row) => sum + row.netAmount,
          0,
        );

        let currentY = 10;

        if (systemIdentity?.logoUrl) {
          try {
            const { dataUrl, image } = await buildLogoImage(
              systemIdentity.logoUrl,
            );
            const maxWidth = 34;
            const maxHeight = 28;
            const ratio = Math.min(
              maxWidth / image.width,
              maxHeight / image.height,
              1,
            );
            const width = image.width * ratio;
            const height = image.height * ratio;
            doc.addImage(
              dataUrl,
              "PNG",
              (pageWidth - width) / 2,
              currentY,
              width,
              height,
            );
            currentY += height + 5;
          } catch {
            // Logo opsional
          }
        }

        doc.setFontSize(14);
        doc.text("LAPORAN HONORARIUM INTERNAL", pageWidth / 2, currentY, {
          align: "center",
        });
        currentY += 7;

        doc.setFontSize(9);
        doc.text(`Nomor Dokumen: ${batch.documentNumber}`, 14, currentY);
        doc.text(`Total Sesi: ${batch.itemCount}`, 110, currentY);
        currentY += 5;
        doc.text(
          `Periode: ${batch.periodStart} s.d. ${batch.periodEnd}`,
          14,
          currentY,
        );
        doc.text(
          `Total Gross: ${formatCurrency(batch.totalAmount)}`,
          110,
          currentY,
        );
        currentY += 5;
        doc.text(`Status: ${statusLabel(batch.status)}`, 14, currentY);
        doc.text(`Total Net: ${formatCurrency(totalNet)}`, 110, currentY);
        doc.text(
          `Diekspor: ${formatTanggalWaktuJakarta(exportedAt)}`,
          220,
          currentY,
        );
        currentY += 6;

        autoTable(doc, {
          startY: currentY,
          head: [["Instruktur", "Total Sesi", "Gross", "Deductions", "Net"]],
          body: deductionSummary.map((recap) => [
            recap.instructorName,
            String(recap.totalSessions),
            formatCurrency(recap.grossAmount),
            recap.totalDeduction > 0
              ? formatCurrency(recap.totalDeduction)
              : "-",
            formatCurrency(recap.netAmount),
          ]),
          theme: "grid",
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
          columnStyles: {
            1: { halign: "right", cellWidth: 24 },
            2: { halign: "right", cellWidth: 30 },
            3: { halign: "right", cellWidth: 30 },
            4: { halign: "right", cellWidth: 30 },
          },
        });

        autoTable(doc, {
          startY:
            ((doc as unknown as { lastAutoTable?: { finalY?: number } })
              .lastAutoTable?.finalY ?? 36) + 8,
          head: [["Instruktur", "Tipe", "Keterangan", "Jumlah"]],
          body:
            deductions.length > 0
              ? deductions.map((d) => [
                  d.instructorName,
                  d.deductionType === "pph21"
                    ? "PPh 21"
                    : d.deductionType === "pph23"
                      ? "PPh 23"
                      : "Lainnya",
                  d.description,
                  formatCurrency(d.amount),
                ])
              : [["-", "-", "Tidak ada potongan", "-"]],
          theme: "grid",
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
          columnStyles: {
            3: { halign: "right", cellWidth: 32 },
          },
        });

        autoTable(doc, {
          startY:
            ((doc as unknown as { lastAutoTable?: { finalY?: number } })
              .lastAutoTable?.finalY ?? 36) + 8,
          head: [
            [
              "Tanggal",
              "Program",
              "Instruktur",
              "Sumber",
              "Materi",
              "Level",
              "Rate",
              "Amount",
            ],
          ],
          body: items.map((item) => [
            item.scheduledDate,
            item.programName,
            item.paidInstructorName,
            sourceLabel(item.source),
            item.materiBlock,
            item.expertiseLevelSnapshot,
            formatCurrency(item.rateSnapshot),
            formatCurrency(item.amount),
          ]),
          theme: "grid",
          styles: { fontSize: 7.5, cellPadding: 1.8 },
          headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
          columnStyles: {
            0: { cellWidth: 22 },
            1: { cellWidth: 28 },
            2: { cellWidth: 35 },
            3: { cellWidth: 16 },
            4: { cellWidth: 52 },
            5: { cellWidth: 16 },
            6: { cellWidth: 22, halign: "right" },
            7: { cellWidth: 22, halign: "right" },
          },
        });

        const fileName = sanitizeFileName(
          `honorarium-${batch.documentNumber.toLowerCase()}-${batch.periodStart}-${batch.periodEnd}.pdf`,
        );
        doc.save(fileName);
        await logHonorariumBatchPdfExport({ batchId: batch.id, fileName });
        toast.success("PDF berhasil diekspor.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal export PDF.",
        );
      }
    });
  }

  function handleUploadPaymentProof() {
    if (!selectedProofFile) {
      toast.error("Pilih file bukti pembayaran terlebih dahulu.");
      return;
    }

    startTransition(async () => {
      try {
        const dataUrl = await fileToDataUrl(selectedProofFile);
        const result = await uploadHonorariumPaymentProof({
          batchId: batch.id,
          fileName: selectedProofFile.name,
          contentType: selectedProofFile.type || "application/octet-stream",
          dataUrl,
        });

        if (result.ok) {
          setPaymentProofs((prev) => [
            {
              id: result.data.id,
              fileName: result.data.fileName,
              fileUrl: result.data.fileUrl,
              fileSize: result.data.fileSize,
              mimeType: result.data.mimeType,
              uploadedBy: "current-user",
              uploaderName: "Anda",
              uploadedAt: new Date(),
            },
            ...prev,
          ]);
          setSelectedProofFile(null);
          toast.success("Bukti pembayaran berhasil diupload.");
          router.refresh();
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal upload bukti pembayaran.",
        );
      }
    });
  }

  const deductionSummary = recaps.map((r) => {
    const instrDeductions = deductions.filter(
      (d) => d.instructorId === r.instructorId,
    );
    const totalDeduction = instrDeductions.reduce((s, d) => s + d.amount, 0);
    return { ...r, deductions: instrDeductions, totalDeduction };
  });
  const reconciliation = initialData.reconciliation;
  const reconciliationDiff = reconciliation.difference ?? 0;
  const reconciliationStatus =
    reconciliation.isMatched === null
      ? "Belum ada data pembayaran"
      : reconciliation.isMatched
        ? "Cocok"
        : "Selisih";
  const reconciliationVariant =
    reconciliation.isMatched === null
      ? "secondary"
      : reconciliation.isMatched
        ? "default"
        : "destructive";

  return (
    <div className="space-y-6">
      <Card className="rounded-[28px]">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{batch.documentNumber}</CardTitle>
              <CardDescription>
                Periode {batch.periodStart} s.d. {batch.periodEnd}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant(batch.status)}>
                {statusLabel(batch.status)}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPdf}
                disabled={pending}
              >
                <Download className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={pending}
              >
                <Download className="h-4 w-4 mr-1" />
                Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Jumlah Sesi</p>
              <p className="text-lg font-semibold tabular-nums">
                {batch.itemCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Batch</p>
              <p className="text-lg font-semibold tabular-nums">
                {formatCurrency(batch.totalAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dibuat Oleh</p>
              <p className="font-medium">{batch.generatedByName ?? "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dibayar Oleh</p>
              <p className="font-medium">{batch.paidByName ?? "-"}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Dibuat</p>
              <p className="text-sm">{formatDateTime(batch.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Dikirim ke Keuangan
              </p>
              <p className="text-sm">{formatDateTime(batch.submittedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dibayar</p>
              <p className="text-sm">{formatDateTime(batch.paidAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Locked</p>
              <p className="text-sm">{formatDateTime(batch.lockedAt)}</p>
            </div>
          </div>

          {batch.internalNotes ? (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
              <p className="text-xs text-muted-foreground mb-1">
                Catatan Internal
              </p>
              <p className="text-sm whitespace-pre-wrap">
                {batch.internalNotes}
              </p>
            </div>
          ) : null}

          <div className="rounded-lg border border-border bg-muted/30 px-3 py-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Rekonsiliasi Pembayaran</p>
              <div className="flex items-center gap-2">
                <Badge variant={reconciliationVariant}>
                  {reconciliationStatus}
                </Badge>
                {batch.status === "dibayar" && canPay ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={openEditPayment}
                    disabled={pending}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit Pembayaran
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Net Batch</p>
                <p className="text-sm font-medium tabular-nums">
                  {formatCurrency(reconciliation.netAmount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Nominal Dibayar</p>
                <p className="text-sm font-medium tabular-nums">
                  {reconciliation.paymentAmount === null
                    ? "-"
                    : formatCurrency(reconciliation.paymentAmount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Selisih</p>
                <p
                  className={`text-sm font-medium tabular-nums ${
                    reconciliation.difference === null
                      ? ""
                      : Math.abs(reconciliationDiff) <= 0.01
                        ? "text-emerald-600"
                        : "text-destructive"
                  }`}
                >
                  {reconciliation.difference === null
                    ? "-"
                    : formatCurrency(reconciliationDiff)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Referensi Transfer
                </p>
                <p className="text-sm">
                  {reconciliation.paymentReference ?? "-"}
                </p>
              </div>
            </div>
            {isEditingPayment ? (
              <div className="border-t border-border pt-3">
                <div className="grid gap-3 md:grid-cols-[170px_1fr_170px_1fr_auto_auto] md:items-end">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Tanggal Bayar
                    </p>
                    <Input
                      type="date"
                      value={editPaidDate}
                      onChange={(e) => setEditPaidDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Referensi Transfer
                    </p>
                    <Input
                      value={editPaymentReference}
                      onChange={(e) => setEditPaymentReference(e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Nominal Dibayar
                    </p>
                    <Input
                      type="number"
                      min={0}
                      step="1000"
                      value={editPaymentAmount}
                      onChange={(e) => setEditPaymentAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      Alasan Koreksi
                    </p>
                    <Input
                      placeholder="Contoh: salah input nominal"
                      value={editPaymentReason}
                      onChange={(e) => setEditPaymentReason(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleCorrectPayment} disabled={pending}>
                    Simpan
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditingPayment(false)}
                    disabled={pending}
                  >
                    Batal
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {canManage || canProcess || canPay ? (
        <Card className="rounded-[28px]">
          <CardHeader className="border-b border-border">
            <CardTitle>Aksi Status</CardTitle>
            <CardDescription>
              Transisi status batch honorarium sesuai workflow keuangan.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {batch.status === "draft" && canManage ? (
              <Button onClick={handleSubmitToFinance} disabled={pending}>
                Kirim ke Keuangan
              </Button>
            ) : null}

            {batch.status === "dikirim_ke_keuangan" && canProcess ? (
              <Button onClick={handleMarkInProcess} disabled={pending}>
                Tandai Diproses Keuangan
              </Button>
            ) : null}

            {batch.status === "diproses_keuangan" && canPay ? (
              <div className="grid gap-3 md:grid-cols-[170px_1fr_170px_auto] md:items-end">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Tanggal Bayar
                  </p>
                  <Input
                    type="date"
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Referensi Transfer
                  </p>
                  <Input
                    placeholder="Contoh: TRX-INV-2026-0429"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    Nominal Dibayar
                  </p>
                  <Input
                    type="number"
                    min={0}
                    step="1000"
                    placeholder="Contoh: 25000000"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                </div>
                <Button onClick={handleMarkPaid} disabled={pending}>
                  Tandai Dibayar
                </Button>
              </div>
            ) : null}

            {batch.status === "dibayar" && (canPay || canManage) ? (
              <Button onClick={handleLockBatch} disabled={pending}>
                Lock Batch
              </Button>
            ) : null}

            {batch.status === "locked" ? (
              <p className="text-sm text-muted-foreground">
                Batch sudah final (locked).
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-[28px]">
        <CardHeader className="border-b border-border">
          <CardTitle>Bukti Pembayaran</CardTitle>
          <CardDescription>
            Dokumen bukti transfer dari keuangan. Dapat dilihat oleh pengaju dan keuangan.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {canPay ? (
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Upload Bukti</p>
                <Input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => setSelectedProofFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Format disarankan PDF/JPG/PNG/WEBP.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleUploadPaymentProof}
                disabled={pending || !selectedProofFile}
              >
                <Upload className="h-4 w-4 mr-1" />
                Upload Bukti
              </Button>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Nama File
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Tipe
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                    Ukuran
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Diupload Oleh
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Waktu Upload
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {paymentProofs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                      Belum ada bukti pembayaran.
                    </td>
                  </tr>
                ) : (
                  paymentProofs.map((proof) => (
                    <tr key={proof.id} className="border-b border-border">
                      <td className="px-3 py-2">{proof.fileName}</td>
                      <td className="px-3 py-2">{proof.mimeType}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatFileSize(proof.fileSize)}
                      </td>
                      <td className="px-3 py-2">{proof.uploaderName ?? "-"}</td>
                      <td className="px-3 py-2">
                        {formatTanggalWaktuJakarta(proof.uploadedAt)}
                      </td>
                      <td className="px-3 py-2">
                        <Button asChild variant="outline" size="sm">
                          <a href={proof.fileUrl} target="_blank" rel="noreferrer">
                            Buka
                          </a>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Reopen Section - Hanya admin */}
      {isAdmin && batch.status !== "draft" ? (
        <Card className="rounded-[28px] border-destructive/30">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Reopen Batch
            </CardTitle>
            <CardDescription>
              Kembalikan batch ke status draft. Hanya untuk admin. Alasan wajib
              diisi.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Alasan Reopen
                </p>
                <Input
                  placeholder="Wajib: jelaskan alasan reopen batch ini..."
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                />
              </div>
              <Button
                variant="destructive"
                onClick={handleReopen}
                disabled={pending || !reopenReason.trim()}
              >
                Reopen Batch
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-[28px]">
        <CardHeader className="border-b border-border">
          <CardTitle>Rekap Instruktur</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                    Instruktur
                  </th>
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                    Sesi
                  </th>
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                    Gross
                  </th>
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                    Deductions
                  </th>
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                    Net
                  </th>
                </tr>
              </thead>
              <tbody>
                {deductionSummary.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-8 text-center text-muted-foreground"
                    >
                      Belum ada rekap.
                    </td>
                  </tr>
                ) : (
                  deductionSummary.map((recap) => (
                    <tr
                      key={recap.instructorId}
                      className="border-b border-border hover:bg-muted/50"
                    >
                      <td className="px-6 py-3">{recap.instructorName}</td>
                      <td className="px-6 py-3 text-right tabular-nums">
                        {recap.totalSessions}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums">
                        {formatCurrency(recap.grossAmount)}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-destructive">
                        {recap.totalDeduction > 0
                          ? `(${formatCurrency(recap.totalDeduction)})`
                          : "-"}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums font-medium">
                        {formatCurrency(recap.netAmount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Deductions Card */}
      <Card className="rounded-[28px]">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Potongan (Deductions)</CardTitle>
              <CardDescription>
                PPh 21, PPh 23, atau potongan lainnya per instruktur.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                    Instruktur
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                    Tipe
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                    Keterangan
                  </th>
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                    Jumlah
                  </th>
                  {canManage && batch.status === "draft" ? (
                    <th className="px-6 py-3 text-center font-medium text-muted-foreground">
                      Aksi
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {deductions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canManage && batch.status === "draft" ? 5 : 4}
                      className="px-6 py-8 text-center text-muted-foreground"
                    >
                      Belum ada potongan.
                    </td>
                  </tr>
                ) : (
                  deductions.map((d) => (
                    <tr
                      key={d.id}
                      className="border-b border-border hover:bg-muted/50"
                    >
                      <td className="px-6 py-3">{d.instructorName}</td>
                      <td className="px-6 py-3">
                        <Badge variant="outline">
                          {d.deductionType === "pph21"
                            ? "PPh 21"
                            : d.deductionType === "pph23"
                              ? "PPh 23"
                              : "Lainnya"}
                        </Badge>
                      </td>
                      <td className="px-6 py-3">{d.description}</td>
                      <td className="px-6 py-3 text-right tabular-nums text-destructive">
                        {formatCurrency(d.amount)}
                      </td>
                      {canManage && batch.status === "draft" ? (
                        <td className="px-6 py-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveDeduction(d.id)}
                            disabled={pending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
        {canManage && batch.status === "draft" ? (
          <CardFooter className="border-t border-border px-6 py-4">
            <div className="grid gap-3 w-full md:grid-cols-[200px_130px_1fr_130px_auto] md:items-end">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Instruktur</p>
                <Select
                  value={newDeductionInstructor}
                  onValueChange={setNewDeductionInstructor}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih instruktur" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueInstructors.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Tipe</p>
                <Select
                  value={newDeductionType}
                  onValueChange={setNewDeductionType}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pph21">PPh 21</SelectItem>
                    <SelectItem value="pph23">PPh 23</SelectItem>
                    <SelectItem value="other">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Keterangan</p>
                <Input
                  placeholder="Misal: PPh 21 atas honor"
                  value={newDeductionDesc}
                  onChange={(e) => setNewDeductionDesc(e.target.value)}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Jumlah (Rp)
                </p>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={newDeductionAmount}
                  onChange={(e) => setNewDeductionAmount(e.target.value)}
                />
              </div>
              <Button onClick={handleAddDeduction} disabled={pending} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Tambah
              </Button>
            </div>
          </CardFooter>
        ) : null}
      </Card>

      <Card className="rounded-[28px]">
        <CardHeader className="border-b border-border">
          <CardTitle>Detail Item Sesi</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                    Tanggal
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                    Program
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                    Instruktur
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                    Sumber
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                    Materi
                  </th>
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                    Rate
                  </th>
                  <th className="px-6 py-3 text-right font-medium text-muted-foreground">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-muted-foreground"
                    >
                      Tidak ada item batch.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-border hover:bg-muted/50"
                    >
                      <td className="px-6 py-3">{item.scheduledDate}</td>
                      <td className="px-6 py-3">{item.programName}</td>
                      <td className="px-6 py-3">{item.paidInstructorName}</td>
                      <td className="px-6 py-3">
                        <Badge
                          variant={
                            item.source === "actual" ? "outline" : "secondary"
                          }
                        >
                          {sourceLabel(item.source)}
                        </Badge>
                      </td>
                      <td className="px-6 py-3">{item.materiBlock}</td>
                      <td className="px-6 py-3 text-right tabular-nums">
                        {formatCurrency(item.rateSnapshot)}
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums">
                        {formatCurrency(item.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[28px]">
        <CardHeader className="border-b border-border">
          <CardTitle>Audit Trail</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                    Waktu
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                    Aktor
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                    Aksi
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-muted-foreground">
                    Payload
                  </th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-6 py-8 text-center text-muted-foreground"
                    >
                      Belum ada audit log.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-border hover:bg-muted/50"
                    >
                      <td className="px-6 py-3">
                        {formatTanggalWaktuJakarta(log.createdAt)}
                      </td>
                      <td className="px-6 py-3">{log.actorName}</td>
                      <td className="px-6 py-3">
                        <Badge variant="outline">
                          {actionLabel(log.action)}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-xs text-muted-foreground">
                        {payloadSummary(log.payload)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
