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
import { CheckCircle2, DollarSign, Lock, RotateCcw } from "lucide-react";

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
  paymentReference,
  paymentAmount,
  paidDate,
  reopenReason,
  expectedAmount,
  onPaymentReferenceChange,
  onPaymentAmountChange,
  onPaidDateChange,
  onReopenReasonChange,
  onProcess,
  onPay,
  onLock,
  onReopen,
}: {
  isPending: boolean;
  currentStatus: string;
  canProcess: boolean;
  canPay: boolean;
  canReopen: boolean;
  canLock: boolean;
  paymentReference: string;
  paymentAmount: string;
  paidDate: string;
  reopenReason: string;
  expectedAmount: number;
  onPaymentReferenceChange: (value: string) => void;
  onPaymentAmountChange: (value: string) => void;
  onPaidDateChange: (value: string) => void;
  onReopenReasonChange: (value: string) => void;
  onProcess: () => void;
  onPay: () => void;
  onLock: () => void;
  onReopen: () => void;
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
