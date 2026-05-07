import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { HonorariumBatchDetail } from "@/server/actions/jadwal-otomatis/honorarium";

function formatCurrency(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

export function BatchInstructorRecap({
  recaps,
}: {
  recaps: HonorariumBatchDetail["recaps"];
}) {
  return (
    <Card className="rounded-[28px]">
      <CardHeader>
        <CardTitle>Rekap Instruktur</CardTitle>
        <CardDescription>Ringkasan nominal per instruktur.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-full divide-y divide-border rounded-2xl border border-border">
          <div className="grid grid-cols-[2fr_1fr_1fr] gap-4 bg-muted/25 px-4 py-3 text-xs uppercase tracking-[0.15em] text-muted-foreground">
            <div>Instruktur</div>
            <div className="text-right">Sesi</div>
            <div className="text-right">Net</div>
          </div>
          {recaps.map((row) => (
            <div key={row.instructorId} className="grid grid-cols-[2fr_1fr_1fr] gap-4 px-4 py-4 text-sm">
              <div>{row.instructorName}</div>
              <div className="text-right text-muted-foreground">{row.totalSessions}</div>
              <div className="text-right font-semibold">{formatCurrency(row.netAmount)}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
