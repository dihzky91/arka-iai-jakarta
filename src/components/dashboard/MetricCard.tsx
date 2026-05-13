import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
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
  primary: { bg: "bg-primary/10", fg: "text-primary" },
  emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/30", fg: "text-emerald-600 dark:text-emerald-400" },
  amber: { bg: "bg-amber-50 dark:bg-amber-950/30", fg: "text-amber-600 dark:text-amber-400" },
  blue: { bg: "bg-blue-50 dark:bg-blue-950/30", fg: "text-blue-600 dark:text-blue-400" },
  violet: { bg: "bg-violet-50 dark:bg-violet-950/30", fg: "text-violet-600 dark:text-violet-400" },
  red: { bg: "bg-red-50 dark:bg-red-950/30", fg: "text-red-600 dark:text-red-400" },
  indigo: { bg: "bg-indigo-50 dark:bg-indigo-950/30", fg: "text-indigo-600 dark:text-indigo-400" },
};

interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  icon: LucideIcon;
  tone?: MetricTone;
  compact?: boolean;
  heroLayout?: boolean;
  delta?: string;
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
  heroLayout = false,
  delta,
  className,
}: MetricCardProps) {
  const styles = TONE_STYLES[tone];

  const baseClasses = cn(
    "group relative block h-full overflow-hidden rounded-[24px] border border-border/60 bg-card text-card-foreground shadow-sm transition-all duration-300",
    compact ? "p-5" : "p-6",
    href && "hover:border-primary/20 hover:shadow-md",
    className,
  );

  const watermark = (
    <Icon
      className={cn(
        "absolute -bottom-6 -right-6 h-32 w-32 opacity-[0.03] transition-transform duration-500 ease-out group-hover:scale-110 group-hover:-rotate-12",
        styles.fg,
      )}
    />
  );

  const content = heroLayout ? (
    // Hero layout: icon top-left, delta badge top-right, then label, value, hint
    <div className="relative z-10 flex h-full flex-col gap-3">
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110",
            styles.bg,
            "h-11 w-11",
          )}
        >
          <Icon className={cn("h-5 w-5", styles.fg)} />
        </div>
        {delta && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
            {delta}
          </span>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {value}
        </p>
        {hint && (
          <p className="mt-1.5 text-sm font-medium leading-5 text-muted-foreground">{hint}</p>
        )}
      </div>
    </div>
  ) : (
    // Standard layout: label top-left, icon top-right, value bottom
    <div className="relative z-10 flex h-full flex-col justify-between gap-4">
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "font-semibold tracking-[0.18em] text-muted-foreground uppercase",
            compact ? "text-[10px]" : "text-xs tracking-[0.2em]",
          )}
        >
          {label}
        </p>
        <div className="flex flex-col items-end gap-1.5">
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110",
              styles.bg,
              compact ? "h-9 w-9" : "h-11 w-11",
            )}
          >
            <Icon className={cn(compact ? "h-4 w-4" : "h-5 w-5", styles.fg)} />
          </div>
          {delta && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
              {delta}
            </span>
          )}
        </div>
      </div>
      <div>
        <p
          className={cn(
            "font-bold text-foreground tracking-tight",
            compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl",
          )}
        >
          {value}
        </p>
        {hint && (
          <p
            className={cn(
              "mt-1.5 leading-5 text-muted-foreground font-medium",
              compact ? "text-xs" : "text-sm",
            )}
          >
            {hint}
          </p>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <motion.div whileHover={{ y: -4 }} className="h-full">
        <Link href={href} className={baseClasses}>
          {content}
          {watermark}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div whileHover={{ y: -4 }} className={baseClasses}>
      {content}
      {watermark}
    </motion.div>
  );
}
