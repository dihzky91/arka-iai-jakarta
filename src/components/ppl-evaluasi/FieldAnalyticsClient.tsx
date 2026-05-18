"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Search, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { FieldAnalyticsResult } from "@/server/actions/ppl-evaluasi/types";

const CHART_COLORS = [
  "#2563eb",
  "#059669",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#e11d48",
  "#4f46e5",
  "#16a34a",
  "#ca8a04",
];

const TEXT_PAGE_SIZE = 50;

interface FieldAnalyticsClientProps {
  analytics: FieldAnalyticsResult[];
  totalRespondents: number;
  realisasiHadir: number;
}

export function FieldAnalyticsClient({
  analytics,
  totalRespondents,
  realisasiHadir,
}: FieldAnalyticsClientProps) {
  // Response rate calculation
  const responseRate =
    realisasiHadir > 0
      ? Math.round((totalRespondents / realisasiHadir) * 1000) / 10
      : null;

  return (
    <div className="space-y-6">
      {/* Response Rate Summary */}
      <Card className="rounded-[24px]">
        <CardContent className="flex flex-wrap items-center gap-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Responden</p>
              <p className="text-2xl font-semibold">{totalRespondents}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Response Rate</p>
              {responseRate !== null ? (
                <p className="text-2xl font-semibold">{responseRate}%</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Response rate tidak tersedia
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-field analytics */}
      {analytics.length === 0 ? (
        <Card className="rounded-[24px]">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Belum ada data analitik. Respons kuesioner diperlukan untuk
              menampilkan analitik per field.
            </p>
          </CardContent>
        </Card>
      ) : (
        analytics.map((field) => (
          <FieldAnalyticsCard key={field.fieldId} field={field} />
        ))
      )}
    </div>
  );
}

function FieldAnalyticsCard({ field }: { field: FieldAnalyticsResult }) {
  switch (field.type) {
    case "scale":
      return <ScaleFieldCard field={field} />;
    case "grid":
      return <GridFieldCard field={field} />;
    case "choice":
      return <ChoiceFieldCard field={field} />;
    case "text":
      return <TextFieldCard field={field} />;
    default:
      return null;
  }
}

// ─── SCALE FIELD ─────────────────────────────────────────────────────────────

function ScaleFieldCard({
  field,
}: {
  field: Extract<FieldAnalyticsResult, { type: "scale" }>;
}) {
  const distributionData = useMemo(() => {
    return Object.entries(field.distribution)
      .map(([value, count]) => ({
        value: Number(value),
        count,
      }))
      .sort((a, b) => a.value - b.value);
  }, [field.distribution]);

  return (
    <Card className="rounded-[24px]">
      <CardHeader>
        <CardTitle className="text-base">{field.label}</CardTitle>
        <CardDescription>
          Skala · {field.totalResponses} respons
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatBadge label="Rata-rata" value={field.mean.toFixed(2)} />
          <StatBadge label="Median" value={String(field.median)} />
          <StatBadge label="Std. Deviasi" value={field.stdDev.toFixed(2)} />
          <StatBadge label="Respons" value={String(field.totalResponses)} />
        </div>

        {/* Distribution Chart */}
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%" minHeight={1}>
            <BarChart data={distributionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="value" />
              <YAxis allowDecimals={false} />
              <Tooltip
                formatter={(value) => [`${value}`, "Jumlah"]}
                labelFormatter={(label) => `Nilai: ${label}`}
              />
              <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── GRID FIELD ──────────────────────────────────────────────────────────────

function GridFieldCard({
  field,
}: {
  field: Extract<FieldAnalyticsResult, { type: "grid" }>;
}) {
  // Get column labels from the first row's distribution keys
  const columns = useMemo(() => {
    if (field.rows.length === 0) return [];
    const firstRow = field.rows[0];
    if (!firstRow) return [];
    return Object.keys(firstRow.distribution);
  }, [field.rows]);

  return (
    <Card className="rounded-[24px]">
      <CardHeader>
        <CardTitle className="text-base">{field.label}</CardTitle>
        <CardDescription>
          Grid · {field.totalResponses} respons
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-4 text-left font-medium text-muted-foreground">
                  Pernyataan
                </th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">
                  Rata-rata
                </th>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-2 py-2 text-center font-medium text-muted-foreground"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {field.rows.map((row) => (
                <tr key={row.rowLabel} className="border-b last:border-0">
                  <td className="py-2 pr-4 text-foreground">
                    {row.rowLabel}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Badge variant="secondary">{row.mean.toFixed(2)}</Badge>
                  </td>
                  {columns.map((col) => (
                    <td key={col} className="px-2 py-2 text-center text-muted-foreground">
                      {row.distribution[col] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── CHOICE FIELD ────────────────────────────────────────────────────────────

function ChoiceFieldCard({
  field,
}: {
  field: Extract<FieldAnalyticsResult, { type: "choice" }>;
}) {
  const chartData = useMemo(
    () =>
      field.options.map((opt) => ({
        name: opt.label,
        value: opt.count,
        percentage: opt.percentage,
      })),
    [field.options],
  );

  const typeLabel =
    field.choiceType === "checkbox"
      ? "Checkbox"
      : field.choiceType === "radio"
        ? "Radio"
        : "Select";

  return (
    <Card className="rounded-[24px]">
      <CardHeader>
        <CardTitle className="text-base">{field.label}</CardTitle>
        <CardDescription>
          {typeLabel} · {field.totalResponses} respons
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Bar Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minHeight={1}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value, _name, props) => {
                    const pct = (props?.payload as { percentage?: number })?.percentage ?? 0;
                    return [`${value} (${pct}%)`, "Jumlah"];
                  }}
                />
                <Bar dataKey="value" fill="#059669" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minHeight={1}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  label={({ name, payload }) => {
                    const pct = (payload as { percentage?: number })?.percentage ?? 0;
                    return `${name}: ${pct}%`;
                  }}
                  labelLine={false}
                >
                  {chartData.map((_, index) => (
                    <Cell
                      key={index}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, _name, props) => {
                    const pct = (props?.payload as { percentage?: number })?.percentage ?? 0;
                    return [`${value} (${pct}%)`, "Jumlah"];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Frequency Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left font-medium text-muted-foreground">
                  Opsi
                </th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">
                  Jumlah
                </th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground">
                  Persentase
                </th>
              </tr>
            </thead>
            <tbody>
              {field.options.map((opt) => (
                <tr key={opt.label} className="border-b last:border-0">
                  <td className="py-2 text-foreground">{opt.label}</td>
                  <td className="px-3 py-2 text-center">{opt.count}</td>
                  <td className="px-3 py-2 text-center">{opt.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── TEXT FIELD ──────────────────────────────────────────────────────────────

function TextFieldCard({
  field,
}: {
  field: Extract<FieldAnalyticsResult, { type: "text" }>;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const filteredResponses = useMemo(() => {
    if (!searchQuery.trim()) return field.responses;
    const query = searchQuery.toLowerCase();
    return field.responses.filter((r) => r.toLowerCase().includes(query));
  }, [field.responses, searchQuery]);

  const totalPages = Math.ceil(filteredResponses.length / TEXT_PAGE_SIZE);
  const paginatedResponses = useMemo(() => {
    const start = (page - 1) * TEXT_PAGE_SIZE;
    return filteredResponses.slice(start, start + TEXT_PAGE_SIZE);
  }, [filteredResponses, page]);

  // Reset page when search changes
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  return (
    <Card className="rounded-[24px]">
      <CardHeader>
        <CardTitle className="text-base">{field.label}</CardTitle>
        <CardDescription>
          Teks · {field.totalResponses} respons
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari jawaban..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Results count */}
        {searchQuery && (
          <p className="text-sm text-muted-foreground">
            {filteredResponses.length} hasil ditemukan
          </p>
        )}

        {/* Responses list */}
        {paginatedResponses.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Tidak ada jawaban yang cocok.
          </p>
        ) : (
          <ul className="space-y-2">
            {paginatedResponses.map((response, idx) => (
              <li
                key={`${page}-${idx}`}
                className="rounded-lg border border-border/60 px-4 py-3 text-sm"
              >
                {response}
              </li>
            ))}
          </ul>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground">
              Halaman {page} / {totalPages} · {filteredResponses.length} jawaban
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 px-3 py-2 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
