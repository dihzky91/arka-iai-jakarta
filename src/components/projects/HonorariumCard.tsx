"use client";

import { useState, useTransition } from "react";
import { Banknote, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getHonorariumSummaryByProject,
  type HonorariumSummary,
} from "@/server/actions/projects";

function honorariumStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Draft",
    dikirim_ke_keuangan: "Diajukan",
    diproses_keuangan: "Diproses",
    dibayar: "Dibayar",
    locked: "Terkunci",
  };
  return labels[status] ?? status;
}

function honorariumStatusColor(status: string) {
  const colors: Record<string, string> = {
    draft: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-700",
    dikirim_ke_keuangan: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/70",
    diproses_keuangan: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-800/70",
    dibayar: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/70",
    locked: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800/70",
  };
  return colors[status] ?? "bg-gray-50 text-gray-700 border-gray-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-700";
}

function rupiah(value: number | string | null | undefined) {
  return `Rp ${Number(value ?? 0).toLocaleString("id-ID")}`;
}

export function HonorariumCard({
  projectId,
  initialSummary,
}: {
  projectId: string;
  initialSummary?: HonorariumSummary | null;
}) {
  const [summary, setSummary] = useState<HonorariumSummary | null | undefined>(
    initialSummary,
  );
  const [isPending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const result = await getHonorariumSummaryByProject(projectId);
      setSummary(result);
    });
  }

  if (summary === undefined || summary === null) return null;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-300">
            <Banknote className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold">Honorarium</h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={refresh}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {Object.entries(summary.statusCounts).map(([status, count]) => (
          <Badge
            key={status}
            variant="outline"
            className={`text-xs ${honorariumStatusColor(status)}`}
          >
            {honorariumStatusLabel(status)}: {count}
          </Badge>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Batch</p>
          <p className="font-medium">{summary.batchCount}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Narasumber</p>
          <p className="font-medium">{summary.totalNarasumber}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">Total Honorarium</p>
          <p className="font-semibold text-emerald-700 dark:text-emerald-300">
            {rupiah(summary.totalGrossAmount)}
          </p>
        </div>
      </div>

      {summary.batches.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          {summary.batches.slice(0, 3).map((batch) => (
            <div
              key={batch.id}
              className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-2.5 py-1.5 text-xs"
            >
              <span className="truncate font-medium">
                {batch.documentNumber}
              </span>
              <span>{rupiah(batch.totalAmount)}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3">
        <Button asChild variant="outline" size="sm" className="w-full text-xs">
          <a href="/keuangan/honorarium" target="_blank" rel="noreferrer">
            <ExternalLink className="h-3 w-3" />
            Buka Honorarium →
          </a>
        </Button>
      </div>
    </div>
  );
}
