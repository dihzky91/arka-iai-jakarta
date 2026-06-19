"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import {
  type DeductionRow,
  type HonorariumPaymentProofRow,
  type HonorariumBatchDetail,
  correctHonorariumBatchPayment,
  lockHonorariumBatch,
  markHonorariumBatchInProcess,
  markHonorariumBatchPaid,
  reopenHonorariumBatch,
  uploadHonorariumPaymentProof,
} from "@/server/actions/jadwal-otomatis/honorarium";
import { BatchHeader } from "./BatchHeader";
import { BatchStatusStepper } from "./BatchStatusStepper";
import { BatchReconciliation } from "./BatchReconciliation";
import { BatchPaymentProofs } from "./BatchPaymentProofs";
import { BatchInstructorRecap } from "./BatchInstructorRecap";
import { BatchSessionItems } from "./BatchSessionItems";
import { BatchDeductions } from "./BatchDeductions";
import { BatchAuditTrail } from "./BatchAuditTrail";
import { BatchActions } from "./BatchActions";

export type HonorariumBatchDetailKeuanganProps = {
  initialData: HonorariumBatchDetail;
  initialDeductions: DeductionRow[];
  initialPaymentProofs: HonorariumPaymentProofRow[];
  canProcess: boolean;
  canPay: boolean;
  isAdmin: boolean;
  systemIdentity?: { namaSistem: string; logoUrl: string | null };
};

