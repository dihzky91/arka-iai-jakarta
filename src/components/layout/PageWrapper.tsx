import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function PageWrapper({
  title,
  description,
  action,
  backHref,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  backHref?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {backHref && (
            <Link
              href={backHref}
              className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Kembali
            </Link>
          )}
          <h1 className="text-2xl font-medium tracking-tight text-foreground">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex flex-wrap gap-2 sm:justify-end">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}
