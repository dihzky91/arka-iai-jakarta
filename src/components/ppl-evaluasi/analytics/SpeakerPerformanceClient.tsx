"use client";

import { useState, useTransition, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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
import { Label } from "@/components/ui/label";
import { getSpeakerPerformance } from "@/server/actions/ppl-evaluasi/analytics";
import type {
  SpeakerPerformanceData,
  SpeakerPerformanceRow,
  KategoriPpl,
  SpeakerFilter,
} from "@/server/actions/ppl-evaluasi/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const KATEGORI_OPTIONS: KategoriPpl[] = [
  "Perpajakan",
  "Sistem Informasi & Softskill",
  "Akuntansi Keuangan",
  "Audit",
  "Akuntansi Syariah",
  "Akuntansi Manajemen",
  "Akuntansi Manajemen dan Manajemen Keuangan",
  "Akuntansi Perpajakan",
  "Manajemen Keuangan",
  "Akuntansi Keuangan & Softskill",
  "Akuntansi Keuangan dan Manajemen Keuangan",
  "Manajemen Strategik",
  "SAK & PSAK",
];

interface Props {
  initialData: SpeakerPerformanceData;
}

export function SpeakerPerformanceClient({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  // Filter state
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedKategori, setSelectedKategori] = useState<string>("all");

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = currentYear; y >= currentYear - 5; y--) {
      arr.push(y);
    }
    return arr;
  }, [currentYear]);

  function applyFilter() {
    const filter: SpeakerFilter = { year: selectedYear };
    if (selectedKategori !== "all") {
      filter.kategori = selectedKategori as KategoriPpl;
    }
    startTransition(async () => {
      const result = await getSpeakerPerformance(filter);
      setData(result);
    });
  }

  // Separate speakers with and without evaluation data
  const rankedSpeakers = useMemo(
    () => data.speakers.filter((s) => s.hasEvaluationData),
    [data.speakers],
  );

  const unrankedSpeakers = useMemo(
    () => data.speakers.filter((s) => !s.hasEvaluationData),
    [data.speakers],
  );

  const isEmpty = data.speakers.length === 0;

  return (
    <div className="space-y-6">
      {/* ─── Filter Section ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
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

            <div className="space-y-1.5">
              <Label>Kategori PPL</Label>
              <Select
                value={selectedKategori}
                onValueChange={setSelectedKategori}
              >
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Semua Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {KATEGORI_OPTIONS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
              Tidak ada data narasumber untuk periode yang dipilih.
            </p>
          </CardContent>
        </Card>
      )}

      {!isEmpty && (
        <>
          {/* ─── Ranking Table ─────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle>Ranking Narasumber (Skor Evaluasi)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead className="text-right">Avg Skor</TableHead>
                      <TableHead className="text-right">Kegiatan</TableHead>
                      <TableHead className="text-right">Total SKP</TableHead>
                      <TableHead className="text-right">Responden</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankedSpeakers.map((speaker, idx) => (
                      <TableRow key={speaker.narasumberId}>
                        <TableCell className="font-medium text-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="text-foreground font-medium">
                          {speaker.nama}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="default">
                            {speaker.avgScore?.toFixed(2)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-foreground">
                          {speaker.kegiatanCount}
                        </TableCell>
                        <TableCell className="text-right text-foreground">
                          {speaker.totalSkp.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {speaker.respondenCount}
                        </TableCell>
                      </TableRow>
                    ))}
                    {rankedSpeakers.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground"
                        >
                          Belum ada narasumber dengan data evaluasi.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* ─── Score Trend Charts ────────────────────────────────────────── */}
          {rankedSpeakers.filter((s) => s.trend.length >= 2).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tren Skor Evaluasi per Narasumber</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {rankedSpeakers
                  .filter((s) => s.trend.length >= 2)
                  .map((speaker) => (
                    <SpeakerTrendChart key={speaker.narasumberId} speaker={speaker} />
                  ))}
              </CardContent>
            </Card>
          )}

          {/* ─── Narasumber Without Evaluation Data ────────────────────────── */}
          {unrankedSpeakers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Narasumber Tanpa Data Evaluasi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama</TableHead>
                        <TableHead className="text-right">Kegiatan</TableHead>
                        <TableHead className="text-right">Total SKP</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unrankedSpeakers.map((speaker) => (
                        <TableRow key={speaker.narasumberId}>
                          <TableCell className="text-foreground font-medium">
                            {speaker.nama}
                          </TableCell>
                          <TableCell className="text-right text-foreground">
                            {speaker.kegiatanCount}
                          </TableCell>
                          <TableCell className="text-right text-foreground">
                            {speaker.totalSkp.toLocaleString("id-ID")}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700"
                            >
                              Belum ada data evaluasi
                            </Badge>
                          </TableCell>
                        </TableRow>
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


// ─── Speaker Trend Chart Component ───────────────────────────────────────────

function SpeakerTrendChart({ speaker }: { speaker: SpeakerPerformanceRow }) {
  const chartData = speaker.trend.map((t) => ({
    tanggal: t.tanggalSelesai,
    skor: t.avgScore,
    responden: t.respondenCount,
    kegiatan: t.kegiatanNama,
  }));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-medium text-foreground">{speaker.nama}</h4>
        <Badge variant="outline" className="text-xs">
          Avg: {speaker.avgScore?.toFixed(2)}
        </Badge>
      </div>
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%" minHeight={1}>
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="tanggal"
              className="text-xs"
              tickLine={false}
              tickFormatter={formatDate}
            />
            <YAxis
              className="text-xs"
              tickLine={false}
              width={40}
              domain={[0, "auto"]}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const entry = payload[0]?.payload as {
                  tanggal: string;
                  skor: number;
                  responden: number;
                  kegiatan: string;
                };
                if (!entry) return null;
                return (
                  <div className="rounded-lg border bg-card p-3 text-sm shadow-sm">
                    <p className="font-medium text-foreground">{entry.kegiatan}</p>
                    <p className="text-muted-foreground">{formatDate(entry.tanggal)}</p>
                    <p className="mt-1 text-foreground">
                      Skor: <span className="font-medium">{entry.skor.toFixed(2)}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Responden: {entry.responden}
                    </p>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="skor"
              name="skor"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 4, fill: "#2563eb" }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
  ];
  const monthIdx = parseInt(parts[1]!, 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return dateStr;
  return `${parseInt(parts[2]!, 10)} ${MONTH_NAMES[monthIdx]} ${parts[0]}`;
}
