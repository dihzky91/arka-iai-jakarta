import type { ReactNode } from "react";

export function PageWrapper({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-medium text-foreground">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex flex-wrap gap-2 sm:justify-end">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}
