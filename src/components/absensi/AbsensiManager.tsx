"use client";

import { useState, useCallback } from "react";
import {
  Calendar,
  Clock,
  BarChart3,
  RefreshCw,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { AbsensiCalendar } from "./AbsensiCalendar";
import { AbsensiStats } from "./AbsensiStats";
import { getMonthRangeInJakarta, getTodayIsoInJakarta } from "@/lib/utils";

export function AbsensiManager({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const [syncing, setSyncing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const { start } = getMonthRangeInJakarta();
      const today = getTodayIsoInJakarta();
      const response = await fetch("/api/absensi/sync-dingtalk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tanggalMulai: start, tanggalSelesai: today }),
      });
      const res = (await response.json()) as
        | {
            ok: true;
            data: {
              berhasil: number;
              gagal?: number;
              diperbarui?: number;
              unlinked?: number;
              totalUser: number;
            };
          }
        | { ok: false; error: string };

      if (response.ok && res.ok) {
        toast.success(
          `Sync selesai: ${res.data.berhasil} record dari ${res.data.totalUser} user DingTalk` +
          (res.data.unlinked ? ` (${res.data.unlinked} belum punya akun ARKA)` : ""),
        );
        setRefreshKey((key) => key + 1);
      } else {
        toast.error(res.ok ? "Gagal sync absensi." : res.error);
      }
    } catch {
      toast.error("Gagal sync absensi.");
    } finally {
      setSyncing(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="default"
              onClick={handleSync}
              disabled={syncing}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sync..." : "Sync dari DingTalk"}
            </Button>
            <Button variant="outline" disabled>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table">
            <Clock className="mr-2 h-4 w-4" />
            Rekap Harian
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <Calendar className="mr-2 h-4 w-4" />
            Kalender
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart3 className="mr-2 h-4 w-4" />
            Statistik
          </TabsTrigger>
        </TabsList>

        <TabsContent value="table">
          <AbsensiCalendar viewMode="table" refreshKey={refreshKey} />
        </TabsContent>

        <TabsContent value="calendar">
          <AbsensiCalendar viewMode="calendar" refreshKey={refreshKey} />
        </TabsContent>

        <TabsContent value="stats">
          <AbsensiStats refreshKey={refreshKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