export function HonorariumBatchDetailKeuangan({
  initialData,
  initialDeductions,
  initialPaymentProofs,
  canProcess,
  canPay,
  isAdmin,
  systemIdentity,
}: HonorariumBatchDetailKeuanganProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deductions] = useState(initialDeductions);
  const [paymentProofs] = useState(initialPaymentProofs);
  const [paymentReference, setPaymentReference] = useState(
    initialData.reconciliation.paymentReference ?? "",
  );
  const [paymentAmount, setPaymentAmount] = useState(
    String(
      initialData.reconciliation.paymentAmount ??
        initialData.reconciliation.netAmount,
    ),
  );
  const [paidDate, setPaidDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [reopenReason, setReopenReason] = useState("");
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [editPaymentReference, setEditPaymentReference] = useState(
    initialData.reconciliation.paymentReference ?? "",
  );
  const [editPaymentAmount, setEditPaymentAmount] = useState(
    String(initialData.reconciliation.paymentAmount ?? initialData.reconciliation.netAmount),
  );
  const [editPaidDate, setEditPaidDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [editPaymentReason, setEditPaymentReason] = useState("");

  const currentStatus = initialData.batch.status;
  const canMarkProcess = canProcess && currentStatus === "dikirim_ke_keuangan";
  const canMarkPaid = canPay && currentStatus === "diproses_keuangan";
  const canLock = canPay && currentStatus === "dibayar";
  const canUploadProof =
    canPay &&
    ["diproses_keuangan", "dibayar", "locked"].includes(currentStatus);
  const canReopenBatch =
    (isAdmin || canPay) &&
    ["dikirim_ke_keuangan", "diproses_keuangan", "dibayar", "locked"].includes(
      currentStatus,
    );
  const canCorrect = canPay && currentStatus === "dibayar";

  async function handleMarkInProcess() {
    if (!canMarkProcess) return;
    startTransition(async () => {
      try {
        await markHonorariumBatchInProcess(initialData.batch.id);
        toast.success(
          "Batch berhasil dipindahkan ke status Diproses Keuangan.",
        );
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal memperbarui status batch.",
        );
      }
    });
  }

  async function handleMarkPaid() {
    if (!canMarkPaid) return;
    const parsedAmount = Number(paymentAmount);
    if (!paymentReference.trim()) {
      toast.error("Referensi transfer wajib diisi.");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Nominal dibayar harus lebih dari 0.");
      return;
    }
    startTransition(async () => {
      try {
        await markHonorariumBatchPaid({
          batchId: initialData.batch.id,
          paymentReference: paymentReference.trim(),
          paymentAmount: parsedAmount,
          paidDate,
        });
        toast.success("Batch berhasil ditandai dibayar.");
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

  async function handleLock() {
    if (!canLock) return;
    startTransition(async () => {
      try {
        await lockHonorariumBatch(initialData.batch.id);
        toast.success("Batch berhasil di-lock.");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal lock batch.",
        );
      }
    });
  }

  async function handleReopen() {
    if (!canReopenBatch) return;
    if (!reopenReason.trim()) {
      toast.error("Alasan reopen wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await reopenHonorariumBatch({
          batchId: initialData.batch.id,
          reason: reopenReason.trim(),
        });
        toast.success("Batch berhasil direopen.");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal reopen batch.",
        );
      }
    });
  }

  async function handleUploadProof(file: File) {
    if (!canUploadProof) return;
    startTransition(async () => {
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        await uploadHonorariumPaymentProof({
          batchId: initialData.batch.id,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          dataUrl,
        });
        toast.success("Bukti pembayaran berhasil diunggah.");
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal upload bukti pembayaran.",
        );
      }
    });
  }

  function handleOpenEditPayment() {
    setEditPaymentReference(initialData.reconciliation.paymentReference ?? "");
    setEditPaymentAmount(
      String(initialData.reconciliation.paymentAmount ?? initialData.reconciliation.netAmount),
    );
    setEditPaidDate(new Date().toISOString().slice(0, 10));
    setEditPaymentReason("");
    setIsEditingPayment(true);
  }

  async function handleCorrectPayment() {
    if (!canCorrect) return;
    if (!editPaymentReference.trim()) {
      toast.error("Referensi transfer wajib diisi.");
      return;
    }
    const parsedAmount = Number(editPaymentAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Nominal pembayaran harus lebih dari 0.");
      return;
    }
    if (!editPaymentReason.trim()) {
      toast.error("Alasan koreksi wajib diisi.");
      return;
    }
    startTransition(async () => {
      try {
        await correctHonorariumBatchPayment({
          batchId: initialData.batch.id,
          paymentReference: editPaymentReference.trim(),
          paymentAmount: parsedAmount,
          paidDate: editPaidDate,
          reason: editPaymentReason.trim(),
        });
        toast.success("Data pembayaran berhasil dikoreksi.");
        setIsEditingPayment(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal koreksi pembayaran.",
        );
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr] min-w-0">
      <div className="space-y-6 min-w-0">
        <BatchHeader
          batch={initialData.batch}
          systemIdentity={systemIdentity}
          outstandingAmount={initialData.reconciliation.netAmount}
        />
        <BatchStatusStepper currentStatus={currentStatus} />
        <Card>
          <CardContent>
            <BatchReconciliation reconciliation={initialData.reconciliation} />
          </CardContent>
        </Card>
        <BatchPaymentProofs
          proofs={paymentProofs}
          canUpload={canUploadProof}
          isPending={isPending}
          onUpload={handleUploadProof}
        />
        <BatchInstructorRecap recaps={initialData.recaps} />
        <BatchSessionItems items={initialData.items} />
        <BatchDeductions deductions={deductions} />
        <BatchAuditTrail auditLogs={initialData.auditLogs} />
      </div>
      <aside className="space-y-6">
        <BatchActions
          isPending={isPending}
          currentStatus={currentStatus}
          canProcess={canMarkProcess}
          canPay={canMarkPaid}
          canReopen={canReopenBatch}
          canLock={canLock}
          canCorrect={canCorrect}
          isEditingPayment={isEditingPayment}
          paymentReference={paymentReference}
          paymentAmount={paymentAmount}
          paidDate={paidDate}
          reopenReason={reopenReason}
          expectedAmount={initialData.reconciliation.netAmount}
          editPaymentReference={editPaymentReference}
          editPaymentAmount={editPaymentAmount}
          editPaidDate={editPaidDate}
          editPaymentReason={editPaymentReason}
          onPaymentReferenceChange={setPaymentReference}
          onPaymentAmountChange={setPaymentAmount}
          onPaidDateChange={setPaidDate}
          onReopenReasonChange={setReopenReason}
          onEditPaymentReferenceChange={setEditPaymentReference}
          onEditPaymentAmountChange={setEditPaymentAmount}
          onEditPaidDateChange={setEditPaidDate}
          onEditPaymentReasonChange={setEditPaymentReason}
          onProcess={handleMarkInProcess}
          onPay={handleMarkPaid}
          onLock={handleLock}
          onReopen={handleReopen}
          onOpenEditPayment={handleOpenEditPayment}
          onCancelEditPayment={() => setIsEditingPayment(false)}
          onCorrectPayment={handleCorrectPayment}
        />
      </aside>
    </div>
  );
}
