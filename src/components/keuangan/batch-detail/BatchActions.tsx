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
import { CheckCircle2, DollarSign, Lock, Pencil, RotateCcw } from "lucide-react";

function formatCurrency(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

export function BatchActions({
  isPending,
  currentStatus,
  canProcess,
  canPay,
  canReopen,
  canLock,
  canCorrect,
  isEditingPayment,
  paymentReference,
  paymentAmount,
  paidDate,
  reopenReason,
  expectedAmount,
  editPaymentReference,
  editPaymentAmount,
  editPaidDate,
  editPaymentReason,
  onPaymentReferenceChange,
  onPaymentAmountChange,
  onPaidDateChange,
  onReopenReasonChange,
  onEditPaymentReferenceChange,
  onEditPaymentAmountChange,
  onEditPaidDateChange,
  onEditPaymentReasonChange,
  onProcess,
  onPay,
  onLock,
  onReopen,
  onOpenEditPayment,
  onCancelEditPayment,
  onCorrectPayment,
}: {
  isPending: boolean;
  currentStatus: string;
  canProcess: boolean;
  canPay: boolean;
  canReopen: boolean;
  canLock: boolean;
  canCorrect?: boolean;
  isEditingPayment?: boolean;
  paymentReference: string;
  paymentAmount: string;
  paidDate: string;
  reopenReason: string;
  expectedAmount: number;
  editPaymentReference?: string;
  editPaymentAmount?: string;
  editPaidDate?: string;
  editPaymentReason?: string;
  onPaymentReferenceChange: (value: string) => void;
  onPaymentAmountChange: (value: string) => void;
  onPaidDateChange: (value: string) => void;
  onReopenReasonChange: (value: string) => void;
  onEditPaymentReferenceChange?: (value: string) => void;
  onEditPaymentAmountChange?: (value: string) => void;
  onEditPaidDateChange?: (value: string) => void;
  onEditPaymentReasonChange?: (value: string) => void;
  onProcess: () => void;
  onPay: () => void;
  onLock: () => void;
  onReopen: () => void;
  onOpenEditPayment?: () => void;
  onCancelEditPayment?: () => void;
  onCorrectPayment?: () => void;
}) {
  return (
    <Card className="sticky top-6 border border-border bg-card">
      <CardHeader>
        <CardTitle>Aksi Keuangan</CardTitle>
        <CardDescription>
          Proses, bayar, lock, atau reopen batch.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <Button
            className="w-full"
            variant={canProcess ? "default" : "outline"}
            disabled={!canProcess || isPending}
            onClick={onProcess}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Tandai Diproses
          </Button>
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="mb-3 text-xs font-medium text-muted-foreground">
              Nominal rekonsiliasi: {formatCurrency(expectedAmount)}
            </p>
            <div className="space-y-3">
              <Input
                value={paymentReference}
                onChange={(event) =>
                  onPaymentReferenceChange(event.target.value)
                }
                placeholder="Referensi transfer"
                disabled={!canPay || isPending}
              />
              <Input
                type="number"
                inputMode="decimal"
                value={paymentAmount}
                onChange={(event) => onPaymentAmountChange(event.target.value)}
                placeholder="Nominal dibayar"
                disabled={!canPay || isPending}
              />
              <Input
                type="date"
                value={paidDate}
                onChange={(event) => onPaidDateChange(event.target.value)}
                disabled={!canPay || isPending}
              />
            </div>
          </div>
          <Button
            className="w-full"
            variant={canPay ? "secondary" : "outline"}
            disabled={!canPay || isPending}
            onClick={onPay}
          >
            <DollarSign className="mr-2 h-4 w-4" />
            Tandai Dibayar
          </Button>
          <Button
            className="w-full"
            variant={canLock ? "default" : "outline"}
            disabled={!canLock || isPending}
            onClick={onLock}
          >
            <Lock className="mr-2 h-4 w-4" />
            Lock Batch
          </Button>

          {/* Correction section - visible when batch is dibayar */}
          {canCorrect && currentStatus === "dibayar" && (
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
              {!isEditingPayment ? (
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={isPending}
                  onClick={onOpenEditPayment}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Koreksi Pembayaran
                </Button>
              ) : (
                <>
                  <p className="text-xs font-medium text-muted-foreground">
                    Koreksi data pembayaran:
                  </p>
                  <Input
                    value={editPaymentReference ?? ""}
                    onChange={(event) =>
                      onEditPaymentReferenceChange?.(event.target.value)
                    }
                    placeholder="Referensi transfer baru"
                    disabled={isPending}
                  />
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={editPaymentAmount ?? ""}
                    onChange={(event) =>
                      onEditPaymentAmountChange?.(event.target.value)
                    }
                    placeholder="Nominal yang benar"
                    disabled={isPending}
                  />
                  <Input
                    type="date"
                    value={editPaidDate ?? ""}
                    onChange={(event) =>
                      onEditPaidDateChange?.(event.target.value)
                    }
                    disabled={isPending}
                  />
                  <Textarea
                    value={editPaymentReason ?? ""}
                    onChange={(event) =>
                      onEditPaymentReasonChange?.(event.target.value)
                    }
                    placeholder="Alasan koreksi (wajib)"
                    rows={2}
                    disabled={isPending}
                  />
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={onCancelEditPayment}
                    >
                      Batal
                    </Button>
                    <Button
                      className="flex-1"
                      variant="default"
                      size="sm"
                      disabled={isPending}
                      onClick={onCorrectPayment}
                    >
                      Simpan Koreksi
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <Textarea
              value={reopenReason}
              onChange={(event) => onReopenReasonChange(event.target.value)}
              placeholder="Alasan reopen"
              disabled={!canReopen || isPending}
              rows={3}
            />
          </div>
          <Button
            className="w-full"
            variant={canReopen ? "outline" : "secondary"}
            disabled={!canReopen || isPending}
            onClick={onReopen}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reopen Batch
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-muted/25 p-4 text-sm text-muted-foreground">
          Status saat ini:{" "}
          <span className="font-medium text-foreground">{currentStatus}</span>
        </div>
      </CardContent>
    </Card>
  );
}
