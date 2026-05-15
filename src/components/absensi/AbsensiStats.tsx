"use client";

import { useState, useEffect, useCallback } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { id } from "date-fns/locale";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AbsensiStats } from "@/server/actions/absensi";

export function AbsensiStats({ refreshKey = 0 }: { refreshKey?: number }) {
  const [month, setMonth] = useState(new Date());
  const [stats, setStats] = useState<AbsensiStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const from = format(startOfMonth(month), "yyyy-MM-dd");
      const to = format(endOfMonth(month), "yyyy-MM-dd");
      const params = new URLSearchParams({
        tanggalMulai: from,
        tanggalSelesai: to,
      });
      const response = await fetch(`/api/absensi/stats?${params.toString()}`);
      const res = (await response.json()) as
        | { ok: true; data: AbsensiStats }
        | { ok: false; error: string };
      setStats(response.ok && res.ok ? res.data : null);
    } finally {
      setLoading(false);
    }
  }, [month, refreshKey]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-[24px]" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const hadirPct = stats.total ? Math.round((stats.hadir / stats.total) * 100) : 0;
  const terlambatPct = stats.total ? Math.round((stats.terlambat / stats.total) * 100) : 0;
  const alphaPct = stats.total ? Math.round((stats.alpha / stats.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-semibold capitalize">
          {format(month, "MMMM yyyy", { locale: id })}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1))
            }
          >
            &larr;
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1))
            }
          >
            &rarr;
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-[24px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Hadir</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.hadir}</p>
            <p className="text-xs text-muted-foreground">{hadirPct}% kehadiran</p>
          </CardContent>
        </Card>

        <Card className="rounded-[24px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Terlambat</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.terlambat}</p>
            <p className="text-xs text-muted-foreground">{terlambatPct}% dari total</p>
          </CardContent>
        </Card>

        <Card className="rounded-[24px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Alpha</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.alpha}</p>
            <p className="text-xs text-muted-foreground">{alphaPct}% dari total</p>
          </CardContent>
        </Card>

        <Card className="rounded-[24px]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">records bulan ini</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
