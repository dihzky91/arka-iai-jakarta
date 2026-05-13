import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionButtonProps {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  className?: string;
}

export function QuickActionButton({
  href,
  label,
  icon: Icon,
  description,
  className,
}: QuickActionButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-16 items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/50 hover:shadow-md",
        className,
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
            {description}
          </span>
        )}
      </span>
    </Link>
  );
}
