"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
  sendHonorariumReminderToFinance,
  sendHonorariumReminderWhatsappDirect,
  type getHonorariumBatchDetail,
  type DeductionRow,
  type HonorariumPaymentProofRow,
} from "@/server/actions/jadwal-otomatis/honorarium";
import { formatTanggalWaktuJakarta, getTodayIsoInJakarta } from "@/lib/utils";
import { PelatihanBatchHeader } from "./batch-detail/PelatihanBatchHeader";
import { PelatihanBatchActions } from "./batch-detail/PelatihanBatchActions";
import { PelatihanBatchDeductions } from "./batch-detail/PelatihanBatchDeductions";
import { PelatihanBatchPaymentProofs } from "./batch-detail/PelatihanBatchPaymentProofs";
import { BatchStatusStepper } from "@/components/keuangan/batch-detail/BatchStatusStepper";
import { BatchReconciliation } from "@/components/keuangan/batch-detail/BatchReconciliation";
import { BatchInstructorRecap } from "@/components/keuangan/batch-detail/BatchInstructorRecap";
import { BatchSessionItems } from "@/components/keuangan/batch-detail/BatchSessionItems";
import { BatchAuditTrail } from "@/components/keuangan/batch-detail/BatchAuditTrail";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type DetailData = NonNullable<Awaited<ReturnType<typeof getHonorariumBatchDetail>>>;

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

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-");
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Gagal membaca file.")); };
    reader.onerror = () => reject(new Error("Gagal membaca file."));
    reader.readAsDataURL(file);
  });
}

async function buildLogoImage(logoUrl: string) {
  const res = await fetch(logoUrl);
  if (!res.ok) throw new Error("Logo tidak dapat dimuat.");
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => { typeof r.result === "string" ? resolve(r.result) : reject(new Error("Logo tidak dapat dibaca.")); };
    r.onerror = () => reject(new Error("Logo tidak dapat dibaca."));
    r.readAsDataURL(blob);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Logo tidak dapat diproses."));
    img.src = dataUrl;
  });
  return { dataUrl, image };
}

