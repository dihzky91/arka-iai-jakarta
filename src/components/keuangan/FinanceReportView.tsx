"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, Eye, FileBarChart, Filter, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import {
  exportFinanceHonorariumRecapExcel,
  getFinanceHonorariumRecap,
} from "@/server/actions/jadwal-otomatis/honorarium";
import type { FinanceHonorariumRecap } from "@/server/actions/jadwal-otomatis/honorarium";
import { APP_TIME_ZONE, formatTanggalPendek } from "@/lib/utils";

type InstructorOption = {
  id: string;
  name: string;
};

type StatusFilter =
  | "all"
  | "dikirim_ke_keuangan"
  | "diproses_keuangan"
  | "dibayar"
  | "locked";

export function FinanceReportView({
  initialRecap,
  instructors,
}: {
  initialRecap: FinanceHonorariumRecap;
  instructors: InstructorOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [recap, setRecap] = useState(initialRecap);
  const [startDate, setStartDate] = useState(initialRecap.filters.startDate);
  const [endDate, setEndDate] = useState(initialRecap.filters.endDate);
  const [status, setStatus] = useState<StatusFilter>(
    initialRecap.filters.status as StatusFilter,
  );
  const [instructorId, setInstructorId] = useState(
    initialRecap.filters.instructorId || "all",
  );

  const filters = {
    startDate,
    endDate,
    status,
    instructorId: instructorId === "all" ? "" : instructorId,
  };

  function applyFilter() {
    startTransition(async () => {
      try {
        const next = await getFinanceHonorariumRecap(filters);
        setRecap(next);
        toast.success("Laporan diperbarui.");
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Filter laporan tidak valid.",
        );
      }
    });
  }

  function exportExcel() {
    startTransition(async () => {
      try {
        const result = await exportFinanceHonorariumRecapExcel(filters);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        const binaryStr = atob(result.data.xlsxBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = result.data.fileName;
        anchor.click();
        URL.revokeObjectURL(url);
        toast.success("Excel laporan berhasil diekspor.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal export Excel.",
        );
      }
    });
  }

  function exportPdf() {
    startTransition(async () => {
      try {
        const { default: jsPDF } = await import("jspdf");
        const { default: autoTable } = await import("jspdf-autotable");
        const doc = new jsPDF({
          orientation: "landscape",
          unit: "mm",
          format: "a4",
        });

        doc.setFontSize(14);
        doc.text("LAPORAN HONORARIUM KEUANGAN", 14, 14);
        doc.setFontSize(9);
        doc.text(
          `Periode: ${recap.filters.startDate} s.d. ${recap.filters.endDate}`,
          14,
          20,
        );
        doc.text(
          `Total Net: ${formatCurrency(recap.totals.netAmount)}`,
          14,
          26,
        );
        doc.text(
          `Total Dibayar: ${formatCurrency(recap.totals.paidAmount)}`,
          72,
          26,
        );

        autoTable(doc, {
          startY: 32,
          head: [["Instruktur", "Batch", "Sesi", "Gross", "Potongan", "Net"]],
          body: recap.instructorRecaps.map((row) => [
            row.instructorName,
            String(row.batchCount),
            String(row.sessionCount),
            formatCurrency(row.grossAmount),
            formatCurrency(row.deductionAmount),
            formatCurrency(row.netAmount),
          ]),
          theme: "grid",
          styles: { fontSize: 8, cellPadding: 1.8 },
          headStyles: { fillColor: [37, 99, 235] },
        });

        autoTable(doc, {
          startY: (doc as unknown as { lastAutoTable?: { finalY: number } })
            .lastAutoTable
            ? (doc as unknown as { lastAutoTable: { finalY: number } })
                .lastAutoTable.finalY + 8
            : 120,
          head: [["Dokumen", "Periode", "Status", "Sesi", "Net", "Dibayar"]],
          body: recap.rows.map((row) => [
            row.documentNumber,
            `${row.periodStart} s.d. ${row.periodEnd}`,
            row.statusLabel,
            String(row.itemCount),
            formatCurrency(row.netAmount),
            row.paidAmount === null ? "-" : formatCurrency(row.paidAmount),
          ]),
          theme: "grid",
          styles: { fontSize: 7.5, cellPadding: 1.6 },
          headStyles: { fillColor: [5, 150, 105] },
        });

        doc.save(
          `laporan-keuangan-honorarium-${recap.filters.startDate}-${recap.filters.endDate}.pdf`,
        );
        toast.success("PDF laporan berhasil diekspor.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal export PDF.",
        );
      }
    });
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Filter Laporan</CardTitle>
          <CardDescription>
            Rekap periodik batch honorarium dan agregasi per instruktur.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[160px_160px_180px_240px_auto]">
          <Input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
          <Input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as StatusFilter)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              <SelectItem value="dikirim_ke_keuangan">Dikirim</SelectItem>
              <SelectItem value="diproses_keuangan">Diproses</SelectItem>
              <SelectItem value="dibayar">Dibayar</SelectItem>
              <SelectItem value="locked">Locked</SelectItem>
            </SelectContent>
          </Select>
          <Select value={instructorId} onValueChange={setInstructorId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua instruktur</SelectItem>
              {instructors.map((instructor) => (
                <SelectItem key={instructor.id} value={instructor.id}>
                  {instructor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-2">
            <Button onClick={applyFilter} disabled={pending}>
              <Filter className="mr-1 h-4 w-4" />
              Terapkan
            </Button>
            <Button variant="outline" onClick={exportPdf} disabled={pending}>
              <Download className="mr-1 h-4 w-4" />
              PDF
            </Button>
            <Button variant="outline" onClick={exportExcel} disabled={pending}>
              <Download className="mr-1 h-4 w-4" />
              Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-3 md:grid-cols-4">
        <SummaryTile label="Batch" value={String(recap.totals.batchCount)} />
        <SummaryTile label="Sesi" value={String(recap.totals.sessionCount)} />
        <SummaryTile
          label="Total Net"
          value={formatCurrency(recap.totals.netAmount)}
        />
        <SummaryTile
          label="Total Dibayar"
          value={formatCurrency(recap.totals.paidAmount)}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Rekap Per Instruktur</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
            <Table className="min-w-[48rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Instruktur</TableHead>
                  <TableHead className="text-right">Batch</TableHead>
                  <TableHead className="text-right">Sesi</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Potongan</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recap.instructorRecaps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-4">
                      <EmptyState
                        icon={UserRound}
                        title="Tidak ada rekap instruktur"
                        description="Tidak ada data instruktur pada filter laporan saat ini."
                        className="min-h-40"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  recap.instructorRecaps.map((row) => (
                    <TableRow key={row.instructorId} className="transition-colors hover:bg-muted/30">
                      <TableCell className="font-medium">
                        {row.instructorName}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.batchCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.sessionCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.grossAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.deductionAmount)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(row.netAmount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detail Batch</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
            <Table className="min-w-[60rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Dokumen</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Sesi</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">Dibayar</TableHead>
                  <TableHead>Tgl Bayar</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recap.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="p-4">
                      <EmptyState
                        icon={FileBarChart}
                        title="Tidak ada batch"
                        description="Tidak ada batch honorarium pada filter laporan saat ini."
                        className="min-h-40"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  recap.rows.map((row) => (
                    <TableRow key={row.batchId} className="transition-colors hover:bg-muted/30">
                      <TableCell className="font-medium">
                        {row.documentNumber}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatTanggalPendek(row.periodStart)} s.d.{" "}
                        {formatTanggalPendek(row.periodEnd)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.statusLabel}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {row.itemCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.netAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.paidAmount === null
                          ? "-"
                          : formatCurrency(row.paidAmount)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.paidAt
                          ? row.paidAt.toLocaleString("id-ID", {
                              timeZone: APP_TIME_ZONE,
                            })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/keuangan/honorarium/${row.batchId}`}>
                            <Eye className="mr-1 h-4 w-4" />
                            Detail
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function formatCurrency(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}
