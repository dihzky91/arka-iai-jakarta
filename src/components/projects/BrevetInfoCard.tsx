"use client";

import Link from "next/link";
import { useTransition } from "react";
import { CheckCircle2, Clock, Loader2, Plus, RefreshCw, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type BrevetJadwalSummary,
  type BrevetSummary,
} from "@/server/actions/projects";
import { autoGenerateBrevetTasks } from "@/server/actions/projects";
import { syncBrevetInstructors } from "@/server/actions/project-integrations-ppl";
import { EmptyText } from "./shared-ui";

function statusBadge(ok: boolean) {
  return ok ? (
    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
  ) : (
    <Clock className="h-3.5 w-3.5 text-amber-500" />
  );
}

function JadwalUjianSummary({ jadwal }: { jadwal: BrevetJadwalSummary[] }) {
  if (jadwal.length === 0) {
    return (
      <EmptyText
        icon={Clock}
        title="Belum ada jadwal ujian"
        text="Jadwal ujian brevet akan tampil setelah sinkron dengan modul jadwal ujian."
        className="min-h-28 px-4 py-6"
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="pb-1 pr-2 font-medium">Tanggal</th>
            <th className="pb-1 pr-2 font-medium">Materi</th>
            <th className="pb-1 font-medium">Pengawas</th>
          </tr>
        </thead>
        <tbody>
          {jadwal.map((item) => (
            <tr key={item.id} className="border-b border-border/40 last:border-0">
              <td className="py-1.5 pr-2 whitespace-nowrap">{item.tanggalUjian}</td>
              <td className="py-1.5 pr-2 max-w-40 truncate">
                {item.mataPelajaran.join(", ")}
              </td>
              <td className="py-1.5 flex items-center gap-1">
                {statusBadge(item.pengawasAssigned)}
                <span className="text-muted-foreground truncate max-w-24">
                  {item.pengawasNama ?? "-"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BrevetInfoCard({
  projectId,
  summary,
  canManage,
  onRefresh,
}: {
  projectId: string;
  summary: BrevetSummary;
  canManage: boolean;
  onRefresh: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function generateTasks() {
    startTransition(async () => {
      const result = await autoGenerateBrevetTasks(projectId);
      if (result.ok) {
        toast.success(`${result.count} task brevet berhasil dibuat.`);
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleSyncInstructors() {
    startTransition(async () => {
      const result = await syncBrevetInstructors(projectId);
      if (result.ok) {
        toast.success(`${result.count} instruktur berhasil di-sync ke project.`);
        onRefresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-violet-50 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
            B
          </span>
          Info Brevet
        </h3>
        <Badge variant="secondary" className="text-[10px]">
          {summary.tipe}
        </Badge>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="grid grid-cols-[90px_1fr] gap-1">
          <dt className="text-muted-foreground">Kelas</dt>
          <dd className="font-medium truncate">{summary.kelasNama}</dd>
        </div>
        <div className="grid grid-cols-[90px_1fr] gap-1">
          <dt className="text-muted-foreground">Program</dt>
          <dd className="font-medium">{summary.program}</dd>
        </div>
        <div className="grid grid-cols-[90px_1fr] gap-1">
          <dt className="text-muted-foreground">Mode</dt>
          <dd className="font-medium">{summary.mode}</dd>
        </div>
        <div className="grid grid-cols-[90px_1fr] gap-1">
          <dt className="text-muted-foreground">Lokasi</dt>
          <dd className="font-medium truncate">{summary.lokasi ?? "-"}</dd>
        </div>
        <div className="grid grid-cols-[90px_1fr] gap-1">
          <dt className="text-muted-foreground">Ujian</dt>
          <dd className="font-medium">{summary.totalUjian} terjadwal</dd>
        </div>
      </dl>

      <div className="mt-4">
        <h4 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Jadwal Ujian
        </h4>
        <JadwalUjianSummary jadwal={summary.jadwal} />
      </div>

      {canManage ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            disabled={isPending}
            onClick={generateTasks}
          >
            {isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Plus className="mr-1 h-3 w-3" />
            )}
            Generate Tasks
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            disabled={isPending}
            onClick={handleSyncInstructors}
          >
            {isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3 w-3" />
            )}
            Sync Instruktur
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" asChild>
            <Link href={`/jadwal-ujian/kelas?kelasId=${summary.kelasUjianId}`}>
              <UserPlus className="mr-1 h-3 w-3" />
              Buka Modul Brevet
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
