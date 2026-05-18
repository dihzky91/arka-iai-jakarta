"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart3, RefreshCw } from "lucide-react";
import { getProjectsReport, type ProjectReportRow } from "@/server/actions/projects";

function formatCurrency(value: number): string {
  if (value === 0) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const statusLabels: Record<string, string> = {
  not_started: "Belum Mulai",
  in_progress: "Berjalan",
  completed: "Selesai",
  on_hold: "Ditunda",
  cancelled: "Dibatalkan",
};

const statusColors: Record<string, string> = {
  not_started: "bg-slate-100 text-slate-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  on_hold: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
};

interface ProjectReportViewProps {
  initialReport: ProjectReportRow[];
}

export function ProjectReportView({ initialReport }: ProjectReportViewProps) {
  const [report, setReport] = useState(initialReport);
  const [isPending, startTransition] = useTransition();

  const refresh = () => {
    startTransition(async () => {
      const updated = await getProjectsReport();
      setReport(updated);
    });
  };

  const totalBudget = report.reduce((sum, r) => sum + r.totalBudget, 0);
  const totalExpenses = report.reduce((sum, r) => sum + r.totalExpenses, 0);
  const totalTasks = report.reduce((sum, r) => sum + r.taskCount, 0);
  const totalDone = report.reduce((sum, r) => sum + r.taskDoneCount, 0);

  if (report.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Belum ada data"
        description="Belum ada project yang bisa dilaporkan."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Project</p>
            <p className="text-2xl font-semibold">{report.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Anggaran</p>
            <p className="text-lg font-semibold">{formatCurrency(totalBudget)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Pengeluaran</p>
            <p className="text-lg font-semibold">{formatCurrency(totalExpenses)}</p>
            {totalBudget > 0 && (
              <p className={`text-xs mt-0.5 ${totalExpenses > totalBudget ? "text-red-600" : "text-emerald-600"}`}>
                {totalExpenses <= totalBudget
                  ? `Sisa: ${formatCurrency(totalBudget - totalExpenses)}`
                  : `Over: ${formatCurrency(totalExpenses - totalBudget)}`}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Task Selesai</p>
            <p className="text-2xl font-semibold">
              {totalDone}<span className="text-sm text-muted-foreground">/{totalTasks}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Refresh */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={refresh} disabled={isPending}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Project Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Detail per Project</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Project</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Progress</th>
                  <th className="pb-2 pr-4 font-medium text-right">Anggaran</th>
                  <th className="pb-2 pr-4 font-medium text-right">Pengeluaran</th>
                  <th className="pb-2 font-medium text-right">Selisih</th>
                </tr>
              </thead>
              <tbody>
                {report.map((row) => {
                  const delta = row.totalBudget - row.totalExpenses;
                  return (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-4">
                        <Link
                          href={`/projects/${row.id}`}
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {row.title}
                        </Link>
                        <p className="text-xs text-muted-foreground capitalize">
                          {row.type.replace(/_/g, " ")}
                        </p>
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge className={`text-xs ${statusColors[row.status] ?? ""}`} variant="secondary">
                          {statusLabels[row.status] ?? row.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <Progress value={row.progress} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground w-8 text-right">{row.progress}%</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {row.taskDoneCount}/{row.taskCount} task
                        </p>
                      </td>
                      <td className="py-2.5 pr-4 text-right whitespace-nowrap">
                        {row.totalBudget > 0 ? formatCurrency(row.totalBudget) : "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-right whitespace-nowrap">
                        {row.totalExpenses > 0 ? formatCurrency(row.totalExpenses) : "—"}
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        {row.totalBudget > 0 || row.totalExpenses > 0 ? (
                          <span className={delta >= 0 ? "text-emerald-600" : "text-red-600"}>
                            {delta >= 0 ? "+" : ""}{formatCurrency(delta)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
