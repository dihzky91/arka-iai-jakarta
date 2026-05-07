import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    <Card>
      <CardHeader>
        <CardTitle>Rekap Instruktur</CardTitle>
        <CardDescription>Ringkasan nominal per instruktur.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instruktur</TableHead>
                <TableHead className="text-right">Sesi</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recaps.map((row) => (
                <TableRow key={row.instructorId}>
                  <TableCell className="font-medium">
                    {row.instructorName}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {row.totalSessions}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(row.grossAmount)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(row.netAmount)}
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
