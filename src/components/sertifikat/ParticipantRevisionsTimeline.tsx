"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  Ban,
  CheckCircle,
  CircleDot,
  History,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  listParticipantRevisions,
  type ParticipantRevisionRow,
} from "@/server/actions/sertifikat/participants";

const CHANGE_TYPE_META: Record<string, { label: string; icon: typeof CircleDot; className: string }> = {
  create: { label: "Dibuat", icon: Plus, className: "text-emerald-600 dark:text-emerald-400" },
  update: { label: "Diubah", icon: Pencil, className: "text-blue-600 dark:text-blue-400" },
  revoke: { label: "Dicabut", icon: Ban, className: "text-red-600 dark:text-red-400" },
  reactivate: { label: "Diaktifkan", icon: CheckCircle, className: "text-emerald-600 dark:text-emerald-400" },
  soft_delete: { label: "Dihapus", icon: Trash2, className: "text-orange-600 dark:text-orange-400" },
  restore: { label: "Dipulihkan", icon: RotateCcw, className: "text-blue-600 dark:text-blue-400" },
  reissue: { label: "Diterbitkan ulang", icon: History, className: "text-purple-600 dark:text-purple-400" },
};

function formatDateTime(value: Date | null) {
  if (!value) return "-";
  return format(new Date(value), "d MMM yyyy HH:mm", { locale: localeId });
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function ParticipantRevisionsTimeline({ participantId }: { participantId: number }) {
  const [rows, setRows] = useState<ParticipantRevisionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    listParticipantRevisions(participantId)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Gagal memuat riwayat.");
      });
    return () => {
      cancelled = true;
    };
  }, [participantId]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (rows === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memuat riwayat...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Belum ada riwayat perubahan"
        description="Perubahan data peserta akan tampil di sini setelah ada edit, pencabutan, penerbitan ulang, atau pemulihan."
        className="min-h-32"
      />
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-border/60 pl-6">
      {rows.map((row) => {
        const meta = CHANGE_TYPE_META[row.changeType] ?? {
          label: row.changeType,
          icon: CircleDot,
          className: "text-muted-foreground",
        };
        const Icon = meta.icon;
        return (
          <li key={row.id} className="relative">
            <span className={`absolute -left-9 top-1 flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-card shadow-sm ${meta.className}`}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                <span className="text-xs text-muted-foreground">{formatDateTime(row.createdAt)}</span>
                {row.changedByName ? (
                  <span className="text-xs text-muted-foreground">oleh {row.changedByName}</span>
                ) : null}
              </div>
              {row.note ? <p className="text-sm">{row.note}</p> : null}
              {(row.before || row.after) && row.changeType === "update" ? (
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  <div className="rounded-md border border-border/60 bg-muted/25 p-2">
                    <p className="font-medium text-muted-foreground">Sebelum</p>
                    <pre className="mt-1 whitespace-pre-wrap break-words font-mono">{formatJson(row.before)}</pre>
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/25 p-2">
                    <p className="font-medium text-muted-foreground">Sesudah</p>
                    <pre className="mt-1 whitespace-pre-wrap break-words font-mono">{formatJson(row.after)}</pre>
                  </div>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
