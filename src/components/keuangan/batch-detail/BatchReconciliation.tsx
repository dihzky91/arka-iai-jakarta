import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { HonorariumBatchDetail } from "@/server/actions/jadwal-otomatis/honorarium";

function formatCurrency(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

export function BatchReconciliation({
  reconciliation,
}: {
  reconciliation: HonorariumBatchDetail["reconciliation"];
}) {
  return (
    <div className="space-y-4">
      <CardHeader>
        <CardTitle>Rekonsiliasi Pembayaran</CardTitle>
        <CardDescription>Ringkasan net, pembayaran, dan selisih.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-muted/50 p-4">
          <p className="text-xs text-muted-foreground">Total Net</p>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(reconciliation.netAmount)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-muted/50 p-4">
          <p className="text-xs text-muted-foreground">Nominal Dibayar</p>
          <p className="mt-2 text-2xl font-semibold">
            {reconciliation.paymentAmount === null
              ? "-"
              : formatCurrency(reconciliation.paymentAmount)}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-muted/50 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Selisih</p>
            <Badge variant={reconciliation.isMatched ? "secondary" : "destructive"} className="rounded-full px-2 py-1 text-[11px]">
              {reconciliation.isMatched ? "Cocok" : "Tidak Cocok"}
            </Badge>
          </div>
          <p className="mt-2 text-2xl font-semibold">
            {reconciliation.difference === null
              ? "-"
              : formatCurrency(reconciliation.difference)}
          </p>
        </div>
      </CardContent>
    </div>
  );
}
