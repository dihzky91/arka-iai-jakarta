"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Download, Eye, Filter, FilePlus2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  deleteHonorariumBatch,
  generateHonorariumBatch,
  getHonorariumReport,
  getSuggestedHonorariumBatchPeriod,
  listHonorariumBatches,
  previewHonorariumBatchGeneration,
} from "@/server/actions/jadwal-otomatis/honorarium";

type Option = {
  id: string;
  name: string;
};

type HonorariumReportData = Awaited<ReturnType<typeof getHonorariumReport>>;
type HonorariumBatchData = Awaited<ReturnType<typeof listHonorariumBatches>>;
type HonorariumBatchPeriodSuggestion = Awaited<
  ReturnType<typeof getSuggestedHonorariumBatchPeriod>
>;
type HonorariumGeneratePreview = Awaited<
  ReturnType<typeof previewHonorariumBatchGeneration>
>;
type BatchStatusFilter = "" | "draft" | "dikirim_ke_keuangan" | "diproses_keuangan" | "dibayar" | "locked" | "all";

interface HonorariumReportProps {
  instructors: Option[];
  programs: Option[];
  initialReport: HonorariumReportData;
  initialBatches: HonorariumBatchData;
  suggestedBatchPeriod: HonorariumBatchPeriodSuggestion;
}

function formatCurrency(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "-");
}

function batchStatusLabel(status: string) {
  if (status === "draft") return "Draft";
  if (status === "menunggu_review_supervisor") return "Menunggu Review";
  if (status === "disetujui_supervisor") return "Disetujui Supervisor";
  if (status === "dikirim_ke_keuangan") return "Dikirim ke Keuangan";
  if (status === "diproses_keuangan") return "Diproses Keuangan";
  if (status === "dibayar") return "Dibayar";
  if (status === "locked") return "Locked";
  return status;
}

function batchStatusVariant(
  status: string,
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "dibayar" || status === "locked") return "default";
  if (status === "draft" || status === "menunggu_review_supervisor") return "secondary";
  if (status === "ditolak_supervisor") return "destructive";
  return "outline";
}

function rateSourceLabel(value: "override_instructor" | "matrix_standard" | "missing") {
  if (value === "override_instructor") return "Override Instruktur";
  if (value === "matrix_standard") return "Matriks Standar";
  return "Rate Missing";
}

function rateSourceVariant(
  value: "override_instructor" | "matrix_standard" | "missing",
): "secondary" | "outline" | "destructive" {
  if (value === "override_instructor") return "secondary";
  if (value === "matrix_standard") return "outline";
  return "destructive";
}

