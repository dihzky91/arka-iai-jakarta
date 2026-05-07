"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  DollarSign,
  Lock,
  Pencil,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { getTodayIsoInJakarta } from "@/lib/utils";

function formatCurrency(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

export function PelatihanBatchActions({
  isPending,
  currentStatus,
  canManage,
  canProcess,
  canPay,
  isAdmin,
  outstandingAmount,
  paymentReference,
  paymentAmount,
  paidDate,
  reopenReason,
  editPaymentReference,
  editPaymentAmount,
  editPaidDate,
  editPaymentReason,
  isEditingPayment,
  onSubmitToFinance,
  onMarkInProcess,
  onMarkPaid,
  onLockBatch,
  onReopen,
  onCorrectPayment,
  onOpenEditPayment,
  onCancelEditPayment,
  onPaymentReferenceChange,
  onPaymentAmountChange,
  onPaidDateChange,
  onReopenReasonChange,
  onEditPaymentReferenceChange,
  onEditPaymentAmountChange,
  onEditPaidDateChange,
  onEditPaymentReasonChange,
}: {
  isPending: boolean;
  currentStatus: string;
  canManage: boolean;
  canProcess: boolean;
  canPay: boolean;
  isAdmin: boolean;
  outstandingAmount: number;
  paymentReference: string;
  paymentAmount: string;
  paidDate: string;
  reopenReason: string;
  editPaymentReference: string;
  editPaymentAmount: string;
  editPaidDate: string;
  editPaymentReason: string;
  isEditingPayment: boolean;
  onSubmitToFinance: () => void;
  onMarkInProcess: () => void;
  onMarkPaid: () => void;
  onLockBatch: () => void;
  onReopen: () => void;
  onCorrectPayment: () => void;
  onOpenEditPayment: () => void;
  onCancelEditPayment: () => void;
  onPaymentReferenceChange: (value: string) => void;
  onPaymentAmountChange: (value: string) => void;
  onPaidDateChange: (value: string) => void;
  onReopenReasonChange: (value: string) => void;
  onEditPaymentReferenceChange: (value: string) => void;
  onEditPaymentAmountChange: (value: string) => void;
  onEditPaidDateChange: (value: string) => void;
  onEditPaymentReasonChange: (value: string) => void;
}) {
  const canSubmit = canManage && currentStatus === "draft";
  const canMarkProcess = canProcess && currentStatus === "dikirim_ke_keuangan";
  const canMarkPaid = canPay && currentStatus === "diproses_keuangan";
  const canLock = (canPay || canManage) && currentStatus === "dibayar";
  const canReopen =
    (isAdmin || canPay) &&
    ["dikirim_ke_keuangan", "diproses_keuangan", "dibayar", "locked"].includes(
      currentStatus,
    );
  const canEditPayment = canPay && currentStatus === "dibayar";

  return (
    <Card className="sticky top-6 border border-border bg-card">
      <CardHeader>
        <CardTitle>Aksi Batch</CardTitle>
        <CardDescription>
          Transisi status batch honorarium sesuai workflow.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {canSubmit ? (
            <Button
              className="w-full"
              onClick={onSubmitToFinance}
              disabled={isPending}
            >
              <Send className="mr-2 h-4 w-4" />
              Kirim ke Keuangan
            </Button>
          ) : null}

          {canMarkProcess ? (
            <Button
              className="w-full"
              variant={canMarkProcess ? "default" : "outline"}
              disabled={!canMarkProcess || isPending}
              onClick={onMarkInProcess}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Tandai Diproses
            </Button>
          ) : null}

          {canMarkPaid ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="mb-3 text-xs font-medium text-muted-foreground">
                  Nominal rekonsiliasi: {formatCurrency(outstandingAmount)}
                </p>
                <div className="space-y-3">
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">
                      Tanggal Bayar
                    </p>
                    <Input
                      type="date"
                      value={paidDate}
                      onChange={(e) => onPaidDateChange(e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                  <Input
                    value={paymentReference}
                    onChange={(e) => onPaymentReferenceChange(e.target.value)}
                    placeholder="Referensi transfer"
                    disabled={isPending}
                  />
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={paymentAmount}
                    onChange={(e) => onPaymentAmountChange(e.target.value)}
                    placeholder="Nominal dibayar"
                    disabled={isPending}
                  />
                </div>
              </div>
              <Button
                className="w-full"
                variant="secondary"
                disabled={isPending}
                onClick={onMarkPaid}
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Tandai Dibayar
              </Button>
            </div>
          ) : null}

          {canEditPayment && !isEditingPayment ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={onOpenEditPayment}
              disabled={isPending}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit Pembayaran
            </Button>
          ) : null}

          {isEditingPayment ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Koreksi Pembayaran
              </p>
              <Input
                type="date"
                value={editPaidDate}
                onChange={(e) => onEditPaidDateChange(e.target.value)}
                disabled={isPending}
              />
              <Input
                value={editPaymentReference}
                onChange={(e) => onEditPaymentReferenceChange(e.target.value)}
                placeholder="Referensi transfer"
                disabled={isPending}
              />
              <Input
                type="number"
                inputMode="decimal"
                value={editPaymentAmount}
                onChange={(e) => onEditPaymentAmountChange(e.target.value)}
                placeholder="Nominal dibayar"
                disabled={isPending}
              />
              <Input
                value={editPaymentReason}
                onChange={(e) => onEditPaymentReasonChange(e.target.value)}
                placeholder="Alasan koreksi (wajib)"
                disabled={isPending}
              />
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={onCorrectPayment}
                  disabled={isPending}
                  size="sm"
                >
                  Simpan
                </Button>
                <Button
                  variant="outline"
                  onClick={onCancelEditPayment}
                  disabled={isPending}
                  size="sm"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}

          {canLock ? (
            <Button
              className="w-full"
              variant={canLock ? "default" : "outline"}
              disabled={!canLock || isPending}
              onClick={onLockBatch}
            >
              <Lock className="mr-2 h-4 w-4" />
              Lock Batch
            </Button>
          ) : null}

          {currentStatus === "locked" ? (
            <div className="rounded-lg border border-border bg-muted/25 p-4 text-sm text-muted-foreground">
              Batch sudah final (locked).
            </div>
          ) : null}

          {canReopen ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-destructive/30 bg-muted/20 p-3">
                <Textarea
                  value={reopenReason}
                  onChange={(e) => onReopenReasonChange(e.target.value)}
                  placeholder="Alasan reopen (wajib)"
                  disabled={!canReopen || isPending}
                  rows={3}
                />
              </div>
              <Button
                className="w-full"
                variant="destructive"
                disabled={!canReopen || isPending || !reopenReason.trim()}
                onClick={onReopen}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reopen Batch
              </Button>
            </div>
          ) : null}
        </div>
        <div className="rounded-lg border border-border bg-muted/25 p-4 text-sm text-muted-foreground">
          Status saat ini:{" "}
          <span className="font-medium text-foreground">{currentStatus}</span>
        </div>
      </CardContent>
    </Card>
  );
}
