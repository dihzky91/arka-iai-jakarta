"use client";

import { useState, useTransition } from "react";
import { BarChart2, FileBarChart, RefreshCw } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
import {
  getYearlyStats,
  getYearlyProgramStats,
  type YearlyStats,
  type YearlyProgramStats,
} from "@/server/actions/sertifikat/nomor/batches";

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-[24px] border border-border/60 bg-card px-5 py-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface YearlyReportViewProps {
  availableYears:     number[];
  initialYear:        number;
  initialStats:       YearlyStats;
  initialDetailStats: YearlyProgramStats[];
}

// ─── Komponen ─────────────────────────────────────────────────────────────────

export function YearlyReportView({
  availableYears,
  initialYear,
  initialStats,
  initialDetailStats,
}: YearlyReportViewProps) {
  const [selectedYear,  setSelectedYear]  = useState(initialYear);
  const [stats,         setStats]         = useState<YearlyStats>(initialStats);
  const [detailStats,   setDetailStats]   = useState<YearlyProgramStats[]>(initialDetailStats);
  const [isPending,     startTransition]  = useTransition();

  function fetchYear(year: number) {
    setSelectedYear(year);
    startTransition(async () => {
      const [s, d] = await Promise.all([
        getYearlyStats(year),
        getYearlyProgramStats(year),
      ]);
      setStats(s);
      setDetailStats(d);
    });
  }

  const totalActive    = detailStats.reduce((sum, r) => sum + r.activeCount, 0);
  const totalCancelled = detailStats.reduce((sum, r) => sum + r.cancelledCount, 0);
  const grandTotal     = totalActive + totalCancelled;

  return (
    <div className="space-y-6">
      {/* Header + selector tahun */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Rekap Tahunan Sertifikat</h2>
        </div>
        <div className="flex items-center gap-2">
          {isPending && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => fetchYear(Number(v))}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Sertifikat Aktif"    value={stats.totalActive}    />
        <StatCard label="Total Dibatalkan"           value={stats.totalCancelled} />
        <StatCard
          label="Serial Pertama"
          value={stats.firstSerial ?? "—"}
          sub={stats.firstSerial ? `Serial #${stats.firstSerial}` : undefined}
        />
        <StatCard
          label="Serial Terakhir"
          value={stats.lastSerial ?? "—"}
          sub={stats.lastSerial ? `Serial #${stats.lastSerial}` : undefined}
        />
      </div>

      {/* Tabel rincian */}
      <Card className="rounded-[24px] shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">
            Rincian per Program & Jenis Kelas — Tahun {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Program</TableHead>
                  <TableHead>Jenis Kelas</TableHead>
                  <TableHead className="text-center">Aktif</TableHead>
                  <TableHead className="text-center">Dibatalkan</TableHead>
                  <TableHead className="text-center font-semibold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="p-4">
                      <EmptyState
                        icon={FileBarChart}
                        title="Tidak ada data tahunan"
                        description={`Belum ada rekap sertifikat untuk tahun ${selectedYear}.`}
                        className="min-h-40"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {detailStats.map((row, idx) => (
                      <TableRow key={idx} className="transition-colors hover:bg-muted/30">
                        <TableCell className="font-medium">{row.programName}</TableCell>
                        <TableCell>
                          {row.classTypeName}{" "}
                          <span className="font-mono text-xs text-muted-foreground">
                            ({row.classTypeCode})
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-emerald-700 font-medium dark:text-emerald-300">
                          {row.activeCount}
                        </TableCell>
                        <TableCell className="text-center text-red-600 dark:text-red-300">
                          {row.cancelledCount}
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {row.activeCount + row.cancelledCount}
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* Baris total */}
                    <TableRow className="border-t-2 bg-muted/30 font-semibold">
                      <TableCell colSpan={2} className="font-semibold">
                        TOTAL
                      </TableCell>
                      <TableCell className="text-center text-emerald-700 font-bold dark:text-emerald-300">
                        {totalActive}
                      </TableCell>
                      <TableCell className="text-center text-red-600 font-bold dark:text-red-300">
                        {totalCancelled}
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {grandTotal}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
