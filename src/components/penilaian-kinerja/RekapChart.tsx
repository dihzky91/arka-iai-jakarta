"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { RekapPerDivisi } from "@/server/actions/penilaianKinerja";

interface RekapChartProps {
  data: RekapPerDivisi[];
}

export function RekapChart({ data }: RekapChartProps) {
  const chartData = data.map((d) => ({
    nama: d.divisiNama,
    "Nilai Tugas": parseFloat(d.rataRataTugas.toFixed(1)),
    "Nilai Perilaku": parseFloat(d.rataRataPerilaku.toFixed(1)),
    "Nilai Akhir": parseFloat(d.rataRataNilaiAkhir.toFixed(1)),
  }));

  if (chartData.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Belum ada data untuk ditampilkan.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="nama" fontSize={12} />
        <YAxis domain={[0, 100]} />
        <Tooltip />
        <Legend />
        <Bar dataKey="Nilai Tugas" fill="hsl(var(--chart-1, 220 70% 50%))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Nilai Perilaku" fill="hsl(var(--chart-2, 160 60% 45%))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Nilai Akhir" fill="hsl(var(--chart-3, 30 80% 55%))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
