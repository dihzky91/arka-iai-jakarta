"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { type DeductionRow, type HonorariumPaymentProofRow, type HonorariumBatchDetail, markHonorariumBatchInProcess, markHonorariumBatchPaid, type getHonorariumBatchDetail } from "@/server/actions/jadwal-otomatis/honorarium";
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

function formatCurrency(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

const statusOrder = [
  "draft",
  "dikirim_ke_keuangan",
  "diproses_keuangan",
  "dibayar",
  "locked",
];

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

  const currentStatus = initialData.batch.status;
  const canMarkProcess = canProcess && currentStatus === "dikirim_ke_keuangan";
  const canMarkPaid = canPay && currentStatus === "diproses_keuangan";

  async function handleMarkInProcess() {
    if (!canMarkProcess) return;
    startTransition(async () => {
      try {
        await markHonorariumBatchInProcess(initialData.batch.id);
        toast.success("Batch berhasil dipindahkan ke status Diproses Keuangan.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal memperbarui status batch.");
      }
    });
  }

  async function handleMarkPaid() {
    if (!canMarkPaid) return;
    startTransition(async () => {
      try {
        await markHonorariumBatchPaid({
          batchId: initialData.batch.id,
          paymentReference: "TERSEDIA",
          paymentAmount: initialData.reconciliation.netAmount,
        });
        toast.success("Batch berhasil ditandai dibayar.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal menandai batch dibayar.");
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.6fr_0.9fr]">
      <div className="space-y-6">
        <BatchHeader
          batch={initialData.batch}
          systemIdentity={systemIdentity}
          outstandingAmount={initialData.reconciliation.netAmount}
        />
        <BatchStatusStepper currentStatus={currentStatus} />
        <Card className="rounded-[28px]">
          <CardContent>
            <BatchReconciliation reconciliation={initialData.reconciliation} />
          </CardContent>
        </Card>
        <BatchPaymentProofs proofs={paymentProofs} />
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
          canReopen={isAdmin || canPay}
          onProcess={handleMarkInProcess}
          onPay={handleMarkPaid}
        />
      </aside>
    </div>
  );
}
