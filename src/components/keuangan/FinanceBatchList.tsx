"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, Eye, Filter } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import {
  exportFinanceHonorariumRecapExcel,
  getFinanceHonorariumRecap,
  listHonorariumBatches,
} from "@/server/actions/jadwal-otomatis/honorarium";
import type { HonorariumBatchRow } from "@/server/actions/jadwal-otomatis/honorarium";
import { APP_TIME_ZONE, formatTanggalPendek } from "@/lib/utils";

type BatchStatusFilter =
  | "all"
  | "dikirim_ke_keuangan"
  | "diproses_keuangan"
  | "dibayar"
  | "locked";

interface FinanceBatchListProps {
  initialBatches: HonorariumBatchRow[];
}

function formatCurrency(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

function statusLabel(status: string) {
  if (status === "draft") return "Draft";
  if (status === "dikirim_ke_keuangan") return "Dikirim ke Keuangan";
  if (status === "diproses_keuangan") return "Diproses Keuangan";
  if (status === "dibayar") return "Dibayar";
  if (status === "locked") return "Locked";
  return status;
}

function statusVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "locked" || status === "dibayar") return "default";
  if (status === "dikirim_ke_keuangan" || status === "diproses_keuangan")
    return "secondary";
  return "outline";
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-");
}

function toDateTimeText(value: Date | null) {
  if (!value) return "-";
  return value.toLocaleString("id-ID", { timeZone: APP_TIME_ZONE });
}

export function FinanceBatchList({ initialBatches }: FinanceBatchListProps) {
  const [pending, startTransition] = useTransition();
  const [batches, setBatches] = useState(initialBatches);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<BatchStatusFilter>("all");

  const exportFilters = {
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    status: statusFilter === "all" ? "all" : statusFilter,
  } as const;

  function handleApplyFilter() {
    startTransition(async () => {
      try {
        const result = await listHonorariumBatches({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          financeOnly: true,
        });
        setBatches(result);
        toast.success("Antrian diperbarui.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Filter tidak valid.",
        );
      }
    });
  }

  function handleSetCurrentMonth() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const toIso = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    setStartDate(toIso(start));
    setEndDate(toIso(now));
    toast.success("Filter bulanan (bulan ini) diterapkan.");
  }

  function handleExportExcel() {
    startTransition(async () => {
      try {
        const result = await exportFinanceHonorariumRecapExcel(exportFilters);
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
        const a = document.createElement("a");
        a.href = url;
        a.download = result.data.fileName;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Excel rekap keuangan berhasil diekspor.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal export Excel rekap.",
        );
      }
    });
  }

  function handleExportPdf() {
    startTransition(async () => {
      try {
        const recap = await getFinanceHonorariumRecap(exportFilters);
        if (recap.rows.length === 0) {
          toast.info("Tidak ada data batch pada filter ini.");
          return;
        }

        const { default: jsPDF } = await import("jspdf");
        const { default: autoTable } = await import("jspdf-autotable");

        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        doc.setFontSize(14);
        doc.text("REKAP HONORARIUM KEUANGAN", 14, 14);
        doc.setFontSize(9);
        doc.text(
          `Periode: ${recap.filters.startDate} s.d. ${recap.filters.endDate}`,
          14,
          20,
        );
        doc.text(`Status: ${recap.filters.status}`, 14, 25);
        doc.text(`Total Batch: ${recap.totals.batchCount}`, 14, 30);
        doc.text(`Total Net: ${formatCurrency(recap.totals.netAmount)}`, 60, 30);
        doc.text(
          `Total Dibayar: ${formatCurrency(recap.totals.paidAmount)}`,
          120,
          30,
        );

        autoTable(doc, {
          startY: 35,
          head: [[
            "Dokumen",
            "Periode",
            "Status",
            "Sesi",
            "Net",
            "Nominal Dibayar",
            "Selisih",
            "Referensi Transfer",
            "Tgl Dibayar",
          ]],
          body: recap.rows.map((row) => [
            row.documentNumber,
            `${row.periodStart} s.d. ${row.periodEnd}`,
            row.statusLabel,
            String(row.itemCount),
            formatCurrency(row.netAmount),
            row.paidAmount === null ? "-" : formatCurrency(row.paidAmount),
            row.reconciliationDiff === null
              ? "-"
              : formatCurrency(row.reconciliationDiff),
            row.paymentReference ?? "-",
            toDateTimeText(row.paidAt),
          ]),
          theme: "grid",
          styles: { fontSize: 7.5, cellPadding: 1.7 },
          headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
          columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 35 },
            2: { cellWidth: 24 },
            3: { cellWidth: 12, halign: "right" },
            4: { cellWidth: 24, halign: "right" },
            5: { cellWidth: 30, halign: "right" },
            6: { cellWidth: 22, halign: "right" },
            7: { cellWidth: 44 },
            8: { cellWidth: 28 },
          },
        });

        const fileName = sanitizeFileName(
          `rekap-keuangan-honorarium-${recap.filters.startDate}-${recap.filters.endDate}.pdf`,
        );
        doc.save(fileName);
        toast.success("PDF rekap keuangan berhasil diekspor.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal export PDF rekap.");
      }
    });
  }

  return (
    <Card className="rounded-[28px]">
      <CardHeader className="border-b border-border">
        <CardTitle>Antrian Pembayaran Honorarium</CardTitle>
        <CardDescription>
          Batch yang sudah dikirim ke keuangan oleh admin/staff.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="grid gap-3 md:grid-cols-[160px_160px_200px_auto]">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Tanggal Mulai</p>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Tanggal Akhir</p>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Status</p>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as BatchStatusFilter)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Semua status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                <SelectItem value="dikirim_ke_keuangan">
                  Dikirim ke Keuangan
                </SelectItem>
                <SelectItem value="diproses_keuangan">
                  Diproses Keuangan
                </SelectItem>
                <SelectItem value="dibayar">Dibayar</SelectItem>
                <SelectItem value="locked">Locked</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleSetCurrentMonth} disabled={pending}>
                Bulan Ini
              </Button>
              <Button onClick={handleApplyFilter} disabled={pending}>
                <Filter className="h-4 w-4 mr-1" />
                Terapkan
              </Button>
              <Button variant="outline" onClick={handleExportPdf} disabled={pending}>
                <Download className="h-4 w-4 mr-1" />
                PDF
              </Button>
              <Button variant="outline" onClick={handleExportExcel} disabled={pending}>
                <Download className="h-4 w-4 mr-1" />
                Excel
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  No. Dokumen
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Periode
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Sesi
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Net
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Tgl Kirim
                </th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Belum ada batch masuk ke antrian keuangan.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr
                    key={batch.id}
                    className="border-b border-border hover:bg-muted/50"
                  >
                    <td className="px-4 py-3 font-medium">
                      {batch.documentNumber}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {batch.periodStart} s.d. {batch.periodEnd}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {batch.itemCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium">
                      {formatCurrency(batch.netAmount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={statusVariant(batch.status)}>
                        {statusLabel(batch.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {batch.submittedAt
                        ? formatTanggalPendek(batch.submittedAt)
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/keuangan/honorarium/${batch.id}`}>
                          <Eye className="h-4 w-4 mr-1" />
                          Detail
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
