import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  FileText,
  FolderKanban,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { EmbeddedProjectData } from "@/server/actions/ppl-evaluasi/project-embedded";

interface Props {
  data: EmbeddedProjectData;
}

const STATUS_LABELS: Record<string, string> = {
  not_started: "Belum Dimulai",
  in_progress: "Berjalan",
  on_hold: "Ditunda",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  not_started: "secondary",
  in_progress: "default",
  on_hold: "outline",
  completed: "default",
  cancelled: "destructive",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function EmbeddedProjectView({ data }: Props) {
  const progressPercent = data.tasks.total > 0
    ? Math.round((data.tasks.done / data.tasks.total) * 100)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderKanban className="h-4 w-4" />
              Kolaborasi Project
            </CardTitle>
            <CardDescription className="mt-0.5">
              {data.title}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANTS[data.status] ?? "secondary"}>
              {STATUS_LABELS[data.status] ?? data.status}
            </Badge>
            <Button asChild variant="outline" size="sm">
              <Link href={`/projects/${data.projectId}`}>
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Buka Project
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* Tasks */}
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3" />
              Tasks
            </div>
            <p className="mt-1 text-lg font-semibold">
              {data.tasks.done}/{data.tasks.total}
            </p>
            <div className="mt-1 flex gap-2 text-[10px] text-muted-foreground">
              {data.tasks.inProgress > 0 && (
                <span className="flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {data.tasks.inProgress} aktif
                </span>
              )}
              {data.tasks.todo > 0 && (
                <span className="flex items-center gap-0.5">
                  <Circle className="h-2.5 w-2.5" />
                  {data.tasks.todo} pending
                </span>
              )}
            </div>
          </div>

          {/* Budget */}
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wallet className="h-3 w-3" />
              Budget
            </div>
            <p className="mt-1 text-sm font-semibold">
              {formatCurrency(data.budget.totalRealisasi)}
            </p>
            {data.budget.totalRencana > 0 && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                dari {formatCurrency(data.budget.totalRencana)}
              </p>
            )}
          </div>

          {/* Files */}
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" />
              Dokumen
            </div>
            <p className="mt-1 text-lg font-semibold">{data.fileCount}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">file</p>
          </div>

          {/* Task Completion */}
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3" />
              Selesai
            </div>
            <p className="mt-1 text-lg font-semibold">{progressPercent}%</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {data.tasks.done} dari {data.tasks.total} task
            </p>
          </div>
        </div>

        {/* Recent Activity */}
        {data.recentActivity.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-medium text-muted-foreground">
              Aktivitas Terbaru
            </h4>
            <div className="space-y-2">
              {data.recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-2 text-xs"
                >
                  <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                  <div className="flex-1">
                    <span className="text-foreground">
                      {activity.description ?? activity.action}
                    </span>
                    <span className="ml-1 text-muted-foreground">
                      — {activity.userName ?? "System"}
                    </span>
                  </div>
                  <span className="shrink-0 text-muted-foreground">
                    {formatDistanceToNow(activity.createdAt, {
                      addSuffix: true,
                      locale: localeId,
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
