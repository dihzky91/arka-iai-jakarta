import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  detailHref?: string;
  detailLabel?: string;
  children: React.ReactNode;
  className?: string;
}

export function DashboardSection({
  title,
  description,
  icon: Icon,
  detailHref,
  detailLabel = "Lihat detail",
  children,
  className,
}: DashboardSectionProps) {
  return (
    <section className={cn("space-y-3 sm:space-y-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {Icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10">
              <Icon className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground sm:text-lg">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 max-w-2xl text-xs leading-5 text-muted-foreground sm:text-sm">
                {description}
              </p>
            )}
          </div>
        </div>
        {detailHref && (
          <Link
            href={detailHref}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 sm:text-sm"
          >
            {detailLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
