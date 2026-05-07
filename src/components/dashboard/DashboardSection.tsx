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

/**
 * Section wrapper untuk Ringkasan dashboard:
 * - Header berisi judul modul + link "Detail" ke tab modul
 * - Body untuk grid metric / konten section
 */
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
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-center gap-2">
          {Icon && (
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Icon className="h-4 w-4" />
            </span>
          )}
          <div>
            <h2 className="text-base font-semibold text-foreground sm:text-lg">
              {title}
            </h2>
            {description && (
              <p className="text-xs text-muted-foreground sm:text-sm">
                {description}
              </p>
            )}
          </div>
        </div>
        {detailHref && (
          <Link
            href={detailHref}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline sm:text-sm"
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
