import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HonorariumBatchDetail } from "@/server/actions/jadwal-otomatis/honorarium";

function formatCurrency(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

export function BatchSessionItems({
  items,
}: {
  items: HonorariumBatchDetail["items"];
}) {
  return (
    <Card className="rounded-[28px]">
      <CardHeader>
        <CardTitle>Detail Sesi</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-[0.15em] text-muted-foreground">
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Program</th>
              <th className="px-4 py-3">Instruktur</th>
              <th className="px-4 py-3 text-right">Nominal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border hover:bg-muted/25">
                <td className="px-4 py-3 text-muted-foreground">{item.scheduledDate}</td>
                <td className="px-4 py-3">{item.programName}</td>
                <td className="px-4 py-3">{item.paidInstructorName}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
