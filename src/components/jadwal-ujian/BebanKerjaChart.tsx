"use client";

import { useState, useTransition, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getBebanKerja, type BebanKerjaRow } from "@/server/actions/jadwal-ujian/bebanKerja";

const PROGRAM_OPTIONS = ["Brevet AB", "Brevet C", "BFA", "Lainnya"] as const;

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const currentYear = new Date().getFullYear();
const YEARS = [currentYear - 1, currentYear, currentYear + 1];

interface BebanKerjaChartProps {
  initialData: BebanKerjaRow[];
}

export function BebanKerjaChart({ initialData }: BebanKerjaChartProps) {
  const [data, setData] = useState<BebanKerjaRow[]>(initialData);
  const [bulan, setBulan] = useState<string>("__all__");
  const [tahun, setTahun] = useState<string>(String(currentYear));
  const [program, setProgram] = useState<string>("__all__");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getBebanKerja({
        bulan: bulan !== "__all__" ? Number(bulan) : undefined,
        tahun: Number(tahun),
        program: program !== "__all__" ? (program as (typeof PROGRAM_OPTIONS)[number]) : undefined,
      });
      setData(result);
    });
  }, [bulan, tahun, program]);

  const chartData = data.map((r) => ({
    nama: r.namaPengawas.split(" ")[0],
    namaLengkap: r.namaPengawas,
    tugas: r.jumlahTugas,
    konflik: r.jumlahKonflik,
  }));

  const totalTugas = data.reduce((s, r) => s + r.jumlahTugas, 0);
  const totalKonflik = data.reduce((s, r) => s + r.jumlahKonflik, 0);

  return (
    <div className="space-y-6">
      <Card className="rounded-[24px]">
        <CardHeader className="border-b border-border">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Beban Kerja Pengawas</CardTitle>
              <CardDescription className="mt-1">
                Distribusi jumlah penugasan per pengawas dalam periode yang dipilih.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={bulan} onValueChange={setBulan}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Semua Bulan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Semua Bulan</SelectItem>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tahun} onValueChange={setTahun}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={program} onValueChange={setProgram}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Semua Program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Semua Program</SelectItem>
                  {PROGRAM_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="text-sm text-muted-foreground">
              Total tugas:{" "}
              <span className="font-semibold text-foreground tabular-nums">{totalTugas}</span>
            </div>
            {totalKonflik > 0 && (
              <Badge variant="destructive">{totalKonflik} konflik</Badge>
            )}
            {isPending && (
              <span className="text-xs text-muted-foreground animate-pulse">Memuat...</span>
            )}
          </div>

          {chartData.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-16">
              Tidak ada data untuk periode ini.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="nama" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload;
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-md text-sm space-y-1">
                        <p className="font-medium">{d.namaLengkap}</p>
                        <p className="text-muted-foreground">
                          Tugas: <span className="font-medium text-foreground tabular-nums">{d.tugas}</span>
                        </p>
                        {d.konflik > 0 && (
                          <p className="text-destructive">
                            Konflik: <span className="font-medium tabular-nums">{d.konflik}</span>
                          </p>
                        )}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="tugas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[24px]">
        <CardHeader className="border-b border-border">
          <CardTitle className="text-base">Tabel Detail</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 font-medium">Pengawas</th>
                <th className="text-right py-2 font-medium">Tugas</th>
                <th className="text-right py-2 font-medium">Konflik</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.pengawasId} className="border-b last:border-0">
                  <td className="py-2">{r.namaPengawas}</td>
                  <td className="py-2 text-right tabular-nums">{r.jumlahTugas}</td>
                  <td className="py-2 text-right tabular-nums">
                    {r.jumlahKonflik > 0 ? (
                      <span className="text-destructive font-medium">{r.jumlahKonflik}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-muted-foreground">
                    Tidak ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
