"use client";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { type ProjectActivityRow } from "@/server/actions/projects";

export function ActivityLog({ rows }: { rows: ProjectActivityRow[] }) {
  return (
    <section className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="flex items-start gap-3 rounded-xl border border-border/60 p-4">
            <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary/30" />
            <div className="min-w-0">
              <p className="font-medium">{row.userName ?? "User"}</p>
              <p className="text-sm text-muted-foreground">{row.description ?? row.action}</p>
              <time className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true, locale: id })}
              </time>
            </div>
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Belum ada aktivitas.
          </p>
        ) : null}
      </div>
    </section>
  );
}
