"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { toast } from "sonner";
import { ArrowUpDown, Download, Eye, Filter, FilePlus2, Kanban, ListChecks, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  deleteHonorariumBatch, generateHonorariumBatch, getHonorariumReport,
  getSuggestedHonorariumBatchPeriod, listHonorariumBatchesPage, previewHonorariumBatchGeneration,
} from "@/server/actions/jadwal-otomatis/honorarium";
import type { HonorariumBatchPage, HonorariumBatchRow, HonorariumBatchSortBy, HonorariumBatchSortDir } from "@/server/actions/jadwal-otomatis/honorarium";
import { APP_TIME_ZONE, formatTanggalPendek } from "@/lib/utils";

type Option = { id: string; name: string };
type ReportData = Awaited<ReturnType<typeof getHonorariumReport>>;
type BatchPage = HonorariumBatchPage;
type PeriodSuggestion = Awaited<ReturnType<typeof getSuggestedHonorariumBatchPeriod>>;
type GenPreview = Awaited<ReturnType<typeof previewHonorariumBatchGeneration>>;
type BatchStatusFilter = "" | "draft" | "dikirim_ke_keuangan" | "diproses_keuangan" | "dibayar" | "locked" | "all";
type ViewMode = "table" | "kanban";

interface Props {
  instructors: Option[];
  programs: Option[];
  initialReport: ReportData;
  initialBatches: BatchPage;
  suggestedBatchPeriod: PeriodSuggestion;
}

