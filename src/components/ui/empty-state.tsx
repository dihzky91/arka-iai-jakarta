import type { ReactNode } from "react";
import { ClipboardList, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  description: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon = ClipboardList,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/25 px-5 py-8 text-center",
        className,
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background text-muted-foreground shadow-sm ring-1 ring-border/60">
        <Icon className="h-5 w-5" />
      </div>
      {title ? <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3> : null}
      <p className={cn("max-w-md text-sm leading-6 text-muted-foreground", title && "mt-1")}>
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
