import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type MetricTone =
  | "primary"
  | "emerald"
  | "amber"
  | "blue"
  | "violet"
  | "red"
  | "indigo";

const TONE_STYLES: Record<MetricTone, { bg: string; fg: string }> = {
  primary: {
    bg: "bg-primary/10",
    fg: "text-primary",
  },
  emerald: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    fg: "text-emerald-500",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-950/30",
    fg: "text-amber-500",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    fg: "text-blue-500",
  },
  violet: {
    bg: "bg-violet-50 dark:bg-violet-950/30",
    fg: "text-violet-500",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-950/30",
    fg: "text-red-500",
  },
  indigo: {
    bg: "bg-indigo-50 dark:bg-indigo-950/30",
    fg: "text-indigo-500",
  },
};

interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  icon: LucideIcon;
  tone?: MetricTone;
  /** Compact mode for use in summary grids (smaller paddings & font). */
  compact?: boolean;
  className?: string;
}

export function MetricCard({
  label,
  value,
  hint,
  href,
  icon: Icon,
  tone = "primary",
  compact = false,
  className,
}: MetricCardProps) {
  const styles = TONE_STYLES[tone];

  const content = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "font-semibold tracking-[0.18em] text-muted-foreground uppercase",
            compact ? "text-[10px]" : "text-xs tracking-[0.2em]",
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            "font-semibold text-foreground tabular-nums",
            compact ? "mt-2 text-xl sm:text-2xl" : "mt-3 text-2xl sm:text-3xl",
          )}
        >
          {value}
        </p>
        {hint && (
          <p
            className={cn(
              "leading-5 text-muted-foreground",
              compact ? "mt-1 text-xs" : "mt-2 text-sm",
            )}
          >
            {hint}
          </p>
        )}
      </div>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-2xl",
          styles.bg,
          compact ? "h-9 w-9" : "h-10 w-10 sm:h-11 sm:w-11",
        )}
      >
        <Icon className={cn(compact ? "h-4 w-4" : "h-5 w-5", styles.fg)} />
      </div>
    </div>
  );

  const baseClasses = cn(
    "rounded-[24px] border border-border bg-card shadow-sm",
    compact ? "p-3 sm:p-4" : "p-4 sm:p-5",
    href && "transition-colors hover:bg-muted/35",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={baseClasses}>
        {content}
      </Link>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}
