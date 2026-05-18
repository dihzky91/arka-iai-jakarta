"use client";

import { useState, useTransition, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPatternAnalysis } from "@/server/actions/ppl-evaluasi/analytics";
import { exportProgramTahunan } from "@/server/actions/ppl-evaluasi/export";
import type {
  PatternAnalysisData,
  CategoryPattern,
  DashboardFilter,
} from "@/server/actions/ppl-evaluasi/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

type FilterMode = "tahun" | "semester" | "custom";

interface Props {
  initialData: PatternAnalysisData;
}

export function PatternAnalysisClient({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);

  // Filter state
  const currentYear = new Date().getFullYear();
  const [filterMode, setFilterMode] = useState<FilterMode>("tahun");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedSemester, setSelectedSemester] = useState<"1" | "2">("1");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = currentYear; y >= currentYear - 5; y--) {
      arr.push(y);
    }
    return arr;
  }, [currentYear]);

  function getFilter(): DashboardFilter {
    if (filterMode === "tahun") {
      return { year: selectedYear };
    } else if (filterMode === "semester") {
      const startMonth = selectedSemester === "1" ? "01" : "07";
      const endMonth = selectedSemester === "1" ? "06" : "12";
      const endDay = selectedSemester === "1" ? "30" : "31";
      return {
        startDate: `${selectedYear}-${startMonth}-01`,
        endDate: `${selectedYear}-${endMonth}-${endDay}`,
      };
    } else if (filterMode === "custom" && customStart && customEnd) {
      return { startDate: customStart, endDate: customEnd };
    }
    return {};
  }

  function applyFilter() {
    const filter = getFilter();
    startTransition(async () => {
      const result = await getPatternAnalysis(filter);
      setData(result);
    });
  }

  async function handleExport(format: "pdf" | "xlsx") {
    setIsExporting(true);
    try {
      const filter = getFilter();
      const result = await exportProgramTahunan(filter, format);
      if (result.ok && result.data) {
        // Convert base64 to blob and trigger download
        const byteCharacters = atob(result.data.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: result.data.mimeType });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = result.data.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } finally {
      setIsExporting(false);
    }
  }

  // Sort patterns by popularity score descending
  const sortedPatterns = useMemo(
    () => [...data.patterns].sort((a, b) => b.popularityScore - a.popularityScore),
    [data.patterns],
  );

  const isEmpty = data.patterns.length === 0;

  return (
    <div className="space-y-6">
      {/* ─── Filter Section ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Periode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <Select
                value={filterMode}
                onValueChange={(v) => setFilterMode(v as FilterMode)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tahun">Tahun</SelectItem>
                  <SelectItem value="semester">Semester</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(filterMode === "tahun" || filterMode === "semester") && (
              <div className="space-y-1.5">
                <Label>Tahun</Label>
                <Select
                  value={String(selectedYear)}
                  onValueChange={(v) => setSelectedYear(Number(v))}
                >
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {filterMode === "semester" && (
              <div className="space-y-1.5">
                <Label>Semester</Label>
                <Select
                  value={selectedSemester}
                  onValueChange={(v) => setSelectedSemester(v as "1" | "2")}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Semester 1</SelectItem>
                    <SelectItem value="2">Semester 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {filterMode === "custom" && (
              <>
                <div className="space-y-1.5">
                  <Label>Dari</Label>
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-[160px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Sampai</Label>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-[160px]"
                  />
                </div>
              </>
            )}

            <Button onClick={applyFilter} disabled={isPending}>
              {isPending ? "Memuat..." : "Terapkan"}
            </Button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Periode: {data.period.startDate} s/d {data.period.endDate}
          </p>
        </CardContent>
      </Card>

      {/* ─── Export Buttons ─────────────────────────────────────────────── */}
      {!isEmpty && (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => handleExport("pdf")}
            disabled={isExporting}
          >
            {isExporting ? "Mengekspor..." : "Export Program Tahunan (PDF)"}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport("xlsx")}
            disabled={isExporting}
          >
            {isExporting ? "Mengekspor..." : "Export Program Tahunan (XLSX)"}
          </Button>
        </div>
      )}

      {/* ─── Empty State ────────────────────────────────────────────────── */}
      {isEmpty && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Tidak ada data kegiatan untuk analisis pola pada periode yang dipilih.
            </p>
          </CardContent>
        </Card>
      )}

      {!isEmpty && (
        <>
          {/* ─── Popularity Score Overview ─────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Skor Popularitas per Kategori (0–100)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sortedPatterns.map((pattern) => (
                  <div
                    key={pattern.kategori}
                    className="flex items-center justify-between rounded-lg border border-border/60 p-3"
                  >
                    <span className="text-sm font-medium text-foreground truncate mr-2">
                      {pattern.kategori}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={pattern.hasEnoughData ? "default" : "secondary"}
                      >
                        {Math.round(pattern.popularityScore)}
                      </Badge>
                      {!pattern.hasEnoughData && (
                        <InsufficientDataBadge />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ─── Pattern Detail per Kategori ──────────────────────────────── */}
          {sortedPatterns.map((pattern) => (
            <PatternCard key={pattern.kategori} pattern={pattern} />
          ))}
        </>
      )}
    </div>
  );
}

