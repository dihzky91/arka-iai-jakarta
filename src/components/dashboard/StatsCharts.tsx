"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileInput,
  FileOutput,
  Network,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/dashboard/MetricCard";
import type { DashboardStats } from "@/server/actions/statistics";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

interface StatsChartsProps {
  stats: DashboardStats;
}

export function StatsCharts({ stats }: StatsChartsProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  const monthlyData = useMemo(() => {
    return stats.suratKeluarMonthly.map((sk, i) => ({
      month: sk.month,
      keluar: sk.count,
      masuk: stats.suratMasukMonthly[i]?.count || 0,
    }));
  }, [stats]);

  const statusKeluarData = useMemo(() => {
    return stats.suratKeluarByStatus.map((s) => ({
      name: formatStatus(s.status),
      value: s.count,
    }));
  }, [stats.suratKeluarByStatus]);

  const jenisSuratData = useMemo(() => {
    return stats.suratByJenis
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((s) => ({
        name: formatJenis(s.jenis),
        value: s.count,
    }));
  }, [stats.suratByJenis]);

  return (
    <div className="grid gap-5 lg:gap-6 md:grid-cols-2">
      <Card className="md:col-span-2">
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Trend Surat Bulanan</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-64 sm:h-72">
            <ResponsiveContainer width="100%" height="100%" minHeight={1}>
              <LineChart
                data={monthlyData}
                margin={{ top: 8, right: isMobile ? 8 : 20, left: isMobile ? -20 : 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" width={isMobile ? 26 : 36} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="left"
                  iconType="circle"
                  wrapperStyle={{
                    fontSize: isMobile ? "12px" : "13px",
                    paddingBottom: isMobile ? "8px" : "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="keluar"
                  name="Surat Keluar"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: isMobile ? 2.5 : 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="masuk"
                  name="Surat Masuk"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: isMobile ? 2.5 : 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Status Surat Keluar</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-72 sm:h-64">
            <ResponsiveContainer width="100%" height="100%" minHeight={1}>
              <PieChart>
                <Pie
                  data={statusKeluarData}
                  cx="50%"
                  cy={isMobile ? "42%" : "50%"}
                  innerRadius={isMobile ? 42 : 60}
                  outerRadius={isMobile ? 62 : 80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusKeluarData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  align="center"
                  iconType="circle"
                  wrapperStyle={{
                    fontSize: isMobile ? "12px" : "13px",
                    lineHeight: 1.4,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Distribusi Jenis Surat</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="h-72 sm:h-64">
            <ResponsiveContainer width="100%" height="100%" minHeight={1}>
              <BarChart
                data={jenisSuratData}
                layout="vertical"
                margin={{ top: 4, right: isMobile ? 8 : 16, left: isMobile ? 12 : 24, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" className="text-xs" />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={isMobile ? 74 : 100}
                  className="text-xs"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    draft: "Draft",
    permohonan_persetujuan: "Persetujuan",
    reviu: "Reviu",
    pengarsipan: "Pengarsipan",
    selesai: "Selesai",
    dibatalkan: "Dibatalkan",
    diterima: "Diterima",
    diproses: "Diproses",
    diarsip: "Diarsip",
    belum_dibaca: "Belum Dibaca",
    dibaca: "Dibaca",
  };
  return map[status] || status;
}

function formatJenis(jenis: string): string {
  const map: Record<string, string> = {
    undangan: "Undangan",
    pemberitahuan: "Pemberitahuan",
    permohonan: "Permohonan",
    keputusan: "Keputusan",
    mou: "MOU",
    balasan: "Balasan",
    edaran: "Edaran",
    keterangan: "Keterangan",
    tugas: "Tugas",
    lainnya: "Lainnya",
  };
  return map[jenis] || jenis;
}

export function StatsSummary({ stats }: StatsChartsProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="Total Surat Keluar"
        value={stats.totalSuratKeluar}
        description="Seluruh periode"
        icon={FileOutput}
        tone="blue"
      />
      <StatCard
        title="Total Surat Masuk"
        value={stats.totalSuratMasuk}
        description="Seluruh periode"
        icon={FileInput}
        tone="emerald"
      />
      <StatCard
        title="Total Disposisi"
        value={stats.totalDisposisi}
        description="Seluruh periode"
        icon={Network}
        tone="amber"
      />
      <StatCard
        title="Total Pegawai"
        value={stats.totalPegawai}
        description="Pegawai aktif"
        icon={Users}
        tone="violet"
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
  tone,
}: {
  title: string;
  value: number;
  description: string;
  icon: LucideIcon;
  tone: "blue" | "emerald" | "amber" | "violet";
}) {
  return (
    <MetricCard
      label={title}
      value={value.toLocaleString("id-ID")}
      hint={description}
      icon={icon}
      tone={tone}
    />
  );
}
