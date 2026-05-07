import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { HonorariumBatchDetail } from "@/server/actions/jadwal-otomatis/honorarium";
import { formatTanggalPendek } from "@/lib/utils";

function formatCurrency(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

export function BatchSessionItems({
  items,
}: {
  items: HonorariumBatchDetail["items"];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Detail Sesi</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border border-border">
          <Table className="min-w-[48rem]">
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Program</TableHead>
                <TableHead>Instruktur</TableHead>
                <TableHead>Sumber</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground">
                    {formatTanggalPendek(item.scheduledDate)}
                  </TableCell>
                  <TableCell>{item.programName}</TableCell>
                  <TableCell>{item.paidInstructorName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.source}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(item.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
