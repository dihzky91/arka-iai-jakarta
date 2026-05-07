import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, DollarSign, RotateCcw } from "lucide-react";

export function BatchActions({
  isPending,
  currentStatus,
  canProcess,
  canPay,
  canReopen,
  onProcess,
  onPay,
}: {
  isPending: boolean;
  currentStatus: string;
  canProcess: boolean;
  canPay: boolean;
  canReopen: boolean;
  onProcess: () => void;
  onPay: () => void;
}) {
  return (
    <Card className="sticky top-6 rounded-[28px] border border-border bg-card">
      <CardHeader>
        <CardTitle>Aksi Keuangan</CardTitle>
        <CardDescription>Langsung jalankan tindakan batch keuangan.</CardDescription>
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
            variant={canReopen ? "outline" : "secondary"}
            disabled={!canReopen || isPending}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reopen Batch
          </Button>
        </div>
        <div className="rounded-2xl border border-border bg-muted/25 p-4 text-sm text-muted-foreground">
          Status saat ini: <span className="font-medium text-foreground">{currentStatus}</span>
        </div>
      </CardContent>
    </Card>
  );
}
