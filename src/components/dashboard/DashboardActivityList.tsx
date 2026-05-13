import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ListChecks, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface DashboardActivityListProps {
  title: string;
  description?: string;
  detailHref?: string;
  detailLabel?: string;
  hasItems: boolean;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon?: LucideIcon;
  children: ReactNode;
}

export function DashboardActivityList({
  title,
  description,
  detailHref,
  detailLabel = "Lihat semua",
  hasItems,
  emptyTitle,
  emptyDescription,
  emptyIcon = ListChecks,
  children,
}: DashboardActivityListProps) {
  return (
    <section className="rounded-[24px] border border-border/60 bg-card p-4 text-card-foreground shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground sm:text-lg">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{description}</p>
          ) : null}
        </div>
        {detailHref ? (
          <Link
            href={detailHref}
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline sm:text-sm"
          >
            {detailLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      {hasItems ? (
        <div className="mt-4 grid gap-3 sm:mt-5">{children}</div>
      ) : (
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          className="mt-4 min-h-36 rounded-2xl sm:mt-5"
        />
      )}
    </section>
  );
}
