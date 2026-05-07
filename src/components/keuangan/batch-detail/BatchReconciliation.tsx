import { Badge } from "@/components/ui/badge";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { HonorariumBatchDetail } from "@/server/actions/jadwal-otomatis/honorarium";

function formatCurrency(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

export function BatchReconciliation({
  reconciliation,
}: {
  reconciliation: HonorariumBatchDetail["reconciliation"];
}) {
  const paid =
    reconciliation.paymentAmount === null ? 0 : reconciliation.paymentAmount;
  const progress =
    reconciliation.netAmount <= 0
      ? 0
      : Math.min(100, Math.round((paid / reconciliation.netAmount) * 100));

  return (
    <div className="space-y-4">
      <CardHeader>
        <CardTitle>Rekonsiliasi Pembayaran</CardTitle>
        <CardDescription>
          Ringkasan net, pembayaran, dan selisih.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Progress Bayar</p>
              <p className="mt-1 text-lg font-semibold">{progress}%</p>
            </div>
            <Badge
              variant={reconciliation.isMatched ? "secondary" : "destructive"}
              className="rounded-full px-3 py-1"
            >
              {reconciliation.isMatched ? "Cocok" : "Belum cocok"}
            </Badge>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground">Total Net</p>
            <p className="mt-2 text-2xl font-semibold">
              {formatCurrency(reconciliation.netAmount)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground">Nominal Dibayar</p>
            <p className="mt-2 text-2xl font-semibold">
              {reconciliation.paymentAmount === null
                ? "-"
                : formatCurrency(reconciliation.paymentAmount)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground">Selisih</p>
            <p className="mt-2 text-2xl font-semibold">
              {reconciliation.difference === null
                ? "-"
                : formatCurrency(reconciliation.difference)}
            </p>
          </div>
        </div>
      </CardContent>
    </div>
  );
}
