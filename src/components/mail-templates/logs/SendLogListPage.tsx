"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listSendLogs } from "@/server/actions/mail-templates/logs";
import type { EmailSendLog } from "@/server/db/schema";

interface LogsResult {
  logs: EmailSendLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface Stats {
  total: number;
  sent: number;
  failed: number;
  successRate: number;
}

interface Props {
  initialData: LogsResult;
  stats: Stats;
}

export function SendLogListPage({ initialData, stats }: Props) {
  const [data, setData] = useState(initialData);
  const [templateFilter, setTemplateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);

  async function loadPage(page: number) {
    setIsLoading(true);
    try {
      const result = await listSendLogs({
        page,
        pageSize: 25,
        templateKey: templateFilter || undefined,
        status: statusFilter !== "all" ? (statusFilter as "sent" | "failed" | "bounced") : undefined,
      });
      setData(result);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFilter() {
    await loadPage(1);
  }

  function formatDate(date: Date | string) {
    const d = new Date(date);
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/pengaturan/mail-templates">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Kembali
        </Link>
      </Button>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Terkirim" value={stats.sent} color="text-green-600" />
        <StatCard label="Gagal" value={stats.failed} color="text-red-600" />
        <StatCard label="Success Rate" value={`${stats.successRate}%`} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Template</span>
          <Input
            value={templateFilter}
            onChange={(e) => setTemplateFilter(e.target.value)}
            placeholder="Template key..."
            className="h-8 w-40 text-xs"
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Status</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="bounced">Bounced</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" className="h-8" onClick={handleFilter}>
          <Filter className="mr-1 h-3.5 w-3.5" />
          Filter
        </Button>
      </div>

      {/* Log Table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Waktu</th>
                <th className="px-3 py-2 text-left font-medium">Template</th>
                <th className="px-3 py-2 text-left font-medium">Penerima</th>
                <th className="px-3 py-2 text-left font-medium">Subject</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Provider</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    Belum ada log pengiriman email.
                  </td>
                </tr>
              ) : (
                data.logs.map((log) => (
                  <tr key={log.id} className="hover:bg-accent/50">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDate(log.sentAt)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-mono">{log.templateKey ?? "—"}</span>
                    </td>
                    <td className="px-3 py-2 max-w-[150px] truncate">
                      {log.recipientEmail}
                    </td>
                    <td className="px-3 py-2 max-w-[200px] truncate">
                      {log.subject}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-[10px]">
                        {log.provider}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Halaman {data.page} dari {data.totalPages} ({data.total} total)
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={data.page <= 1 || isLoading}
              onClick={() => loadPage(data.page - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              disabled={data.page >= data.totalPages || isLoading}
              onClick={() => loadPage(data.page + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className={`text-lg font-semibold ${color ?? ""}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "sent") {
    return (
      <span className="inline-flex items-center gap-0.5 text-green-600">
        <CheckCircle2 className="h-3 w-3" />
        Sent
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-0.5 text-red-600">
        <XCircle className="h-3 w-3" />
        Failed
      </span>
    );
  }
  return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
}
