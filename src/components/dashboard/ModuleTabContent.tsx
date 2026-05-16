import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ModuleTabContentProps {
  title?: string;
  description?: string;
  metrics?: ReactNode;
  insights?: ReactNode;
  activity?: ReactNode;
  quickActions?: ReactNode;
  className?: string;
}

export function ModuleTabContent({
  title,
  description,
  metrics,
  insights,
  activity,
  quickActions,
  className,
}: ModuleTabContentProps) {
  return (
    <div className={cn("space-y-5 sm:space-y-6", className)}>
      {(title || description) && (
        <div>
          {title && <h2 className="text-lg font-medium text-foreground">{title}</h2>}
          {description && (
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      )}
      {metrics}
      {insights}
      {activity}
      {quickActions}
    </div>
  );
}
