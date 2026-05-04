"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { syncAbsensiDariDingTalk } from "@/server/actions/dingtalk/sync-attendance";

export function AbsensiManager({
  currentUserId,
}: {
  currentUserId: string;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);

      const res = await syncAbsensiDariDingTalk(fmt(from), fmt(now));

      if (res.ok) {
        toast.success(
          `Sync selesai: ${res.data.berhasil} record dari ${res.data.totalUser} user DingTalk` +
          (res.data.unlinked ? ` (${res.data.unlinked} belum punya akun ARKA)` : ""),
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Gagal sync absensi.");
    } finally {
      setSyncing(false);
    }
  }, [router]);

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
          <AbsensiCalendar viewMode="table" />
        </TabsContent>

        <TabsContent value="calendar">
          <AbsensiCalendar viewMode="calendar" />
        </TabsContent>

        <TabsContent value="stats">
          <AbsensiStats />
        </TabsContent>
      </Tabs>
    </div>
  );
}
