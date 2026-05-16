"use client";

import {
  Area,
  AreaChart,
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
import { Award, CalendarCheck2, Users, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  SertifikatAnalytics,
  SertifikatStats,
} from "@/server/actions/sertifikat/analytics";

const colors = ["#2563eb", "#059669", "#f59e0b", "#dc2626", "#7c3aed"];

export function AnalyticsCharts({
  stats,
  analytics,
}: {
  stats: SertifikatStats;
  analytics: SertifikatAnalytics;
}) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard icon={CalendarCheck2} label="Total Kegiatan" value={stats.totalEvents} />
        <StatCard icon={Users} label="Total Peserta" value={stats.totalParticipants} />
        <StatCard icon={Activity} label="Kegiatan Aktif" value={stats.activeEvents} />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-[24px] xl:col-span-2">
          <CardHeader>
            <CardTitle>Tren Peserta 12 Bulan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
            <ResponsiveContainer width="100%" height="100%" minHeight={1}>
              <AreaChart data={analytics.trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#2563eb" fill="#dbeafe" />
              </AreaChart>
            </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[24px]">
          <CardHeader>
            <CardTitle>Distribusi Kategori</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
            <ResponsiveContainer width="100%" height="100%" minHeight={1}>
              <PieChart>
                <Pie
                  data={analytics.categories}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={2}
                  label
                >
                  {analytics.categories.map((entry, index) => (
                    <Cell key={entry.name} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[24px]">
          <CardHeader>
            <CardTitle>Top 5 Kegiatan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
            <ResponsiveContainer width="100%" height="100%" minHeight={1}>
              <BarChart data={analytics.topEvents} layout="vertical" margin={{ left: 32 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={130} />
                <Tooltip />
                <Bar dataKey="participants" fill="#059669" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Award;
  label: string;
  value: number;
}) {
  return (
    <Card className="rounded-[24px]">
      <CardContent className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-normal tracking-[0.2em] text-muted-foreground uppercase">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-[24px] bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
