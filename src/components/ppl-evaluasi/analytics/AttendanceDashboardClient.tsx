"use client";

import { useState, useTransition, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
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
import { getAttendanceDashboard } from "@/server/actions/ppl-evaluasi/analytics";
import type {
  AttendanceDashboardData,
  CategoryMonthData,
  DashboardFilter,
  YoYComparison,
} from "@/server/actions/ppl-evaluasi/types";

// ─── Color palette for chart lines ──────────────────────────────────────────

const CATEGORY_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#ca8a04", "#9333ea",
  "#0891b2", "#e11d48", "#65a30d", "#c026d3", "#0d9488",
  "#ea580c", "#4f46e5", "#059669",
];

// ─── Filter types ────────────────────────────────────────────────────────────

type FilterMode = "tahun" | "semester" | "custom";

interface Props {
  initialData: AttendanceDashboardData;
}

export function AttendanceDashboardClient({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  // Filter state
  const currentYear = new Date().getFullYear();
  const [filterMode, setFilterMode] = useState<FilterMode>("tahun");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedSemester, setSelectedSemester] = useState<"1" | "2">("1");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Available years for selector
  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = currentYear; y >= currentYear - 5; y--) {
      arr.push(y);
    }
    return arr;
  }, [currentYear]);

  function applyFilter() {
    let filter: DashboardFilter = {};

    if (filterMode === "tahun") {
      filter = { year: selectedYear };
    } else if (filterMode === "semester") {
      const startMonth = selectedSemester === "1" ? "01" : "07";
      const endMonth = selectedSemester === "1" ? "06" : "12";
      const endDay = selectedSemester === "1" ? "30" : "31";
      filter = {
        startDate: `${selectedYear}-${startMonth}-01`,
        endDate: `${selectedYear}-${endMonth}-${endDay}`,
      };
    } else if (filterMode === "custom" && customStart && customEnd) {
      filter = { startDate: customStart, endDate: customEnd };
    }

    startTransition(async () => {
      const result = await getAttendanceDashboard(filter);
      setData(result);
    });
  }

  // ─── Derived data for charts ─────────────────────────────────────────────

  // Get unique categories and months
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const d of data.categoryMonthData) set.add(d.kategori);
    return Array.from(set).sort();
  }, [data.categoryMonthData]);

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const d of data.categoryMonthData) set.add(d.month);
    return Array.from(set).sort();
  }, [data.categoryMonthData]);

  // Build line chart data: [{month, kategori1: hadir, kategori2: hadir, ...}]
  const trendChartData = useMemo(() => {
    const map = new Map<string, Record<string, string | number>>();
    for (const d of data.categoryMonthData) {
      const existing = map.get(d.month) ?? { month: d.month };
      existing[d.kategori] = d.totalHadir;
      map.set(d.month, existing);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, val]) => val);
  }, [data.categoryMonthData]);

  // Build heatmap data: pivot table [kategori][month] = kegiatanCount
  const heatmapData = useMemo(() => {
    const map = new Map<string, Map<string, CategoryMonthData>>();
    for (const d of data.categoryMonthData) {
      if (!map.has(d.kategori)) map.set(d.kategori, new Map());
      map.get(d.kategori)!.set(d.month, d);
    }
    return map;
  }, [data.categoryMonthData]);

  const isEmpty =
    data.categoryMonthData.length === 0 &&
    data.categoryRanking.length === 0;

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

      {/* ─── Empty State ────────────────────────────────────────────────── */}
      {isEmpty && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Tidak ada data kegiatan untuk periode yang dipilih.
            </p>
          </CardContent>
        </Card>
      )}

      {!isEmpty && (
        <>
          {/* ─── Heatmap / Pivot Table ────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Jumlah Kegiatan per Kategori per Bulan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card z-10">
                        Kategori
                      </TableHead>
                      {months.map((m) => (
                        <TableHead key={m} className="text-center min-w-[60px]">
                          {formatMonth(m)}
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-semibold">
                        Total
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((kategori) => {
                      const monthMap = heatmapData.get(kategori);
                      const total = months.reduce(
                        (sum, m) =>
                          sum + (monthMap?.get(m)?.kegiatanCount ?? 0),
                        0,
                      );
                      return (
                        <TableRow key={kategori}>
                          <TableCell className="sticky left-0 bg-card z-10 font-medium text-foreground">
                            {kategori}
                          </TableCell>
                          {months.map((m) => {
                            const count =
                              monthMap?.get(m)?.kegiatanCount ?? 0;
                            return (
                              <TableCell
                                key={m}
                                className="text-center"
                                style={{
                                  backgroundColor:
                                    count > 0
                                      ? `hsl(210 100% 50% / ${Math.min(count * 15, 60)}%)`
                                      : undefined,
                                }}
                              >
                                {count > 0 ? count : "–"}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-semibold text-foreground">
                            {total}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* ─── Trend Line Chart ─────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Tren Realisasi Hadir per Kategori per Bulan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%" minHeight={1}>
                  <LineChart
                    data={trendChartData}
                    margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis
                      dataKey="month"
                      className="text-xs"
                      tickLine={false}
                      tickFormatter={formatMonth}
                    />
                    <YAxis className="text-xs" tickLine={false} width={50} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                      }}
                      labelFormatter={(label) => formatMonth(String(label))}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    {categories.map((kategori, idx) => (
                      <Line
                        key={kategori}
                        type="monotone"
                        dataKey={kategori}
                        name={kategori}
                        stroke={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* ─── Rata-rata Conversion Rate per Kategori ───────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Rata-rata Conversion Rate per Kategori</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.categoryRanking.map((cat) => (
                  <div
                    key={cat.kategori}
                    className="flex items-center justify-between rounded-lg border border-border/60 p-3"
                  >
                    <span className="text-sm font-medium text-foreground truncate mr-2">
                      {cat.kategori}
                    </span>
                    <Badge variant={cat.avgConversionRate !== null ? "default" : "secondary"}>
                      {cat.avgConversionRate !== null
                        ? `${cat.avgConversionRate}%`
                        : "N/A"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ─── Ranking Kategori by Total Peserta Hadir ──────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Ranking Kategori (Total Peserta Hadir)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-right">Total Hadir</TableHead>
                    <TableHead className="text-right">Jumlah Kegiatan</TableHead>
                    <TableHead className="text-right">Avg Conversion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.categoryRanking.map((cat, idx) => (
                    <TableRow key={cat.kategori}>
                      <TableCell className="font-medium text-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="text-foreground">
                        {cat.kategori}
                      </TableCell>
                      <TableCell className="text-right text-foreground">
                        {cat.totalHadir.toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className="text-right">
                        {cat.kegiatanCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {cat.avgConversionRate !== null
                          ? `${cat.avgConversionRate}%`
                          : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* ─── Year-over-Year Comparison ────────────────────────────────── */}
          {data.yoyComparison.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Perbandingan Year-over-Year</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kategori</TableHead>
                        <TableHead className="text-right">
                          Hadir {data.yoyComparison[0]?.previousYear}
                        </TableHead>
                        <TableHead className="text-right">
                          Hadir {data.yoyComparison[0]?.currentYear}
                        </TableHead>
                        <TableHead className="text-right">Δ Hadir</TableHead>
                        <TableHead className="text-right">
                          Kegiatan {data.yoyComparison[0]?.previousYear}
                        </TableHead>
                        <TableHead className="text-right">
                          Kegiatan {data.yoyComparison[0]?.currentYear}
                        </TableHead>
                        <TableHead className="text-right">Δ Kegiatan</TableHead>
                        <TableHead className="text-right">
                          Conv. {data.yoyComparison[0]?.previousYear}
                        </TableHead>
                        <TableHead className="text-right">
                          Conv. {data.yoyComparison[0]?.currentYear}
                        </TableHead>
                        <TableHead className="text-right">Δ Conv.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.yoyComparison.map((row) => (
                        <YoYCategoryRow key={row.kategori} row={row} />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── YoY Category Row with Monthly Breakdown ────────────────────────────────

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

function YoYCategoryRow({ row }: { row: YoYComparison }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="text-foreground font-medium">
          <span className="flex items-center gap-1">
            <span className="text-muted-foreground text-xs">
              {expanded ? "▼" : "▶"}
            </span>
            {row.kategori}
          </span>
        </TableCell>
        <TableCell className="text-right">
          {row.previousTotalHadir.toLocaleString("id-ID")}
        </TableCell>
        <TableCell className="text-right text-foreground">
          {row.currentTotalHadir.toLocaleString("id-ID")}
        </TableCell>
        <TableCell className="text-right">
          <ChangeIndicator value={row.hadirChangePercent} />
        </TableCell>
        <TableCell className="text-right">
          {row.previousKegiatanCount}
        </TableCell>
        <TableCell className="text-right text-foreground">
          {row.currentKegiatanCount}
        </TableCell>
        <TableCell className="text-right">
          <ChangeIndicator value={row.kegiatanChangePercent} />
        </TableCell>
        <TableCell className="text-right">
          {row.previousAvgConversion !== null
            ? `${row.previousAvgConversion}%`
            : "–"}
        </TableCell>
        <TableCell className="text-right text-foreground">
          {row.currentAvgConversion !== null
            ? `${row.currentAvgConversion}%`
            : "–"}
        </TableCell>
        <TableCell className="text-right">
          <ChangeIndicator value={row.conversionChange} suffix="pp" />
        </TableCell>
      </TableRow>
      {expanded && row.monthlyDetails.length > 0 && (
        <>
          {row.monthlyDetails.map((detail) => (
            <TableRow
              key={`${row.kategori}-month-${detail.month}`}
              className="bg-muted/30"
            >
              <TableCell className="pl-8 text-muted-foreground text-sm">
                {MONTH_LABELS[detail.month - 1]}
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                {detail.previousHadir.toLocaleString("id-ID")}
              </TableCell>
              <TableCell className="text-right text-sm">
                {detail.currentHadir.toLocaleString("id-ID")}
              </TableCell>
              <TableCell className="text-right text-sm">
                <ChangeIndicator value={detail.hadirChangePercent} />
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                {detail.previousKegiatanCount}
              </TableCell>
              <TableCell className="text-right text-sm">
                {detail.currentKegiatanCount}
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                –
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                –
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                –
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                –
              </TableCell>
            </TableRow>
          ))}
        </>
      )}
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMonth(monthStr: string): string {
  // "YYYY-MM" -> "Jan", "Feb", etc.
  const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
  ];
  const parts = monthStr.split("-");
  if (parts.length < 2) return monthStr;
  const monthIdx = parseInt(parts[1]!, 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return monthStr;
  return `${MONTH_NAMES[monthIdx]} ${parts[0]!.slice(2)}`;
}

function ChangeIndicator({
  value,
  suffix = "%",
}: {
  value: number | null;
  suffix?: string;
}) {
  if (value === null) return <span className="text-muted-foreground">–</span>;

  const isPositive = value > 0;
  const isNegative = value < 0;

  return (
    <span
      className={
        isPositive
          ? "text-green-600 dark:text-green-400"
          : isNegative
            ? "text-red-600 dark:text-red-400"
            : "text-muted-foreground"
      }
    >
      {isPositive ? "+" : ""}
      {value}
      {suffix}
    </span>
  );
}