function fmtCurrency(v: number) { return `Rp ${Math.round(v).toLocaleString("id-ID")}`; }
function sanitize(v: string) { return v.replace(/[\\/:*?"<>|]/g, "-"); }
function statusLabel(s: string) {
  const m: Record<string, string> = { draft: "Draft", dikirim_ke_keuangan: "Dikirim ke Keuangan", diproses_keuangan: "Diproses Keuangan", dibayar: "Dibayar", locked: "Locked" };
  return m[s] ?? s;
}
function statusVariant(s: string): "default" | "secondary" | "outline" | "destructive" {
  if (s === "dibayar" || s === "locked") return "default";
  if (s === "draft") return "secondary";
  return "outline";
}
function slaVariant(d: number): "default" | "secondary" | "destructive" {
  if (d > 7) return "destructive";
  if (d >= 5) return "default";
  return "secondary";
}
function rateSourceLabel(v: "override_instructor" | "matrix_standard" | "missing") {
  if (v === "override_instructor") return "Override Instruktur";
  if (v === "matrix_standard") return "Matriks Standar";
  return "Rate Missing";
}
function rateSourceVariant(v: "override_instructor" | "matrix_standard" | "missing"): "secondary" | "outline" | "destructive" {
  if (v === "override_instructor") return "secondary";
  if (v === "matrix_standard") return "outline";
  return "destructive";
}

const KANBAN_STATUSES = ["draft", "dikirim_ke_keuangan", "diproses_keuangan", "dibayar", "locked"] as const;

export function HonorariumReport({ instructors, programs, initialReport, initialBatches, suggestedBatchPeriod }: Props) {
  const [pending, startTransition] = useTransition();
  const [report, setReport] = useState(initialReport);
  const [pageData, setPageData] = useState(initialBatches);
  const [startDate, setStartDate] = useState(initialReport.appliedFilters.startDate);
  const [endDate, setEndDate] = useState(initialReport.appliedFilters.endDate);
  const [instructorId, setInstructorId] = useState(initialReport.appliedFilters.instructorId);
  const [programId, setProgramId] = useState(initialReport.appliedFilters.programId);
  const [batchStartDate, setBatchStartDate] = useState(suggestedBatchPeriod.startDate);
  const [batchEndDate, setBatchEndDate] = useState(suggestedBatchPeriod.endDate);
  const [batchStatus, setBatchStatus] = useState<BatchStatusFilter>("all");
  const [batchScope, setBatchScope] = useState<"all" | "finance">("all");
  const [activeSuggestion, setActiveSuggestion] = useState(suggestedBatchPeriod);
  const [genPreview, setGenPreview] = useState<GenPreview | null>(null);
  const [sortBy, setSortBy] = useState<HonorariumBatchSortBy>("createdAt");
  const [sortDir, setSortDir] = useState<HonorariumBatchSortDir>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const rows = report.rows;
  const totalInfo = useMemo(() => ({ sessions: report.totals.sessionCount, amount: report.totals.totalAmount, avg: report.totals.sessionCount > 0 ? report.totals.totalAmount / report.totals.sessionCount : 0 }), [report.totals]);

  function loadPage(next?: { page?: number; pageSize?: number; sortBy?: HonorariumBatchSortBy; sortDir?: HonorariumBatchSortDir }) {
    startTransition(async () => {
      try {
        const result = await listHonorariumBatchesPage({
          startDate: batchStartDate || undefined, endDate: batchEndDate || undefined,
          status: batchStatus === "all" ? undefined : batchStatus, financeOnly: batchScope === "finance",
          page: next?.page ?? pageData.page, pageSize: next?.pageSize ?? pageData.pageSize,
          sortBy: next?.sortBy ?? sortBy, sortDir: next?.sortDir ?? sortDir,
        });
        setPageData(result);
      } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal memuat batch."); }
    });
  }

  function handleApplyFilter() {
    startTransition(async () => {
      try { const res = await getHonorariumReport({ startDate: startDate || undefined, endDate: endDate || undefined, instructorId: instructorId || undefined, programId: programId || undefined }); setReport(res); toast.success("Laporan honorarium diperbarui"); }
      catch { toast.error("Filter tidak valid."); }
    });
  }

  async function runPreview() {
    const p = await previewHonorariumBatchGeneration({ startDate: batchStartDate, endDate: batchEndDate, internalNotes: "" });
    setGenPreview(p);
    return p;
  }

  function handleApplySuggestedPeriod() { setBatchStartDate(activeSuggestion.startDate); setBatchEndDate(activeSuggestion.endDate); toast.success("Periode saran diterapkan."); }

  function handleGenerateDraftBatch() {
    if (!batchStartDate || !batchEndDate) { toast.error("Pilih periode tanggal terlebih dahulu."); return; }
    startTransition(async () => {
      try {
        const p = await runPreview();
        if (p.eligibleCount === 0) { toast.info("Tidak ada sesi eligible."); return; }
        if (p.missingRateCount > 0) { toast.error(`Ada ${p.missingRateCount} sesi tanpa tarif.`); return; }
        if (p.conflictingAssignmentCount > 0) { toast.error(`Bentrok ${p.conflictingAssignmentCount} sesi.`); return; }
        const result = await generateHonorariumBatch({ startDate: batchStartDate, endDate: batchEndDate, internalNotes: "" });
        if (!result.ok) { toast.error(result.message); return; }
        loadPage({ page: 1 });
        const s = await getSuggestedHonorariumBatchPeriod(); setActiveSuggestion(s);
        toast.success(`Draft ${result.documentNumber} dibuat (${result.itemCount} sesi).`);
      } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal generate draft."); }
    });
  }

  function handleApplyBatchFilter() { loadPage({ page: 1 }); toast.success("Queue batch diperbarui."); }

  function handleDeleteDraftBatch(batchId: string, docNum: string) {
    if (!confirm(`Hapus batch ${docNum}?`)) return;
    startTransition(async () => {
      try { await deleteHonorariumBatch(batchId); loadPage({ page: 1 }); const s = await getSuggestedHonorariumBatchPeriod(); setActiveSuggestion(s); setGenPreview(null); toast.success(`Batch ${docNum} dihapus.`); }
      catch (e) { toast.error(e instanceof Error ? e.message : "Gagal hapus batch."); }
    });
  }

  function handleCheckGeneration() {
    if (!batchStartDate || !batchEndDate) { toast.error("Pilih periode tanggal."); return; }
    startTransition(async () => {
      try {
        const p = await runPreview();
        if (p.conflictingAssignmentCount > 0) { toast.error(`Bentrok: ${p.conflictingAssignmentCount} sesi.`); return; }
        if (p.missingRateCount > 0) { toast.warning(`${p.missingRateCount} sesi tanpa tarif.`); return; }
        toast.success(`Aman. Eligible ${p.eligibleCount} sesi.`);
      } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal cek."); }
    });
  }

  function handleSort(column: HonorariumBatchSortBy) {
    const nextDir = sortBy === column && sortDir === "asc" ? "desc" : "asc";
    setSortBy(column); setSortDir(nextDir);
    loadPage({ page: 1, sortBy: column, sortDir: nextDir });
  }

  function handleExportPdf() {
    startTransition(async () => {
      if (rows.length === 0) { toast.info("Tidak ada data."); return; }
      try {
        const { default: jsPDF } = await import("jspdf");
        const { default: autoTable } = await import("jspdf-autotable");
        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        doc.setFontSize(14); doc.text("LAPORAN HONORARIUM INSTRUKTUR", 14, 14);
        doc.setFontSize(9);
        doc.text(`Periode: ${report.appliedFilters.startDate} s.d. ${report.appliedFilters.endDate}`, 14, 20);
        doc.text(`Total sesi: ${totalInfo.sessions}`, 14, 25); doc.text(`Total honor: ${fmtCurrency(totalInfo.amount)}`, 66, 25);
        autoTable(doc, { startY: 30, head: [["Tanggal", "Kelas", "Program", "Materi", "Instruktur", "Sumber", "Sumber Rate", "Honor", "Transport", "Total"]], body: rows.map((r) => [r.scheduledDate, r.namaKelas, r.programName, r.materiBlock, r.paidInstructorName, r.source === "actual" ? "Substitusi" : "Planned", rateSourceLabel(r.rateSource), fmtCurrency(r.honorAmount), fmtCurrency(r.transportAmount), fmtCurrency(r.totalAmount)]), theme: "grid", styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] }, columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 34 }, 2: { cellWidth: 22 }, 3: { cellWidth: 30 }, 4: { cellWidth: 30 }, 5: { cellWidth: 18, halign: "center" }, 6: { cellWidth: 24 }, 7: { cellWidth: 20, halign: "right" }, 8: { cellWidth: 20, halign: "right" }, 9: { cellWidth: 20, halign: "right" } } });
        doc.save(sanitize(`laporan-honorarium-${report.appliedFilters.startDate}-${report.appliedFilters.endDate}.pdf`));
        toast.success("PDF berhasil diekspor.");
      } catch (e) { toast.error(e instanceof Error ? e.message : "Gagal ekspor PDF."); }
    });
  }

  const columns: ColumnDef<HonorariumBatchRow>[] = [
    { accessorKey: "documentNumber", header: () => <SortBtn label="No. Dokumen" column="documentNumber" onSort={handleSort} />, cell: ({ row }) => <div className="min-w-[12rem]"><p className="font-medium">{row.original.documentNumber}</p><p className="text-xs text-muted-foreground">{formatTanggalPendek(row.original.periodStart)} s.d. {formatTanggalPendek(row.original.periodEnd)}</p></div> },
    { accessorKey: "itemCount", header: () => <SortBtn label="Sesi" column="itemCount" onSort={handleSort} />, cell: ({ row }) => <div className="text-right tabular-nums">{row.original.itemCount}</div> },
    { accessorKey: "grossAmount", header: "Gross", cell: ({ row }) => <div className="text-right tabular-nums">{fmtCurrency(row.original.grossAmount)}</div> },
    { accessorKey: "netAmount", header: () => <SortBtn label="Net" column="netAmount" onSort={handleSort} />, cell: ({ row }) => <div className="text-right font-medium tabular-nums">{fmtCurrency(row.original.netAmount)}</div> },
    { accessorKey: "status", header: () => <SortBtn label="Status" column="status" onSort={handleSort} />, cell: ({ row }) => <Badge variant={statusVariant(row.original.status)}>{statusLabel(row.original.status)}</Badge> },
    { accessorKey: "waitingDays", header: () => <SortBtn label="Menunggu" column="waitingDays" onSort={handleSort} />, cell: ({ row }) => row.original.status === "dikirim_ke_keuangan" ? <Badge variant={slaVariant(row.original.waitingDays)}>{row.original.waitingDays}h</Badge> : <span className="text-muted-foreground">-</span> },
    { accessorKey: "createdAt", header: () => <SortBtn label="Dibuat" column="createdAt" onSort={handleSort} />, cell: ({ row }) => <span className="text-muted-foreground">{new Date(row.original.createdAt).toLocaleString("id-ID", { timeZone: APP_TIME_ZONE })}</span> },
    { id: "actions", header: "Aksi", cell: ({ row }) => <div className="flex items-center gap-1"><Button asChild variant="ghost" size="sm"><Link href={`/jadwal-otomatis/honorarium/${row.original.id}`}><Eye className="h-4 w-4 mr-1" />Detail</Link></Button>{row.original.status === "draft" ? <Button variant="ghost" size="sm" onClick={() => handleDeleteDraftBatch(row.original.id, row.original.documentNumber)} disabled={pending}><Trash2 className="h-4 w-4 mr-1" />Hapus</Button> : null}</div> },
  ];

  const table = useReactTable({ data: pageData.rows, columns, getRowId: (r) => r.id, getCoreRowModel: getCoreRowModel(), manualPagination: true, pageCount: pageData.totalPages, state: { pagination: { pageIndex: Math.max(0, pageData.page - 1), pageSize: pageData.pageSize } } });

  return (
    <div className="space-y-6">
      {/* Filter Laporan */}
      <Card>
        <CardHeader className="border-b border-border"><CardTitle>Filter Laporan</CardTitle><CardDescription>Filter berdasarkan periode, instruktur, dan program.</CardDescription></CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            <div><p className="text-xs text-muted-foreground mb-1">Tanggal Mulai</p><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><p className="text-xs text-muted-foreground mb-1">Tanggal Akhir</p><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
            <div><p className="text-xs text-muted-foreground mb-1">Instruktur</p><Select value={instructorId || "all"} onValueChange={(v) => setInstructorId(v === "all" ? "" : v)}><SelectTrigger><SelectValue placeholder="Semua" /></SelectTrigger><SelectContent><SelectItem value="all">Semua instruktur</SelectItem>{instructors.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent></Select></div>
            <div><p className="text-xs text-muted-foreground mb-1">Program</p><Select value={programId || "all"} onValueChange={(v) => setProgramId(v === "all" ? "" : v)}><SelectTrigger><SelectValue placeholder="Semua" /></SelectTrigger><SelectContent><SelectItem value="all">Semua program</SelectItem>{programs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex items-end gap-2"><Button onClick={handleApplyFilter} disabled={pending} className="flex-1"><Filter className="h-4 w-4 mr-1" />Terapkan</Button><Button variant="outline" onClick={handleExportPdf} disabled={pending}><Download className="h-4 w-4" /></Button></div>
          </div>
        </CardContent>
      </Card>

      {/* Batch Queue */}
      <Card>
        <CardHeader className="border-b border-border">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div><CardTitle>Batch Honorarium Internal</CardTitle><CardDescription>Generate draft dari periode terpilih.</CardDescription><p className="mt-2 text-xs text-muted-foreground">Saran periode: {activeSuggestion.startDate} s.d. {activeSuggestion.endDate}{activeSuggestion.hasExistingBatch && activeSuggestion.sourceDocumentNumber ? ` (setelah ${activeSuggestion.sourceDocumentNumber})` : ""}</p></div>
            <div className="flex items-center gap-2"><Button variant="outline" onClick={handleApplySuggestedPeriod} disabled={pending}>Gunakan Saran</Button><Button variant="outline" onClick={handleCheckGeneration} disabled={pending}>Cek Kelayakan</Button><Button onClick={handleGenerateDraftBatch} disabled={pending}><FilePlus2 className="h-4 w-4 mr-1" />Generate Draft</Button></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="grid gap-3 md:grid-cols-5">
            <div><p className="text-xs text-muted-foreground mb-1">Periode Mulai</p><Input type="date" value={batchStartDate} onChange={(e) => setBatchStartDate(e.target.value)} /></div>
            <div><p className="text-xs text-muted-foreground mb-1">Periode Akhir</p><Input type="date" value={batchEndDate} onChange={(e) => setBatchEndDate(e.target.value)} /></div>
            <div><p className="text-xs text-muted-foreground mb-1">Status</p><Select value={batchStatus} onValueChange={(v) => setBatchStatus(v as BatchStatusFilter)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="dikirim_ke_keuangan">Dikirim</SelectItem><SelectItem value="diproses_keuangan">Diproses</SelectItem><SelectItem value="dibayar">Dibayar</SelectItem><SelectItem value="locked">Locked</SelectItem></SelectContent></Select></div>
            <div><p className="text-xs text-muted-foreground mb-1">Mode</p><Select value={batchScope} onValueChange={(v) => setBatchScope(v as "all" | "finance")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua batch</SelectItem><SelectItem value="finance">Antrian keuangan</SelectItem></SelectContent></Select></div>
            <div className="flex items-end"><Button onClick={handleApplyBatchFilter} disabled={pending} className="w-full"><Filter className="h-4 w-4 mr-1" />Terapkan</Button></div>
          </div>
          {genPreview ? <div className="text-xs text-muted-foreground">Eligible: {genPreview.eligibleCount} sesi · Missing Tarif: {genPreview.missingRateCount} · Bentrok: {genPreview.conflictingAssignmentCount}</div> : null}

          <section className="grid gap-3 md:grid-cols-3">
            <SummaryTile label="Total Batch" value={String(pageData.totals.batchCount)} />
            <SummaryTile label="Outstanding" value={fmtCurrency(pageData.totals.outstandingAmount)} />
            <SummaryTile label="Total Net" value={fmtCurrency(pageData.totals.netAmount)} />
          </section>

          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="table"><ListChecks className="h-4 w-4" />Tabel</TabsTrigger>
              <TabsTrigger value="kanban"><Kanban className="h-4 w-4" />Kanban</TabsTrigger>
            </TabsList>
            <TabsContent value="table" className="mt-4 space-y-3">
              <div className="overflow-hidden rounded-md border bg-card">
                <Table className="min-w-[58rem]">
                  <TableHeader>{table.getHeaderGroups().map((hg) => <TableRow key={hg.id}>{hg.headers.map((h) => <TableHead key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</TableHead>)}</TableRow>)}</TableHeader>
                  <TableBody>{table.getRowModel().rows.length > 0 ? table.getRowModel().rows.map((r) => <TableRow key={r.id}>{r.getVisibleCells().map((c) => <TableCell key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</TableCell>)}</TableRow>) : <TableRow><TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">Belum ada batch.</TableCell></TableRow>}</TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="text-muted-foreground">{pageData.totalRows} baris · Halaman {pageData.page} / {pageData.totalPages || 1}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={String(pageData.pageSize)} onValueChange={(v) => loadPage({ page: 1, pageSize: Number(v) })}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10 / hlm</SelectItem><SelectItem value="20">20 / hlm</SelectItem><SelectItem value="50">50 / hlm</SelectItem></SelectContent></Select>
                  <Button variant="outline" size="sm" onClick={() => loadPage({ page: pageData.page - 1 })} disabled={pending || pageData.page <= 1}>Sebelumnya</Button>
                  <Button variant="outline" size="sm" onClick={() => loadPage({ page: pageData.page + 1 })} disabled={pending || pageData.page >= pageData.totalPages}>Berikutnya</Button>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="kanban" className="mt-4"><PelatihanKanban batches={pageData.rows} /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Summary Tiles */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardDescription>Total Sesi</CardDescription></CardHeader><CardContent><p className="text-2xl font-semibold tabular-nums">{totalInfo.sessions}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Total Honorarium</CardDescription></CardHeader><CardContent><p className="text-2xl font-semibold tabular-nums">{fmtCurrency(totalInfo.amount)}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Rata-rata per Sesi</CardDescription></CardHeader><CardContent><p className="text-2xl font-semibold tabular-nums">{fmtCurrency(totalInfo.avg)}</p></CardContent></Card>
      </div>

      {/* Summary by Instructor */}
      <Card>
        <CardHeader className="border-b border-border"><CardTitle>Ringkasan per Instruktur</CardTitle></CardHeader>
        <CardContent className="pt-6">{report.summaryByInstructor.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada data.</p> : <div className="flex flex-wrap gap-2">{report.summaryByInstructor.map((r) => <Badge key={r.key} variant="secondary" className="px-3 py-1 text-sm">{r.label}: {r.sessionCount} sesi · {fmtCurrency(r.totalAmount)}</Badge>)}</div>}</CardContent>
      </Card>

      {/* Summary by Program */}
      <Card>
        <CardHeader className="border-b border-border"><CardTitle>Ringkasan per Program</CardTitle></CardHeader>
        <CardContent className="pt-6">{report.summaryByProgram.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada data.</p> : <div className="flex flex-wrap gap-2">{report.summaryByProgram.map((r) => <Badge key={r.key} variant="outline" className="px-3 py-1 text-sm">{r.label}: {r.sessionCount} sesi · {fmtCurrency(r.totalAmount)}</Badge>)}</div>}</CardContent>
      </Card>

      {/* Detail Session Table */}
      <Card>
        <CardHeader className="border-b border-border"><CardTitle>Detail Honorarium Sesi</CardTitle></CardHeader>
        <CardContent className="pt-6 p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border"><th className="text-left px-6 py-3 font-medium text-muted-foreground">Tanggal</th><th className="text-left px-6 py-3 font-medium text-muted-foreground">Kelas</th><th className="text-left px-6 py-3 font-medium text-muted-foreground">Program</th><th className="text-left px-6 py-3 font-medium text-muted-foreground">Materi</th><th className="text-left px-6 py-3 font-medium text-muted-foreground">Instruktur</th><th className="text-left px-6 py-3 font-medium text-muted-foreground">Sumber</th><th className="text-left px-6 py-3 font-medium text-muted-foreground">Sumber Rate</th><th className="text-right px-6 py-3 font-medium text-muted-foreground">Honor</th><th className="text-right px-6 py-3 font-medium text-muted-foreground">Transport</th><th className="text-right px-6 py-3 font-medium text-muted-foreground">Total</th></tr></thead>
              <tbody>{rows.length === 0 ? <tr><td colSpan={10} className="px-6 py-8 text-center text-muted-foreground">Tidak ada data.</td></tr> : rows.map((r) => <tr key={r.assignmentId} className="border-b border-border hover:bg-muted/50"><td className="px-6 py-3">{r.scheduledDate}</td><td className="px-6 py-3 font-medium">{r.namaKelas}</td><td className="px-6 py-3">{r.programName}</td><td className="px-6 py-3">{r.materiBlock}</td><td className="px-6 py-3">{r.paidInstructorName}</td><td className="px-6 py-3"><Badge variant={r.source === "actual" ? "outline" : "secondary"}>{r.source === "actual" ? "Substitusi" : "Planned"}</Badge></td><td className="px-6 py-3"><Badge variant={rateSourceVariant(r.rateSource)}>{rateSourceLabel(r.rateSource)}</Badge></td><td className="px-6 py-3 text-right tabular-nums">{fmtCurrency(r.honorAmount)}</td><td className="px-6 py-3 text-right tabular-nums">{fmtCurrency(r.transportAmount)}</td><td className="px-6 py-3 text-right font-medium tabular-nums">{fmtCurrency(r.totalAmount)}</td></tr>)}</tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SortBtn({ label, column, onSort }: { label: string; column: HonorariumBatchSortBy; onSort: (c: HonorariumBatchSortBy) => void }) {
  return <button type="button" onClick={() => onSort(column)} className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground">{label}<ArrowUpDown className="h-3.5 w-3.5" /></button>;
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-muted/20 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>;
}

function PelatihanKanban({ batches }: { batches: HonorariumBatchRow[] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-5">
      {KANBAN_STATUSES.map((status) => {
        const rows = batches.filter((b) => b.status === status);
        return (
          <section key={status} className="min-h-44 rounded-lg border border-border bg-muted/20 p-3">
            <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">{statusLabel(status)}</h3><Badge variant="outline">{rows.length}</Badge></div>
            <div className="space-y-2">{rows.length > 0 ? rows.map((b) => <Link key={b.id} href={`/jadwal-otomatis/honorarium/${b.id}`} className="block rounded-lg border border-border bg-card p-3 text-sm transition-colors hover:bg-muted/50"><div className="flex items-start justify-between gap-2"><p className="line-clamp-1 font-medium">{b.documentNumber}</p>{status === "dikirim_ke_keuangan" ? <Badge variant={slaVariant(b.waitingDays)}>{b.waitingDays}h</Badge> : null}</div><p className="mt-2 text-xs text-muted-foreground">{formatTanggalPendek(b.periodStart)} s.d. {formatTanggalPendek(b.periodEnd)}</p><p className="mt-2 font-medium">{fmtCurrency(b.netAmount)}</p></Link>) : <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">Kosong</div>}</div>
          </section>
        );
      })}
    </div>
  );
}
