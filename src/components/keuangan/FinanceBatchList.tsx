"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { toast } from "sonner";
import {
  ArrowUpDown,
  Download,
  Eye,
  Filter,
  Kanban,
  ListChecks,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import {
  bulkMarkHonorariumBatchesInProcess,
  exportFinanceHonorariumRecapExcel,
  getFinanceHonorariumRecap,
  listHonorariumBatchesPage,
} from "@/server/actions/jadwal-otomatis/honorarium";
import type {
  HonorariumBatchPage,
  HonorariumBatchRow,
  HonorariumBatchSortBy,
  HonorariumBatchSortDir,
} from "@/server/actions/jadwal-otomatis/honorarium";
import { APP_TIME_ZONE, formatTanggalPendek } from "@/lib/utils";

type BatchStatusFilter =
  | "all"
  | "dikirim_ke_keuangan"
  | "diproses_keuangan"
  | "dibayar"
  | "locked";

type ViewMode = "table" | "kanban";

interface FinanceBatchListProps {
  initialPage: HonorariumBatchPage;
  initialStatus?: BatchStatusFilter;
}

const KANBAN_STATUSES = [
  "dikirim_ke_keuangan",
  "diproses_keuangan",
  "dibayar",
  "locked",
] as const;

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

function slaVariant(
  waitingDays: number,
): "default" | "secondary" | "destructive" {
  if (waitingDays > 7) return "destructive";
  if (waitingDays >= 5) return "default";
  return "secondary";
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-");
}

function toDateTimeText(value: Date | null) {
  if (!value) return "-";
  return value.toLocaleString("id-ID", { timeZone: APP_TIME_ZONE });
}

function getRowId(batch: HonorariumBatchRow) {
  return batch.id;
}

export function FinanceBatchList({
  initialPage,
  initialStatus = "all",
}: FinanceBatchListProps) {
  const [pending, startTransition] = useTransition();
  const [pageData, setPageData] = useState(initialPage);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<BatchStatusFilter>(initialStatus);
  const [sortBy, setSortBy] = useState<HonorariumBatchSortBy>("submittedAt");
  const [sortDir, setSortDir] = useState<HonorariumBatchSortDir>("asc");
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const exportFilters = {
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    status: statusFilter === "all" ? "all" : statusFilter,
  } as const;

  const selectedRows = pageData.rows.filter((row) => rowSelection[row.id]);
  const eligibleSelectedRows = selectedRows.filter(
    (row) => row.status === "dikirim_ke_keuangan",
  );
  const selectedEligibleIds = eligibleSelectedRows.map((row) => row.id);

  function loadPage(next?: {
    page?: number;
    pageSize?: number;
    sortBy?: HonorariumBatchSortBy;
    sortDir?: HonorariumBatchSortDir;
    resetSelection?: boolean;
  }) {
    const nextPage = next?.page ?? pageData.page;
    const nextPageSize = next?.pageSize ?? pageData.pageSize;
    const nextSortBy = next?.sortBy ?? sortBy;
    const nextSortDir = next?.sortDir ?? sortDir;

    startTransition(async () => {
      try {
        const result = await listHonorariumBatchesPage({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          financeOnly: true,
          page: nextPage,
          pageSize: nextPageSize,
          sortBy: nextSortBy,
          sortDir: nextSortDir,
        });
        setPageData(result);
        if (next?.resetSelection !== false) setRowSelection({});
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Antrian gagal dimuat.",
        );
      }
    });
  }

  function handleApplyFilter() {
    loadPage({ page: 1, resetSelection: true });
    toast.success("Filter antrian diterapkan.");
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
    toast.success("Filter bulanan siap diterapkan.");
  }

  function handleSort(column: HonorariumBatchSortBy) {
    const nextDir = sortBy === column && sortDir === "asc" ? "desc" : "asc";
    setSortBy(column);
    setSortDir(nextDir);
    loadPage({
      page: 1,
      sortBy: column,
      sortDir: nextDir,
      resetSelection: true,
    });
  }

  function handleBulkProcess() {
    if (selectedEligibleIds.length === 0) {
      toast.info("Pilih batch status Dikirim ke Keuangan terlebih dahulu.");
      return;
    }

    startTransition(async () => {
      const result =
        await bulkMarkHonorariumBatchesInProcess(selectedEligibleIds);
      if (result.ok) {
        toast.success(`${result.processed} batch ditandai diproses.`);
      } else {
        toast.warning(
          `${result.processed} batch berhasil, ${result.failed} gagal diproses.`,
        );
      }
      loadPage({ page: pageData.page, resetSelection: true });
    });
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

        const doc = new jsPDF({
          orientation: "landscape",
          unit: "mm",
          format: "a4",
        });
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
        doc.text(
          `Total Net: ${formatCurrency(recap.totals.netAmount)}`,
          60,
          30,
        );
        doc.text(
          `Total Dibayar: ${formatCurrency(recap.totals.paidAmount)}`,
          120,
          30,
        );

        autoTable(doc, {
          startY: 35,
          head: [
            [
              "Dokumen",
              "Periode",
              "Status",
              "Sesi",
              "Net",
              "Nominal Dibayar",
              "Selisih",
              "Referensi Transfer",
              "Tgl Dibayar",
            ],
          ],
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
        });

        const fileName = sanitizeFileName(
          `rekap-keuangan-honorarium-${recap.filters.startDate}-${recap.filters.endDate}.pdf`,
        );
        doc.save(fileName);
        toast.success("PDF rekap keuangan berhasil diekspor.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal export PDF rekap.",
        );
      }
    });
  }

  const columns: ColumnDef<HonorariumBatchRow>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Pilih semua batch"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          disabled={row.original.status !== "dikirim_ke_keuangan"}
          aria-label={`Pilih ${row.original.documentNumber}`}
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: "documentNumber",
      header: () => (
        <SortButton
          label="No. Dokumen"
          column="documentNumber"
          onSort={handleSort}
        />
      ),
      cell: ({ row }) => (
        <div className="min-w-[12rem]">
          <p className="font-medium">{row.original.documentNumber}</p>
          <p className="text-xs text-muted-foreground">
            {formatTanggalPendek(row.original.periodStart)} s.d.{" "}
            {formatTanggalPendek(row.original.periodEnd)}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "itemCount",
      header: () => (
        <SortButton label="Sesi" column="itemCount" onSort={handleSort} />
      ),
      cell: ({ row }) => (
        <div className="text-right tabular-nums">{row.original.itemCount}</div>
      ),
    },
    {
      accessorKey: "netAmount",
      header: () => (
        <SortButton label="Net" column="netAmount" onSort={handleSort} />
      ),
      cell: ({ row }) => (
        <div className="text-right font-medium tabular-nums">
          {formatCurrency(row.original.netAmount)}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: () => (
        <SortButton label="Status" column="status" onSort={handleSort} />
      ),
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.original.status)}>
          {statusLabel(row.original.status)}
        </Badge>
      ),
    },
    {
      accessorKey: "waitingDays",
      header: () => (
        <SortButton
          label="Waktu Menunggu"
          column="waitingDays"
          onSort={handleSort}
        />
      ),
      cell: ({ row }) =>
        row.original.status === "dikirim_ke_keuangan" ? (
          <Badge variant={slaVariant(row.original.waitingDays)}>
            {row.original.waitingDays} hari
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      accessorKey: "submittedAt",
      header: () => (
        <SortButton
          label="Tgl Kirim"
          column="submittedAt"
          onSort={handleSort}
        />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatTanggalPendek(row.original.submittedAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => (
        <Button asChild variant="outline" size="sm">
          <Link href={`/keuangan/honorarium/${row.original.id}`}>
            <Eye className="mr-1 h-4 w-4" />
            Detail
          </Link>
        </Button>
      ),
    },
  ];

  const table = useReactTable({
    data: pageData.rows,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: pageData.totalPages,
    state: {
      rowSelection,
      pagination: {
        pageIndex: Math.max(0, pageData.page - 1),
        pageSize: pageData.pageSize,
      },
    },
    enableRowSelection: (row) => row.original.status === "dikirim_ke_keuangan",
    onRowSelectionChange: setRowSelection,
  });

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle>Antrian Pembayaran Honorarium</CardTitle>
        <CardDescription>
          Batch yang sudah dikirim ke keuangan oleh admin/staff.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <div className="grid gap-3 md:grid-cols-[160px_160px_200px_1fr]">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Tanggal Mulai</p>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Tanggal Akhir</p>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Status</p>
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
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={handleSetCurrentMonth}
                disabled={pending}
              >
                Bulan Ini
              </Button>
              <Button onClick={handleApplyFilter} disabled={pending}>
                <Filter className="mr-1 h-4 w-4" />
                Terapkan
              </Button>
              <Button
                variant="outline"
                onClick={handleExportPdf}
                disabled={pending}
              >
                <Download className="mr-1 h-4 w-4" />
                PDF
              </Button>
              <Button
                variant="outline"
                onClick={handleExportExcel}
                disabled={pending}
              >
                <Download className="mr-1 h-4 w-4" />
                Excel
              </Button>
            </div>
          </div>
        </div>

        <section className="grid gap-3 md:grid-cols-3">
          <SummaryTile
            label="Batch Filter"
            value={String(pageData.totals.batchCount)}
          />
          <SummaryTile
            label="Outstanding"
            value={formatCurrency(pageData.totals.outstandingAmount)}
          />
          <SummaryTile
            label="Total Net"
            value={formatCurrency(pageData.totals.netAmount)}
          />
        </section>

        <Tabs
          value={viewMode}
          onValueChange={(value) => setViewMode(value as ViewMode)}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="table">
                <ListChecks className="h-4 w-4" />
                Tabel
              </TabsTrigger>
              <TabsTrigger value="kanban">
                <Kanban className="h-4 w-4" />
                Kanban
              </TabsTrigger>
            </TabsList>
            <Button
              onClick={handleBulkProcess}
              disabled={pending || selectedEligibleIds.length === 0}
            >
              Tandai Diproses ({selectedEligibleIds.length})
            </Button>
          </div>

          <TabsContent value="table" className="mt-4 space-y-3">
            <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
              <Table className="min-w-[58rem]">
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.length > 0 ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="transition-colors hover:bg-muted/30"
                        data-state={
                          row.getIsSelected() ? "selected" : undefined
                        }
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="p-4">
                        <EmptyState
                          icon={WalletCards}
                          title="Belum ada batch honorarium"
                          description="Batch yang dikirim ke keuangan akan muncul di antrian ini."
                          className="min-h-44"
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="text-muted-foreground">
                {pageData.totalRows} baris · Halaman {pageData.page} /{" "}
                {pageData.totalPages || 1}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Select
                  value={String(pageData.pageSize)}
                  onValueChange={(value) =>
                    loadPage({
                      page: 1,
                      pageSize: Number(value),
                      resetSelection: true,
                    })
                  }
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 / hlm</SelectItem>
                    <SelectItem value="20">20 / hlm</SelectItem>
                    <SelectItem value="50">50 / hlm</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadPage({ page: pageData.page - 1 })}
                  disabled={pending || pageData.page <= 1}
                >
                  Sebelumnya
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadPage({ page: pageData.page + 1 })}
                  disabled={pending || pageData.page >= pageData.totalPages}
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="kanban" className="mt-4">
            <FinanceKanban batches={pageData.rows} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function SortButton({
  label,
  column,
  onSort,
}: {
  label: string;
  column: HonorariumBatchSortBy;
  onSort: (column: HonorariumBatchSortBy) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground"
    >
      {label}
      <ArrowUpDown className="h-3.5 w-3.5" />
    </button>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function FinanceKanban({ batches }: { batches: HonorariumBatchRow[] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-4">
      {KANBAN_STATUSES.map((status) => {
        const rows = batches.filter((batch) => batch.status === status);
        return (
          <section
            key={status}
            className="min-h-44 rounded-lg border border-border/60 bg-muted/20 p-3"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{statusLabel(status)}</h3>
              <Badge variant="outline">{rows.length}</Badge>
            </div>
            <div className="space-y-2">
              {rows.length > 0 ? (
                rows.map((batch) => (
                  <Link
                    key={batch.id}
                    href={`/keuangan/honorarium/${batch.id}`}
                    className="block rounded-lg border border-border/60 bg-card p-3 text-sm transition-all hover:border-primary/20 hover:bg-muted/35 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-1 font-medium">
                        {batch.documentNumber}
                      </p>
                      {status === "dikirim_ke_keuangan" ? (
                        <Badge variant={slaVariant(batch.waitingDays)}>
                          {batch.waitingDays}h
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatTanggalPendek(batch.periodStart)} s.d.{" "}
                      {formatTanggalPendek(batch.periodEnd)}
                    </p>
                    <p className="mt-2 font-medium">
                      {formatCurrency(batch.netAmount)}
                    </p>
                  </Link>
                ))
              ) : (
                <EmptyState
                  icon={WalletCards}
                  description="Tidak ada batch pada status ini."
                  className="min-h-28 px-3 py-5"
                />
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