export function HonorariumReport({
  instructors,
  programs,
  initialReport,
  initialBatches,
  suggestedBatchPeriod,
}: HonorariumReportProps) {
  const [pending, startTransition] = useTransition();
  const [report, setReport] = useState(initialReport);
  const [batches, setBatches] = useState(initialBatches);

  const [startDate, setStartDate] = useState(initialReport.appliedFilters.startDate);
  const [endDate, setEndDate] = useState(initialReport.appliedFilters.endDate);
  const [instructorId, setInstructorId] = useState(initialReport.appliedFilters.instructorId);
  const [programId, setProgramId] = useState(initialReport.appliedFilters.programId);
  const [batchStartDate, setBatchStartDate] = useState(suggestedBatchPeriod.startDate);
  const [batchEndDate, setBatchEndDate] = useState(suggestedBatchPeriod.endDate);
  const [batchStatus, setBatchStatus] = useState<BatchStatusFilter>("all");
  const [batchScope, setBatchScope] = useState<"all" | "finance">("all");
  const [activeSuggestion, setActiveSuggestion] = useState(suggestedBatchPeriod);
  const [generationPreview, setGenerationPreview] =
    useState<HonorariumGeneratePreview | null>(null);

  const rows = report.rows;

  const totalInfo = useMemo(
    () => ({
      sessions: report.totals.sessionCount,
      amount: report.totals.totalAmount,
      avgPerSession:
        report.totals.sessionCount > 0
          ? report.totals.totalAmount / report.totals.sessionCount
          : 0,
    }),
    [report.totals],
  );

  function handleApplyFilter() {
    startTransition(async () => {
      try {
        const res = await getHonorariumReport({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          instructorId: instructorId || undefined,
          programId: programId || undefined,
        });
        setReport(res);
        toast.success("Laporan honorarium diperbarui");
      } catch {
        toast.error("Filter tidak valid. Periksa tanggal yang dipilih.");
      }
    });
  }

  async function runGeneratePreview() {
    const preview = await previewHonorariumBatchGeneration({
      startDate: batchStartDate,
      endDate: batchEndDate,
      internalNotes: "",
    });
    setGenerationPreview(preview);
    return preview;
  }

  function handleApplySuggestedPeriod() {
    setBatchStartDate(activeSuggestion.startDate);
    setBatchEndDate(activeSuggestion.endDate);
    toast.success("Periode saran diterapkan.");
  }

  function handleGenerateDraftBatch() {
    if (!batchStartDate || !batchEndDate) {
      toast.error("Pilih periode tanggal terlebih dahulu.");
      return;
    }

    startTransition(async () => {
      try {
        const preview = await runGeneratePreview();
        if (preview.eligibleCount === 0) {
          toast.info("Tidak ada sesi eligible pada periode ini.");
          return;
        }
        if (preview.missingRateCount > 0) {
          toast.error(
            `Ada ${preview.missingRateCount} sesi tanpa tarif. Lengkapi tarif dulu sebelum generate.`,
          );
          return;
        }
        if (preview.conflictingAssignmentCount > 0) {
          const sampleDocs = preview.conflictingBatches
            .slice(0, 3)
            .map((row) => row.documentNumber)
            .join(", ");
          const more =
            preview.conflictingBatches.length > 3
              ? ` +${preview.conflictingBatches.length - 3} batch`
              : "";
          toast.error(
            `Bentrok ${preview.conflictingAssignmentCount} sesi dengan batch lama (${sampleDocs}${more}).`,
          );
          return;
        }

        const result = await generateHonorariumBatch({
          startDate: batchStartDate,
          endDate: batchEndDate,
          internalNotes: "",
        });

        if (!result.ok) {
          toast.error(result.message);
          return;
        }

        const latestBatches = await listHonorariumBatches({
          startDate: batchStartDate,
          endDate: batchEndDate,
          status: batchStatus === "all" ? "" : batchStatus,
          financeOnly: batchScope === "finance",
        });
        const latestSuggestion = await getSuggestedHonorariumBatchPeriod();
        setBatches(latestBatches);
        setActiveSuggestion(latestSuggestion);
        toast.success(
          `Draft ${result.documentNumber} dibuat (${result.itemCount} sesi).`,
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal generate draft honorarium.");
      }
    });
  }

  function handleApplyBatchFilter() {
    startTransition(async () => {
      try {
        const result = await listHonorariumBatches({
          startDate: batchStartDate,
          endDate: batchEndDate,
          status: batchStatus === "all" ? "" : batchStatus,
          financeOnly: batchScope === "finance",
        });
        setBatches(result);
        toast.success("Queue batch diperbarui.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Filter batch tidak valid.");
      }
    });
  }

  function handleDeleteDraftBatch(batchId: string, documentNumber: string) {
    if (!confirm(`Hapus batch ${documentNumber}? Aksi ini tidak bisa dibatalkan.`)) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteHonorariumBatch(batchId);
        const latestBatches = await listHonorariumBatches({
          startDate: batchStartDate,
          endDate: batchEndDate,
          status: batchStatus === "all" ? "" : batchStatus,
          financeOnly: batchScope === "finance",
        });
        const latestSuggestion = await getSuggestedHonorariumBatchPeriod();
        setBatches(latestBatches);
        setActiveSuggestion(latestSuggestion);
        setGenerationPreview(null);
        toast.success(`Batch ${documentNumber} berhasil dihapus.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal hapus batch.");
      }
    });
  }

  function handleCheckGeneration() {
    if (!batchStartDate || !batchEndDate) {
      toast.error("Pilih periode tanggal terlebih dahulu.");
      return;
    }

    startTransition(async () => {
      try {
        const preview = await runGeneratePreview();
        if (preview.conflictingAssignmentCount > 0) {
          toast.error(
            `Ditemukan bentrok: ${preview.conflictingAssignmentCount} sesi sudah ada di batch lain.`,
          );
          return;
        }
        if (preview.missingRateCount > 0) {
          toast.warning(
            `Ada ${preview.missingRateCount} sesi tanpa tarif. Generate akan ditolak.`,
          );
          return;
        }
        toast.success(`Aman digenerate. Eligible ${preview.eligibleCount} sesi.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal cek kelayakan.");
      }
    });
  }

  function handleExportPdf() {
    startTransition(async () => {
      if (rows.length === 0) {
        toast.info("Tidak ada data untuk diekspor.");
        return;
      }

      try {
        const { default: jsPDF } = await import("jspdf");
        const { default: autoTable } = await import("jspdf-autotable");

        const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
        const title = "LAPORAN HONORARIUM INSTRUKTUR";
        const periodText = `Periode: ${report.appliedFilters.startDate} s.d. ${report.appliedFilters.endDate}`;

        doc.setFontSize(14);
        doc.text(title, 14, 14);
        doc.setFontSize(9);
        doc.text(periodText, 14, 20);
        doc.text(`Total sesi: ${totalInfo.sessions}`, 14, 25);
        doc.text(`Total honor: ${formatCurrency(totalInfo.amount)}`, 66, 25);

        autoTable(doc, {
          startY: 30,
          head: [[
            "Tanggal",
            "Kelas",
            "Program",
            "Materi",
            "Instruktur Dibayar",
            "Sumber Pengajar",
            "Sumber Rate",
            "Honor",
            "Transport",
            "Total",
          ]],
          body: rows.map((row) => [
            row.scheduledDate,
            row.namaKelas,
            row.programName,
            row.materiBlock,
            row.paidInstructorName,
            row.source === "actual" ? "Substitusi" : "Planned",
            rateSourceLabel(row.rateSource),
            formatCurrency(row.honorAmount),
            formatCurrency(row.transportAmount),
            formatCurrency(row.totalAmount),
          ]),
          theme: "grid",
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
          columnStyles: {
            0: { cellWidth: 24 },
            1: { cellWidth: 34 },
            2: { cellWidth: 22 },
            3: { cellWidth: 30 },
            4: { cellWidth: 30 },
            5: { cellWidth: 18, halign: "center" },
            6: { cellWidth: 24 },
            7: { cellWidth: 20, halign: "right" },
            8: { cellWidth: 20, halign: "right" },
            9: { cellWidth: 20, halign: "right" },
          },
        });

        const fileName = sanitizeFileName(
          `laporan-honorarium-${report.appliedFilters.startDate}-${report.appliedFilters.endDate}.pdf`,
        );
        doc.save(fileName);
        toast.success("PDF honorarium berhasil diekspor.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Gagal ekspor PDF.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-[28px]">
        <CardHeader className="border-b border-border">
          <CardTitle>Filter Laporan</CardTitle>
          <CardDescription>
            Filter berdasarkan periode, instruktur, dan program untuk hitung honorarium.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Tanggal Mulai</p>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Tanggal Akhir</p>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Instruktur</p>
              <Select value={instructorId || "all"} onValueChange={(value) => setInstructorId(value === "all" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="Semua instruktur" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua instruktur</SelectItem>
                  {instructors.map((instructor) => (
                    <SelectItem key={instructor.id} value={instructor.id}>{instructor.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Program</p>
              <Select value={programId || "all"} onValueChange={(value) => setProgramId(value === "all" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="Semua program" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua program</SelectItem>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id}>{program.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleApplyFilter} disabled={pending} className="flex-1">
                <Filter className="h-4 w-4 mr-1" />
                Terapkan
              </Button>
              <Button variant="outline" onClick={handleExportPdf} disabled={pending}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[28px]">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Batch Honorarium Internal</CardTitle>
              <CardDescription>
                Generate draft internal dari periode terpilih untuk diproses sampai pembayaran.
              </CardDescription>
              <p className="mt-2 text-xs text-muted-foreground">
                Saran periode berikutnya: {activeSuggestion.startDate} s.d. {activeSuggestion.endDate}
                {activeSuggestion.hasExistingBatch && activeSuggestion.sourceDocumentNumber
                  ? ` (setelah ${activeSuggestion.sourceDocumentNumber})`
                  : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleApplySuggestedPeriod} disabled={pending}>
                Gunakan Saran
              </Button>
              <Button variant="outline" onClick={handleCheckGeneration} disabled={pending}>
                Cek Kelayakan
              </Button>
              <Button onClick={handleGenerateDraftBatch} disabled={pending}>
                <FilePlus2 className="h-4 w-4 mr-1" />
                Generate Draft
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 p-0">
          <div className="px-6 pb-4">
            <div className="grid gap-3 md:grid-cols-5">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Periode Mulai</p>
                <Input
                  type="date"
                  value={batchStartDate}
                  onChange={(e) => setBatchStartDate(e.target.value)}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Periode Akhir</p>
                <Input
                  type="date"
                  value={batchEndDate}
                  onChange={(e) => setBatchEndDate(e.target.value)}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status Batch</p>
                <Select value={batchStatus} onValueChange={(value) => setBatchStatus(value as BatchStatusFilter)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua status</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="dikirim_ke_keuangan">Dikirim ke Keuangan</SelectItem>
                    <SelectItem value="diproses_keuangan">Diproses Keuangan</SelectItem>
                    <SelectItem value="dibayar">Dibayar</SelectItem>
                    <SelectItem value="locked">Locked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Mode Queue</p>
                <Select value={batchScope} onValueChange={(value) => setBatchScope(value as "all" | "finance")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua batch</SelectItem>
                    <SelectItem value="finance">Antrian keuangan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleApplyBatchFilter} disabled={pending} className="w-full">
                  <Filter className="h-4 w-4 mr-1" />
                  Terapkan Queue
                </Button>
              </div>
            </div>
          </div>
          {generationPreview ? (
            <div className="px-6 pb-4 text-xs text-muted-foreground">
              Eligible: {generationPreview.eligibleCount} sesi · Missing Tarif:{" "}
              {generationPreview.missingRateCount} · Bentrok:{" "}
              {generationPreview.conflictingAssignmentCount}
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Dokumen</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Periode</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-6 py-3 font-medium text-muted-foreground">Jumlah Sesi</th>
                  <th className="text-right px-6 py-3 font-medium text-muted-foreground">Gross</th>
                  <th className="text-right px-6 py-3 font-medium text-muted-foreground">Net</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Dibuat</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">
                      Belum ada batch honorarium internal.
                    </td>
                  </tr>
                ) : (
                  batches.map((batch) => (
                    <tr key={batch.id} className="border-b border-border hover:bg-muted/50">
                      <td className="px-6 py-3 font-medium">{batch.documentNumber}</td>
                      <td className="px-6 py-3">
                        {batch.periodStart} s.d. {batch.periodEnd}
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant={batchStatusVariant(batch.status)}>
                          {batchStatusLabel(batch.status)}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums">{batch.itemCount}</td>
                      <td className="px-6 py-3 text-right tabular-nums">{formatCurrency(batch.grossAmount)}</td>
                      <td className="px-6 py-3 text-right tabular-nums">{formatCurrency(batch.netAmount)}</td>
                      <td className="px-6 py-3">{new Date(batch.createdAt).toLocaleString("id-ID")}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/jadwal-otomatis/honorarium/${batch.id}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              Detail
                            </Link>
                          </Button>
                          {batch.status === "draft" ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleDeleteDraftBatch(batch.id, batch.documentNumber)
                              }
                              disabled={pending}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Hapus
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-[24px]">
          <CardHeader className="pb-2"><CardDescription>Total Sesi</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-semibold tabular-nums">{totalInfo.sessions}</p></CardContent>
        </Card>
        <Card className="rounded-[24px]">
          <CardHeader className="pb-2"><CardDescription>Total Honorarium</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-semibold tabular-nums">{formatCurrency(totalInfo.amount)}</p></CardContent>
        </Card>
        <Card className="rounded-[24px]">
          <CardHeader className="pb-2"><CardDescription>Rata-rata per Sesi</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-semibold tabular-nums">{formatCurrency(totalInfo.avgPerSession)}</p></CardContent>
        </Card>
      </div>

      <Card className="rounded-[28px]">
        <CardHeader className="border-b border-border">
          <CardTitle>Ringkasan per Instruktur</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {report.summaryByInstructor.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada data honorarium.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {report.summaryByInstructor.map((row) => (
                <Badge key={row.key} variant="secondary" className="px-3 py-1 text-sm">
                  {row.label}: {row.sessionCount} sesi · {formatCurrency(row.totalAmount)}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[28px]">
        <CardHeader className="border-b border-border">
          <CardTitle>Ringkasan per Program</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {report.summaryByProgram.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada data honorarium.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {report.summaryByProgram.map((row) => (
                <Badge key={row.key} variant="outline" className="px-3 py-1 text-sm">
                  {row.label}: {row.sessionCount} sesi · {formatCurrency(row.totalAmount)}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[28px]">
        <CardHeader className="border-b border-border">
          <CardTitle>Detail Honorarium Sesi</CardTitle>
        </CardHeader>
        <CardContent className="pt-6 p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Tanggal</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Kelas</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Program</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Materi</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Instruktur Dibayar</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Sumber</th>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Sumber Rate</th>
                  <th className="text-right px-6 py-3 font-medium text-muted-foreground">Honor</th>
                  <th className="text-right px-6 py-3 font-medium text-muted-foreground">Transport</th>
                  <th className="text-right px-6 py-3 font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-8 text-center text-muted-foreground">
                      Tidak ada data honorarium pada filter ini.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.assignmentId} className="border-b border-border hover:bg-muted/50">
                      <td className="px-6 py-3">{row.scheduledDate}</td>
                      <td className="px-6 py-3 font-medium">{row.namaKelas}</td>
                      <td className="px-6 py-3">{row.programName}</td>
                      <td className="px-6 py-3">{row.materiBlock}</td>
                      <td className="px-6 py-3">{row.paidInstructorName}</td>
                      <td className="px-6 py-3">
                        <Badge variant={row.source === "actual" ? "outline" : "secondary"}>
                          {row.source === "actual" ? "Substitusi" : "Planned"}
                        </Badge>
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant={rateSourceVariant(row.rateSource)}>
                          {rateSourceLabel(row.rateSource)}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums">{formatCurrency(row.honorAmount)}</td>
                      <td className="px-6 py-3 text-right tabular-nums">{formatCurrency(row.transportAmount)}</td>
                      <td className="px-6 py-3 text-right font-medium tabular-nums">{formatCurrency(row.totalAmount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
