import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { DeductionRow } from "@/server/actions/jadwal-otomatis/honorarium";

function formatCurrency(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

export function BatchDeductions({
  deductions,
}: {
  deductions: DeductionRow[];
}) {
  const total = deductions.reduce((sum, deduction) => sum + deduction.amount, 0);

  return (
    <Card className="rounded-[28px]">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Potongan</CardTitle>
            <CardDescription>Daftar potongan batch (read-only untuk keuangan).</CardDescription>
          </div>
          <div className="text-right text-sm font-semibold text-foreground">
            Total: {formatCurrency(total)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {deductions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Tidak ada potongan yang dicatat untuk batch ini.
          </div>
        ) : (
          <div className="space-y-3">
            {deductions.map((deduction) => (
              <div key={deduction.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">{deduction.instructorName}</p>
                    <p className="text-xs text-muted-foreground">{deduction.description}</p>
                  </div>
                  <p className="text-sm font-semibold">{formatCurrency(deduction.amount)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
