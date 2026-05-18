"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Clock, RefreshCw, Timer, Users } from "lucide-react";
import {
  listGlobalTimesheets,
  getGlobalTimesheetSummary,
  type GlobalTimesheetRow,
  type GlobalTimesheetSummary,
} from "@/server/actions/projects";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}j ${m}m` : `${h}j`;
}

interface GlobalTimesheetViewProps {
  initialTimesheets: GlobalTimesheetRow[];
  initialSummary: GlobalTimesheetSummary;
}

export function GlobalTimesheetView({ initialTimesheets, initialSummary }: GlobalTimesheetViewProps) {
  const [timesheets, setTimesheets] = useState(initialTimesheets);
  const [summary, setSummary] = useState(initialSummary);
  const [isPending, startTransition] = useTransition();

  const refresh = () => {
    startTransition(async () => {
      const [ts, sum] = await Promise.all([listGlobalTimesheets(), getGlobalTimesheetSummary()]);
      setTimesheets(ts);
      setSummary(sum);
    });
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Timer className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Jam Kerja</p>
              <p className="text-lg font-semibold">{formatDuration(summary.totalMinutes)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Project</p>
              <p className="text-lg font-semibold">{summary.totalProjects}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Users className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Anggota Aktif</p>
              <p className="text-lg font-semibold">{summary.byUser.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per User Summary */}
      {summary.byUser.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Jam Kerja per Anggota</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.byUser.map((user) => (
                <div key={user.userId} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <span className="text-sm">{user.userName ?? "—"}</span>
                  <Badge variant="secondary">{formatDuration(user.totalMinutes)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per Project Summary */}
      {summary.byProject.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Jam Kerja per Project</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.byProject.map((proj) => (
                <div key={proj.projectId} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <Link
                    href={`/projects/${proj.projectId}`}
                    className="text-sm hover:text-primary hover:underline"
                  >
                    {proj.projectTitle}
                  </Link>
                  <Badge variant="secondary">{formatDuration(proj.totalMinutes)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Entries */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Entri Terbaru</h3>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isPending}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {timesheets.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Belum ada timesheet"
          description="Belum ada catatan jam kerja di project manapun."
        />
      ) : (
        <div className="space-y-2">
          {timesheets.slice(0, 50).map((entry) => (
            <Card key={entry.id} className="shadow-sm">
              <CardContent className="flex items-center gap-4 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.description || "Tanpa deskripsi"}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{entry.userName ?? "—"}</span>
                    <span>•</span>
                    <Link
                      href={`/projects/${entry.projectId}`}
                      className="hover:text-primary hover:underline"
                    >
                      {entry.projectTitle}
                    </Link>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline">{formatDuration(entry.durationMinutes ?? 0)}</Badge>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {format(new Date(entry.startTime), "d MMM", { locale: localeId })}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