// ─── Pattern Card Component ──────────────────────────────────────────────────

function PatternCard({ pattern }: { pattern: CategoryPattern }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">{pattern.kategori}</CardTitle>
          <div className="flex items-center gap-2">
            {pattern.yoyTrend && (
              <Badge
                variant={pattern.yoyTrend.label === "pertumbuhan" ? "default" : "destructive"}
              >
                {pattern.yoyTrend.label === "pertumbuhan" ? "↑" : "↓"}{" "}
                {pattern.yoyTrend.label} ({pattern.yoyTrend.changePercent > 0 ? "+" : ""}
                {pattern.yoyTrend.changePercent}%)
              </Badge>
            )}
            <Badge variant="outline">
              Skor: {Math.round(pattern.popularityScore)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Insufficient data indicator */}
        {!pattern.hasEnoughData && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              ⚠️ Data belum mencukupi untuk analisis pola pada kategori ini (kurang dari 12 bulan data historis).
            </p>
          </div>
        )}

        {pattern.hasEnoughData && (
          <>
            {/* Top 3 Months */}
            <div>
              <h4 className="mb-2 text-sm font-medium text-foreground">
                Top 3 Bulan (Rata-rata Kehadiran Tertinggi)
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Bulan</TableHead>
                    <TableHead className="text-right">Rata-rata Hadir</TableHead>
                    <TableHead className="text-right">Avg Conversion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pattern.topMonths.map((tm, idx) => (
                    <TableRow key={tm.month}>
                      <TableCell className="font-medium text-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {MONTH_NAMES[tm.month - 1] ?? `Bulan ${tm.month}`}
                      </TableCell>
                      <TableCell className="text-right text-foreground">
                        {tm.avgHadir.toLocaleString("id-ID", { maximumFractionDigits: 1 })}
                      </TableCell>
                      <TableCell className="text-right">
                        {tm.avgConversionRate !== null
                          ? `${tm.avgConversionRate}%`
                          : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {pattern.topMonths.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Tidak ada data
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Recommended Months */}
            <div>
              <h4 className="mb-2 text-sm font-medium text-foreground">
                Bulan Rekomendasi (Di Atas Median)
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bulan</TableHead>
                    <TableHead className="text-right">Rata-rata Hadir</TableHead>
                    <TableHead className="text-right">Avg Conversion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pattern.recommendedMonths.map((rm) => (
                    <TableRow key={rm.month}>
                      <TableCell className="text-foreground">
                        {MONTH_NAMES[rm.month - 1] ?? `Bulan ${rm.month}`}
                      </TableCell>
                      <TableCell className="text-right text-foreground">
                        {rm.avgHadir.toLocaleString("id-ID", { maximumFractionDigits: 1 })}
                      </TableCell>
                      <TableCell className="text-right">
                        {rm.avgConversionRate !== null
                          ? `${rm.avgConversionRate}%`
                          : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {pattern.recommendedMonths.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        Tidak ada bulan yang memenuhi kriteria
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* YoY Trend (shown even without enough data if available) */}
        {pattern.yoyTrend && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Tren Year-over-Year:</span>
            <span
              className={
                pattern.yoyTrend.label === "pertumbuhan"
                  ? "font-medium text-green-600 dark:text-green-400"
                  : "font-medium text-red-600 dark:text-red-400"
              }
            >
              {pattern.yoyTrend.label === "pertumbuhan" ? "↑" : "↓"}{" "}
              {pattern.yoyTrend.label} ({pattern.yoyTrend.changePercent > 0 ? "+" : ""}
              {pattern.yoyTrend.changePercent}%)
            </span>
          </div>
        )}
        {!pattern.yoyTrend && (
          <p className="text-sm text-muted-foreground">
            Tren YoY: Data tidak tersedia (membutuhkan minimal 2 tahun data)
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Insufficient Data Badge ─────────────────────────────────────────────────

function InsufficientDataBadge() {
  return (
    <Badge variant="outline" className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">
      &lt;12 bln
    </Badge>
  );
}
