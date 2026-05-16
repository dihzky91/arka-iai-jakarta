import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { DeductionRow } from "@/server/actions/jadwal-otomatis/honorarium";
import { ReceiptText } from "lucide-react";

function formatCurrency(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

export function BatchDeductions({
  deductions,
}: {
  deductions: DeductionRow[];
}) {
  const total = deductions.reduce(
    (sum, deduction) => sum + deduction.amount,
    0,
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Potongan</CardTitle>
            <CardDescription>
              Daftar potongan batch, read-only untuk keuangan.
            </CardDescription>
          </div>
          <div className="text-right text-sm font-semibold text-foreground">
            Total: {formatCurrency(total)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {deductions.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="Tidak ada potongan"
            description="Potongan batch honorarium akan tampil di sini jika sudah dicatat."
            className="min-h-36"
          />
        ) : (
          <div className="space-y-3">
            {deductions.map((deduction) => (
              <div
                key={deduction.id}
                className="rounded-lg border border-border/60 p-4 transition-colors hover:bg-muted/30"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">
                        {deduction.instructorName}
                      </p>
                      <Badge variant="outline">{deduction.deductionType}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {deduction.description}
                    </p>
                  </div>
                  <p className="text-sm font-medium">
                    {formatCurrency(deduction.amount)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