export function HonorariumBatchDetail({ initialData, initialDeductions, initialPaymentProofs, canManage, isAdmin, canProcess = false, canPay = false, systemIdentity }: HonorariumBatchDetailProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { batch, items, recaps, auditLogs } = initialData;

  const [paidDate, setPaidDate] = useState(getTodayIsoInJakarta());
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [editPaidDate, setEditPaidDate] = useState(batch.paidAt ? getTodayIsoInJakarta(new Date(batch.paidAt)) : getTodayIsoInJakarta());
  const [editPaymentReference, setEditPaymentReference] = useState(initialData.reconciliation.paymentReference ?? "");
  const [editPaymentAmount, setEditPaymentAmount] = useState(initialData.reconciliation.paymentAmount === null ? "" : String(initialData.reconciliation.paymentAmount));
  const [editPaymentReason, setEditPaymentReason] = useState("");
  const [deductions, setDeductions] = useState<DeductionRow[]>(initialDeductions);
  const [paymentProofs, setPaymentProofs] = useState<HonorariumPaymentProofRow[]>(initialPaymentProofs);
  const [reopenReason, setReopenReason] = useState("");

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    destructive?: boolean;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });

  const showConfirm = useCallback((opts: { title: string; description: string; onConfirm: () => void; destructive?: boolean }) => {
    setConfirmDialog({ open: true, ...opts });
  }, []);

  // WhatsApp preview dialog state
  const [waPreview, setWaPreview] = useState<{
    open: boolean;
    message: string;
    recipientName: string;
    recipientPhone: string;
    waLink: string;
  }>({ open: false, message: "", recipientName: "", recipientPhone: "", waLink: "" });

  const uniqueInstructors = Array.from(new Map(recaps.map((r) => [r.instructorId, r.instructorName])), ([id, name]) => ({ id, name }));
  const deductionSummary = recaps.map((r) => {
    const instrDeductions = deductions.filter((d) => d.instructorId === r.instructorId);
    const totalDeduction = instrDeductions.reduce((s, d) => s + d.amount, 0);
    return { ...r, deductions: instrDeductions, totalDeduction };
  });
  const totalNet = deductionSummary.reduce((sum, row) => sum + row.netAmount, 0);

  function openEditPayment() {
    setEditPaidDate(batch.paidAt ? getTodayIsoInJakarta(new Date(batch.paidAt)) : getTodayIsoInJakarta());
    setEditPaymentReference(initialData.reconciliation.paymentReference ?? "");
    setEditPaymentAmount(initialData.reconciliation.paymentAmount === null ? "" : String(initialData.reconciliation.paymentAmount));
    setEditPaymentReason("");
    setIsEditingPayment(true);
  }

  function handleSubmitToFinance() {
    showConfirm({
      title: "Kirim ke Keuangan",
      description: "Kirim batch ini ke keuangan?",
      onConfirm: () => {
        startTransition(async () => { try { await submitHonorariumBatchToFinance(batch.id); toast.success("Batch dikirim ke keuangan."); router.refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal kirim ke keuangan."); } });
      },
    });
  }
  function handleMarkInProcess() {
    startTransition(async () => { try { await markHonorariumBatchInProcess(batch.id); toast.success("Status batch menjadi diproses keuangan."); router.refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal update status batch."); } });
  }
  function handleMarkPaid() {
    if (!paymentReference.trim()) { toast.error("Referensi transfer wajib diisi."); return; }
    const parsed = Number.parseFloat(paymentAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) { toast.error("Nominal pembayaran wajib diisi dan harus lebih dari 0."); return; }
    startTransition(async () => { try { await markHonorariumBatchPaid({ batchId: batch.id, paidDate: paidDate || undefined, paymentReference: paymentReference.trim(), paymentAmount: parsed }); toast.success("Batch ditandai sudah dibayar."); router.refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal menandai batch dibayar."); } });
  }
  function handleCorrectPayment() {
    if (!editPaymentReference.trim()) { toast.error("Referensi transfer wajib diisi."); return; }
    const parsed = Number.parseFloat(editPaymentAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) { toast.error("Nominal pembayaran wajib diisi dan harus lebih dari 0."); return; }
    if (!editPaymentReason.trim()) { toast.error("Alasan koreksi wajib diisi."); return; }
    startTransition(async () => { try { await correctHonorariumBatchPayment({ batchId: batch.id, paidDate: editPaidDate || undefined, paymentReference: editPaymentReference.trim(), paymentAmount: parsed, reason: editPaymentReason.trim() }); toast.success("Data pembayaran berhasil dikoreksi."); setIsEditingPayment(false); router.refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal koreksi pembayaran."); } });
  }
  function handleLockBatch() {
    showConfirm({
      title: "Lock Batch",
      description: "Lock batch ini? Setelah lock, batch dianggap final.",
      onConfirm: () => {
        startTransition(async () => { try { await lockHonorariumBatch(batch.id); toast.success("Batch berhasil di-lock."); router.refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal lock batch."); } });
      },
    });
  }
  function handleReopen() {
    if (!reopenReason.trim()) { toast.error("Alasan reopen wajib diisi."); return; }
    showConfirm({
      title: "Reopen Batch",
      description: "Reopen batch ini? Batch akan kembali ke status draft.",
      destructive: true,
      onConfirm: () => {
        startTransition(async () => { try { await reopenHonorariumBatch({ batchId: batch.id, reason: reopenReason.trim() }); toast.success("Batch berhasil di-reopen."); setReopenReason(""); router.refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal reopen batch."); } });
      },
    });
  }
  function handleAddDeduction(data: { instructorId: string; deductionType: "pph21" | "pph23" | "other"; description: string; amount: number }) {
    startTransition(async () => { try { const result = await addHonorariumDeduction({ batchId: batch.id, ...data }); if (result.ok) { toast.success("Potongan berhasil ditambahkan."); router.refresh(); } } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal tambah potongan."); } });
  }
  function handleRemoveDeduction(deductionId: string) {
    showConfirm({
      title: "Hapus Potongan",
      description: "Hapus potongan ini?",
      destructive: true,
      onConfirm: () => {
        startTransition(async () => { try { await removeHonorariumDeduction({ deductionId }); toast.success("Potongan berhasil dihapus."); setDeductions((prev) => prev.filter((d) => d.id !== deductionId)); router.refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal hapus potongan."); } });
      },
    });
  }

  function handleSendReminder(channels: ("whatsapp" | "email")[]) {
    startTransition(async () => {
      try {
        const result = await sendHonorariumReminderToFinance({ batchId: batch.id, channels });
        const failedChannels = result.results.filter((r) => !r.ok);
        const successChannels = result.results.filter((r) => r.ok);

        // Show WhatsApp preview dialog if WA was requested
        const waResult = result.results.find((r) => r.channel === "whatsapp" && r.ok && r.waLink);
        if (waResult && "waLink" in waResult && waResult.waLink) {
          setWaPreview({
            open: true,
            message: waResult.message ?? "",
            recipientName: waResult.recipientName ?? "Tim Keuangan",
            recipientPhone: waResult.recipientPhone ?? "",
            waLink: waResult.waLink,
          });
        }

        // Show toast for email result
        const emailResult = result.results.find((r) => r.channel === "email");
        if (emailResult) {
          if (emailResult.ok) {
            toast.success("Email reminder berhasil dikirim.");
          } else if (emailResult.error) {
            toast.error(`Email: ${emailResult.error}`);
          }
        }

        // Show error for WA if failed
        const waFailed = result.results.find((r) => r.channel === "whatsapp" && !r.ok);
        if (waFailed && waFailed.error) {
          toast.error(`WhatsApp: ${waFailed.error}`);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal kirim reminder.");
      }
    });
  }

  function handleWaSendDirect() {
    startTransition(async () => {
      try {
        const result = await sendHonorariumReminderWhatsappDirect({
          batchId: batch.id,
          recipientPhone: waPreview.recipientPhone,
          message: waPreview.message,
        });
        if (result.ok) {
          toast.success("Pesan WA berhasil dikirim via Bot.");
          setWaPreview((prev) => ({ ...prev, open: false }));
        } else {
          toast.error(result.error ?? "Gagal kirim WA via Bot.");
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal kirim WA.");
      }
    });
  }

  function handleWaOpenLink() {
    if (waPreview.waLink) {
      window.open(waPreview.waLink, "_blank");
    }
    setWaPreview((prev) => ({ ...prev, open: false }));
  }

  function handleExportExcel() {
    startTransition(async () => {
      try {
        const result = await exportHonorariumBatchExcel(batch.id);
        if (!result.ok) { toast.error(result.error); return; }
        const binaryStr = atob(result.data.xlsxBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = result.data.fileName; a.click();
        URL.revokeObjectURL(url);
        toast.success("Excel berhasil diekspor.");
      } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal export Excel."); }
    });
  }

  function handleExportPdf() {
    startTransition(async () => {
      try {
        const { default: jsPDF } = await import("jspdf");
        const { default: autoTable } = await import("jspdf-autotable");
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const exportedAt = new Date();
        const margin = 14;
        let currentY = 10;

        // --- Color palette ---
        const primaryColor: [number, number, number] = [30, 64, 175]; // deep blue
        const accentColor: [number, number, number] = [5, 150, 105]; // emerald
        const warmColor: [number, number, number] = [234, 88, 12]; // orange for highlights
        const lightBg: [number, number, number] = [241, 245, 249]; // slate-100
        const darkText: [number, number, number] = [15, 23, 42]; // slate-900
        const mutedText: [number, number, number] = [100, 116, 139]; // slate-500

        // --- Header (Logo centered, title centered below) ---
        if (systemIdentity?.logoUrl) {
          try {
            const { dataUrl, image } = await buildLogoImage(systemIdentity.logoUrl);
            const maxW = 28, maxH = 22;
            const ratio = Math.min(maxW / image.width, maxH / image.height, 1);
            const logoW = image.width * ratio;
            const logoH = image.height * ratio;
            doc.addImage(dataUrl, "PNG", (pageWidth - logoW) / 2, currentY, logoW, logoH);
            currentY += logoH + 3;
          } catch { /* Logo opsional */ }
        }

        // Title centered
        doc.setTextColor(...darkText);
        doc.setFontSize(15);
        doc.setFont("helvetica", "bold");
        doc.text("LAPORAN HONORARIUM INTERNAL", pageWidth / 2, currentY + 6, { align: "center" });

        // Export date aligned right
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...mutedText);
        doc.text(`Diekspor: ${formatTanggalWaktuJakarta(exportedAt)}`, pageWidth - margin, currentY + 6, { align: "right" });

        currentY += 24;

        // Separator line: thin gradient-like double line
        doc.setDrawColor(...primaryColor);
        doc.setLineWidth(0.8);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        doc.setDrawColor(226, 232, 240); // lighter line below
        doc.setLineWidth(0.3);
        doc.line(margin, currentY + 1.5, pageWidth - margin, currentY + 1.5);

        currentY += 7;

        // --- Document Info Section ---
        doc.setTextColor(...darkText);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("INFORMASI DOKUMEN", margin, currentY);
        currentY += 2;
        doc.setDrawColor(...primaryColor);
        doc.setLineWidth(0.5);
        doc.line(margin, currentY, margin + 52, currentY);
        currentY += 5;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        const infoCol1X = margin;
        const infoCol2X = 85;
        const infoCol3X = 170;

        doc.setTextColor(...mutedText);
        doc.text("No. Dokumen", infoCol1X, currentY);
        doc.text("Periode", infoCol2X, currentY);
        doc.text("Status", infoCol3X, currentY);
        currentY += 4.5;
        doc.setTextColor(...darkText);
        doc.setFont("helvetica", "bold");
        doc.text(batch.documentNumber, infoCol1X, currentY);
        doc.setFont("helvetica", "normal");
        doc.text(`${batch.periodStart} s.d. ${batch.periodEnd}`, infoCol2X, currentY);
        // Status badge
        const statusText = batch.status === "locked" ? "LOCKED" : batch.status === "dibayar" ? "DIBAYAR" : batch.status === "diproses_keuangan" ? "DIPROSES" : batch.status === "dikirim_ke_keuangan" ? "DIKIRIM" : "DRAFT";
        const statusBgColor: [number, number, number] = batch.status === "dibayar" || batch.status === "locked" ? accentColor : batch.status === "draft" ? mutedText : primaryColor;
        const stWidth = doc.getTextWidth(statusText) + 5;
        doc.setFillColor(...statusBgColor);
        doc.roundedRect(infoCol3X, currentY - 3.2, stWidth, 4.5, 1, 1, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text(statusText, infoCol3X + 2.5, currentY);
        doc.setTextColor(...darkText);

        currentY += 8;

        // --- Summary Cards (styled boxes) ---
        const cardWidth = (pageWidth - margin * 2 - 12) / 4;
        const cardHeight = 16;
        const cardY = currentY;
        const totalDeductionsAmount = deductionSummary.reduce((s, r) => s + r.totalDeduction, 0);
        const summaryCards = [
          { label: "Total Sesi", value: String(batch.itemCount), color: primaryColor },
          { label: "Total Gross", value: formatCurrency(batch.totalAmount), color: primaryColor },
          { label: "Total Potongan", value: totalDeductionsAmount > 0 ? formatCurrency(totalDeductionsAmount) : "-", color: warmColor },
          { label: "Total Net (Dibayar)", value: formatCurrency(totalNet), color: accentColor },
        ];

        summaryCards.forEach((card, i) => {
          const cardX = margin + i * (cardWidth + 4);
          // Card background
          doc.setFillColor(...lightBg);
          doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 2, 2, "F");
          // Left accent bar
          doc.setFillColor(...card.color);
          doc.rect(cardX, cardY + 2, 1.2, cardHeight - 4, "F");
          // Label
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...mutedText);
          doc.text(card.label, cardX + 5, cardY + 5.5);
          // Value
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...card.color);
          doc.text(card.value, cardX + 5, cardY + 12);
        });

        currentY = cardY + cardHeight + 8;

        // --- Rekap Per Instruktur ---
        doc.setTextColor(...darkText);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("REKAP PER INSTRUKTUR", margin, currentY);
        currentY += 2;
        doc.setDrawColor(...primaryColor);
        doc.line(margin, currentY, margin + 44, currentY);
        currentY += 3;

        autoTable(doc, {
          startY: currentY,
          head: [["No", "Instruktur", "Jumlah Sesi", "Gross", "Potongan", "Net"]],
          body: deductionSummary.map((r, idx) => [
            String(idx + 1),
            r.instructorName,
            String(r.totalSessions),
            formatCurrency(r.grossAmount),
            r.totalDeduction > 0 ? `(${formatCurrency(r.totalDeduction)})` : "-",
            formatCurrency(r.netAmount),
          ]),
          foot: [[
            "", "TOTAL", String(batch.itemCount),
            formatCurrency(batch.totalAmount),
            totalDeductionsAmount > 0 ? `(${formatCurrency(totalDeductionsAmount)})` : "-",
            formatCurrency(totalNet),
          ]],
          theme: "striped",
          styles: { fontSize: 8, cellPadding: 2.5, lineColor: [226, 232, 240], lineWidth: 0.2 },
          headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: "bold", cellPadding: 3 },
          footStyles: { fillColor: [241, 245, 249], textColor: darkText, fontStyle: "bold", cellPadding: 3 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          columnStyles: {
            0: { cellWidth: 12, halign: "center" },
            2: { halign: "center", cellWidth: 24 },
            3: { halign: "right", cellWidth: 32 },
            4: { halign: "right", cellWidth: 32, textColor: warmColor },
            5: { halign: "right", cellWidth: 32, fontStyle: "bold" },
          },
        });

        // --- Rincian Potongan ---
        const afterRecapY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? currentY) + 10;

        if (deductions.length > 0) {
          doc.setTextColor(...darkText);
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.text("RINCIAN POTONGAN", margin, afterRecapY);
          doc.setDrawColor(...warmColor);
          doc.line(margin, afterRecapY + 2, margin + 36, afterRecapY + 2);

          autoTable(doc, {
            startY: afterRecapY + 5,
            head: [["No", "Instruktur", "Tipe Potongan", "Keterangan", "Jumlah"]],
            body: deductions.map((d, idx) => [
              String(idx + 1),
              d.instructorName,
              d.deductionType === "pph21" ? "PPh 21" : d.deductionType === "pph23" ? "PPh 23" : "Lainnya",
              d.description,
              formatCurrency(d.amount),
            ]),
            foot: [["", "", "", "Total Potongan", formatCurrency(totalDeductionsAmount)]],
            theme: "striped",
            styles: { fontSize: 7.5, cellPadding: 2.2, lineColor: [226, 232, 240], lineWidth: 0.2 },
            headStyles: { fillColor: warmColor, textColor: [255, 255, 255], fontStyle: "bold" },
            footStyles: { fillColor: [254, 243, 199], textColor: darkText, fontStyle: "bold" },
            alternateRowStyles: { fillColor: [255, 251, 235] },
            columnStyles: {
              0: { cellWidth: 12, halign: "center" },
              4: { halign: "right", cellWidth: 30 },
            },
          });
        }

        // --- Detail Sesi (new page for clarity) ---
        doc.addPage();

        // Mini header on second page
        doc.setFillColor(...primaryColor);
        doc.rect(0, 0, pageWidth, 12, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("DETAIL SESI PENGAJARAN", pageWidth / 2, 8, { align: "center" });
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(`${batch.documentNumber} | ${batch.periodStart} s.d. ${batch.periodEnd}`, pageWidth / 2, 11, { align: "center" });

        // Group items by instructor for better readability
        const byInstructor = new Map<string, typeof items>();
        for (const item of items) {
          const list = byInstructor.get(item.paidInstructorName) ?? [];
          list.push(item);
          byInstructor.set(item.paidInstructorName, list);
        }

        let detailY = 18;

        for (const [instructorName, instrItems] of byInstructor) {
          const instrTotal = instrItems.reduce((s, it) => s + (typeof it.amount === "number" ? it.amount : Number(it.amount)), 0);

          // Check if we need a new page (leave room for header + at least 2 rows)
          if (detailY > pageHeight - 40) {
            doc.addPage();
            doc.setFillColor(...primaryColor);
            doc.rect(0, 0, pageWidth, 12, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text("DETAIL SESI PENGAJARAN (lanjutan)", pageWidth / 2, 8, { align: "center" });
            detailY = 18;
          }

          // Instructor sub-header
          doc.setFillColor(...lightBg);
          doc.rect(margin, detailY - 3, pageWidth - margin * 2, 6, "F");
          doc.setFillColor(...accentColor);
          doc.rect(margin, detailY - 3, 1.5, 6, "F");
          doc.setTextColor(...darkText);
          doc.setFontSize(8.5);
          doc.setFont("helvetica", "bold");
          doc.text(`${instructorName}`, margin + 5, detailY);
          doc.setTextColor(...mutedText);
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "normal");
          doc.text(`${instrItems.length} sesi | Total: ${formatCurrency(instrTotal)}`, pageWidth - margin, detailY, { align: "right" });
          detailY += 5;

          autoTable(doc, {
            startY: detailY,
            head: [["No", "Tanggal", "Program", "Materi", "Level", "Sumber", "Rate/Sesi", "Amount"]],
            body: instrItems.map((item, idx) => [
              String(idx + 1),
              item.scheduledDate,
              item.programName,
              item.materiBlock,
              item.expertiseLevelSnapshot ?? "-",
              item.source === "actual" ? "Substitusi" : "Planned",
              formatCurrency(typeof item.rateSnapshot === "number" ? item.rateSnapshot : Number(item.rateSnapshot)),
              formatCurrency(typeof item.amount === "number" ? item.amount : Number(item.amount)),
            ]),
            foot: [["", "", "", "", "", "", "Subtotal", formatCurrency(instrTotal)]],
            theme: "grid",
            styles: { fontSize: 7.5, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.15 },
            headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: "bold", cellPadding: 2.5 },
            footStyles: { fillColor: [241, 245, 249], textColor: darkText, fontStyle: "bold" },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
              0: { cellWidth: 10, halign: "center" },
              1: { cellWidth: 22 },
              2: { cellWidth: 30 },
              3: { cellWidth: 55 },
              4: { cellWidth: 18, halign: "center" },
              5: { cellWidth: 20, halign: "center" },
              6: { cellWidth: 26, halign: "right" },
              7: { cellWidth: 26, halign: "right", fontStyle: "bold" },
            },
            margin: { left: margin, right: margin },
          });

          detailY = ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? detailY) + 8;
        }

        // --- Footer on all pages ---
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          // Footer line
          doc.setDrawColor(...primaryColor);
          doc.setLineWidth(0.3);
          doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
          // Footer text
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...mutedText);
          doc.text(`${batch.documentNumber} — Periode ${batch.periodStart} s.d. ${batch.periodEnd}`, margin, pageHeight - 6);
          doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: "right" });
        }

        const fileName = sanitizeFileName(`honorarium-${batch.documentNumber.toLowerCase()}-${batch.periodStart}-${batch.periodEnd}.pdf`);
        doc.save(fileName);
        await logHonorariumBatchPdfExport({ batchId: batch.id, fileName });
        toast.success("PDF berhasil diekspor.");
      } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal export PDF."); }
    });
  }

  function handleUploadPaymentProof(file: File) {
    startTransition(async () => {
      try {
        const dataUrl = await fileToDataUrl(file);
        const result = await uploadHonorariumPaymentProof({ batchId: batch.id, fileName: file.name, contentType: file.type || "application/octet-stream", dataUrl });
        if (result.ok) {
          setPaymentProofs((prev) => [{ id: result.data.id, fileName: result.data.fileName, fileUrl: result.data.fileUrl, fileSize: result.data.fileSize, mimeType: result.data.mimeType, uploadedBy: "current-user", uploaderName: "Anda", uploadedAt: new Date() }, ...prev]);
          toast.success("Bukti pembayaran berhasil diunggah.");
          router.refresh();
        }
      } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal upload bukti pembayaran."); }
    });
  }

  const canUploadProof = canPay && ["diproses_keuangan", "dibayar", "locked"].includes(batch.status);

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr] min-w-0">
        <div className="space-y-6 min-w-0">
          <PelatihanBatchHeader batch={batch} systemIdentity={systemIdentity} onExportPdf={handleExportPdf} onExportExcel={handleExportExcel} isPending={pending} />
          <BatchStatusStepper currentStatus={batch.status} />
          <BatchReconciliation reconciliation={initialData.reconciliation} />
          <PelatihanBatchPaymentProofs proofs={paymentProofs} canUpload={canUploadProof} isPending={pending} onUpload={handleUploadPaymentProof} />
          <BatchInstructorRecap recaps={recaps} />
          <BatchSessionItems items={items} />
          <PelatihanBatchDeductions deductions={deductions} uniqueInstructors={uniqueInstructors} canManage={canManage} isDraft={batch.status === "draft"} isPending={pending} onAddDeduction={handleAddDeduction} onRemoveDeduction={handleRemoveDeduction} />
          <BatchAuditTrail auditLogs={auditLogs} />
        </div>
        <aside className="space-y-6">
          <PelatihanBatchActions
            isPending={pending} currentStatus={batch.status} canManage={canManage} canProcess={canProcess} canPay={canPay} isAdmin={isAdmin}
            outstandingAmount={initialData.reconciliation.netAmount}
            paymentReference={paymentReference} paymentAmount={paymentAmount} paidDate={paidDate} reopenReason={reopenReason}
            editPaymentReference={editPaymentReference} editPaymentAmount={editPaymentAmount} editPaidDate={editPaidDate} editPaymentReason={editPaymentReason} isEditingPayment={isEditingPayment}
            onSubmitToFinance={handleSubmitToFinance} onMarkInProcess={handleMarkInProcess} onMarkPaid={handleMarkPaid} onLockBatch={handleLockBatch} onReopen={handleReopen}
            onCorrectPayment={handleCorrectPayment} onOpenEditPayment={openEditPayment} onCancelEditPayment={() => setIsEditingPayment(false)}
            onPaymentReferenceChange={setPaymentReference} onPaymentAmountChange={setPaymentAmount} onPaidDateChange={setPaidDate} onReopenReasonChange={setReopenReason}
            onEditPaymentReferenceChange={setEditPaymentReference} onEditPaymentAmountChange={setEditPaymentAmount} onEditPaidDateChange={setEditPaidDate} onEditPaymentReasonChange={setEditPaymentReason}
            onSendReminder={handleSendReminder}
          />
        </aside>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => { if (!open) setConfirmDialog((prev) => ({ ...prev, open: false })); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className={confirmDialog.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
              onClick={() => { confirmDialog.onConfirm(); setConfirmDialog((prev) => ({ ...prev, open: false })); }}
            >
              Ya, Lanjutkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* WhatsApp Preview Dialog */}
      <Dialog open={waPreview.open} onOpenChange={(open) => { if (!open) setWaPreview((prev) => ({ ...prev, open: false })); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview WA: Reminder Keuangan</DialogTitle>
            <DialogDescription>Pesan ke {waPreview.recipientName}</DialogDescription>
          </DialogHeader>
          <Textarea value={waPreview.message} readOnly className="min-h-[220px] font-mono text-sm" />
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setWaPreview((prev) => ({ ...prev, open: false }))}>
              Tutup
            </Button>
            {waPreview.recipientPhone ? (
              <Button variant="secondary" onClick={handleWaSendDirect} disabled={pending}>
                {pending ? "Mengirim..." : "Kirim Langsung (Bot)"}
              </Button>
            ) : null}
            {waPreview.waLink ? (
              <Button onClick={handleWaOpenLink}>
                Buka WhatsApp
              </Button>
            ) : (
              <Button disabled>Nomor WA belum valid</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
