import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MetricTone } from "@/components/dashboard/MetricCard";

const TONE_STYLES: Record<MetricTone, { bg: string; fg: string; ring: string }> = {
  primary: {
    bg: "bg-primary/10",
    fg: "text-primary",
    ring: "ring-primary/10",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    fg: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/10",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    fg: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/10",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    fg: "text-blue-600 dark:text-blue-400",
    ring: "ring-blue-500/10",
  },
  violet: {
    bg: "bg-violet-50 dark:bg-violet-950/30",
    fg: "text-violet-600 dark:text-violet-400",
    ring: "ring-violet-500/10",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-950/30",
    fg: "text-red-600 dark:text-red-400",
    ring: "ring-red-500/10",
  },
  indigo: {
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    fg: "text-indigo-600 dark:text-indigo-400",
    ring: "ring-indigo-500/10",
  },
};

interface DashboardInsightCardProps {
  title: string;
  value?: string;
  description: string;
  icon: LucideIcon;
  tone?: MetricTone;
  children?: ReactNode;
  className?: string;
}

export function DashboardInsightCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "primary",
  children,
  className,
}: DashboardInsightCardProps) {
  const styles = TONE_STYLES[tone];

  return (
    <section
      className={cn(
        "rounded-[24px] border border-border/60 bg-card p-5 text-card-foreground shadow-sm",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1",
            styles.bg,
            styles.fg,
            styles.ring,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {value && (
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
              {value}
            </p>
          )}
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}
