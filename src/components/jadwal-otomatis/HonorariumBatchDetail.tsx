"use client";

import { useState, useTransition } from "react";
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
    if (!confirm("Kirim batch ini ke keuangan?")) return;
    startTransition(async () => { try { await submitHonorariumBatchToFinance(batch.id); toast.success("Batch dikirim ke keuangan."); router.refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal kirim ke keuangan."); } });
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
    if (!confirm("Lock batch ini? Setelah lock, batch dianggap final.")) return;
    startTransition(async () => { try { await lockHonorariumBatch(batch.id); toast.success("Batch berhasil di-lock."); router.refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal lock batch."); } });
  }
  function handleReopen() {
    if (!reopenReason.trim()) { toast.error("Alasan reopen wajib diisi."); return; }
    if (!confirm("Reopen batch ini? Batch akan kembali ke status draft.")) return;
    startTransition(async () => { try { await reopenHonorariumBatch({ batchId: batch.id, reason: reopenReason.trim() }); toast.success("Batch berhasil di-reopen."); setReopenReason(""); router.refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal reopen batch."); } });
  }
  function handleAddDeduction(data: { instructorId: string; deductionType: "pph21" | "pph23" | "other"; description: string; amount: number }) {
    startTransition(async () => { try { const result = await addHonorariumDeduction({ batchId: batch.id, ...data }); if (result.ok) { toast.success("Potongan berhasil ditambahkan."); router.refresh(); } } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal tambah potongan."); } });
  }
  function handleRemoveDeduction(deductionId: string) {
    if (!confirm("Hapus potongan ini?")) return;
    startTransition(async () => { try { await removeHonorariumDeduction({ deductionId }); toast.success("Potongan berhasil dihapus."); setDeductions((prev) => prev.filter((d) => d.id !== deductionId)); router.refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal hapus potongan."); } });
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
        const exportedAt = new Date();
        let currentY = 10;
        if (systemIdentity?.logoUrl) {
          try { const { dataUrl, image } = await buildLogoImage(systemIdentity.logoUrl); const maxW = 34, maxH = 28; const ratio = Math.min(maxW / image.width, maxH / image.height, 1); doc.addImage(dataUrl, "PNG", (pageWidth - image.width * ratio) / 2, currentY, image.width * ratio, image.height * ratio); currentY += image.height * ratio + 5; } catch { /* Logo opsional */ }
        }
        doc.setFontSize(14); doc.text("LAPORAN HONORARIUM INTERNAL", pageWidth / 2, currentY, { align: "center" }); currentY += 7;
        doc.setFontSize(9);
        doc.text(`Nomor Dokumen: ${batch.documentNumber}`, 14, currentY); doc.text(`Total Sesi: ${batch.itemCount}`, 110, currentY); currentY += 5;
        doc.text(`Periode: ${batch.periodStart} s.d. ${batch.periodEnd}`, 14, currentY); doc.text(`Total Gross: ${formatCurrency(batch.totalAmount)}`, 110, currentY); currentY += 5;
        doc.text(`Status: ${batch.status}`, 14, currentY); doc.text(`Total Net: ${formatCurrency(totalNet)}`, 110, currentY); doc.text(`Diekspor: ${formatTanggalWaktuJakarta(exportedAt)}`, 220, currentY); currentY += 6;
        autoTable(doc, { startY: currentY, head: [["Instruktur", "Total Sesi", "Gross", "Deductions", "Net"]], body: deductionSummary.map((r) => [r.instructorName, String(r.totalSessions), formatCurrency(r.grossAmount), r.totalDeduction > 0 ? formatCurrency(r.totalDeduction) : "-", formatCurrency(r.netAmount)]), theme: "grid", styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] }, columnStyles: { 1: { halign: "right", cellWidth: 24 }, 2: { halign: "right", cellWidth: 30 }, 3: { halign: "right", cellWidth: 30 }, 4: { halign: "right", cellWidth: 30 } } });
        autoTable(doc, { startY: ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 36) + 8, head: [["Instruktur", "Tipe", "Keterangan", "Jumlah"]], body: deductions.length > 0 ? deductions.map((d) => [d.instructorName, d.deductionType === "pph21" ? "PPh 21" : d.deductionType === "pph23" ? "PPh 23" : "Lainnya", d.description, formatCurrency(d.amount)]) : [["-", "-", "Tidak ada potongan", "-"]], theme: "grid", styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] }, columnStyles: { 3: { halign: "right", cellWidth: 32 } } });
        autoTable(doc, { startY: ((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 36) + 8, head: [["Tanggal", "Program", "Instruktur", "Sumber", "Materi", "Level", "Rate", "Amount"]], body: items.map((item) => [item.scheduledDate, item.programName, item.paidInstructorName, item.source === "actual" ? "Substitusi" : "Planned", item.materiBlock, item.expertiseLevelSnapshot, formatCurrency(item.rateSnapshot), formatCurrency(item.amount)]), theme: "grid", styles: { fontSize: 7.5, cellPadding: 1.8 }, headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] }, columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 28 }, 2: { cellWidth: 35 }, 3: { cellWidth: 16 }, 4: { cellWidth: 52 }, 5: { cellWidth: 16 }, 6: { cellWidth: 22, halign: "right" }, 7: { cellWidth: 22, halign: "right" } } });
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
    <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
      <div className="space-y-6">
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
        />
      </aside>
    </div>
  );
}
